(() => {
  if (window.hnDistillInitialized) return;
  window.hnDistillInitialized = true;
  const id = new URL(location.href).searchParams.get('id');
  if (location.pathname !== '/item' || !/^\d+$/.test(id || '')) return;
  const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '');
  let session;
  function close() {
    if (!session?.dialog.open) return;
    session.frame.contentWindow.postMessage({ action: 'closed', token: session.token }, extensionOrigin);
    session.dialog.close();
    session.focus?.focus();
  }
  function notifyOpen() {
    if (session?.ready && session.dialog.open) session.frame.contentWindow.postMessage({ action: 'opened', token: session.token }, extensionOrigin);
  }
  function open() {
    if (!session) {
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = `:host{all:initial}dialog{box-sizing:border-box;padding:0;border:1px solid #e5e6e0;border-radius:12px;width:min(1120px,calc(100vw - 32px));height:calc(100dvh - 40px);max-width:none;max-height:none;background:#fff;box-shadow:0 25px 90px #282b2733;overflow:hidden}dialog::backdrop{background:#282b2752}iframe{display:block;width:100%;height:100%;border:0}@media(max-width:640px){dialog{width:calc(100vw - 12px);height:calc(100dvh - 24px);border-radius:8px}}`;
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', 'Lecture de la discussion HN');
      const frame = document.createElement('iframe');
      frame.title = 'HN Distill'; frame.allow = 'clipboard-write';
      const token = crypto.randomUUID();
      session = { host, dialog, frame, token, ready: false };
      dialog.append(frame); root.append(style, dialog); document.body.append(host);
      chrome.runtime.sendMessage({ action: 'registerReader', token, threadId: id }).then((response) => {
        if (!response?.ok) throw new Error('Impossible d’ouvrir Distill. Recharge la page HN.');
        frame.src = chrome.runtime.getURL(`panel.html?threadId=${id}&token=${token}`);
      }).catch(() => {
        const error = document.createElement('p');
        error.textContent = 'Impossible d’ouvrir Distill. Recharge la page HN et l’extension.';
        error.style.cssText = 'padding:24px;font:16px system-ui;color:#282b27';
        frame.replaceWith(error);
      });
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
      dialog.addEventListener('click', (event) => {
        const r = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) close();
      });
    }
    if (session.dialog.open) return;
    session.focus = document.activeElement;
    session.dialog.showModal(); session.frame.focus(); notifyOpen();
  }
  window.addEventListener('message', (event) => {
    if (!session || event.source !== session.frame.contentWindow || event.origin !== extensionOrigin || event.data?.token !== session.token) return;
    if (event.data.action === 'ready') { session.ready = true; notifyOpen(); }
    if (event.data.action === 'close') close();
  });
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message.action === 'openReader') open();
  });
  const button = document.createElement('button');
  button.id = 'hn-distill-button'; button.textContent = 'Distill';
  button.title = 'Comprendre cette discussion'; button.addEventListener('click', open);
  document.body.append(button);
})();
