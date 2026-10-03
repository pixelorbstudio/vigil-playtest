/* pause.js — the game's own clock, which can stop (design.md, "The Esc menu"). Loaded before everything else, it stands in
   for performance.now, setTimeout, setInterval and requestAnimationFrame, so every timer, wait, motion and the shift clock
   run on one game time that stops dead while the game is paused and carries on from the same frame when it resumes:
   nothing skips ahead, nothing fires late in a burst. The room keeps breathing while it is stopped (Arnold, 2026-10-03):
   the sound carries on (the hum and the rack fans are loops in the audio graph, not timers) and so do the CSS animations
   (the LEDs). The menu itself keeps the page's clock (later()).
   window.vigilTime: { pause(), resume(), paused, now(), realNow(), later(fn, ms) }. */
(function () {
  const realNow = performance.now.bind(performance);
  const nSet = window.setTimeout.bind(window), nClear = window.clearTimeout.bind(window);
  // (?timerframes: frames from a timer every 16 ms, for testing in a hidden pane, where the browser gives no frames at all)
  const timerFrames = new URLSearchParams(location.search).has('timerframes');
  const nRaf = timerFrames ? cb => nSet(() => cb(realNow()), 16) : window.requestAnimationFrame.bind(window);
  const nCaf = timerFrames ? nClear : window.cancelAnimationFrame.bind(window);
  let offset = 0, pausedAt = null;
  const now = () => (pausedAt ?? realNow()) - offset;
  performance.now = now;

  // ---- timers: each kept with its due time in game time; while paused none is armed
  const timers = new Map();
  let ids = 0;
  const arm = t => { t.native = nSet(() => fire(t), Math.max(0, t.due - now())); };
  function fire(t) {
    if (pausedAt !== null || !timers.has(t.id)) return;
    if (t.every === null) timers.delete(t.id);
    else { t.due = now() + t.every; arm(t); }
    if (typeof t.fn === 'function') t.fn(...t.args);
  }
  function add(fn, ms, args, every) {
    const t = { id: ++ids, fn, args, due: now() + Math.max(0, +ms || 0), every, native: 0 };
    timers.set(t.id, t);
    if (pausedAt === null) arm(t);
    return t.id;
  }
  function clear(id) { const t = timers.get(id); if (!t) return; nClear(t.native); timers.delete(id); }
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, null);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, Math.max(1, +ms || 0));
  window.clearTimeout = clear;
  window.clearInterval = clear;

  // ---- animation frames: a frame asked for while paused waits for the resume; callbacks get game time
  const frames = new Map();
  let fids = 0;
  const armFrame = f => { f.native = nRaf(() => { frames.delete(f.id); f.cb(now()); }); };
  window.requestAnimationFrame = cb => { const f = { id: ++fids, cb, native: 0 }; frames.set(f.id, f); if (pausedAt === null) armFrame(f); return f.id; };
  window.cancelAnimationFrame = id => { const f = frames.get(id); if (!f) return; nCaf(f.native); frames.delete(id); };

  function pause() {
    if (pausedAt !== null) return;
    pausedAt = realNow();
    for (const t of timers.values()) nClear(t.native);
    for (const f of frames.values()) nCaf(f.native);
  }
  function resume() {
    if (pausedAt === null) return;
    offset += realNow() - pausedAt;
    pausedAt = null;
    for (const t of timers.values()) arm(t);
    for (const f of frames.values()) armFrame(f);
  }
  window.vigilTime = {
    pause, resume, now, realNow,
    later: (fn, ms) => nSet(fn, ms),                     // on the page's clock, which never stops (the menu's own timing)
    get paused() { return pausedAt !== null; },
  };
})();
