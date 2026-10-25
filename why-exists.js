/* why-exists.js: the 'Why this exists' section (studio rollout, 2026-10-24). Self-contained: nothing else on the page
 * depends on it, and removing the <script> tag removes it. Where it sits, in order:
 * 1. a How to play card made by playlab-ui.js ([data-pl="howto-card"]): a closed <details> under the rules;
 * 2. beside a visible How to play / Help button: a small text button that opens a card;
 * 3. in the page footer; 4. at the end of the page. Words, font and colours come from the page itself. */
(function () {
  'use strict';
  var W = {"en": "This puzzle takes a reality-show strategy idea and turns it into solo arithmetic on a twelve-tile board. It challenges you to build a number set that exactly hits the target, with four modes and a daily puzzle. Play to spot patterns and test your number sense.", "zh": "", "src": "", "url": ""};
  var doc = document, root = doc.documentElement;

  function zh() {
    if (!W.zh) return false;
    var l = (root.getAttribute('lang') || root.getAttribute('data-lang') || '').toLowerCase();
    if (l.indexOf('zh') === 0) return true;
    if (l) return false;
    var h = doc.querySelector('[data-pl="howto"] .pl-howto-word, [data-pl="howto"]');
    return !!(h && /玩法/.test(h.textContent || ''));
  }
  function copy() {
    var z = zh();
    return { sum: z ? '為什麼有這個遊戲' : 'Why this exists', text: z ? W.zh : W.en, src: z ? '來源：' : 'Source: ', close: z ? '關閉' : 'Close' };
  }
  function fill(box) {
    var c = copy();
    box.textContent = '';
    var p = doc.createElement('p'); p.className = 'why-exists-text'; p.textContent = c.text; box.appendChild(p);
    if (W.src) {
      var s = doc.createElement('p'); s.className = 'why-exists-source'; s.appendChild(doc.createTextNode(c.src));
      if (/^https:\/\//.test(W.url || '')) {
        var a = doc.createElement('a'); a.href = W.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = W.src; s.appendChild(a);
      } else s.appendChild(doc.createTextNode(W.src));
      box.appendChild(s);
    }
  }
  function style() {
    if (doc.getElementById('why-exists-style')) return;
    var st = doc.createElement('style'); st.id = 'why-exists-style';
    st.textContent = [
      '[data-why-exists]{font:inherit;color:inherit}',
      'details.why-exists{margin:12px 0 4px;text-align:start}',
      'details.why-exists>summary{min-height:44px!important;display:flex;align-items:center;cursor:pointer;font-size:max(16px,1em)!important;text-decoration:underline;text-underline-offset:3px}',
      '[data-why-exists] .why-exists-text,[data-why-exists] .why-exists-source,.why-exists-card .why-exists-text,.why-exists-card .why-exists-source{font-size:max(16px,1em)!important;line-height:1.45;margin:6px 0;overflow-wrap:anywhere;text-align:start}',
      '.why-exists-source a{color:inherit;text-decoration:underline}',
      'button.why-exists-btn{font:inherit;font-size:max(16px,1em)!important;color:inherit;background:transparent;border:0;padding:0 10px;min-height:44px!important;min-width:44px!important;text-decoration:underline;text-underline-offset:3px;cursor:pointer;flex:0 1 auto;white-space:normal;max-width:100%;text-align:center}',
      'p.why-exists-foot{margin:16px 0;text-align:center}',
      '.why-exists-layer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45)}',
      '.why-exists-layer[hidden]{display:none}',
      '.why-exists-card{box-sizing:border-box;width:min(34rem,100%);max-height:80vh;overflow:auto;border-radius:12px;padding:18px 18px 10px;box-shadow:0 8px 30px rgba(0,0,0,.3)}',
      '.why-exists-card h2{font-size:max(18px,1.1em);margin:0 0 6px}',
      '.why-exists-close{font:inherit;font-size:16px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:8px;min-height:44px;min-width:88px;margin:8px 0;cursor:pointer}'
    ].join('\n');
    doc.head.appendChild(st);
  }
  function solid(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var b = getComputedStyle(n).backgroundColor;
      if (b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) return b;
    }
    return '#ffffff';
  }

  // 1. inside the playlab-ui How to play card
  function inCard() {
    var host = doc.querySelector('[data-pl="howto-card"]'), card = host;
    if (!card || card.querySelector('[data-why-exists]')) return !!card;
    // Some pages put data-pl="howto-card" on the overlay around the card: use the dialog box inside it.
    if (card.getAttribute('role') !== 'dialog') card = card.querySelector('[role="dialog"]') || card;
    var startBtn = card.querySelector('[data-pl="howto-start"]');
    var d = doc.createElement('details'); d.className = 'why-exists'; d.setAttribute('data-why-exists', '');
    var s = doc.createElement('summary'); var box = doc.createElement('div');
    d.appendChild(s); d.appendChild(box);
    var refresh = function () { s.textContent = copy().sum; fill(box); };
    refresh();
    var foot = card.querySelector('.pl-howto-footer');
    if (foot && foot.parentNode === card) card.insertBefore(d, foot);
    else if (startBtn && startBtn.parentNode === card) card.insertBefore(d, startBtn);
    else card.appendChild(d);
    var layer = doc.querySelector('[data-pl="howto-layer"]') || host;
    new MutationObserver(function () { refresh(); if (layer.hidden) d.open = false; }).observe(layer, { attributes: true, attributeFilter: ['hidden', 'class'] });
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
    return true;
  }

  // 2-4. a small text button that opens a card
  var layer, card, opener;
  function close() { if (!layer || layer.hidden) return; layer.hidden = true; if (opener) opener.focus(); }
  function open(btn) {
    opener = btn;
    if (!layer) {
      layer = doc.createElement('div'); layer.className = 'why-exists-layer'; layer.hidden = true; layer.setAttribute('data-why-exists-layer', '');
      card = doc.createElement('div'); card.className = 'why-exists-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
      layer.appendChild(card);
      layer.addEventListener('click', function (e) { if (e.target === layer) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      doc.body.appendChild(layer);
    }
    var bs = getComputedStyle(doc.body);
    card.style.fontFamily = bs.fontFamily; card.style.color = bs.color; card.style.background = solid(doc.body);
    var c = copy(); card.textContent = '';
    var h = doc.createElement('h2'); h.textContent = c.sum; h.id = 'why-exists-title'; card.setAttribute('aria-labelledby', h.id); card.appendChild(h);
    var box = doc.createElement('div'); fill(box); card.appendChild(box);
    var x = doc.createElement('button'); x.type = 'button'; x.className = 'why-exists-close'; x.textContent = c.close; x.addEventListener('click', close); card.appendChild(x);
    layer.hidden = false; x.focus();
  }
  function shown(el) {
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function button() {
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'why-exists-btn'; b.setAttribute('data-why-exists', '');
    b.textContent = copy().sum;
    b.addEventListener('click', function () { open(b); });
    new MutationObserver(function () { b.textContent = copy().sum; }).observe(root, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
    return b;
  }
  function beside() {
    var re = /^(how to play|how to|help|rules|instructions|玩法|說明|規則|\?)$/i, reLabel = /how to play|help|rules|玩法|說明/i;
    var els = doc.querySelectorAll('button, a, [role="button"], summary');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if ((re.test(t) || reLabel.test(el.getAttribute('aria-label') || '')) && shown(el) && el.parentNode && !el.closest('[data-why-exists-layer]')) {
        if (el.tagName === 'SUMMARY') continue;
        el.parentNode.insertBefore(button(), el.nextSibling);
        return true;
      }
    }
    return false;
  }
  function footer() {
    var f = doc.querySelector('footer');
    if (!f || !shown(f)) return false;
    f.appendChild(button()); return true;
  }
  function end() {
    var p = doc.createElement('p'); p.className = 'why-exists-foot'; p.appendChild(button());
    var m = doc.querySelector('main');
    (m && shown(m) ? m : doc.body).appendChild(p);
    return true;
  }

  function place() {
    if (doc.querySelector('[data-why-exists]')) return;
    style();
    if (inCard()) return;
    beside() || footer() || end();
  }
  function start() {
    // Pages that build their How to play card in script do it on load; wait one beat, then place once.
    var tries = 0;
    (function wait() {
      if (doc.querySelector('[data-pl="howto-card"]') || doc.querySelector('[data-pl="topbar"]') === null && tries >= 3 || tries >= 10) return place();
      tries++; setTimeout(wait, 150);
    })();
  }
  window.__whyExists = { data: W, place: place };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
