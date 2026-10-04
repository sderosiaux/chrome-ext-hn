import { fetchThread } from './data.js';
import { analyzeThread } from './generation.js';
import { validateAnalysis } from './analysis.js';
import { sourceMap } from './data.js';
import { getSettings, saveSettings, cacheKey, readCache, writeCache, clearCache } from './storage.js';
import { createRenderer } from './render.js';
import { generateMarkdown } from './markdown.js';
import { createArchiveControl, openArchiveSettings } from './github-archive-ui.js';
import { summaryArchive } from './archive.js';

const $ = (id) => document.getElementById(id);
const renderer = createRenderer($('reader'));
const params = new URLSearchParams(location.search);
const threadId = params.get('threadId'), token = params.get('token');
const views = new Map();
let settings, thread, mode = 'summary', detail = 'short', active = null, current = null, opened = false;
const archive = createArchiveControl({ button: $('archive-button'), isReady: () => Boolean(settings && thread),
  getDocument: () => summaryArchive({ thread, settings, views }),
});
const abort = () => { active?.controller.abort(); clearInterval(active?.timer); active = null; $('stop-button').hidden = true; $('progress').hidden = true; };
const notify = (text = '', retry = false) => {
  $('notice').hidden = !text; $('notice-text').textContent = text; $('retry-button').hidden = !retry;
};
function close() {
  abort();
  window.parent.postMessage({ action: 'close', token }, 'https://news.ycombinator.com');
}
function progress(text) { $('progress').hidden = false; $('progress-label').textContent = text; }
function updateControls() {
  archive.update();
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.setAttribute('aria-selected', selected); button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-detail]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.detail === detail));
  $('detail-controls').hidden = mode === 'sources';
  $('reader').setAttribute('aria-labelledby', `tab-${mode}`);
  $('copy-button').disabled = mode === 'sources' ? !thread : !current?.result;
}

async function showView({ refresh = false, retry = false } = {}) {
  abort();
  const job = { controller: new AbortController(), startedAt: Date.now() }; active = job;
  $('progress-time').textContent = '';
  job.timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - job.startedAt) / 1000);
    $('progress-time').textContent = ` · ${seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`}`;
  }, 1000);
  const signal = job.controller.signal;
  const stillCurrent = () => { signal.throwIfAborted(); if (active !== job) throw new DOMException('Annulé', 'AbortError'); };
  const selectedMode = mode, selectedSettings = { ...settings, detail };
  current = null; renderer.reset(); notify(); $('empty').hidden = true;
  $('stop-button').hidden = false; updateControls();
  try {
    if (refresh || !thread) {
      progress('Lecture de la discussion…');
      const fetched = await fetchThread(threadId, { signal, onProgress: (n) => { if (active === job) progress(`Lecture de la discussion · ${n} commentaires`); } });
      stillCurrent(); thread = fetched;
    }
    $('thread-title').textContent = thread.title;
    if (selectedMode === 'sources') { renderer.discussion(thread); updateControls(); return; }
    const key = await cacheKey(thread, selectedSettings, selectedMode); stillCurrent();
    current = views.get(key) || { result: null, complete: false };
    if (!retry && current.result) {
      renderer.analysis(current.result, thread, selectedSettings.language);
      if (!current.complete) notify(current.provisional ? 'Notes préparatoires uniquement. La synthèse reste à terminer.' : 'Notes incomplètes. La génération a été interrompue.', true);
      updateControls(); return;
    }
    if (!retry) {
      const cached = await readCache(key); stillCurrent();
      if (cached) {
        try {
          current = { result: validateAnalysis(cached, sourceMap(thread), selectedMode), complete: true };
          views.set(key, current); renderer.analysis(current.result, thread, selectedSettings.language); updateControls(); return;
        } catch { /* Old or malformed caches must not prevent a fresh generation. */ }
      }
    }
    current = { result: null, complete: false }; views.set(key, current);
    if (!selectedSettings.apiKey) {
      $('empty').hidden = false;
      if (!$('settings-dialog').open) openSettings();
      return;
    }
    progress(selectedMode === 'qa' ? 'Préparation des questions-réponses…' : 'Mise en relation des arguments…');
    const result = await analyzeThread({ thread, settings: selectedSettings, mode: selectedMode, signal,
      onProgress: (text) => { if (active === job) progress(text); },
      onPartial: (result, { provisional = false } = {}) => {
        stillCurrent(); current.result = result; current.provisional = provisional;
        notify(provisional ? 'Notes préparatoires : la discussion est encore en cours de lecture.' : '');
        renderer.analysis(result, thread, selectedSettings.language); updateControls();
      },
    });
    stillCurrent();
    current.result = result; current.complete = true; current.provisional = false; notify();
    renderer.analysis(result, thread, selectedSettings.language); updateControls();
    try { const saved = await writeCache(key, result); if (active === job && !saved) notify('Ces notes sont trop volumineuses pour être conservées sur cet appareil. Tu peux les copier.'); }
    catch { if (active === job) notify('Notes disponibles. L’enregistrement local a échoué ; tu peux les copier.'); }
  } catch (error) {
    if (active !== job) return;
    if (error.partial?.sections?.length && current) {
      current.result = error.partial;
      current.provisional = Boolean(error.provisional);
      renderer.analysis(current.result, thread, selectedSettings.language); updateControls();
    }
    notify(error.name === 'AbortError' ? 'Génération arrêtée. Les passages reçus sont conservés.' : error.message || 'Impossible de terminer cette lecture.', true);
  } finally {
    clearInterval(job.timer);
    if (active === job) { active = null; $('stop-button').hidden = true; $('progress').hidden = true; updateControls(); }
  }
}

function populateKey() {
  const provider = $('provider').value;
  $('api-key').value = '';
  $('api-key').placeholder = settings.keys[provider] ? 'Laisser vide pour conserver la clé' : provider === 'claude' ? 'sk-ant-…' : 'sk-…';
  $('remember-key').checked = Boolean(settings.remembered[provider]);
}
function openSettings() {
  $('provider').value = settings.provider; populateKey();
  $('language').value = settings.language; $('personal-context').value = settings.personalContext;
  $('settings-error').hidden = true;
  if (!$('settings-dialog').open) $('settings-dialog').showModal();
}
function settingsError(error) { $('settings-error').textContent = error.message; $('settings-error').hidden = false; }

$('settings-button').addEventListener('click', () => settings && openSettings());
$('archive-settings').addEventListener('click', async () => {
  if (!settings) return;
  $('settings-dialog').close();
  try { await openArchiveSettings(); } catch (error) { notify(error.message); }
});
$('configure-button').addEventListener('click', openSettings);
$('cancel-settings').addEventListener('click', () => $('settings-dialog').close());
$('provider').addEventListener('change', populateKey);
$('close-button').addEventListener('click', close);
$('stop-button').addEventListener('click', () => {
  abort(); notify('Génération arrêtée. Les passages reçus sont conservés.', true);
});
$('retry-button').addEventListener('click', () => showView({ retry: true }));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('settings-dialog').open && !document.getElementById('github-archive-dialog')?.open) { event.preventDefault(); close(); }
});
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  if (!settings || mode === button.dataset.mode) return;
  mode = button.dataset.mode; $('main-content').scrollTop = 0; showView();
}));
document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[data-mode]')];
  let i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  event.preventDefault();
  i = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  tabs[i].focus(); tabs[i].click();
});
document.querySelectorAll('[data-detail]').forEach((button) => button.addEventListener('click', () => {
  if (!settings || detail === button.dataset.detail) return;
  detail = button.dataset.detail;
  showView();
}));
$('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = event.submitter; submit.disabled = true;
  try {
    const provider = $('provider').value;
    const apiKey = $('api-key').value.trim() || settings.keys[provider] || '';
    if (!apiKey) throw new Error('Ajoute la clé du fournisseur sélectionné.');
    if ((provider === 'claude') !== apiKey.startsWith('sk-ant-')) throw new Error('Cette clé ne correspond pas au fournisseur sélectionné.');
    abort();
    settings = await saveSettings({ ...settings, provider, apiKey, rememberKey: $('remember-key').checked,
      language: $('language').value, personalContext: $('personal-context').value.trim() });
    $('api-key').value = ''; $('settings-dialog').close();
    showView();
  } catch (error) { settingsError(error); }
  finally { submit.disabled = false; }
});
$('forget-key').addEventListener('click', async () => {
  try {
    abort();
    settings = await saveSettings({ ...settings, provider: $('provider').value, apiKey: '', rememberKey: false });
    populateKey(); $('settings-error').hidden = false; $('settings-error').textContent = 'Clé effacée.';
  } catch (error) { settingsError(error); }
});
$('clear-cache').addEventListener('click', async () => {
  try { abort(); await clearCache(); views.clear(); $('settings-error').hidden = false; $('settings-error').textContent = 'Notes enregistrées effacées.'; }
  catch (error) { settingsError(error); }
});
$('copy-button').addEventListener('click', async () => {
  if (!thread || (mode !== 'sources' && !current?.result)) return;
  const text = generateMarkdown(thread, mode === 'sources' ? null : current.result, {
    format: $('copy-format').value, language: settings.language, partial: mode !== 'sources' && !current.complete,
  });
  try {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.left = '-9999px';
      const focused = document.activeElement;
      document.body.append(field); field.select();
      const ok = document.execCommand('copy'); field.remove(); focused?.focus();
      if (!ok) throw new Error('Copie impossible dans ce navigateur.');
    }
    $('copy-button').textContent = 'Copié'; setTimeout(() => { $('copy-button').textContent = 'Copier'; }, 1600);
  } catch (error) { notify(error.message); }
});
window.addEventListener('pagehide', abort);
window.addEventListener('message', async (event) => {
  if (event.source !== window.parent || event.origin !== 'https://news.ycombinator.com' || event.data?.token !== token || !settings) return;
  if (event.data.action === 'opened' && !opened) { opened = true; await showView({ refresh: true }); }
  if (event.data.action === 'closed') { opened = false; abort(); if ($('settings-dialog').open) $('settings-dialog').close(); }
});

try {
  if (!/^\d+$/.test(threadId || '') || !token || window.parent === window) throw new Error('Ouvre Distill depuis une discussion Hacker News.');
  const authorization = await chrome.runtime.sendMessage({ action: 'validateReader', token, threadId });
  if (!authorization?.ok) throw new Error('Ce lecteur n’a pas été ouvert par Distill. Recharge la discussion HN.');
  settings = await getSettings(); updateControls();
  window.parent.postMessage({ action: 'ready', token }, 'https://news.ycombinator.com');
} catch (error) { notify(error.message); }
