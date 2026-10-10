/* ceilup.js — the ceiling above the frame, for looking up (stills, 2026-10-05; not loaded by the game yet).

   The drawing's ceiling (scene.svg #ceiling) is one outline, 51 depth lines and 17 cross arches, and it already runs far
   above the frame (to y -635 over the middle). Its camera is not the room's (drawer.js roomF, measured on the desk): the
   grid is a pitched fisheye, measured here by fitting a camera to the 839 places where its depth lines cross its arches.
   The fit (2026-10-05): a lens centred on the frame's middle (720, 540), focal length 1226, looking 12.6 degrees up, an
   equidistant fisheye (r = f θ (1 + k1 θ² + k2 θ⁴)); every corner within 0.11 px (rms), the worst 0.79 px at the dome's
   far sides, outside every view; its horizon lands at y 810.7, the drawing's vanishing centre (720, 813). The same camera
   puts the keyboard's bottom edge, as one straight line, within 0.6 px of the measured edge from x 120 to 1320. It does
   not fit the racks: their verticals lean about 60% as much as it would make them, so the racks were drawn with a lens of
   their own, and anything standing in front of a rack is drawn through the racks' own verticals (post.js), not this.

   On the ceiling a point is (j, k): j across, in the drawing's columns (0 the middle depth line, ±25 the outermost),
   k in its rows (0 the outline's top arch, 16 the last); X = j w, Z = z0 + k dz, the ceiling one unit above the eye.

   What looking up adds: the depth lines go on past the top arch (k < 0), each starting exactly at its drawn end and on
   its drawn tangent there (a correction that fades out over its first stretch: the camera alone meets the drawn ends
   within 0.12 px and 0.04 degrees for every line inside the 16:9 frame), and the ceiling's fill behind them. Every curve
   is sampled every 0.25 px of the screen. Pure: the page hands it the drawn depth lines' path data. */
(function () {
  const CAM = { f: 1226.3845864, phi: .2205309872, cx: 720, cy: 540.0123657, k1: .0224557458, k2: -.0433932171 };
  const GRID = { z0: .3933304165, dz: .1860515329, w: .1392201051, J: 25, K: 16 };
  const cosP = Math.cos(CAM.phi), sinP = Math.sin(CAM.phi);
  // a camera point (x right, y down, z ahead; the ceiling at y = -1) to the screen
  function project([X, Y, Z]) {
    const yc = Y * cosP + Z * sinP, zc = -Y * sinP + Z * cosP, h = Math.hypot(X, yc) || 1e-12;
    const th = Math.atan2(h, zc), rd = CAM.f * th * (1 + CAM.k1 * th * th + CAM.k2 * th ** 4);
    return [CAM.cx + rd * X / h, CAM.cy + rd * yc / h];
  }
  const XZ = (j, k) => [j * GRID.w, GRID.z0 + k * GRID.dz];
  const at = (j, k) => { const [X, Z] = XZ(j, k); return project([X, -1, Z]); };
  // the screen to (j, k), by Newton from a guess
  function invert([x, y], guess = [0, 4]) {
    let [j, k] = guess;
    for (let i = 0; i < 40; i++) {
      const p = at(j, k), e = [p[0] - x, p[1] - y];
      if (Math.hypot(...e) < 1e-7) break;
      const h = 1e-5, a = at(j + h, k), b = at(j, k + h), J = [[(a[0] - p[0]) / h, (b[0] - p[0]) / h], [(a[1] - p[1]) / h, (b[1] - p[1]) / h]];
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      j -= (J[1][1] * e[0] - J[0][1] * e[1]) / det; k -= (-J[1][0] * e[0] + J[0][0] * e[1]) / det;
    }
    return [j, k];
  }
  // a run on the ceiling from (j0, k0) to (j1, k1), straight in (j, k), sampled every `step` px of the screen
  function run(a, b, step = .25) {
    const out = [at(...a)];
    let t = 0, dt = .001;
    while (t < 1) {
      let t2 = Math.min(1, t + dt), q = at(a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2);
      const p = out[out.length - 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > step && t2 - t > 1e-9) { dt *= .5; continue; }
      out.push(q); t = t2; if (d < step * .5) dt *= 1.5;
    }
    return out;
  }
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const pathOf = ps => 'M' + fmt(ps).split(' ').join('L');

  // the start of a drawn path: its first point and the direction it leaves in ("M x y C x1 y1 ..."), stage coordinates
  function startOf(d, dx = -240) {
    const n = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g).slice(0, 4).map(Number);
    const p = [n[0] + dx, n[1]], c = [n[2] + dx, n[3]], l = Math.hypot(c[0] - p[0], c[1] - p[1]);
    return { p, t: [(c[0] - p[0]) / l, (c[1] - p[1]) / l] };
  }
  /* The depth line j continued past its drawn top end E (tangent t there, pointing back down the drawn line), up to
     k = kMin. The camera's own line, plus a correction that is E's offset and the tangent's difference at the end and
     nothing after the first `blend` of the run (a cubic Hermite), so the join is exact and smooth. */
  function extend(j, E, t, kMin = -1.95, blend = .35) {
    const k0 = invert(E, [j, 0])[1];
    const m = k => at(j, k), span = k0 - kMin;
    // the camera's line at the end and its direction, per unit of s (s = (k0 - k) / span: 0 at the end, 1 at kMin)
    const h = 1e-6, M0 = m(k0), M1 = m(k0 - h * span), dm = [(M1[0] - M0[0]) / h, (M1[1] - M0[1]) / h], sp = Math.hypot(...dm);
    const D = [E[0] - M0[0], E[1] - M0[1]], want = [-t[0] * sp, -t[1] * sp], T = [want[0] - dm[0], want[1] - dm[1]];
    const corr = s => { if (s >= blend) return [0, 0]; const u = s / blend, h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = (u ** 3 - 2 * u * u + u) * blend; return [D[0] * h00 + T[0] * h10, D[1] * h00 + T[1] * h10]; };
    const P = s => { const q = m(k0 - s * span), c = corr(s); return [q[0] + c[0], q[1] + c[1]]; };
    const out = [E.slice()];
    let s = 0, ds = 1e-4;
    while (s < 1) {
      const s2 = Math.min(1, s + ds), q = P(s2), p = out[out.length - 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > .25) { ds *= .5; continue; }
      out.push(q); s = s2; if (d < .12) ds *= 1.5;
    }
    return { pts: out, k0, offset: Math.hypot(...D), turn: Math.acos(Math.max(-1, Math.min(1, (-t[0] * dm[0] - t[1] * dm[1]) / sp))) * 180 / Math.PI };
  }
  /* The ceiling above the drawn outline, as svg: its fill, then the depth lines continued. radials: [{ j, d }] (the
     drawn depth lines' path data, j -25..25); top: the drawn top arch's points (stage), for the fill's lower edge.
     view: [x0, y0, x1, y1], what must be covered. */
  function above({ radials, top, view = [-260, -620, 1700, 0] }) {
    const ext = [];
    for (const { j, d } of radials) {
      const s = startOf(d);
      if (s.p[1] > view[3] + 40) continue;
      const e = extend(j, s.p, s.t);
      // keep only lines that reach into the view
      if (e.pts.some(q => q[0] >= view[0] - 2 && q[0] <= view[2] + 2 && q[1] >= view[1] - 2 && q[1] <= view[3])) ext.push({ j, ...e });
    }
    // the fill: everything above the top arch, out past the view
    const arch = top.filter(q => q[0] > view[0] - 400 && q[0] < view[2] + 400 && q[1] < 200);
    if (arch[0][0] > arch[arch.length - 1][0]) arch.reverse();          // left to right, so the fill's outline never crosses itself
    const fill = [...arch, [arch[arch.length - 1][0], view[1] - 600], [arch[0][0], view[1] - 600]];
    // (the fill goes under the drawing's ceiling, so it never covers half the top arch's line; the lines over it)
    const under = `<polygon points="${fmt(fill)}" fill="#F6F6F4"/>`, over = ext.map(e => `<path d="${pathOf(e.pts)}" fill="none" stroke="#DCDCDA" stroke-linejoin="round"/>`).join('');
    return { under, over, lines: ext, fill };
  }

  /* A flat ring on the ceiling round (jc, kc): radius r and R in the ceiling's units (X), as two loops sampled every
     0.25 px; inner and outer. (A circle on the ceiling, not a cell's shape: X and Z share a unit.) */
  function ring(X0, Z0, r, step = .25) {
    const pt = a => project([X0 + r * Math.cos(a), -1, Z0 + r * Math.sin(a)]);
    const out = [pt(0)]; let a = 0, da = .002;
    while (a < 2 * Math.PI) {
      const a2 = Math.min(2 * Math.PI, a + da), q = pt(a2), p = out[out.length - 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > step) { da *= .5; continue; }
      if (a2 < 2 * Math.PI) out.push(q);
      a = a2; if (d < step * .5) da *= 1.5;
    }
    return out;
  }
  const api = { CAM, GRID, project, at, XZ, invert, run, extend, above, ring, startOf, fmt, pathOf };
  if (typeof window !== 'undefined') window.ceilingUp = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
