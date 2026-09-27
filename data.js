// Preserve the discussion graph. Length is never a relevance filter.
const HN_API = 'https://hacker-news.firebaseio.com/v0/item/';
export const threadUrl = (id) => `https://news.ycombinator.com/item?id=${id}`;

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function cleanHtml(html = '') {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object').forEach((el) => el.remove());
  const links = [...doc.querySelectorAll('a[href]')].map((a) => ({
    url: safeUrl(a.getAttribute('href')), label: a.textContent.trim(),
  })).filter((link) => link.url);
  doc.querySelectorAll('p,div,br,li,pre,blockquote').forEach((el) => el.prepend('\n'));
  return { text: doc.body.textContent.replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), links };
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
  if (!response.ok) throw new Error(`HN : HTTP ${response.status}`);
  return response.json();
}

function flatten(root) {
  const nodes = [];
  const stack = [...(root.children || [])].reverse().map((node) => ({ node, parent: root.id }));
  const seen = new Set();
  while (stack.length) {
    const { node, parent } = stack.pop();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push({ ...node, parent: node.parent_id ?? parent });
    for (const child of [...(node.children || [])].reverse()) stack.push({ node: child, parent: node.id });
  }
  return nodes;
}

export function processThreadData(raw, nodes = flatten(raw)) {
  const post = cleanHtml(raw.text);
  return {
    id: raw.id, title: cleanHtml(raw.title || 'Discussion HN').text,
    author: raw.by || raw.author || '', text: post.text,
    url: safeUrl(raw.url), links: post.links,
    comments: nodes.map((node) => {
      const unavailable = Boolean(node.deleted || node.dead || !node.text);
      const content = cleanHtml(unavailable ? '' : node.text);
      return {
        id: node.id, parent: node.parent ?? node.parent_id ?? raw.id,
        author: node.by || node.author || '', text: content.text,
        links: content.links, unavailable,
      };
    }),
  };
}

async function fetchOfficialTree(root, signal, onProgress) {
  const queue = [...(root.kids || [])];
  const seen = new Set(queue);
  const nodes = [];
  // Bounded network concurrency, not a bound on comments.
  while (queue.length) {
    signal.throwIfAborted();
    const ids = queue.splice(0, 8);
    const batch = await Promise.all(ids.map((id) => getJson(`${HN_API}${id}.json`, signal)));
    for (const node of batch) {
      if (!node) throw new Error('Un commentaire HN est inaccessible. Réessaie pour obtenir la discussion complète.');
      nodes.push(node);
      for (const child of node.kids || []) if (!seen.has(child)) { seen.add(child); queue.push(child); }
    }
    onProgress(nodes.length);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered = [];
  const stack = [...(root.kids || [])].reverse();
  const visited = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;
    ordered.push(node);
    stack.push(...[...(node.kids || [])].reverse());
  }
  return ordered;
}

export async function fetchThread(threadId, { signal, onProgress = () => {} } = {}) {
  signal ||= new AbortController().signal;
  if (!/^\d+$/.test(String(threadId))) throw new Error('Identifiant HN invalide.');
  // Resolve comment permalinks to their discussion, without consulting the active tab.
  let root = await getJson(`${HN_API}${threadId}.json`, signal);
  const ancestors = new Set();
  while (root?.parent) {
    if (ancestors.has(root.id)) throw new Error('Discussion HN invalide.');
    ancestors.add(root.id);
    root = await getJson(`${HN_API}${root.parent}.json`, signal);
  }
  if (!root || root.deleted || root.dead) throw new Error('Cette discussion HN n’est plus accessible.');
  let nodes;
  try {
    const indexed = await getJson(`https://hn.algolia.com/api/v1/items/${root.id}`, signal);
    const candidate = flatten(indexed);
    const ids = new Set(candidate.map((node) => node.id));
    // A stale/incomplete index must not silently become a complete-looking analysis.
    if (indexed.id === root.id && candidate.length >= (root.descendants || 0) &&
        (root.kids || []).every((id) => ids.has(id))) nodes = candidate;
  } catch { signal.throwIfAborted(); }
  if (!nodes) nodes = await fetchOfficialTree(root, signal, onProgress);
  return processThreadData(root, nodes);
}

export function sourceMap(thread) {
  return new Map([[thread.id, { ...thread, parent: null }], ...thread.comments.map((c) => [c.id, c])]);
}

// Split oversized text as well as branches. Every character is included.
export function partitionThread(thread, budget = 160_000) {
  const all = sourceMap(thread);
  const chunks = [];
  const branches = new Map();
  const recordBudget = Math.floor(budget * .75);
  let records = [], size = 0;
  const flush = () => { if (records.length) chunks.push(records); records = []; size = 0; };
  for (const node of [thread, ...thread.comments]) {
    if (!node.text) continue;
    const path = [];
    const visited = new Set([node.id]);
    let parent = all.get(node.parent);
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      path.unshift(parent.id);
      parent = all.get(parent.parent);
    }
    const branchId = node.id === thread.id ? thread.id : path[1] || node.id;
    if (!branches.has(branchId)) branches.set(branchId, []);
    const partSize = Math.floor(budget / 4);
    for (let offset = 0; offset < node.text.length; offset += partSize) {
      const record = {
        id: node.id, parent: node.parent || null, ancestors: path,
        author: node.author, text: node.text.slice(offset, offset + partSize),
        ...(node.text.length > partSize ? { continuation: offset > 0 } : {}),
      };
      branches.get(branchId).push(record);
    }
  }
  for (const branch of branches.values()) {
    const branchSize = JSON.stringify(branch).length;
    if (branchSize <= recordBudget && size + branchSize > recordBudget) flush();
    for (const record of branch) {
      const length = JSON.stringify(record).length + 1;
      if (length > recordBudget) throw new Error('La structure de cette discussion est trop profonde pour être analysée sans perte de contexte.');
      if (size + length > recordBudget) flush();
      records.push(record); size += length;
    }
  }
  flush();
  return chunks.map((comments) => {
    const present = new Set(comments.map((c) => c.id));
    const parents = new Set(comments.flatMap((c) => c.ancestors));
    let contextSize = 0;
    const context = [...parents].filter((id) => !present.has(id)).map((id) => {
      const c = all.get(id);
      return { id, parent: c.parent || null, author: c.author, excerpt: c.text.slice(0, 1200) };
    }).filter((entry) => { contextSize += JSON.stringify(entry).length; return contextSize <= budget - recordBudget; });
    return { comments, context };
  });
}
