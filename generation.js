import { partitionThread, sourceMap } from './data.js';
import { buildHNAnalysisPrompt } from './prompts.js';
import { generate } from './api_client.js';
import { AnalysisError, partialAnalysis, validateAnalysis } from './analysis.js';

export async function analyzeThread({ thread, settings, mode, signal, onProgress, onPartial }) {
  const all = sourceMap(thread);
  const budget = settings.provider === 'claude' ? 100_000 : 160_000;
  const direct = { comments: [...all.values()].filter((c) => c.text).map((c) => ({
    id: c.id, parent: c.parent || null, author: c.author, text: c.text,
  })) };
  if (!direct.comments.length) throw new Error('Cette discussion ne contient pas encore de texte à analyser.');
  const directPrompt = buildHNAnalysisPrompt(thread, settings, mode, direct);
  // Measure the actual payload, including instructions and reader context. Reserving
  // space for nonexistent ancestor excerpts caused ordinary threads to be split.
  // UTF-8 bytes are a conservative token upper bound; leave room for model output.
  const directBytes = new TextEncoder().encode(directPrompt.input + directPrompt.instructions).length;
  const directBudget = settings.provider === 'claude' ? 100_000 : 300_000;
  const finalLabel = mode === 'qa' ? 'Rédaction des questions-réponses' : 'Rédaction de la synthèse';
  const run = async (input, evidence, sources, { label = finalLabel, prefix = [], preview = true } = {}) => {
    let last = 0;
    const outputMode = evidence ? 'summary' : mode;
    onProgress(`${label} · en attente du modèle…`);
    try {
      const text = await generate({ settings, signal, mode: outputMode,
        prompt: buildHNAnalysisPrompt(thread, settings, mode, input, evidence),
        onDelta: (text) => {
          if (Date.now() - last < 180) return;
          last = Date.now();
          const valid = validateAnalysis(partialAnalysis(text), sources, outputMode, { preview: true });
          const count = valid.sections.reduce((n, s) => n + s.entries.length, 0);
          onProgress(count ? `${label} · ${count} ${mode === 'qa' && !evidence ? 'réponses' : 'idées'} reçues` : `${label} · le modèle rédige…`);
          if (count) {
            if (preview) onPartial({ sections: [...prefix, ...valid.sections] }, { provisional: evidence });
          }
        },
      });
      signal.throwIfAborted();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch {
        const lastValid = validateAnalysis(partialAnalysis(text), sources, outputMode, { preview: true });
        throw new AnalysisError('La réponse s’est terminée avec un document incomplet.' +
          (lastValid.sections.length ? ' Les passages valides restent disponibles.' : ''), lastValid);
      }
      return validateAnalysis(parsed, sources, outputMode);
    } catch (error) {
      if (evidence && error.partial) {
        error.partial = preview ? { sections: [...prefix, ...error.partial.sections] } : null;
        error.provisional = true;
      }
      throw error;
    }
  };
  if (directBytes <= directBudget) return run(direct, false, new Map(direct.comments.map((c) => [c.id, c])));
  const parts = partitionThread(thread, budget);

  let notes = [];
  for (let i = 0; i < parts.length; i++) {
    const sources = new Map([...parts[i].comments, ...parts[i].context].map((c) => [c.id, c]));
    const result = await run(parts[i], true, sources, {
      label: `Notes provisoires · lecture ${i + 1}/${parts.length}`, prefix: notes,
    });
    notes.push(...result.sections);
    onPartial({ sections: [...notes] }, { provisional: true });
  }
  // Hierarchical reduction has a strict progress condition, never a fixed question/comment cap.
  while (JSON.stringify(notes).length > budget) {
    const before = JSON.stringify(notes).length;
    const groups = [];
    let group = [], size = 0;
    for (const section of notes) for (const entry of section.entries) {
      const item = { title: section.title, entries: [entry] };
      const length = JSON.stringify(item).length;
      if (length > budget) throw new Error('Une note intermédiaire est trop longue. Réessaie avec une lecture plus concise.');
      if (size + length > budget && group.length) { groups.push(group); group = []; size = 0; }
      group.push(item); size += length;
    }
    if (group.length) groups.push(group);
    const reduced = [];
    for (let i = 0; i < groups.length; i++) {
      const ids = new Set(groups[i].flatMap((s) => s.entries.flatMap((e) => e.sources)));
      const result = await run({ evidence_notes: groups[i] }, true, new Map([...ids].map((id) => [id, all.get(id)])), {
        label: `Mise en relation des arguments · ${i + 1}/${groups.length}`, preview: false,
      });
      reduced.push(...result.sections);
    }
    if (JSON.stringify(reduced).length >= before * .9) throw new Error('La synthèse ne se compacte plus. Arrêt pour éviter une boucle ; aucun commentaire n’a été écarté de la lecture.');
    notes = reduced;
  }
  const ids = new Set(notes.flatMap((s) => s.entries.flatMap((e) => e.sources)));
  return run({ evidence_notes: notes }, false, new Map([...ids].map((id) => [id, all.get(id)])));
}
