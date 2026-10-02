/* key3d.js — the file drawer's key (design.md: the key is M.'s payoff for 14), a solid in the room's camera
   (solid.js). In its own millimetres: a along it from the bow's end (0) to the tip (40.5), b across (the cuts on +b),
   n through its thickness (2 mm).

   A small desk key: a bow with softened corners and a ring hole, a stop (where it meets the lock), a blade 4.8 wide with
   five pin-tumbler cuts (45 degree flanks, flat bottoms), a pointed tip, and a groove milled along one face. Corners
   are listed with a radius: each round one becomes the tangent arc between its two edges (convex or concave as it
   falls), sampled at `step` mm; radius 0 is a real corner, as a cut key has them. */
(function () {
  // a polygon with rounded corners: pts [[a, b, r], ...] counter-clockwise; returns the sampled loop
  function rounded(pts, step) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[(i - 1 + n) % n], [cx, cy, r] = pts[i], [nx, ny] = pts[(i + 1) % n];
      if (!r) { out.push([cx, cy]); continue; }
      const u = norm2([px - cx, py - cy]), v = norm2([nx - cx, ny - cy]);
      const half = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2;
      const along = r / Math.tan(half);                                     // from the corner to each tangent point
      const bis = norm2([u[0] + v[0], u[1] + v[1]]), dc = r / Math.sin(half);
      const C = [cx + bis[0] * dc, cy + bis[1] * dc];
      const t0 = Math.atan2(cy + u[1] * along - C[1], cx + u[0] * along - C[0]), t1 = Math.atan2(cy + v[1] * along - C[1], cx + v[0] * along - C[0]);
      let dt = t1 - t0; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
      const m = Math.max(2, Math.ceil(Math.abs(dt) * r / step));
      for (let k = 0; k <= m; k++) out.push([C[0] + r * Math.cos(t0 + dt * k / m), C[1] + r * Math.sin(t0 + dt * k / m)]);
    }
    // (where one arc ends exactly where the next begins the point comes twice: once is enough)
    for (let i = out.length - 1; i >= 0; i--) { const q = out[(i + 1) % out.length]; if (out.length > 1 && Math.hypot(out[i][0] - q[0], out[i][1] - q[1]) < 1e-9) out.splice(i, 1); }
    // straight runs subdivided too, so the projection (with the room's bend) curves them as it should
    const fine = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i], q = out[(i + 1) % out.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (step * 8)));
      for (let j = 0; j < k; j++) fine.push([p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k]);
    }
    return fine;
  }
  const norm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const circle = (c, r, step) => { const m = Math.max(12, Math.ceil(2 * Math.PI * r / step)); return Array.from({ length: m }, (_, k) => [c[0] + r * Math.cos(2 * Math.PI * k / m), c[1] + r * Math.sin(2 * Math.PI * k / m)]); };

  const CUTS = [[34, 1.1], [30.5, .6], [27, 1.4], [23.5, .8], [20, 1.0]];   // [centre a, depth], tip to bow
  // the part of a loop with a <= maxA (in a lock, the rest is inside it): Sutherland-Hodgman against one line
  function clipA(loop, maxA) {
    const out = [];
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length], pin = p[0] <= maxA, qin = q[0] <= maxA;
      if (pin) out.push(p);
      if (pin !== qin) { const t = (maxA - p[0]) / (q[0] - p[0]); out.push([maxA, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  // the outline's corners, each with its radius (0: a real corner, as a cut key has them)
  function corners() {
    const top = [];
    for (const [c, d] of CUTS) { const w = d + .25; top.push([c + w, 2.4, 0], [c + .25, 2.4 - d, .15], [c - .25, 2.4 - d, .15], [c - w, 2.4, 0]); }
    return [
      // the bow: wide at its end, its sides drawing in to the stop (a key's head), softened all round
      [0, -7.5, 4.5], [7.5, -7.5, 3.5], [12.8, -4.7, 1.6], [14.6, -4.2, .9], [17.5, -4.2, 0], [17.5, -2.4, 0],
      [39.4, -2.4, 1.2], [40.5, .1, .5], [37.6, 2.4, 0],
      ...top,
      [17.5, 2.4, 0], [17.5, 4.2, 0], [14.6, 4.2, .9], [12.8, 4.7, 1.6], [7.5, 7.5, 3.5], [0, 7.5, 4.5],
    ];
  }
  function shape(step, detail = true, maxA = null) {
    const outer = rounded(corners(), step);
    if (maxA != null) {
      const full = shape(step, detail);
      return { outer: clipA(full.outer, maxA), t: 2, holes: full.holes.filter(h => h.every(([a]) => a < maxA)), pockets: full.pockets.filter(p => p.loop.every(([a]) => a < maxA)) };
    }
    return {
      outer, t: 2,
      holes: [circle([4.4, 0], 2.6, step)],
      pockets: detail ? [{ loop: rounded([[19, -1.95, .8], [36, -1.95, .8], [36, -.35, .8], [19, -.35, .8]], step), depth: .45 }] : [],
    };
  }
  // brass reads as the drawing's warm light greys; lit and shade, as the mug's materials are
  const MATS = {
    cap: ['#F3F3F1', '#E5E5E3'], wall: ['#E2E2E0', '#D6D6D4'], hole: ['#D8D8D6', '#D2D2D0'],
    floor: ['#E2E2E0', '#DADAD8'], pocketWall: ['#D9D9D7', '#D2D2D0'],
  };
  // The key's size in the room: its own millimetres times SCALE. The drawing isn't to one scale, and a real 40 mm key
  // came out small beside the game's cartridge (10 x 25 cm in the room's millimetres) when taped to it. It was 1.45
  // (about 60% of the cartridge's width); Arnold, 2026-10-02, after playing: bigger, the lock with it: 2.0. It is that
  // size everywhere: on the cartridge, on the desk, in the lock (one true size).
  // (window.KEY_SCALE: a stills page may try another size)
  const SCALE = (window.KEY_SCALE || 2), MM = SCALE / 1.765;                 // camera units per key millimetre (1.765 mm a camera unit, drawer.js)
  /* pose: { c: camera point of the key's middle (a 20, b 0, n 0), A, B: unit axes along and across (N = A x B) };
     project: camera point -> screen. Returns svg. */
  function render(pose, project, { width = 1, stamp = true, maxA = null, scale = 1 } = {}) {
    const { c, A, B } = pose, N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const K = MM * scale, frame = (a, b, n) => { const u = (a - 20) * K, v = b * K, w = n * K; return [c[0] + A[0] * u + B[0] * v + N[0] * w, c[1] + A[1] * u + B[1] * v + N[1] * w, c[2] + A[2] * u + B[2] * v + N[2] * w]; };
    // how many pixels a millimetre is here (the larger of along and across): curves sampled every 0.2 px of it, and the
    // groove and the stamp only where the groove's two edges stand 6 px apart (1.6 mm), so they never run into one line
    const o = project(frame(20, 0, 0)), pa = project(frame(21, 0, 0)), pb = project(frame(20, 1, 0));
    const pxmm = Math.max(Math.hypot(pa[0] - o[0], pa[1] - o[1]), Math.hypot(pb[0] - o[0], pb[1] - o[1]));
    const step = Math.min(.3, .2 / pxmm), detail = 1.6 * pxmm >= 6;
    if (!detail) stamp = false;
    // the stamp on the bow: "S4" (Site 4), struck into it, read across the bow
    const st = stamp ? (fr, pr, n) => {
      const o = pr(fr(10.6, -2.2, n)), ax = pr(fr(10.6, -1.2, n)), ay = pr(fr(11.6, -2.2, n));
      const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(v => v.toFixed(4));
      return `<text transform="matrix(${m.join(' ')})" x="2.2" y="1.2" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="3.1" font-weight="600" fill="#C8C8C6">S4</text>`;
    } : null;
    return window.solid.extrusion(shape(step, detail, maxA), frame, project, MATS, { width, stamp: st });
  }
  window.key3d = { render, shape, corners, MM };
})();
