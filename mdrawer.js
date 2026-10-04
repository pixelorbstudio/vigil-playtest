/* mdrawer.js — M.'s drawer (design.md, "M.'s password"; Arnold, 2026-10-03, round 3): the right pedestal's middle drawer,
   locked with an old keyhole the Pong key plainly doesn't fit; its key, a warded one with a paper tag, behind a ceiling
   tile on night 2; inside, M.'s things in a shallow pencil tray resting near the drawer's top (on the drawer's floor the
   camera can't see them) and a sealed envelope from IT, the one thing to click.

   Pure drawing in the room's camera (drawer.js's pedestal space F, toCamF, roomF; solid.js's solids, lathe.js's surfaces
   of revolution; one millimetre scale, 1.765 mm a camera unit); the page (app.js, "M.'s drawer") does the clicks, the
   timing and the sounds. The drawer is the cheat sheet's make (sheet.js drawer, given this box).

   Every curve is sampled every 0.2 px of the screen or finer before projecting; thin things (paper, a strap, glass in a
   wire rim) are flat, since a wall under 3 px is a sliver; walls are 8 mm or more (6.5 px here), so their two lines stand
   6 px apart. audit-r3.html checks it all. */
(function () {
  const MM = 1 / 1.765;                                  // camera units a millimetre (drawer.js MM_CAM)
  const KEY_SCALE = 2, KS = KEY_SCALE / 1.765;           // the old key, at the first key's scale (one true size: key3d.js SCALE)
  const V3 = {
    add: (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]], sub: (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]],
    mul: (p, k) => [p[0] * k, p[1] * k, p[2] * k], dot: (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2],
    cross: (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]],
    unit: p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); },
  };
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const pathOf = ps => 'M' + fmt(ps).split(' ').join('L');
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round"';
  const LINE = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round" fill="none"';
  const dd = () => window.deskDrawer;

  // ---- the drawer: x 1240..1480, y 1490..1640 on the desk's front (drawer.js desk's mid drawer), as deep as the cheat
  // sheet's and pulled as far
  const BOX = { x0: 1240, x1: 1480, y0: 1490, y1: 1640, depth: .22, wall: 9, wd: .01 };
  const OPEN = .22, MX = (BOX.x0 + BOX.x1) / 2;
  // ---- the keyhole: an old one, the shape a warded key needs (a round top and a tapering slot), in an oval escutcheon
  // above the pull. Its slot's sides meet the round top on its tangents. (The stills' 8.5 x 10.5 oval put the hole's
  // outline 4 to 5 px from it; 10.5 x 13.5 keeps every gap over 6.)
  const KH = { cy: BOX.y0 + 20.5, rx: 10.5, ry: 13.5, r: 2.2, c: -3, foot: 5.5, half: 1.4 };   // (the round top a hair narrower than the key's shank, which covers it in the lock: wider, slivers of the hole showed round it)
  const holeLoop = (step = .2) => {
    // in the front's px about (MX, cy): the round top's centre at (0, c); the slot's foot corners at (+-half, foot)
    const { r, c, foot, half } = KH, P = [half, foot - c], d = Math.hypot(...P), ap = Math.atan2(P[1], P[0]), t = Math.acos(r / d);
    const aR = ap - t, aL = Math.PI - aR;                // the tangent points, right and left (mirror images)
    const pts = [], sweep = 2 * Math.PI - (aL - aR), m = Math.ceil(sweep * r / step);
    for (let k = 0; k <= m; k++) { const a = aR - sweep * k / m; pts.push([r * Math.cos(a), c + r * Math.sin(a)]); }
    // down the left side to the foot, across, and up the right side to where the arc began
    const line = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); return Array.from({ length: n }, (_, k) => [p[0] + (q[0] - p[0]) * (k + 1) / n, p[1] + (q[1] - p[1]) * (k + 1) / n]); };
    const L = pts[pts.length - 1];
    return [...pts, ...line(L, [-half, foot]), ...line([-half, foot], [half, foot]), ...line([half, foot], pts[0]).slice(0, -1)];
  };
  function keyhole(out) {
    const F = dd().F, cy = KH.cy;
    const ovalN = Math.ceil(2 * Math.PI * Math.max(KH.rx, KH.ry) / .2);
    const oval = Array.from({ length: ovalN }, (_, k) => { const a = 2 * Math.PI * k / ovalN; return F([MX + KH.rx * Math.cos(a), cy + KH.ry * Math.sin(a), out]); });
    const hole = holeLoop().map(([x, y]) => F([MX + x, cy + y, out]));
    return `<polygon points="${fmt(oval)}" fill="#E6E6E4" ${INK}/><polygon points="${fmt(hole)}" fill="#B4B4B4" ${INK}/>`;
  }

  // ---- the old key: a warded key, older than the first and plainly not for the same kind of lock: a round ring bow, a long
  // shank, a bit with one ward cut at its end; 2.2 mm thick. In its own millimetres: a along it from the bow's end (0) to the
  // bit's end (52), b across (the bit on +b), n through it. A paper shipping tag on a loop of string, "2" in pencil.
  const OLD = { R: 8.5, cx: 8.5, w: 1.6, hole: 4.6, L: 52, t: 2.2, mid: 26 };
  function oldKeyShape(step) {
    const { R, cx, w, L } = OLD, attach = cx + Math.sqrt(R * R - w * w), a0 = Math.atan2(w, attach - cx);
    const arc = []; const m = Math.ceil((2 * Math.PI - 2 * a0) * R / step);
    for (let k = 0; k <= m; k++) { const t = a0 + (2 * Math.PI - 2 * a0) * k / m; arc.push([cx + R * Math.cos(t), R * Math.sin(t)]); }
    const line = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (step * 4))); return Array.from({ length: n }, (_, k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); };
    // counter-clockwise in (a, b): out along the shank's -b side to the end, the bit (+b) with its ward, back along +b
    const pts = [[attach, -w], [L, -w], [L, 8.5], [49, 8.5], [49, 5], [46.5, 5], [46.5, 8.5], [43, 8.5], [43, w], [attach, w]];
    const outer = [...pts.flatMap((p, i) => i < pts.length - 1 ? line(p, pts[i + 1]) : [p]), ...arc.slice(1, -1)];
    const hm = Math.ceil(2 * Math.PI * OLD.hole / step), hole = Array.from({ length: hm }, (_, k) => [cx + OLD.hole * Math.cos(2 * Math.PI * k / hm), OLD.hole * Math.sin(2 * Math.PI * k / hm)]);   // (counter-clockwise, as key3d.js's)
    return { outer, holes: [hole], t: OLD.t };
  }
  // the part of a loop with a <= maxA (in the lock, the rest is inside it)
  function clipA(loop, maxA) {
    const out = [];
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length], pin = p[0] <= maxA, qin = q[0] <= maxA;
      if (pin) out.push(p);
      if (pin !== qin) { const t = (maxA - p[0]) / (q[0] - p[0]); out.push([maxA, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  // steel, a little darker and cooler than the first key's brass
  const OLDKEY_MATS = { cap: ['#EEEEEC', '#E0E0DE'], wall: ['#DCDCDA', '#D2D2D0'], hole: ['#D6D6D4', '#D0D0CE'], floor: ['#E2E2E0', '#DADAD8'], pocketWall: ['#D9D9D7', '#D2D2D0'] };
  // a shipping tag, 30 by 16 mm, lying beside the bow along the key, its hole end (cut at the corners) toward the ring
  const TAG = [[-42, -8], [-15, -8], [-12, -5], [-12, 5], [-15, 8], [-42, 8]], TAG_HOLE = [-17, 0, 1.4];
  /* pose: { c: camera point of the key's middle (a 26, b 0, n 0), A along it, B across it (N = A x B) }; project: camera
     point -> screen. maxA: only what is outside a lock. tag: draw the tag and its string (not in the lock). */
  function oldKey(pose, project, { maxA = null, tag = true } = {}) {
    const { c, A, B } = pose, N = V3.cross(A, B);
    const frame = (a, b, n) => { const u = (a - OLD.mid) * KS, v = b * KS, w = n * KS; return [c[0] + A[0] * u + B[0] * v + N[0] * w, c[1] + A[1] * u + B[1] * v + N[1] * w, c[2] + A[2] * u + B[2] * v + N[2] * w]; };
    const o = project(frame(OLD.mid, 0, 0)), pa = project(frame(OLD.mid + 1, 0, 0)), pb = project(frame(OLD.mid, 1, 0));
    const pxmm = Math.max(Math.hypot(pa[0] - o[0], pa[1] - o[1]), Math.hypot(pb[0] - o[0], pb[1] - o[1]));
    const step = Math.min(.3, .2 / pxmm);
    let shape = oldKeyShape(step);
    if (maxA != null) shape = { outer: clipA(shape.outer, maxA), holes: shape.holes.filter(h => h.every(([a]) => a < maxA)), t: shape.t };
    let svg = '';
    if (tag && maxA == null) {
      // the tag lies flat beside the bow (paper: no walls), "2" on it in pencil; the string from its hole to the ring
      const n0 = -OLD.t / 2 + .05, fine = [];
      for (let i = 0; i < TAG.length; i++) { const p = TAG[i], q = TAG[(i + 1) % TAG.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); for (let j = 0; j < k; j++) fine.push(project(frame(p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k, n0))); }
      const hm = Math.max(16, Math.ceil(2 * Math.PI * 1.4 / step)), th = Array.from({ length: hm }, (_, k) => project(frame(TAG_HOLE[0] + TAG_HOLE[2] * Math.cos(2 * Math.PI * k / hm), TAG_HOLE[1] + TAG_HOLE[2] * Math.sin(2 * Math.PI * k / hm), n0)));
      svg += `<path d="${pathOf(fine)}Z${pathOf(th)}Z" fill="#F4F2EA" fill-rule="evenodd"/><path d="${pathOf(fine)}Z${pathOf(th)}Z" ${LINE}/>`;
      const p = project(frame(-29, 0, n0)), ax = project(frame(-28, 0, n0)), ay = project(frame(-29, -1, n0));   // (read along the tag, its top away from you)
      const fs = 9 * Math.hypot(ax[0] - p[0], ax[1] - p[1]);
      if (fs >= 4) svg += `<text transform="matrix(${[ax[0] - p[0], ax[1] - p[1], ay[0] - p[0], ay[1] - p[1], p[0], p[1]].map(v => v.toFixed(4)).join(' ')})" text-anchor="middle" dominant-baseline="central" font-family="Caveat, cursive" font-size="9" fill="#9A9A98">2</text>`;
      // the string: from the tag's hole out over its end (square to it, clear of its cut corners) to the bow's ring, a little
      // slack; it goes under the ring where it reaches it
      // (straight over the tag, out through the middle of its end, then slack to the ring)
      const sm = Math.ceil(20 / step), str = Array.from({ length: sm + 1 }, (_, k) => { const a = TAG_HOLE[0] + (2 - TAG_HOLE[0]) * k / sm, u = Math.max(0, (a + 12) / 14); return project(frame(a, 1.5 * Math.sin(Math.PI * u), n0 + .1)); });
      svg += `<path d="${pathOf(str)}" fill="none" stroke="#B4B4B4" stroke-width=".8" stroke-linecap="round"/>`;
    }
    return svg + window.solid.extrusion(shape, frame, project, OLDKEY_MATS);
  }
  const OLDKEY = { ...OLD, KS };
  // on the desk's top by its front edge, left of the keyboard's middle, a little turned (lying flat: A along, N up)
  const lyingPose = (at, turn, lift) => { const A = [Math.cos(turn), 0, Math.sin(turn)], N = [0, -1, 0], B = V3.cross(N, A); return { c: V3.add(dd().toCamF(at), V3.mul(N, lift)), A, B }; };
  const deskPose = () => lyingPose([600, 1300, -.03], -.35, KS * OLD.t / 2);
  // in front of the lock (out: key millimetres short of home), upright: A into the lock, B down (the bit in the slot),
  // turned a quarter at turn 1. The shank enters the round top of the keyhole; home, everything past 21 mm from the bow's end is
  // inside (the bow and a stub of shank stand out: at 30, 13 mm of shank stood out, a long diagonal through the camera)
  const INSIDE = 21;
  function lockPose(out, turn = 0, front = 0) {
    const f = dd().toCamF([MX, KH.cy + KH.c, front]), th = turn * Math.PI / 2;
    return { c: [f[0], f[1], f[2] - (INSIDE - OLD.mid + out) * KS], A: [0, 0, 1], B: [-Math.sin(th), Math.cos(th), 0] };
  }
  const lockMaxA = out => INSIDE + out;

  // ---- the tray and M.'s things. A shallow pencil tray resting near the drawer's top, wall to wall; what lies in it, in
  // its own place: x across the front (px), f how far forward with the drawer open (0 the pedestal's face, 1 the front).
  // Everything is real size (the room's millimetre), flat-shaded, lit as the mug is.
  const TRAY = { y: BOX.y0 + 30, x0: BOX.x0 + BOX.wall, x1: BOX.x1 - BOX.wall, f1: 1 - .012 / OPEN };
  const worldD = (f, out) => f * OPEN - (OPEN - out);
  // a frame lying on the tray at (x, f), turned by turn about the vertical: a along (turn 0: to the right), b away from you
  // (turn 0), n up; millimetres in
  function trayFrame(x, f, turn, out) {
    const A = [Math.cos(turn), 0, Math.sin(turn)], N = [0, -1, 0], B = V3.cross(N, A);   // (B away from you at turn 0; N = A x B)
    const C = dd().toCamF([x, TRAY.y, worldD(f, out)]);
    return { frame: (a, b, n) => [0, 1, 2].map(i => C[i] + (A[i] * a + B[i] * b + N[i] * n) * MM), A, B, N, C };
  }
  // a loop sampled so its projection steps 0.2 px or less: rounded rectangles (tangent arcs), circles, straight runs
  const sampleLoop = (corners, step) => {           // corners: [[a, b, r]] counter-clockwise (as key3d.js rounded)
    const n = corners.length, out = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = corners[(i - 1 + n) % n], [cx, cy, r] = corners[i], [nx, ny] = corners[(i + 1) % n];
      if (!r) { out.push([cx, cy]); continue; }
      const nu = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l]; }, u = nu([px - cx, py - cy]), v = nu([nx - cx, ny - cy]);
      const half = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2, along = r / Math.tan(half), bis = nu([u[0] + v[0], u[1] + v[1]]), dc = r / Math.sin(half);
      const C = [cx + bis[0] * dc, cy + bis[1] * dc];
      const t0 = Math.atan2(cy + u[1] * along - C[1], cx + u[0] * along - C[0]), t1 = Math.atan2(cy + v[1] * along - C[1], cx + v[0] * along - C[0]);
      let dt = t1 - t0; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
      const m = Math.max(2, Math.ceil(Math.abs(dt) * r / step));
      for (let k = 0; k <= m; k++) out.push([C[0] + r * Math.cos(t0 + dt * k / m), C[1] + r * Math.sin(t0 + dt * k / m)]);
    }
    const fine = [];
    for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); for (let j = 0; j < k; j++) fine.push([p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k]); }
    return fine;
  };
  const circleLoop = (c, r, step) => { const m = Math.max(24, Math.ceil(2 * Math.PI * r / step)); return Array.from({ length: m }, (_, k) => [c[0] + r * Math.cos(2 * Math.PI * k / m), c[1] + r * Math.sin(2 * Math.PI * k / m)]); };
  // a flat thing (paper, a strap, glass): its loop at height n, filled and outlined
  const flat = (loop, frame, n, project, fill, extra = '') => { const ps = loop.map(([a, b]) => project(frame(a, b, n))); return `<polygon points="${fmt(ps)}" fill="${fill}" ${INK} ${extra}/>`; };
  // the step in mm for 0.2 px here (the tray is about 0.87 px a mm across, half that in depth)
  const STEP = .2;

  // the stopped watch: a case 40 mm across and 10 high, its dial the case's top, two hands at 03:11 (the minute old.log
  // has M. going home); a strap each side, lying flat (3 mm leather drawn as paper: its edge would be a 2.5 px sliver)
  const WATCH = { x: 1404, f: .3, turn: .18, r: 20, h: 10, strap: 40 };
  function watch(out, project) {
    const { frame } = trayFrame(WATCH.x, WATCH.f, WATCH.turn, out), r = WATCH.r;
    const strap = (b0, b1) => sampleLoop([[-9, b0, 0], [9, b0, 0], [9, b1, 4], [-9, b1, 4]].map(([a, b, rr]) => [a, b, rr]), STEP);
    let s = flat(strap(0, r + WATCH.strap), frame, .5, project, '#E2E2E0') + flat(strap(0, -r - WATCH.strap), frame, .5, project, '#E2E2E0');
    const fr = (a, b, n) => frame(a, b, n + WATCH.h / 2 + .5);
    const hands = (f, p, n) => {
      const o = p(f(0, 0, n)), hand = (deg, len) => { const t = deg * Math.PI / 180, q = p(f(len * Math.sin(t), len * Math.cos(t), n)); return `M${o[0].toFixed(2)},${o[1].toFixed(2)}L${q[0].toFixed(2)},${q[1].toFixed(2)}`; };
      return `<path d="${hand((3 + 11 / 60) * 30, 9) + hand(11 * 6, 14)}" fill="none" stroke="#9A9A98" stroke-width="1" stroke-linecap="round"/>`;
    };
    s += window.solid.extrusion({ outer: circleLoop([0, 0], r, STEP / .9), t: WATCH.h }, fr, project, { cap: ['#F6F6F4', '#EEEEEC'], wall: ['#E2E2E0', '#D6D6D4'], hole: ['#D6D6D4', '#D0D0CE'], floor: ['#E2E2E0', '#DADAD8'], pocketWall: ['#D9D9D7', '#D2D2D0'] }, { stamp: hands });
    return s;
  }
  // a pack of gum: a box 74 x 21 x 12 mm, a printed band across its top
  const GUM = { x: 1398, f: .55, turn: -.06, L: 74, W: 21, H: 12 };
  function gum(out, project) {
    const { frame } = trayFrame(GUM.x, GUM.f, GUM.turn, out), { L, W, H } = GUM;
    const fr = (a, b, n) => frame(a, b, n + H / 2);
    const box = sampleLoop([[-L / 2, -W / 2, 0], [L / 2, -W / 2, 0], [L / 2, W / 2, 0], [-L / 2, W / 2, 0]], STEP);
    const band = (f, p, n) => { const q = sampleLoop([[-11, -W / 2, 0], [11, -W / 2, 0], [11, W / 2, 0], [-11, W / 2, 0]], STEP).map(([a, b]) => p(f(a, b, n))); return `<polygon points="${fmt(q)}" fill="#E2E2E0" ${INK}/>`; };
    return window.solid.extrusion({ outer: box, t: H }, fr, project, { cap: ['#F0F0EE', '#E6E6E4'], wall: ['#E6E6E4', '#DADAD8'], hole: ['#D6D6D4', '#D0D0CE'], floor: ['#E2E2E0', '#DADAD8'], pocketWall: ['#D9D9D7', '#D2D2D0'] }, { stamp: band });
  }
  // a pen: 120 mm, 11 across, its cap a shade darker, a pointed metal tip (lathe.js)
  const PEN = { x: 1372, f: .62, turn: -.62, L: 120, r: 5.5 };
  function pen(out, project) {
    const { frame } = trayFrame(PEN.x, PEN.f, PEN.turn, out), { L, r } = PEN;
    const C = frame(0, 0, r), A = V3.sub(frame(1, 0, r), C), U = V3.sub(frame(0, 0, r + 1), C), V = V3.sub(frame(0, 1, r), C);
    // its cap's end a short cone, as its tip is (a chamfer put two ring lines 3 px apart; rounded, its many small bands'
    // silhouettes piled into a dark spot; flat, the disc seen nearly edge-on was a bold line, its two sides 0.3 px apart)
    const prof = [[0, 0, 'tip'], [4, 1.4, 'tip'], [16, r, 'body'], [70, r, 'cap'], [L - 9, r, 'cap'], [L, 0, 'cap']];
    return window.lathe.compose(window.lathe.lathe(prof, { C, A, U, V }, project, { tip: ['#E2E2E0', '#D6D6D4'], body: ['#ECECEA', '#E0E0DE'], cap: ['#DEDEDC', '#D2D2D0'] }, { sectors: 720, split: false, seal: true, matEdges: true }));
  }
  // reading glasses, folded, lying on their lenses: wire rims (a wire is a line), the glass a flat fill a shade off the
  // tray's; the two temples folded across on top, the bridge an arch over the gap. Old-fashioned large lenses (46 x 40 mm):
  // each temple has to stand 6 px from the lens's edges and from the other, and a 28 mm lens leaves only 14 px for three.
  const GLASSES = { x: 1312, f: .69, turn: .04, lw: 46, lh: 40, gap: 14, rTop: 14, rBot: 12, n: 9, temples: [-11.5, 1], tn: 12 };
  function glasses(out, project) {
    const { frame } = trayFrame(GLASSES.x, GLASSES.f, GLASSES.turn, out), { lw, lh, gap, rTop, rBot, n, temples, tn } = GLASSES, cx = gap / 2 + lw / 2;
    const lens = s => sampleLoop([[s * cx - lw / 2, -lh / 2, rBot], [s * cx + lw / 2, -lh / 2, rBot], [s * cx + lw / 2, lh / 2, rTop], [s * cx - lw / 2, lh / 2, rTop]], STEP);
    const wire = pts => `<path d="${pathOf(pts.map(([a, b, h]) => project(frame(a, b, h))))}" ${LINE}/>`;
    const curve = (m, f) => Array.from({ length: m + 1 }, (_, k) => f(k / m));
    let svg = flat(lens(-1), frame, n, project, '#EEEEEC') + flat(lens(1), frame, n, project, '#EEEEEC');
    // the bridge: an arch from rim to rim, from where the inner top corners' arcs pass a little under the top
    const bb = lh / 2 - 3, ae = (gap / 2) + rTop - Math.sqrt(rTop * rTop - Math.pow(bb - (lh / 2 - rTop), 2));
    svg += wire(curve(Math.ceil(2 * ae / STEP), u => [-ae + 2 * ae * u, bb + 3 * Math.sin(Math.PI * u), n + 1.5 * Math.sin(Math.PI * u)]));
    // the temples: from each hinge, at its lens's outer edge, across to the far lens (their ends lie on it)
    const hinge = s => s * (cx + lw / 2), reach = 2 * cx + 12, temple = (s, b) => wire(curve(Math.ceil(reach / STEP), u => [hinge(s) - s * reach * u, b, tn]));
    svg += temple(1, temples[1]) + temple(-1, temples[0]);
    return svg;
  }
  // the envelope from IT, a C6 (162 x 114 mm), sealed until it is opened, lying face up on the tray: drawn in its own
  // card frame (u across its long side, v down it), as when it is held up (envelope() below)
  const ENV = { w: 162, h: 114 };
  const ENV_AT = { x: 1312, f: .26, turn: .05 };   // (at 1300 its long edge ran 2 px from the left wall's)
  function envelopeLying(out) {
    // its long side toward you, the flap's edge on the left: A (u) toward you, B (v) to the right, turned a little
    const t = ENV_AT.turn, A = [-Math.sin(t), 0, -Math.cos(t)], B = [Math.cos(t), 0, -Math.sin(t)];
    const C = dd().toCamF([ENV_AT.x, TRAY.y, worldD(ENV_AT.f, out)]);
    return { c: V3.add(C, [0, -.4 * MM, 0]), A, B };
  }
  // the envelope (and, open, the slip up out of it) through a projection. pose: { c, A across, B down }; opened: the flap
  // up; slipOut 0..1: how far the slip has come up. Its printing only where its letters are 6 px or more; its lines
  // sampled so they step 0.2 px of the screen.
  const PASSWORD = 's4-nights-0402';
  function envelope({ c, A, B }, project, { opened = false, slipOut = 0, width = 1 } = {}) {
    const at = (u, v, lift = 0) => { const N = V3.cross(A, B); return [0, 1, 2].map(i => c[i] + (A[i] * u + B[i] * v - N[i] * lift) * MM); };
    const o = project(at(0, 0)), pu = project(at(1, 0)), pv = project(at(0, 1));
    const pxmm = Math.min(Math.hypot(pu[0] - o[0], pu[1] - o[1]), Math.hypot(pv[0] - o[0], pv[1] - o[1]));
    const step = Math.min(2, .2 / Math.max(Math.hypot(pu[0] - o[0], pu[1] - o[1]), Math.hypot(pv[0] - o[0], pv[1] - o[1])));
    const run = (pts, closed) => { const out = []; const n = closed ? pts.length : pts.length - 1; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); for (let j = 0; j < k; j++) out.push(project(at(p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k, p[2] || 0))); } if (!closed) { const l = pts[pts.length - 1]; out.push(project(at(l[0], l[1], l[2] || 0))); } return out; };
    const poly = (pts, fill) => `<polygon points="${fmt(run(pts, true))}" fill="${fill}" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    const line = pts => `<path d="${pathOf(run(pts, false))}" fill="none" stroke="#B4B4B4" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const MONO = 'ui-monospace, Consolas, monospace';
    const text = (s, u, v, size, { anchor = 'start', fill = '#8E8E8C', ls = 0, weight = 400, font = MONO } = {}) => {
      if (size * pxmm < 6) return '';                    // too small to read here: left out (it would be a grey smudge)
      const p = project(at(u, v)), ax = project(at(u + 1, v)), ay = project(at(u, v + 1));
      return `<text transform="matrix(${[ax[0] - p[0], ax[1] - p[1], ay[0] - p[0], ay[1] - p[1], p[0], p[1]].map(n => n.toFixed(4)).join(' ')})" text-anchor="${anchor}" font-family="${font}" font-size="${size}" letter-spacing="${ls}" font-weight="${weight}" fill="${fill}">${s}</text>`;
    };
    const w = ENV.w / 2, h = ENV.h / 2, k = ENV.w / 520;   // (the held stills were drawn 520 across: k is a still's px in mm)
    let s = '';
    if (opened) {
      // the flap open, up past the top edge; the slip up out of the mouth, behind the envelope's front
      s += poly([[-w, -h], [0, -h - 120 * k], [w, -h]], '#ECECEA');
      if (slipOut > 0) {
        const sw = (520 - 60) / 2 * k, top = -h + 6 - (215 * k + 6) * slipOut, sh = 250 * k, X = -w + 30 * k;
        s += poly([[-sw, top], [sw, top], [sw, top + sh], [-sw, top + sh]], '#FAFAF9');
        const x = X + 22 * k, y = v => top + v * k;
        s += text('VIGIL SYSTEMS · IT OPERATIONS', x, y(34), 14 * k, { weight: 700, ls: 2.5 * k });
        s += text('ACCOUNT NOTICE · SITE 4 · CONFIDENTIAL', x, y(54), 10 * k, { ls: 1.4 * k });
        if (66 * k * pxmm >= 6) s += line([[x, y(66)], [sw - 22 * k, y(66)]]).replace('#B4B4B4', '#D2D2D0');
        [['ACCOUNT:', 'm'], ['TEMPORARY PASSWORD:', PASSWORD], ['LOG IN WITH:', 'su m']].forEach(([a, b], i) => {
          s += text(a, x, y(96 + i * 26), 11 * k, { ls: 1.2 * k }) + text(b, X + 200 * k, y(96 + i * 26), 15 * k, { fill: '#4A4A48' });
        });
        s += text('Change it at first login. Do not write it down.', x, y(190), 9.5 * k);
      }
    }
    s += poly([[-w, -h], [w, -h], [w, h], [-w, h]], '#F7F7F5');
    // the back's folds, where they stand clear of the flap (at the tray's size their meeting comes too close to it)
    if (8 * pxmm >= 6) s += line([[-w, h], [-10 * k, -h + 300 * .48 * k], [10 * k, -h + 300 * .48 * k], [w, h]]).replace('#B4B4B4', '#DCDCDA');
    if (!opened) {
      s += poly([[-w, -h], [0, -h + 300 * .52 * k], [w, -h]], '#F0F0EE');
      const sr = 11 * k, sc = [0, -h + 300 * .52 * k - 2 * k], sm = Math.max(24, Math.ceil(2 * Math.PI * sr / step));
      s += poly(Array.from({ length: sm }, (_, i) => [sc[0] + sr * Math.cos(2 * Math.PI * i / sm), sc[1] + sr * Math.sin(2 * Math.PI * i / sm)]), '#E2E2E0');
      s += text('IT', 0, sc[1] + 3 * k, 8 * k, { anchor: 'middle' });
    }
    s += text('VIGIL SYSTEMS · IT', -w + 28 * k, h - 64 * k, 12 * k, { ls: 2 * k });
    s += text('TO: m · SITE 4, NIGHTS', -w + 28 * k, h - 44 * k, 11 * k, { ls: 1.2 * k });
    s += text('CONFIDENTIAL', w - 28 * k, h - 44 * k, 10 * k, { anchor: 'end', ls: 2 * k, fill: '#B4B4B4' });
    const hit = fmt([[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => project(at(u, v))));
    return { svg: s, hit };
  }
  // held up in front of you (where the slips are held), a little turned: about 520 px across
  function heldEnvelope(rest) {
    const Z = 1500 * ENV.w * MM / 520, r = -2.5 * Math.PI / 180;
    return { c: [0, (rest + 500 - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [-Math.sin(r), Math.cos(r), 0] };
  }

  // ---- the drawer and its contents at out (0 shut .. OPEN). key: 'none' | 'lock' (and turn, 0..1, and keyOut: key mm
  // short of home); env: { lifted, opened }. Returns { under, things, over, key, hit, envHit }: the drawer's inside, what
  // lies in the tray, its near walls and front, the key in the lock (over the front), and where clicks go.
  // Things show once wholly out of the pedestal (inside it they are in the dark of the opening), as the cheat sheet's card.
  function drawer(out, { key = 'none', turn = 0, keyOut = 0, env = {} } = {}) {
    const d = window.cheatSheet.drawer(out, BOX), F = dd().F, project = dd().roomF;
    let things = '', envHit = null;
    if (out > .0005) {
      // the tray: wall to wall, from the pedestal's face to the front (its near edge under the front)
      // (runs across sampled at every px, so the desk's bend curves them; runs in depth are straight on the screen)
      const run = (a, b) => { const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]))); return Array.from({ length: n }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1], a[2] + (b[2] - a[2]) * k / n]); };
      const back = Math.max(0, worldD(0, out)), front = worldD(TRAY.f1, out);
      if (front > back) {
        const q = [[TRAY.x0, TRAY.y, back], [TRAY.x1, TRAY.y, back], [TRAY.x1, TRAY.y, front], [TRAY.x0, TRAY.y, front]];
        const ps = q.flatMap((p, i) => run(p, q[(i + 1) % 4])).map(F);
        things += `<polygon points="${fmt(ps)}" fill="#E6E6E4" ${INK}/>`;
      }
      const outOf = f => worldD(f, out) >= .0005;          // wholly out of the pedestal: its back past the face
      const R = OPEN * 1765;                               // the drawer's depth in mm (f to mm)
      if (outOf(ENV_AT.f - ENV.w / 2 / R) && !env.lifted) { const e = envelope(envelopeLying(out), project, { opened: env.opened }); things += e.svg; envHit = e.hit; }
      if (outOf(WATCH.f - (WATCH.r + WATCH.strap) / R)) things += watch(out, project);
      if (outOf(GUM.f - GUM.W / R)) things += gum(out, project);
      if (outOf(GLASSES.f - GLASSES.lh / R)) things += glasses(out, project);
      if (outOf(PEN.f - .5 * PEN.L / R)) things += pen(out, project);
    }
    let keySvg = '';
    if (key === 'lock') keySvg = oldKey(lockPose(keyOut, turn, out), project, { maxA: lockMaxA(keyOut), tag: false });
    return { under: d.under, things, over: d.over + keyhole(out), key: keySvg, hit: window.cheatSheet.drawerHit(out, BOX), envHit };
  }

  window.mDrawer = { BOX, OPEN, KH, MX, TRAY, OLDKEY, ENV, PASSWORD, keyhole, holeLoop, oldKey, oldKeyShape, deskPose, lockPose, lockMaxA, drawer, envelope, envelopeLying, heldEnvelope, watch, gum, pen, glasses, trayFrame, WATCH, GUM, PEN, GLASSES, ENV_AT };
})();
