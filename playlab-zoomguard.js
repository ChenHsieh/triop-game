/* playlab-zoomguard.js (kit 19, P1ZM00): the page never zooms by accident on a phone. Games here are played with fast taps and
 * drags, so a double tap or a stray pinch must not zoom or shrink the page.
 *  - viewport meta gets maximum-scale=1, user-scalable=no (browsers that honour it); the page's own meta should already say so.
 *  - html, body: touch-action manipulation (no double-tap zoom, no 300 ms click delay), no text-size jump on rotate.
 *  - iOS Safari ignores user-scalable: gesturestart / gesturechange (pinch) are cancelled. Double-tap zoom is off through
 *    touch-action: manipulation; taps are never cancelled, so a game's own double tap keeps working.
 * System accessibility zoom is not touched. Idempotent: loading it twice does nothing the second time. */
(function () {
  'use strict';
  if (window.__playlabZoomGuard) return;
  window.__playlabZoomGuard = 1;
  var head = document.head || document.documentElement;
  var m = document.querySelector('meta[name="viewport"]');
  var want = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; m.content = want; head.appendChild(m); }
  else if (!/user-scalable\s*=\s*(no|0)/i.test(m.content) || !/maximum-scale\s*=\s*1(\.0)?\s*(,|$)/i.test(m.content)) {
    var c = m.content.replace(/\s*,?\s*(maximum-scale|minimum-scale|user-scalable)\s*=\s*[^,]*/gi, '').replace(/^[\s,]+|[\s,]+$/g, '');
    m.content = (c ? c + ', ' : '') + 'maximum-scale=1, user-scalable=no';
  }
  var st = document.createElement('style');
  st.id = 'playlab-zoomguard';
  st.textContent = 'html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}';
  head.appendChild(st);
  var block = function (e) { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange'].forEach(function (n) { document.addEventListener(n, block, { passive: false }); });
  // No second-tap blocking: touch-action: manipulation above already turns double-tap zoom off in iOS Safari and Chrome, and a
  // handler that cancels the second touchend also kills a game's own double tap (Dynasty Guess zooms its picture on a double tap).
})();
