// sidepanel.js - Main logic for the HN Distill side panel

import { ApiClientFactory } from "./api_client.js";
import { buildHNAnalysisPrompt } from "./prompts.js";

// Global state
let apiKey = null;
let currentThreadId = null;

// Thread-specific cache
// Key: threadId, Value: { state, threadData, analysisResult, error }
const threadCache = new Map();

// DOM Elements
const elements = {
  // Header
  headerTitle: document.getElementById("header-title"),
  copyMarkdownBtn: document.getElementById("copyMarkdownBtn"),
  apiKeyBtn: document.getElementById("apiKeyBtn"),

  // States
  loadingState: document.getElementById("loading-state"),
  errorState: document.getElementById("error-state"),
  errorMessage: document.getElementById("error-message"),
  retryBtn: document.getElementById("retry-btn"),

  // Results
  resultsContainer: document.getElementById("results-container"),
  globalLearnings: document.getElementById("global-learnings"),
  themesList: document.getElementById("themes-list"),
  themeDetail: document.getElementById("theme-detail"),

  // Theme Detail
  backToThemes: document.getElementById("back-to-themes"),
  themeDetailTitle: document.getElementById("theme-detail-title"),
  themeDetailWhy: document.getElementById("theme-detail-why"),
  themeDetailPoints: document.getElementById("theme-detail-points"),
  themeGlossarySection: document.getElementById("theme-glossary-section"),
  themeDetailGlossary: document.getElementById("theme-detail-glossary"),
  themeBeyondSection: document.getElementById("theme-beyond-section"),
  themeDetailBeyond: document.getElementById("theme-detail-beyond"),
  themeLinksSection: document.getElementById("theme-links-section"),
  themeDetailLinks: document.getElementById("theme-detail-links"),
  showCommentsBtn: document.getElementById("show-comments-btn"),
  commentCount: document.getElementById("comment-count"),

  // Modals
  apiKeyModal: document.getElementById("apiKeyModal"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiKeyStatus: document.getElementById("apiKeyStatus"),
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
  cancelApiKeyBtn: document.getElementById("cancelApiKeyBtn"),
  closeApiKeyBtn: document.getElementById("closeApiKeyBtn"),

  commentsModal: document.getElementById("commentsModal"),
  commentsList: document.getElementById("comments-list"),
  closeCommentsBtn: document.getElementById("closeCommentsBtn"),
};

// Initialize
async function init() {
  console.log("HN Distill: Sidepanel initializing");

  // Load API key from storage
  await loadApiKey();

  // Get thread ID from the active tab
  await loadThreadId();

  // Setup event listeners
  setupEventListeners();

  // Listen for messages from parent window (content script)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'triggerAnalyze') {
      console.log('HN Distill: Received triggerAnalyze message');
      handleAnalyzeOnOpen();
    }
  });

  // Restore state from cache
  if (currentThreadId) {
    const cached = getThreadState(currentThreadId);

    if (cached) {
      console.log(`HN Distill: Restoring cached state for thread ${currentThreadId}:`, cached.state);
      restoreThreadState(cached);
    }
  }

  console.log("HN Distill: Sidepanel initialized");
}

// Handle analyze when overlay is opened
async function handleAnalyzeOnOpen() {
  if (!currentThreadId) {
    console.log('HN Distill: No thread ID available');
    return;
  }

  // Check if already analyzed
  const cached = getThreadState(currentThreadId);
  if (cached) {
    console.log('HN Distill: Thread already analyzed, skipping');
    return;
  }

  // Start analysis
  if (apiKey) {
    console.log('HN Distill: Starting auto-analysis...');
    await handleAnalyze();
  } else {
    console.log('HN Distill: No API key configured, showing modal');
    openModal('apiKey');
  }
}

// Load API key from Chrome storage
async function loadApiKey() {
  try {
    const result = await chrome.storage.local.get(["apiKey"]);
    if (result.apiKey) {
      apiKey = result.apiKey;
      updateApiKeyStatus(true);
      console.log("HN Distill: API key loaded");
    } else {
      updateApiKeyStatus(false);
    }
  } catch (error) {
    console.error("HN Distill: Error loading API key:", error);
    updateApiKeyStatus(false);
  }
}

// Load thread ID from the active tab
async function loadThreadId() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      console.error("HN Distill: No active tab found");
      currentThreadId = null;
      elements.headerTitle.textContent = "HN Distill";
      return;
    }

    // Check if tab URL is a HN thread
    if (!tab.url || !tab.url.includes("news.ycombinator.com/item")) {
      console.log("HN Distill: Not on a HN thread page");
      currentThreadId = null;
      elements.headerTitle.textContent = "HN Distill";
      return;
    }

    // Send message to content script to get thread ID
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "getThreadId",
    });

    if (response && response.threadId) {
      currentThreadId = response.threadId;
      console.log("HN Distill: Thread ID loaded:", currentThreadId);

      // Set the title from the page (or cache if available)
      const cached = getThreadState(currentThreadId);
      if (cached && cached.threadData && cached.threadData.title) {
        elements.headerTitle.textContent = cached.threadData.title;
      } else if (response.threadTitle) {
        elements.headerTitle.textContent = response.threadTitle;
      }
    } else {
      console.log("HN Distill: No thread ID in response");
      currentThreadId = null;
      elements.headerTitle.textContent = "HN Distill";
    }
  } catch (error) {
    console.error("HN Distill: Error loading thread ID:", error);
    currentThreadId = null;
    elements.headerTitle.textContent = "HN Distill";
  }
}

// Setup event listeners
function setupEventListeners() {
  // Retry button
  elements.retryBtn.addEventListener("click", handleAnalyze);

  // Copy markdown button
  elements.copyMarkdownBtn.addEventListener("click", handleCopyMarkdown);

  // API Key modal
  elements.apiKeyBtn.addEventListener("click", () => openModal("apiKey"));
  elements.saveApiKeyBtn.addEventListener("click", saveApiKey);
  elements.cancelApiKeyBtn.addEventListener("click", () =>
    closeModal("apiKey"),
  );
  elements.closeApiKeyBtn.addEventListener("click", () => closeModal("apiKey"));

  // Comments modal
  elements.closeCommentsBtn.addEventListener("click", () =>
    closeModal("comments"),
  );

  // Back to themes
  elements.backToThemes.addEventListener("click", showThemesList);

  // Close modals on overlay click
  elements.apiKeyModal.addEventListener("click", (e) => {
    if (e.target === elements.apiKeyModal) closeModal("apiKey");
  });
  elements.commentsModal.addEventListener("click", (e) => {
    if (e.target === elements.commentsModal) closeModal("comments");
  });
}

// Thread cache helpers
function getThreadState(threadId) {
  if (!threadId) return null;
  return threadCache.get(threadId) || null;
}

function setThreadState(threadId, state, data = {}) {
  if (!threadId) return;

  const existing = threadCache.get(threadId) || {};
  threadCache.set(threadId, {
    ...existing,
    state,
    ...data,
  });

  console.log(`HN Distill: Thread ${threadId} state updated to:`, state);
}

// Restore UI based on cached thread state
function restoreThreadState(cached) {
  // Restore header title if available
  if (cached.threadData && cached.threadData.title) {
    elements.headerTitle.textContent = cached.threadData.title;
  }

  switch (cached.state) {
    case "analyzing":
      showState("loading");
      break;

    case "completed":
      if (cached.analysisResult) {
        renderResults(cached.analysisResult);
        showState("results");
      } else {
        showState("loading");
      }
      break;

    case "error":
      showError(cached.error || "An error occurred during analysis");
      break;

    default:
      showState("loading");
  }
}

// Handle analyze button click
async function handleAnalyze() {
  if (!apiKey) {
    openModal("apiKey");
    return;
  }

  if (!currentThreadId) {
    showError("No thread ID found. Please refresh the page and try again.");
    return;
  }

  // Capture threadId at start (may change if user switches tabs during analysis)
  const threadId = currentThreadId;

  try {
    // Mark as analyzing
    setThreadState(threadId, "analyzing");
    showState("loading");

    // Step 1: Fetch thread data from Algolia
    console.log("HN Distill: Fetching thread data from Algolia...");
    const threadData = await fetchThreadFromAlgolia(threadId);

    // Step 2: Pre-process and filter comments
    console.log("HN Distill: Processing comments...");
    const processedData = processThreadData(threadData);

    // Update header title with thread title
    elements.headerTitle.textContent = processedData.title;

    // Store thread data in cache
    setThreadState(threadId, "analyzing", { threadData: processedData });

    // Step 3: Build prompt
    console.log("HN Distill: Building analysis prompt...");
    const prompt = buildHNAnalysisPrompt(processedData);

    // Step 4: Call LLM
    console.log("HN Distill: Calling LLM API...");
    const apiClient = ApiClientFactory.createClient(apiKey);
    const rawResponse = await apiClient.call(prompt, { expectJson: true });

    // Step 5: Parse response
    console.log("HN Distill: Parsing LLM response...");
    const analysisResult = parseAnalysisResponse(rawResponse);

    // Step 6: Store results in cache
    setThreadState(threadId, "completed", {
      threadData: processedData,
      analysisResult: analysisResult,
      error: null,
    });

    // Step 7: Display results (only if we're still on the same thread)
    if (currentThreadId === threadId) {
      console.log("HN Distill: Rendering results...");
      renderResults(analysisResult);
      showState("results");
    } else {
      console.log("HN Distill: Analysis completed but user switched to another thread");
    }
  } catch (error) {
    console.error("HN Distill: Analysis error:", error);

    // Store error in cache
    const errorMessage = error.message || "An error occurred during analysis";
    setThreadState(threadId, "error", { error: errorMessage });

    // Show error (only if we're still on the same thread)
    if (currentThreadId === threadId) {
      showError(errorMessage);
    }
  }
}

// Handle copy markdown button click
function handleCopyMarkdown() {
  const cached = getThreadState(currentThreadId);

  if (!cached || !cached.analysisResult) {
    console.log("HN Distill: No analysis results to copy");
    return;
  }

  const markdown = generateMarkdown(cached.threadData, cached.analysisResult);

  // Use execCommand fallback (Clipboard API is blocked in extension sidepanels)
  const success = copyToClipboardFallback(markdown);

  if (success) {
    // Visual feedback
    const originalTitle = elements.copyMarkdownBtn.title;
    elements.copyMarkdownBtn.title = "Copied!";
    elements.copyMarkdownBtn.classList.add("copied");

    setTimeout(() => {
      elements.copyMarkdownBtn.title = originalTitle;
      elements.copyMarkdownBtn.classList.remove("copied");
    }, 2000);

    console.log("HN Distill: Markdown copied to clipboard");
  } else {
    console.error("HN Distill: Failed to copy to clipboard");
  }
}

// Fallback copy method using execCommand (works in extension contexts)
function copyToClipboardFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (err) {
    console.error("HN Distill: execCommand copy failed:", err);
  }

  document.body.removeChild(textarea);
  return success;
}

// Generate markdown from analysis results
function generateMarkdown(threadData, analysisResult) {
  const lines = [];

  // Title with source link
  lines.push(`# ${threadData.title}`);
  lines.push("");
  lines.push(`> Source: [Hacker News Thread](https://news.ycombinator.com/item?id=${threadData.thread_id})`);
  lines.push("");

  // Global summary
  lines.push("## Key Learnings");
  lines.push("");
  analysisResult.global_summary.key_learnings.forEach((learning) => {
    lines.push(`- ${learning}`);
  });
  lines.push("");

  // Themes
  lines.push("## Themes");
  lines.push("");

  analysisResult.themes.forEach((theme) => {
    lines.push(`### ${theme.title}`);
    lines.push("");
    lines.push(`> ${theme.why_it_matters}`);
    lines.push("");

    // Key points
    lines.push("**Key Points:**");
    lines.push("");
    theme.key_points.forEach((point) => {
      lines.push(`- ${point}`);
    });
    lines.push("");

    // Glossary
    if (theme.glossary && theme.glossary.length > 0) {
      lines.push("**Glossary:**");
      lines.push("");
      theme.glossary.forEach((entry) => {
        lines.push(`- **${entry.term}**: ${entry.definition_en}`);
      });
      lines.push("");
    }

    // Beyond basic
    if (theme.beyond_basic && theme.beyond_basic.length > 0) {
      lines.push("**Beyond the Basics:**");
      lines.push("");
      theme.beyond_basic.forEach((text) => {
        lines.push(text);
        lines.push("");
      });
    }

    // Links
    if (theme.links && theme.links.length > 0) {
      lines.push("**Links:**");
      lines.push("");
      theme.links.forEach((link) => {
        lines.push(`- [${link.label}](${link.url})`);
      });
      lines.push("");
    }
  });

  return lines.join("\n");
}

// Fetch thread data from Algolia API
async function fetchThreadFromAlgolia(threadId) {
  const url = `https://hn.algolia.com/api/v1/items/${threadId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch thread data: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Process and filter thread data
function processThreadData(rawData) {
  const { id, title, children } = rawData;

  // Flatten all comments (including nested replies)
  const allComments = flattenComments(children || []);

  // Filter out very short comments and deleted/dead ones
  const filteredComments = allComments.filter((comment) => {
    if (!comment.text || comment.text.length < 40) return false;
    if (comment.deleted || comment.dead) return false;
    return true;
  });

  // Limit to 500 comments to avoid token limits
  const limitedComments = filteredComments.slice(0, 500);

  // Map to simpler structure
  const comments = limitedComments.map((comment) => ({
    id: comment.id,
    author: comment.author,
    text: comment.text,
    points: comment.points || 0,
  }));

  return {
    thread_id: id,
    title: title || "Untitled",
    comments,
  };
}

// Recursively flatten nested comments
function flattenComments(comments, result = []) {
  for (const comment of comments) {
    if (comment) {
      result.push(comment);
      if (comment.children && comment.children.length > 0) {
        flattenComments(comment.children, result);
      }
    }
  }
  return result;
}

// Parse LLM response
function parseAnalysisResponse(rawResponse) {
  try {
    // Try to extract JSON from response (in case LLM added markdown fences)
    let jsonText = rawResponse.trim();

    // Remove markdown code fences if present
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      lines.shift(); // Remove first ```
      lines.pop(); // Remove last ```
      jsonText = lines.join("\n");
    }

    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (error) {
    console.error("HN Distill: JSON parse error:", error);
    console.log("Raw response:", rawResponse);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

// Render results in the UI
function renderResults(data) {
  // Render global summary
  renderGlobalSummary(data.global_summary);

  // Render themes list
  renderThemesList(data.themes);
}

// Render global summary
function renderGlobalSummary(summary) {
  elements.globalLearnings.innerHTML = "";

  summary.key_learnings.forEach((learning) => {
    const li = document.createElement("li");
    li.textContent = learning;
    elements.globalLearnings.appendChild(li);
  });
}

// Render themes list
function renderThemesList(themes) {
  elements.themesList.innerHTML = "";

  themes.forEach((theme, index) => {
    const card = createThemeCard(theme, index);
    elements.themesList.appendChild(card);
  });
}

// Create a theme card element
function createThemeCard(theme, index) {
  const card = document.createElement("div");
  card.className = "theme-card";
  card.dataset.themeIndex = index;

  card.innerHTML = `
    <div class="theme-card-header">
      <h3 class="theme-card-title">${escapeHtml(theme.title)}</h3>
      <svg class="theme-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </div>
    <p class="theme-card-why">${escapeHtml(theme.why_it_matters)}</p>
  `;

  card.addEventListener("click", () => showThemeDetail(index));

  return card;
}

// Show theme detail view
function showThemeDetail(themeIndex) {
  // Get analysis result from cache
  const cached = getThreadState(currentThreadId);
  if (!cached || !cached.analysisResult) return;

  const theme = cached.analysisResult.themes[themeIndex];

  // Populate theme detail
  elements.themeDetailTitle.textContent = theme.title;
  elements.themeDetailWhy.textContent = theme.why_it_matters;

  // Key points
  elements.themeDetailPoints.innerHTML = "";
  theme.key_points.forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    elements.themeDetailPoints.appendChild(li);
  });

  // Glossary
  if (theme.glossary && theme.glossary.length > 0) {
    elements.themeGlossarySection.style.display = "block";
    elements.themeDetailGlossary.innerHTML = "";

    theme.glossary.forEach((entry) => {
      const dt = document.createElement("dt");
      dt.className = "glossary-term";
      dt.textContent = entry.term;

      const dd = document.createElement("dd");
      dd.className = "glossary-definition";
      dd.textContent = entry.definition_en;

      if (entry.definition_fr) {
        const fr = document.createElement("div");
        fr.className = "glossary-definition-fr";
        fr.textContent = `🇫🇷 ${entry.definition_fr}`;
        dd.appendChild(fr);
      }

      elements.themeDetailGlossary.appendChild(dt);
      elements.themeDetailGlossary.appendChild(dd);
    });
  } else {
    elements.themeGlossarySection.style.display = "none";
  }

  // Beyond basic
  if (theme.beyond_basic && theme.beyond_basic.length > 0) {
    elements.themeBeyondSection.style.display = "block";
    elements.themeDetailBeyond.innerHTML = "";

    theme.beyond_basic.forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      elements.themeDetailBeyond.appendChild(p);
    });
  } else {
    elements.themeBeyondSection.style.display = "none";
  }

  // Links
  if (theme.links && theme.links.length > 0) {
    elements.themeLinksSection.style.display = "block";
    elements.themeDetailLinks.innerHTML = "";

    theme.links.forEach((link) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `
        ${escapeHtml(link.label)}
        <span class="link-url">${escapeHtml(link.url)}</span>
      `;
      li.appendChild(a);
      elements.themeDetailLinks.appendChild(li);
    });
  } else {
    elements.themeLinksSection.style.display = "none";
  }

  // Comment refs
  const commentRefs = theme.comment_refs || [];
  elements.commentCount.textContent = commentRefs.length;

  // Setup show comments button
  const newShowCommentsBtn = elements.showCommentsBtn.cloneNode(true);
  elements.showCommentsBtn.parentNode.replaceChild(
    newShowCommentsBtn,
    elements.showCommentsBtn,
  );
  elements.showCommentsBtn = newShowCommentsBtn;

  elements.showCommentsBtn.addEventListener("click", () =>
    showComments(commentRefs),
  );

  // Show theme detail, hide themes list
  elements.themesList.parentElement.style.display = "none";
  elements.resultsContainer.querySelector(".summary-section").style.display =
    "none";
  elements.themeDetail.style.display = "block";
}

// Show themes list (back from detail)
function showThemesList() {
  elements.themeDetail.style.display = "none";
  elements.themesList.parentElement.style.display = "block";
  elements.resultsContainer.querySelector(".summary-section").style.display =
    "block";
}

// Show comments modal
function showComments(commentIds) {
  // Get thread data from cache
  const cached = getThreadState(currentThreadId);
  if (!cached || !cached.threadData) return;

  elements.commentsList.innerHTML = "";

  const commentsMap = new Map(cached.threadData.comments.map((c) => [c.id, c]));

  commentIds.forEach((commentId) => {
    const comment = commentsMap.get(commentId);
    if (comment) {
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        <div class="comment-author">${escapeHtml(comment.author)}</div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        <div class="comment-meta">
          <span>ID: ${comment.id}</span>
          <span>Points: ${comment.points}</span>
        </div>
      `;
      elements.commentsList.appendChild(div);
    }
  });

  openModal("comments");
}

// Save API key
async function saveApiKey() {
  const key = elements.apiKeyInput.value.trim();

  if (!key) {
    elements.apiKeyStatus.textContent = "Please enter an API key";
    elements.apiKeyStatus.style.color = "var(--color-error)";
    return;
  }

  try {
    await chrome.storage.local.set({ apiKey: key });
    apiKey = key;
    updateApiKeyStatus(true);
    closeModal("apiKey");
    console.log("HN Distill: API key saved");
  } catch (error) {
    console.error("HN Distill: Error saving API key:", error);
    elements.apiKeyStatus.textContent = "Error saving API key";
    elements.apiKeyStatus.style.color = "var(--color-error)";
  }
}

// Update API key status
function updateApiKeyStatus(configured) {
  if (configured) {
    elements.apiKeyStatus.textContent = "Configured";
    elements.apiKeyStatus.style.color = "var(--color-success)";
  } else {
    elements.apiKeyStatus.textContent = "Not configured";
    elements.apiKeyStatus.style.color = "var(--color-text-secondary)";
  }
}

// Show/hide states
function showState(state) {
  elements.loadingState.style.display = "none";
  elements.errorState.style.display = "none";
  elements.resultsContainer.style.display = "none";
  elements.copyMarkdownBtn.style.display = "none";

  switch (state) {
    case "loading":
      elements.loadingState.style.display = "flex";
      break;
    case "error":
      elements.errorState.style.display = "flex";
      break;
    case "results":
      elements.resultsContainer.style.display = "block";
      elements.copyMarkdownBtn.style.display = "inline-flex";
      break;
  }
}

// Show error
function showError(message) {
  elements.errorMessage.textContent = message;
  showState("error");
}

// Open modal
function openModal(type) {
  if (type === "apiKey") {
    elements.apiKeyModal.style.display = "flex";
    elements.apiKeyInput.value = "";
    elements.apiKeyInput.focus();
  } else if (type === "comments") {
    elements.commentsModal.style.display = "flex";
  }
}

// Close modal
function closeModal(type) {
  if (type === "apiKey") {
    elements.apiKeyModal.style.display = "none";
  } else if (type === "comments") {
    elements.commentsModal.style.display = "none";
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
