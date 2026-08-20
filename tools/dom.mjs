/* Minimal DOM good enough to run TriOp headlessly. */
export class El {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = []; this.dataset = {}; this._attrs = {}; this._html = ''; this._text = '';
    this.disabled = false; this.value = ''; this.type = ''; this.hidden = false;
    this.style = {}; this._parent = null; this._listeners = {};
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => x && set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      toggle: (c, on) => (on ? set.add(c) : set.delete(c)),
      contains: (c) => set.has(c), _set: set,
    };
  }
  get className() { return [...this.classList._set].join(' '); }
  set className(v) { this.classList._set.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList._set.add(c)); }
  get textContent() { return this._text || this._html.replace(/<[^>]+>/g, ''); }
  set textContent(v) { this._text = String(v); this._html = ''; this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this._text = ''; this.children = []; }
  get offsetWidth() { return 1; }
  get childElementCount() { return this.children.length; }
  get lastElementChild() { return this.children[this.children.length - 1] ?? null; }
  get parentElement() { return this._parent; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(c) { c._parent = this; this.children.push(c); return c; }
  prepend(c) { c._parent = this; this.children.unshift(c); return c; }
  remove() {
    const p = this._parent; if (!p) return;
    const i = p.children.indexOf(this); if (i >= 0) p.children.splice(i, 1);
    this._parent = null;
  }
  blur() {}
  addEventListener(t, f) { (this._listeners[t] ||= []).push(f); }
  fire(t, e = {}) { (this._listeners[t] || []).forEach((f) => f(e)); }
  querySelector(sel) { return this._q(sel)[0] ?? null; }
  querySelectorAll(sel) { return this._q(sel); }
  _q(sel) {
    const cls = sel.replace(/^\./, ''); const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.classList.contains(cls)) out.push(c); walk(c); });
    walk(this); return out;
  }
  find(cls) { return this._q('.' + cls); }
}

export function install(ids) {
  const store = {};
  ids.forEach((id) => (store[id] = new El()));
  const body = new El('body'); body.dataset = {};
  const doc = {
    _listeners: {},
    body,
    getElementById: (id) => store[id] ?? null,
    querySelector: () => null,
    createElement: (t) => new El(t),
    addEventListener: (t, f) => ((doc._listeners[t] ||= []).push(f)),
    fire: (t, e) => (doc._listeners[t] || []).forEach((f) => f(e)),
    activeElement: { tagName: 'BODY' },
  };
  const ls = {};
  globalThis.document = doc;
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem: (k) => (k in ls ? ls[k] : null),
    setItem: (k, v) => { ls[k] = String(v); },
  };
  return { store, doc, ls };
}
