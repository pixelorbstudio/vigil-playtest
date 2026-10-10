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

  // ---- the internal post (Arnold, 2026-10-03, round 3): the drawer is the post's receiving station, built into the desk,
  // and the room shows it. A carrier tube up through the floor in the knee space's back left corner, into the back of the
  // left pedestal out of sight behind the rail; a small metal label under the pull; an arrival flag on the front.
  // ---- the pipe: 76 mm across (the canister is 60), a floor flange and a clamp to the pedestal's side 30 cm up; a surface
  // of revolution in the room's camera (as the canister is), in the pedestal's greys a step darker (it is in the dark),
  // clipped to the knee space's opening (the rail and the pedestals' fronts are in front of it). It only exists below the
  // rail, so it never covers a rack LED. (The flange 10 mm high and 62 across: at the stills' 6 mm and 55 its lines stood
  // 4 px apart at this distance, the rule is 6. The clamp is a band flush with the pipe, edged by a ring each side: standing
  // proud, its top face, seen from above, put its two rings 3 px apart.)
  const PIPE = { x: 262, d: -.285, r: 38, flange: 62, flangeH: 10, clampAt: 300, clampH: 30 };
  const PIPE_MATS = { pipe: ['#E2E2E0', '#D6D6D4'], flange: ['#DEDEDC', '#D2D2D0'], clamp: ['#E6E6E4', '#DADAD8'] };
  let PIPE_SVG = null;
  function pipe() {
    if (PIPE_SVG) return PIPE_SVG;
    const dd = window.deskDrawer, P = PIPE, cam = p => dd.toCamF(p);
    const C = cam([P.x, 2030, P.d]), top = cam([P.x, 1420, P.d]);
    const ax = [top[0] - C[0], top[1] - C[1], top[2] - C[2]], H = Math.hypot(...ax) / MM, A = V3.unit(ax), U = [1, 0, 0], V = V3.cross(A, U);
    const frame = { C, A: V3.mul(A, MM), U: V3.mul(U, MM), V: V3.mul(V, MM) };
    const prof = [[0, 0, 'flange'], [0, P.flange, 'flange'], [P.flangeH, P.flange, 'pipe'], [P.flangeH, P.r, 'pipe'], [P.clampAt, P.r, 'clamp'],
      [P.clampAt + P.clampH, P.r, 'pipe'], [H, P.r, 'pipe'], [H, 0]];
    const items = window.lathe.lathe(prof, frame, dd.roomF, PIPE_MATS, { sectors: 1440, split: false, seal: true, matEdges: ['clamp'] });
    // the knee space's opening, its edges sampled on the desk's bend (every px across, as the drawers' runs are)
    const F = dd.F, run = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); return Array.from({ length: n }, (_, k) => F([0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k / n))); };
    const q = [[220, 1490, 0], [1220, 1490, 0], [1220, 2030, 0], [220, 2030, 0]], knee = q.flatMap((p, i) => run(p, q[(i + 1) % 4]));
    return (PIPE_SVG = `<clipPath id="post-knee"><polygon points="${fmt(knee)}"/></clipPath><g clip-path="url(#post-knee)">${window.lathe.compose(items)}</g>`);
  }
  // ---- the label: a small metal plate under the pull, INTERNAL POST / STORES L2 engraved in the company's lettering (the
  // monospace your folder's tab is typed in), grey, two rivets. On the front at its depth.
  const LABEL = { cx: (DLV.x0 + DLV.x1) / 2 + PULL_DX, y0: DLV.y0 + 64, w: 78, h: 26 };   // (at y0 + 60 and 84 wide, its corner came 3.4 to 4.5 px from the pull's post)
  const fine = (a, b, step = .25) => { const F = window.deskDrawer.F, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n }, (_, k) => F([0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k / n))); };
  const fineQuad = q => q.flatMap((p, i) => fine(p, q[(i + 1) % q.length]));
  function label(out) {
    const F = window.deskDrawer.F, { cx, y0, w, h } = LABEL, x0 = cx - w / 2, x1 = cx + w / 2, y1 = y0 + h;
    const plate = fineQuad([[x0, y0, out], [x1, y0, out], [x1, y1, out], [x0, y1, out]]);
    // each line placed by an affine fit at its own baseline on the bent front
    const text = (t, x, y, size, ls) => { const o = F([x, y, out]), a = F([x + 1, y, out]), b = F([x, y + 1, out]); return `<text transform="matrix(${[a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]].map(v => v.toFixed(4)).join(' ')})" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="${size}" letter-spacing="${ls}" fill="#8E8E8C">${t}</text>`; };
    // the rivets: circles on the front, sampled every quarter pixel through the bend
    const rivet = (x, y) => { const r = 1.6, m = Math.ceil(2 * Math.PI * r / .25); return `<polygon points="${fmt(Array.from({ length: m }, (_, k) => F([x + r * Math.cos(2 * Math.PI * k / m), y + r * Math.sin(2 * Math.PI * k / m), out])))}" fill="#E6E6E4" ${INK}/>`; };
    return `<polygon points="${fmt(plate)}" fill="#E8E8E6" ${INK}/>` + text('INTERNAL POST', cx, y0 + 11, 6.6, .3) + text('STORES L2', cx, y0 + 20.5, 6.2, .9) + rivet(x0 + 8, y0 + h / 2) + rivet(x1 - 8, y0 + h / 2);   // (inset 8: at 6 a rivet's edge stood 4.4 px from the plate's)
  }
  // ---- the arrival flag: a steel arm on a rivet near the front's top right corner, a small plate at its end, in the
  // drawer's greys (red is Glenn's). up: 0 down (lying along the front, pointing left) .. 1 up (standing above the drawer's
  // top edge); it swings up with the thunk and drops when the drawer is pulled open. It rides on the front, 3 mm proud.
  const FLAG = { px: DLV.x1 - 18, py: DLV.y0 + 16, arm: 38, w: 6, plate: [17, 14] };
  function flag(out, up) {
    const F = window.deskDrawer.F, a = Math.PI + Math.PI / 2 * up, z = out + .003;   // 0 points right; pi left, 3pi/2 up
    const rot = ([u, v]) => [FLAG.px + u * Math.cos(a) - v * Math.sin(a), FLAG.py + u * Math.sin(a) + v * Math.cos(a), z];
    const { arm, w, plate } = FLAG;
    // one outline, the arm stepping out into its plate (drawn as two, the arm's edges ran 3 px inside the plate's), the
    // plate a tone darker inside it; the pivot a boss wider than the arm, so the arm's edges meet it square, not tangent
    const x0 = arm - 2, x1 = arm + plate[0] - 2, ph = plate[1] / 2;
    const outline = fineQuad([[0, -w / 2], [x0, -w / 2], [x0, -ph], [x1, -ph], [x1, ph], [x0, ph], [x0, w / 2], [0, w / 2]].map(rot));
    const plateQ = fineQuad([[x0, -ph], [x1, -ph], [x1, ph], [x0, ph]].map(rot));
    const r = 5, m = Math.ceil(2 * Math.PI * r / .25), piv = Array.from({ length: m }, (_, k) => F([FLAG.px + r * Math.cos(2 * Math.PI * k / m), FLAG.py + r * Math.sin(2 * Math.PI * k / m), z]));
    return `<polygon points="${fmt(outline)}" fill="#DEDEDC"/><polygon points="${fmt(plateQ)}" fill="#D2D2D0"/><polygon points="${fmt(outline)}" fill="none" ${INK}/><polygon points="${fmt(piv)}" fill="#E6E6E4" ${INK}/>`;
  }
  function drawer(out, withCan, up = 0) {
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
    return s + label(front) + flag(front, up);
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
  // its ends rounded, the base 3 mm and the lid 5 mm, as tangent arcs sampled finer than the crease angle (so they draw
  // no ring of their own, only their silhouette): the same outline small and held, so nothing jumps where the flight
  // swaps one drawing for the other (a square end small and a rounded one held put 4 to 6 px between them)
  const BASE_ROUND = r => Array.from({ length: 25 }, (_, k) => { const t = Math.PI / 2 * k / 24; return [3 - 3 * Math.cos(t), r - 3 + 3 * Math.sin(t), 'can']; });
  // seen small (in the drawer, about 0.7 px a mm): its bands flush, edged by a ring each, where the held one has them; the
  // lid shut (its seam, 8 mm from the band's ring, would stand under 6 px from it, so it is left out small)
  function farProfile(aw = false) {
    const { L, r } = CAN, seat = L - 18;
    const lidEnd = Array.from({ length: 25 }, (_, k) => { const t = Math.PI / 2 * k / 24; return [L - 5 + 5 * Math.sin(t), r - 5 + 5 * Math.cos(t), 'round']; });
    return [[0, 0, 'can'], ...BASE_ROUND(r), [18, r, 'band'], [32, r, 'can'], ...tagRun(aw), [seat - 22, r, 'band'], [seat - 8, r, 'can'], ...lidEnd, [L, 0]];
  }
  /* ---- aw's canister (night 3, in the blackout): a paper tag wrapped round it between the bands, flush (as the felt bands
     are: drawn proud, its edges stood a pixel off the canister's outline), edged by a ring each side, "aw" written on it in
     Caveat, the hand the polaroids' strips are in. 40 mm of the 78 between the bands: in the receiver (0.43 px a mm) each
     of its rings stands 6 px or more from a band's and from the window's sill. The writing goes round the canister, so it
     reads standing in the receiver (sideways held across in front of you, as a label does), at the angle that faces you
     there and held (post.js turns the canister in the receiver to match). */
  const TAG = { h0: 56, h1: 96, font: 32, tone: ['#FAFAF9', '#EEEEEC'] };
  // the tag's points in a profile, between the bands (none if it isn't aw's)
  function tagRun(aw) { return aw ? [[TAG.h0, CAN.r, 'tag'], [TAG.h1, CAN.r, 'can']] : []; }
  // the angle round the canister (U cos a + V sin a) that faces you held: the tag's writing is centred there
  function tagAngle() {
    const P = heldPose(0), e = V3.unit(V3.mul(P.C, -1));
    return Math.atan2(V3.dot(e, V3.unit(P.V)), V3.dot(e, V3.unit(P.U)));
  }
  // Caveat's "a" and "w" (measured at 100 px: advances 43.7 and 51.7, kerned 1 closer; ink 7..50 and 12..59; x-height 38)
  const AW_GLYPHS = [{ g: 'a', x: 0, ink: [7, 50] }, { g: 'w', x: 42.7, ink: [12, 59] }], AW_INK = [7, 101.7], AW_XH = 38;
  // the writing, glyph by glyph: each glyph placed by the surface's own frame at its middle (a glyph is 15 mm across, 15
  // degrees either side: under 0.1 mm off the curve at its ends), clipped to the tag's side facing you
  function tagWriting(pose, project, clipPts) {
    const { r } = CAN, { C, A, U, V } = pose, k = TAG.font / 100, hc = (TAG.h0 + TAG.h1) / 2, base = hc - AW_XH * k / 2;
    const at = (a, h) => V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, r * Math.cos(a))), V3.mul(V, r * Math.sin(a)));
    const a0 = tagAngle(), mid = (AW_INK[0] + AW_INK[1]) / 2;
    // which way round reads left to right from outside (x across, y down the canister toward its base, the eye outside)
    const n0 = V3.add(V3.mul(U, Math.cos(a0)), V3.mul(V, Math.sin(a0))), t0 = V3.add(V3.mul(U, -Math.sin(a0)), V3.mul(V, Math.cos(a0)));
    const dir = V3.dot(V3.cross(t0, V3.mul(A, -1)), n0) < 0 ? 1 : -1;
    let svg = '';
    for (const G of AW_GLYPHS) {
      const cx = (G.x + (G.ink[0] + G.ink[1]) / 2 - mid) * k, a = a0 + dir * cx / r;
      const P = at(a, base), facing = V3.dot(V3.unit(V3.add(V3.mul(U, Math.cos(a)), V3.mul(V, Math.sin(a)))), V3.unit(V3.mul(P, -1)));
      if (facing < .2) continue;                         // (turned too far from you to read: hidden behind the clip anyway)
      const o = project(P), d = .01, ex = project(at(a + dir * d / r, base)), ey = project(at(a, base - d));
      const m = [(ex[0] - o[0]) / d, (ex[1] - o[1]) / d, (ey[0] - o[0]) / d, (ey[1] - o[1]) / d, o[0], o[1]].map(v => v.toFixed(4)).join(' ');
      svg += `<text transform="matrix(${m})" x="${((G.x - mid) * k - cx).toFixed(3)}" y="0" font-family="Caveat, cursive" font-size="${TAG.font}" fill="#6E6E6C">${G.g}</text>`;
    }
    if (!svg) return '';
    const id = 'awtag' + (++CLIP_IDS);
    return `<clipPath id="${id}"><polygon points="${fmt(clipPts)}"/></clipPath><g clip-path="url(#${id})">${svg}</g>`;
  }
  // the tag's side facing you, as a polygon (its two rings between the canister's silhouettes there)
  function tagFace(pose, project) {
    const { r } = CAN, { C, A, U, V } = pose, at = (a, h) => V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, r * Math.cos(a))), V3.mul(V, r * Math.sin(a)));
    const side = h => { const out = []; for (let i = 0; i < 1440; i++) { const a = 2 * Math.PI * i / 1440, P = at(a, h), n = V3.add(V3.mul(U, Math.cos(a)), V3.mul(V, Math.sin(a))); if (V3.dot(n, V3.mul(P, -1)) > 0) out.push({ a, p: project(P) }); } return out; };
    // the facing run as one arc (it may wrap past 0)
    const run = h => { const s = side(h); if (!s.length) return []; let cut = s.findIndex((q, i) => i && q.a - s[i - 1].a > .01); return (cut > 0 ? [...s.slice(cut), ...s.slice(0, cut)] : s).map(q => q.p); };
    return [...run(TAG.h0), ...run(TAG.h1).reverse()];
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
  // (the lid's rounded edge lit as the side it rounds off from, as the held lid's is: lit by its own normal, its tone's
  // edge stepped across the narrow bands. Only the bands are edged by a ring: the round's own change of tone isn't a line.)
  // Fills first, then every line over them, as the held lid is drawn (its rounded edge is many narrow bands, and band by
  // band each fill covered half the outline of the one before, which put a step in the end's outline); the canister is
  // convex, so nothing seen lies in front of anything else seen.
  function far(pose, project, { aw = false } = {}) {
    const Au = V3.unit(pose.A), round = n => { const d = V3.dot(n, Au), m = V3.unit(V3.add(n, V3.mul(Au, -d))); return V3.dot(m, window.solid.L) > .15 ? LM.can[0] : LM.can[1]; };
    const all = window.lathe.compose(window.lathe.lathe(farProfile(aw), pose, project, { ...LM, round, tag: TAG.tone }, { sectors: 720, matEdges: ['band', 'tag'], split: false, seal: true }));
    // (aw's writing over the fills, under the lines)
    return all.replace(/<path [^>]*\/>/g, '') + (aw ? tagWriting(pose, project, tagFace(pose, project)) : '') + [...all.matchAll(/<path [^>]*\/>/g)].map(m => m[0]).join('');
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
  function held(what, pose, project, lid = 0, { aw = false } = {}) {
    const L = window.lathe, { r } = CAN, { C, A, U, V } = pose, Uu = V3.unit(U);
    const at = (h, u, v) => V3.add(V3.add(V3.add(C, V3.mul(A, h)), V3.mul(U, u)), V3.mul(V, v));
    const seat = SEAT;
    // the felt bands flush, edged by a ring each, as in the drawer (Arnold, 2026-10-03: they stood 4 mm proud here and
    // flush there, so its outline jumped 11 px where the flight swaps one drawing for the other)
    const body = [[0, 0, 'can'], ...BASE_ROUND(r), [18, r, 'band'], [32, r, 'can'], ...tagRun(aw),
      [seat - 22, r, 'band'], [seat - 8, r, 'can'], [seat, r, 'rim'], [seat, r - WALL, 'inside'], [10, r - WALL, 'inside'], [10, 0]];
    const mats = { ...LM, rim: LM.can, tag: TAG.tone };
    const items = L.lathe(body, { C, A, U, V }, project, mats, { sectors: 720, noGenerators: ['inside'], split: false, seal: true, matEdges: true });
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
    const bodySvg = sort(inside) + inTube + sort(walls) + (aw ? tagWriting(pose, project, tagFace(pose, project)) : '') + sort(rim) + outOfIt;
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
  // The slips carry story, never explain (Arnold, 2026-10-03, round 3), one step stranger each time: an issue slip reused
  // (struck: "TO: aw" struck through with typed X's, "aw" still readable under them, your name typed after it); one with a
  // carbon of an old request showing faintly through it (carbon: M.'s, typed a few pixels off the slip's own lines, in a
  // grey between the print and the rules); a misrouted memo ('memo') and a timesheet ('timesheet'), papers of their own
  // that come with a slip and are held up behind it, the timesheet clipped to it.
  const CARBON = ['REQUEST: 1 BAG · REASON: can\'t stay awake', 'TO: m · 2019-04-01'];
  function slip(kind, { note = [], to = '', aw = false, no = 412, struck = false, carbon = false, date = '' } = {}, place = { cx: 720, cy: 470, k: 1 }) {
    const { w, h } = SLIP, a = (place.rot ?? SLIP.rot) * Math.PI / 180, c = Math.cos(a) * place.k, si = Math.sin(a) * place.k;
    const P2 = (x, y) => [place.cx + (x - w / 2) * c - (y - h / 2) * si, place.cy + (x - w / 2) * si + (y - h / 2) * c];
    const m = [c, si, -si, c, ...P2(0, 0)].map(v => v.toFixed(4)).join(' ');
    const MONO = 'font-family="ui-monospace, Consolas, monospace"';
    const GREY = '#8E8E8C', RULE = '#D2D2D0', TYPE = '#4A4A48', RED = '#D9706D', FAINT = '#C4C4C2';
    const text = (x, y, t, attrs) => `<text x="${x}" y="${y}" ${MONO} ${attrs}>${esc(t)}</text>`;
    const rule = (y, x0 = 28, x1 = w - 28) => `<path d="M${x0},${y}L${x1},${y}" stroke="${RULE}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    let inner = text(28, 42, 'VIGIL SYSTEMS', `font-weight="700" font-size="17" letter-spacing="3" fill="${GREY}"`);
    if (kind === 'beans') {
      // the carbon first, under the slip's own typing: two lines a few pixels off the slip's, where its own lines leave room
      if (carbon) inner += text(31, 110, CARBON[0], `font-size="13" letter-spacing=".3" fill="${FAINT}"`) + text(31, 186, CARBON[1], `font-size="13" letter-spacing=".3" fill="${FAINT}"`);
      inner += text(w - 28, 42, 'SITE 4', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'ISSUE SLIP · STORES', `font-size="12" letter-spacing="1.5" fill="${GREY}"`);
      inner += text(w - 28, 66, 'No. ' + String(no).padStart(4, '0'), `font-size="12" letter-spacing="1" fill="${GREY}" text-anchor="end"`);
      inner += rule(84);
      // (beans for a pot, not a bag: no bag ever comes; the story audit, 2026-10-06. Draft words)
      inner += text(28, 150, 'ISSUED: BEANS · 1 POT · NIGHT BLEND', `font-size="22" letter-spacing=".5" fill="${TYPE}"`);
      inner += rule(210);
      inner += text(28, 246, 'TO', `font-size="11" letter-spacing="1.5" fill="${GREY}"`);
      // struck: the old name typed over with X's, the new one after it
      inner += struck ? text(70, 246, 'aw', `font-size="14" fill="${TYPE}"`) + text(71, 249, 'XX', `font-size="14" fill="${GREY}"`) + text(104, 246, to, `font-size="14" fill="${TYPE}"`)   // (the X's a little lower and a shade lighter, a second pass of a tired ribbon: aw stays readable under them)
        : text(70, 246, to, `font-size="14" fill="${TYPE}"`);
    } else if (kind === 'award') {
      // 04:44's canister (night 1; nobody sent it): the company's commendation, your name and tomorrow's date (draft words
      // but its title, Arnold's: OPERATOR OF THE NIGHT)
      inner += text(w - 28, 42, 'SITE 4', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'PEOPLE · COMMENDATION', `font-size="12" letter-spacing="1.5" fill="${GREY}"`);
      inner += rule(84);
      inner += text(w / 2, 136, 'OPERATOR OF THE NIGHT', `font-size="27" letter-spacing="2" fill="${TYPE}" text-anchor="middle"`);
      inner += text(w / 2, 182, to, `font-size="20" letter-spacing=".5" fill="${TYPE}" text-anchor="middle"`);
      inner += text(w / 2, 212, date, `font-size="14" letter-spacing="1" fill="${GREY}" text-anchor="middle"`);
      inner += rule(236);
      inner += text(w / 2, 268, 'Someone is always awake.', `font-size="12" letter-spacing=".5" fill="${GREY}" text-anchor="middle"`);
    } else if (kind === 'memo') {
      inner += text(w - 28, 42, 'MEMO', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'INTEROFFICE · SITE 4', `font-size="12" letter-spacing="1.5" fill="${GREY}"`);
      inner += rule(84);
      ['TO: STORES', 'RE: SITE 4 OPERATOR', 'PREPARE FILE'].forEach((t, i) => { inner += text(28, 136 + i * 40, t, `font-size="20" letter-spacing=".5" fill="${TYPE}"`); });
    } else if (kind === 'timesheet') {
      inner += text(w - 28, 42, 'SITE 4', `font-weight="600" font-size="13" letter-spacing="2" fill="${GREY}" text-anchor="end"`);
      inner += text(28, 66, 'TIMESHEET · NIGHTS', `font-size="12" letter-spacing="1.5" fill="${GREY}"`);
      inner += rule(84);
      inner += text(28, 142, 'HOURS THIS SHIFT: 6.5', `font-size="20" letter-spacing=".5" fill="${TYPE}"`);
      // (11,408 counts nights, not hours: the story audit, 2026-10-06)
      inner += text(28, 190, 'SHIFTS ON RECORD: 11,408', `font-size="20" letter-spacing=".5" fill="${TYPE}"`);
      inner += rule(230);
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
  // a paper clip over the slips' top edges, near the left (holding the timesheet to the slip in front of it): a wire
  // bent in three U's (a Gem clip), one line, its four legs 6 px apart, in the slip's own frame (top: how far above the
  // front slip's top edge the one behind's is)
  function clip(place, top) {
    const { w, h } = SLIP, a = (place.rot ?? SLIP.rot) * Math.PI / 180, c = Math.cos(a) * place.k, si = Math.sin(a) * place.k;
    const o = [place.cx - w / 2 * c + h / 2 * si, place.cy - w / 2 * si - h / 2 * c], m = [c, si, -si, c, ...o].map(v => v.toFixed(4)).join(' ');
    const x = 64, y0 = -top - 14, y1 = 40;             // from above the paper behind to below the front one's edge
    const d = `M${x + 6},${y1 - 20}V${y0 + 11}A3,3 0 0 1 ${x + 12},${y0 + 11}V${y1 - 6}A6,6 0 0 1 ${x},${y1 - 6}V${y0 + 9}A9,9 0 0 1 ${x + 18},${y0 + 9}V${y1 - 30}`;
    return `<g transform="matrix(${m})"><path d="${d}" fill="none" stroke="#B4B4B4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;
  }

  window.delivery = { DLV, NUDGE, OPEN, CAN, PIPE, LABEL, FLAG, TAG, tagAngle, drawer, drawerHit, drawerPose, far, heldPose, held, rollTip, slip, clip, pipe, label, flag, MM };
})();
