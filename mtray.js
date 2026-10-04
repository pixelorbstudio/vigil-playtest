/* mtray.js — M.'s pencil tray and what M. left in it (design.md, "M.'s password"; Arnold, 2026-10-04: the things are to be
   made with the same care as everything else, and the tray is lifted out to be looked at, since opened at 4:3 the middle
   drawer is mostly past the frame's right edge).

   The tray sits in the right pedestal's middle drawer, against its front; clicked, it is lifted out and held up in front
   of you, about three times nearer, its back raised so you look into it. In it: a stopped watch (03:11), a pack of gum, a
   pen, folded reading glasses, and IT's envelope (the one thing that does anything: mdrawer.js envelope()).

   One model for each thing, in the tray's own millimetres (a across the tray, b toward its back, n up off its floor), drawn
   through whatever projection it is in: small in the drawer, held up near. Detail goes where it is big enough to draw
   without crowding: held up, the hour marks, the hands' shapes, the strap's holes, buckle and keeper, the lugs and crown,
   the pen's clip, the gum's folds and print, the glasses' temples and hinges; in the drawer, their outlines. Solids in
   solid.js's manner (flat-shaded by the mug's light, lines only at silhouettes and real corners), turned things in
   lathe.js's; anything under 3.5 mm thick (paper, a buckle, a clip, a temple) flat, since its edge would be a sliver. */
(function () {
  const MM = 1 / 1.765;
  const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]], sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k], cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const unit = p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); };
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const pathOf = ps => 'M' + fmt(ps).split(' ').join('L');
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"';
  const dd = () => window.deskDrawer, SOL = () => window.solid, LAT = () => window.lathe;

  // ---- loops: rounded corners as tangent arcs ([[a, b, r]] counter-clockwise), circles, strips along a centreline; all
  // sampled at step (mm), chosen per thing so its projection steps 0.2 px or less
  function rounded(corners, step) {
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
    for (let i = out.length - 1; i > 0; i--) if (Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]) < 1e-9) out.splice(i, 1);
    const fine = [];
    // (straight runs cut every 8 steps, as key3d.js's: enough for the room's bend to curve them, chords under 0.01 px off)
    for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), k = Math.max(1, Math.ceil(L / (L > 2 * step ? step * 8 : step))); for (let j = 0; j < k; j++) fine.push([p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k]); }
    return fine;
  }
  const circle = (c, r, step) => { const m = Math.max(24, Math.ceil(2 * Math.PI * r / step)); return Array.from({ length: m }, (_, k) => [c[0] + r * Math.cos(2 * Math.PI * k / m), c[1] + r * Math.sin(2 * Math.PI * k / m)]); };
  // a band of half-width hw along a centreline (its points already fine), as a closed loop, square at its ends
  function strip(cl, hw) {
    const nrm = i => { const p = cl[Math.max(0, i - 1)], q = cl[Math.min(cl.length - 1, i + 1)], d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / d, (q[0] - p[0]) / d]; };
    const L = cl.map((p, i) => { const n = nrm(i); return [p[0] + n[0] * hw, p[1] + n[1] * hw]; }), R = cl.map((p, i) => { const n = nrm(i); return [p[0] - n[0] * hw, p[1] - n[1] * hw]; });
    return [...R, ...L.reverse()];
  }
  // a frame function from a pose ({ c, A, B }: A across, B toward the back, N = A x B up), in mm; and one placed within it
  const frameOf = ({ c, A, B }) => { const N = cross(A, B); return (a, b, n) => [0, 1, 2].map(i => c[i] + (A[i] * a + B[i] * b + N[i] * n) * MM); };
  const place = (f, x, y, rot) => { const co = Math.cos(rot), si = Math.sin(rot); return (a, b, n) => f(x + a * co - b * si, y + a * si + b * co, n); };
  const axes = f => { const o = f(0, 0, 0); return { o, A: sub(f(1, 0, 0), o), B: sub(f(0, 1, 0), o), N: sub(f(0, 0, 1), o) }; };
  // how many px a mm is here (the larger across and along), and the sampling step for 0.2 px
  const pxmmOf = (f, project) => { const o = project(f(0, 0, 0)), a = project(f(1, 0, 0)), b = project(f(0, 1, 0)); return Math.max(Math.hypot(a[0] - o[0], a[1] - o[1]), Math.hypot(b[0] - o[0], b[1] - o[1])); };
  // (in motion, FAST: a coarser sampling and fewer sectors, the same shapes; at rest, 0.2 px)
  let FAST = 1, SECT = 720;
  const stepOf = px => Math.max(.06, Math.min(.5, .2 / px)) * FAST;
  const flat = (loop, f, n, project, fill, holes = []) => {
    const rings = [loop, ...holes].map(l => l.map(([a, b]) => project(f(a, b, n))));
    const d = rings.map(r => pathOf(r) + 'Z').join('');
    return `<path d="${d}" fill="${fill}" fill-rule="evenodd"/><path d="${d}" fill="none" ${INK}/>`;
  };
  const wire = (pts, f, project, color = '#B4B4B4', w = 1) => `<path d="${pathOf(pts.map(([a, b, n]) => project(f(a, b, n))))}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const arcPts = (cx, cy, r, t0, t1, m) => Array.from({ length: m + 1 }, (_, k) => { const t = t0 + (t1 - t0) * k / m; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
  const mats = (cap, wall) => ({ cap, wall, hole: wall, floor: cap, pocketWall: wall });
  // a turned thing's tone by its normal across its axis (the side it is part of), so its light and shade meet along one
  // straight line down it, through rounded ends too
  const sideTone = (axis, [lit, shade]) => { const Au = unit(axis); return n => { const d = n[0] * Au[0] + n[1] * Au[1] + n[2] * Au[2], m = [n[0] - Au[0] * d, n[1] - Au[1] * d, n[2] - Au[2] * d], l = Math.hypot(...m), v = l > .3 ? m.map(x => x / l) : n, L = SOL().L; return v[0] * L[0] + v[1] * L[1] + v[2] * L[2] > .15 ? lit : shade; }; };

  // ---- the tray: 245 x 225 mm, 13 high, a pocket 10 deep inside a 7 mm rim, corners rounded 9 outside (2 in)
  const T = { w: 245, d: 225, h: 13, depth: 10, rim: 7, r: 9 };
  const TRAY_MATS = { cap: ['#EEEEEC', '#E4E4E2'], wall: ['#E2E2E0', '#D8D8D6'], hole: ['#E2E2E0', '#D8D8D6'], floor: ['#E9E9E7', '#E3E3E1'], pocketWall: ['#DCDCDA', '#D4D4D2'] };
  function trayShape(step) {
    const w = T.w / 2, d = T.d / 2, i = T.rim, r = T.r;
    return { outer: rounded([[-w, -d, r], [w, -d, r], [w, d, r], [-w, d, r]], step), pockets: [{ loop: rounded([[-w + i, -d + i, r - i], [w - i, -d + i, r - i], [w - i, d - i, r - i], [-w + i, d - i, r - i]], step), depth: T.depth }], t: T.h };
  }

  // ---- the stopped watch (Arnold, 2026-10-04, after a photograph of a real one: a strap held on by the watch, and a crack
  // in the glass for its wear). A round steel case 38 across, 7.6 high, a flat bezel round a domed crystal, cracked from a
  // knock near 8 o'clock; four short lugs, horns sloping off the case's side a pair each side, the strap's end butted
  // against the case between them; a crown at 3. The dial: twelve marks, the hands at 03:11 (the minute old.log has M.
  // going home), the seconds hand stopped at 47. The strap: padded leather, 18 wide at the case narrowing to 16, 3.5
  // thick, stitched along its edges, its holes on the 12 side, its keeper and steel buckle on the 6 side.
  const WATCH = { x: 80, y: 30, rot: .08, r: 19, h: 7.6, lugIn: 9.2, lugW: 3.6, lugOut: 6 };
  function watch(F, project, det) {
    const f = place(F, WATCH.x, WATCH.y, WATCH.rot), step = stepOf(pxmmOf(f, project)), { r, h, lugIn, lugW, lugOut } = WATCH;
    const ST = 3.5, sf = (a, b, n) => f(a, b, n + ST / 2), STRAP = mats(['#E6E6E4', '#DCDCDA'], ['#D8D8D6', '#CECECC']);
    const upC = [[-9, 15.5, 0], [9, 15.5, 0], [8, 72, 8], [-8, 72, 8]], dnC = [[-8, -52, 1.5], [8, -52, 1.5], [9, -15.5, 0], [-9, -15.5, 0]];
    const up = rounded(upC, step), dn = rounded(dnC, step);
    let s = '';
    if (det) {
      s += SOL().extrusion({ outer: up, t: ST }, sf, project, STRAP) + SOL().extrusion({ outer: dn, t: ST }, sf, project, STRAP);
      // the stitching: a dashed seam 2 mm in from each edge (and round the 12 side's tip)
      const seam = (pts, n) => { let d = '', acc = 0, on = true; for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], L = Math.hypot(q[0] - p[0], q[1] - p[1]); acc += L; if (on) d += 'M' + fmt([project(f(p[0], p[1], n)), project(f(q[0], q[1], n))]).replace(' ', 'L'); if (acc > (on ? 1.6 : 1.1)) { acc = 0; on = !on; } } return `<path d="${d}" fill="none" stroke="#C6C6C4" stroke-width="1" stroke-linecap="round"/>`; };
      // (the strap tapers from 9 to 8 either side of its middle; the seam keeps 2 in from its edge, round the tip at 6)
      const edgeAt = b => 9 - (b - 15.5) / (64 - 15.5);
      const upSeam = [...Array.from({ length: 220 }, (_, k) => { const b = 20 + (64 - 20) * k / 219; return [-(edgeAt(b) - 2), b]; }),
        ...Array.from({ length: 120 }, (_, k) => { const tt = Math.PI - Math.PI * k / 119; return [6 * Math.cos(tt), 64 + 6 * Math.sin(tt)]; }),
        ...Array.from({ length: 220 }, (_, k) => { const b = 64 - (64 - 20) * k / 219; return [edgeAt(b) - 2, b]; })];
      s += seam(upSeam, ST + .02);
      for (const sx of [-1, 1]) s += seam(Array.from({ length: 200 }, (_, k) => [sx * (7 - k / 199 * .9), -19.5 - k / 199 * 18.5]), ST + .02);
      for (const b of [40, 46, 52, 58]) s += flat(circle([0, b], .9, step), f, ST + .02, project, '#D0D0CE');
      // the keeper: a band across the 6 side's strap; the buckle at its end (flat steel), its tongue along the strap
      s += flat(rounded([[-8.6, -44, 0], [8.6, -44, 0], [8.6, -39, 0], [-8.6, -39, 0]], step), f, ST + .3, project, '#DCDCDA');
      s += flat(rounded([[-11, -63, 3], [11, -63, 3], [11, -49, 3], [-11, -49, 3]], step), f, ST + .4, project, '#ECECEA', [rounded([[-8.3, -60.3, 1.2], [8.3, -60.3, 1.2], [8.3, -51.7, 1.2], [-8.3, -51.7, 1.2]], step)]);
      s += wire([[0, -50.5, ST + .5], [0, -61.5, ST + .5]], f, project);
      // the lugs: short horns off the case's side, a pair each side of the strap, sloping down from the case to their tips
      // (drawn as their top faces, standing 5 mm: the case covers their roots)
      const LUG = mats(['#EEEEEC', '#E0E0DE'], ['#E2E2E0', '#D4D4D2']);
      for (const sb of [1, -1]) for (const sa of [1, -1]) {
        const x0 = sa * lugIn, x1 = sa * (lugIn + lugW), yr = sb * Math.sqrt(r * r - Math.pow(lugIn + lugW / 2, 2)) * .9, yt = sb * (r + lugOut);
        let lug = rounded([[x0, yr, 0], [x1, yr, 0], [x1, yt, 1.6], [x0, yt, 1.6]], step);
        if (sa * sb < 0) lug.reverse();
        s += SOL().extrusion({ outer: lug, t: 4.4 }, (a, b, n) => f(a, b, n + 3.4), project, LUG);
      }
    } else s += flat(up, f, ST, project, '#E2E2E0') + flat(dn, f, ST, project, '#E2E2E0');
    // the case: turned, a straight side with a crisp top edge, a flat bezel 2.8 wide, the crystal domed over the dial
    const { A, B, N } = axes(f);
    const prof = [[0, 0, 'case'], [0, r, 'case'], [h, r, 'case'], [h, 16.2, 'crystal'], [h + .9, 14.4, 'crystal'], [h + 1.5, 10.5, 'crystal'], [h + 1.8, 5, 'crystal'], [h + 1.85, 0]];
    s += LAT().compose(LAT().lathe(prof, { C: f(0, 0, 0), A: N, U: A, V: B }, project, { case: ['#EEEEEC', '#DCDCDA'], crystal: ['#F9F9F7', '#F4F4F2'] }, { sectors: SECT, split: false, seal: true, matEdges: true }));
    if (det) {
      // the crown at 3: a short stub on the case's side, turned along a
      s += LAT().compose(LAT().lathe([[0, 0, 'k'], [0, 2.3, 'k'], [2.8, 2.3, 'k'], [3.4, 1.7, 'k'], [3.6, 0, 'k']], { C: f(r - .4, 0, h / 2), A, U: N, V: B }, project, { k: ['#EEEEEC', '#DCDCDA'] }, { sectors: SECT / 2, split: false, seal: true }));
    }
    // the dial: the marks, the hands, the cap; read from the seat, 12 toward the tray's back
    const dial = h + .6, d2 = (rr, deg) => { const tt = deg * Math.PI / 180; return [rr * Math.sin(tt), rr * Math.cos(tt), dial]; };
    if (det) {
      for (let k = 0; k < 12; k++) s += wire([d2(k % 3 ? 12.6 : 11.2, k * 30), d2(14.2, k * 30)], f, project, '#BEBEBC');
      const hand = (deg, len, w0, w1, tail) => { const tt = deg * Math.PI / 180, dir = [Math.sin(tt), Math.cos(tt)], pp = [Math.cos(tt), -Math.sin(tt)], P = (u, v) => [u * dir[0] + v * pp[0], u * dir[1] + v * pp[1]];
        const ps = [P(-tail, -w0 / 2), P(len * .78, -w1 / 2), P(len, 0), P(len * .78, w1 / 2), P(-tail, w0 / 2)].map(([a, b]) => project(f(a, b, dial + .02)));
        return `<polygon points="${fmt(ps)}" fill="#808080" stroke="#808080" stroke-width=".4" stroke-linejoin="round"/>`; };   // (filled, no line of their own: a hand is a thin blade)
      s += hand((3 + 11 / 60) * 30, 8.4, 1.3, .7, 1.4) + hand(11 * 6, 13, 1, .5, 1.8);
      s += wire([d2(-3, 282), d2(13.8, 282)], f, project, '#A4A4A2');
      s += `<polygon points="${fmt(circle([0, 0], .75, step).map(([a, b]) => project(f(a, b, dial + .05))))}" fill="#8E8E8C"/>`;
      // the crack: from a knock on the crystal's edge near 8 o'clock, a star of short splits there and one long crack
      // running across under 2, with a branch; broken lines, as glass cracks (their turns are real corners)
      const cz = dial + .9, P2 = (rr, deg) => [rr * Math.sin(deg * Math.PI / 180), rr * Math.cos(deg * Math.PI / 180), cz];
      const knock = P2(14.6, 238);
      const crack = (pts, w = 1) => `<path d="${pathOf(pts.map(([a, b, n]) => project(f(a, b, n))))}" fill="none" stroke="#A9A9A7" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="miter"/>`;
      s += crack([knock, [-9.6, -6.1, cz], [-6.2, -4.3, cz], [-3.1, -1.2, cz], [1.4, .9, cz], [4.2, 3.9, cz], [7.9, 5.2, cz], [10.6, 8.9, cz], [12.4, 10.1, cz]]);
      s += crack([[-3.1, -1.2, cz], [-1.8, -4.6, cz], [.6, -6.8, cz], [1.2, -9.9, cz]]);
      for (const deg of [200, 262, 300]) { const e = P2(14.6 - 4.8, deg + (deg === 262 ? 0 : 6)); s += crack([knock, [(knock[0] * 2 + e[0]) / 3 + .5, (knock[1] * 2 + e[1]) / 3 - .3, cz], e]); }
    } else s += wire([d2(0, 0), d2(8.6, (3 + 11 / 60) * 30)], f, project, '#8E8E8C') + wire([d2(0, 0), d2(13, 66)], f, project, '#8E8E8C');
    return s;
  }

  // ---- a pack of gum: 72 x 20 x 12, its long edges rounded, the wrapper's band round its middle (a shade darker,
  // SPEARMINT on it), the paper folded over at its ends
  const GUM = { x: 52, y: -70, rot: .2, L: 72, W: 20, H: 12, band: 24 };
  function gum(F, project, det) {
    const f = place(F, GUM.x, GUM.y, GUM.rot), step = stepOf(pxmmOf(f, project)), { L, W, H, band } = GUM;
    const sec = rounded([[-W / 2, 0, 2.5], [W / 2, 0, 2.5], [W / 2, H, 2.5], [-W / 2, H, 2.5]], step);   // (b, n) across it
    const segs = [[-L / 2, -band / 2, 'wrap'], [-band / 2, band / 2, 'band'], [band / 2, L / 2, 'wrap']];
    const M = { wrap: mats(['#F2F2F0', '#E6E6E4'], ['#F2F2F0', '#E6E6E4']), band: mats(['#E4E4E2', '#D8D8D6'], ['#E4E4E2', '#D8D8D6']) };
    const depth = a => f(a, 0, H / 2)[2];
    let s = '';
    for (const [a0, a1, m] of segs.sort((p, q) => depth((q[0] + q[1]) / 2) - depth((p[0] + p[1]) / 2))) {
      const mid = (a0 + a1) / 2, fr = (u, v, w) => f(mid + w, u, v), end = m === 'wrap';
      // its end folds: a V on the end the eye sees (on the band's ends, nothing)
      const stamp = det && end ? (fr2, pr, capN) => wire([[-W / 2 + 1, H - .6], [0, H * .5], [W / 2 - 1, H - .6]].map(([u, v]) => [u, v, capN]), (u, v, w) => fr2(u, v, w), pr, '#CFCFCD') : null;
      s += SOL().extrusion({ outer: sec, t: a1 - a0 }, fr, project, M[m], { stamp });
    }
    if (det) {
      // the print on the band's top, read along the pack
      const p = project(f(0, -1.6, H + .02)), ax = project(f(1, -1.6, H + .02)), ay = project(f(0, -2.6, H + .02));
      s += `<text transform="matrix(${[ax[0] - p[0], ax[1] - p[1], ay[0] - p[0], ay[1] - p[1], p[0], p[1]].map(v => v.toFixed(4)).join(' ')})" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="2.9" letter-spacing=".35" fill="#A6A6A4">SPEARMINT</text>`;
    }
    return s;
  }

  // ---- a pen: a capped ballpoint 138 long, its metal tip and collar, a rubber grip a shade darker, the body, the cap
  // over it with its end rounded, and the cap's clip lying along its top
  const PEN = { x: -40, y: -16, rot: -.05, L: 138, R: 5.6 };
  function pen(F, project, det) {
    const f = place(F, PEN.x, PEN.y, PEN.rot), { L, R } = PEN, { A, B, N } = axes(f), step = stepOf(pxmmOf(f, project));
    const end = Array.from({ length: 7 }, (_, k) => { const t = Math.PI / 2 * (k + 1) / 7; return [132 + 6 * Math.sin(t), R * Math.cos(t), 'cap']; });
    const prof = [[0, 0, 'tip'], [.5, .55, 'tip'], [7, 2.3, 'tip'], [7, 3.3, 'collar'], [10, 3.5, 'collar'], [10, 4.5, 'grip'], [21, 4.3, 'grip'], [32, 4.5, 'grip'], [32, 5, 'body'],
      [86, 5, 'body'], [86, R, 'cap'], [132, R, 'cap'], ...end.slice(0, -1), [L, 0, 'cap']];
    let s = LAT().compose(LAT().lathe(prof, { C: f(-L / 2, 0, R), A, U: N, V: B }, project,
      // (each lit as the barrel it is part of, by its normal across the axis: lit by their own normals, the cap end's narrow
      // bands changed tone at different places round it, a staircase)
      Object.fromEntries(Object.entries({ tip: ['#E8E8E6', '#DADAD8'], collar: ['#E2E2E0', '#D6D6D4'], grip: ['#D6D6D4', '#CCCCCA'], body: ['#EFEFED', '#E3E3E1'], cap: ['#E4E4E2', '#D8D8D6'] }).map(([k, m]) => [k, sideTone(A, m)])),
      { sectors: SECT, split: false, seal: true, matEdges: true }));
    if (det) {
      // the clip: steel, lying along the cap's top, its tip rounded, its head wider where it meets the cap's end
      const x0 = 96 - L / 2, x1 = 127 - L / 2;
      s += flat(rounded([[x0, -1.7, 1.7], [x1, -1.7, 0], [x1, -2.6, 0], [x1 + 4, -2.6, 1], [x1 + 4, 2.6, 1], [x1, 2.6, 0], [x1, 1.7, 0], [x0, 1.7, 1.7]], step), f, 2 * R + .5, project, '#EAEAE8');
    }
    return s;
  }

  // ---- reading glasses (Arnold, 2026-10-04, from a photograph: round wire frames; solid, as the first ones were): two
  // round rims, a keyhole bridge arching between them, a hinge block on each rim's outer side, nose pads on little arms;
  // folded, the two temples cross behind the lenses and run past the far rim, where each earpiece turns down to a rounded
  // tip. Every part a solid in the mug's light: the rims 2 mm across and 2.6 deep, the bridge, the hinges, the temples,
  // the tips; small (in the drawer), the rims as wire lines.
  const GL = { x: -52, y: -66, rot: .03, r: 23, cx: 31 };
  function glasses(F, project, det) {
    const f = place(F, GL.x, GL.y, GL.rot), step = stepOf(pxmmOf(f, project)), { r, cx } = GL;
    const FRAME = mats(['#DADAD8', '#CECECC'], ['#CDCDCB', '#C4C4C2']), TIPS = mats(['#CFCFCD', '#C4C4C2'], ['#C4C4C2', '#BABAB8']);
    const arcC = (c, rr, t0, t1) => { const m = Math.max(4, Math.ceil(Math.abs(t1 - t0) * rr / step)); return Array.from({ length: m + 1 }, (_, k) => { const tt = t0 + (t1 - t0) * k / m; return [c[0] + rr * Math.cos(tt), c[1] + rr * Math.sin(tt)]; }); };
    const line = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); return Array.from({ length: n + 1 }, (_, k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); };
    const solidAt = (loop, t, n, m, holes = []) => SOL().extrusion({ outer: loop, holes, t }, (a, b, z) => f(a, b, z + n + t / 2), project, m);
    const ccw = loop => { let ar = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; ar += p[0] * q[1] - q[0] * p[1]; } return ar < 0 ? loop.slice().reverse() : loop; };
    let s = '';
    if (!det) {
      for (const sx of [-1, 1]) s += `<path d="${pathOf(circle([sx * cx, 0], r, step).map(([a, b]) => project(f(a, b, 4))))}Z" fill="none" ${INK}/>`;
      return s + wire(arcC([0, 9], 10.5, Math.PI - .35, .35).map(([a, b]) => [a, b, 4]), f, project);
    }
    // the temples, under: from each hinge straight across, past the far rim, then the earpiece bending down to its tip
    const temple = (sx, end, bend) => {
      const h0 = [sx * (cx + r + 1.6), 5.2], h1 = [-sx * end[0], end[1]], d = [h1[0] - h0[0], h1[1] - h0[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L];
      const straight = line(h0, h1), nrm = [-u[1] * -sx, u[0] * -sx];
      const c = [h1[0] - nrm[0] * bend, h1[1] - nrm[1] * bend], t0 = Math.atan2(h1[1] - c[1], h1[0] - c[0]);
      const cl = [...straight, ...arcC(c, bend, t0, t0 + sx * 1.25).slice(1)];
      return { cl, tip: cl.slice(-Math.ceil(13 / step)) };
    };
    const tR = temple(1, [cx + r - 9, -3], 15), tL = temple(-1, [cx + r - 13, -6], 13);
    [[tL, .2], [tR, 1.9]].forEach(([tm, n]) => {
      s += solidAt(ccw(strip(tm.cl, .8)), 1.6, n, FRAME);
      const e = tm.tip[tm.tip.length - 1], tipLoop = ccw(strip(tm.tip, 1.6));
      s += solidAt(tipLoop, 2.2, n, TIPS) + solidAt(circle(e, 1.6, step), 2.2, n, TIPS);
    });
    // the nose pads, on their little arms, under the rims' inner lower sides
    for (const sx of [1, -1]) {
      const at = [sx * (cx - r * .82), -r * .45], pad = [sx * (cx - r * .82 - 3.2), -r * .45 - 3.5];
      s += solidAt(ccw(strip(line(at, pad), .5)), 1, 2.6, FRAME);
      const nOv = Math.max(24, Math.ceil(2 * Math.PI * 4 / step)), oval = Array.from({ length: nOv }, (_, k) => { const tt = 2 * Math.PI * k / nOv, x = 2.3 * Math.cos(tt), y = 4.2 * Math.sin(tt), rot = sx * .45; return [pad[0] + x * Math.cos(rot) - y * Math.sin(rot), pad[1] + x * Math.sin(rot) + y * Math.cos(rot)]; });
      s += solidAt(oval, 1.4, 1.2, mats(['#F4F4F2', '#ECECEA'], ['#E8E8E6', '#E0E0DE']));
    }
    // the bridge: a keyhole arch from rim to rim, rising over the nose (under the rims' edges at its ends)
    const bTop = 19.5, bx = cx - r * Math.cos(Math.PI / 6), by = r * Math.sin(Math.PI / 6), R = (bx * bx + (bTop - by) * (bTop - by)) / (2 * (bTop - by)), bc = [0, bTop - R];
    s += solidAt(ccw(strip(arcC(bc, R, Math.atan2(by - bc[1], -bx - 1), Math.atan2(by - bc[1], bx + 1)), 1)), 2.4, 3.1, FRAME);
    // the hinge blocks, on each rim's outer side over where its temple starts
    for (const sx of [-1, 1]) s += solidAt(ccw(rounded([[cx + r - 1.2, 3.2, 1.2], [cx + r + 3.4, 3.2, 1.2], [cx + r + 3.4, 7.6, 1.2], [cx + r - 1.2, 7.6, 1.2]].map(([a, b, rr]) => [sx * a, b, rr]), step)), 3.2, 2.6, FRAME);
    // the rims: round, 2 mm across, 2.6 deep, the clear lenses in them
    for (const sx of [-1, 1]) s += solidAt(circle([sx * cx, 0], r + 1, step), 2.6, 3, FRAME, [circle([sx * cx, 0], r - 1, step)]);
    return s;
  }

  // ---- the envelope's place in the tray (mdrawer.js envelope() draws it): face up, its long side across, the flap's edge
  // toward the back, a little turned
  const ENV_IN = { x: -36, y: 54, rot: -.05 };
  function envelopePose(F) {
    const f = place(F, ENV_IN.x, ENV_IN.y, ENV_IN.rot), { o, A, B } = axes(f);
    return { c: add(o, mul(unit(cross(A, B)), .4 * MM)), A: unit(A), B: mul(unit(B), -1) };
  }

  // ---- the poses. In the drawer: against its front, centred across, its floor 30 px under the drawer's top. Held: in
  // front of you, its back raised 45 degrees, about 690 px across.
  const IN = { x: 1360, y: 1520 };
  const trayOut = out => out - .012 - T.d / 2 / 1765;       // its centre's depth
  function drawerPose(out) {
    return { c: dd().toCamF([IN.x, IN.y, trayOut(out)]), A: [1, 0, 0], B: [0, 0, 1] };
  }
  const outAt = () => .012 + T.d / 1765 + .0005;           // the drawer's travel from which it is wholly out
  // (one pose, as you would hold it looking at the screen; looking down slides the picture with the view (heldProject),
  // as the canister's does, rather than moving the tray, which turned it: its front wall went from 31 px to 7)
  function heldPose() {
    const Z = 1500 * T.w * MM / 690, th = 45 * Math.PI / 180, r = -1.5 * Math.PI / 180;   // (at 55 degrees its front walls were nearly edge-on: slivers 2 to 3 px)
    return { c: [0, (585 - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [Math.sin(r) * Math.sin(th), -Math.cos(r) * Math.sin(th), Math.cos(th)] };
  }

  /* the tray and everything in it at pose, through project. env: { lifted, opened }. Returns { svg, hit, envHit }. */
  function render(pose, project, { env = {}, width = 1, fast = false, bare = false } = {}) {
    FAST = fast ? 2.5 : 1; SECT = fast ? 360 : 720;
    const F = frameOf(pose), px = pxmmOf(F, project), step = stepOf(px), det = px >= 1.8;
    let svg = SOL().extrusion(trayShape(step), (a, b, n) => F(a, b, n + T.depth - T.h / 2), project, TRAY_MATS, { width });
    // what lies in it, the furthest first (bare: the tray alone, for where it is)
    const things = bare ? [] : [[WATCH, () => watch(F, project, det)], [GUM, () => gum(F, project, det)], [PEN, () => pen(F, project, det)], [GL, () => glasses(F, project, det)]];
    let envHit = null;
    if (!env.lifted && !bare) things.push([ENV_IN, () => { const e = window.mDrawer.envelope(envelopePose(F), project, { opened: env.opened, width }); envHit = e.hit; return e.svg; }]);
    things.sort((p, q) => F(q[0].x, q[0].y, 0)[2] - F(p[0].x, p[0].y, 0)[2]);
    for (const [, draw] of things) svg += draw();
    const w = T.w / 2, d = T.d / 2, hit = fmt(rounded([[-w, -d, T.r], [w, -d, T.r], [w, d, T.r], [-w, d, T.r]], 2).map(([a, b]) => project(F(a, b, T.depth))));
    return { svg, hit, envHit, det, px };
  }
  const heldProject = (rest, s = 1) => p => { const a = dd().roomF(p), b = dd().proj(p); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s + rest * s]; };
  window.mTray = { heldProject, T, WATCH, GUM, PEN, GL, ENV_IN, drawerPose, heldPose, outAt, render, envelopePose, frameOf };
})();
