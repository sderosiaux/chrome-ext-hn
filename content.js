// content.js - Injects overlay with iframe on HN pages
(function() {
  // Prevent multiple initializations
  if (window.hnDistillInitialized) {
    console.log('HN Distill: Already initialized, skipping');
    return;
  }
  window.hnDistillInitialized = true;

  console.log('HN Distill: Content script loaded');

  let overlayVisible = false;
  let overlayElement = null;
  let iframeElement = null;

  // Extract thread ID from URL
  function getThreadId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }

  // Create overlay container
  function createOverlay() {
    // Overlay backdrop
    const overlay = document.createElement('div');
    overlay.id = 'hn-distill-overlay';
    overlay.className = 'hn-distill-overlay';

    // Modal container
    const modal = document.createElement('div');
    modal.className = 'hn-distill-modal';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'hn-distill-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', hideOverlay);

    // Iframe to load sidepanel.html
    const iframe = document.createElement('iframe');
    iframe.className = 'hn-distill-iframe';
    iframe.src = chrome.runtime.getURL('sidepanel.html');
    iframe.setAttribute('frameborder', '0');

    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideOverlay();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayVisible) {
        hideOverlay();
      }
    });

    overlayElement = overlay;
    iframeElement = iframe;

    return overlay;
  }

  // Show overlay
  function showOverlay() {
    if (!overlayElement) {
      const overlay = createOverlay();
      document.body.appendChild(overlay);
    }

    overlayElement.style.display = 'flex';
    overlayVisible = true;
    document.body.style.overflow = 'hidden'; // Prevent page scroll

    // Send message to iframe to trigger auto-analyze
    setTimeout(() => {
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.postMessage({ action: 'triggerAnalyze' }, '*');
        console.log('HN Distill: Sent triggerAnalyze message to iframe');
      }
    }, 500); // Wait a bit for iframe to load

    console.log('HN Distill: Overlay shown');
  }

  // Hide overlay
  function hideOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'none';
      overlayVisible = false;
      document.body.style.overflow = ''; // Restore page scroll
    }

    console.log('HN Distill: Overlay hidden');
  }

  // Create and inject the floating button
  function createDistillButton() {
    const threadId = getThreadId();
    if (!threadId) {
      console.log('HN Distill: No thread ID found in URL');
      return;
    }

    // Check if button already exists
    if (document.getElementById('hn-distill-button')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'hn-distill-button';
    button.className = 'hn-distill-fab';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        <path d="M9 12h6m-6 4h6"/>
      </svg>
      <span>Distill</span>
    `;

    button.addEventListener('click', () => {
      console.log('HN Distill: Button clicked');
      showOverlay();
    });

    document.body.appendChild(button);
    console.log('HN Distill: Button added to page');
  }

  // Listen for messages from the iframe (sidepanel)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getThreadId') {
      const threadId = getThreadId();
      sendResponse({ threadId });
      return true;
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDistillButton);
  } else {
    createDistillButton();
  }

  // Handle SPA-like navigation (if HN uses it)
  const observer = new MutationObserver(() => {
    const currentThreadId = getThreadId();
    const button = document.getElementById('hn-distill-button');

    if (currentThreadId && !button) {
      createDistillButton();
    } else if (!currentThreadId && button) {
      button.remove();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
