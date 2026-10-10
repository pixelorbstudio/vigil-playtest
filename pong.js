/* pong.js — the Pong cartridge's rules (pure; the page draws it and plays its sounds, pong-audit.js plays it at human
   speed). The court is 48 cells across and 11 rows (the tube's text cells); paddles 3 rows, yours one cell in from
   the left wall, the cpu's from the right. The rules move in ticks of TICK ms: the ball a cell across and vy rows down
   each tick; the page draws it between ticks, wherever it is, so it moves smoothly (Arnold, 2026-10-05).

   The score that counts (Arnold, 2026-10-05): your returns, every time your paddle sends the ball back, added up over
   the whole match. The match is still played to 5 points. The cart's best, M.'s, is 14 returns in one match.

   cpu: { every: it moves one tick in `every`, track: how often it moves when it can, angle: how much angle its paddle's
   edge adds to a return (1 by default), soft: how much of the ball's slant it keeps on a return (1 by default), miss: how
   often it misjudges a ball coming its way (aims a few rows off), near: the same from your nearAt-th return, missAfter:
   the same once you are past 14 }. A match is first to `to` points (TO).
   MATCH(n): the cpu and the tick for your nth match while M.'s key is still under the cart (it steadies, so everyone
   gets there; tuned with pong-audit.js). */
(function () {
  const W = 48, H = 11, PL = 3, TICK = 85, TO = 5;
  function createPong({ cpu = { every: 2, track: .85 }, to = TO, rand = Math.random } = {}) {
    const s = { to, cpuOff: 0, py: 4, cy: 4, bx: 24, by: 5, vx: 1, vy: .5, you: 0, cpu: 0, returns: 0, rally: 0, longest: 0, tick: 0, started: false, over: false };
    // a ball coming the cpu's way: now and then it misjudges where to be
    // (close to the cart's best it misjudges less, if it is set to: the rally keeps going; once you are past the best
    // it misjudges more: the match doesn't drag on after the record)
    const missRate = () => s.returns > 14 && cpu.missAfter != null ? cpu.missAfter : s.returns >= (cpu.nearAt ?? 99) && cpu.near != null ? cpu.near : cpu.miss || 0;
    const judge = () => { s.cpuOff = rand() < missRate() ? (rand() < .5 ? -1 : 1) * (3 + Math.floor(rand() * 2)) : 0; };
    function serve(dir) { if (dir > 0) judge(); s.rally = 0; s.bx = 24; s.by = 5; s.vx = dir; s.vy = (rand() < .5 ? -1 : 1) * (.35 + rand() * .3); }
    function start() { if (s.started) return; s.started = true; serve(-1); }
    // your paddle, a row at a time (the arrow keys)
    function move(d) { s.py = Math.max(0, Math.min(H - PL, s.py + d)); }
    // one tick; what happened: 'you' (you sent it back), 'cpuHit', 'point' (yours), 'missed' (the cpu's point), 'serve'
    function step() {
      const ev = [];
      if (!s.started || s.over) return ev;
      s.tick++;
      s.bx += s.vx; s.by += s.vy;
      if (s.by < 0) { s.by = -s.by; s.vy = -s.vy; } else if (s.by > H - 1) { s.by = 2 * (H - 1) - s.by; s.vy = -s.vy; }
      const byi = Math.round(s.by);
      if (s.bx === 2 && s.vx < 0 && byi >= s.py && byi < s.py + PL) { s.vx = 1; judge(); s.vy += (byi - (s.py + 1)) * .35; s.returns++; s.longest = Math.max(s.longest, ++s.rally); ev.push('you'); }
      if (s.bx === W - 3 && s.vx > 0 && byi >= s.cy && byi < s.cy + PL) { s.vx = -1; s.vy = s.vy * (cpu.soft ?? 1) + (byi - (s.cy + 1)) * .35 * (cpu.angle ?? 1); s.longest = Math.max(s.longest, ++s.rally); ev.push('cpuHit'); }
      s.vy = Math.max(-1.1, Math.min(1.1, s.vy));
      if (s.bx < 0) { s.cpu++; ev.push('missed'); serve(1); ev.push('serve'); }
      if (s.bx >= W) { s.you++; ev.push('point'); serve(-1); ev.push('serve'); }
      // the cpu follows the ball when it is coming its way, one row a move, with a little hesitation
      if (s.tick % cpu.every === 0 && s.vx > 0 && rand() < cpu.track) { const target = Math.round(s.by) - 1 + s.cpuOff; if (s.cy < target) s.cy++; else if (s.cy > target) s.cy--; }
      s.cy = Math.max(0, Math.min(H - PL, s.cy));
      if (s.you >= s.to || s.cpu >= s.to) { s.over = true; ev.push('over'); }
      return ev;
    }
    return { s, start, move, step, serve };
  }
  // The cpu eases a step each match until the sixth, and stays there; the ball never slows (Arnold, 2026-10-05: Pong is
  // fast and short, so the night has room for everything else). From the second match its paddle moves every tick, so it
  // centres the ball and adds less angle; each match it sends the ball back a little gentler (angle: how much of the
  // angle its paddle's edge would add, soft: how much of the ball's own slant it keeps). It misjudges a ball now and then
  // early in a match (those are your points, so the match is nearly won by the time you pass 14); from your tenth return
  // it keeps the rally going; past 14 it misjudges most balls, so the match wraps up. Nothing changes all at once.
  // (pong-audit.js, 2026-10-05, a match each, first to sixth: a careful player beats 14 in 42%, 97%, 100%; an average one
  // 4%, 66%, 97%, 99%; a weak one 0%, 1%, 25%, 86%, 94%, 96%, and by the sixth match every kind has beaten it. Fifteen
  // returns are 1.8 minutes of play at this speed (each is the court's width twice), so a match that beats 14 averages
  // 2.2 to 2.5 minutes, the longest about 4.) After M.'s key is found, every match is the first's.
  const EASE = { every: [2, 1, 1, 1, 1, 1], track: [.8, .85, .88, .9, .92, .94], angle: [1, .6, .25, 0, 0, 0],
    soft: [1, .8, .6, .4, .25, .15], miss: [0, .12, .1, .1, .1, .1], near: [null, .03, 0, 0, 0, 0], missAfter: [.5, .9, .9, .9, .9, .9] };
  const MATCH = n => {
    const i = Math.max(0, Math.min(5, (n | 0) - 1)), E = k => EASE[k][i];
    const cpu = { every: E('every'), track: E('track'), angle: E('angle'), soft: E('soft'), miss: E('miss'), missAfter: E('missAfter') };
    if (E('near') != null) Object.assign(cpu, { nearAt: 10, near: E('near') });
    return { cpu, tick: TICK, to: TO };
  };
  const api = { createPong, MATCH, W, H, PL, TICK, TO, BEST: 14 };
  if (typeof window !== 'undefined') window.pong = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
