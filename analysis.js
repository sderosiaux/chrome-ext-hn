export const PROMPT_VERSION = '2026-09-27.2';
const string = { type: 'string' };
export const ENTRY_KINDS = ['explanation', 'argument', 'objection', 'experience', 'inference', 'definition', 'question', 'open_question'];
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const ANALYSIS_SCHEMA = object({ sections: { type: 'array', items: object({
  title: string,
  entries: { type: 'array', items: object({
    kind: { type: 'string', enum: ENTRY_KINDS }, title: string, text: string,
    sources: { type: 'array', items: { type: 'integer' } },
  }) },
}) } });

export class AnalysisError extends Error {
  constructor(message, partial) { super(message); this.partial = partial; }
}
export function validateEntry(entry, sources) {
  if (!entry || !ENTRY_KINDS.includes(entry.kind) || typeof entry.title !== 'string' ||
      typeof entry.text !== 'string' || !entry.text.trim() || !Array.isArray(entry.sources))
    throw new Error('Le modèle a renvoyé une réponse mal structurée.');
  if (!entry.sources.length || entry.sources.some((id) => !Number.isSafeInteger(id) || !sources.has(id)))
    throw new Error('Une référence ne correspond pas aux commentaires fournis.');
  return { ...entry, sources: [...new Set(entry.sources)] };
}
const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function validateAnalysis(value, sources, mode = 'summary') {
  if (!value || !Array.isArray(value.sections)) throw new Error('Le modèle a renvoyé une réponse mal structurée.');
  const result = { sections: [] }, seen = new Set(), questions = new Set();
  for (const section of value.sections) {
    if (typeof section.title !== 'string' || !Array.isArray(section.entries)) throw new Error('Section invalide.');
    const valid = { title: section.title, entries: [] };
    result.sections.push(valid);
    for (const item of section.entries) {
      const entry = validateEntry(item, sources);
      if (mode === 'qa' && (entry.kind !== 'question' || !entry.title.trim())) throw new Error('Une question-réponse est mal structurée.');
      const key = normalize(entry.text);
      const question = normalize(entry.title);
      if ((key.length > 100 && seen.has(key)) || (mode === 'qa' && question && questions.has(question)))
        throw new AnalysisError('La génération se répète. Les passages déjà reçus sont conservés.', result);
      seen.add(key); questions.add(question); valid.entries.push(entry);
    }
  }
  if (!result.sections.some((s) => s.entries.length)) throw new Error('Aucune explication exploitable dans la réponse.');
  return result;
}

// Extract only complete JSON entries from an unfinished stream.
export function partialAnalysis(text) {
  const sections = [];
  let section = null, start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === '{') {
      depth++;
      if (depth === 2) {
        const match = text.slice(i).match(/^\{\s*"title"\s*:\s*("(?:[^"\\]|\\.)*")/);
        section = { title: match ? JSON.parse(match[1]) : '', entries: [] };
        sections.push(section);
      }
      if (depth === 3) start = i;
    }
    if (char === '}') {
      if (depth === 3 && start >= 0 && section) {
        try { section.entries.push(JSON.parse(text.slice(start, i + 1))); } catch { /* wait for valid data */ }
        start = -1;
      }
      depth--;
    }
  }
  return { sections: sections.filter((s) => s.entries.length) };
}
