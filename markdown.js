// markdown.js - Markdown generation for analysis results

/**
 * Generate markdown from analysis results
 * @param {Object} threadData - Thread data with title and thread_id
 * @param {Object} analysisResult - Analysis result with global_summary, critical_thinking, themes
 * @returns {string} Markdown formatted string
 */
export function generateMarkdown(threadData, analysisResult) {
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

  // Critical Thinking
  if (analysisResult.critical_thinking) {
    lines.push(...generateCriticalThinkingMarkdown(analysisResult.critical_thinking));
  }

  // Themes
  lines.push("## Themes");
  lines.push("");

  analysisResult.themes.forEach((theme) => {
    lines.push(...generateThemeMarkdown(theme));
  });

  return lines.join("\n");
}

/**
 * Generate markdown for critical thinking section
 */
function generateCriticalThinkingMarkdown(ct) {
  const lines = [];
  lines.push("## Critical Thinking");
  lines.push("");

  if (ct.what_breaks_this) {
    lines.push("### What breaks this?");
    lines.push(ct.what_breaks_this);
    lines.push("");
  }

  if (ct.non_obvious_truth) {
    lines.push("### Non-obvious truth");
    lines.push(ct.non_obvious_truth);
    lines.push("");
  }

  if (ct.hidden_assumptions) {
    lines.push("### Hidden assumptions");
    lines.push(ct.hidden_assumptions);
    lines.push("");
  }

  if (ct.new_bottleneck) {
    lines.push("### New bottleneck");
    lines.push(ct.new_bottleneck);
    lines.push("");
  }

  if (ct.leverage_point) {
    lines.push("### Leverage point");
    lines.push(ct.leverage_point);
    lines.push("");
  }

  return lines;
}

/**
 * Generate markdown for a single theme
 */
function generateThemeMarkdown(theme) {
  const lines = [];

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
      lines.push(`- **${entry.term}**: ${entry.definition}`);
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

  return lines;
}

export default { generateMarkdown };
