/* letters.js — the old operators' letters in the file drawer (Arnold, 2026-10-04: the four letters approved word for
   word; the lift-and-hold view built from the approved stills, app.js "the old operators' letters"). Typed company letters on the plain Vigil letterhead (ts, rd);
   unsent handwritten ones, each in its writer's own hand (jk, aw), never Caveat, which is the polaroid strips' and the
   tabs' hand. Each is a sheet of its own real size in the room's camera (drawer.js: one millimetre scale, 1.765 mm a
   camera unit), drawn through whatever projection it is in: standing in its folder, lifted, held up in front of you.

   Pure drawing and poses; the page does the clicks and the timing. Fonts: assets/fonts (OFL): Nothing You Could Do (jk),
   Indie Flower (aw). Typed: the company's monospace, as the issue slips. */
(function () {
  const MM = 1 / 1.765;                                  // camera units a millimetre (drawer.js MM_CAM)
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONO = 'ui-monospace, Consolas, monospace';
  const GREY = '#8E8E8C', RULE = '#D2D2D0', TYPE = '#4A4A48', INKP = '#5A5A58', LINED = '#DCDCDA';
  // Each paper: its size (mm), and what is on it, laid out from its top left corner (mm). Dates on the typed letters
  // are the operator's last login (finger). The words are Arnold's, approved word for word (2026-10-04).
  const PAPERS = {
    ts: { w: 216, h: 279, typed: true, date: '13 January 2012', lines: ['Congratulations on 4,000 consecutive shifts!', 'Your dedication keeps Site 4 awake.', '', 'Vigil Systems, Operator Care'] },
    rd: { w: 216, h: 279, typed: true, date: '1 October 2017', lines: ['Your request for leave has been received.', "We'll be in touch at the end of your shift.", '', 'Vigil Systems, Operator Care'] },
    // a page off a notepad, ruled; quick and slanted; it stops mid-sentence
    jk: { w: 152, h: 229, font: "'Nothing You Could Do', cursive", size: 6.2, ruled: 8.5, first: 2, lines: ["tell mom I'll be home for the weekend.", "this job's almost"] },
    // a plain sheet of writing paper; a round hand; unsent, unfinished
    aw: { w: 160, h: 210, font: "'Indie Flower', cursive", size: 6, lead: 10.5, top: 32, lines: ['sam, the tomatoes want water every other day', "and don't believe the cat.", 'back sunday, one more night and'] },
  };
  const TYPED = { margin: 25, head: 26, rule: 34, date: 50, body: 74, lead: 9.4, size: 5.2 };

  // the paper through a projection. pose { c, A, B }: c the sheet's centre in camera space, A along its width, B down it;
  // its face toward -(A x B). Outline sampled every 2 mm (it bends with the room when in the drawer); writing placed by
  // an affine fit at each line's own baseline, and only where it is big enough to read as writing (4 px).
  function paper(who, { c, A, B }, project, width = 1) {
    const P = PAPERS[who], hw = P.w / 2, hh = P.h / 2;
    const at = (mx, my) => [0, 1, 2].map(i => c[i] + (A[i] * (mx - hw) + B[i] * (my - hh)) * MM);
    const N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const faceUp = -(N[0] * c[0] + N[1] * c[1] + N[2] * c[2]) < 0;
    const C = [[0, 0], [P.w, 0], [P.w, P.h], [0, P.h]];
    const ring = C.flatMap((p, i) => { const e = C[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(e[0] - p[0], e[1] - p[1]) / 2)); return Array.from({ length: n }, (_, k) => project(at(p[0] + (e[0] - p[0]) * k / n, p[1] + (e[1] - p[1]) * k / n))); });
    let svg = `<polygon points="${fmt(ring)}" fill="${faceUp ? '#FAFAF9' : '#F2F2F0'}" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    if (!faceUp) return { svg, hit: fmt(ring) };
    const pxmm = Math.hypot(...[0, 1].map(i => project(at(hw + 1, hh))[i] - project(at(hw, hh))[i]));   // px a millimetre here
    const text = (s, mx, my, size, { font = MONO, fill = TYPE, anchor = 'start', extra = '', rot = 0 } = {}) => {
      if (size * pxmm < 4) return '';
      const r = rot * Math.PI / 180, o = project(at(mx, my)), ax = project(at(mx + Math.cos(r), my + Math.sin(r))), ay = project(at(mx - Math.sin(r), my + Math.cos(r)));
      const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(n => n.toFixed(4));
      return `<text transform="matrix(${m.join(' ')})" x="0" y="0" text-anchor="${anchor}" font-family="${font}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
    };
    const line = (y, x0, x1, stroke) => { const n = Math.max(1, Math.ceil((x1 - x0) / 2)); return `<polyline points="${fmt(Array.from({ length: n + 1 }, (_, k) => project(at(x0 + (x1 - x0) * k / n, y))))}" fill="none" stroke="${stroke}" stroke-width="${Math.max(.6, Math.min(1, pxmm * .3))}" stroke-linecap="round"/>`; };
    if (P.typed) {
      const T = TYPED, x0 = T.margin, x1 = P.w - T.margin;
      svg += text('VIGIL SYSTEMS', x0, T.head, 6, { fill: GREY, extra: 'font-weight="700" letter-spacing="1.6"' });
      svg += text('SITE 4', x1, T.head, 4.4, { fill: GREY, anchor: 'end', extra: 'font-weight="600" letter-spacing="1"' });
      if (pxmm * 3 >= 6) svg += line(T.rule, x0, x1, RULE);   // (the rule only where it stands clear of the lettering)
      svg += text(P.date, x1, T.date, T.size, { anchor: 'end' });
      P.lines.forEach((l, i) => { if (l) svg += text(l, x0, T.body + i * T.lead, T.size); });
    } else {
      if (P.ruled) {
        if (P.ruled * pxmm >= 6) for (let y = 22; y < P.h - 8; y += P.ruled) svg += line(y, 0, P.w, LINED);
        P.lines.forEach((l, i) => { svg += text(l, 12, 22 + (P.first + i) * P.ruled - 1.2, P.size, { font: P.font, fill: INKP, rot: [-.8, .5][i] || 0 }); });
      } else P.lines.forEach((l, i) => { svg += text(l, 14, P.top + i * P.lead, P.size, { font: P.font, fill: INKP, rot: [.4, -.5, .7][i] || 0 }); });
    }
    return { svg, hit: fmt(ring) };
  }
  // held up in front of you, upright, a little turned: one distance for all of them, so each is its own size (the
  // typed letters about 790 px tall, their centre a little under the middle of the view)
  const HELD = { Z: 300, y: 585, rot: -1.2 };
  const pose = (Z, x, y, deg) => { const r = deg * Math.PI / 180; return { c: [(x - 720) * Z / 1500, (y - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [-Math.sin(r), Math.cos(r), 0] }; };
  const heldPose = rest => pose(HELD.Z, 720, rest + HELD.y, HELD.rot);
  // a polaroid in the same folder comes up with its letter, behind it, a little further away: its top showing over the
  // letter's top edge, toward the right (as a second slip shows its head over the first). A click brings it to the
  // front, held as the night-1 polaroid is (drawer.js; the page's heldPhoto), the letter staying where it was behind it.
  const BEHIND = { dZ: 6, show: 110, dx: 120, rot: 2.2 };
  function behindPose(rest, who) {
    const Z = HELD.Z + BEHIND.dZ, k = 1500 / Z * MM, top = rest + HELD.y - PAPERS[who].h / 2 * 1500 / HELD.Z * MM;
    return pose(Z, 720 + BEHIND.dx, top - BEHIND.show + 107 / 2 * k, BEHIND.rot);
  }
  const photoFront = rest => pose(190, 720, rest + 470, -2);

  // ---- in the drawer (the drawer all the way out; drawer.js's pedestal space and camera)
  // where a letter stands in its folder: upright, facing you, its top edge the sheet's drawn top; rise: lifted straight up
  function inFolder(who, rise = 0) {
    const dd = window.deskDrawer, S = dd.fileStack(), f = S.files.find(f => f.who === who), p = f.papers[0], P = PAPERS[who];
    const tl = dd.toCamF([p.a, p.y - rise, p.d + dd.FILE.travel]);
    return { c: [tl[0] + P.w / 2 * MM, tl[1] + P.h / 2 * MM, tl[2]], A: [1, 0, 0], B: [0, 1, 0] };
  }
  // the upper edge of everything in front of a folder's sheets, on screen, every half pixel: while a letter rises it is
  // shown only above it (as clip: the region above the edge, to the top of the stage)
  const ENV = {};
  function envelope(who) {
    if (ENV[who]) return ENV[who];
    const lines = window.deskDrawer.inFrontOf(who), xs = lines.flat().map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), env = [];
    const yAt = (pl, x) => { for (let k = 1; k < pl.length; k++) { const a = pl[k - 1], b = pl[k]; if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return Infinity; };
    for (let x = x0; x <= x1; x += .5) { const y = Math.min(...lines.map(l => yAt(l, x))); if (isFinite(y)) env.push([x, y]); }
    const clip = [...env, [env[env.length - 1][0] + 400, env[env.length - 1][1]], [env[env.length - 1][0] + 400, 0], [env[0][0] - 400, 0], [env[0][0] - 400, env[0][1]]];
    return (ENV[who] = { env, clip });
  }
  // how far a letter rises before all of it is above what is in front of it (2 px clear), in pedestal px
  const RISE = {};
  function clearRise(who) {
    if (RISE[who] != null) return RISE[who];
    const { env } = envelope(who), dd = window.deskDrawer, under = (x, y) => { const e = env.find(p => p[0] >= x); return e && y > e[1] - 2; };
    for (let r = 0; r < 700; r += 2) {
      const ps = paper(who, inFolder(who, r), dd.roomF).hit.split(' ').map(q => q.split(',').map(Number));
      if (!ps.some(([x, y]) => under(x, y))) return (RISE[who] = r);
    }
    return (RISE[who] = 700);
  }
  // a polaroid that comes out with its letter travels with it, tucked behind it (wholly behind, its top 20 mm under the
  // letter's) while it is in the drawer, and opens out to its place behind the held letter as the letter comes up (t: 0
  // tucked, 1 held; rest: where the view rests, as the held poses have it). Its centre and turn relative to the
  // letter's, in the letter's own millimetres.
  function photoWith(who, letterPose, t, rest) {
    const P = PAPERS[who], L = letterPose, rest0 = heldPose(rest), B0 = behindPose(rest, who);
    const N = [L.A[1] * L.B[2] - L.A[2] * L.B[1], L.A[2] * L.B[0] - L.A[0] * L.B[2], L.A[0] * L.B[1] - L.A[1] * L.B[0]];
    // held: where the photo stands, in the held letter's frame
    const d = [0, 1, 2].map(i => B0.c[i] - rest0.c[i]), A0 = rest0.A, Bf = rest0.B, N0 = [A0[1] * Bf[2] - A0[2] * Bf[1], A0[2] * Bf[0] - A0[0] * Bf[2], A0[0] * Bf[1] - A0[1] * Bf[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const held = { a: dot(d, A0) / MM, b: dot(d, Bf) / MM, n: dot(d, N0), turn: (BEHIND.rot - HELD.rot) * Math.PI / 180 };
    const tucked = { a: 0, b: -P.h / 2 + 20 + 107 / 2, n: .8, turn: 0 };
    const m = k => tucked[k] + (held[k] - tucked[k]) * t;
    const c = [0, 1, 2].map(i => L.c[i] + (L.A[i] * m('a') + L.B[i] * m('b')) * MM + N[i] * m('n'));
    const r = m('turn'), A = [0, 1, 2].map(i => L.A[i] * Math.cos(r) + L.B[i] * Math.sin(r)), B = [0, 1, 2].map(i => -L.A[i] * Math.sin(r) + L.B[i] * Math.cos(r));
    return { c, A, B };
  }
  // which folders hold a polaroid with their letter
  const PHOTO_OF = { ts: true, aw: true };
  window.letters = { PAPERS, TYPED, HELD, BEHIND, PHOTO_OF, paper, heldPose, behindPose, photoFront, inFolder, envelope, clearRise, photoWith, MM };
})();
