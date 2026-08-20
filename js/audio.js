/*
 * Synthesised cues — no audio files, so nothing to load and nothing to 404.
 *
 * Two rules from the feel reference shape what is in here:
 *
 * 1. "Every audio cue is probably an obituary." A set of cues that is only
 *    success / failure / win / lose is a scoreboard, not an instrument. The
 *    anticipatory cues — `warn` on a clock crossing, `lastChance` on the final
 *    guess — fire from a state delta *before* the outcome, which is where the
 *    urgency actually lives.
 * 2. Threshold cues fire once per downward crossing, never per tick. A sound
 *    that repeats every frame is the thing players mute the game to escape.
 */

const PREF_KEY = 'triop.sound.v1';

let ctx = null;
let master = null;
let enabled = true;

try {
  const saved = localStorage.getItem(PREF_KEY);
  if (saved !== null) enabled = saved === 'on';
} catch { /* private mode */ }

/** Browsers refuse to start audio before a gesture, so the context is lazy. */
function context() {
  if (ctx) return ctx;
  const Ctor = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null;
  if (!Ctor) return null;                     // headless, or a browser without Web Audio
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.09;                 // quiet by default; this is a puzzle game
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

/** One shaped note. `slideTo` bends the pitch across the note. */
function tone({ freq, dur = 0.09, type = 'sine', gain = 1, delay = 0, slideTo = null }) {
  const c = context();
  if (!c || !enabled) return;
  try {
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // Ramps rather than steps, or every cue arrives with a click on the front.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env); env.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* never let a cue break a turn */ }
}

const chord = (notes) => notes.forEach((n) => tone(n));

export const cue = {
  pick:  () => tone({ freq: 780, dur: 0.035, type: 'triangle', gain: 0.5 }),
  undo:  () => tone({ freq: 420, dur: 0.045, type: 'triangle', gain: 0.45 }),
  // Rejected input: dull and low, clearly not the "wrong answer" sound.
  reject: () => tone({ freq: 150, dur: 0.08, type: 'sine', gain: 0.7 }),
  hit: () => chord([
    { freq: 660, dur: 0.07, type: 'triangle' },
    { freq: 990, dur: 0.11, type: 'triangle', delay: 0.06 },
  ]),
  miss: () => tone({ freq: 240, dur: 0.16, type: 'sawtooth', gain: 0.5, slideTo: 150 }),
  step: (rising) => tone({ freq: rising ? 520 : 440, dur: 0.05, type: 'triangle', gain: 0.6 }),
  win: () => chord([
    { freq: 523, dur: 0.10, type: 'triangle', delay: 0.00 },
    { freq: 659, dur: 0.10, type: 'triangle', delay: 0.09 },
    { freq: 784, dur: 0.22, type: 'triangle', delay: 0.18 },
  ]),
  lose: () => chord([
    { freq: 330, dur: 0.12, type: 'sine', delay: 0.00 },
    { freq: 247, dur: 0.20, type: 'sine', delay: 0.11 },
  ]),
  // Anticipatory. Falling, because every other cue here says something happened.
  warn: (depth = 0) => tone({ freq: 480 - depth * 120, dur: 0.18, type: 'sine', gain: 0.6, slideTo: 300 - depth * 90 }),
  lastChance: () => chord([
    { freq: 300, dur: 0.09, type: 'square', gain: 0.35 },
    { freq: 300, dur: 0.09, type: 'square', gain: 0.35, delay: 0.14 },
  ]),
};

export const isOn = () => enabled;

export function setEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
  if (enabled) cue.pick();                    // confirm the toggle in its own medium
  return enabled;
}

/**
 * Which thresholds a falling value has just crossed downward. Pure, so the
 * once-per-crossing rule is testable rather than hoped for.
 */
export function crossedDown(prev, next, thresholds) {
  return thresholds.filter((t) => prev > t && next <= t);
}
