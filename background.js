// background.js - Minimal background service worker for HN Distill

console.log('HN Distill: Background script loaded');

// Optional: Handle extension icon click (not really needed with overlay approach)
chrome.action.onClicked.addListener(async (tab) => {
  console.log('HN Distill: Extension icon clicked');

  // Check if we're on a HN thread page
  if (tab.url && tab.url.includes('news.ycombinator.com/item')) {
    // The content script will handle showing the overlay
    console.log('HN Distill: On HN thread page');
  } else {
    console.log('HN Distill: Not on a HN thread page');
  }
});
