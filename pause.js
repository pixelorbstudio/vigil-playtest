/* pause.js — the room's own clock, which can stop (design.md, "The Esc menu"). Loaded before everything else, it stands in
   for performance.now, setTimeout, setInterval and requestAnimationFrame, so every timer, wait, motion and the shift clock
   run on one game time that stops dead while the game is paused and carries on from the same frame when it resumes:
   nothing skips ahead, nothing fires late in a burst. CSS animations and transitions are paused with it, and the audio
   context is suspended (sounds already playing hold mid-note). The page itself (the menu) keeps the real clock.
   window.vigilTime: { pause(), resume(), paused, now(), realNow(), later(fn, ms), audio(ctx) }. */
(function () {
  const realNow = performance.now.bind(performance);
  const nSet = window.setTimeout.bind(window), nClear = window.clearTimeout.bind(window);
  const nRaf = window.requestAnimationFrame.bind(window), nCaf = window.cancelAnimationFrame.bind(window);
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

  // ---- pausing: the clocks stop; CSS animations and transitions under way stop where they are; the audio holds
  let held = [];
  const contexts = new Set();
  function pause() {
    if (pausedAt !== null) return;
    pausedAt = realNow();
    for (const t of timers.values()) nClear(t.native);
    for (const f of frames.values()) nCaf(f.native);
    held = document.getAnimations ? document.getAnimations().filter(a => a.playState === 'running') : [];
    for (const a of held) a.pause();
    for (const c of contexts) if (c.state === 'running') c.suspend();
  }
  function resume() {
    if (pausedAt === null) return;
    offset += realNow() - pausedAt;
    pausedAt = null;
    for (const a of held) { try { a.play(); } catch (e) {} }
    held = [];
    for (const c of contexts) if (c.state === 'suspended') c.resume();
    for (const t of timers.values()) arm(t);
    for (const f of frames.values()) armFrame(f);
  }
  window.vigilTime = {
    pause, resume, now, realNow,
    later: (fn, ms) => nSet(fn, ms),                     // on the page's clock, which never stops (the menu's own timing)
    get paused() { return pausedAt !== null; },
    // an audio context that holds while paused (the room's; the menu has its own, so a switch can be heard while paused)
    audio(ctx) { contexts.add(ctx); return ctx; },
  };
})();
