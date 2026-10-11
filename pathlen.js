/* pathlen.js — a path's length and its point at a length, from its own d, in its own user space: what SVG's
   getTotalLength and getPointAtLength give, without the browser measuring the whole path again on every call (Chrome
   does: the load's geometry sampled the ceiling's arch, the desk's edge and the left rack's long edges a few thousand
   times each, about 1.9 s of the page's load; the final sweep's live audit, 2026-10-11).
   Straight runs and cubic Béziers (M L H V C S Q T Z, absolute and relative: what the drawing's exports use); each cubic
   cut into pieces no longer than 0.1 px of its control polygon, so a point is on the curve to well under 0.01 px.
   window.pathLength(el) -> { length, at(s) -> [x, y] } (el: a path element, or its d). */
(function () {
  function segments(d) {
    const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], out = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
    const num = () => +tok[i++];
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      const line = (nx, ny) => { out.push([[x, y], [nx, ny]]); x = nx; y = ny; lc = lq = null; };
      const cubic = (a, b, nx, ny) => { out.push([[x, y], a, b, [nx, ny]]); lc = b; lq = null; x = nx; y = ny; };
      if (C === 'M') { x = num() + ox; y = num() + oy; sx = x; sy = y; lc = lq = null; cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') line(num() + ox, num() + oy);
      else if (C === 'H') line(num() + ox, y);
      else if (C === 'V') line(x, num() + oy);
      else if (C === 'C') { const a = [num() + ox, num() + oy], b = [num() + ox, num() + oy]; cubic(a, b, num() + ox, num() + oy); }
      else if (C === 'S') { const a = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], b = [num() + ox, num() + oy]; cubic(a, b, num() + ox, num() + oy); }
      else if (C === 'Q' || C === 'T') {
        const q = C === 'Q' ? [num() + ox, num() + oy] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y], nx = num() + ox, ny = num() + oy;
        out.push([[x, y], [x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], [nx + 2 / 3 * (q[0] - nx), ny + 2 / 3 * (q[1] - ny)], [nx, ny]]); lq = q; lc = null; x = nx; y = ny;
      }
      else if (C === 'Z') { if (x !== sx || y !== sy) out.push([[x, y], [sx, sy]]); x = sx; y = sy; lc = lq = null; }
      else throw new Error('pathlen: ' + cmd + ' not handled');
    }
    return out;
  }
  window.pathLength = function (el) {
    const d = typeof el === 'string' ? el : el.getAttribute('d');
    const xs = [], ys = [], acc = [0];
    for (const s of segments(d)) {
      let pts;
      if (s.length === 2) pts = [s[0], s[1]];
      else {
        const [p0, p1, p2, p3] = s, poly = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
        const n = Math.max(1, Math.ceil(poly / .1)); pts = [];
        for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
      }
      if (!xs.length) { xs.push(pts[0][0]); ys.push(pts[0][1]); }
      for (let k = 1; k < pts.length; k++) { const a = [xs[xs.length - 1], ys[ys.length - 1]], b = pts[k]; acc.push(acc[acc.length - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); xs.push(b[0]); ys.push(b[1]); }
    }
    const length = acc[acc.length - 1];
    let hint = 0;
    function at(s) {
      s = Math.max(0, Math.min(length, s));
      let j = hint < acc.length - 1 && acc[hint] <= s ? hint : 0;
      if (acc[j + 1] < s) { let lo = j, hi = acc.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] <= s) lo = m; else hi = m; } j = lo; }
      hint = j;
      const L = acc[j + 1] - acc[j], u = L > 0 ? (s - acc[j]) / L : 0;
      return [xs[j] + (xs[j + 1] - xs[j]) * u, ys[j] + (ys[j + 1] - ys[j]) * u];
    }
    return xs.length > 1 ? { length, at } : { length: 0, at: () => [xs[0] || 0, ys[0] || 0] };
  };
})();
