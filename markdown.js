import { threadUrl, sourceMap } from './data.js';
import { kindLabel } from './render.js';

const escape = (text) => String(text).replace(/[\\`*_{}\[\]()#+!<>|]/g, '\\$&');
export function generateMarkdown(thread, analysis, { format = 'markdown', language = 'fr', partial = false } = {}) {
  const md = format === 'markdown';
  const plain = (s) => md ? escape(s) : s;
  const heading = (level, text) => `${md ? '#'.repeat(level) + ' ' : ''}${plain(text)}`;
  const sources = sourceMap(thread);
  const out = [heading(1, thread.title), `${md ? '[Hacker News](' + threadUrl(thread.id) + ')' : threadUrl(thread.id)}`];
  if (partial) out.push(language === 'fr' ? 'Notes incomplètes — génération interrompue.' : 'Incomplete notes — generation interrupted.');
  if (!analysis) {
    for (const item of [thread, ...thread.comments]) {
      if (!item.text) continue;
      out.push(heading(2, item.author || String(item.id)), plain(item.text), threadUrl(item.id));
    }
  } else {
    for (const section of analysis.sections) {
      out.push(heading(2, section.title));
      for (const entry of section.entries) {
        if (entry.title) out.push(heading(3, entry.title));
        const kind = kindLabel(entry.kind, language);
        out.push((kind ? `${plain(kind)} — ` : '') + plain(entry.text));
        out.push(entry.sources.map((id) => {
          const author = sources.get(id)?.author || id;
          return md ? `[${escape(author)}](${threadUrl(id)})` : `${author}: ${threadUrl(id)}`;
        }).join(' · '));
      }
    }
  }
  return out.join('\n\n') + '\n';
}
