/* post.js — the visible pneumatic tube (stills, 2026-10-05; not loaded by the game yet). Comes down out of the ceiling in
   front of the inner left rack's left half (clear of every LED at every window shape), into a receiver on the desk's back
   left corner; a canister drops into its window, a click opens it, its slip comes up to you, the canister goes back up.

   The lens. The drawing has two: the ceiling's (ceilup.js) and the racks'. A thing standing in front of a rack is drawn
   through the racks' own verticals: the flat camera (drawer.js proj, f 1500 at the eye) bent across by the drawn desk
   edge's bow and warped sideways between the inner left rack's two real front edges, sampled from the drawing (the
   archived tube's lens, 2026-10-02: its edges then leaned as the rack's do and bowed as theirs). Where the tube meets the
   ceiling, the ceiling's camera draws the ring it goes through, fitted to the tube's own silhouette there. */
(function () {
  // ---- the lens, from the drawing: the rack's two front edges, and the desk's back edge (stage coordinates)
  function edgeRun(svg, group, top, bot) {
    const inv = svg.getScreenCTM().inverse();
    let best = null;
    for (const p of svg.querySelector('#' + group).querySelectorAll('path')) {
      const L = p.getTotalLength(); if (L < 300) continue;
      const m = p.getScreenCTM(), n = Math.ceil(L / 1.5), pts = [];
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n), s = new DOMPoint(q.x, q.y).matrixTransform(m).matrixTransform(inv); pts.push([s.x, s.y]); }
      const near = pts.filter(([x, y]) => { if (y < top[1] - 2 || y > bot[1] + 2) return false; const t = (y - top[1]) / (bot[1] - top[1]), cx = top[0] + (bot[0] - top[0]) * t; return Math.abs(x - cx) < 40; });
      if (near.length > 200 && (!best || near.length > best.length)) best = near;
    }
    best.sort((a, b) => a[1] - b[1]);
    // one point a pixel row, the one nearest the chord (the path may run along the edge twice)
    const chord = y => top[0] + (bot[0] - top[0]) * (y - top[1]) / (bot[1] - top[1]), byY = [];
    for (const p of best) { const k = Math.round(p[1]); if (!byY[k] || Math.abs(p[0] - chord(k)) < Math.abs(byY[k][0] - chord(k))) byY[k] = p; }
    return byY.filter(Boolean);
  }
  // a cubic x(y) through an edge's points, refitted without any point more than 2 px off (the path runs along the edge twice
  // in places, and its corners)
  function fitCubic(pts) {
    let use = pts, c = null;
    for (let it = 0; it < 6; it++) {
      const ym = use.reduce((a, p) => a + p[1], 0) / use.length, ys = 500, M = Array.from({ length: 4 }, () => new Array(5).fill(0));
      for (const [x, y] of use) { const t = (y - ym) / ys, v = [1, t, t * t, t * t * t]; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) M[i][j] += v[i] * v[j]; M[i][4] += v[i] * x; } }
      for (let i = 0; i < 4; i++) { let p = i; for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < 4; r++) if (r !== i) { const k = M[r][i] / M[i][i]; for (let j = i; j < 5; j++) M[r][j] -= k * M[i][j]; } }
      c = { ym, ys, co: M.map((row, i) => row[4] / row[i]) };
      const at = y => { const t = (y - c.ym) / c.ys; return c.co[0] + c.co[1] * t + c.co[2] * t * t + c.co[3] * t * t * t; };
      const keep = pts.filter(([x, y]) => Math.abs(x - at(y)) <= 2);
      if (keep.length === use.length) break;
      use = keep;
    }
    const at = y => { const t = (y - c.ym) / c.ys; return c.co[0] + c.co[1] * t + c.co[2] * t * t + c.co[3] * t * t * t; };
    const res = use.map(([x, y]) => Math.abs(x - at(y)));
    // past the data (above the rack's top), on along the edge's own direction at its end, so nothing turns up there
    const y0 = use[0][1], s0 = (at(y0 + .5) - at(y0 - .5));
    return { at: y => y >= y0 ? at(y) : at(y0) + (y - y0) * s0, y0, maxResidual: Math.max(...res), kept: use.length };
  }
  function lensFrom(svg) {
    const A = fitCubic(edgeRun(svg, 'rack-left', [360, 60], [219, 1008])), C = fitCubic(edgeRun(svg, 'rack-left', [-37, 110], [-247, 925]));
    // the desk's back edge (Vector_1616), its lowest point every 4 px across: a curve y(x) in even powers
    const inv = svg.getScreenCTM().inverse(), p = svg.querySelector('#Vector_1616'), m = p.getScreenCTM(), L = p.getTotalLength(), bins = {};
    for (let i = 0; i <= 6000; i++) { const q = p.getPointAtLength(L * i / 6000), s = new DOMPoint(q.x, q.y).matrixTransform(m).matrixTransform(inv); if (s.y > 880) continue; const k = Math.round(s.x / 4); if (!(k in bins) || s.y > bins[k]) bins[k] = s.y; }
    const pts = Object.keys(bins).map(Number).sort((a, b) => a - b).map(k => [k * 4, bins[k]]).filter(([x]) => x > -300 && x < 1740);
    const M = Array.from({ length: 4 }, () => new Array(5).fill(0));
    for (const [x, y] of pts) { const u = (x - 720) / 700, v = [1, u * u, u ** 4, u ** 6]; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) M[i][j] += v[i] * v[j]; M[i][4] += v[i] * y; } }
    for (let i = 0; i < 4; i++) { let q = i; for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[q][i])) q = r; [M[i], M[q]] = [M[q], M[i]]; for (let r = 0; r < 4; r++) if (r !== i) { const k = M[r][i] / M[i][i]; for (let j = i; j < 5; j++) M[r][j] -= k * M[i][j]; } }
    const co = M.map((row, i) => row[4] / row[i]);
    const edgeY = x => { const u = (x - 720) / 700; return co[0] + co[1] * u * u + co[2] * u ** 4 + co[3] * u ** 6; };
    const yRef = 878, MID = 540, c0 = edgeY(720), a0 = A.at(yRef), cc0 = C.at(yRef);
    // horizontals bent by the drawn edge's bow, scaled by how far from the frame's middle (none at y 540)
    const hbend = ([x, y]) => [x, y + (edgeY(x) - c0) * (y - MID) / (c0 - MID)];
    // verticals along the rack's edges, in proportion between them (nothing moves at the desk's height, y 878)
    const warp = ([x, y]) => { const w = (x - cc0) / (a0 - cc0); return [C.at(y) + w * (A.at(y) - C.at(y)), y]; };
    const flat = window.deskDrawer.proj;
    return { A, C, edgeY, hbend, warp, proj: p => warp(hbend(flat(p))), fits: { A: A.maxResidual, C: C.maxResidual } };
  }

  // ---- the station: a frame in millimetres (x right, y up from the desk, z away) standing on the desk at a point of the
  // screen, at a depth in the room's camera (drawer.js: f 1500, a camera unit 1.765 mm)
  const MM = 1 / 1.765, F = 1500;
  const V3 = {
    add: (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]], sub: (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]],
    mul: (p, k) => [p[0] * k, p[1] * k, p[2] * k], dot: (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2],
    cross: (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]],
    unit: p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); },
  };
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  // (lines to a ten-thousandth of a pixel: a tight curve's 0.01 px steps, to two places, jittered in direction by up to 13
  // degrees, to three by 6)
  const fmt3 = ps => ps.map(q => q[0].toFixed(4) + ',' + q[1].toFixed(4)).join(' ');
  const pathOf = ps => 'M' + fmt3(ps).split(' ').join('L');
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round"';
  // the camera point that the lens puts at the screen point (sx, sy), at depth Z
  function solveAt(proj, sx, sy, Z) {
    let X = (sx - 720) * Z / F, Y = (sy - 813) * Z / F;
    for (let i = 0; i < 30; i++) {
      const p = proj([X, Y, Z]), h = .01, px = proj([X + h, Y, Z]), py = proj([X, Y + h, Z]);
      const J = [[(px[0] - p[0]) / h, (py[0] - p[0]) / h], [(px[1] - p[1]) / h, (py[1] - p[1]) / h]], e = [p[0] - sx, p[1] - sy];
      if (Math.hypot(...e) < 1e-9) break;
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      X -= (J[1][1] * e[0] - J[0][1] * e[1]) / det; Y -= (-J[1][0] * e[0] + J[0][0] * e[1]) / det;
    }
    return [X, Y, Z];
  }
  function stationAt(lens, foot, Z, s = 1) {
    const O = solveAt(lens.proj, foot[0], foot[1], Z), k = MM * s;
    const W = (x, y, z) => [O[0] + x * k, O[1] - y * k, O[2] + z * k];
    return { O, k, W, proj: lens.proj, foot, Z, s };
  }

  // ---- sizes (mm). A 4 inch line (96 mm across), a receiver wider (132) with a window cut in its front, standing on a
  // plinth on the desk; the canister is delivery.js's own (60 across, 150 long), standing in the window. At this depth a mm
  // is 0.48 px, a touch nearer than the rack's own units (44.45 mm a unit, 19.7 px: 0.44).
  const SZ = {
    // the plinth: a band at the receiver's foot, flush with it, a shade darker (a foot wider than the body showed its top as
    // a sliver: at the desk's back the eye is nearly level with it)
    plinth: { h: 26 },
    // the receiver: the canister standing in its window with room above it to drop in
    // (the window 45 degrees either side of you: at 62 its edges stood 3 px inside the outline; its top 24 mm under the
    // receiver's top, so the two lines stand 11 px apart. The wall is thin: its cut faces at the window's edges would be
    // slivers of a pixel or two, so the window is the inside's tone right up to its outline.)
    // (Arnold, 2026-10-05: a plate under the window. Between the plinth and the window there were 34 mm, 16 px: a plate and
    // its two gaps of 6 px could not fit, so the window's sill and the floor inside both went up 38 mm: the canister shows
    // in the window exactly as before, with less room over it.)
    rec: { r: 66, wall: 4, h0: 0, h1: 290, floor: 56, win0: 98, win1: 266, half: 45 * Math.PI / 180 },
    // the plate: STORES / LEVEL 2, flush on the body under the window and exactly as wide (its sides run on from the
    // window's), 44 mm tall (21 px), 14 mm (6.7 px) from the plinth's line and from the sill; lettered as the old INTERNAL
    // POST label was, in the company's monospace, grey, a glyph at a time round the body (13 mm: the label's 6.2 px here)
    plate: { h0: 40, h1: 84, font: 13, adv: 7.75, lines: [['STORES', 19], ['LEVEL 2', 36]] },
    red: { h0: 290, h1: 342 },                           // the shoulder: an S from the receiver's body into the line, upright at both ends
    line: { r: 48 },
    band: { h: 44 },                                     // a coupling: a sleeve flush with the line, edged by a ring each side
  };

  // ---- an upright cylinder (the line), drawn through any projection: two fills (lit and shade, by the mug's light),
  // its two silhouettes (generators, sampled every 0.4 mm so the lens bends them) and, if asked, its end rings' near
  // halves. For a cylinder and a pinhole eye the silhouettes are whole generators at two fixed angles.
  function cylinderParts(st, r, h0, h1, { lit = '#ECECEA', shade = '#DCDCDA' } = {}) {
    const { O, k, W, proj } = st, L = window.solid.L;
    const R0 = Math.hypot(O[0], O[2]), al = Math.atan2(O[2], O[0]), c = Math.acos(Math.max(-1, Math.min(1, -k * r / R0)));
    // the two silhouettes, ordered so that the visible side runs from a0 up to a1 (it faces the eye: n.P < 0)
    let a0 = al + c, a1 = al + 2 * Math.PI - c;
    const mid = (a0 + a1) / 2, nP = a => O[0] * Math.cos(a) + O[2] * Math.sin(a) + k * r;
    if (nP(mid) > 0) { a0 = al - c; a1 = al + c; }
    // where the tone changes across it: n.L = .15
    const nl = a => Math.cos(a) * L[0] + Math.sin(a) * L[2];
    const cuts = [];
    for (let i = 0; i < 720; i++) { const a = a0 + (a1 - a0) * i / 720, b = a0 + (a1 - a0) * (i + 1) / 720; if ((nl(a) - .15) * (nl(b) - .15) < 0) { let lo = a, hi = b; for (let j = 0; j < 50; j++) { const m = (lo + hi) / 2; if ((nl(lo) - .15) * (nl(m) - .15) <= 0) hi = m; else lo = m; } cuts.push((lo + hi) / 2); } }
    const spans = [a0, ...cuts, a1].map((a, i, arr) => i < arr.length - 1 ? [a, arr[i + 1]] : null).filter(Boolean);
    const P = (a, h) => proj(W(r * Math.cos(a), h, r * Math.sin(a)));
    const gen = (a, ha, hb) => { const n = Math.max(2, Math.ceil(Math.abs(hb - ha) / .4)); return Array.from({ length: n + 1 }, (_, i) => P(a, ha + (hb - ha) * i / n)); };
    // a ring's near half, stepped so that no step is over 0.25 px and none turns over 1 degree on the screen (Arnold,
    // 2026-10-05: a coupling's ring, nearly edge-on, turns 55 degrees in its last 2 px into the silhouette; stepped by
    // length alone its first steps left the silhouette 2.5 degrees off its tangent and jittered 13 degrees, a 15 degree
    // kink at 10x). At a silhouette angle the ring's tangent is the silhouette's, so its first step leaves on it.
    const dirAt = (a, h) => { const p = P(a - 1e-7, h), q = P(a + 1e-7, h); return Math.atan2(q[1] - p[1], q[0] - p[0]); };
    const ring = (h, aa, ab) => {
      const out = [P(aa, h)], sgn = Math.sign(ab - aa), ONE = Math.PI / 180;
      let a = aa, da = (ab - aa) / 400, t0 = dirAt(aa, h);
      while ((ab - a) * sgn > 1e-12) {
        let a2 = a + da; if ((ab - a2) * sgn < 0) a2 = ab;
        const q = P(a2, h), p = out[out.length - 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]), t1 = dirAt(a2, h), turn = Math.abs(Math.atan2(Math.sin(t1 - t0), Math.cos(t1 - t0)));
        if ((d > .25 || turn > ONE) && Math.abs(a2 - a) > 1e-9) { da *= .5; continue; }
        out.push(q); a = a2; t0 = t1;
        if (d < .12 && turn < ONE / 2) da *= 1.5;
      }
      return out;
    };
    const fills = spans.map(([sa, sb]) => ({ pts: [...gen(sa, h0, h1), ...ring(h1, sa, sb), ...gen(sb, h1, h0), ...ring(h0, sb, sa)], fill: nl((sa + sb) / 2) > .15 ? lit : shade }));
    return { a0, a1, spans, fills, gen, ring, P, silhouettes: [gen(a0, h0, h1), gen(a1, h0, h1)] };
  }

  // ---- a region of an upright cylinder's near side, between two angles and two heights, as fills split where its tone
  // changes (the same geometry as cylinderParts); its outline pieces for the caller to stroke
  function region(geo, aA, aB, hA, hB, mat) {
    const cuts = [aA, ...geo.cuts.filter(c => (c - aA) * (c - aB) < 0).sort((u, v) => (u - aA) / (aB - aA) - (v - aA) / (aB - aA)), aB];
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const sa = cuts[i], sb = cuts[i + 1];
      out.push({ pts: [...geo.gen(sa, hA, hB), ...geo.ring(hB, sa, sb), ...geo.gen(sb, hB, hA), ...geo.ring(hA, sb, sa)], fill: geo.nl((sa + sb) / 2) > .15 ? mat[0] : mat[1] });
    }
    return out;
  }
  const geoOf = (st, r) => { const c = cylinderParts(st, r, 0, 1); const L = window.solid.L; return { ...c, nl: a => Math.cos(a) * L[0] + Math.sin(a) * L[2], cuts: c.spans.slice(1).map(s => s[0]) }; };

  /* ---- a surface of revolution about the station's upright axis, r(h) from h0 to h1 (the shoulder), drawn as the line is:
     at each height its silhouettes and the angle where its tone changes are solved exactly (for a pinhole eye, n.P = 0 and
     n.L = .15 are each one cosine), so the outline and the light's edge are smooth curves (turned in narrow bands, the
     light's edge was a staircase of 0.8 px steps). Returns fills (strips of one tone merged up the height) and the two
     silhouettes; rings at h0 and h1 for the caller. */
  function revolution(st, rf, h0, h1, mat, step = .25) {
    const { O, k, W, proj } = st, L = window.solid.L, R0 = Math.hypot(O[0], O[2]), al = Math.atan2(O[2], O[0]);
    const hs = []; { const n = Math.ceil((h1 - h0) / step); for (let i = 0; i <= n; i++) hs.push(h0 + (h1 - h0) * i / n); }
    const slope = h => (rf(Math.min(h1, h + 1e-3)) - rf(Math.max(h0, h - 1e-3))) / (Math.min(h1, h + 1e-3) - Math.max(h0, h - 1e-3));
    const P = (a, h) => proj(W(rf(h) * Math.cos(a), h, rf(h) * Math.sin(a)));
    const A = Math.hypot(L[0], L[2]), be = Math.atan2(L[2], L[0]);
    const rows = hs.map(h => {
      const r = rf(h), s = slope(h), c = Math.acos(Math.max(-1, Math.min(1, -(s * O[1] + k * (r - s * h)) / R0)));
      let a0 = al + c, a1 = al + 2 * Math.PI - c;
      const facing = a => O[0] * Math.cos(a) + O[2] * Math.sin(a) + s * O[1] + k * (r - s * h);
      if (facing((a0 + a1) / 2) > 0) { a0 = al - c; a1 = al + c; }
      // the tone's edge: n.L = .15 with n = (cos a, s, sin a) / sqrt(1 + s^2)
      const cc = (.15 * Math.sqrt(1 + s * s) - s * L[1]) / A, cuts = [];
      if (Math.abs(cc) <= 1) for (const t of [be + Math.acos(cc), be - Math.acos(cc)]) { let u = t; while (u < a0) u += 2 * Math.PI; while (u > a1) u -= 2 * Math.PI; if (u > a0 && u < a1) cuts.push(u); }
      cuts.sort((p, q) => p - q);
      const edges = [a0, ...cuts, a1], tone = a => (Math.cos(a) * L[0] + s * L[1] + Math.sin(a) * L[2]) / Math.sqrt(1 + s * s) > .15 ? mat[0] : mat[1];
      return { h, edges, tones: edges.slice(0, -1).map((e, i) => tone((e + edges[i + 1]) / 2)) };
    });
    // one fill of the whole near side in the shade, and over it the lit part: the light falls on one run of angles at each
    // height (centred where the surface faces it), so the lit part is one region between two smooth edges (strips of one
    // tone, merged, left wedges thinner than their seal stroke where the light's edge came in through the outline)
    const litOf = r => {
      const s2 = slope(r.h), cc = (.15 * Math.sqrt(1 + s2 * s2) - s2 * L[1]) / A, a0 = r.edges[0], a1 = r.edges[r.edges.length - 1];
      if (cc >= 1) return [a0, a0];
      if (cc <= -1) return [a0, a1];
      const w = Math.acos(cc); let c = be; while (c < a0 - Math.PI) c += 2 * Math.PI; while (c > a1 + Math.PI) c -= 2 * Math.PI;
      const lo = Math.max(a0, c - w), hi = Math.min(a1, c + w);
      return hi > lo ? [lo, hi] : [a0, a0];
    };
    // (their tops and bottoms along the end rings' arcs, not across them: a chord left a sliver of background under the ring)
    const arc = (h, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * rf(h) * k * F / Math.hypot(...W(0, h, 0)) / .25)); return Array.from({ length: n + 1 }, (_, i) => P(a0 + (a1 - a0) * i / n, h)); };
    const first = rows[0], last = rows[rows.length - 1], E = r => r.edges[r.edges.length - 1];
    const lit = rows.map(litOf), all = [...rows.map(r => P(r.edges[0], r.h)), ...arc(last.h, last.edges[0], E(last)).slice(1, -1), ...rows.slice().reverse().map(r => P(E(r), r.h)), ...arc(first.h, E(first), first.edges[0]).slice(1, -1)];
    const lf = lit[0], ll = lit[lit.length - 1];
    const litPts = [...rows.map((r, i) => P(lit[i][0], r.h)), ...arc(last.h, ll[0], ll[1]).slice(1, -1), ...rows.slice().reverse().map((r, i) => P(lit[rows.length - 1 - i][1], r.h)), ...arc(first.h, lf[1], lf[0]).slice(1, -1)];
    const fills = [{ pts: all, fill: mat[1] }, { pts: litPts, fill: mat[0] }];
    const sil = [rows.map(r => P(r.edges[0], r.h)), rows.map(r => P(r.edges[r.edges.length - 1], r.h))];
    const ring = (h, side = rows.find(r => Math.abs(r.h - h) < 1e-9) || rows[0]) => { const a0 = side.edges[0], a1 = side.edges[side.edges.length - 1], out = []; const n = 1600; for (let i = 0; i <= n; i++) out.push(P(a0 + (a1 - a0) * i / n, h)); return out; };
    return { fills, sil, ringAt: h => ring(h, rows.reduce((b, r) => Math.abs(r.h - h) < Math.abs(b.h - h) ? r : b)) };
  }
  // a fill sealed in its own tone (two fills of one tone side by side leave no hairline of background between them)
  const sealed = (pts, fill) => `<polygon points="${fmt(pts)}" fill="${fill}" stroke="${fill}" stroke-width=".5" stroke-linejoin="round"/>`;

  // ---- placing the line: its top in the middle of a ceiling cell. foot: where the receiver stands on the desk (screen),
  // Z its depth; returns the station and the height (mm) at which the line's axis meets the cell's middle on the screen.
  function place(lens, cell, footY, Z) {
    const CU = window.ceilingUp, target = CU.at(cell[0] + .5, cell[1] + .5);
    let bx = 100, h = 2600;
    for (let i = 0; i < 40; i++) {
      const f = (bx2, h2) => stationAt(lens, [bx2, footY], Z).proj(stationAt(lens, [bx2, footY], Z).W(0, h2, 0));
      const p = f(bx, h), e = [p[0] - target[0], p[1] - target[1]];
      if (Math.hypot(...e) < 1e-6) break;
      const px = f(bx + .1, h), ph = f(bx, h + 1), J = [[(px[0] - p[0]) / .1, (ph[0] - p[0]) / 1], [(px[1] - p[1]) / .1, (ph[1] - p[1]) / 1]];
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      bx -= (J[1][1] * e[0] - J[0][1] * e[1]) / det; h -= (-J[1][0] * e[0] + J[0][0] * e[1]) / det;
    }
    return { st: stationAt(lens, [bx, footY], Z), top: h, target };
  }

  /* ---- where the line goes into the ceiling: a flat ring on the ceiling (the ceiling's own camera, ceilup.js), its inner
     edge the line's: the inner circle is solved so that its points whose tangent runs along each of the line's two
     silhouettes lie on those silhouettes (so the line's outline turns into the ring's near half exactly, on its tangent);
     its centre is kept on the cell's middle row. outer: the ring's width over the line's radius. */
  function junction(st, top, cell, { outer = 1.5 } = {}) {
    const CU = window.ceilingUp, r = SZ.line.r, cyl = cylinderParts(st, r, top - 400, top + 400);
    // each silhouette near the top, as a line: a point and a direction (the run 400 mm either side of the top is straight
    // to well under a pixel)
    const sil = cyl.silhouettes.map(g => { const m = g[Math.floor(g.length / 2)], a = g[Math.floor(g.length / 2) - 20], b = g[Math.floor(g.length / 2) + 20], d = V3.unit([b[0] - a[0], b[1] - a[1], 0]); return { m, d: [d[0], d[1]] }; });
    const Zc = CU.XZ(0, cell[1] + .5)[1];
    // the circle's point whose tangent is along d (two: the side toward the silhouette's own side)
    // (the tangent turns once round the circle, so it is along d at two points; the one on the given side)
    const tangentPoint = (X0, rr, d, side) => {
      const at = a => CU.project([X0 + rr * Math.cos(a), -1, Zc + rr * Math.sin(a)]);
      const crossAt = a => { const p = at(a), q = at(a + 1e-6); return (q[0] - p[0]) * d[1] - (q[1] - p[1]) * d[0]; };
      const n = 180, roots = [];
      let pa = 0, pc = crossAt(0);
      for (let i = 1; i <= n; i++) {
        const a = 2 * Math.PI * i / n, c = crossAt(a);
        if (pc * c <= 0) { let lo = pa, hi = a, clo = pc; for (let j = 0; j < 50; j++) { const m = (lo + hi) / 2, cm = crossAt(m); if (clo * cm <= 0) hi = m; else { lo = m; clo = cm; } } const r = (lo + hi) / 2; roots.push({ a: r, p: at(r) }); }
        pa = a; pc = c;
      }
      return roots.sort((u, v) => side * (v.p[0] - u.p[0]))[0];
    };
    // its distance off a silhouette line (signed)
    const off = (p, s) => (p[0] - s.m[0]) * s.d[1] - (p[1] - s.m[1]) * s.d[0];
    const [sl, sr] = sil[0].m[0] < sil[1].m[0] ? [sil[0], sil[1]] : [sil[1], sil[0]];
    let X0 = CU.invert(CU.at(cell[0] + .5, cell[1] + .5), [cell[0], cell[1]])[0] * CU.GRID.w, rr = CU.GRID.w * .3;
    for (let it = 0; it < 30; it++) {
      const g = (x, q) => [off(tangentPoint(x, q, sl.d, -1).p, sl), off(tangentPoint(x, q, sr.d, 1).p, sr)];
      const e = g(X0, rr); if (Math.hypot(...e) < 1e-4) break;
      const hx = 1e-5, ex = g(X0 + hx, rr), er = g(X0, rr + hx), J = [[(ex[0] - e[0]) / hx, (er[0] - e[0]) / hx], [(ex[1] - e[1]) / hx, (er[1] - e[1]) / hx]];
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      X0 -= (J[1][1] * e[0] - J[0][1] * e[1]) / det; rr -= (-J[1][0] * e[0] + J[0][0] * e[1]) / det;
    }
    const TL = tangentPoint(X0, rr, sl.d, -1), TR = tangentPoint(X0, rr, sr.d, 1);
    // the inner circle's near half: from TL to TR the way that passes its nearest point (the smaller Z)
    const pt = a => CU.project([X0 + rr * Math.cos(a), -1, Zc + rr * Math.sin(a)]);
    let aL = TL.a, aR = TR.a;
    const nearMid = (a, b) => Math.sin((a + b) / 2) < 0;           // sin < 0: Z below the centre, nearer the eye
    if (!nearMid(aL, aR)) { if (aR < aL) aR += 2 * Math.PI; else aL += 2 * Math.PI; }
    const arc = []; { const n0 = 4000; for (let i = 0; i <= n0; i++) arc.push(pt(aL + (aR - aL) * i / n0)); }
    return { X0, Z0: Zc, r: rr, R: rr * outer, TL: TL.p, TR: TR.p, arc, sl, sr, gap: [off(TL.p, sl), off(TR.p, sr)] };
  }

  // ---- materials: the drawing's greys, [lit, shade] by the mug's light
  const MAT = {
    line: ['#EEEEEC', '#E0E0DE'], band: ['#E2E2E0', '#D6D6D4'], body: ['#EEEEEC', '#E0E0DE'], inside: ['#D2D2D0', '#D2D2D0'],
    foot: ['#E6E6E4', '#D8D8D6'], collar: '#E8E8E6',
  };
  // a profile's runs cut every `step` mm, so the lens bends everything along them (fills and lines alike)
  function fine(profile, step = 2) {
    const out = [];
    for (let i = 0; i < profile.length - 1; i++) {
      const [h0, r0, m] = profile[i], [h1, r1] = profile[i + 1], n = Math.max(1, Math.ceil(Math.hypot(h1 - h0, r1 - r0) / step));
      for (let k = 0; k < n; k++) out.push([h0 + (h1 - h0) * k / n, r0 + (r1 - r0) * k / n, m]);
    }
    out.push(profile[profile.length - 1]);
    return out;
  }
  // the receiver's window: centred on the direction toward the eye
  function windowCut(st, N) {
    const C = st.W(0, 0, 0), U = V3.sub(st.W(1, 0, 0), C), V = V3.sub(st.W(0, 0, 1), C), toEye = V3.mul(C, -1);
    const phi = Math.atan2(V3.dot(toEye, V) / Math.hypot(...V), V3.dot(toEye, U) / Math.hypot(...U));
    const idx = a => ((Math.round(a / (2 * Math.PI) * N) % N) + N) % N, R = SZ.rec;
    return { h0: R.win0, h1: R.win1, i0: idx(phi - R.half), i1: idx(phi + R.half), rIn: R.r - R.wall, rOut: R.r };
  }
  const axisFrame = (st, h = 0, s = 1) => { const C = st.W(0, h, 0); return { C, A: V3.mul(V3.sub(st.W(0, h + 1, 0), C), s), U: V3.mul(V3.sub(st.W(1, h, 0), C), s), V: V3.mul(V3.sub(st.W(0, h, 1), C), s) }; };
  const sortSvg = l => l.sort((a, b) => b.depth - a.depth).map(x => x.svg).join('');
  // fills first, then every line over them (a turned thing's narrow bands each covered half the line before them)
  const linesLast = s => s.replace(/<path [^>]*\/>/g, '') + [...s.matchAll(/<path [^>]*\/>/g)].map(m => m[0]).join('');

  // the setting a still draws: where the station stands and the line's top (solved once; see place())
  let SETUP = null;
  function setup(lens) {
    if (SETUP && SETUP.lens === lens) return SETUP;
    const CELL = [-4, 3], FOOT_Y = 888, Z = 1700, CU = window.ceilingUp;
    let { st, top } = place(lens, CELL, FOOT_Y, Z), jn = junction(st, top, CELL);
    // then the ring itself in the middle of its tile: the foot moved along the desk until the ring's centre is on the
    // cell's middle column (the axis's top on the screen and the ring's centre differ: the two lenses)
    const Xc = (CELL[0] + .5) * CU.GRID.w;
    let b0 = st.foot[0], e0 = jn.X0 - Xc, b1 = b0 + 5;
    for (let i = 0; i < 20 && Math.abs(e0) > 1e-7; i++) {
      const s1 = stationAt(lens, [b1, FOOT_Y], Z), j1 = junction(s1, top, CELL), e1 = j1.X0 - Xc;
      const b2 = b1 - e1 * (b1 - b0) / (e1 - e0); b0 = b1; e0 = e1; b1 = b2; st = s1; jn = j1;
    }
    st = stationAt(lens, [b1, FOOT_Y], Z); jn = junction(st, top, CELL);
    return (SETUP = { lens, st, top, cell: CELL, jn });
  }

  // ---- the plate under the window (geo: the body's cylinder; w0, w1: the window's sides): one flat grey, its outline, and
  // its lettering a glyph at a time, each placed by the body's own frame at its middle (a glyph is 7.75 mm round a 66 mm
  // radius: its ends under 0.01 mm off the curve)
  function plate(geo, w0, w1) {
    const P = SZ.plate, pts = [...geo.gen(w0, P.h0, P.h1), ...geo.ring(P.h1, w0, w1), ...geo.gen(w1, P.h1, P.h0), ...geo.ring(P.h0, w1, w0)];
    const r = SZ.rec.r, mid = (w0 + w1) / 2, d = .01;
    // which way round reads left to right on the screen
    const dir = geo.P(mid + .01, P.h0)[0] > geo.P(mid, P.h0)[0] ? 1 : -1;
    let text = '';
    for (const [line, down] of P.lines) {
      const h = P.h1 - down;
      [...line].forEach((ch, i) => {
        if (ch === ' ') return;
        const a = mid + dir * (i - (line.length - 1) / 2) * P.adv / r, o = geo.P(a, h), ex = geo.P(a + dir * d / r, h), ey = geo.P(a, h - d);
        const m = [(ex[0] - o[0]) / d, (ex[1] - o[1]) / d, (ey[0] - o[0]) / d, (ey[1] - o[1]) / d, o[0], o[1]].map(v => v.toFixed(4)).join(' ');
        text += `<text transform="matrix(${m})" x="0" y="0" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="${P.font}" fill="#8E8E8C">${ch}</text>`;
      });
    }
    return `<polygon points="${fmt(pts)}" fill="#E8E8E6" ${INK}/>${text}`;
  }
  // the parts that never move, drawn once: the ring in the ceiling, the receiver's inside (behind a canister standing in
  // it), and everything in front of one (the receiver's body round its window, the shoulder, the line, its top seam); and
  // where a click takes the receiver
  let STATICS = null;
  function statics(lens) {
    if (STATICS && STATICS.lens === lens) return STATICS;
    const S = setup(lens), { st, top, jn } = S, R = SZ.rec, line = SZ.line;
    // ---- the ceiling: the ring the line goes through (under the line, which covers its far half)
    const CU = window.ceilingUp, outer = CU.ring(jn.X0, jn.Z0, jn.R);
    const ring = `<polygon points="${fmt(outer)}" fill="${MAT.collar}" ${INK}/>`;
    // ---- the line: from the shoulder to past the ceiling, clipped along the ring's near half
    const cyl = cylinderParts(st, line.r, SZ.red.h1, top + 900, { lit: MAT.line[0], shade: MAT.line[1] });
    const far = 4000, clip = [...jn.arc, [jn.TR[0] + far * .3, jn.TR[1] + far], [jn.TL[0] - far * .3, jn.TL[1] + far]];
    const cutAt = (g, T) => { let best = 0, bd = 1e9; g.forEach((p, i) => { const d = Math.hypot(p[0] - T[0], p[1] - T[1]); if (d < bd) { bd = d; best = i; } }); return [...g.slice(0, best), T]; };
    const [g0, g1] = cyl.silhouettes, left = g0[g0.length - 1][0] < g1[g1.length - 1][0] ? 0 : 1;
    const silL = cutAt(cyl.silhouettes[left], jn.TL), silR = cutAt(cyl.silhouettes[1 - left], jn.TR);
    // couplings: sleeves flush with the line, a shade darker, a ring each side (the near half)
    const bands = [900, 1700].map(h => { const b = cylinderParts(st, line.r, h - SZ.band.h / 2, h + SZ.band.h / 2, { lit: MAT.band[0], shade: MAT.band[1] }); return { fills: b.fills, rings: [b.ring(h - SZ.band.h / 2, b.a0, b.a1), b.ring(h + SZ.band.h / 2, b.a0, b.a1)] }; });
    const clipId = 'post-ceil-' + Math.random().toString(36).slice(2, 7);
    const lineSvg = `<clipPath id="${clipId}"><polygon points="${fmt(clip)}"/></clipPath><g clip-path="url(#${clipId})">`
      + cyl.fills.map(f => sealed(f.pts, f.fill)).join('')
      + bands.map(b => b.fills.map(f => sealed(f.pts, f.fill)).join('')).join('') + '</g>'
      + [silL, silR, jn.arc].map(p => `<path d="${pathOf(p)}" fill="none" ${INK}/>`).join('')
      + bands.map(b => b.rings.map(p => `<path d="${pathOf(p)}" fill="none" ${INK}/>`).join('')).join('');
    // ---- the shoulder: r from the body's to the line's along half a cosine (upright where it leaves the body and where it
    // meets the line, so its outline runs on into both without a corner); a seam ring where it meets the line (the body's
    // own top ring is the other seam)
    const sh = SZ.red, shoulder = revolution(st, h => line.r + (R.r - line.r) * (1 + Math.cos(Math.PI * (h - sh.h0) / (sh.h1 - sh.h0))) / 2, sh.h0, sh.h1, MAT.body);
    const shoulderSvg = sealed(shoulder.fills[0].pts, shoulder.fills[0].fill) + `<polygon points="${fmt(shoulder.fills[1].pts)}" fill="${shoulder.fills[1].fill}"/>` + [...shoulder.sil, shoulder.ringAt(sh.h0)].map(p => `<path d="${pathOf(p)}" fill="none" ${INK}/>`).join('');
    // ---- the receiver's body: its near side round a window turned toward you; through the window, the inside's tone
    const geo = geoOf(st, R.r), C0 = st.W(0, 0, 0), toEye = V3.mul(C0, -1);
    let phi = Math.atan2(toEye[2], toEye[0]);
    while (phi < geo.a0) phi += 2 * Math.PI; while (phi > geo.a1) phi -= 2 * Math.PI;
    const w0 = phi - R.half, w1 = phi + R.half, a0 = geo.a0, a1 = geo.a1;
    const PL = SZ.plinth.h, bodyFills = [...region(geo, a0, a1, R.h0, PL, MAT.foot), ...region(geo, a0, a1, PL, R.win0, MAT.body), ...region(geo, a0, a1, R.win1, R.h1, MAT.body), ...region(geo, a0, w0, R.win0, R.win1, MAT.body), ...region(geo, w1, a1, R.win0, R.win1, MAT.body)];
    const winPts = [...geo.gen(w0, R.win0, R.win1), ...geo.ring(R.win1, w0, w1), ...geo.gen(w1, R.win1, R.win0), ...geo.ring(R.win0, w1, w0)];
    // (the body's top ring is the shoulder's: drawn after the shoulder's fills, which would cover half of it)
    const bodyLines = [geo.gen(a0, R.h0, R.h1), geo.gen(a1, R.h0, R.h1), geo.ring(R.h0, a0, a1), geo.ring(PL, a0, a1)];
    const back = `<polygon points="${fmt(winPts)}" fill="${MAT.inside[0]}"/>`;
    const front = bodyFills.map(f => sealed(f.pts, f.fill)).join('') + bodyLines.map(p => `<path d="${pathOf(p)}" fill="none" ${INK}/>`).join('') + `<polygon points="${fmt3(winPts)}" fill="none" ${INK}/>`
      + plate(geo, w0, w1)
      + shoulderSvg + lineSvg + `<path d="${pathOf(shoulder.ringAt(sh.h1))}" fill="none" ${INK}/>`;
    const hit = fmt([...geo.gen(a0, R.h0, R.h1), ...geo.ring(R.h1, a0, a1), ...geo.gen(a1, R.h1, R.h0), ...geo.ring(R.h0, a1, a0)]);
    return (STATICS = { lens, S, ring, back, front, hit });
  }
  /* the station for the page: its static parts; can(h): delivery.js's canister standing in the receiver, small as it lay in
     the drawer (delivery.far: bands flush, lid shut), its base h mm above the receiver's floor (0 landed); flag(up): the
     arrival flag, 0 down .. 1 up */
  function station(lens) {
    const T = statics(lens), st = T.S.st;
    return { ...T, can: (h, aw = false) => window.delivery.far(receiverPose(st, SZ.rec.floor + h), st.proj, { aw }), flag: up => flag(st, up) };
  }
  /* the stills: state { can: 'none' | 'in' | number (its base, mm above the receiver's floor), lift: 0..1 (on its way into
     your hands), held: { lid, what }, slip: { s, kind, opts } (the slip out to you as the canister goes back), flag: 0..1 } */
  function draw(state = {}, lens) {
    const T = statics(lens), S = T.S, { st } = S, R = SZ.rec;
    // the canister: in the receiver as delivery.far draws it; lifted, it flies into your hands as the page flies it out of
    // the drawer (app.js dlvFly: the same path and turn, the room's lens giving way to the near camera, drawn small under
    // 1.4 px a mm and as the held one nearer); held, delivery.held(), its lid sprung open to 125 degrees
    let canSvg = '', held = '';
    const aw = !!state.aw, inside = (pose, project) => { canSvg = window.delivery.far(pose, project, { aw }); };
    if (state.can !== undefined && state.can !== 'none' && state.lift === undefined && !state.held && !state.slip) inside(receiverPose(st, R.floor + (state.can === 'in' ? 0 : +state.can || 0)), st.proj);
    if (state.lift !== undefined) { const f = canFlight(st, state.lift, true); if (f.inReceiver) inside(f.pose, f.project); else held = f.svg(state.lid || 0, 'slip', aw); }
    if (state.held) held = window.delivery.held(state.held.what || 'slip', window.delivery.heldPose(0), window.deskDrawer.proj, state.held.lid || 0, { aw });
    // the slip out of the open canister's mouth and up to you, unrolling, while the canister goes back down into the
    // receiver, its lid shutting (as the page sends it back to the drawer)
    if (state.slip) {
      const { s, kind = 'note', opts = {} } = state.slip, c = canBackAt(s), f = canFlight(st, c, false);
      let canHeld = '';
      if (f.inReceiver) inside(f.pose, f.project); else canHeld = f.svg(LID_OPEN * (1 - c), 'empty');
      held = canHeld + slipSvg(s, slipPrint(kind, opts));
    }
    return { ceiling: T.ring, station: T.back + canSvg + T.front + flag(st, state.flag || 0), held, S };
  }
  /* ---- the slip between the held canister's mouth and your hands (slipFlight), as svg. While its roll is still in the
     mouth (rising, s under .2) it is hidden where the canister's body is in front of it: drawn clipped to everything but the
     body's outline as far as the mouth (a cylinder's outline is the hull of its two end rings). dy: the view's offset (held
     things are in front of you wherever you look: app.js heldProj). */
  // (how far the canister has gone back while the slip is out at s: not at all until the slip is clear of its mouth)
  const canBackAt = s => { const x = Math.max(0, Math.min(1, (s - .2) / .8)); return x * x * (3 - 2 * x); };
  function slipSvg(s, print, dy = 0) {
    const fl = slipFlight(s), pr = p => { const q = fl.project(p); return [q[0], q[1] + dy]; };
    let svg = paperSvg(fl.frame, pr, fl.u, { print });
    if (s < .2) {
      // (cut at the mouth, as the canister's own rolled slip is: the part out of the mouth is in front of everything of the
      // canister it passes, its rim too; only the part still inside is hidden where the body is in front of it. Clipped
      // whole, the roll went behind the near rim the frame it took over from the canister's own: a 33 px jump.)
      const outY = Math.min(PAPER.W, fl.outOfMouth);
      const inner = outY < PAPER.W ? paperSvg(fl.frame, pr, fl.u, { print, ya: outY }) : '';
      const outer = paperSvg(fl.frame, pr, fl.u, { print, yb: outY });
      svg = inner;
      const P = window.delivery.heldPose(0), r = window.delivery.CAN.r, seat = window.delivery.CAN.L - 18, pts = [];
      for (const h of [0, seat]) for (let i = 0; i < 720; i++) { const a = 2 * Math.PI * i / 720; pts.push(pr(V3.add(V3.add(V3.add(P.C, V3.mul(P.A, h)), V3.mul(P.U, r * Math.cos(a))), V3.mul(P.V, r * Math.sin(a))))); }
      // (but not through its open mouth: the rim's circle cut out of the outline again, 0.2 mm inside the rim's inner edge,
      // half its line held, so the paper leaves the line whole, as the canister's own roll does going under it)
      const mouth = Array.from({ length: 720 }, (_, i) => { const a = 2 * Math.PI * i / 720; return pr(V3.add(V3.add(V3.add(P.C, V3.mul(P.A, seat)), V3.mul(P.U, (r - 6.2) * Math.cos(a))), V3.mul(P.V, (r - 6.2) * Math.sin(a)))); });
      const hull = convexHull(pts), id = 'slipmouth' + Math.random().toString(36).slice(2, 8), sub = q => 'M' + fmt(q).split(' ').join('L') + 'Z';
      svg = (svg ? `<clipPath id="${id}"><path clip-rule="evenodd" d="M-5000,-5000H6000V6000H-5000Z${sub(hull)}${sub(mouth)}"/></clipPath><g clip-path="url(#${id})">${svg}</g>` : '') + outer;
    }
    return svg;
  }
  function convexHull(ps) {
    const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  // ---- the canister in the receiver, as delivery.js poses things: { C, A, U, V } in camera units a mm, A up its axis from
  // its base to its lid, V = A x U (away from you)
  // (turned about its axis so that the side facing you in the receiver is the side facing you held: aw's tag's writing is
  // there. A turned thing looks the same however it is turned; only the tag shows it, and the flight's turn takes it the
  // short way round.)
  const ROLL = new WeakMap();
  function rollOf(st) {
    if (ROLL.has(st)) return ROLL.get(st);
    const C = st.W(0, SZ.rec.floor + 75, 0), e = V3.unit(V3.mul(C, -1)), U0 = V3.unit(V3.sub(st.W(1, 0, 0), st.W(0, 0, 0))), V0 = V3.unit(V3.sub(st.W(0, 0, 1), st.W(0, 0, 0)));
    const psi = Math.atan2(V3.dot(e, V0), V3.dot(e, U0)) - window.delivery.tagAngle();
    ROLL.set(st, psi); return psi;
  }
  const receiverPose = (st, h) => {
    const C = st.W(0, h, 0), U0 = V3.sub(st.W(1, h, 0), C), V0 = V3.sub(st.W(0, h, 1), C), ps = rollOf(st), c = Math.cos(ps), s = Math.sin(ps);
    return { C, A: V3.sub(st.W(0, h + 1, 0), C), U: V3.add(V3.mul(U0, c), V3.mul(V0, s)), V: V3.add(V3.mul(U0, -s), V3.mul(V0, c)) };
  };
  const LID_OPEN = 125 * Math.PI / 180;                  // app.js's: sprung open
  // app.js's between(): a cubic path for the centre, the turn by quaternion
  function quatOf(A, B) {
    const N = V3.cross(A, B), m = [[A[0], B[0], N[0]], [A[1], B[1], N[1]], [A[2], B[2], N[2]]], tr = m[0][0] + m[1][1] + m[2][2];
    if (tr > 0) { const q = Math.sqrt(tr + 1) * 2; return [.25 * q, (m[2][1] - m[1][2]) / q, (m[0][2] - m[2][0]) / q, (m[1][0] - m[0][1]) / q]; }
    if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const q = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; return [(m[2][1] - m[1][2]) / q, .25 * q, (m[0][1] + m[1][0]) / q, (m[0][2] + m[2][0]) / q]; }
    if (m[1][1] > m[2][2]) { const q = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; return [(m[0][2] - m[2][0]) / q, (m[0][1] + m[1][0]) / q, .25 * q, (m[1][2] + m[2][1]) / q]; }
    const q = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; return [(m[1][0] - m[0][1]) / q, (m[0][2] + m[2][0]) / q, (m[1][2] + m[2][1]) / q, .25 * q];
  }
  const frameOfQ = ([w, x, y, z]) => ({ A: [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)], B: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)] });
  function slerp(q0, q1, t) { let d = q0.reduce((a, v, i) => a + v * q1[i], 0); if (d < 0) { q1 = q1.map(v => -v); d = -d; } if (d > .9995) { const r = q0.map((v, i) => v + (q1[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); } const th = Math.acos(d), s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th); return q0.map((v, i) => v * s0 + q1[i] * s1); }
  const bez = (p0, p1, p2, p3, u) => { const r = 1 - u; return [0, 1, 2].map(i => r * r * r * p0[i] + 3 * r * r * u * p1[i] + 3 * r * u * u * p2[i] + u * u * u * p3[i]); };
  const toFlight = p => ({ c: p.C, A: V3.unit(p.A), B: V3.unit(p.U) });
  const fromFlight = f => ({ C: f.c, A: V3.mul(f.A, MM), U: V3.mul(f.B, MM), V: V3.mul(V3.cross(f.A, f.B), MM) });
  function between(p0, p1, t, c1, c2) { const q = slerp(quatOf(p0.A, p0.B), quatOf(p1.A, p1.B), t); return { c: bez(p0.c, c1, c2, p1.c, t), ...frameOfQ(q) }; }
  /* the canister between the receiver and your hands. s: 0 in the receiver, 1 held (toHands), or the way back (s 0 held, 1
     in the receiver). First it rises inside the window until its base is clear of the sill (RISE mm: its base stands
     below the window, behind the wall); then it comes out toward you and up, as the page brought it from the drawer.
     While it is in the window it is drawn in the receiver (its walls in front of it); once out, over everything. */
  // (RISE 50: the window is 168 mm tall for the 150 mm canister now, its base 8 mm over the sill and its top 10 under the
  // window's top as it comes out)
  const RISE = 50, RISE_PART = .25;
  function canFlight(st, s, toHands, dy = 0) {
    const R = SZ.rec, u = toHands ? s : 1 - s;           // u: 0 in the receiver .. 1 held, whichever way it goes
    const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    if (u < RISE_PART) {
      const pose = receiverPose(st, R.floor + RISE * sm(u / RISE_PART));
      return { pose, project: st.proj, inReceiver: true, near: 0, svg: (lid, what, aw = false) => window.delivery.far(pose, st.proj, { aw }) };
    }
    const t = (u - RISE_PART) / (1 - RISE_PART);
    const a = toFlight(receiverPose(st, R.floor + RISE)), b = toFlight(window.delivery.heldPose(0)), toward = V3.unit(V3.mul(a.c, -1));
    const out = V3.add(a.c, V3.add(V3.mul(toward, 160), [0, -30, 0])), hand = V3.add(b.c, [0, 20, 30]);
    const pose = fromFlight(between(a, b, t, out, hand));
    const near = t, flat = window.deskDrawer.proj;
    const project = p => { const q = st.proj(p), r = flat(p); return [q[0] + (r[0] - q[0]) * near, q[1] + (r[1] - q[1]) * near + dy * near]; };
    const k0 = flat(pose.C), k1 = flat(V3.add(pose.C, pose.A)), pxmm = Math.hypot(k1[0] - k0[0], k1[1] - k0[1]);
    const inReceiver = false;
    return { pose, project, inReceiver, near, pxmm, svg: (lid, what, aw = false) => pxmm < 1.4 ? window.delivery.far(pose, project, { aw }) : window.delivery.held(lid > Math.PI / 3 ? what : 'empty', pose, project, lid, { aw }) };
  }

  /* ---- the flow (Arnold, 2026-10-05: one click on the landed canister brings it all up to you). What the page plays and
     tube-audit.html renders frame by frame, the same timelines. A sequence is { ms, events: [[t, name]], at(t) }; at(t)
     is the state t ms in: canH (the canister standing in the receiver, its base mm above the floor; null, none there),
     fly ({ s, toHands, lid, what }: on its way between the receiver and your hands, as canFlight; s 1 toHands is held),
     slip (s: the slip between the open canister's mouth and your hands, as slipSvg), flag (0 down .. 1 up). frame()
     draws a state. Events: 'tube-rattle', 'tube-thunk', 'flag' (sounds), 'open' (the lid springs: its tock, the
     compliance line, any beans), 'tube-up' (sent back up the tube). */
  const DROP = 280;                                    // (mm: a canister's base this high is wholly inside the receiver's head, out of sight)
  // (beat 0: the slip starts as the lid settles; with a 120 ms beat the canister sat still for 360 ms, a stall in what
  // Arnold asked to be one motion)
  const T = { rattle: 1250, drop: 200, flagUp: 380, flagDown: 220, lift: 750, lid: 300, beat: 0, slip: 1100, look: 700, shut: 240, back: 650, rest: 260, up: 420, meet: 1000 };
  const easeIO = s => s < .5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;   // (app.js's)
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // the lid springs: past wide open and back; the flag swings up past upright and settles, or falls back
  const springOpen = u => LID_OPEN * Math.min(1.06, 1 - Math.pow(1 - u, 3) * Math.cos(u * Math.PI * 1.5));
  const flagUp = u => 1 - Math.pow(1 - u, 3) * Math.cos(u * Math.PI * 2.5), flagDown = u => 1 - u * u;
  /* when the lid starts to spring, in the lift: 150 ms before the canister is in your hands, and never while it is still
     drawn small (canFlight draws it shut under 1.4 px a mm; the lid opening before that would show as a jump) */
  const LID_AT = new WeakMap();
  function lidAt(st) {
    if (LID_AT.has(st)) return LID_AT.get(st);
    let t = T.lift - 150;
    for (let tt = 0; tt <= T.lift; tt += 2) { if (canFlight(st, easeIO(tt / T.lift), true).pxmm >= 1.4) { t = Math.max(t, tt + 30); break; } }
    LID_AT.set(st, t); return t;
  }
  const flow = {
    T, DROP, lidAt,
    // a rattle down the tube from above, then it drops into the window (falling, the last of the rattle), a thunk, the flag
    arrive() {
      const t1 = T.rattle, t2 = t1 + T.drop;
      return { ms: t2 + T.flagUp, events: [[0, 'tube-rattle'], [t2, 'tube-thunk'], [t2, 'flag']],
        at: t => ({ canH: t < t1 ? null : t < t2 ? DROP * (1 - ((t - t1) / T.drop) ** 2) : 0, flag: t < t2 ? 0 : flagUp(clamp01((t - t2) / T.flagUp)) }) };
    },
    /* the one click: it rises out of the window and comes up to you, the lid springing open as it arrives (the flag drops
       as it is taken); then the slip comes out of its mouth and up to you, unrolling, while the canister goes back down
       into the receiver, its lid shutting. An empty one comes up open and empty, a beat, then shuts, goes back down into
       the receiver and up the tube. */
    take(st, empty = false) {
      const la = lidAt(st), open = la + T.lid, flag = t => flagDown(clamp01(t / T.flagDown));
      const lidT = t => t < la ? 0 : t < open ? springOpen((t - la) / T.lid) : LID_OPEN;
      const up = (t, what) => ({ flag: flag(t), fly: { s: easeIO(clamp01(t / T.lift)), toHands: true, lid: lidT(t), what } });
      if (!empty) {
        const t1 = Math.max(T.lift, open) + T.beat;
        return { ms: t1 + T.slip, events: [[la, 'open']], slipAt: t1,
          at: t => {
            if (t < t1) return up(t, 'slip');
            const s = easeIO(clamp01((t - t1) / T.slip)), c = canBackAt(s);
            return { flag: 0, fly: { s: c, toHands: false, lid: LID_OPEN * (1 - c), what: 'empty' }, slip: s };
          } };
      }
      const t1 = Math.max(T.lift, open) + T.look, t2 = t1 + T.shut, t3 = t2 + T.back, t4 = t3 + T.rest;
      return { ms: t4 + T.up, events: [[la, 'open'], [t4, 'tube-up']],
        at: t => t < t1 ? up(t, 'empty')
          : t < t2 ? { flag: 0, fly: { s: 1, toHands: true, lid: LID_OPEN * (1 - easeIO((t - t1) / T.shut)), what: 'empty' } }
          : t < t3 ? { flag: 0, fly: { s: easeIO((t - t2) / T.back), toHands: false, lid: 0, what: 'empty' } }
          : t < t4 ? { flag: 0, canH: 0 } : { flag: 0, canH: DROP * ((t - t4) / T.up) ** 2 } };
    },
    /* done with it (after any other papers have gone in behind it): the canister comes up out of the receiver to meet the
       slip, which rolls back into its mouth; the lid shuts; it goes back down into the receiver and up the tube */
    putAway() {
      const t1 = T.meet, t2 = t1 + T.shut, t3 = t2 + T.back, t4 = t3 + T.rest;
      return { ms: t4 + T.up, events: [[t4, 'tube-up']],
        at: t => {
          if (t < t1) { const s = 1 - easeIO(t / T.meet), c = canBackAt(s); return { flag: 0, fly: { s: c, toHands: false, lid: LID_OPEN * (1 - c), what: 'empty' }, slip: s }; }
          if (t < t2) return { flag: 0, fly: { s: 0, toHands: false, lid: LID_OPEN * (1 - easeIO((t - t1) / T.shut)), what: 'slip' } };
          if (t < t3) return { flag: 0, fly: { s: easeIO((t - t2) / T.back), toHands: false, lid: 0, what: 'slip' } };
          return t < t4 ? { flag: 0, canH: 0 } : { flag: 0, canH: DROP * ((t - t4) / T.up) ** 2 };
        } };
    },
  };
  /* a state drawn: inRec, the canister in the receiver (behind its walls); can, the canister out of it (over everything);
     slip; flag; near, how far it has come toward you (0 .. 1: the page's parallax depth). dy: where you are looking (held
     things are in front of you wherever that is). aw: the canister is aw's (its tag); print: the slip's (slipPrint). */
  function frame(state, st, dy = 0, { aw = false, print = '' } = {}) {
    let inRec = '', can = '', slip = '', near = 0;
    if (state.canH != null) inRec = window.delivery.far(receiverPose(st, SZ.rec.floor + state.canH), st.proj, { aw });
    if (state.fly) {
      const f = canFlight(st, state.fly.s, state.fly.toHands, dy);
      near = f.near; if (f.inReceiver) inRec = f.svg(0, 'empty', aw); else can = f.svg(state.fly.lid, state.fly.what, aw);
    }
    if (state.slip != null) slip = slipSvg(state.slip, print, dy);
    return { inRec, can, slip, flag: flag(st, state.flag || 0), near };
  }

  /* the arrival flag (mm): a semaphore on a boss over the receiver's right edge, square to you. At rest its arm points down
     and out (30 degrees from hanging straight down); up, it points up and out (30 degrees off upright): never alongside the
     receiver's outline. The arm 13 wide (its edges 6 px apart here), 58 long to a plate 30 by 24. Its pivot 262 mm up and the
     receiver's top at 290: the audit tried tops from 284 to 318 and pivots under each; elsewhere the shoulder's outline or the
     flag ran 0.4 to 5.4 px beside one of the rack's lines. */
  const FLAG = { h: 262, out: 10, arm: 58, w: 13, plate: [30, 24], boss: 12, rest: -60, raised: 60 };
  function flag(st, up) {
    const R = SZ.rec, C0 = st.W(0, FLAG.h, 0), toEye = V3.unit(V3.mul(C0, -1));
    const upv = V3.unit(V3.sub(st.W(0, 1, 0), st.W(0, 0, 0))), across = V3.unit(V3.cross(upv, toEye));
    const right = V3.dot(across, V3.sub(st.W(1, 0, 0), st.W(0, 0, 0))) > 0 ? across : V3.mul(across, -1);
    const k = st.k, piv = V3.add(C0, V3.mul(right, (R.r + FLAG.out) * k));
    const deg = FLAG.rest + (FLAG.raised - FLAG.rest) * up, a = deg * Math.PI / 180;
    const dir = V3.add(V3.mul(right, Math.cos(a)), V3.mul(upv, Math.sin(a))), nrm = V3.add(V3.mul(right, -Math.sin(a)), V3.mul(upv, Math.cos(a)));
    const P = (u, v) => st.proj(V3.add(piv, V3.add(V3.mul(dir, u * k), V3.mul(nrm, v * k))));
    const run = (p, q) => { const n = Math.max(2, Math.ceil(Math.hypot(...[0, 1].map(i => P(...q)[i] - P(...p)[i])) / .25)); return Array.from({ length: n }, (_, i) => P(p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n)); };
    const loop = q => q.flatMap((p, i) => run(p, q[(i + 1) % q.length]));
    const { arm, w, plate, boss } = FLAG, x0 = arm - 2, x1 = arm + plate[0] - 2, ph = plate[1] / 2;
    const outline = loop([[0, -w / 2], [x0, -w / 2], [x0, -ph], [x1, -ph], [x1, ph], [x0, ph], [x0, w / 2], [0, w / 2]]);
    const plateQ = loop([[x0, -ph], [x1, -ph], [x1, ph], [x0, ph]]);
    const m = 160, bossFine = loop(Array.from({ length: m }, (_, i) => [boss * Math.cos(2 * Math.PI * i / m), boss * Math.sin(2 * Math.PI * i / m)]));
    return `<polygon points="${fmt(outline)}" fill="#DEDEDC"/><polygon points="${fmt(plateQ)}" fill="#D2D2D0"/><polygon points="${fmt(outline)}" fill="none" ${INK}/>` +
      `<polygon points="${fmt(bossFine)}" fill="#E6E6E4" ${INK}/>`;
  }
  /* ---- the slip. One sheet, PAPER.L by PAPER.W mm (the held slip's 560 by 300 px), rolled print side in. A point on it
     is (x, y): x along its length from its left edge, y down its width. Unrolled to xf, it is flat for x < xf, in its own
     plane (z = 0, the print toward -z); past xf it curls toward the print side round an axis at (xf, -, -ρ): the paper at
     σ past xf is at angle θ = σ / ρ, (xf + ρ sin θ, y, ρ cos θ - ρ). The curl leaves the flat part on its tangent. ρ is
     the radius of a roll of what is left (the turns' thickness t), so as the last of it unrolls the curl's arc shrinks to
     nothing: no little cylinder left to vanish. Only the outer turn is drawn (the inner ones lie within a pixel or two of
     it: a sheaf of lines). frame: { C, ex, ey, ez }: camera point of the paper's (0, 0, 0) and the camera vector of a mm
     along each of its axes. */
  // (80 wide and rolled 11 mm round: the rolled slip delivery.held() draws in the canister's mouth; 149 long, the held
  // slip's 560 by 300)
  const PAPER = { L: 80 * 560 / 300, W: 80, r0: 4, t: 2.21 };
  // (delivery.js's rolled slip's tones: body ['#FAFAF9', '#ECECEA'], its end ['#FAFAF9', '#F0F0EE'], so the roll the page
  // shows in the mouth and this one are the same thing)
  const PAPER_TONE = { back: ['#FAFAF9', '#ECECEA'], front: ['#FAFAF9', '#EEEEEC'], end: ['#FAFAF9', '#F0F0EE'] };
  const rhoOf = left => Math.sqrt(PAPER.r0 ** 2 + left * PAPER.t / Math.PI);
  // (ya, yb: only the paper between those two heights across it is drawn, its own edges only where they are the paper's:
  // the slip half in the canister's mouth is drawn in two, cut at the mouth)
  function paperSvg(frame, project, u, { print = '', ya = 0, yb = PAPER.W } = {}) {
    const { L } = PAPER, W = yb, Y0 = ya, xf = L * u, left = L - xf, rho = rhoOf(left), thEnd = left / rho, thMax = Math.min(thEnd, 2 * Math.PI);
    const edgeAt = { [Y0]: Y0 === 0, [W]: W === PAPER.W };
    const loc = (x, y, z) => V3.add(V3.add(V3.add(frame.C, V3.mul(frame.ex, x)), V3.mul(frame.ey, y)), V3.mul(frame.ez, z));
    const curl = (th, y) => loc(xf + rho * Math.sin(th), y, rho * Math.cos(th) - rho);
    const Lgt = window.solid.L, toTone = (n, side) => PAPER_TONE[side][V3.dot(n, Lgt) > .15 ? 0 : 1];
    const exU = V3.unit(frame.ex), ezU = V3.unit(frame.ez);
    // the curl's outward normal (away from its axis) at θ, in the camera
    const nOut = th => V3.unit(V3.add(V3.mul(exU, Math.sin(th)), V3.mul(ezU, Math.cos(th))));
    // θ steps so the screen step stays under 0.25 px (on the curl's top and bottom edges)
    const ths = [0];
    if (thMax > 0) { let th = 0, d = .002; while (th < thMax) { let t2 = Math.min(thMax, th + d); const a = project(curl(th, Y0)), b = project(curl(t2, Y0)), a2 = project(curl(th, W)), b2 = project(curl(t2, W)), sd = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(b2[0] - a2[0], b2[1] - a2[1])); if (sd > .25 && t2 - th > 1e-6) { d *= .5; continue; } ths.push(t2); th = t2; if (sd < .12) d *= 1.5; } }
    // each step of the curl: which side is seen (the outer, blank side if its outward normal faces the eye) and its tone
    const steps = [];
    for (let i = 0; i < ths.length - 1; i++) {
      const tm = (ths[i] + ths[i + 1]) / 2, P = curl(tm, (Y0 + W) / 2), n = nOut(tm), out = V3.dot(n, V3.mul(P, -1)) > 0;
      steps.push({ a: ths[i], b: ths[i + 1], side: out ? 'back' : 'front', tone: out ? toTone(n, 'back') : toTone(V3.mul(n, -1), 'front'), depth: Math.hypot(...P) });
    }
    // runs of steps seen from one side: each is drawn whole (fills, then its own lines), far runs first
    const runs = [];
    for (const st of steps) { const r = runs[runs.length - 1]; if (r && r.side === st.side) r.steps.push(st); else runs.push({ side: st.side, steps: [st] }); }
    for (const r of runs) r.depth = r.steps.reduce((a, st) => a + st.depth, 0) / r.steps.length;
    runs.sort((p, q) => q.depth - p.depth);
    const edge = (y, a, b) => ths.filter(t => t >= a - 1e-12 && t <= b + 1e-12).map(t => project(curl(t, y)));
    const gen = (th, n = Math.ceil((W - Y0) / .2)) => Array.from({ length: n + 1 }, (_, i) => project(curl(th, Y0 + (W - Y0) * i / n)));
    let svg = '';
    // the flat part: its print clipped to it
    if (xf > 1e-6) {
      const run = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => project(loc(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, 0)));
      const dens = (a, b) => Math.max(2, Math.ceil(Math.hypot(...[0, 1].map(k => project(loc(...b, 0))[k] - project(loc(...a, 0))[k])) / .25));
      const quad = [[0, Y0], [xf, Y0], [xf, W], [0, W]], flat = quad.flatMap((p, i) => run(p, quad[(i + 1) % 4], dens(p, quad[(i + 1) % 4])).slice(0, -1));
      const P0 = project(loc(0, 0, 0)), Px = project(loc(1, 0, 0)), Py = project(loc(0, 1, 0)), k = 1 / (560 / L);
      const m = [(Px[0] - P0[0]) * k, (Px[1] - P0[1]) * k, (Py[0] - P0[0]) * k, (Py[1] - P0[1]) * k, P0[0], P0[1]].map(v => v.toFixed(5)).join(' ');
      const id = 'slipflat' + Math.random().toString(36).slice(2, 8);
      svg += `<polygon points="${fmt(flat)}" fill="${PAPER_TONE.front[0]}"/>` + (print ? `<clipPath id="${id}"><polygon points="${fmt(flat)}"/></clipPath><g clip-path="url(#${id})"><g transform="matrix(${m})">${print}</g></g>` : '');
      // its outline: the left edge, and the top and bottom edges as far as the curl (where it goes on, on its tangent)
      const outline = [...(edgeAt[Y0] ? run([xf, Y0], [0, Y0], dens([xf, Y0], [0, Y0])) : []), ...run([0, Y0], [0, W], dens([0, Y0], [0, W])).slice(edgeAt[Y0] ? 1 : 0), ...(edgeAt[W] ? run([0, W], [xf, W], dens([0, W], [xf, W])).slice(1) : [])];
      svg += `<path d="${pathOf(outline)}" fill="none" ${INK}/>`;
    }
    // while the roll is closed, its end turned toward you is the paper's turns seen end on: a disc in the end's tone and a
    // spiral (delivery.js rolledSlip's: two turns from .72 to .18 of the radius), the turns fewer as it unrolls, none by the
    // time it opens; drawn over the far run (the hollow of the roll), under the near one
    let endSvg = '';
    if (thEnd >= 2 * Math.PI) {
      const axisAt = y => loc(xf, y, -rho), thFull = L / rhoOf(L), turns = 2 * Math.min(1, (thEnd - 2 * Math.PI) / (thFull - 2 * Math.PI));
      for (const y of [Y0, W].filter(y => edgeAt[y])) {
        const nEnd = V3.unit(V3.mul(frame.ey, y ? 1 : -1)), C = axisAt(y);
        if (V3.dot(nEnd, V3.mul(C, -1)) <= 0) continue;
        const at = (rr, a) => project(V3.add(C, V3.add(V3.mul(exU, rr * Math.cos(a) * Math.hypot(...frame.ex)), V3.mul(ezU, rr * Math.sin(a) * Math.hypot(...frame.ez)))));
        const disc = []; { let a = 0; while (a < 2 * Math.PI) { disc.push(at(rho, a)); const d = Math.hypot(...[0, 1].map(i => at(rho, a + .01)[i] - at(rho, a)[i])); a += Math.min(.05, .01 * .25 / Math.max(d, 1e-6)); } }
        endSvg += `<polygon points="${fmt(disc)}" fill="${PAPER_TONE.end[V3.dot(nEnd, Lgt) > .15 ? 0 : 1]}" ${INK}/>`;
        if (turns > .02) {
          const r1 = rho * .72, r0 = r1 - (r1 - rho * .18) * turns / 2, tMax = 2 * Math.PI * turns, sp = [];
          for (let t = 0; t <= tMax;) { const rr = r1 - (r1 - r0) * t / tMax; sp.push(at(rr, 1.2 + t)); const d = Math.hypot(...[0, 1].map(i => at(rr, 1.2 + t + .01)[i] - at(rr, 1.2 + t)[i])); t += Math.min(.05, .01 * .25 / Math.max(d, 1e-6)); }
          endSvg += `<path d="${pathOf(sp)}" fill="none" ${INK}/>`;
        }
      }
    }
    let endDrawn = false;
    for (const r of runs) {
      if (!endDrawn && r.side === 'back' && endSvg) { svg += endSvg; endDrawn = true; }
      const a = r.steps[0].a, b = r.steps[r.steps.length - 1].b;
      // fills: the run cut where its tone changes
      let cur = null; const parts = [];
      for (const st of r.steps) { if (cur && cur.tone === st.tone) cur.b = st.b; else parts.push(cur = { a: st.a, b: st.b, tone: st.tone }); }
      for (const p of parts) svg += `<polygon points="${fmt([...edge(Y0, p.a, p.b), ...edge(W, p.a, p.b).reverse()])}" fill="${p.tone}" stroke="${p.tone}" stroke-width=".5" stroke-linejoin="round"/>`;
      // lines: its top and bottom edges; where it turns from one side to the other (a silhouette), or ends (the paper's end)
      for (const y of [Y0, W]) if (edgeAt[y]) svg += `<path d="${pathOf(edge(y, a, b))}" fill="none" ${INK}/>`;
      for (const th of [a, b]) if ((th > 1e-9 || xf < 1e-6) && th < 2 * Math.PI - 1e-9) svg += `<path d="${pathOf(gen(th))}" fill="none" ${INK}/>`;
    }
    return svg;
  }
  // the slip's print, from delivery.slip() (its own frame, 560 by 300), without its outline
  function slipPrint(kind, opts) { const sv = window.delivery.slip(kind, opts, { cx: 280, cy: 150, k: 1, rot: 0 }); const g = sv.slice(sv.indexOf('<g ')); return g.replace(/^<g transform="matrix\([^)]*\)">/, '<g>'); }

  /* ---- the slip's way out of the held canister's mouth to your hands. s: 0 rolled up in the open canister's mouth, as
     delivery.held() draws it (11 mm round, 80 long, its top 40 mm out of the mouth, 3 mm off the axis); out along the
     canister's axis until it is clear of the mouth (s 0 to .2); then turning to face you and coming to the held place,
     unrolling as it comes; 1 held up flat, exactly delivery.slip()'s place (560 by 300 at (720, 470), turned 3 degrees).
     All in the near camera of things held. */
  const HELD = { cx: 720, cy: 470, rot: -3 * Math.PI / 180, pxmm: 560 / PAPER.L };
  function slipFlight(s) {
    const sm = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
    const flat = window.deskDrawer.proj, P = window.delivery.heldPose(0), seat = window.delivery.CAN.L - 18;
    const Zh = F * MM / HELD.pxmm, c = Math.cos(HELD.rot), si = Math.sin(HELD.rot);
    const exH = [c, si, 0], eyH = [-si, c, 0];
    const centre = [(HELD.cx - 720) * Zh / F, (HELD.cy - 813) * Zh / F, Zh];
    const CH = V3.sub(V3.sub(centre, V3.mul(exH, PAPER.L / 2 * MM)), V3.mul(eyH, PAPER.W / 2 * MM));
    // in the mouth: the roll's axis along the canister's, its outer end (the paper's top edge) 40 mm out of the mouth
    const Au = V3.unit(P.A), Vu = V3.unit(P.V), rho0 = rhoOf(PAPER.L);
    const rise = sm(0, .2, s) * (PAPER.W + 6 - 40);
    const axisTop = V3.add(V3.add(P.C, V3.mul(P.A, seat + 40 + rise)), V3.mul(P.V, -3));
    const ey0 = V3.mul(Au, -1), ez0 = Vu, ex0 = V3.cross(ey0, ez0);
    const C0 = V3.add(axisTop, V3.mul(ez0, rho0 * MM));
    const t = sm(.2, 1, s), q = slerp(quatOf(ex0, ey0), quatOf(exH, eyH), t), fr = frameOfQ(q), ez = V3.cross(fr.A, fr.B);
    const C = bez(C0, V3.add(C0, V3.mul(Au, 30 * MM)), V3.add(CH, [0, 15, 25]), CH, t);
    // (outOfMouth: how much of the paper, from its top edge, is out past the mouth while it is still along the canister's axis)
    return { frame: { C, ex: V3.mul(fr.A, MM), ey: V3.mul(fr.B, MM), ez: V3.mul(ez, MM) }, project: flat, u: sm(.3, .95, s), outOfMouth: 40 + rise };
  }

  // ---- where every curve meets another, on the screen (for the stills' zoomed crops): name -> [x, y]
  function joints(lens) {
    const S = setup(lens), { st, jn } = S, R = SZ.rec, g = geoOf(st, R.r), gl = geoOf(st, SZ.line.r), gc = geoOf(st, window.delivery.CAN.r);
    const C0 = st.W(0, 0, 0); let phi = Math.atan2(-C0[2], -C0[0]); while (phi < g.a0) phi += 2 * Math.PI; while (phi > g.a1) phi -= 2 * Math.PI;
    const w0 = phi - R.half, w1 = phi + R.half, mid = (gc.a0 + gc.a1) / 2;
    const out = {
      'the line into the ring, left': jn.TL, 'the line into the ring, right': jn.TR,
      'a coupling, left end': gl.P(gl.a0, 900 - SZ.band.h / 2), 'a coupling, right end': gl.P(gl.a1, 900 + SZ.band.h / 2),
      'the line into the shoulder, left': gl.P(gl.a0, SZ.red.h1), 'the line into the shoulder, right': gl.P(gl.a1, SZ.red.h1),
      'the shoulder from the body, left': g.P(g.a0, R.h1), 'the shoulder from the body, right': g.P(g.a1, R.h1),
      'the window, top left': g.P(w0, R.win1), 'the window, top right': g.P(w1, R.win1), 'the window, bottom left': g.P(w0, R.win0), 'the window, bottom right': g.P(w1, R.win0),
      'the plinth, left': g.P(g.a0, SZ.plinth.h), 'the plinth, right': g.P(g.a1, SZ.plinth.h), 'the foot, left': g.P(g.a0, 0), 'the foot, right': g.P(g.a1, 0),
      'the canister\'s top': gc.P(mid, R.floor + window.delivery.CAN.L - 4), 'the canister\'s band, right end': gc.P(gc.a1, R.floor + window.delivery.CAN.L - 26),
    };
    // the flag's pivot
    const Cf = st.W(0, FLAG.h, 0), toEye = V3.unit(V3.mul(Cf, -1)), upv = V3.unit(V3.sub(st.W(0, 1, 0), st.W(0, 0, 0))), across = V3.unit(V3.cross(upv, toEye));
    const right = V3.dot(across, V3.sub(st.W(1, 0, 0), st.W(0, 0, 0))) > 0 ? across : V3.mul(across, -1);
    out['the flag\'s pivot'] = st.proj(V3.add(Cf, V3.mul(right, (R.r + FLAG.out) * st.k)));
    return out;
  }
  // the slip's flat part meeting its curl, top and bottom, and the curl's far side, at s
  function slipJoints(lens, s) {
    const fl = slipFlight(s), { L, W } = PAPER, xf = L * fl.u, rho = rhoOf(L - xf);
    const loc = (x, y, z) => V3.add(V3.add(V3.add(fl.frame.C, V3.mul(fl.frame.ex, x)), V3.mul(fl.frame.ey, y)), V3.mul(fl.frame.ez, z));
    return { 'flat into curl, top': fl.project(loc(xf, 0, 0)), 'flat into curl, bottom': fl.project(loc(xf, W, 0)), 'the curl, top': fl.project(loc(xf + rho, 0, -rho)), 'the slip\'s left edge, top': fl.project(loc(0, 0, 0)) };
  }
  window.post = { flow, frame, canBackAt, station, slipSvg, joints, slipJoints, LID_OPEN, FLAG, canFlight, receiverPose, lensFrom, draw, stationAt, place, junction, cylinderParts, setup, paperSvg, slipPrint, slipFlight, PAPER, HELD, SZ, MM, V3 };
})();
