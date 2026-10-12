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
    yellow: { strip: '#EEE39E', body: '#F4EBAA' }, ink: '#5E5E5C',
    // Glenn's from '87 (night 2's gift; 2026-10-12, build step 9): the same note, yellowed, its glue strip a shade browner
    old: { strip: '#E2D597', body: '#EBDFA4' } };
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
  // The writing: the first note's, "login: / your name" in Caveat; or the one that comes down at 04:44 (design.md section 5,
  // "Surface and focus, decided", 11): "login:" over your name and tomorrow's date, in a hand that is neither yours, M.'s,
  // nor the polaroids' (HANDS, HAND: the one Arnold chose). Each line
  // [text, u, v (its baseline), size] on the 137 px square; a line wider than the paper allows is narrowed to fit (fit).
  // Arnold, 2026-10-11, from the stills: Covered By Your Grace (a quick marker hand), its ink lightened a touch toward the
  // first note's grey so it isn't the heaviest writing in the room; the same size. (Kalam, the other still, is dropped.)
  const HANDS = {
    grace: { font: "'Covered By Your Grace', cursive", ink: '#4F4F4D', lines: (name, date) => [['login:', 13, 46, 29], [name, 13, 86, 34, 1], [date, 13, 121, 22]] },
  };
  const HAND = 'grace';
  const FIRST = { font: 'Caveat, cursive', ink: NOTE.ink, lines: [['login:', 14, 62, 30], ['your name', 12, 99, 30]] };
  // Glenn's own, '87 (night 2's gift): "login:" over "glenn" and the date, in a hand that is none of the others' (Nothing You
  // Could Do, OFL, in assets/fonts: a placeholder until Arnold picks one), its ink faded
  const GLENN87 = { font: "'Nothing You Could Do', cursive", ink: '#6E6C66', lines: [['login:', 14, 48, 24], ['glenn', 14, 86, 30], ['19 Dec 87', 14, 120, 19]] };
  // a written note's writing: { font, ink, lines }
  function writing(name, date, hand = HAND) { const H = HANDS[hand] || HANDS[HAND]; return { font: H.font, ink: H.ink, lines: H.lines(name, date) }; }
  const fitOf = (text, size) => { const est = [...text].length * size * .5; return est > NOTE.S - 26 ? NOTE.S - 26 : 0; };   // (a rough advance: the browser fits it exactly)
  // the note's shapes: { front, outline, body, strip, line, words: [{ text, matrix, size, fit }] }; front false shows its back
  // (lk: how far it stands off the bezel, of the first note's: a fresh one lies flatter)
  function shapes(peel = 0, drop = 0, w = FIRST, lk = 1) {
    const { P0, a, b, n } = pose(peel, drop), S = NOTE.S, A = NOTE.strip * S;
    const at = (u, v) => proj([0, 1, 2].map(i => P0[i] + a[i] * u + b[i] * v + n[i] * liftAt(u, v) * lk));
    const edge = (u0, v0, u1, v1) => { const p = at(u0, v0), q = at(u1, v1), m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / .25)); return Array.from({ length: m }, (_, i) => at(u0 + (u1 - u0) * i / m, v0 + (v1 - v0) * i / m)); };
    const region = (v0, v1) => [...edge(0, v0, S, v0), ...edge(S, v0, S, v1), ...edge(S, v1, 0, v1), ...edge(0, v1, 0, v0)];
    const mid = [0, 1, 2].map(i => P0[i] + a[i] * S / 2 + b[i] * S / 2), front = n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0;
    // each line of writing placed by an affine fit at its own baseline
    const word = (text, u, v, size) => { const o = at(u, v), ax = at(u + 1, v), ay = at(u, v + 1); return { text, size, matrix: [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]] }; };
    return { front, outline: region(0, S), body: region(A, S), strip: region(0, A), line: edge(0, A, S, A).concat([at(S, A)]),
      words: w.lines.map(([t, u, v, size, fit]) => Object.assign(word(t, u, v, size), { fit: fit ? fitOf(t, size) : 0 })) };
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const textSvg = (wd, w) => `<text transform="matrix(${wd.matrix.map(x => x.toFixed(4)).join(' ')})" font-family="${w.font}" font-size="${wd.size}" fill="${w.ink}"${wd.fit ? ` textLength="${wd.fit}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(wd.text)}</text>`;
  const fmt = ps => ps.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"';
  function svg(peel = 0, drop = 0, w = FIRST, lk = 1) {
    const s = shapes(peel, drop, w, lk), Y = NOTE.yellow;
    if (!s.front) return `<polygon points="${fmt(s.outline)}" fill="${Y.body}" ${INK}/>`;
    return `<polygon points="${fmt(s.body)}" fill="${Y.body}" stroke="${Y.body}" stroke-width=".5"/>` +
      `<polygon points="${fmt(s.strip)}" fill="${Y.strip}" stroke="${Y.strip}" stroke-width=".5"/>` +
      `<path d="M${fmt(s.line).split(' ').join('L')}" fill="none" ${INK}/>` +
      `<polygon points="${fmt(s.outline)}" fill="none" ${INK}/>` +
      s.words.map(wd => textSvg(wd, w)).join('');
  }
  // Held up in front of you, face on, as the papers are: place { cx, cy, k (px a note px), rot (degrees) }. Flat: the strip,
  // its line, the outline and the writing, no lift (it is in a hand, pressed flat by the thumb).
  function flat(place, w = FIRST, Y = NOTE.yellow) {
    const S = NOTE.S, A = NOTE.strip * S, a = (place.rot ?? -3) * Math.PI / 180, c = Math.cos(a) * place.k, sn = Math.sin(a) * place.k;
    const at = (u, v) => [place.cx + (u - S / 2) * c - (v - S / 2) * sn, place.cy + (u - S / 2) * sn + (v - S / 2) * c];
    const quad = (v0, v1) => [at(0, v0), at(S, v0), at(S, v1), at(0, v1)];
    const o = at(0, 0);
    const m = [c, sn, -sn, c, o[0], o[1]];
    return `<polygon points="${fmt(quad(A, S))}" fill="${Y.body}" stroke="${Y.body}" stroke-width=".5"/>` +
      `<polygon points="${fmt(quad(0, A))}" fill="${Y.strip}" stroke="${Y.strip}" stroke-width=".5"/>` +
      `<path d="M${fmt([at(0, A), at(S, A)]).split(' ').join('L')}" fill="none" ${INK}/>` +
      `<polygon points="${fmt(quad(0, S))}" fill="none" ${INK}/>` +
      `<g transform="matrix(${m.map(x => x.toFixed(4)).join(' ')})">` +
      w.lines.map(([t, u, v, size, fit]) => { const f = fit ? fitOf(t, size) : 0; return `<text x="${u}" y="${v}" font-family="${w.font}" font-size="${size}" fill="${w.ink}"${f ? ` textLength="${f}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(t)}</text>`; }).join('') + '</g>';
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
  const api = { NOTE, shapes, svg, flat, writing, HANDS, HAND, FIRST, GLENN87, motionAt, liftAt, END: 900 };
  if (typeof window !== 'undefined') window.loginNote = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
