/* pong.js — the Pong cartridge's rules (pure; the page draws it and plays its sounds, pong-audit.js plays it at human
   speed). The court is 48 cells across and 11 rows (the tube's text cells); paddles 3 rows, yours one cell in from
   the left wall, the cpu's from the right. The rules move in ticks of TICK ms: the ball a cell across and vy rows down
   each tick; the page draws it between ticks, wherever it is, so it moves smoothly (Arnold, 2026-10-05).

   The score that counts (Arnold, 2026-10-05): your returns, every time your paddle sends the ball back, added up over
   the whole match. The match is still played to 5 points. The cart's best, M.'s, is 14 returns in one match.

   cpu: { every: it moves one tick in `every`, track: how often it moves when it can, angle: how much angle its paddle's
   edge adds to a return (1 by default), soft: how much of the ball's slant it keeps on a return (1 by default), miss: how
   often it misjudges a ball coming its way (aims a few rows off), near: the same from your nearAt-th return, missAfter:
   the same once you are past 14, strange: plays for you (below), bend: how hard the ball is bent toward your paddle, a
   tick }. A match is first to `to` points (TO); record: the match ends the moment your returns pass it ('record').
   MATCH(n): your nth match while M.'s key is still under the cart (playtest round 4, Arnold, 2026-10-10): the first is
   an honest one; from the second the cpu plays strangely, as if someone on the other side wants you to win; either ends
   the moment your returns pass M.'s 14. AFTER: every match once the key is out, honest again, first to 5. */
(function () {
  const W = 48, H = 11, PL = 3, TICK = 85, TO = 5;
  function createPong({ cpu = { every: 2, track: .85 }, to = TO, record = null, rand = Math.random } = {}) {
    const s = { to, record, cpuOff: 0, py: 4, cy: 4, bx: 24, by: 5, vx: 1, vy: .5, you: 0, cpu: 0, returns: 0, rally: 0, longest: 0, tick: 0, started: false, over: false };
    // a ball coming the cpu's way: now and then it misjudges where to be
    // (close to the cart's best it misjudges less, if it is set to: the rally keeps going; once you are past the best
    // it misjudges more: the match doesn't drag on after the record)
    const missRate = () => s.returns > 14 && cpu.missAfter != null ? cpu.missAfter : s.returns >= (cpu.nearAt ?? 99) && cpu.near != null ? cpu.near : cpu.miss || 0;
    const judge = () => { s.cpuOff = !cpu.strange && rand() < missRate() ? (rand() < .5 ? -1 : 1) * (3 + Math.floor(rand() * 2)) : 0; };
    // (the strange cpu: every serve comes to you)
    function serve(dir) { if (cpu.strange) dir = -1; if (dir > 0) judge(); s.rally = 0; s.bx = 24; s.by = 5; s.vx = dir; s.vy = (rand() < .5 ? -1 : 1) * (.35 + rand() * .3); }
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
      // The strange cpu (Arnold, 2026-10-10: noticeably, not hidden): on its way to you the ball bends toward the middle
      // of your paddle, wherever you move it, a little more each tick (bend), so it curves in flight as no ball should
      if (cpu.strange && s.vx < 0 && s.bx > 2) { const need = (s.py + 1 - s.by) / (s.bx - 2), b = cpu.bend ?? .07; s.vy += Math.max(-b, Math.min(b, need - s.vy)); }
      const byi = Math.round(s.by);
      if (s.bx === 2 && s.vx < 0 && byi >= s.py && byi < s.py + PL) {
        s.vx = 1; judge(); s.vy += (byi - (s.py + 1)) * .35; s.returns++; s.longest = Math.max(s.longest, ++s.rally); ev.push('you');
        // the record ends the match: the moment your returns pass it, nothing more is played
        if (s.record != null && s.returns > s.record) { s.vy = Math.max(-1.1, Math.min(1.1, s.vy)); s.over = true; s.broke = true; ev.push('record', 'over'); return ev; }
      }
      if (s.bx === W - 3 && s.vx > 0 && byi >= s.cy && byi < s.cy + PL) {
        // (the strange cpu returns it as any would, and then it bends: see above)
        s.vx = -1; s.vy = s.vy * (cpu.soft ?? 1) + (byi - (s.cy + 1)) * .35 * (cpu.angle ?? 1); s.longest = Math.max(s.longest, ++s.rally); ev.push('cpuHit');
      }
      s.vy = Math.max(-1.1, Math.min(1.1, s.vy));
      if (s.bx < 0) { s.cpu++; ev.push('missed'); serve(1); ev.push('serve'); }
      if (s.bx >= W) { s.you++; ev.push('point'); serve(-1); ev.push('serve'); }
      // the cpu follows the ball when it is coming its way, one row a move, with a little hesitation
      if (s.tick % cpu.every === 0 && s.vx > 0 && (cpu.strange || rand() < cpu.track)) { const target = Math.round(s.by) - 1 + s.cpuOff; if (s.cy < target) s.cy++; else if (s.cy > target) s.cy--; }
      s.cy = Math.max(0, Math.min(H - PL, s.cy));
      if (s.you >= s.to || s.cpu >= s.to) { s.over = true; ev.push('over'); }
      return ev;
    }
    return { s, start, move, step, serve };
  }
  // The chase for M.'s 14 (playtest round 4, Arnold, 2026-10-10; it replaces the six-step easing and decision 13's
  // honest cpu after the first match). The first match is an honest one: the cpu's first match as it always was (its
  // paddle every other tick, the full angle off its edge, never a misjudged ball). From the second, while the key is still
  // under the cart, the cpu plays strangely, as if someone on the other side wants you to win: it serves every ball to you,
  // its paddle is always there, and every return bends in flight to meet your paddle, wherever you move it.
  // Its points don't end the match (`to` 99); the match ends the moment your returns pass 14, so it stays short. Once the
  // key is out, every match is the honest first one again, first to 5. (pong-audit.js: the numbers in design.md.)
  const HONEST = { every: 2, track: .8, angle: 1, soft: 1, miss: 0 };
  const STRANGE = { every: 1, track: 1, strange: true, bend: .07 };
  const MATCH = n => (n | 0) <= 1 ? { cpu: HONEST, tick: TICK, to: TO, record: 14 } : { cpu: STRANGE, tick: TICK, to: 99, record: 14 };
  const AFTER = { cpu: HONEST, tick: TICK, to: TO, record: null };
  const api = { createPong, MATCH, AFTER, HONEST, STRANGE, W, H, PL, TICK, TO, BEST: 14 };
  if (typeof window !== 'undefined') window.pong = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
