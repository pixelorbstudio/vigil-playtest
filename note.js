/* note.js — the login sticky note (Arnold, 2026-10-03, round 2; design.md "The login note"). Pure geometry in the stage's
   coordinates; app.js draws it and runs the peel and the fall, audit-note.html checks every frame.
   A standard Post-it, 76 mm square, at the monitor's own scale (1.8 px a mm on the bezel: a 17-inch CRT's picture is
   about 244 mm tall and the drawn tube 435 px; the knobs, about 20 mm, are 38 px), so 137 px. Stuck on the bezel under
   the tube, left of the vents, tilted against the lens as by hand. It is paper: the glued strip along its top (about
   9 mm) flat on the bezel and a hair deeper in tone, its edge a line across; below it the sheet lifts away, its bottom
   6 mm off the bezel and its bottom right corner curled out 16 mm. In the room's camera on the bezel's plane (depth 1000),
   every edge sampled every 0.25 px on the screen. Turned past edge-on it shows its back: plain paper, no writing. */
(function () {
  const NOTE = { S: 137, at: [505, 679], lean: -2.2 * Math.PI / 180, Z: 1000, F: 1500, EYE: [720, 813], strip: .12, lift: 11, curl: 29,
    yellow: { strip: '#EEE39E', body: '#F4EBAA' }, ink: '#5E5E5C' };
  const k = NOTE.Z / NOTE.F;
  // how far the sheet stands off the bezel (toward you) at (u across, v down), in px at the bezel
  function liftAt(u, v) {
    const S = NOTE.S, A = NOTE.strip * S; if (v <= A) return 0;
    const w = (v - A) / (S - A), c = Math.max(0, (u / S - .45) / .55);
    return NOTE.lift * w * w + NOTE.curl * c * c * w * w * w;
  }
  // its pose: the top-left corner and its axes, across (a), down (b) and out (n, toward you), peeled by `peel` (radians)
  // about its top edge, the bottom coming toward you, and dropped by `drop` (camera units, down)
  function pose(peel = 0, drop = 0) {
    const c = Math.cos(NOTE.lean), s = Math.sin(NOTE.lean), S = NOTE.S;
    const centre = [(NOTE.at[0] - NOTE.EYE[0]) * k, (NOTE.at[1] - NOTE.EYE[1]) * k, NOTE.Z];
    const a = [c * k, s * k, 0], b0 = [-s * k, c * k, 0], n0 = [0, 0, -k];
    const b = b0.map((x, i) => x * Math.cos(peel) + n0[i] * Math.sin(peel)), n = n0.map((x, i) => x * Math.cos(peel) - b0[i] * Math.sin(peel));
    const P0 = [0, 1, 2].map(i => centre[i] - a[i] * S / 2 - b0[i] * S / 2 + (i === 1 ? drop : 0));
    return { P0, a, b, n };
  }
  const proj = p => [NOTE.EYE[0] + NOTE.F * p[0] / p[2], NOTE.EYE[1] + NOTE.F * p[1] / p[2]];
  // the note's shapes: { front, outline, body, strip, line, words: [{ text, matrix, size }] }; front false shows its back
  function shapes(peel = 0, drop = 0) {
    const { P0, a, b, n } = pose(peel, drop), S = NOTE.S, A = NOTE.strip * S;
    const at = (u, v) => proj([0, 1, 2].map(i => P0[i] + a[i] * u + b[i] * v + n[i] * liftAt(u, v)));
    const edge = (u0, v0, u1, v1) => { const p = at(u0, v0), q = at(u1, v1), m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / .25)); return Array.from({ length: m }, (_, i) => at(u0 + (u1 - u0) * i / m, v0 + (v1 - v0) * i / m)); };
    const region = (v0, v1) => [...edge(0, v0, S, v0), ...edge(S, v0, S, v1), ...edge(S, v1, 0, v1), ...edge(0, v1, 0, v0)];
    const mid = [0, 1, 2].map(i => P0[i] + a[i] * S / 2 + b[i] * S / 2), front = n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0;
    // each line of writing placed by an affine fit at its own baseline
    const word = (text, u, v, size) => { const o = at(u, v), ax = at(u + 1, v), ay = at(u, v + 1); return { text, size, matrix: [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]] }; };
    return { front, outline: region(0, S), body: region(A, S), strip: region(0, A), line: edge(0, A, S, A).concat([at(S, A)]),
      words: [word('login:', 14, 62, 30), word('your name', 12, 99, 30)] };
  }
  const fmt = ps => ps.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"';
  function svg(peel = 0, drop = 0) {
    const s = shapes(peel, drop), Y = NOTE.yellow;
    if (!s.front) return `<polygon points="${fmt(s.outline)}" fill="${Y.body}" ${INK}/>`;
    return `<polygon points="${fmt(s.body)}" fill="${Y.body}" stroke="${Y.body}" stroke-width=".5"/>` +
      `<polygon points="${fmt(s.strip)}" fill="${Y.strip}" stroke="${Y.strip}" stroke-width=".5"/>` +
      `<path d="M${fmt(s.line).split(' ').join('L')}" fill="none" ${INK}/>` +
      `<polygon points="${fmt(s.outline)}" fill="none" ${INK}/>` +
      s.words.map(w => `<text transform="matrix(${w.matrix.map(x => x.toFixed(4)).join(' ')})" font-family="Caveat, cursive" font-size="${w.size}" fill="${NOTE.ink}">${w.text}</text>`).join('');
  }
  // the peel and the fall, by time since the click (ms): a quarter second peeling, held at the top; then it lets go and
  // falls, still turning, at its own scale (1.8 px a mm on the bezel's plane, so 0.833 mm a camera unit there), as paper
  // falls: g, and about 1.25 m/s at most
  const MMCU = 1.5 / 1.8, G = 9810 / MMCU / 1e6, VT = 1250 / MMCU / 1000;
  const dropAt = t => VT * t - VT * VT / G * (1 - Math.exp(-G * t / VT));
  function motionAt(ms) {
    const peel = ms <= 260 ? 1.1 * (ms / 260) ** 2 : 1.1 + (ms - 260) / 260;
    return { peel, drop: dropAt(Math.max(0, ms - 260)) };
  }
  const api = { NOTE, shapes, svg, motionAt, liftAt, END: 900 };
  if (typeof window !== 'undefined') window.loginNote = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
