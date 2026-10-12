/* ceiling.js — the ceiling tile out of place on night 2 (design.md, "M.'s password"; Arnold, 2026-10-03, round 3).

   The ceiling is the drawing's own grid: two families of curves (scene.svg's #ceiling). One cell above the desk, in view at
   the top of the frame at every window shape (right of centre, above the monitor), is the tile. Every shape is in that
   cell's own (s, t), a Coons patch over its four drawn edges, so it follows the curves exactly. A tile pushed up into the
   dark above moves up the screen; it is drawn clipped to its cell, the dark (#C8C8C6, the room's dark of an opening) where
   it no longer covers, and the cell's own edges drawn again over it in the ceiling's grey, so the grid stays in front.

   Pure: the page hands it the ceiling's curves as samplers ({ len, at(l) -> [x, y] } in the stage's coordinates); the
   cell's edges are sampled every 0.2 px of their length. */
(function () {
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const AT = [790, 58];                                   // a point in the cell
  const STEP = .2;
  // (at: a point in another cell, for the stills of the ceiling seen looking up; the page's cell by default)
  function build(paths, AT = window.ceilingTile.AT) {
    // coarse polylines (every 2 px) to find the cell and its corners
    const coarse = paths.map(p => { const n = Math.ceil(p.len / 2); return Array.from({ length: n + 1 }, (_, i) => ({ q: p.at(p.len * i / n), l: p.len * i / n })); });
    const radialOf = c => Math.abs(c[c.length - 1].q[1] - c[0].q[1]) > Math.abs(c[c.length - 1].q[0] - c[0].q[0]);
    const idx = paths.map((_, i) => i), radial = idx.filter(i => radialOf(coarse[i])), cross = idx.filter(i => !radialOf(coarse[i]));
    const xAtY = (c, y) => { for (let i = 1; i < c.length; i++) { const a = c[i - 1].q, b = c[i].q; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return null; };
    const yAtX = (c, x) => { for (let i = 1; i < c.length; i++) { const a = c[i - 1].q, b = c[i].q; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return null; };
    const lr = radial.map(i => ({ i, x: xAtY(coarse[i], AT[1]) })).filter(r => r.x !== null);
    const R0 = lr.filter(r => r.x < AT[0]).sort((a, b) => b.x - a.x)[0].i, R1 = lr.filter(r => r.x > AT[0]).sort((a, b) => a.x - b.x)[0].i;
    const ud = cross.map(i => ({ i, y: yAtX(coarse[i], AT[0]) })).filter(r => r.y !== null);
    const C0 = ud.filter(r => r.y < AT[1]).sort((a, b) => b.y - a.y)[0].i, C1 = ud.filter(r => r.y > AT[1]).sort((a, b) => a.y - b.y)[0].i;
    // where two curves cross: the segments that cross, refined by bisection on the true curves (to 1e-6 px)
    function meet(i, j) {
      const A = coarse[i], B = coarse[j];
      for (let a = 1; a < A.length; a++) for (let b = 1; b < B.length; b++) {
        const p = A[a - 1].q, q = A[a].q, r = B[b - 1].q, s = B[b].q, den = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
        if (Math.abs(den) < 1e-12) continue;
        const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / den, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        let la = A[a - 1].l + (A[a].l - A[a - 1].l) * t, lb = B[b - 1].l + (B[b].l - B[b - 1].l) * u;
        // Newton on the two true curves: P(la) = Q(lb)
        for (let k = 0; k < 30; k++) {
          const P = paths[i].at(la), Q = paths[j].at(lb), h = 1e-3;
          const dP = [(paths[i].at(la + h)[0] - P[0]) / h, (paths[i].at(la + h)[1] - P[1]) / h], dQ = [(paths[j].at(lb + h)[0] - Q[0]) / h, (paths[j].at(lb + h)[1] - Q[1]) / h];
          const ex = P[0] - Q[0], ey = P[1] - Q[1], det = dP[0] * -dQ[1] - dP[1] * -dQ[0];
          if (Math.abs(det) < 1e-12) break;
          const da = (ex * -dQ[1] - ey * -dQ[0]) / det, db = (dP[0] * ey - dP[1] * ex) / det;
          la -= da; lb -= db;
          if (Math.abs(da) + Math.abs(db) < 1e-9) break;
        }
        return { q: paths[i].at(la), li: la, lj: lb };
      }
      return null;
    }
    const mTL = meet(R0, C0), mTR = meet(R1, C0), mBL = meet(R0, C1), mBR = meet(R1, C1);
    const TL = mTL.q, TR = mTR.q, BL = mBL.q, BR = mBR.q;
    // each edge: its curve between two corners, sampled every 0.2 px of its length, by arc length (beyond the ends, on
    // along the end's tangent, for a tile lifted past its cell)
    function edge(path, l0, l1) {
      const n = Math.max(2, Math.ceil(Math.abs(l1 - l0) / STEP)), pts = Array.from({ length: n + 1 }, (_, k) => paths[path].at(l0 + (l1 - l0) * k / n));
      const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const total = L[L.length - 1];
      return t => {
        if (t <= 0 || t >= 1) { const [p, q] = t <= 0 ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]], d = Math.hypot(q[0] - p[0], q[1] - p[1]), e = t <= 0 ? pts[0] : pts[pts.length - 1], over = (t <= 0 ? t : t - 1) * total; return [e[0] + (q[0] - p[0]) / d * over, e[1] + (q[1] - p[1]) / d * over]; }
        const dd = t * total; let lo = 0, hi = L.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < dd) lo = m; else hi = m; }
        const u = (dd - L[lo]) / (L[hi] - L[lo] || 1);
        return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u];
      };
    }
    const eTop = edge(C0, mTL.lj, mTR.lj), eBot = edge(C1, mBL.lj, mBR.lj), eLeft = edge(R0, mTL.li, mBL.li), eRight = edge(R1, mTR.li, mBR.li);
    const coons = ([s, t]) => { const a = eTop(s), b = eBot(s), c = eLeft(t), d = eRight(t); return [0, 1].map(i => (1 - t) * a[i] + t * b[i] + (1 - s) * c[i] + s * d[i] - ((1 - s) * (1 - t) * TL[i] + s * (1 - t) * TR[i] + (1 - s) * t * BL[i] + s * t * BR[i])); };
    const len = (f, a, b) => { let L = 0, p = f(a); for (let k = 1; k <= 200; k++) { const q = f(a + (b - a) * k / 200); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; };
    // a run in (s, t) from p to q, sampled every 0.2 px of the screen
    const runST = (p, q) => { const L = len(u => coons([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]), 0, 1), n = Math.max(2, Math.ceil(L / STEP)); return Array.from({ length: n }, (_, k) => coons([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n])); };
    const quadST = q => q.flatMap((p, i) => runST(p, q[(i + 1) % q.length]));
    const cell = quadST([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const cellH = Math.hypot(BL[0] - TL[0], BL[1] - TL[1]);
    // the tile lifted by lift px up the screen, its left end tilt px more (pushed up at that end): in t, a shift of
    // (lift + tilt (1 - s)) / cellH. Its outline: the top edge, the right side, the bottom edge back, the left side.
    const dt = (lift, tilt) => s => (lift + tilt * (1 - s)) / cellH;
    function tileLoop(lift, tilt) {
      const d = dt(lift, tilt), curveRun = (f, n) => Array.from({ length: n }, (_, k) => f(k / n));
      const L = len(s => coons([s, 1 - d(s)]), 0, 1), n = Math.max(2, Math.ceil(L / STEP));
      const top = curveRun(s => coons([s, -d(s)]), n), right = curveRun(u => coons([1, -d(1) + u]), Math.ceil(cellH / STEP));
      const bottom = curveRun(s => coons([1 - s, 1 - d(1 - s)]), n), left = curveRun(u => coons([0, 1 - d(0) - u]), Math.ceil(cellH / STEP));
      return { loop: [...top, ...right, ...bottom, ...left], lower: [...bottom, coons([0, 1 - d(0)])] };
    }
    let CLIP = 0;
    /* the tile at (lift, tilt) px; glint: [s, t] of a glint in the gap, or null; inner: svg drawn in the cell, under the
       tile (the key in the gap) */
    function svg(lift, tilt, { glint = null, inner = '' } = {}) {
      const id = 'ceiling-cell-' + (++CLIP), { loop, lower } = tileLoop(lift, tilt);
      return `<clipPath id="${id}"><polygon points="${fmt(cell)}"/></clipPath>` +
        `<polygon points="${fmt(cell)}" fill="#C8C8C6"/>` +
        `<g clip-path="url(#${id})">${glint ? glintSvg(glint) : ''}${inner}<polygon points="${fmt(loop)}" fill="#F6F6F4"/><path d="M${fmt(lower).split(' ').join('L')}" fill="none" stroke="#B4B4B4" stroke-width="1" stroke-linecap="round"/></g>` +
        `<polygon points="${fmt(cell)}" fill="none" stroke="#DCDCDA" stroke-width="1" stroke-linejoin="round"/>`;
    }
    // the glint: a small bright sliver of metal in the gap (the key's bow catching the light), a lozenge 4.8 by 2.2 px
    function glintSvg([s, t]) { const c = coons([s, t]); return `<path d="M${(c[0] - 2.4).toFixed(2)},${c[1].toFixed(2)}L${c[0].toFixed(2)},${(c[1] - 1.1).toFixed(2)}L${(c[0] + 2.4).toFixed(2)},${c[1].toFixed(2)}L${c[0].toFixed(2)},${(c[1] + 1.1).toFixed(2)}Z" fill="#FFFFFF" stroke="#E2E2E0" stroke-width=".6" stroke-linejoin="round"/>`; }
    return { TL, TR, BL, BR, cell, cellH, coons, tileLoop, svg, hit: fmt(cell), cable: (lift, tilt, pull) => cable(coons, cellH, lift, tilt, pull) };
  }
  /* ---- the camera's cable (night 2; design.md section 5, "The camera's arc, decided", 2; 2026-10-12, build step 9; a listed
     placeholder for Arnold's art). Up in the dark behind the pushed-aside tile, a cable droops out from under the tile's
     lower edge and goes back up behind it: a band CABLE.w px wide, flat-filled, its two sides in the drawing's one-pixel line,
     its ends hidden under the tile (the tile is drawn over it). Pulled (pull 1), its right end has come free: it hangs from
     under the edge and lies along the gap, its plug at the end. pull between 0 and 1 is the yank, each point of the line
     moved straight from the one shape to the other in the cell's own (s, t). Everything is in the Coons patch's (s, t), so it
     follows the drawing's curves; the line is sampled every 0.2 px of the screen, its sides offset along the screen normal.
     lift, tilt: the tile's, in px (the page's, scaled); the gap is t from 1 - d(s) to 1. Returns { svg, hit, line, sides }
     (line, sides for the audit). */
  const CABLE = { w: 6.5, s: [.5, .86], sag: .62, loose: .26, lay: .7, fill: '#DCDCDA', plug: { l: 12, w: 10, r: 2.2, fill: '#E6E6E4' } };
  function cable(coons, cellH, lift, tilt, pull = 0) {
    const d = s => (lift + tilt * (1 - s)) / cellH, [s0, s1] = CABLE.s, V0 = -.12;
    // looped, v from V0 to 1 - V0: under the edge at both ends (t above 1 - d)
    const loop = w => { const v = V0 + (1 - 2 * V0) * w, s = s0 + (s1 - s0) * v; return [s, 1 - d(s) + d(s) * CABLE.sag * Math.sin(Math.PI * v)]; };
    // loose, v from V0 to 1: from under the edge, down, then along the gap to its end, lying level there
    const loose = w => { const v = V0 + (1 - V0) * w, s = s0 + CABLE.loose * v, f = v < 0 ? 2 * v : 1 - (1 - v) * (1 - v); return [s, 1 - d(s) + d(s) * CABLE.lay * f]; };
    const at = w => { const a = loop(w), b = loose(w); return coons([a[0] + (b[0] - a[0]) * pull, a[1] + (b[1] - a[1]) * pull]); };
    // sampled every 0.2 px of the screen (by a fine pass to measure, then by length)
    const fine = Array.from({ length: 801 }, (_, i) => at(i / 800)), L = [0];
    for (let i = 1; i < fine.length; i++) L.push(L[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
    const total = L[L.length - 1], n = Math.ceil(total / .2), line = [];
    for (let k = 0, j = 0; k <= n; k++) { const dd = total * k / n; while (j < L.length - 2 && L[j + 1] < dd) j++; const u = (dd - L[j]) / (L[j + 1] - L[j] || 1); line.push([fine[j][0] + (fine[j + 1][0] - fine[j][0]) * u, fine[j][1] + (fine[j + 1][1] - fine[j][1]) * u]); }
    // the screen normal at each point (from its neighbours), and the sides
    const nrm = line.map((p, i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [-dy / m, dx / m]; });
    const side = k => line.map((p, i) => [p[0] + nrm[i][0] * k, p[1] + nrm[i][1] * k]);
    // (each side sampled again by its own length: the outer side of a bend is longer than the line, its steps stretched)
    const even = ps => { const out = [ps[0]]; for (let i = 1; i < ps.length; i++) { const p = out[out.length - 1], q = ps[i], m = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / .2); for (let k = 1; k <= m; k++) out.push([p[0] + (q[0] - p[0]) * k / m, p[1] + (q[1] - p[1]) * k / m]); } return out; };
    const A = even(side(CABLE.w / 2)), B = even(side(-CABLE.w / 2));
    const P = ps => ps.map(q => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ');
    const INK = 'fill="none" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"';
    let svg = `<polygon points="${P([...A, ...B.slice().reverse()])}" fill="${CABLE.fill}"/><path d="M${P(A).split(' ').join('L')}" ${INK}/><path d="M${P(B).split(' ').join('L')}" ${INK}/>`;
    // the plug, once it is out of its socket: a rounded block on the end, along the line (its corners sampled every 0.2 px)
    if (pull > 0) {
      const e = line[line.length - 1], q = line[Math.max(0, line.length - 6)], tx = (e[0] - q[0]) / (Math.hypot(e[0] - q[0], e[1] - q[1]) || 1), ty = (e[1] - q[1]) / (Math.hypot(e[0] - q[0], e[1] - q[1]) || 1);
      const { l, w: pw, r } = CABLE.plug, pts = [];
      const corner = (cx, cy, a0) => { const m = Math.ceil(Math.PI / 2 * r / .2); for (let i = 0; i <= m; i++) { const a = a0 + Math.PI / 2 * i / m; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
      corner(l - r, pw / 2 - r, 0); corner(r, pw / 2 - r, Math.PI / 2); corner(r, -pw / 2 + r, Math.PI); corner(l - r, -pw / 2 + r, 3 * Math.PI / 2);
      const toScreen = ([x, y]) => [e[0] + tx * x - ty * y, e[1] + ty * x + tx * y];
      svg += `<polygon points="${P(pts.map(toScreen))}" fill="${CABLE.plug.fill}" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"/>`;
    }
    const hitA = side(10), hitB = side(-10);
    return { svg, hit: P([...hitA, ...hitB.slice().reverse()]), line, sides: [A, B] };
  }
  // where the tile is in each state: [lift, tilt] (px); and where the glint and the key are in the gap
  // (out: the stills' 5 px at the thin end put the tile's edge 5 px from the grid's line; 6.5 keeps the rule's 6)
  const STATES = { flush: [0, 0], out: [6.5, 10], peek: [18, 5], aside: [38, 12] };
  const GLINT = { peek: [.22, .86], out: [.22, .93] }, KEY_AT = [.3, .97];
  window.ceilingTile = { build, STATES, GLINT, KEY_AT, AT, CABLE };
})();
