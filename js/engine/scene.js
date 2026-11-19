// Animated SVG scene renderer.
// A scene is plain data: { h, zones[], nodes[], edges[], flows[], caption }.
// Nodes are matched by id between steps, so a node that exists in two steps glides to its new place.
// Flows send labelled "packets" along edges, so a request can be watched travelling.
import { ICONS } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1000;
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const KIND_SIZE = { cell: [58, 58], ptr: [52, 26], note: [220, 54] };
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Scene {
  constructor(host) {
    this.host = host;
    this.svg = el('svg', { class: 'scene', viewBox: `0 0 ${W} 520`, role: 'img' });
    host.appendChild(this.svg);
    this.gZones = el('g', {}, this.svg);
    this.gEdges = el('g', {}, this.svg);
    this.gNodes = el('g', {}, this.svg);
    this.gPk = el('g', {}, this.svg);
    this.gCap = el('g', {}, this.svg);
    this.nodes = new Map();
    this.edges = new Map();
    this.zones = new Map();
    this.flows = [];
    this.packets = [];
    this.paused = false;
    this.speed = 1;
    this.last = performance.now();
    this.alive = true;
    const loop = (t) => { if (!this.alive) return; this.tick(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  replay() { this.setFlows(this.lastFlows || []); }

  destroy() { this.alive = false; this.svg.remove(); }

  set(scene = {}) {
    const h = scene.h || 520;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
    this.svg.setAttribute('aria-label', scene.caption || 'Diagram');
    this.setZones(scene.zones || []);
    this.setNodes(scene.nodes || []);
    this.setEdges(scene.edges || []);
    this.lastFlows = scene.flows || [];
    this.setFlows(this.lastFlows);
    this.gCap.replaceChildren();
    if (scene.caption) {
      const t = el('text', { x: W / 2, y: h - 14, 'text-anchor': 'middle', class: 'cap' }, this.gCap);
      t.textContent = scene.caption;
    }
  }

  // ---------- zones (dashed regions such as "Vercel" or "Your browser") ----------
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
      }
      r.style.transition = 'opacity .4s';
      r.style.setProperty('--c', `var(--k-${z.kind || 'note'}, var(--k-note))`);
      const rect = r.firstChild;
      rect.setAttribute('x', z.x); rect.setAttribute('y', z.y);
      rect.setAttribute('width', z.w); rect.setAttribute('height', z.h);
      const t = r.lastChild;
      t.setAttribute('x', z.x + 16); t.setAttribute('y', z.y + 22);
      t.textContent = z.label || '';
    }
    for (const [id, r] of this.zones) if (!seen.has(id)) { r.style.opacity = 0; setTimeout(() => r.remove(), 400); this.zones.delete(id); }
  }

  // ---------- nodes ----------
  setNodes(list) {
    const seen = new Set();
    for (const spec of list) {
      seen.add(spec.id);
      const [dw, dh] = KIND_SIZE[spec.kind] || [spec.icon === false ? 130 : 168, spec.sub ? 58 : 46];
      const h = spec.h || dh;
      let w = spec.w || dw;
      if (spec.kind !== 'cell' && spec.kind !== 'ptr') {
        // grow the box so its text never spills out
        const iconPad = spec.icon === false || spec.kind === 'note' ? 26 : 62;
        const lw = Math.max(...String(spec.label ?? '').split('\n').map((s) => s.length * 8.8));
        const sw = spec.sub ? Math.max(...String(spec.sub).split('\n').map((s) => s.length * 7.3)) : 0;
        w = Math.max(w, Math.ceil(Math.max(lw, sw) + iconPad));
      }
      let n = this.nodes.get(spec.id);
      if (!n) {
        const g = el('g', { class: 'nd enter' }, this.gNodes);
        const body = el('g', { class: 'body' }, g);
        n = { id: spec.id, g, body, x: spec.x, y: spec.y, w, h, key: '' };
        if (spec.from && this.nodes.get(spec.from)) { const f = this.nodes.get(spec.from); n.x = f.x; n.y = f.y; }
        this.nodes.set(spec.id, n);
        requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('enter')));
      } else if (n.dying) {
        n.dying = false; clearTimeout(n.dieT); n.g.classList.remove('exit');
      }
      n.tx = spec.x; n.ty = spec.y; n.w = w; n.h = h; n.spec = spec;
      const cls = ['nd', `k-${spec.kind || 'code'}`, spec.state || '', spec.cls || ''].join(' ');
      if (!n.g.classList.contains('enter')) n.g.setAttribute('class', cls); else n.g.setAttribute('class', cls + ' enter');
      n.g.style.setProperty('--c', `var(--k-${spec.color || spec.kind || 'code'}, var(--k-code))`);
      const key = JSON.stringify([spec.label, spec.sub, spec.kind, spec.icon, spec.badge, w, h, spec.mono]);
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
    el('rect', { x: x0, y: y0 + 5, width: w, height: h, rx, class: 'ext' }, b);   // raised-tile extrusion
    el('rect', { x: x0, y: y0, width: w, height: h, rx, class: 'box' }, b);
    el('path', { d: `M${x0 + rx} ${y0 + 1.6}H${x0 + w - rx}`, class: 'shine' }, b);
    const showIcon = s.icon !== false && kind !== 'cell' && kind !== 'note';
    if (kind !== 'cell' && kind !== 'note') el('rect', { x: x0, y: y0 + 8, width: 4, height: h - 16, rx: 2, class: 'bar' }, b);
    let tx = 0, anchor = 'middle';
    if (showIcon) {
      const cx = x0 + 26, cy = 0;
      el('circle', { cx, cy, r: 15, class: 'icobg' }, b);
      const ic = ICONS[s.icon || kind] || ICONS.code;
      if (ic.text) { const t = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'icot' }, b); t.textContent = ic.text; }
      else { const g = el('g', { transform: `translate(${cx - 9},${cy - 9}) scale(.75)`, class: 'ico' }, b); g.innerHTML = ic.svg; }
      tx = x0 + 48; anchor = 'start';
    }
    const lines = String(s.label ?? '').split('\n');
    const subs = s.sub ? String(s.sub).split('\n') : [];
    const lh = 18, sh = 15;
    const total = lines.length * lh + subs.length * sh;
    let y = -total / 2 + 12;
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
      const bw = Math.max(30, s.badge.length * 6.6 + 12);
      const g = el('g', { class: 'bdg', transform: `translate(${w / 2 - bw + 6},${y0 - 9})` }, b);
      el('rect', { width: bw, height: 18, rx: 9 }, g);
      const t = el('text', { x: bw / 2, y: 12.5, 'text-anchor': 'middle' }, g); t.textContent = s.badge;
    }
  }

  place(n) { n.g.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`); }

  // ---------- edges ----------
  setEdges(list) {
    const seen = new Set();
    for (const s of list) {
      const key = s.id || `${s.from}>${s.to}`;
      seen.add(key);
      let e = this.edges.get(key);
      if (!e) {
        const g = el('g', { class: 'ed enter' }, this.gEdges);
        e = { key, g, ln: el('path', { class: 'ln' }, g), hd: el('path', { class: 'hd' }, g), hd2: el('path', { class: 'hd' }, g), tx: el('text', { 'text-anchor': 'middle' }, g) };
        this.edges.set(key, e);
        requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('enter')));
      } else if (e.dying) { e.dying = false; clearTimeout(e.dieT); e.g.style.opacity = ''; }
      e.spec = s;
      e.g.setAttribute('class', ['ed', s.style || '', s.state || ''].join(' '));
      if (s.kind) e.g.style.setProperty('--c', `var(--k-${s.kind}, var(--k-code))`); else e.g.style.removeProperty('--c');
      e.tx.textContent = s.label || '';
    }
    for (const [k, e] of this.edges) {
      if (!seen.has(k) && !e.dying) {
        e.dying = true; e.g.style.opacity = 0;
        e.dieT = setTimeout(() => { e.g.remove(); this.edges.delete(k); }, 400);
      }
    }
  }

  geom(e) {
    const a = this.nodes.get(e.spec.from), b = this.nodes.get(e.spec.to);
    if (!a || !b) return null;
    const bend = e.spec.bend || 0;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    const p1 = clip(a, cx, cy, e.spec.fromSide), p2 = clip(b, cx, cy, e.spec.toSide);
    return { p1, p2, c: [cx, cy] };
  }

  drawEdge(e) {
    const g = this.geom(e); if (!g) { e.ln.setAttribute('d', ''); return; }
    const { p1, p2, c } = g;
    e.ln.setAttribute('d', `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
    const dir = e.spec.dir || '->';
    e.hd.setAttribute('d', dir === 'none' ? '' : head(p2, c));
    e.hd2.setAttribute('d', dir === '<->' ? head(p1, c) : '');
    // label sits on the curve's midpoint, nudged off the line
    const lx = 0.25 * p1[0] + 0.5 * c[0] + 0.25 * p2[0], ly = 0.25 * p1[1] + 0.5 * c[1] + 0.25 * p2[1];
    e.tx.setAttribute('x', lx.toFixed(1)); e.tx.setAttribute('y', (ly - 7 + (e.spec.labelDy || 0)).toFixed(1));
  }

  // ---------- flows / packets ----------
  setFlows(list) {
    // keep packets already in flight on edges that still exist; restart spawners
    this.flows = list.map((f) => ({ ...f, t: -(f.delay ?? 0.15), every: f.every ?? 2.2, speed: f.speed ?? 260, count: 0 }));
    for (const p of this.packets) p.g.remove();
    this.packets = [];
  }

  spawn(f) {
    const key = f.edge;
    const e = this.edges.get(key);
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
    // glide nodes toward their targets
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
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
        if (target) { target.g.classList.remove('hit'); void target.g.getBBox; target.g.classList.add('hit'); setTimeout(() => target.g.classList.remove('hit'), 500); }
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

// point where the line from a node's centre toward (tx,ty) leaves its box
function clip(n, tx, ty, side) {
  const pad = 5;
  if (side) {
    const m = { top: [n.x, n.y - n.h / 2 - pad], bottom: [n.x, n.y + n.h / 2 + pad], left: [n.x - n.w / 2 - pad, n.y], right: [n.x + n.w / 2 + pad, n.y] };
    if (m[side]) return m[side];
  }
  const dx = tx - n.x, dy = ty - n.y;
  if (!dx && !dy) return [n.x, n.y];
  const hw = n.w / 2 + pad, hh = n.h / 2 + pad;
  const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [n.x + dx * s, n.y + dy * s];
}

function head(p, c) {
  const a = Math.atan2(p[1] - c[1], p[0] - c[0]);
  const s = 9, w = 5.5;
  const bx = p[0] - Math.cos(a) * s, by = p[1] - Math.sin(a) * s;
  return `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${(bx - Math.sin(a) * w).toFixed(1)},${(by + Math.cos(a) * w).toFixed(1)} L${(bx + Math.sin(a) * w).toFixed(1)},${(by - Math.cos(a) * w).toFixed(1)}Z`;
}
