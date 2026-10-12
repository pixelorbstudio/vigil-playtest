/* camera.js — the ceiling camera (design.md section 5, "The ceiling camera, decided"; Arnold, 2026-10-11): direction A,
   a ball with a big dark lens sunk into a round base, flush on the ceiling over rack-right. Pure: the drawing and the
   motion, so camera-audit.html draws and checks exactly what the page shows, frame by frame.

   The drawing. Everything is measured in millimetres in the ceiling's own camera (ceilup.js: x right, y down, z ahead,
   the eye at the origin, level), the ceiling 2,198 mm above the eye (the tube's ring, fitted to its 96 mm line, gives it:
   ceilup.js units x 2198 are mm). Every part is a convex solid of revolution, and the projection is central (every point
   on a ray from the eye lands on the same place), so a part's outline is the convex hull of its rims and its contour
   circle in a pinhole view aimed at it, sampled so no step is over 0.2 px on the screen, then put through the fitted
   lens (and a long hull edge, a straight silhouette, is cut every 0.2 px first, so the lens bends it). The base and the
   ball never move: drawn once. Only the lens, a disc on the ball, is drawn again as it turns (a few hundred points).

   The motion (all angles in degrees, from watching you: yaw round the vertical, + to its right as you see it; pitch +
   down). Inside RANGE the lens stays 6 px or more inside the ball's outline. step(state, dt, input) moves it:
   - following: the cursor's place in the frame maps onto the range (the middle is watching you, the sides the range's
     ends, the top 6 up, the bottom 12 down); a critically damped ease toward it, 3 a second (half way in about 0.4 s,
     settled in about 2, never past it), its speed capped at 25 a second, and a move of the cursor's turn under a degree
     ignored, so it is never twitchy. When the cursor stops it settles and stops.
   - patrol, after 30 s with no input: a sweep to one end of the range, a pause of 2 to 3 s, to the other end, a pause;
     now and then a tilt up or down at an end. 8 a second at the most, eased in and out.
   - a deliberate turn (a drawer opening, something forbidden taken; later the tile): it turns at 10 a second at the
     most, eased, and holds for HOLD ms of time you can see it (the page passes `seen`), then goes back to following.
     It comes before following and patrol.
   - the lens refocuses (Arnold, 2026-10-11): as a deliberate turn arrives, and at the pause at each end of a patrol sweep,
     it shrinks to FOCUS.k of its size, a beat, and comes back, eased as its turns are. Only smaller, never bigger than at
     rest (at rest the lens is already 6.11 px inside the ball's outline, at the 6 px rule's edge). Never on a steady beat:
     only at those moments (a steady pulse would read as loading; this reads as it looking). Not while it is blind (the
     page passes `blind`: night 2's hook). st.focus is the lens's scale now (1 at rest).
   - clicked (Arnold, 2026-10-11): it freezes where it is for FREEZE.ms (freeze(st)), a beat instead of following, its
     patrol or a turn paused with it, then goes back to what it was doing from a standstill. */
(function () {
  const CU = typeof window !== 'undefined' && window.ceilingUp ? window.ceilingUp : require('./ceilup.js');
  const H = 2198;                                       // mm: the ceiling above the eye
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => mul(a, 1 / (len(a) || 1));
  const basis = n => { const t = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0], u = unit(cross(n, t)); return [u, cross(n, u)]; };
  const P = p => CU.project(p);
  const STEP = .2;
  const fmt = ps => ps.map(q => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ');
  const pathOf = (ps, closed) => 'M' + fmt(ps).split(' ').join('L') + (closed ? 'Z' : '');
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round"';
  const DOWN = [0, 1, 0];

  // a curve f(t), t0..t1, sampled so consecutive screen points are STEP px apart or less (and not much less)
  function sample(f, t0, t1) {
    const pts = [], ts = [];
    let t = t0, dt = (t1 - t0) / 64, p = P(f(t0));
    pts.push(p); ts.push(t0);
    while ((t1 - t) * Math.sign(t1 - t0) > 1e-12) {
      let t2 = t + dt; if ((t2 - t1) * Math.sign(t1 - t0) > 0) t2 = t1;
      const q = P(f(t2)), d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > STEP && Math.abs(t2 - t) > 1e-12) { dt *= .5; continue; }
      pts.push(q); ts.push(t2); t = t2; p = q; if (d < STEP * .5) dt *= 1.5;
    }
    return { pts, ts };
  }
  const circle = (C, n, r) => { const [u, v] = basis(n); return a => add(C, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))); };
  const ring3 = (C, n, r) => sample(circle(C, n, r), 0, 2 * Math.PI);
  // the outline of a convex part: its hull in the pinhole view aimed at `aim`, through the lens
  function outline(pts3, aim) {
    const a = unit(aim), [e1, e2] = basis(a);
    const g = pts3.map(p => { const z = dot(p, a); return [dot(p, e1) / z, dot(p, e2) / z]; });
    const idx = g.map((_, i) => i).sort((i, j) => g[i][0] - g[j][0] || g[i][1] - g[j][1]);
    const cz = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const lo = [], up = [];
    for (const i of idx) { while (lo.length >= 2 && cz(g[lo[lo.length - 2]], g[lo[lo.length - 1]], g[i]) <= 0) lo.pop(); lo.push(i); }
    for (const i of idx.slice().reverse()) { while (up.length >= 2 && cz(g[up[up.length - 2]], g[up[up.length - 1]], g[i]) <= 0) up.pop(); up.push(i); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1)).map(i => g[i]);
    const dirOf = ([u, v]) => add(a, add(mul(e1, u), mul(e2, v)));
    const out = [];
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i], q = hull[(i + 1) % hull.length], sp = P(dirOf(p)), sq = P(dirOf(q)), n = Math.ceil(Math.hypot(sq[0] - sp[0], sq[1] - sp[1]) / STEP);
      out.push(sp);
      for (let k = 1; k < n; k++) out.push(P(dirOf([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n])));
    }
    return out;
  }

  // ---- where it hangs: the ceiling under stage (1280, 24), between the drawing's depth lines 5 and 6 (each edge about 16
  // px from one), over rack-right, inside the 4:3 frame
  const AT = [1280, 24];
  const M = (() => { const [j, k] = CU.invert(AT, [0, 4]), [X, Z] = CU.XZ(j, k); return [X * H, -H, Z * H]; })();
  const SIZE = { base: { r: 96, h: 40 }, ball: { R: 64, sink: 20 }, lens: 25, lamp: 7 };
  const S = add(M, mul(DOWN, SIZE.base.h + SIZE.ball.sink));        // the ball's centre: the lens turns on it
  const TONE = { base: '#EEEEEC', under: '#E6E6E4', ball: '#E2E2E0', lens: '#D2D2D0', lampOff: '#D2D2D0', lampOn: '#E9857C' };

  // ---- the parts that never move: the base (its band and its underside) and the ball (the part of it below the base)
  const STATIC = (() => {
    const { r, h } = SIZE.base, c0 = M, c1 = add(M, mul(DOWN, h));
    const R0 = ring3(c0, DOWN, r), R1 = ring3(c1, DOWN, r), f0 = circle(c0, DOWN, r), f1 = circle(c1, DOWN, r);
    const base = outline([...R0.ts.map(f0), ...R1.ts.map(f1)], add(c0, mul(DOWN, h / 2)));
    // the ball: the sphere below the base's underside; its outline is its rim there and its contour circle (where the line
    // of sight grazes it), the part of that below the underside
    const { R, sink } = SIZE.ball, rc = add(S, mul(DOWN, -sink)), rr = Math.sqrt(R * R - sink * sink), Rg = ring3(rc, DOWN, rr), fr = circle(rc, DOWN, rr);
    const s2 = dot(S, S), cc = mul(S, 1 - R * R / s2), cr = R * Math.sqrt(1 - R * R / s2), fc = circle(cc, unit(S), cr), C = sample(fc, 0, 2 * Math.PI);
    const ballPts = [...Rg.ts.map(fr), ...C.ts.map(fc).filter(p => dot(sub(p, S), DOWN) >= -sink)];
    const ball = outline(ballPts, S);
    // the lamp: a dot on the base's band where it faces you, half way down it
    const ax = add(M, mul(DOWN, h / 2)), toEye = unit([-ax[0], 0, -ax[2]]), lamp = ring3(add(ax, mul(toEye, r)), toEye, SIZE.lamp).pts;
    return { base, under: R1.pts, ball, lamp };
  })();

  // ---- turns: [yaw, pitch] from watching you, to a direction from the ball's centre, and back
  const RANGE = { yaw: 18, up: 6, down: 16 };
  const rad = Math.PI / 180;
  const D0 = unit(mul(S, -1)), HAX = unit(cross(DOWN, D0));           // watching you; the horizontal across the line of sight
  const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
  const rotAx = (v, k, a) => add(add(mul(v, Math.cos(a)), mul(cross(k, v), Math.sin(a))), mul(k, dot(k, v) * (1 - Math.cos(a))));
  // (HAX x D0 points up, so a turn of + pitch down is - about HAX)
  const dirOf = ([yaw, pitch]) => unit(rotY(rotAx(D0, HAX, -pitch * rad), -yaw * rad));
  const yawOf = v => Math.atan2(v[0], v[2]);
  // a point in the room (mm) to the turn toward it, kept within the range
  function turnTo(point) {
    const d = unit(sub(point, S));
    let yaw = -(yawOf(d) - yawOf(D0)) / rad; yaw = ((yaw + 540) % 360) - 180;
    return clampAng([yaw, (Math.asin(d[1]) - Math.asin(D0[1])) / rad]);
  }
  const clampAng = ([yaw, pitch]) => [Math.max(-RANGE.yaw, Math.min(RANGE.yaw, yaw)), Math.max(-RANGE.up, Math.min(RANGE.down, pitch))];
  // the cursor, as u, v from -1 to 1 across the window, onto the range
  const cursorTurn = (u, v) => { u = Math.max(-1, Math.min(1, u)); v = Math.max(-1, Math.min(1, v)); return [u * RANGE.yaw, v < 0 ? v * RANGE.up : v * RANGE.down * .75]; };

  // ---- what it turns to (mm in the ceiling camera's space). The drawers are where the room's camera puts their fronts
  // (drawer.js: a point (x, y) of the desk's front, at the apron, is ((x - 720) / 1.5, (y - 813) / 1.5, 1000) camera units
  // of 1.765 mm): the cartridge drawer under the keyboard, the right pedestal's three (the cheat sheet's, M.'s, the file
  // drawer). The tile on night 2: the ceiling under stage (789, -247) (app.js TILE_AT), past the range: it gets as far as
  // the range goes.
  const front = (x, y) => [(x - 720) / 1.5 * 1.765, (y - 813) / 1.5 * 1.765, 1765];
  const TARGETS = {
    you: [0, 0, 0],
    cartridges: front(720, 1407), sheet: front(1360, 1407), mdrawer: front(1360, 1565), file: front(1360, 1830),
    tile: (() => { const [j, k] = CU.invert([789, -247], [0, 2]), [X, Z] = CU.XZ(j, k); return [X * H, -H, Z * H]; })(),
  };

  // ---- the drawing at a turn: the static parts and the lens (and the lamp's colour)
  // (f: the lens's scale, its refocus: a smaller disc on the same ball)
  function lensRing(ang, f = 1) {
    const w = dirOf(ang), al = Math.asin(f * SIZE.lens / SIZE.ball.R), C = add(S, mul(w, SIZE.ball.R * Math.cos(al)));
    return ring3(C, w, SIZE.ball.R * Math.sin(al)).pts;
  }
  const lineOf = ps => `<path d="${pathOf(ps, true)}" fill="none" ${INK}/>`;
  const STATIC_SVG = `<polygon points="${fmt(STATIC.base)}" fill="${TONE.base}"/><polygon points="${fmt(STATIC.under)}" fill="${TONE.under}"/>`
    + lineOf(STATIC.base) + lineOf(STATIC.under);
  const BALL_SVG = `<polygon points="${fmt(STATIC.ball)}" fill="${TONE.ball}"/>` + lineOf(STATIC.ball);
  const lampSvg = on => `<polygon class="cam-lamp" points="${fmt(STATIC.lamp)}" fill="${on ? TONE.lampOn : TONE.lampOff}" stroke="#B4B4B4" stroke-width=".7" stroke-linejoin="round"/>`;
  const lensSvg = (ang, f = 1) => { const r = lensRing(ang, f); return `<polygon points="${fmt(r)}" fill="${TONE.lens}"/>` + lineOf(r); };
  // the whole camera (the page keeps the parts apart and redraws only the lens)
  const svg = (ang = [0, 0], lamp = false, f = 1) => STATIC_SVG + lampSvg(lamp) + BALL_SVG + lensSvg(ang, f);
  // where the lens's middle is on the screen (for the audit's pops and the page's tests)
  const lensAt = ang => P(add(S, mul(dirOf(ang), SIZE.ball.R)));

  // ---- the motion
  const FOLLOW = { w: 3, max: 25, dead: 1, rest: .02 };
  const PATROL = { idle: 30000, speed: 8, pause: [2000, 3000], tilt: 1 / 3, pitch: 4 };
  const TURN = { speed: 10, hold: 3000 };
  const FOCUS = { k: .85, in: 380, hold: 260, out: 420 };   // (ms: shrinking, the beat, coming back)
  const FREEZE = { ms: 1200 };                              // (a click on it: it stops dead for a beat)
  const ease = u => .5 - .5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
  // a glide from a to b: eased, its duration from the distance at a top speed (an eased glide's peak is pi/2 its mean)
  const glide = (a, b, speed) => ({ from: a.slice(), to: b.slice(), t: 0, ms: Math.max(400, Math.hypot(b[0] - a[0], b[1] - a[1]) / speed * 1000 * Math.PI / 2) });
  function create(seed = 1) {
    return { ang: [0, 0], vel: [0, 0], speed: 0, mode: 'follow', want: [0, 0], move: null, held: 0, patrol: null, rnd: seed, focus: 1, refocus: null, frozen: 0 };
  }
  // the lens's scale t ms into a refocus (1 when it is over)
  function focusAt(t) {
    const { k, in: a, hold: h, out: b } = FOCUS;
    if (t <= 0 || t >= a + h + b) return 1;
    if (t < a) return 1 - (1 - k) * ease(t / a);
    if (t < a + h) return k;
    return k + (1 - k) * ease((t - a - h) / b);
  }
  // a refocus begins (one at a time; not while blind)
  const refocus = (st, input) => { if (!input.blind && !st.refocus) st.refocus = { t: 0 }; };
  const rand = st => (st.rnd = (st.rnd * 16807) % 2147483647) / 2147483647;
  // deliberate: turn to a point (or a turn) and hold
  function deliberate(st, to) {
    const t = Array.isArray(to) && to.length === 2 ? clampAng(to) : turnTo(to);
    st.mode = 'turn'; st.move = glide(st.ang, t, TURN.speed); st.held = 0; st.patrol = null;
  }
  // a click on it: it stops where it is for a beat (again from the start of the beat if clicked again meanwhile)
  const freeze = st => { st.frozen = FREEZE.ms; st.vel = [0, 0]; };
  // input: { u, v (the cursor), idleMs (since the last input), seen (the camera can be seen: looking ahead) }
  function step(st, dt, input) {
    const before = st.ang.slice();
    if (st.frozen > 0) { st.frozen = Math.max(0, st.frozen - dt); st.vel = [0, 0]; st.speed = 0; return st; }
    if (st.mode === 'turn') {
      const m = st.move;
      m.t = Math.min(m.ms, m.t + dt);
      const k = ease(m.t / m.ms); st.ang = [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k];
      if (m.t >= m.ms && !m.arrived) { m.arrived = true; refocus(st, input); }   // (it arrives: it looks)
      if (m.t >= m.ms && input.seen) st.held += dt;
      if (st.held >= TURN.hold) { st.mode = 'follow'; st.vel = [0, 0]; st.move = null; }
    } else if (st.mode === 'follow' && input.idleMs >= PATROL.idle) {
      st.mode = 'patrol'; st.patrol = { leg: null, pause: 0, side: st.ang[0] <= 0 ? 1 : -1 };
    } else if (st.mode === 'patrol' && input.idleMs < PATROL.idle) {
      st.mode = 'follow'; st.vel = [0, 0]; st.patrol = null;
    }
    if (st.mode === 'patrol') {
      const p = st.patrol;
      if (p.pause > 0) p.pause -= dt;
      else if (!p.leg) {
        // the next leg: to the other end, at the patrol's pitch; now and then, at an end, a tilt up or down first
        const atEnd = Math.abs(Math.abs(st.ang[0]) - RANGE.yaw) < .5;
        let to;
        if (atEnd && !p.tilted && rand(st) < PATROL.tilt) { to = [st.ang[0], rand(st) < .5 ? -RANGE.up : RANGE.down * .75]; p.tilted = true; }
        else { to = [p.side * RANGE.yaw, PATROL.pitch]; p.side = -p.side; p.tilted = false; }
        p.leg = glide(st.ang, to, PATROL.speed);
      } else {
        const m = p.leg;
        m.t = Math.min(m.ms, m.t + dt);
        const k = ease(m.t / m.ms); st.ang = [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k];
        if (m.t >= m.ms) { p.leg = null; p.pause = PATROL.pause[0] + rand(st) * (PATROL.pause[1] - PATROL.pause[0]); refocus(st, input); }   // (at the end's pause: it looks)
      }
    }
    if (st.mode === 'follow') {
      const t = cursorTurn(input.u, input.v);
      if (Math.hypot(t[0] - st.want[0], t[1] - st.want[1]) >= FOLLOW.dead) st.want = t;
      // a critically damped spring toward what it wants, in small steps; its speed capped
      let left = dt / 1000;
      while (left > 0) {
        const h = Math.min(left, 1 / 240); left -= h;
        const w = FOLLOW.w;
        for (const i of [0, 1]) st.vel[i] += (w * w * (st.want[i] - st.ang[i]) - 2 * w * st.vel[i]) * h;
        const sp = Math.hypot(st.vel[0], st.vel[1]); if (sp > FOLLOW.max) st.vel = st.vel.map(v => v * FOLLOW.max / sp);
        for (const i of [0, 1]) st.ang[i] += st.vel[i] * h;
      }
      if (Math.hypot(st.want[0] - st.ang[0], st.want[1] - st.ang[1]) < FOLLOW.rest && Math.hypot(...st.vel) < .05) { st.ang = st.want.slice(); st.vel = [0, 0]; }
    }
    // the refocus runs on (and stops dead if it goes blind meanwhile)
    if (st.refocus) { if (input.blind) st.refocus = null; else { st.refocus.t += dt; if (st.refocus.t >= FOCUS.in + FOCUS.hold + FOCUS.out) st.refocus = null; } }
    st.focus = st.refocus ? focusAt(st.refocus.t) : 1;
    st.ang = clampAng(st.ang);
    st.speed = dt > 0 ? Math.hypot(st.ang[0] - before[0], st.ang[1] - before[1]) / (dt / 1000) : 0;
    return st;
  }

  const api = { H, AT, M, S, SIZE, TONE, RANGE, TARGETS, STATIC, svg, STATIC_SVG, BALL_SVG, lampSvg, lensSvg, lensRing, lensAt, dirOf, turnTo, clampAng, cursorTurn,
    FOLLOW, PATROL, TURN, FOCUS, FREEZE, focusAt, create, step, deliberate, freeze, outline, sample, fmt, pathOf };
  if (typeof window !== 'undefined') window.ceilingCamera = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
