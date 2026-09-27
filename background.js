import { initializeStorage } from './storage.js';

chrome.runtime.onInstalled.addListener(() => initializeStorage().catch(console.error));
// A page cannot authorize its own extension iframe: the content script registers
// the reader with the worker first, through Chrome's authenticated message channel.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['registerReader', 'validateReader'].includes(message?.action)) return;
  (async () => {
    if (sender.id !== chrome.runtime.id || !sender.tab?.id || !/^[\da-f-]{36}$/i.test(message.token || '')) return false;
    await initializeStorage();
    const url = new URL(sender.url);
    const key = `reader:${message.token}`;
    if (message.action === 'registerReader') {
      if (sender.frameId !== 0 || url.origin !== 'https://news.ycombinator.com' || url.pathname !== '/item' || url.searchParams.get('id') !== message.threadId) return false;
      await chrome.storage.session.set({ [key]: { tabId: sender.tab.id, threadId: message.threadId, createdAt: Date.now() } });
      const all = await chrome.storage.session.get(null);
      const old = Object.entries(all).filter(([k, v]) => k.startsWith('reader:') && k !== key && (v.tabId === sender.tab.id || Date.now() - v.createdAt > 86_400_000)).map(([k]) => k);
      if (old.length) await chrome.storage.session.remove(old);
      return true;
    }
    if (url.origin !== chrome.runtime.getURL('').replace(/\/$/, '') || url.pathname !== '/panel.html' || url.searchParams.get('token') !== message.token) return false;
    const record = (await chrome.storage.session.get(key))[key];
    return record?.tabId === sender.tab.id && record.threadId === message.threadId && url.searchParams.get('threadId') === record.threadId;
  })().then((ok) => respond({ ok }), () => respond({ ok: false }));
  return true;
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const all = await chrome.storage.session.get(null);
  const keys = Object.entries(all).filter(([k, v]) => k.startsWith('reader:') && v.tabId === tabId).map(([k]) => k);
  if (keys.length) await chrome.storage.session.remove(keys);
});
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  const url = new URL(tab.url);
  if (url.origin !== 'https://news.ycombinator.com' || url.pathname !== '/item') return;
  try { await chrome.tabs.sendMessage(tab.id, { action: 'openReader' }); }
  catch { await chrome.action.setTitle({ tabId: tab.id, title: 'Recharge cette page HN pour activer Distill' }); }
});
