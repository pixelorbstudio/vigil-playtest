/* sheet.js — the cheat sheet (Eugene's playtest, 2026-10-02; design.md, "Onboarding"): the right pedestal's top drawer
   opens as the others do, and in it lies a handwritten card, friendly and in-world: what DOWN, HOT, STUCK and LOSS
   mean, the fix for each, and that top shows every rack. Clicked, it is lifted and held up in front of you, as the
   polaroid is; clicked again, it goes back where it lay.

   Pure drawing in the room's camera (drawer.js's pedestal space F, toCamF and its camera; one millimetre scale,
   1.765 mm a camera unit); the page (app.js, "the cheat sheet") does the clicks, the timing and the sounds.
   The drawer is the delivery drawer's mirror (delivery-drawer branch, delivery.js): the eye is to its left, so as it
   comes out you see its left side's outside and its right wall's inside. */
(function () {
  const MM = 1 / 1.765;                                  // camera units a millimetre (drawer.js MM_CAM)
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round"';
  // the box: x 1240..1480, y 1352..1462 on the desk's front, the right pedestal's top drawer (drawer.js desk drawers[0]).
  // depth in the pedestal's units (1765 mm a unit); OPEN: all the way out. The drawer is far below the eye: its front
  // hides all of its floor but a strip at the back (about 6 cm deep, pulled right out), and its left wall hides the floor
  // left of x 1338; so the card does not lie on the floor, it stands at the back, leaning against it, its face to you.
  const BOX = { x0: 1240, x1: 1480, y0: 1352, y1: 1462, depth: .22, wall: 9, wd: .01 };   // (walls 9 px: at 8 the top strips' edges stood 5.7 px apart)
  const OPEN = .22;
  // the card: 140 x 90 mm, landscape; where it stands: its bottom edge's middle at x, foot (in depth units) in front of
  // the drawer's back, leaning back against it by lean
  const CARD = { w: 140, h: 90, x: 1340, foot: .05, lean: 15 * Math.PI / 180 };
  // What it says (Arnold to approve the words; design.md, "Onboarding"). In Caveat, the room's one hand. [left, right]:
  // the kinds in a column, what they mean and the fix beside them.
  const LINES = [
    { t: 'night shift, the short version', y: -30, size: 9 },
    { k: 'DOWN', t: 'not answering: reboot it', y: -16 },
    { k: 'HOT', t: 'running hot: reroute it', y: -5 },
    { k: 'STUCK', t: 'in pieces: the DEFRAG cart', y: 6 },
    { k: 'LOSS', t: 'a rack losing packets: ROUTE', y: 17 },
    { t: 'type  top  to see every rack', y: 30 },
    { t: "you'll be fine :)", y: 39, size: 7.5, right: true },
  ];
  const COL = { k: -61, t: -36 }, SIZE = 8;

  function drawer(out) {
    const F = window.deskDrawer.F, { x0, x1, y0, y1, wall, wd } = BOX;
    const poly = (ps, fill, extra = '') => `<polygon points="${fmt(ps.map(F))}" fill="${fill}" ${extra}/>`;
    // straight runs sampled on one grid, at every whole x (and their ends), so the desk's bend curves them and two edges
    // along the same line land on the same points (sampled each on its own, they stood 0.15 px apart: a doubled line)
    const run = (a, b) => { const xs = [a[0]]; const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); for (let x = Math.floor(lo) + 1; x < hi; x++) xs.push(x); if (b[0] < a[0]) xs.splice(1, xs.length, ...xs.slice(1).reverse()); if (Math.abs(b[0] - a[0]) < 1e-9) return [a]; return xs.map(x => { const t = (x - a[0]) / (b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * t); }); };
    const quad = (a, b, c, d) => [...run(a, b), ...run(b, c), ...run(c, d), ...run(d, a)];
    const front = out, back = 0, floor = y1 - wall, ix0 = x0 + wall, ix1 = x1 - wall;
    let s = '', inner = '';
    if (out > .0005) {
      s += poly(quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]), '#C8C8C6', INK);                       // the opening, dark
      // the floor and the right wall's inside run right to the back: the wall's inside hides the opening's edge (started a
      // hair in front of it, as the delivery drawer's do, a sliver of the opening showed and its edge stood 0.4 px off the wall's)
      s += poly(quad([ix0, floor, back], [ix1, floor, back], [ix1, floor, front - wd], [ix0, floor, front - wd]), '#D2D2D0', INK);   // the floor
      s += poly(quad([ix1, y0, back], [ix1, y0, front - wd], [ix1, floor, front - wd], [ix1, floor, back]), '#E2E2E0', INK);       // the right wall's inside
    }
    let over = '';
    if (out > .0005) {
      // the left side's outside, between the pedestal's face and the front; the walls' top edges
      over += poly(quad([x0, y0, 0], [x0, y0, front], [x0, y1, front], [x0, y1, 0]), '#E6E6E4', INK);
      over += poly(quad([x0, y0, back], [ix0, y0, back], [ix0, y0, front], [x0, y0, front]), '#ECECEA', INK);
      over += poly(quad([ix1, y0, back], [x1, y0, back], [x1, y0, front], [ix1, y0, front]), '#ECECEA', INK);
      over += poly(quad([x0, y0, front - wd], [x1, y0, front - wd], [x1, y0, front], [x0, y0, front]), '#ECECEA', INK);
    }
    over += poly(quad([x0, y0, front], [x1, y0, front], [x1, y1, front], [x0, y1, front]), '#F4F4F2', INK);
    over += window.deskDrawer.pullAt((x0 + x1) / 2 - 48, (x0 + x1) / 2 + 48, y0 + 33, y0 + 46, front);
    return { under: s, over };
  }
  // where a click takes the drawer: its front, and the opening above it once it is out
  function drawerHit(out) {
    const F = window.deskDrawer.F, { x0, x1, y0, y1 } = BOX;
    return fmt([[x0, y1, out], [x1, y1, out], [x1, y1, 0], [x1, y0, 0], [x0, y0, 0], [x0, y0, out]].map(F));
  }
  // the card standing at the back of the drawer, as a card pose in the camera ({ c, A, B }: A across it, B down it)
  function lyingPose(out) {
    const { y1, wall } = BOX, l = CARD.lean, B = [0, Math.cos(l), -Math.sin(l)];
    const foot = window.deskDrawer.toCamF([CARD.x, y1 - wall - .4, out - BOX.depth + CARD.foot]);
    return { c: [0, 1, 2].map(i => foot[i] - B[i] * CARD.h / 2 * MM), A: [1, 0, 0], B };
  }
  // held up in front of you, upright, a little turned: about 570 px across (the polaroid's is 300; there is more to read)
  function heldPose(rest) {
    const Z = 210, r = 1.5 * Math.PI / 180;
    return { c: [0, (rest + 480 - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [-Math.sin(r), Math.cos(r), 0] };
  }
  // the card through a projection: its outline sampled every 2 mm (it bends with the room lying in the drawer), its
  // words in Caveat, each line placed by an affine fit at its own baseline
  function card({ c, A, B }, project, width = 1) {
    const at = (mx, my) => [0, 1, 2].map(i => c[i] + (A[i] * mx + B[i] * my) * MM);
    const N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const faceUp = -(N[0] * c[0] + N[1] * c[1] + N[2] * c[2]) < 0;
    const hw = CARD.w / 2, hh = CARD.h / 2, C = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const ring = C.flatMap((p, i) => { const e = C[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(e[0] - p[0], e[1] - p[1]) / 2)); return Array.from({ length: n }, (_, k) => project(at(p[0] + (e[0] - p[0]) * k / n, p[1] + (e[1] - p[1]) * k / n))); });
    let svg = `<polygon points="${fmt(ring)}" fill="${faceUp ? '#FAFAF9' : '#F2F2F0'}" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    if (faceUp) {
      const text = (s, mx, my, size, anchor = 'start', fill = '#6E6E6C') => {
        const o = project(at(mx, my)), ax = project(at(mx + 1, my)), ay = project(at(mx, my + 1));
        const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(n => n.toFixed(4));
        return `<text transform="matrix(${m.join(' ')})" x="0" y="0" text-anchor="${anchor}" font-family="Caveat, cursive" font-size="${size}" fill="${fill}">${s}</text>`;
      };
      for (const l of LINES) {
        if (l.k) svg += text(l.k, COL.k, l.y, SIZE, 'start', '#4E4E4C') + text(l.t, COL.t, l.y, SIZE);
        else if (l.right) svg += text(l.t, hw - 10, l.y, l.size || SIZE, 'end');
        else svg += text(l.t, COL.k, l.y, l.size || SIZE, 'start', l.y < -30 ? '#4E4E4C' : '#6E6E6C');
      }
    }
    return { svg, hit: fmt(ring) };
  }
  // it is drawn once it is wholly out of the pedestal (its top edge in front of the pedestal's face; inside, it is in the
  // dark of the opening): 83% of the way out, while the drawer is still moving
  const cardOut = out => out - BOX.depth + CARD.foot - CARD.h * Math.sin(CARD.lean) / 1765 >= .0005;
  window.cheatSheet = { cardOut, BOX, OPEN, CARD, LINES, drawer, drawerHit, lyingPose, heldPose, card };
})();
