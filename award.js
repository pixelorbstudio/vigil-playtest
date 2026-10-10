/* award.js — night 1's award slip, wherever it is (design.md section 5, the aftermath; Arnold, 2026-10-06). It comes
   in 04:44's canister; put away after reading, it goes onto the monitor, taped flat over the vents at the chin (the
   place Arnold chose from the stills); clicked there it is held up like any paper, and put away from there it is filed
   in your folder in the file drawer, or, while that is still locked, laid in the right pedestal's top drawer with the
   cheat sheet. Wherever it is, it keeps its date. The page (app.js, "the award slip") does the clicks and the timing.

   The paper is the canister's own slip (delivery.slip, 560 by 300 held: 149.33 by 80 mm). Flat to the eye (held, on the
   bezel, which faces you) it is a turn and a scale, exact: place { cx, cy, k, rot } as delivery.slip's. In the room's
   camera (drawer.js: one millimetre scale, 1.765 mm a camera unit) it is a pose { c, A, B }, drawn as the letters are:
   its outline sampled every 2 mm through the projection (it bends with the room in a drawer), its print placed by an
   affine fit at its centre, and only what is big enough to read (4 px) or to stand clear (6 px).

   The tape: two strips across its top corners, 16 by 6 mm, at 35 degrees to its edge, flat grey, outlined. Put on when
   it is put on the monitor; they come away with it, and stay on it after. */
(function () {
  const PX_MM = 1.8, W = 560, H = 300, MW = 149.33, MH = 80, U = MW / W, K = MW * PX_MM / W;   // (U: mm a print unit; K: the bezel's scale)
  const MM = 1 / 1.765;                                  // camera units a millimetre (drawer.js MM_CAM)
  const PLACES = {
    chin: { cx: 727, cy: 683, rot: -2, under: false },
    top: { cx: 900, cy: 96, rot: 6, under: true },
  };
  const ON = { ...PLACES.chin, k: K };                   // where it is taped on the monitor (Arnold, 2026-10-06: the chin)
  const fmt = ps => ps.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"';
  // a point of the print (u across, v down, in the held slip's 560 by 300) on the stage, for a flat place
  const flatMap = place => {
    const a = (place.rot ?? -3) * Math.PI / 180, c = Math.cos(a) * place.k, s = Math.sin(a) * place.k;
    return (u, v) => [place.cx + (u - W / 2) * c - (v - H / 2) * s, place.cy + (u - W / 2) * s + (v - H / 2) * c];
  };
  // the two strips of tape, in print units: across each top corner (grow: how much of each is down, 0..1, laid from its
  // outer end; the left one first)
  const TAPE = { L: 16 / U, T: 6 / U, at: [[34, 6, -35], [W - 34, 6, 35]] };
  function tapes(map, grow = [1, 1], width = 1) {
    return TAPE.at.map(([x, y, turn], i) => {
      const g = Math.max(0, Math.min(1, grow[i] ?? 1)); if (g <= 0) return '';
      const a = turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), L = TAPE.L / 2, T = TAPE.T / 2;
      // its outer end stays put as it is laid: the left one's is its left end, the right one's its right
      const [u0, u1] = i === 0 ? [-L, -L + 2 * L * g] : [L - 2 * L * g, L];
      const edge = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * U / 2)); return Array.from({ length: n }, (_, k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); };
      const C = [[u0, -T], [u1, -T], [u1, T], [u0, T]].map(([p, q]) => [x + p * c - q * s, y + p * s + q * c]);
      const ring = C.flatMap((p, k) => edge(p, C[(k + 1) % 4])).map(([u, v]) => map(u, v));
      return `<polygon points="${fmt(ring)}" fill="#EEEEEC" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    }).join('');
  }
  // flat to the eye: held up, on its way, or taped on the bezel
  function flat(place, { to = '', date = '', taped = false, grow } = {}) {
    return window.delivery.slip('award', { to, date }, place) + (taped || grow ? tapes(flatMap(place), grow || [1, 1]) : '');
  }
  // (the stills: at a named place, taped unless tucked in)
  function svg(name, { to = '', date = '' } = {}) {
    const p = PLACES[name];
    return flat({ cx: p.cx, cy: p.cy, k: K, rot: p.rot }, { to, date, taped: !p.under });
  }
  const outline = name => { const p = PLACES[name], m = flatMap({ ...p, k: K }); return [[0, 0], [W, 0], [W, H], [0, H]].map(([u, v]) => m(u, v)); };
  // the room's camera pose that draws exactly as a flat place does through the near camera (deskDrawer.proj: 1500 / z
  // px a camera unit, the eye at 720, 813): the hand-over between the two
  function poseOf(place) {
    const Z = 1500 * MM * MW / (place.k * W), r = (place.rot ?? -3) * Math.PI / 180;
    return { c: [(place.cx - 720) * Z / 1500, (place.cy - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [-Math.sin(r), Math.cos(r), 0] };
  }
  // the print without its paper (delivery.slip's, at its own size, top left at 0, 0), and its pieces too small to read
  // or to stand clear taken out: text under 4 px tall; the two rules if either comes within 6 px of an edge or the other
  function print({ to = '', date = '' }, sx, sy) {
    const sv = window.delivery.slip('award', { to, date }, { cx: W / 2, cy: H / 2, k: 1, rot: 0 });
    let g = sv.slice(sv.indexOf('<g ')).replace(/^<g transform="matrix\([^)]*\)">/, '<g>');
    const small = Math.min(sx, sy);
    g = g.replace(/<text [^>]*font-size="([\d.]+)"[^>]*>[^<]*<\/text>/g, (t, size) => (+size * small < 4 ? '' : t));
    if (Math.min(84, H - 236, 236 - 84) * sy < 6) g = g.replace(/<path d="M[^"]*"[^>]*\/>/g, '');
    return g;
  }
  // in the room's camera: pose { c, A, B } (c its centre, A along its length, B down it, in camera units; its face toward
  // -(A x B)), project: camera point -> screen
  function paper({ c, A, B }, project, { to = '', date = '', taped = false } = {}, width = 1) {
    const at = (mx, my) => [0, 1, 2].map(i => c[i] + (A[i] * (mx - MW / 2) + B[i] * (my - MH / 2)) * MM);
    const P = (u, v) => project(at(u * U, v * U));
    const N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const faceUp = -(N[0] * c[0] + N[1] * c[1] + N[2] * c[2]) < 0;
    const C = [[0, 0], [W, 0], [W, H], [0, H]];
    const ring = C.flatMap((p, i) => { const e = C[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(e[0] - p[0], e[1] - p[1]) * U / 2)); return Array.from({ length: n }, (_, k) => P(p[0] + (e[0] - p[0]) * k / n, p[1] + (e[1] - p[1]) * k / n)); });
    let s = `<polygon points="${fmt(ring)}" fill="${faceUp ? '#FAFAF9' : '#F2F2F0'}" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    if (faceUp) {
      const o = P(W / 2, H / 2), xa = P(W / 2 + 10, H / 2), xb = P(W / 2 - 10, H / 2), ya = P(W / 2, H / 2 + 10), yb = P(W / 2, H / 2 - 10);
      const ex = [(xa[0] - xb[0]) / 20, (xa[1] - xb[1]) / 20], ey = [(ya[0] - yb[0]) / 20, (ya[1] - yb[1]) / 20];
      const m = [ex[0], ex[1], ey[0], ey[1], o[0] - W / 2 * ex[0] - H / 2 * ey[0], o[1] - W / 2 * ex[1] - H / 2 * ey[1]].map(v => v.toFixed(4));
      s += `<g transform="matrix(${m.join(' ')})">${print({ to, date }, Math.hypot(...ex), Math.hypot(...ey))}</g>`;
    }
    if (taped) s += tapes(P, [1, 1], width);
    return { svg: s, hit: fmt(ring) };
  }

  // ---- where it lies in the drawers (the drawers all the way out; drawer.js's pedestal space)
  // the right pedestal's top drawer, with the cheat sheet (sheet.js): the card stands at the back, leaning back; the slip
  // stands behind it, all but upright against the drawer's back (its foot 7 mm out, 3 degrees), so its top shows over
  // the card's (17 px, its tape on its corners) and the card's words stay clear (at 4:3 the drawer's right end is past the
  // frame: the slip is no further right than the card)
  const SHEET = { x: 1330, foot: .004, lean: 3 * Math.PI / 180 };
  function inSheet(out) {
    const CS = window.cheatSheet, { y1, wall, depth } = CS.BOX, l = SHEET.lean, Bv = [0, Math.cos(l), -Math.sin(l)];
    const foot = window.deskDrawer.toCamF([SHEET.x, y1 - wall - .4, out - depth + SHEET.foot]);
    return { c: [0, 1, 2].map(i => foot[i] - Bv[i] * MH / 2 * MM), A: [1, 0, 0], B: Bv };
  }
  // it is drawn once it is wholly out of the pedestal (as the card: sheet.js cardOut)
  const sheetOut = out => out - window.cheatSheet.BOX.depth + SHEET.foot - MH * Math.sin(SHEET.lean) / 1765 >= .0005;
  // your folder in the file drawer (the back one): standing in it in front of its sheet, its top a little under the front
  // flap's, so filed it is out of sight; rise: lifted straight up (pedestal px)
  const FOLDER = { x: 1352, at: .7, sink: 8 };
  function inFolder(rise = 0) {
    const dd = window.deskDrawer, f = dd.fileStack().files.find(f => f.who === 'you'), PXMM = 1.765 / 1.5;   // (drawer.js PX_MM: mm a pedestal px)
    const d = f.fb + (f.fd - f.fb) * FOLDER.at + dd.FILE.travel, top = dd.FILE.tops + dd.FL + FOLDER.sink - rise;
    const tl = dd.toCamF([FOLDER.x - MW / 2 / PXMM, top, d]);
    return { c: [tl[0] + MW / 2 * MM, tl[1] + MH / 2 * MM, tl[2]], A: [1, 0, 0], B: [0, 1, 0] };
  }
  window.award = { PLACES, ON, K, PX_MM, W, H, MW, MH, svg, outline, flat, flatMap, tapes, poseOf, paper, inSheet, sheetOut, inFolder, SHEET, FOLDER };
})();
