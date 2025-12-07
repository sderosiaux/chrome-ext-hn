// prompts.js - LLM prompts for HN Distill

const LANGUAGE_NAMES = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
};

export function buildHNAnalysisPrompt(threadData, settings = {}) {
  const { title, comments } = threadData;
  const { language = "en", personalContext = "" } = settings;

  const languageName = LANGUAGE_NAMES[language] || "English";
  const languageInstruction = `Always answer in ${languageName}.`;

  const personalContextSection = personalContext
    ? `
## Reader Context
The reader has provided the following context about themselves:
"${personalContext}"

Tailor the analysis to be relevant to their interests and expertise level. Highlight insights that would be particularly valuable given their background.
`
    : "";

  return `You are analyzing a Hacker News thread to distill actionable learning insights. ${languageInstruction}

**Title:** ${title}
---

# Your Task

Analyze this HN thread and produce a **strictly valid JSON response** with the following structure:

\`\`\`json
{
  "global_summary": {
    "key_learnings": [
      "First key insight from the entire thread",
      "Second key insight from the entire thread",
      "Third key insight from the entire thread"
    ]
  },
  "critical_thinking": {
    "what_breaks_this": "Identify failure modes, edge cases, or conditions under which the main claims/solutions would fail",
    "non_obvious_truth": "What insight from the discussion is true but counterintuitive or easily missed?",
    "hidden_assumptions": "What unstated assumptions underlie the discussion? What tradeoffs are being glossed over?",
    "new_bottleneck": "If the main thesis is true, what becomes the next limiting factor or problem?",
    "leverage_point": "Where is there asymmetric opportunity? What's the force multiplier or strategic wedge?"
  },
  "themes": [
    {
      "theme_id": "unique_theme_identifier",
      "title": "Theme Title",
      "why_it_matters": "1-2 sentence explanation of why this theme is interesting or valuable",
      "key_points": [
        "Concrete, actionable learning point 1",
        "Concrete, actionable learning point 2",
        "Concrete, actionable learning point 3"
      ],
      "glossary": [
        {
          "term": "Technical Term",
          "definition": "Brief definition (1-2 sentences max)"
        }
      ],
      "beyond_basic": [
        "Deeper implication or surprising angle on this theme",
        "Strategic or architectural consideration"
      ],
      "links": [
        {
          "url": "https://example.com/resource",
          "label": "Brief description of what this link provides"
        }
      ],
      "comment_refs": [123, 456]
    }
  ]
}
\`\`\`

---

# Analysis Rules

## Content Filtering
- **IGNORE**: Jokes, purely emotional reactions, off-topic tangents, very short comments (<40 chars)
- **KEEP**: Explanations, benchmarks, examples, tools, docs, system considerations, business insights, ethical discussions
${personalContextSection}
## Theme Detection
- Identify **3 to 7 coherent themes** that emerge from the discussion
- Each theme should represent a distinct topic or angle
- A comment can contribute to 1-2 themes maximum
- Themes should be **concrete and specific**, not vague

## For Each Theme

### \`key_points\` (3-6 bullets)
- Write in style: "What you learn from this discussion"
- Be **factual and concrete** (not generic platitudes)
- Include specific examples, numbers, or references when available
- Focus on actionable insights

### \`glossary\` (0-8 terms per thread total, distributed across themes)
- Only include terms that belong in a **Data/AI/Tech glossary**
- Definitions should be **very concise** (1-2 sentences max)
- Examples of good terms: "Vertex AI quota (TPM)", "SynthID", "RLHF", "Zero-shot learning"
- Avoid: common programming terms everyone knows

### \`beyond_basic\` (1-3 sentences)
- Provide **deeper implications** or **surprising angles**
- Focus on strategy, architecture, long-term considerations, or unexpected insights
- Think about what a thoughtful reader would find valuable for evening reflection

### \`links\` (max 3 per theme)
- **Only extract URLs that actually appear in the comments**
- Deduplicate across the thread
- Provide a brief, clear label for each

### \`comment_refs\`
- List the comment IDs that contributed to this theme
- These are the \`id\` values from the comments array

## Critical Thinking Layer

This section challenges the thread's core assumptions and extracts strategic insights.

### \`what_breaks_this\`
- Identify **failure modes** or conditions that would invalidate the main claims
- Look for edge cases, scale issues, or overlooked dependencies
- Example: "This approach works for small teams but breaks at 100+ engineers due to coordination overhead"

### \`non_obvious_truth\`
- Surface **counterintuitive insights** that most readers might miss
- Look for contrarian takes that are well-argued in the comments
- Example: "The bottleneck isn't compute but data quality—more GPUs won't help"

### \`hidden_assumptions\`
- Expose **unstated premises** the discussion takes for granted
- Identify **tradeoffs** being glossed over or downplayed
- Example: "Assumes users will tolerate 2s latency, but mobile users abandon after 500ms"

### \`new_bottleneck\`
- If the main thesis succeeds, what becomes the **next constraint**?
- Think second-order effects and unintended consequences
- Example: "If AI handles all code reviews, the bottleneck shifts to prompt engineering skill"

### \`leverage_point\`
- Identify **asymmetric opportunities** or strategic wedges
- Look for small inputs with outsized outputs, or positions of advantage
- Example: "Whoever controls the embedding layer controls downstream applications—that's the wedge"

---

# Comments Data

${JSON.stringify(comments, null, 2)}

---

# Important
- Return **ONLY** the JSON object, no markdown fences, no extra text
- Ensure all JSON is valid (proper escaping, no trailing commas)
- Be concise without losing meaning. Use symbols: *, →, ≠, ~, ::, =, <, >, //, @, ^
- Focus on practical, actionable learning
- ${languageInstruction}
`;
}

export default {
  buildHNAnalysisPrompt,
};
