// Animated SVG scene renderer.
// A scene is plain data: { zones[], nodes[], edges[], flows[], caption }.
// layout.js cleans it up (sizes, overlaps, zones, edge routing, labels, camera); this file draws and animates it.
// Nodes are matched by id between steps, so a node that exists in two steps glides to its new place,
// and the camera glides to frame each step.
import { ICONS } from './icons.js';
import { layout, edgeGeom, labelPos, EXTRUDE } from './layout.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Scene {
  constructor(host) {
    this.host = host;
    this.svg = el('svg', { class: 'scene', viewBox: '0 0 1000 520', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
    host.appendChild(this.svg);
    this.gZones = el('g', {}, this.svg);
    this.gEdges = el('g', {}, this.svg);
    this.gNodes = el('g', {}, this.svg);
    this.gLabels = el('g', {}, this.svg);   // edge labels sit above nodes so nothing hides them
    this.gPk = el('g', {}, this.svg);
    this.gCap = el('g', {}, this.svg);
    this.nodes = new Map();
    this.edges = new Map();
    this.zones = new Map();
    this.flows = [];
    this.packets = [];
    this.paused = false;
    this.speed = 1;
    this.view = null; this.viewT = null;
    this.last = performance.now();
    this.alive = true;
    const loop = (t) => { if (!this.alive) return; this.tick(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  replay() { this.setFlows(this.lastFlows || []); }
  destroy() { this.alive = false; this.svg.remove(); }

  set(scene = {}) {
    const L = layout(scene);
    this.layout = L;
    this.svg.setAttribute('aria-label', scene.caption || 'Diagram');
    this.setZones(L.zones);
    this.setNodes(L.nodes);
    this.setEdges(L.edges);
    this.lastFlows = scene.flows || [];
    this.setFlows(this.lastFlows);
    this.gCap.replaceChildren();
    if (L.caption) {
      const t = el('text', { x: L.caption.x, y: L.caption.y, 'text-anchor': 'middle', class: 'cap' }, this.gCap);
      t.textContent = scene.caption;
    }
    this.viewT = L.view;
    // phones size the svg from the picture itself, so text never renders below ~9px (the wrapper scrolls sideways)
    this.svg.style.setProperty('--vw', L.view.w.toFixed(0)); this.svg.style.setProperty('--vh', L.view.h.toFixed(0));
    if (!this.view || reduced) this.view = { ...L.view };
    this.applyView();
  }

  applyView() { const v = this.view; this.svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`); }

  // ---------- zones ----------
  setZones(list) {
    const seen = new Set();
    for (const z of list) {
      const id = z.id || z.label;
      seen.add(id);
      let r = this.zones.get(id);
      if (!r) {
        r = el('g', { class: 'zone' }, this.gZones);
        r.style.opacity = 0;
        el('rect', { rx: 18 }, r);
        el('text', {}, r);
        this.zones.set(id, r);
        requestAnimationFrame(() => (r.style.opacity = 1));
      } else if (r.dying) { r.dying = false; clearTimeout(r.dieT); r.style.opacity = 1; }
      r.style.transition = 'opacity .4s';
      r.style.setProperty('--c', `var(--k-${z.kind || 'note'}, var(--k-note))`);
      const rect = r.firstChild;
      rect.setAttribute('x', z.x); rect.setAttribute('y', z.y);
      rect.setAttribute('width', z.w); rect.setAttribute('height', z.h);
      const t = r.lastChild;
      t.setAttribute('x', z.x + 16); t.setAttribute('y', z.y + 23);
      t.textContent = z.label || '';
    }
    for (const [id, r] of this.zones) if (!seen.has(id) && !r.dying) { r.dying = true; r.style.opacity = 0; r.dieT = setTimeout(() => { r.remove(); this.zones.delete(id); }, 400); }
  }

  // ---------- nodes ----------
  setNodes(list) {
    const seen = new Set();
    for (const ln of list) {
      const spec = ln.spec;
      seen.add(spec.id);
      let n = this.nodes.get(spec.id);
      if (!n) {
        const g = el('g', { class: 'nd enter' }, this.gNodes);
        const body = el('g', { class: 'body' }, g);
        n = { id: spec.id, g, body, x: ln.x, y: ln.y, key: '' };
        if (spec.from && this.nodes.get(spec.from)) { const f = this.nodes.get(spec.from); n.x = f.x; n.y = f.y; }
        this.nodes.set(spec.id, n);
        requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('enter')));
      } else if (n.dying) {
        n.dying = false; clearTimeout(n.dieT); n.g.classList.remove('exit');
      }
      n.tx = ln.x; n.ty = ln.y; n.w = ln.w; n.h = ln.h; n.spec = spec;
      if (reduced) { n.x = ln.x; n.y = ln.y; }
      const cls = ['nd', `k-${spec.kind || 'code'}`, spec.state || '', spec.cls || ''].join(' ');
      n.g.setAttribute('class', cls + (n.g.classList.contains('enter') ? ' enter' : ''));
      n.g.style.setProperty('--c', `var(--k-${spec.color || spec.kind || 'code'}, var(--k-code))`);
      n.g.dataset.id = spec.id;
      const key = JSON.stringify([spec.label, spec.sub, spec.kind, spec.icon, spec.badge, n.w, n.h, spec.mono]);
      if (key !== n.key) { n.key = key; this.drawNode(n, spec); }
      this.place(n);
    }
    for (const [id, n] of this.nodes) {
      if (!seen.has(id) && !n.dying) {
        n.dying = true; n.g.classList.add('exit');
        n.dieT = setTimeout(() => { n.g.remove(); this.nodes.delete(id); }, 380);
      }
    }
  }

  drawNode(n, s) {
    const b = n.body; b.replaceChildren();
    const { w, h } = n; const x0 = -w / 2, y0 = -h / 2;
    const kind = s.kind || 'code';
    if (kind === 'ptr') {
      el('line', { x1: 0, y1: y0 - 2, x2: 0, y2: y0 - 16, class: 'tick' }, b);
      el('path', { d: `M-6 ${y0 - 10} L0 ${y0 - 18} L6 ${y0 - 10}`, class: 'tick', fill: 'none' }, b);
      el('rect', { x: x0, y: y0, width: w, height: h, rx: h / 2, class: 'box' }, b);
      const t = el('text', { x: 0, y: 4.5, 'text-anchor': 'middle', class: 'lbl' }, b); t.textContent = s.label;
      return;
    }
    const rx = kind === 'cell' ? 9 : 10;
    el('rect', { x: x0, y: y0 + EXTRUDE, width: w, height: h, rx, class: 'ext' }, b);
    el('rect', { x: x0, y: y0, width: w, height: h, rx, class: 'box' }, b);
    el('path', { d: `M${x0 + rx} ${y0 + 1.6}H${x0 + w - rx}`, class: 'shine' }, b);
    const showIcon = s.icon !== false && kind !== 'cell' && kind !== 'note';
    let tx = 0, anchor = 'middle';
    if (showIcon) {
      const cx = x0 + 26;
      el('circle', { cx, cy: 0, r: 15, class: 'icobg' }, b);
      const ic = ICONS[s.icon || kind] || ICONS.code;
      if (ic.text) { const t = el('text', { x: cx, y: 4, 'text-anchor': 'middle', class: 'icot' }, b); t.textContent = ic.text; }
      else { const g = el('g', { transform: `translate(${cx - 9},-9) scale(.75)`, class: 'ico' }, b); g.innerHTML = ic.svg; }
      tx = x0 + 50; anchor = 'start';
    }
    const lines = String(s.label ?? '').split('\n');
    const subs = s.sub ? String(s.sub).split('\n') : [];
    const lh = 18, sh = 15;
    const total = lines.length * lh + subs.length * sh;
    let y = -total / 2 + 13;
    if (kind === 'cell') y = subs.length ? -2 : 7;
    for (const ln of lines) {
      const t = el('text', { x: tx, y, 'text-anchor': anchor, class: 'lbl' + (s.mono ? ' mono' : '') }, b);
      t.textContent = ln; y += lh;
    }
    if (kind === 'cell') y = 20;
    for (const ln of subs) {
      const t = el('text', { x: tx, y: y - 2, 'text-anchor': anchor, class: 'sub' + (s.mono || kind === 'cell' ? ' mono' : '') }, b);
      t.textContent = ln; y += sh;
    }
    if (s.badge) {
      const bw = s.badge.length * 7 + 14;
      const g = el('g', { class: 'bdg', transform: `translate(${Math.max(x0 + 4, w / 2 - bw - 6)},${y0 - 10})` }, b);
      el('rect', { width: bw, height: 18, rx: 9 }, g);
      const t = el('text', { x: bw / 2, y: 12.5, 'text-anchor': 'middle' }, g); t.textContent = s.badge;
    }
  }

  place(n) { n.g.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`); }

  // ---------- edges ----------
  setEdges(list) {
    const seen = new Set();
    for (const le of list) {
      const s = le.spec, key = le.key;
      seen.add(key);
      let e = this.edges.get(key);
      if (!e) {
        const g = el('g', { class: 'ed enter' }, this.gEdges);
        const lg = el('g', { class: 'el enter' }, this.gLabels);
        e = { key, g, lg, ln: el('path', { class: 'ln' }, g), hd: el('path', { class: 'hd' }, g), hd2: el('path', { class: 'hd' }, g), tx: el('text', { 'text-anchor': 'middle' }, lg) };
        this.edges.set(key, e);
        requestAnimationFrame(() => requestAnimationFrame(() => { g.classList.remove('enter'); lg.classList.remove('enter'); }));
      } else if (e.dying) { e.dying = false; clearTimeout(e.dieT); e.g.style.opacity = ''; e.lg.style.opacity = ''; }
      e.spec = s; e.gs = le.gs || s; e.bend = le.bend; e.lt = le.lt ?? 0.5; e.ls = le.ls ?? -1;
      const cls = ['ed', s.style || '', s.state || ''].join(' ');
      e.g.setAttribute('class', cls); e.lg.setAttribute('class', cls.replace('ed', 'el'));
      e.g.dataset.key = key; e.lg.dataset.key = key;
      for (const target of [e.g, e.lg]) { if (s.kind) target.style.setProperty('--c', `var(--k-${s.kind}, var(--k-code))`); else target.style.removeProperty('--c'); }
      e.tx.textContent = s.label || '';
    }
    for (const [k, e] of this.edges) {
      if (!seen.has(k) && !e.dying) {
        e.dying = true; e.g.style.opacity = 0; e.lg.style.opacity = 0;
        e.dieT = setTimeout(() => { e.g.remove(); e.lg.remove(); this.edges.delete(k); }, 400);
      }
    }
  }

  drawEdge(e) {
    const a = this.nodes.get(e.spec.from), b = this.nodes.get(e.spec.to);
    if (!a || !b) { e.ln.setAttribute('d', ''); return; }
    const g = edgeGeom(a, b, e.bend || 0, e.gs || e.spec);
    const { p1, p2, c } = g;
    e.ln.setAttribute('d', `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
    const dir = e.spec.dir || '->';
    e.hd.setAttribute('d', dir === 'none' ? '' : head(p2, c));
    e.hd2.setAttribute('d', dir === '<->' ? head(p1, c) : '');
    if (e.spec.label) {
      const [lx, ly] = labelPos(g, e.lt, e.ls);
      e.tx.setAttribute('x', lx.toFixed(1)); e.tx.setAttribute('y', ly.toFixed(1));
    }
  }

  // ---------- flows / packets ----------
  setFlows(list) {
    this.flows = list.map((f) => ({ ...f, t: -(f.delay ?? 0.15), every: f.every ?? 2.2, speed: f.speed ?? 260, count: 0 }));
    for (const p of this.packets) p.g.remove();
    this.packets = [];
  }

  spawn(f) {
    const e = this.edges.get(f.edge);
    if (!e || e.dying) return;
    const g = el('g', { class: 'pk' }, this.gPk);
    const col = `var(--k-${f.kind || 'net'}, var(--k-net))`;
    g.style.setProperty('--c', col);
    el('circle', { r: 6.5, fill: col }, g);
    let label = null, rect = null;
    if (f.label) {
      rect = el('rect', { rx: 6, height: 19 }, g);
      label = el('text', { 'text-anchor': 'middle' }, g);
      setLabel(rect, label, f.label);
    }
    this.packets.push({ f, e, g, rect, label, d: 0, back: false, hold: 0 });
  }

  tick(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000) * this.speed;
    this.last = t;
    const k = reduced ? 1 : 1 - Math.pow(0.0015, Math.min(0.05, dt / this.speed));
    // camera glide
    if (this.view && this.viewT) {
      let moved = false;
      for (const p of ['x', 'y', 'w', 'h']) { const d = this.viewT[p] - this.view[p]; if (Math.abs(d) > 0.05) { this.view[p] += d * k; moved = true; } }
      if (moved) this.applyView();
    }
    // node glide
    for (const n of this.nodes.values()) {
      if (n.tx == null) continue;
      const dx = n.tx - n.x, dy = n.ty - n.y;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) { n.x += dx * k; n.y += dy * k; this.place(n); }
    }
    for (const e of this.edges.values()) this.drawEdge(e);
    if (this.paused) return;
    for (const f of this.flows) {
      if (f.once && f.count >= 1) continue;
      f.t += dt;
      if (f.t >= 0) { this.spawn(f); f.count++; f.t = -f.every; }
    }
    const keep = [];
    for (const p of this.packets) {
      if (!p.e.ln.isConnected || p.e.dying) { p.g.remove(); continue; }
      const L = p.e.ln.getTotalLength();
      if (!L) { keep.push(p); continue; }
      if (p.hold > 0) { p.hold -= dt; keep.push(p); continue; }
      p.d += p.f.speed * dt;
      if (p.d >= L) {
        const target = this.nodes.get(p.back ? p.e.spec.from : p.e.spec.to);
        if (target) { target.g.classList.remove('hit'); target.g.classList.add('hit'); setTimeout(() => target.g.classList.remove('hit'), 500); }
        if (p.f.fail && !p.back) { this.burst(p.e.ln.getPointAtLength(L)); p.g.remove(); continue; }
        if (p.f.back && !p.back) {
          p.back = true; p.d = 0; p.hold = p.f.hold ?? 0.25;
          if (p.label && p.f.back !== true) setLabel(p.rect, p.label, p.f.back);
          if (p.f.backKind) { const bc = `var(--k-${p.f.backKind}, var(--k-net))`; p.g.style.setProperty('--c', bc); p.g.firstChild.setAttribute('fill', bc); }
          keep.push(p); continue;
        }
        p.g.remove(); continue;
      }
      const pt = p.e.ln.getPointAtLength(p.back ? L - p.d : p.d);
      p.g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      keep.push(p);
    }
    this.packets = keep;
  }

  burst(pt) {
    const c = el('circle', { cx: pt.x, cy: pt.y, r: 4, class: 'burst' }, this.gPk);
    setTimeout(() => c.remove(), 650);
  }
}

function setLabel(rect, text, s) {
  text.textContent = s;
  const w = Math.max(26, s.length * 7.2 + 14);
  rect.setAttribute('width', w); rect.setAttribute('x', -w / 2); rect.setAttribute('y', -32);
  text.setAttribute('y', -18.5);
}

function head(p, c) {
  const a = Math.atan2(p[1] - c[1], p[0] - c[0]);
  const s = 9, w = 5.5;
  const bx = p[0] - Math.cos(a) * s, by = p[1] - Math.sin(a) * s;
  return `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${(bx - Math.sin(a) * w).toFixed(1)},${(by + Math.cos(a) * w).toFixed(1)} L${(bx + Math.sin(a) * w).toFixed(1)},${(by - Math.cos(a) * w).toFixed(1)}Z`;
}
