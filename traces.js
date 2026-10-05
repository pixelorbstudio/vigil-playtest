/* traces.js — the old operators' polaroids that show a trace of a person (design.md, Polaroids; approved by Arnold
   2026-10-02 from polaroid-stills.html, built 2026-10-04 with the letters): ts, a coat hung on rack-right's door handle;
   aw, a blurred shape in rack-right's glass. Each photo is the drawing itself with one layer added, in the drawing's own
   language (flat greys, one-pixel lines; the shape in the glass a faint darkening in two flat steps, no blur). The code
   is polaroid-stills.html's, unchanged; jk's hand and rd's figure stay parked there.
   traces.photo(who) -> Promise of { src, crop, strip }, for drawer.js's renderCard / photoIn. */
(function () {
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round"';
  const f3 = p => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  const poly = (ps, fill, extra = '') => `<path d="M${ps.map(f3).join('L')}Z" fill="${fill}" ${extra}/>`;
  const line = (ps, extra = '') => `<path d="M${ps.map(f3).join('L')}" fill="none" ${INK} ${extra}/>`;
  // a closed smooth curve through points (centripetal Catmull-Rom), sampled every `step` px
  function smooth(P, { closed = true, step = .25 } = {}) {
    const n = P.length, out = [];
    const get = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), .5) || 1e-6;
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.ceil(len / step));
      for (let k = 0; k < m; k++) {
        const t = t1 + (t2 - t1) * k / m;
        const L = (a, b, ta, tb) => [0, 1].map(j => (tb - t) / (tb - ta) * a[j] + (t - ta) / (tb - ta) * b[j]);
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    if (!closed) out.push(P[n - 1]);
    return out;
  }
  // a closed smooth curve with real corners at the given indices: smooth runs from corner to corner
  function smoothC(P, corners, step = .25) {
    const n = P.length, cs = [...corners].sort((a, b) => a - b);
    if (!cs.length) return smooth(P, { step });
    const out = [];
    for (let k = 0; k < cs.length; k++) {
      const a = cs[k], b = cs[(k + 1) % cs.length], run = [];
      for (let i = a; ; i = (i + 1) % n) { run.push(P[i]); if (i === b && run.length > 1) break; }
      const r = smooth(run, { closed: false, step }); r.pop(); out.push(...r);
    }
    return out;
  }
  // a perspective map from the unit square onto a quad (tl, tr, br, bl), and its inverse
  function homography(tl, tr, br, bl) {
    const [x0, y0] = tl, [x1, y1] = tr, [x2, y2] = br, [x3, y3] = bl;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    const map = (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
    const inv = (x, y) => { let u = .5, v = .5; for (let k = 0; k < 40; k++) { const p = map(u, v), pu = map(u + 1e-4, v), pv = map(u, v + 1e-4); const J = [(pu[0] - p[0]) / 1e-4, (pv[0] - p[0]) / 1e-4, (pu[1] - p[1]) / 1e-4, (pv[1] - p[1]) / 1e-4], ex = x - p[0], ey = y - p[1], D = J[0] * J[3] - J[1] * J[2]; u += (J[3] * ex - J[1] * ey) / D; v += (-J[2] * ex + J[0] * ey) / D; } return [u, v]; };
    return { map, inv };
  }
  // ts: a coat hung by its loop on rack-right's door handle, lying against the door; the monitor hides its near half
  function coat() {
    const door = homography([1106, 59], [1515, 114], [1727, 912], [1256, 1000]), W = .6, Hm = 2.0, hang = [1190, 334];
    const [uh, vh] = door.inv(...hang), o = door.map(uh, vh);
    const P = ps => ps.map(([U, V]) => { const p = door.map(uh + U / W, vh + V / Hm); return [p[0] - o[0] + hang[0], p[1] - o[1] + hang[1]]; });
    // curves are made in millimetres (so the sampling step means something) and mapped onto the door
    const K = 1000, mm = pts => pts.map(([U, V]) => [U * K, V * K]), back = ps => P(ps.map(([a, b]) => [a / K, b / K]));
    const S = (pts, opt) => back(smooth(mm(pts), { ...opt, step: .12 }));
    const SC = (pts, corners) => back(smoothC(mm(pts), corners, .12));
    const C1 = '#D9D9D7', C2 = '#D2D2D0';
    let s = '';
    // the silhouette, sleeves and body as one: right half, then the left mirrored. Corners: each cuff's outer bottom,
    // where the cuff's bottom meets the body's side, and the hem's corners
    const right = [[.06, .018], [.15, .05], [.214, .09], [.238, .15], [.25, .3], [.258, .45], [.261, .545], [.262, .585], [.244, .6], [.245, .72], [.246, .845], [.12, .858]];
    const half = right.length, ring = [[0, .005], ...right, [0, .862], ...right.slice().reverse().map(([u, v]) => [-u, v])];
    const corners = new Set([1 + 7, 1 + 8, 1 + 10, half + 2 + (half - 1 - 10), half + 2 + (half - 1 - 8), half + 2 + (half - 1 - 7)]);
    s += poly(SC(ring, corners), C1, INK);
    // the lining showing at the neck, and the lapels over it
    s += poly(S([[-.055, .02], [0, .012], [.055, .02], [0, .2]]), C2, INK);
    for (const sg of [-1, 1]) s += poly(S([[sg * .056, .02], [sg * .1, .07], [sg * .085, .1], [sg * .03, .26], [sg * .004, .3], [sg * .02, .2]]), C1, INK);
    // the front's opening, the buttons, the pocket flaps
    s += line(S([[.004, .3], [.006, .58], [.008, .858]], { closed: false }));
    for (const v of [.36, .47, .58]) s += poly(S(Array.from({ length: 12 }, (_, k) => [.028 + .011 * Math.cos(k * Math.PI / 6), v + .011 * Math.sin(k * Math.PI / 6)])), C2, INK);
    for (const sg of [-1, 1]) s += poly(SC([[sg * .06, .62], [sg * .145, .615], [sg * .147, .655], [sg * .062, .66]], new Set([0, 1, 2, 3])), C1, INK);
    // each sleeve inside the silhouette: the armhole from the shoulder down its inner edge to the cuff, the cuff's
    // turn-up, and the cuff's bottom where it lies over the body
    for (const sg of [-1, 1]) {
      s += line(S([[sg * .214, .09], [sg * .19, .14], [sg * .168, .22], [sg * .163, .4], [sg * .168, .59]], { closed: false }));
      s += line(S([[sg * .1665, .548], [sg * .214, .552], [sg * .261, .545]], { closed: false }));
      s += line(S([[sg * .168, .59], [sg * .214, .598], [sg * .244, .6]], { closed: false }));
    }
    return s;
  }
  // a shape out of focus in a line drawing: no outline, its edge in two flat steps (a wider pass, fainter, under the shape
  // itself), no blur filter. Each pass is the outline pushed out along its normals by `by` px.
  function grow(ps, by) {
    const n = ps.length, out = [];
    let A = 0; for (let i = 0; i < n; i++) { const p = ps[i], q = ps[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
    const sg = A > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const p = ps[(i - 6 + n) % n], q = ps[(i + 6) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      out.push([ps[i][0] + sg * dy / l * by, ps[i][1] - sg * dx / l * by]);
    }
    return out;
  }
  const soft = (ps, fill, op = 1, by = 5) => poly(grow(ps, by * 2), fill, `fill-opacity="${(op * .3).toFixed(3)}"`) + poly(grow(ps, by), fill, `fill-opacity="${(op * .45).toFixed(3)}"`) + poly(ps, fill, `fill-opacity="${op}"`);
  // aw: a blurred shape in rack-right's glass: someone standing behind the camera, reflected, as a faint darkening of the
  // glass under its sheen; one shape, head into shoulders, a little tilted, one shoulder lower, thinning out downward
  function reflection() {
    const shape = smooth([[1336, 300], [1362, 306], [1378, 330], [1380, 362], [1370, 392], [1362, 412], [1388, 430], [1420, 452], [1438, 492], [1430, 540], [1400, 590], [1352, 618], [1300, 606], [1268, 566], [1258, 516], [1270, 470], [1300, 438], [1318, 418], [1304, 394], [1294, 362], [1298, 330], [1314, 308]]);
    return soft(shape, '#7E7E7C', .085, 7);
  }
  const TRACES = {
    ts: { strip: '01:12', crop: [360, 0, 1080, 1080], at: 'rack-right-door', shift: 240, svg: coat },
    aw: { strip: '05:10', crop: [640, 0, 1040, 1040], at: 'rack-right-door-glass', shift: 240, svg: reflection },
  };
  // the end of the element that starts at i (its matching </g>)
  function closeOf(s, i) {
    let depth = 0;
    const re = /<g\b|<\/g>/g; re.lastIndex = i;
    for (let m; (m = re.exec(s));) { if (m[0] === '</g>') { depth--; if (depth === 0) return m.index + 4; } else depth++; }
    return -1;
  }
  let scene = null;
  const made = {};
  async function photo(who) {
    const t = TRACES[who]; if (!t) return null;
    if (made[who]) return made[who];
    scene = scene || fetch('scene.svg').then(r => r.text());
    const v0 = await scene, i = v0.indexOf(`<g id="${t.at}"`), j = closeOf(v0, i);
    const v = i < 0 || j < 0 ? v0 : v0.slice(0, j) + `<g transform="translate(${t.shift || 0} 0)">${t.svg()}</g>` + v0.slice(j);
    made[who] = { src: URL.createObjectURL(new Blob([v], { type: 'image/svg+xml' })), crop: t.crop, strip: t.strip };
    return made[who];
  }
  window.traces = { photo, TRACES };
})();
