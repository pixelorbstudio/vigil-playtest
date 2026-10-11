/* strap.js — the cartridge strap, direction A (approved by Arnold, 2026-10-10; design.md "The cartridge straps"): its
   model, and its drawing (draw(), at the end), which drawer.js render() calls for each recess in the page and in
   strap-stills.js; audit-strap.js checks the model. The 3D study (strap-study.html, kept out of git) ran the same model.

   Millimetres, for one recess: x across from its centre line (+ right), z back from its near edge (+ away from you), h up
   from the case's top. The strap's shape and motion are worked in the (x, h) plane at the strap's depth; the webbing
   spans z W0 to W1. A unit of drawer.js's u is 682.5 mm, of v 129.43 mm, of d 1765 mm.

   What it is: woven webbing over each cartridge's near end, folded softly round both of its long edges. On the right it
   runs down a long ramp across a steel plate set in the rim and into a slot (the reel and its spring are under the
   plate); on the left it dives into a divot, a pocket cut into the rim at the recess's edge, where the case's electric
   catch holds its latch plate through the window. Released, the latch plate springs straight up out of the divot, tips
   over toward the reel, is dragged across the cartridge, tips over its right edge, slides down the ramp and stops,
   lying flat on the steel plate against the slot's lip. */
(function () {
  // the case and the cartridge, from drawer.js (a px at the drawer's mouth is 1.765 / 1.5 mm)
  const XC = 50.01, XR = 52.37, PROUD = 5.53, RDEPTH = 42.36;   // half the cartridge, half the recess, how proud it stands, the recess's depth
  const DR = { halfIn: 333.05 };                                // half the drawer's inside width
  // the webbing: 32 mm wide, across the sticker's near edge (z 39), clear of the cap's edge and of the name
  const W0 = 29, W1 = 61, WT = 1.4;
  // the latch plate: necked to the webbing's width at its ferrule, then 48 mm across, its window 16 with 16 either side
  // (along the cartridge the back row shows 0.4 px a mm, so 6 px there is 15 mm)
  const BZ0 = W0 - 8, BZ1 = W1 + 8;
  const M6 = 7.2;                                               // a margin across: 6 px at the back row with room to spare
  // the case's seven places (drawer.js PLACES, Arnold 2026-10-11): the front row of four, the back row of three centred
  // under it, half a pitch right; the seventh empty from night 1, its strap released. NAMES slot by slot; PLACES [column, row]
  const NAMES = ['PONG', 'DEFRAG', 'ROUTE', 'HEAP', 'FIREWALL', 'POWER', null];
  const PLACES = [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1]];

  /* The case's layout for it: the rim between recesses is 58 mm (40 as built), the widest the drawer holds once the
     outermost hardware keeps 7.5 mm from the drawer's side walls (the case's edge along a wall is then 6.4 px from it at
     the back row, measured through the camera). The row is laid out wall to wall: the first divot 7.5 mm from the left
     wall, the last steel plate 7.5 mm from the right. */
  const WALLM = 7.5;
  const RIM = (2 * DR.halfIn - 8 * XR - 2 * WALLM) / 4;        // 58.04
  const PITCH = 2 * XR + RIM;
  // the steel plate and the divot run from the recess's near edge (their near edges carry on its line) to 31 mm past the
  // webbing: the webbing's far edge, up on the cartridge, looks 5 px nearer them than it is
  const PZ1 = W1 + 31;
  const DIV = { d: 7.5, z0: 0, z1: PZ1 };                       // the divot: 7.5 mm into the rim at the recess's left edge
  // each recess's centre line, from the drawer's centre line
  const colX = c => -DR.halfIn + WALLM + DIV.d + XR + c * PITCH;
  // the receiver: the steel plate runs the rim's width, from the recess's edge to the next divot (so its ends add no lines
  // of their own), its slot (the webbing's width, M6 wide) M6 from its far end; the latch plate's length is what is left
  // beside the slot, its nose 8.4 mm from the plate's near end (7.2 was 5.9 px at the back row)
  function hardware() {
    const px0 = XR, px1 = XR + RIM - DIV.d, sx1 = px1 - M6, sx0 = sx1 - M6;
    const ferrule = 4, B = Math.max(3, sx0 - ferrule - (px0 + M6 + 1.2));
    return { px0, px1, pz0: 0, pz1: PZ1, sx0, sx1, sxw: sx0 + 1.6, ferrule, B, window: B >= 3 * M6 };
  }

  // a polyline with round fillets at its corners: radius rs[i] at corner i (clamped to fit), a point every 0.35 mm and
  // every 3 degrees (a fold squeezed tight by a short end stays round)
  function fillet(cs, rs, step = 0.35) {
    const out = [cs[0]];
    for (let i = 1; i < cs.length - 1; i++) {
      const p = cs[i - 1], c = cs[i], q = cs[i + 1], r = rs[i] || 0;
      const ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-6 || lb < 1e-6) continue;
      const a = [ax / la, ay / la], b = [bx / lb, by / lb], cr = a[0] * b[1] - a[1] * b[0], th = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
      if (r <= 0 || th < 1e-3) { out.push(c); continue; }
      let t = r * Math.tan(th / 2), rr = r; const tmax = Math.min(la, lb) * 0.49; if (t > tmax) { t = tmax; rr = t / Math.tan(th / 2); }
      const s = Math.sign(cr), t1 = [c[0] - a[0] * t, c[1] - a[1] * t], nrm = [-a[1] * s, a[0] * s], ctr = [t1[0] + nrm[0] * rr, t1[1] + nrm[1] * rr];
      const a0 = Math.atan2(t1[1] - ctr[1], t1[0] - ctr[0]), n = Math.max(2, Math.ceil(th * rr / step), Math.ceil(th / (3 * Math.PI / 180)));
      for (let k = 0; k <= n; k++) { const g = a0 + s * th * k / n; out.push([ctr[0] + rr * Math.cos(g), ctr[1] + rr * Math.sin(g)]); }
    }
    out.push(cs[cs.length - 1]);
    return out;
  }

  /* The release, as one journey (1.7 s). The reel draws the strap home, so the ferrule (E, the webbing's end) travels one
     route: straight up out of the divot until the blade's tip is 3 mm clear of the cartridge's top (it can't turn while
     any of it is still in the divot: that is the spring's pop), over sideways and down onto the cartridge on an S curve
     (level at both ends, so its path has no corner), across the top, round the right edge, down the line of the ramp,
     and it stops at the slot's lip. sigma, the distance along that route, starts at twice the mean speed (the spring and
     the reel) and arrives softly by t 0.9. The latch plate is never keyframed: its angle is simulated (hangTable). The
     strap is taut: from the slot, over the right edge while the ferrule is short of it, over the left edge while the
     ferrule is still in the divot. */
  const EDGE_R = 1.6;                                           // the cartridge's long edges are rounded 1.6 mm
  const FOLD = EDGE_R + WT / 2;                                 // so the webbing folds round them on 2.3 mm
  const FER = 1.1, BLADE = 0.75;                                // half thicknesses: the ferrule (it fits the 2.36 mm gap), the blade
  // strapped: the latch plate stands against the divot's steel liner (0.8 mm), the catch's tooth through its window, its
  // ferrule just under the mouth
  const LATCHED = [-(XR + DIV.d) + 0.8 + FER, -1.5];
  function route(H) {
    const pts = [], add = p => { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) pts.push(p); };
    const xg = LATCHED[0], onTop = PROUD + FER;
    const arcPts = (cx, cy, r, a0, a1) => { const n = Math.ceil(Math.abs(a1 - a0) * r / 0.1); for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; add([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    const up = PROUD + H.ferrule + H.B + 3, tipR = up - onTop;
    for (let h = LATCHED[1]; h < up; h += 0.1) add([xg, h]);
    const landX = xg + 2 * tipR, P = [[xg, up], [xg + tipR, up], [xg + tipR, onTop], [landX, onTop]];
    for (let k = 1, n = Math.ceil(3 * tipR / 0.1); k <= n; k++) { const u = k / n, v = 1 - u; add([0, 1].map(i => v * v * v * P[0][i] + 3 * v * v * u * P[1][i] + 3 * v * u * u * P[2][i] + u * u * u * P[3][i])); }
    const end = [H.sx0, 0.45 + FER];                            // at rest: on the plate (0.45 thick), against the slot's lip
    const rc = [XC + 0.75 - 2.8, onTop - 2.8];
    let a1 = Math.PI / 2;
    for (let k = 0; k < 4; k++) { const ex = rc[0] + 2.8 * Math.cos(a1), ey = rc[1] + 2.8 * Math.sin(a1); a1 = Math.atan2(end[1] - ey, end[0] - ex) + Math.PI / 2; }
    for (let x = landX; x < rc[0]; x += 0.1) add([x, onTop]);
    arcPts(rc[0], rc[1], 2.8, Math.PI / 2, a1);
    const ex = pts[pts.length - 1], n = Math.ceil(Math.hypot(end[0] - ex[0], end[1] - ex[1]) / 0.1);
    for (let k = 1; k <= n; k++) add([ex[0] + (end[0] - ex[0]) * k / n, ex[1] + (end[1] - ex[1]) * k / n]);
    const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, acc, L: acc[acc.length - 1] };
  }
  function along(R, s) {
    s = Math.max(0, Math.min(R.L, s)); let lo = 0, hi = R.acc.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.acc[m] <= s) lo = m; else hi = m; }
    const u = (s - R.acc[lo]) / ((R.acc[hi] - R.acc[lo]) || 1), a = R.pts[lo], b = R.pts[hi];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  const eAt = (R, t) => { const u = Math.min(1, t / 0.9); return along(R, R.L * (1 - (1 - u) * (1 - u))); };
  // what the latch plate can rest on, across this recess, as a height
  function ground(x, H) {
    if (x > -XC && x < XC) return PROUD;
    if (Math.abs(x) >= XC && Math.abs(x) <= XR) return -RDEPTH;          // the gaps either side of the cartridge
    if (x >= -XR - DIV.d && x <= -XR) return -RDEPTH;                    // its divot
    if (x >= XR + RIM - DIV.d && x <= XR + RIM) return -RDEPTH;           // the next recess's divot
    if (x >= H.sx0 && x <= H.sx1) return -RDEPTH;                        // the slot
    if (x >= H.px0 && x <= H.px1) return 0.45;                           // the steel plate
    if (x < -(XR + RIM) || x > XR + RIM) return -RDEPTH;                 // the next recesses
    return 0;                                                            // the rim
  }
  // whether the latch plate fits at angle a (0 lying flat behind the ferrule, pi/2 hanging straight down): both its
  // faces clear of everything, checked every 0.1 mm along it
  function fits(E, a, H) {
    const len = H.ferrule + H.B, n = Math.ceil(len / 0.1), dx = -Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;
    for (let k = 0; k <= n; k++) {
      const s = len * k / n, half = s < H.ferrule ? FER : BLADE, x = E[0] + dx * s, y = E[1] + dy * s;
      for (const sg of [-1, 1]) { const px = x + sg * nx * half, py = y + sg * ny * half; if (py < ground(px, H) - 1e-3) return false; }
    }
    return true;
  }
  // its angle through the release, simulated in 1200 steps from strapped (hanging in the divot) to the ferrule's stop: each
  // step it is pushed only as far as it must be to stay clear (to the nearest angle that fits), and otherwise falls toward
  // hanging by at most 1 degree a step, never through anything, so it can only ever swing, never jump past an obstacle
  const routes = new Map(), hangs = new Map();
  function hangTable(H, R) {
    const key = H.sx0 + ':' + H.px0; if (hangs.has(key)) return hangs.get(key);
    const N = 1200, tab = new Float32Array(N + 1), step = 0.25 * Math.PI / 180;
    let a = Math.PI / 2;
    for (let k = 0; k <= N; k++) {
      const E = eAt(R, 0.9 * k / N);
      if (!fits(E, a, H)) {
        let found = null;
        for (let d = step; d <= Math.PI && found === null; d += step) { if (a - d >= -1.4 && fits(E, a - d, H)) found = a - d; else if (a + d <= Math.PI / 2 && fits(E, a + d, H)) found = a + d; }
        if (found !== null) a = found;
      }
      for (let d = 0; d < 4 && a + step <= Math.PI / 2 && fits(E, a + step, H); d++) a += step;
      tab[k] = a;
    }
    hangs.set(key, tab); return tab;
  }
  /* the strap at release time t (0 strapped, 1 at rest; tug, mm, lifts it with its cartridge when a strapped one is
     clicked): the webbing's centre line in (x, h) from deep in the slot to the ferrule (path), the ferrule (E), and which
     way the latch plate points from it (phi). At the end the latch plate slaps down flat and bounces once, a little. */
  function pose({ H = hardware(), t, tug = 0 }) {
    const top = PROUD + WT / 2 + tug, mouth = [H.sxw, 0.6], deep = [H.sxw, -16];
    const key = H.sx0 + ':' + H.px0; if (!routes.has(key)) routes.set(key, route(H)); const R = routes.get(key);
    const E = t <= 0 ? LATCHED.slice() : eAt(R, t);
    const rightCorner = [XC + 0.7, top], leftCorner = [-XC - 0.7, top];
    const cs = [deep, mouth], rs = [0, 1.6];
    if (E[0] < -XC && E[1] < top - 0.3) { cs.push(rightCorner, leftCorner); rs.push(FOLD, FOLD); }
    else if (E[0] < XC + 0.7) { cs.push(rightCorner); rs.push(FOLD); }
    cs.push(E); rs.push(0);
    const path = fillet(cs, rs);
    const tab = hangTable(H, R), kf = Math.min(1, t / 0.9) * (tab.length - 1), k0 = Math.floor(kf), k1 = Math.min(tab.length - 1, k0 + 1);
    let alpha = t <= 0 ? Math.PI / 2 : tab[k0] + (tab[k1] - tab[k0]) * (kf - k0);
    if (t > 0.9) { const v = (t - 0.9) / 0.1; alpha -= 0.09 * Math.exp(-4 * v) * Math.abs(Math.sin(v * Math.PI * 1.6)); }
    return { path, E, phi: Math.atan2(-Math.sin(alpha), -Math.cos(alpha)) };
  }
  // the timings: the release (ms, one t from 0 to 1) and the tug a strapped cartridge gives when it is clicked
  // the tug (Arnold, 2026-10-10: it was one 1.3 mm lift, 1.5 px, too small to see; now it rattles against its strap, as the
  // locked file drawer rattles in place): two quick pulls, the strap stopping each, 3 mm (3.4 px at the front row) and half
  // that. TAUT: when each pull meets the strap (the sound comes then), as fractions of the tug
  const TIMES = { release: 1700, tug: { ms: 420, mm: 3, taut: [.2, .6] } };
  const tugAt = u => u >= 1 || u <= 0 ? 0 : u < .4 ? TIMES.tug.mm * Math.sin(Math.PI * u / .4) : u < .8 ? .5 * TIMES.tug.mm * Math.sin(Math.PI * (u - .4) / .4) : 0;

  /* ---- the strap in the drawing's language, through drawer.js's camera (moved here from strap-stills.js, the approved
     stills, 2026-10-10: the page and the stills draw the same thing). drawer.js render() calls draw() for each recess
     with its strap's state; everything comes back as SVG for the case's layer and the cartridges' layer, each split at
     the apron (the drawer slides through it): what is out in the room and what is still inside the desk, seen through
     the opening. A shape crossing the apron is cut there in 3D, and the cut is never stroked, as drawer.js's faces are. */
  const MMU = 682.5, MMV = 129.43, MMD = 1765;
  const OVER_MM = 0.003 * MMD;                                 // drawer.js OVER, in mm along the cartridge
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"';
  const f3 = n => n.toFixed(3);
  const ptsOf = ps => ps.map(p => f3(p[0]) + ',' + f3(p[1])).join(' ');
  const dOf = ps => 'M' + ps.map(p => f3(p[0]) + ',' + f3(p[1])).join('L');
  const area = ps => { let a = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i], q = ps[(i + 1) % ps.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const perim = ps => ps.reduce((t, p, i) => t + Math.hypot(ps[(i + 1) % ps.length][0] - p[0], ps[(i + 1) % ps.length][1] - p[1]), 0);
  const thinOf = sp => 2 * Math.abs(area(sp)) / perim(sp);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // a 3D outline to screen points: each straight 3D run cut fine (they bend on screen: the drawer's horizontals sag),
  // then the whole outline walked again at an even 0.25 px between its real corners (turns of 8 degrees or more), so
  // every segment is long enough for geom-audit's kink check (it looks at segments over 0.2 px) and none is over 0.3
  // (FAST, only while the drawer slides: each run sampled every 0.5 px and not walked again; under 0.05 px from the even
  // walk, and the strap is redrawn the right way once it stops)
  let FAST = false;
  function dense(S, poly, closed = true) {
    const fine = [], n = poly.length, m = closed ? n : n - 1, step = FAST ? 0.5 : 0.05;
    for (let i = 0; i < m; i++) {
      const a = poly[i], b = poly[(i + 1) % n], A = S(a), B = S(b);
      const k = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / step));
      for (let j = 0; j < k; j++) fine.push(j ? S(lerp3(a, b, j / k)) : A);
    }
    if (!closed) fine.push(S(poly[n - 1]));
    return FAST ? fine : even(fine, closed);
  }
  function even(ps, closed) {
    // drop repeats, then find the corners: the turn between the directions 0.5 px either side of a point
    const p = []; for (const q of ps) if (!p.length || Math.hypot(q[0] - p[p.length - 1][0], q[1] - p[p.length - 1][1]) > 1e-6) p.push(q);
    if (closed && p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6) p.pop();
    const n = p.length, at = i => p[((i % n) + n) % n];
    if (n < 2) return p;
    // the points 0.5 px back and on along the outline from each point (or as far as it goes), by running lengths: two
    // pointers that only move forward, so the whole pass is linear (walked from each point it was most of a frame)
    const lo = closed ? -n : 0, hi = closed ? 2 * n - 1 : n - 1, acc = new Float64Array(hi - lo + 1);
    for (let k = lo + 1; k <= hi; k++) { const a = at(k - 1), b = at(k); acc[k - lo] = acc[k - 1 - lo] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const len = (a, b) => acc[b - lo] - acc[a - lo];
    let jf = 0, jb = closed ? -n : 0;
    const corner = [];
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) { corner.push(i); continue; }
      const fMax = closed ? i + n : n - 1, bMin = closed ? i - n : 0;
      if (jf < i) jf = i;
      while (jf < fMax && len(i, jf) < 0.5) jf++;
      if (jb < bMin) jb = bMin;
      while (jb + 1 < i && len(jb + 1, i) >= 0.5) jb++;
      const a = at(jb), b = at(i), c = at(jf);
      let t = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]); t = Math.abs(Math.atan2(Math.sin(t), Math.cos(t)));
      if (t > 8 * Math.PI / 180) corner.push(i);
    }
    // keep one point per cluster of corner points (the sharpest is the middle of its run)
    const cs = []; for (const i of corner) { if (cs.length && i - cs[cs.length - 1][cs[cs.length - 1].length - 1] <= 1) cs[cs.length - 1].push(i); else cs.push([i]); }
    if (closed && cs.length > 1 && cs[0][0] === 0 && cs[cs.length - 1][cs[cs.length - 1].length - 1] === n - 1) cs[0] = cs.pop().concat(cs[0]);
    const turnAt = i => { const a = at(i - 1), b = at(i), c = at(i + 1); let t = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]); return Math.abs(Math.atan2(Math.sin(t), Math.cos(t))); };
    const keys = cs.map(c => c.reduce((best, i) => turnAt(i) > turnAt(best) ? i : best, c[0])).sort((a, b) => a - b);
    if (!keys.length) keys.push(0);
    const out = [];
    const walk = (i0, i1) => {            // from key i0 up to key i1 (exclusive), even steps
      const run = []; for (let i = i0; ; i++) { run.push(at(i)); if (((i - i1) % n + n) % n === 0 && i !== i0) break; if (run.length > n + 1) break; }
      // a point every 0.25 px of length or every 6 degrees of turning, whichever comes first, the run's own length
      // shared out evenly
      const dirAt = i => Math.atan2(run[i + 1][1] - run[i][1], run[i + 1][0] - run[i][0]);
      const marks = [0]; let len = 0, turn = 0;
      for (let i = 1; i < run.length; i++) {
        len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
        if (i < run.length - 1) { let t = dirAt(i) - dirAt(i - 1); turn += Math.abs(Math.atan2(Math.sin(t), Math.cos(t))); }
        if (len >= 0.25 || turn >= 6 * Math.PI / 180) { if (i < run.length - 1) marks.push(i); len = 0; turn = 0; }
      }
      for (const i of marks) out.push(run[i]);
    };
    if (closed) for (let k = 0; k < keys.length; k++) walk(keys[k], k + 1 < keys.length ? keys[k + 1] : keys[0] + n);
    else { for (let k = 0; k + 1 < keys.length; k++) walk(keys[k], keys[k + 1]); out.push(at(n - 1)); }
    return out;
  }
  // the apron, in a recess's local millimetres: z = zc. side +1 keeps z <= zc (d >= 0: out in the room), -1 keeps
  // z >= zc (inside the desk). A closed ring is cut by Sutherland-Hodgman; the points the cut makes are marked
  function clipRing(poly, zc, side) {
    const keep = p => (zc - p[1]) * side >= 0, out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ka = keep(a), kb = keep(b);
      if (ka) out.push(a);
      if (ka !== kb) { const t = (zc - a[1]) / (b[1] - a[1]), p = lerp3(a, b, t); p[1] = zc; p.cut = true; out.push(p); }
    }
    return out;
  }
  // an open line, cut the same way: the runs of it on the kept side
  function clipLine(line, zc, side) {
    const keep = p => (zc - p[1]) * side >= 0, runs = []; let cur = null;
    for (let i = 0; i < line.length; i++) {
      const a = line[i];
      if (i > 0) { const b = line[i - 1]; if (keep(a) !== keep(b)) { const t = (zc - b[1]) / (a[1] - b[1]), p = lerp3(b, a, t); p[1] = zc; if (cur) { cur.push(p); runs.push(cur); cur = null; } else cur = [p]; } }
      if (keep(a)) { if (!cur) cur = []; cur.push(a); }
    }
    if (cur && cur.length > 1) runs.push(cur);
    return runs.filter(r => r.length > 1);
  }
  // a closed ring's real edges as open runs (the cut edges left out)
  function uncut(ring) {
    const n = ring.length, start = ring.findIndex((p, i) => p.cut && ring[(i + 1) % n].cut);
    if (start < 0) return [ring.concat([ring[0]])];
    const runs = []; let cur = [];
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n, p = ring[i], q = ring[(i + 1) % n];
      cur.push(p);
      if (p.cut && q.cut) { if (cur.length > 1) runs.push(cur); cur = []; }
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  }

  // A face with holes, cut: the holes the cut crosses are joined into its outline as notches (along the cut from one to the
  // next, round each hole's kept part), so no edge of a hole lies on the outline's own cut edge. (Filled even-odd with
  // both, the two coincident edges left a faint dotted line across each hole where the cut crosses it.) Rings are cut
  // rings, their cut points marked; the first is the outline.
  function mergeCut(rings) {
    const cutAt = r => { for (let i = 0; i < r.length; i++) if (r[i].cut && r[(i + 1) % r.length].cut) return i; return -1; };
    const [outer, ...holes] = rings, a = cutAt(outer);
    if (a < 0) return rings;
    const ring = [...outer.slice(a + 1), ...outer.slice(0, a + 1)], cA = ring[ring.length - 1], cB = ring[0];
    const along = p => (p[0] - cA[0]) * (cB[0] - cA[0]) + (p[1] - cA[1]) * (cB[1] - cA[1]) + (p[2] - cA[2]) * (cB[2] - cA[2]);
    const chains = [], rest = [];
    for (const h of holes) {
      const j = cutAt(h);
      if (j < 0) { rest.push(h); continue; }
      let L = [...h.slice(j + 1), ...h.slice(0, j + 1)];          // from one cut point round to the other
      if (along(L[0]) > along(L[L.length - 1])) L = L.reverse();
      chains.push(L);
    }
    chains.sort((p, q) => along(p[0]) - along(q[0]));
    return [ring.concat(...chains), ...rest];
  }
  /* A drawing for one side of the apron: faces in painter's order, each with the 3D corners it was made from (for the
     stills' joint crops). Every test of what to draw (facing, too thin) is made on the whole shape, so a shape never
     changes as it passes through the apron; only what is drawn of it is cut. */
  function canvas(S, zc, side, SR = S) {
    const items = [], joints = [];
    // inside the desk, a cut face is filled a little past the apron, under its part out in the room (drawer.js OVER: the
    // two halves meet with no hairline of background between them); its outline stops at the cut
    const zf = side < 0 ? zc - OVER_MM : zc;
    const whole = poly => poly.every(p => (zc - p[1]) * side >= 0), none = poly => poly.every(p => (zc - p[1]) * side < 0);
    const strokeRuns = (runs, part) => { for (const r of runs) { const sp = dense(S, r, false); if (sp.length > 1) items.push(`<path data-part="${part}" d="${dOf(sp)}" fill="none" ${INK} stroke-linecap="round"/>`); } };
    return {
      S, SR, items, joints,
      // a face; `when` 'facing' keeps it only if it faces the eye (drawer.js's winding: toward the eye is positive area)
      face(poly, fill, { stroke = true, when = 'up', corners = null, part = 'face' } = {}) {
        const all = dense(SR, poly), a = area(all);
        if (Math.abs(a) < 0.05) return;
        if (when === 'facing' && a <= 0) return;
        // a face seen nearly edge on, under 3 px thick, is not drawn: what it would show is a sliver
        if (when === 'facing' && thinOf(all) < 3) return;
        for (const c of corners || (poly.length <= 8 ? poly : [])) joints.push(S(c));
        if (none(poly)) return;
        if (whole(poly)) { items.push(`<polygon data-part="${part}" points="${ptsOf(SR === S ? all : dense(S, poly))}" fill="${fill}"${stroke ? ' ' + INK : ''}/>`); return; }
        const cut = clipRing(poly, zc, side); if (cut.length < 3) return;
        const fp = clipRing(poly, zf, side);
        items.push(`<polygon data-part="${part}" points="${ptsOf(dense(S, fp.length >= 3 ? fp : cut))}" fill="${fill}"/>`);
        if (stroke) strokeRuns(uncut(cut), part);
      },
      // an open line, stroked
      line(poly, part, js = []) {
        joints.push(...js);
        if (none(poly)) return;
        if (whole(poly)) { strokeRuns([poly], part); return; }
        strokeRuns(clipLine(poly, zc, side), part);
      },
      // a closed outline with no fill
      ring(poly, part, js = []) {
        joints.push(...js);
        if (none(poly)) return;
        if (whole(poly)) { items.push(`<polygon data-part="${part}" points="${ptsOf(dense(S, poly))}" fill="none" ${INK}/>`); return; }
        const cut = clipRing(poly, zc, side); if (cut.length >= 3) strokeRuns(uncut(cut), part);
      },
      // rings filled even-odd (a plate with its window), and stroked
      holed(rings, fill, part, js = [], { strokeOnly = false, fillOnly = false } = {}) {
        joints.push(...js);
        if (rings.every(none)) return;
        if (rings.every(whole)) {
          const d = rings.map(r => dOf(dense(S, r)) + 'Z').join('');
          if (!strokeOnly) items.push(`<path data-part="${part}" d="${d}" fill="${fill}" fill-rule="evenodd"/>`);
          if (!fillOnly) items.push(`<path data-part="${part} outline" d="${d}" fill="none" ${INK}/>`);
          return;
        }
        const cuts = rings.map(r => clipRing(r, zc, side)).filter(r => r.length >= 3);
        if (!cuts.length) return;
        const fills = mergeCut(rings.map(r => clipRing(r, zf, side)).filter(r => r.length >= 3));
        if (!strokeOnly) items.push(`<path data-part="${part}" d="${fills.map(r => dOf(dense(S, r)) + 'Z').join('')}" fill="${fill}" fill-rule="evenodd"/>`);
        if (!fillOnly) strokeRuns(cuts.flatMap(uncut), part + ' outline');
      },
    };
  }

  // one recess's strap at release time t (0 strapped, 1 at rest), its cartridge lifted tug mm (a strapped one clicked).
  // ctx: { P (drawer.js's projection), r (the recess: uc, near), side (+1 the room, -1 inside the desk) }. Local
  // (x, z, h) mm for the recess, as in the study. Returns { case, carts } (SVG) and joints.
  const XO = -(XR + DIV.d);                                    // the divot's outer edge
  // (rest: the recess with the drawer fully out. What is drawn of a shape and how (too thin to draw, the strap's left end
  // ending square) is decided as seen from there, so nothing changes shape while the drawer slides)
  function draw({ P, r, rest = r, side, t, tug = 0, fast = false, H = hardware() }) {
    const Lc = ([x, z, h]) => [r.uc + x / MMU, 0.22 - h / MMV, r.near - z / MMD], S0 = p => P(Lc(p));
    const S = S0, SR = rest.near === r.near && rest.uc === r.uc ? S0 : p => P([rest.uc + p[0] / MMU, 0.22 - p[2] / MMV, rest.near - p[1] / MMD]);
    const zc = r.near * MMD;                                     // the apron (d = 0)
    // (everything of it lies between z 0 and the plates' far end: wholly on the other side, nothing to draw)
    if (side > 0 ? zc < 0 : zc > PZ1) return { case: '', carts: '', joints: [] };
    FAST = fast;
    try { return drawn({ S, SR, zc, side, t, tug, H }); } finally { FAST = false; }
  }
  function drawn({ S, SR, zc, side, t, tug, H }) {
    const caseCv = canvas(S, zc, side, SR), cv = canvas(S, zc, side, SR);
    // the receiver: a flush steel plate in the rim to the right, the slot near its far side (the webbing's width)
    caseCv.face([[H.px0, H.pz0, 0], [H.px1, H.pz0, 0], [H.px1, H.pz1, 0], [H.px0, H.pz1, 0]], '#EEEEEC', { part: 'receiver plate' });
    caseCv.face([[H.sx0, W0, 0], [H.sx1, W0, 0], [H.sx1, W1, 0], [H.sx0, W1, 0]], '#D2D2D0', { part: 'slot' });
    // the divot's mouth: dark, its three sides in the rim drawn (the fourth is open to the recess)
    { const x0 = XO, x1 = -XR, z0 = DIV.z0, z1 = DIV.z1;
      caseCv.face([[x0, z0, 0], [x1, z0, 0], [x1, z1, 0], [x0, z1, 0]], '#D2D2D0', { stroke: false, part: 'divot' });
      caseCv.line([[x1, z0, 0], [x0, z0, 0], [x0, z1, 0], [x1, z1, 0]], 'divot outline', [S([x0, z0, 0]), S([x0, z1, 0]), S([x1, z0, 0]), S([x1, z1, 0])]); }
    const { path, E, phi } = pose({ H, t, tug });
    // the webbing's line, as the drawing shows it: from the slot's lip (the strap goes down into the slot there), and,
    // strapped, down to the divot's outer edge (it goes down the divot's liner); drawn on the surface it lies on, as
    // everything flat in the drawing is: its centre line is half its thickness up
    let line = path.filter(p => p[1] >= 0 && p[0] <= H.sx0 + 1e-6).map(p => [p[0], Math.max(0, p[1] - 0.7)]);
    if (line.length && line[0][0] < H.sx0) line.unshift([H.sx0, 0]);
    if (t <= 0) {
      const i = line.findIndex((p, k) => k > 0 && p[0] < -XC - 0.7 && p[1] < PROUD + tug);
      // after the fold over the left edge: straight on to the divot's outer edge at the case's top
      if (i > 0) { line = line.slice(0, i); line.push([XO, 0]); }
      // where its drop into the divot faces away from the seat it is seen nearly edge on: if its two ends would be under
      // 8 px apart, it is drawn ending at the cartridge's edge (cut where it leaves the flat top, before its fold starts
      // down, so it ends square), the divot's dark mouth beside it
      const zm = (W0 + W1) / 2, a = SR([-XC, zm, PROUD]), b = SR([XO, zm, 0]), d = SR([-XC, zm + 10, PROUD]);
      const dx = d[0] - a[0], dy = d[1] - a[1], gap = Math.abs(dx * (b[1] - a[1]) - dy * (b[0] - a[0])) / Math.hypot(dx, dy);
      if (gap < 8) { const k = line.findIndex((p, i) => i > 1 && p[0] < 0 && p[1] < PROUD + tug - 1e-6); line = line.slice(0, k); line.push([-XC, PROUD + tug]); }
    }
    // (seated, the latch plate lies over what is left of the webbing outside the slot)
    if (t < 0.9 && line.length > 1 && Math.hypot(line[line.length - 1][0] - line[0][0], line[line.length - 1][1] - line[0][1]) > 1) band(cv, line);
    // (seated, it lies flat on the steel plate: drawn on the plate's surface)
    if (t > 0) latchPlate(cv, t >= 0.9 ? [E[0], 0] : E, phi, H);
    return { case: caseCv.items.join(''), carts: cv.items.join(''), joints: [...caseCv.joints, ...cv.joints] };
  }
  // the webbing: a band across z from W0 to W1 along its line in (x, h). Its tone follows where it faces (the top
  // #D8D8D6, the slopes #D2D2D0), cut without a line where a soft fold turns; one line round the whole.
  function band(cv, line) {
    const at = (p, z) => [p[0], z, p[1]], S = cv.S, SR = cv.SR;
    const runs = []; let cur = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], ang = Math.atan2(b[1] - a[1], Math.abs(b[0] - a[0]) + 1e-9) * 180 / Math.PI;
      const tone = Math.abs(ang) < 6 ? '#D8D8D6' : '#D2D2D0';
      if (!cur || cur.tone !== tone) { cur = { tone, pts: [a] }; runs.push(cur); }
      cur.pts.push(b);
    }
    const ringOf = ps => [...ps.map(p => at(p, W0)), ...ps.slice().reverse().map(p => at(p, W1))];
    const thin = run => thinOf(dense(SR, ringOf(run.pts))) < 3;
    for (let i = 0; i < runs.length && runs.length > 1; i++) if (thin(runs[i])) { const into = i > 0 ? runs[i - 1] : runs[i + 1]; if (i > 0) into.pts.push(...runs[i].pts.slice(1)); else into.pts.unshift(...runs[i].pts.slice(0, -1)); runs.splice(i, 1); i--; }
    const ring = ringOf(line), bandThin = thinOf(dense(SR, ring)) < 3;
    if (!bandThin) for (const run of runs) cv.face(ringOf(run.pts), run.tone, { stroke: false, part: 'webbing', corners: [] });
    cv.ring(ring, 'webbing outline', [S(at(line[0], W0)), S(at(line[0], W1)), S(at(line[line.length - 1], W0)), S(at(line[line.length - 1], W1))]);
  }
  // the latch plate: the ferrule (a tone across its root, no line of its own) and the blade with its rounded nose and its
  // window, flat; at the ferrule's end (E) pointing along phi
  function latchPlate(cv, E, phi, H) {
    const len = H.ferrule + H.B, rN = 8, c = Math.cos(phi), s = Math.sin(phi), S = cv.S, SR = cv.SR;
    const at = (u, z) => [E[0] + u * c, z, E[1] + u * s];
    const z0 = BZ0, z1 = BZ1, arcs = [];
    const nose = (cz, a0, a1) => { for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; arcs.push(at(len - rN + rN * Math.cos(a), cz + rN * Math.sin(a))); } };
    const T = Math.min(6, H.B / 3), f = H.ferrule;
    const outline = [at(0, W0), at(f, W0), at(f + T, z0)]; arcs.length = 0; nose(z0 + rN, -Math.PI / 2, 0); outline.push(...arcs); arcs.length = 0; nose(z1 - rN, 0, Math.PI / 2); outline.push(...arcs, at(f + T, z1), at(f, W1), at(0, W1));
    let win = H.window ? [at(H.ferrule + M6, z0 + 16), at(len - M6, z0 + 16), at(len - M6, z1 - 16), at(H.ferrule + M6, z1 - 16)] : null;
    // (seen nearly edge on, the window would be two lines under 3 px apart: it is left out)
    if (win && thinOf(dense(SR, win)) < 3) win = null;
    // which face we see: a lying plate's top is lighter than its underside
    const n = [-s, c];                                                       // its normal in (x, h)
    const fill = n[1] >= 0 ? '#F4F4F2' : '#E2E2E0', ferr = n[1] >= 0 ? '#E9E9E7' : '#DADAD8';
    const rings = win ? [outline, win] : [outline];
    const edgeOn = thinOf(dense(SR, outline)) < 3;
    const js = [S(at(0, W0)), S(at(0, W1)), S(at(H.ferrule, W0)), S(at(H.ferrule, W1)), S(at(H.ferrule + T, z0)), S(at(H.ferrule + T, z1)), S(at(len, z0 + rN)), S(at(len, z1 - rN)), S(at(len - rN, z0)), S(at(len - rN, z1)), ...(win ? win.map(S) : [])];
    if (edgeOn) { cv.holed(rings, fill, 'latch plate', js, { strokeOnly: true }); return; }
    // (the fill, then the ferrule's tone, then the outline over both)
    cv.holed(rings, fill, 'latch plate', [], { fillOnly: true });
    const fq = [at(0, W0), at(H.ferrule, W0), at(H.ferrule, W1), at(0, W1)];
    if (thinOf(dense(SR, fq)) >= 3) cv.face(fq, ferr, { stroke: false, part: 'ferrule', corners: [] });
    cv.holed(rings, fill, 'latch plate', js, { strokeOnly: true });
  }

  window.strapA = { NAMES, PLACES, XC, XR, PROUD, RDEPTH, DR, W0, W1, WT, BZ0, BZ1, M6, WALLM, RIM, PITCH, PZ1, DIV, colX, hardware,
    fillet, route, ground, fits, pose, TIMES, tugAt, LATCHED, FER, BLADE, EDGE_R, FOLD, MMU, MMV, MMD, dense, even, draw };
})();
