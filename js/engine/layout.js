// Automatic layout for a scene: lesson files give rough positions; this module makes the picture clean.
//   1. size every node from its text (boxes never clip their labels)
//   2. push overlapping nodes apart (rows stay rows, columns stay columns)
//   3. grow each zone so its nodes and its title fit inside
//   4. bend each edge so it does not pass through other nodes
//   5. place each edge label where no node or other label covers it
//   6. compute a camera box that frames everything with a margin
// Everything is plain geometry, so the same result is produced on every screen size.

const KIND_SIZE = { cell: [58, 58], ptr: [52, 26] };
export const EXTRUDE = 5;            // raised-tile depth drawn under each node
const CHAR = 8.8, SUBCHAR = 7.3, EDGECHAR = 7.4, ZONECHAR = 8.2;

export function nodeSize(spec) {
  const kind = spec.kind || 'code';
  if (KIND_SIZE[kind]) {
    const [w, h] = KIND_SIZE[kind];
    return { w: kind === 'ptr' ? Math.max(spec.w || w, String(spec.label).length * 9 + 18) : spec.w || w, h: spec.h || h };
  }
  const lines = String(spec.label ?? '').split('\n');
  const subs = spec.sub ? String(spec.sub).split('\n') : [];
  const minH = 20 + lines.length * 18 + subs.length * 15;
  const h = Math.max(spec.h || (subs.length ? 58 : 46), minH);
  const iconPad = spec.icon === false || kind === 'note' ? 28 : 64;
  const textW = Math.max(...lines.map((s) => s.length * CHAR), ...subs.map((s) => s.length * SUBCHAR));
  const w = Math.max(spec.w || (spec.icon === false ? 120 : 160), Math.ceil(textW + iconPad));
  return { w, h };
}

// the rectangle a node really occupies on screen (box + extrusion + badge or pointer tick)
export function nodeRect(n) {
  const top = n.y - n.h / 2 - (n.spec.badge ? 10 : 0) - (n.spec.kind === 'ptr' ? 18 : 0);
  return { x: n.x - n.w / 2, y: top, w: n.w, h: n.y + n.h / 2 + (n.spec.kind === 'ptr' ? 0 : EXTRUDE) - top };
}

const gapOf = (n) => (n.spec.kind === 'cell' || n.spec.kind === 'ptr' ? 6 : 22);
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const inflate = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const inside = (pt, r) => pt[0] > r.x && pt[0] < r.x + r.w && pt[1] > r.y && pt[1] < r.y + r.h;

// ---------------------------------------------------------------- edges geometry (shared with the renderer)
export function clip(n, tx, ty, side) {
  const pad = 5;
  if (side) {
    const m = { top: [n.x, n.y - n.h / 2 - pad], bottom: [n.x, n.y + n.h / 2 + EXTRUDE + pad], left: [n.x - n.w / 2 - pad, n.y], right: [n.x + n.w / 2 + pad, n.y] };
    if (m[side]) return m[side];
  }
  const dx = tx - n.x, dy = ty - n.y;
  if (!dx && !dy) return [n.x, n.y];
  const hw = n.w / 2 + pad, hh = n.h / 2 + pad + (dy > 0 ? EXTRUDE : 0);
  const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [n.x + dx * s, n.y + dy * s];
}
export function edgeGeom(a, b, bend, spec = {}) {
  // anchor on a named side when one is given, otherwise on the centre
  const s1 = spec.fromSide ? clip(a, 0, 0, spec.fromSide) : [a.x, a.y];
  const s2 = spec.toSide ? clip(b, 0, 0, spec.toSide) : [b.x, b.y];
  const mx = (s1[0] + s2[0]) / 2, my = (s1[1] + s2[1]) / 2;
  const dx = s2[0] - s1[0], dy = s2[1] - s1[1], len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
  return { p1: clip(a, cx, cy, spec.fromSide), p2: clip(b, cx, cy, spec.toSide), c: [cx, cy] };
}
export const qpt = (g, t) => [(1 - t) * (1 - t) * g.p1[0] + 2 * (1 - t) * t * g.c[0] + t * t * g.p2[0], (1 - t) * (1 - t) * g.p1[1] + 2 * (1 - t) * t * g.c[1] + t * t * g.p2[1]];
export function labelPos(g, t, side) {
  const p = qpt(g, t);
  // tangent → normal
  const tx = 2 * (1 - t) * (g.c[0] - g.p1[0]) + 2 * t * (g.p2[0] - g.c[0]);
  const ty = 2 * (1 - t) * (g.c[1] - g.p1[1]) + 2 * t * (g.p2[1] - g.c[1]);
  const L = Math.hypot(tx, ty) || 1;
  let nx = -ty / L, ny = tx / L;
  if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }   // side −1 = "above" the line
  // place the label's centre `off` away from the line, then return its text baseline (glyphs sit ~4px above it)
  const off = 14 + Math.abs(nx) * 22;                              // steep edges need more room for wide labels
  return [p[0] - nx * off * side, p[1] - ny * off * side + 4];
}
export const labelRect = (pos, text) => { const w = String(text).length * EDGECHAR + 8; return { x: pos[0] - w / 2, y: pos[1] - 13, w, h: 17 }; };

// ---------------------------------------------------------------- main
export function layout(scene, prev) {
  // 1. sizes + initial positions
  const nodes = (scene.nodes || []).map((spec) => ({ spec, id: spec.id, x: spec.x, y: spec.y, ...nodeSize(spec) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // zone membership from the authored rectangles (before anything moves)
  const zones = (scene.zones || []).map((z) => ({ ...z, members: nodes.filter((n) => n.x > z.x && n.x < z.x + z.w && n.y > z.y && n.y < z.y + z.h) }));

  // 2. push overlapping nodes apart
  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const ra = nodeRect(a), rb = nodeRect(b), gap = Math.min(gapOf(a), gapOf(b));
      const ox = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x) + gap;
      const oy = Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y) + gap * 0.6;
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      const sameRow = Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.6;
      const sameCol = Math.abs(a.x - b.x) < Math.min(a.w, b.w) * 0.3;
      if (sameRow || (!sameCol && ox <= oy * 1.6)) {
        const d = ox / 2 + 0.5, s = a.x < b.x || (a.x === b.x && i < j) ? 1 : -1;
        a.x -= d * s; b.x += d * s;
      } else {
        const d = oy / 2 + 0.5, s = a.y < b.y || (a.y === b.y && i < j) ? 1 : -1;
        a.y -= d * s; b.y += d * s;
      }
    }
    if (!moved) break;
  }

  // 2b. two connected nodes keep enough room between them for the arrow (and its label) to be seen
  for (let pass = 0; pass < 3; pass++) for (const e of scene.edges || []) {
    const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b || a === b) continue;
    const ra = nodeRect(a), rb = nodeRect(b);
    const yOver = Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y) > 0;
    const xOver = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x) > 0;
    if (yOver === xOver) continue;
    const lw = e.label ? String(e.label).length * EDGECHAR + 8 : 0;
    if (yOver) {                                   // side by side
      const [L, R] = ra.x < rb.x ? [ra, rb] : [rb, ra];
      const d = (e.label ? lw + 30 : 40) - (R.x - L.x - L.w);
      if (d > 0) for (const n of nodes) if (nodeRect(n).x >= R.x - 1) n.x += d;
    } else {                                       // stacked
      const [T, B] = ra.y < rb.y ? [ra, rb] : [rb, ra];
      const d = (e.label ? 44 : 34) - (B.y - T.y - T.h);
      if (d > 0) for (const n of nodes) if (nodeRect(n).y >= B.y - 1) n.y += d;
    }
  }

  // 3. zones grow to hold their members + title (inner zones first, so outer zones wrap them)
  const area = (z) => z.w * z.h;
  const containsR = (o, i) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;
  for (const z of zones) z.parent = zones.filter((o) => o !== z && area(o) > area(z) && containsR(o, z)).sort((p, q) => area(p) - area(q))[0] || null;
  const grow = (z) => {
    const titleW = String(z.label || '').length * ZONECHAR + 34;
    let x0 = z.x, y0 = z.y, x1 = z.x + z.w, y1 = z.y + z.h;
    const fit = (r, side = 16, top = 36, bottom = 14) => { x0 = Math.min(x0, r.x - side); x1 = Math.max(x1, r.x + r.w + side); y0 = Math.min(y0, r.y - top); y1 = Math.max(y1, r.y + r.h + bottom); };
    for (const n of z.members) if (!zones.some((c) => c.parent === z && c.members.includes(n))) fit(nodeRect(n));
    for (const c of zones) if (c.parent === z) fit(c, 12, 30, 12);
    x1 = Math.max(x1, x0 + titleW);
    Object.assign(z, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    z.titleRect = { x: x0 + 10, y: y0 + 6, w: titleW - 14, h: 24 };
  };
  [...zones].sort((p, q) => area(p) - area(q)).forEach(grow);

  // 3b. whole zones (with everything inside) and free nodes push each other apart
  const tops = zones.filter((z) => !z.parent);
  const inZone = new Set(zones.flatMap((z) => z.members));
  const ents = [
    ...tops.map((z) => ({ rect: () => z, nodes: nodes.filter((n) => z.members.includes(n)), zones: zones.filter((c) => { for (let p = c; p; p = p.parent) if (p === z) return true; return false; }) })),
    ...nodes.filter((n) => !inZone.has(n)).map((n) => ({ rect: () => nodeRect(n), nodes: [n], zones: [] })),
  ];
  const shift = (en, dx, dy) => {
    for (const n of en.nodes) { n.x += dx; n.y += dy; }
    for (const z of en.zones) { z.x += dx; z.y += dy; z.titleRect.x += dx; z.titleRect.y += dy; }
  };
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const A = ents[i], B = ents[j]; if (!A.zones.length && !B.zones.length) continue;   // node/node handled above
      const a = A.rect(), b = B.rect(), gap = 16;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
      if (ox <= gap || oy <= gap) continue;
      moved = true;
      const fa = 0.5, fb = 0.5;
      if (ox <= oy) { const s = a.x + a.w / 2 <= b.x + b.w / 2 ? 1 : -1; shift(A, -ox * fa * s, 0); shift(B, ox * fb * s, 0); }
      else { const s = a.y + a.h / 2 <= b.y + b.h / 2 ? 1 : -1; shift(A, 0, -oy * fa * s); shift(B, 0, oy * fb * s); }
    }
    if (!moved) break;
  }
  // 3c. squeeze empty bands: authored scenes leave wide gaps that only shrink the picture
  const squeeze = (ax) => {
    const [P, S] = ax === 'x' ? ['x', 'w'] : ['y', 'h'];
    const items = [...nodes.filter((n) => !inZone.has(n)).map((n) => ({ r: { ...nodeRect(n) }, nodes: [n], zones: [] })),
      ...ents.filter((en) => en.zones.length).map((en) => ({ r: { ...en.rect() }, nodes: en.nodes, zones: en.zones }))];
    const orig = new Map(nodes.map((n) => [n, { x: n.x, y: n.y }]));
    items.sort((a, b) => a.r[P] - b.r[P]);
    let reach = -Infinity, shiftBy = 0;
    for (const it of items) {
      const lo = it.r[P], hi = lo + it.r[S];
      if (lo > reach && reach > -Infinity) {
        let need = ax === 'x' ? 74 : 58;     // room for an arrow
        for (const e of scene.edges || []) {
          const A = byId.get(e.from), B = byId.get(e.to); if (!A || !B) continue;
          const a = orig.get(A), b = orig.get(B);
          if (Math.min(a[ax], b[ax]) < reach && Math.max(a[ax], b[ax]) > lo) {
            const along = Math.abs(a[ax] - b[ax]), across = Math.abs(ax === 'x' ? a.y - b.y : a.x - b.x);
            if (e.label && ax === 'x' && along > across) need = Math.max(need, String(e.label).length * EDGECHAR + 44);
            if (e.label && ax === 'y' && along >= across) need = Math.max(need, 66);
          }
        }
        if (ax === 'y' && (scene.flows || []).some((f) => f.label)) need += 12;   // packet labels ride above edges
        if (lo - reach > need) shiftBy += lo - reach - need;
      }
      if (shiftBy) shift(it, ax === 'x' ? -shiftBy : 0, ax === 'y' ? -shiftBy : 0);
      reach = Math.max(reach, hi);
    }
  };
  if (!scene.keepSpacing) { squeeze('x'); squeeze('y'); }
  // nodes that are not members must not sit on a zone title
  for (const z of zones) for (const n of nodes) {
    if (z.members.includes(n)) continue;
    const r = nodeRect(n);
    if (overlap(r, z.titleRect, 4)) { const dy = z.titleRect.y + z.titleRect.h + 6 - r.y; n.y += dy; }
  }

  // 4 + 5. route each edge around obstacles, then place its label where nothing covers it
  const rects = new Map(nodes.map((n) => [n.id, inflate(nodeRect(n), 7)]));
  const nodeRs = nodes.map((n) => inflate(nodeRect(n), 3));
  const edges = [];
  const placed = [];
  const pairCount = new Map();
  const drawn = [];
  const SIDES = [[null, null], [null, 'left'], [null, 'right'], ['right', 'right'], ['left', 'left'], [null, 'top'], ['bottom', null], ['right', 'left'], ['left', 'right']];
  const labelCost = (r) => {
    let c = 0;
    for (const nr of nodeRs) if (overlap(r, nr)) c += 10;
    for (const pr of placed) if (overlap(r, pr, 2)) c += 10;
    for (const z of zones) if (overlap(r, z.titleRect)) c += 6;
    return c;
  };
  const packetEdges = new Set((scene.flows || []).filter((f) => f.label || f.back).map((f) => f.edge));
  const bestLabel = (g, text, below) => {
    let best = null;
    for (const m of [1, 1.9, 2.8]) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) for (const side of [-1, 1]) {
      const r = labelRect(labelPos(g, t, side * m), text);
      const cost = labelCost(r) + (m - 1) * 0.6 + Math.abs(t - 0.5) * 0.5 + (below && side < 0 ? 3 : 0);
      if (!best || cost < best.cost) best = { t, side: side * m, cost, r };
    }
    return best;
  };
  for (const spec of scene.edges || []) {
    const a = byId.get(spec.from), b = byId.get(spec.to);
    const key = spec.id || `${spec.from}>${spec.to}`;
    if (!a || !b) { edges.push({ spec, key, bend: 0, gs: spec }); continue; }
    const pk = [spec.from, spec.to].sort().join('|');
    const nth = pairCount.get(pk) || 0; pairCount.set(pk, nth + 1);
    const base = spec.bend ?? (nth ? 36 * nth * (spec.from < spec.to ? 1 : -1) : 0);
    const fixedSides = !!(spec.fromSide || spec.toSide);
    const cands = [];
    for (const [fs, ts] of fixedSides ? [[spec.fromSide, spec.toSide]] : SIDES)
      for (const d of [0, 40, -40, 80, -80, 130, -130, 190, -190, 260, -260, 340, -340, 440, -440]) {
        const gs = { ...spec, fromSide: fs || undefined, toSide: ts || undefined };
        const g = edgeGeom(a, b, base + d, gs);
        let hits = 0;
        for (let k = 1; k < 32; k++) {
          const p = qpt(g, k / 32);
          for (const [id, r] of rects) if (id !== a.id && id !== b.id && inside(p, r)) hits++;
        }
        // running on top of an edge drawn earlier reads as one line: avoid it
        let near = 0;
        for (let k = 2; k < 31; k += 2) { const p = qpt(g, k / 32); for (const q of drawn) if (Math.abs(p[0] - q[0]) < 7 && Math.abs(p[1] - q[1]) < 7) { near++; break; } }
        cands.push({ bend: base + d, gs, g, hits, cost: hits * 100 + near * 3 + Math.abs(d) * 0.05 + (fs || ts ? 6 : 0) });
        if (fixedSides && !hits && !spec.label) break;
      }
    cands.sort((p, q) => p.cost - q.cost);
    if (globalThis.DEBUG_EDGE === key) console.log(cands.slice(0, 8).map((c) => [c.bend, c.gs.fromSide, c.gs.toSide, c.hits].join(' ')));
    let pick = cands[0];
    if (spec.label) {
      let best = null;
      for (const c of cands.slice(0, 10)) {
        if (c.hits > cands[0].hits) break;
        const L = bestLabel(c.g, spec.label, packetEdges.has(key));
        const total = c.cost + L.cost * 4;
        if (!best || total < best.total) best = { c, L, total };
        if (!L.cost) break;
      }
      pick = best.c;
      Object.assign(pick, { lt: best.L.t, ls: best.L.side, lcost: best.L.cost });
      placed.push(best.L.r);
    }
    for (let k = 1; k < 32; k++) drawn.push(qpt(pick.g, k / 32));
    edges.push({ spec, key, bend: pick.bend, gs: pick.gs, hits: pick.hits, lt: pick.lt, ls: pick.ls, lcost: pick.lcost });
  }

  // 6. camera: frame nodes, zones, edges and labels
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (r) => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); };
  nodes.forEach((n) => add(nodeRect(n)));
  zones.forEach(add);
  placed.forEach(add);
  for (const e of edges) {
    const a = byId.get(e.spec.from), b = byId.get(e.spec.to);
    if (!a || !b) continue;
    const g = edgeGeom(a, b, e.bend, e.gs);
    for (let k = 0; k <= 12; k++) { const p = qpt(g, k / 12); add({ x: p[0], y: p[1], w: 0, h: 0 }); }
  }
  // room above edges for packet labels
  if ((scene.flows || []).some((f) => f.label)) y0 -= 22;
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 1000; y1 = 520; }
  let caption = null;
  if (scene.caption) { caption = { x: (x0 + x1) / 2, y: y1 + 26 }; y1 += 36; }
  const PAD = 28;
  let view = { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD };
  // don't zoom in absurdly on tiny diagrams
  const MINW = 620, MINH = 300;
  if (view.w < MINW) { view.x -= (MINW - view.w) / 2; view.w = MINW; }
  if (view.h < MINH) { view.y -= (MINH - view.h) / 2; view.h = MINH; }
  return { nodes, zones, edges, view, caption, labels: placed };
}
