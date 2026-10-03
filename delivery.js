/* delivery.js — deliveries (design.md, "Deliveries"): the delivery drawer, the canister and the slip it brings. Pure
   drawing in the room's camera (drawer.js's pedestal space and camera; lathe.js's surfaces of revolution, in solid.js's
   manner); the page (app.js, "the deliveries") does the timing, the clicks and the sounds.

   The tube is never seen: it ends inside the delivery drawer, the left pedestal's top drawer. A canister lands in it with
   a thunk and the drawer nudges itself open about 4 inches; pulled open, the canister lies across its back against the
   right wall, its lid end in frame at 4:3; clicked, it is lifted into your hands, where you open it. It only ever holds
   a slip of paper, rolled in its mouth: an issue slip (a bag of beans) or a note from Glenn, typed in his red.
   One true size everywhere (the canister 150 mm long, 60 across): held up, the camera brings it close. */
(function () {
  const MM = 1 / 1.765;                                  // camera units a millimetre (drawer.js MM_CAM)
  const V3 = {
    add: (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]],
    mul: (p, k) => [p[0] * k, p[1] * k, p[2] * k],
    dot: (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2],
    cross: (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]],
    unit: p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); },
  };
  function rot(v, ax, b) {                               // v about the unit axis ax by b (Rodrigues)
    const c = Math.cos(b), s = Math.sin(b), d = V3.dot(ax, v), x = V3.cross(ax, v);
    return [v[0] * c + x[0] * s + ax[0] * d * (1 - c), v[1] * c + x[1] * s + ax[1] * d * (1 - c), v[2] * c + x[2] * s + ax[2] * d * (1 - c)];
  }
  const fmt = ps => ps.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round"';
  const LM = { inside: ['#D2D2D0', '#D2D2D0'], can: ['#F7F7F5', '#E8E8E6'], band: ['#DEDEDC', '#D2D2D0'] };

  // ---- the drawer: x -40..200, y 1352..1462 on the desk's front (drawer.js's pedestal space), above the left pedestal's
  // door. out: how far it is pulled toward you, in the pedestal's depth (NUDGE is the 4 inches it opens by itself: an inch
  // showed its side as a 1.5 px sliver; OPEN is pulled out, the canister in view)
  const DLV = { x0: -40, x1: 200, y0: 1352, y1: 1462, depth: .22, wall: 8, wd: .01 };   // (wd .01: the front's top 7.4 px nudged; at .008, 5.9)
  const NUDGE = .12, OPEN = .17;
  const PULL_DX = 30;                                    // its pull right of centre: centred, the 4:3 frame's edge cut it once nudged
  function drawer(out, withCan) {
    const F = window.deskDrawer.F, { x0, x1, y0, y1, wall, wd } = DLV;
    const poly = (ps, fill, extra = '') => `<polygon points="${fmt(ps.map(F))}" fill="${fill}" ${extra}/>`;
    // straight runs sampled every 10 px across, so the desk's bend curves them
    const run = (a, b) => { const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / 10)); return Array.from({ length: n }, (_, k) => a.map((v, j) => v + (b[j] - v) * k / n)); };
    const quad = (a, b, c, d) => [...run(a, b), ...run(b, c), ...run(c, d), ...run(d, a)];
    // only the part pulled out of the pedestal is drawn; behind its face, the dark of the opening
    const front = out, back = 0, floor = y1 - wall, ix0 = x0 + wall, ix1 = x1 - wall;
    let s = '';
    if (out > .0005) {
      s += poly(quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]), '#C8C8C6', INK);
      s += poly(quad([ix0, floor, back + wd], [ix1, floor, back + wd], [ix1, floor, front - wd], [ix0, floor, front - wd]), '#D2D2D0', INK);
      s += poly(quad([ix0, y0, back + wd], [ix0, y0, front - wd], [ix0, floor, front - wd], [ix0, floor, back + wd]), '#E2E2E0', INK);
      if (withCan) s += withCan;
      // the right side's outside, between the pedestal's face and the drawer's front; the walls' top edges
      s += poly(quad([x1, y0, 0], [x1, y0, front], [x1, y1, front], [x1, y1, 0]), '#E6E6E4', INK);
      s += poly(quad([x0, y0, back], [ix0, y0, back], [ix0, y0, front], [x0, y0, front]), '#ECECEA', INK);
      s += poly(quad([ix1, y0, back], [x1, y0, back], [x1, y0, front], [ix1, y0, front]), '#ECECEA', INK);
      s += poly(quad([x0, y0, front - wd], [x1, y0, front - wd], [x1, y0, front], [x0, y0, front]), '#ECECEA', INK);
    }
    s += poly(quad([x0, y0, front], [x1, y0, front], [x1, y1, front], [x0, y1, front]), '#F4F4F2', INK);
    s += window.deskDrawer.pullAt((x0 + x1) / 2 - 48 + PULL_DX, (x0 + x1) / 2 + 48 + PULL_DX, y0 + 33, y0 + 46, front);
    return s;
  }
  // where a click takes the drawer: its front, and the opening above it once it is out
  function drawerHit(out) {
    const F = window.deskDrawer.F, { x0, x1, y0, y1 } = DLV;
    const ps = [[x0, y1, out], [x1, y1, out], [x1, y1, 0], [x1, y0, 0], [x0, y0, 0], [x0, y0, out]].map(F);
    return fmt(ps);
  }

  // ---- the canister: a carrier 150 mm long, 60 across (a 150 was 190: at 4:3 only about 115 px of the open drawer is in
  // frame), two felt bands, a hinged lid with a rounded edge
  const CAN = { L: 150, r: 30 };
  const SEAT = CAN.L - 18, WALL = 6;                     // the mouth; the wall there and the lid's lip (at 3 mm their rings stood 3-5 px apart)
  // seen small (in the drawer, about 0.7 px a mm): square ends, its bands flush, edged by a ring each, the lid shut
  function farProfile() {
    const { L, r } = CAN;
    return [[0, 0, 'can'], [0, r, 'can'], [18, r, 'band'], [32, r, 'can'], [L - 32, r, 'band'], [L - 18, r, 'can'], [L, r, 'can'], [L, 0]];
  }
  // in the drawer: across the back, against the right wall, its lid end toward the frame; the drawer's own depth moves it
  // (at OPEN it lies .035 out of the pedestal; a little further left and its far end showed as a sliver over the wall)
  function drawerPose(out) {
    const { y1, wall } = DLV, floor = y1 - wall, k = MM;
    const mid = window.deskDrawer.toCamF([122, floor, out - OPEN + .035]);
    const A = [-1, 0, 0], U = [0, -1, 0], V = V3.cross(A, U);   // its lid end to the left (toward the frame)
    const L = CAN.L;
    return { C: [mid[0] - A[0] * k * L / 2, mid[1] - CAN.r * k, mid[2] - A[2] * k * L / 2], A: V3.mul(A, k), U: V3.mul(U, k), V: V3.mul(V, k) };
  }
  function far(pose, project) {
    return window.lathe.compose(window.lathe.lathe(farProfile(), pose, project, LM, { sectors: 720, matEdges: true, split: false, seal: true }));
  }
  // held across in front of you, its open end turned toward you and a little down, the hinge on top. One true size: the
  // camera brings it close (as near as the stills held it 1.7 times its size, so the same on screen). rest: where you
  // are looking (the view's offset down), so it is in front of you wherever that is.
  const HELD = { c: [-77.8 / 1.7, -45 / 1.7, 560 / 1.7], yaw: 38 * Math.PI / 180, pitch: 8 * Math.PI / 180 };
  function heldPose(rest = 0) {
    const k = MM, y = HELD.yaw, p = HELD.pitch, Z = HELD.c[2];
    const A = [Math.cos(y) * Math.cos(p), Math.sin(p), -Math.sin(y) * Math.cos(p)], U0 = [Math.sin(y), 0, Math.cos(y)], V0 = V3.cross(A, U0);
    const flip = V0[1] < 0 ? 1 : -1, U = V3.mul(U0, flip), V = V3.cross(A, U);
    return { C: [HELD.c[0], HELD.c[1] + rest * Z / 1500, Z], A: V3.mul(A, k), U: V3.mul(U, k), V: V3.mul(V, k) };
  }
  // the lid's top edge rounded, 5 mm (a 45 degree chamfer put a corner in its outline), sampled finer than the crease angle
  const LID_ROUND = r => Array.from({ length: 25 }, (_, k) => { const t = Math.PI / 2 * k / 24; return [13 + 5 * Math.sin(t), r - 5 + 5 * Math.cos(t), 'round']; });
  let CLIP_IDS = 0;
  /* held up: what is 'slip' (rolled in its mouth) or 'empty'; lid: how far open (radians; 125 degrees, sprung open) */
  function held(what, pose, project, lid = 0) {
    const L = window.lathe, { r } = CAN, { C, A, U, V } = pose, Uu = V3.unit(U);
    const at = (h, u, v) => V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, u)), V3.mul(V, v));
    const seat = SEAT;
    // the felt bands stand 4 mm proud (at 3 their step put two rings 5.8 px apart)
    const body = [[0, 0, 'can'], [0, r - 3, 'can'], [3, r, 'can'], [18, r, 'band'], [18, r + 4, 'band'], [32, r + 4, 'band'], [32, r, 'can'],
      [seat - 22, r, 'band'], [seat - 22, r + 4, 'band'], [seat - 8, r + 4, 'band'], [seat - 8, r, 'can'], [seat, r, 'rim'], [seat, r - WALL, 'inside'], [10, r - WALL, 'inside'], [10, 0]];
    const mats = { ...LM, rim: LM.can };
    const items = L.lathe(body, { C, A, U, V }, project, mats, { sectors: 720, noGenerators: ['inside'], split: false, seal: true });
    // the lid, hinged at the back of the rim
    const hinge = at(seat, 0, r), ax = Uu, Au = V3.unit(A);
    const sw = V3.dot(rot(Au, ax, -lid), V) > 0 ? -lid : lid;
    const lidC = V3.add(hinge, rot(V3.add(at(seat, 0, 0), V3.mul(hinge, -1)), ax, sw));
    const lidP = [[15, 0, 'inside'], [15, r - WALL, 'inside'], [0, r - WALL, 'rim'], [0, r, 'can'], ...LID_ROUND(r), [18, 0]];   // (no knob: behind the lid it peeked over its edge as a crescent)
    // the rounded edge lit as the side it rounds off from (lit by its own normal, its tone's edge stepped like a staircase)
    const lidAx = rot(Au, ax, sw), roundTone = n => { const d = V3.dot(n, lidAx), m = V3.unit(V3.add(n, V3.mul(lidAx, -d))); return V3.dot(m, window.solid.L) > .15 ? LM.can[0] : LM.can[1]; };
    const lidItems = L.lathe(lidP, { C: lidC, A: rot(A, ax, sw), U: rot(U, ax, sw), V: rot(V, ax, sw) }, project, { ...mats, round: roundTone }, { sectors: 720, noGenerators: ['inside'], split: false, seal: true });
    const sort = l => l.sort((a, b) => b.depth - a.depth).map(x => x.svg).join('');
    // a fixed order by what is in front of what (sorted by depth, the long inside wall painted over the far rim, and a band's
    // face drawn after the rim showed over it): the inside; what came, in the tube; the walls and bands; the rim; what came,
    // out of the mouth. The lid: its inside, its outside's fills, then its outside's lines (its rounded edge is many narrow
    // bands, and band by band each fill covered half the outline of the one before); behind the mouth when open, over it shut.
    const inside = items.filter(x => x.mat === 'inside'), rim = items.filter(x => x.mat === 'rim'), walls = items.filter(x => x.mat !== 'inside' && x.mat !== 'rim');
    let inTube = '', outOfIt = '';
    if (what === 'slip') {
      const roll = rolledSlip(at, project, seat);
      inTube = roll.inner;                               // (no clip: the walls and the rim after it hide what is outside the mouth)
      // the part out of the mouth goes last; its fill covered half the stroke of the inner part's lines at the cut (a
      // silhouette leaves its end ring on the tangent), so those lines go again on top within 8 px of where they meet it
      const ends = [];
      for (const m of roll.inner.matchAll(/<path d="([^"]+)"/g)) for (const sp of m[1].split('M').filter(Boolean)) {
        const ps = [...sp.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map(q => [+q[1], +q[2]]);
        for (const e of [ps[0], ps[ps.length - 1]]) if (roll.seam.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.5)) ends.push(e);
      }
      const innerLines = [...roll.inner.matchAll(/<path [^>]*\/>/g)].map(m => m[0]).join('');
      const id = 'rollseam' + (++CLIP_IDS);
      outOfIt = roll.outer + (ends.length ? `<clipPath id="${id}">${ends.map(e => `<circle cx="${e[0].toFixed(2)}" cy="${e[1].toFixed(2)}" r="8"/>`).join('')}</clipPath><g clip-path="url(#${id})">${innerLines}</g>` : '');
    }
    const lidIn = sort(lidItems.filter(x => x.mat === 'inside')), lidOut = sort(lidItems.filter(x => x.mat !== 'inside'));
    const lidSvg = lidIn + lidOut.replace(/<path [^>]*\/>/g, '') + [...lidOut.matchAll(/<path [^>]*\/>/g)].map(m => m[0]).join('');
    const bodySvg = sort(inside) + inTube + sort(walls) + sort(rim) + outOfIt;
    return lid > Math.PI / 3 ? lidSvg + bodySvg : bodySvg + lidSvg;
  }
  // the slip, rolled to 22 mm across, its top 40 mm out of the mouth, a little below the axis (lying on the bottom, its
  // outline passed behind the near rim just inside the mouth); in two parts cut at the mouth, 2880 sectors so the two
  // parts' silhouettes meet without a jog; its end shows the paper's turns, a spiral clear of its rim
  const SLIP_ROLL = { r: 11, w: 80, out: 40 };
  function rolledSlip(at, project, seat) {
    const L = window.lathe, { r, w, out } = SLIP_ROLL, h0 = seat + out - w, h1 = seat + out;
    const paper = { body: ['#FAFAF9', '#ECECEA'], end: ['#FAFAF9', '#F0F0EE'] };
    const off = -3;
    const C = at(0, 0, off), A = V3.add(at(1, 0, off), V3.mul(C, -1)), U = V3.add(at(0, 1, off), V3.mul(C, -1)), V = V3.add(at(0, 0, off + 1), V3.mul(C, -1));
    const frame = { C, A, U, V }, opts = { sectors: 2880, seal: true };
    const inner = L.compose(L.lathe([[h0, 0, 'end'], [h0, r, 'body'], [seat, r]], frame, project, paper, { ...opts, open: [2] }));
    const outerItems = L.lathe([[seat, r, 'body'], [h1, r, 'end'], [h1, 0]], frame, project, paper, { ...opts, open: [0] });
    const pt = (h, rr, a) => project(V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, rr * Math.cos(a))), V3.mul(V, rr * Math.sin(a))));
    const k = Math.hypot(...[0, 1].map(i => pt(h1, r, 0)[i] - pt(h1, 0, 0)[i])) / r;
    const sp = [], tMax = 2 * 2 * Math.PI, r0 = r * .18, r1 = r * .72;
    for (let t = 0; t <= tMax;) { const rr = r1 - (r1 - r0) * t / tMax; sp.push(pt(h1 + .01, rr, 1.2 + t)); t += Math.min(.05, .15 / (k * Math.max(rr, .5))); }
    const spiral = `<path d="M${fmt(sp).split(' ').join('L')}" stroke="#B4B4B4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    const seam = Array.from({ length: 720 }, (_, i) => pt(seat, r, 2 * Math.PI * i / 720));
    return { inner, outer: L.compose(outerItems) + spiral, seam, tip: pt(h1, 0, 0) };
  }
  // where the roll's top end is on screen (the slip comes out from there)
  function rollTip(pose, project) {
    const { C, A, U, V } = pose, at = (h, u, v) => V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, u)), V3.mul(V, v));
    return project(at(SEAT + SLIP_ROLL.out, 0, -3));
  }

  // ---- the slip held up in front of you, flat to the eye, a little turned: Vigil's printed stock (its rules and labels
  // in the company's grey), typed on: an issue slip in the company's dark ribbon, to the operator by their login name;
  // Glenn's notes in his red. kind: 'beans' | 'note'; note: its lines; to: the operator; who: 'chief' unless it's aw's.
  // place: { cx, cy, k } (centre on the stage, and scale: 1 is held up, smaller on its way out of the canister)
  const SLIP = { w: 560, h: 300, rot: -3 };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function slip(kind, { note = [], to = '', aw = false } = {}, place = { cx: 720, cy: 470, k: 1 }) {
    const { w, h } = SLIP, a = SLIP.rot * Math.PI / 180, c = Math.cos(a) * place.k, si = Math.sin(a) * place.k;
    const P2 = (x, y) => [place.cx + (x - w / 2) * c - (y - h / 2) * si, place.cy + (x - w / 2) * si + (y - h / 2) * c];
    const m = [c, si, -si, c, ...P2(0, 0)].map(v => v.toFixed(4)).join(' ');
    const MONO = 'font-family="ui-monospace, Consolas, monospace"';
    const GREY = '#8E8E8C', RULE = '#D2D2D0', TYPE = '#4A4A48', RED = '#D9706D';
    const text = (x, y, t, attrs) => `<text x="${x}" y="${y}" ${MONO} ${attrs}>${esc(t)}</text>`;
    const rule = (y, x0 = 28, x1 = w - 28) => `<path d="M${x0},${y}L${x1},${y}" stroke="${RULE}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    let inner = text(28, 42, 'VIGIL SYSTEMS', `font-weight="700" font-size="17" letter-spacing="3" fill="${GREY}"`);
    if (kind === 'beans') {
      inner += text(w - 28, 42, 'SITE 4', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'ISSUE SLIP · STORES', `font-size="12" letter-spacing="1.5" fill="${GREY}"`);
      inner += text(w - 28, 66, 'No. 0412', `font-size="12" letter-spacing="1" fill="${GREY}" text-anchor="end"`);
      inner += rule(84);
      inner += text(28, 150, 'ISSUED: 1 BAG · NIGHT SHIFT BLEND', `font-size="22" letter-spacing=".5" fill="${TYPE}"`);
      inner += rule(210);
      inner += text(28, 246, 'TO', `font-size="11" letter-spacing="1.5" fill="${GREY}"`) + text(70, 246, to, `font-size="14" fill="${TYPE}"`);
    } else {
      inner += text(w - 28, 42, 'INTEROFFICE', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'FROM: SUPERVISOR, NIGHTS', `font-size="12" letter-spacing="1.2" fill="${GREY}"`);
      if (aw) inner += text(w - 28, 66, 'TO: aw', `font-size="12" letter-spacing="1.2" fill="${GREY}" text-anchor="end"`);
      inner += rule(84);
      note.forEach((t, i) => { inner += text(28, 132 + i * 40, t, `font-size="22" fill="${RED}"`); });
      inner += text(w - 28, h - 26, '— G.', `font-size="18" fill="${RED}" text-anchor="end"`);
    }
    return `<polygon points="${fmt([[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => P2(x, y)))}" fill="#FAFAF9" ${INK}/><g transform="matrix(${m})">${inner}</g>`;
  }

  window.delivery = { DLV, NUDGE, OPEN, CAN, drawer, drawerHit, drawerPose, far, heldPose, held, rollTip, slip, MM };
})();
