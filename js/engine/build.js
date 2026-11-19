// Small builders that keep lesson files short.
// Every builder returns a partial scene; merge() joins them.

export const merge = (...parts) => {
  const out = { nodes: [], edges: [], flows: [], zones: [] };
  for (const p of parts) {
    if (!p) continue;
    for (const k of ['nodes', 'edges', 'flows', 'zones']) if (p[k]) out[k].push(...p[k]);
    if (p.h) out.h = p.h;
    if (p.caption) out.caption = p.caption;
  }
  return out;
};

// n('id', x, y, 'Label', { sub, kind, state, badge, w, h, icon, mono })
export const n = (id, x, y, label, o = {}) => ({ id, x, y, label, ...o });
// e('a', 'b', 'label', { style, dir, bend, kind, state })
export const e = (from, to, label, o = {}) => ({ from, to, label, ...o });
// f('a>b', 'GET /', { kind, every, speed, back, once, fail })
export const f = (edge, label, o = {}) => ({ edge, label, ...o });
export const z = (id, x, y, w, h, label, kind) => ({ id, x, y, w, h, label, kind });

// Apply per-id overrides to a list of nodes: patch(nodes, { h1: { state: 'upd' } })
export const patch = (nodes, map) => nodes.map((nd) => (map[nd.id] ? { ...nd, ...map[nd.id] } : nd));
export const only = (nodes, ids) => nodes.filter((nd) => ids.includes(nd.id));
export const without = (nodes, ids) => nodes.filter((nd) => !ids.includes(nd.id));
export const dimExcept = (nodes, ids) => nodes.map((nd) => (ids.includes(nd.id) ? nd : { ...nd, state: 'dim' }));

/**
 * Lay out a tree top-down.
 * spec: { id, label, sub, state, kind, kids: [...] }
 * o: { x (centre), y (top row centre), dx (leaf spacing), dy (row spacing), w, h, kind, prefix, edgeKind, edgeStyle }
 */
export function tree(spec, o = {}) {
  const { x = 500, y = 90, dy = 90, w = 130, h = 44, kind = 'dom', prefix = '', edgeKind, edgeStyle } = o;
  const leaves = (s) => (s.kids && s.kids.length ? s.kids.reduce((a, k) => a + leaves(k), 0) : 1);
  const total = leaves(spec);
  // widen the spacing if any node's text would make neighbours overlap (capped to fit ~960px)
  const est = (s) => Math.max(s.w || w, String(s.label ?? '').length * 8.8 + 26, String(s.sub ?? '').length * 7.3 + 26);
  const widest = (s) => Math.max(est(s), ...(s.kids || []).map(widest));
  let dx = Math.max(o.dx ?? 150, widest(spec) + 14);
  if (total > 1) dx = Math.min(dx, Math.max(o.dx ?? 150, 960 / (total - 1 + 1)));
  const nodes = [], edges = [];
  let cursor = x - ((total - 1) * dx) / 2;
  const walk = (s, depth, parent) => {
    let cx;
    if (s.kids && s.kids.length) {
      const xs = s.kids.map((k) => walk(k, depth + 1, prefix + s.id));
      cx = (xs[0] + xs[xs.length - 1]) / 2;
    } else { cx = cursor; cursor += dx; }
    nodes.push({ id: prefix + s.id, x: cx, y: y + depth * dy, label: s.label, sub: s.sub, state: s.state, kind: s.kind || kind, w: s.w || w, h: s.h || h, icon: s.icon ?? false, mono: s.mono ?? true, badge: s.badge });
    if (parent) edges.push({ from: parent, to: prefix + s.id, dir: 'none', kind: edgeKind, style: edgeStyle });
    return cx;
  };
  walk(spec, 0, null);
  return { nodes, edges };
}

/**
 * A row of array cells with optional pointers underneath (for DSA traces).
 * arr([1,3,5], { id:'a', x:120, y:200, gap:70, states:{1:'active'}, ptrs:{ lo:0, hi:2 }, ptrKind:{ mid:'cache' } })
 */
export function arr(values, o = {}) {
  const { id = 'a', x = 140, y = 200, gap = 70, states = {}, ptrs = {}, ptrKind = {}, showIdx = true } = o;
  const nodes = values.map((v, i) => ({ id: `${id}${i}`, x: x + i * gap, y, label: String(v), sub: showIdx ? String(i) : undefined, kind: 'cell', state: states[i] }));
  const stack = {};
  for (const [name, i] of Object.entries(ptrs)) {
    if (i == null || i < 0 || i >= values.length + 1) continue;
    const level = (stack[i] = (stack[i] ?? -1) + 1);
    nodes.push({ id: `${id}-p-${name}`, x: x + i * gap, y: y + 62 + level * 34, label: name, kind: 'ptr', icon: false, w: Math.max(44, name.length * 9 + 18), h: 24, color: ptrKind[name] });
  }
  return { nodes };
}
