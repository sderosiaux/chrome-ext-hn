// prompts.js - LLM prompts for HN Distill

export function buildHNAnalysisPrompt(threadData) {
  const { thread_id, title, comments } = threadData;

  return `You are analyzing a Hacker News thread to distill actionable learning insights. Always answer in FRENCH.

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
          "definition_en": "Brief English definition (1-2 sentences max)",
          "definition_fr": "Traduction française si simple, sinon laisser vide"
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
- \`definition_fr\`: only provide if translation is straightforward, otherwise leave empty string
- Examples of good terms: "Vertex AI quota (TPM)", "SynthID", "RLHF", "Zero-shot learning"
- Avoid: common programming terms everyone knows

### \`beyond_basic\` (1-3 sentences)
- Provide **deeper implications** or **surprising angles**
- Think: "What would interest Stephane as evening reading?"
- Focus on strategy, architecture, long-term considerations, or unexpected insights

### \`links\` (max 3 per theme)
- **Only extract URLs that actually appear in the comments**
- Deduplicate across the thread
- Provide a brief, clear label for each

### \`comment_refs\`
- List the comment IDs that contributed to this theme
- These are the \`id\` values from the comments array

---

# Comments Data

${JSON.stringify(comments, null, 2)}

---

# Important
- Return **ONLY** the JSON object, no markdown fences, no extra text
- Ensure all JSON is valid (proper escaping, no trailing commas)
- Keep definitions and explanations concise
- Focus on practical, actionable learning
- Always in FRENCH.
`;
}

export default {
  buildHNAnalysisPrompt,
};
