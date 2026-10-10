/* drawer.js — the desk below the frame, and the cartridge drawer in it.

   The drawing stops at the keyboard, but the desk and the keyboard's front already run past its bottom
   edge (to y≈1200 and 1218). Looking down shows that art and, below it, what this module builds: the rest
   of the desk top, its front edge, the apron under it, and a drawer centred under the keyboard.

   The drawing is wide-angle: its horizontals sag toward the bottom of the frame (the desk's back edge by
   44px across its width, the keyboard's bottom edge by 94px). Everything here keeps that: a "horizontal" at
   height y is the curve y - sag·((x - 720)/784)², with more sag the nearer and lower it is.

   The drawer follows the cartridge's depth rule. A point is (u, v, d): (u, v) is a position in the drawer's
   opening in the apron (u 0..1 left to right, v 0..1 top to bottom, on curved edges) and d is how far it has
   come toward the eye, as a fraction of its distance: it projects to EYE + (Q(u,v) - EYE) / (1 - d). The
   drawer sits far below the eye, so pulled out it is seen from above, which is what makes the cartridges
   readable. Faces are culled by projected winding, split at the apron (d = 0) with the inner parts clipped
   to the opening, and painted in layers. Flat fills from the drawing's grey range, 1px #B4B4B4 strokes. */
(function () {
  const INK = 'stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"';
  const EYE = [720, 813];
  const sagAt = (x, sag) => sag * Math.pow((x - 720) / 784, 2);
  const curve = (yc, sag) => x => yc - sagAt(x, sag);
  const pts = ps => ps.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const area = ps => { let a = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i], q = ps[(i + 1) % ps.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

  // The desk, in scene coordinates below the drawing's own desk art.
  const DESK = {
    // the desk's front edge runs parallel to the keyboard's bottom edge above it (measured on Arnold's keyboard:
    // y = 1219.2 - 90.4((x - 720)/784)^2); it had 110 and bent visibly more
    edge: curve(1300, 90),         // front edge of the desk top
    lip: curve(1330, 92),          // bottom of the desk top's front face
    X0: -300, X1: 1740,            // the width of Arnold's 1920 frame (stage x -240..1680), and a little more
    bottom: 1900,                  // the apron runs past anything the look-down shows
  };
  // The drawer's opening in the apron, wide enough for four cartridges side by side.
  const OPEN = { X0: 430, X1: 1010, top: curve(1352, 114), bot: curve(1462, 120) };
  const OW = OPEN.X1 - OPEN.X0, OH = 110;
  const Q = (u, v) => { const x = OPEN.X0 + (OPEN.X1 - OPEN.X0) * u, t = OPEN.top(x); return [x, t + (OPEN.bot(x) - t) * v]; };
  const P = ([u, v, d]) => { const q = Q(u, v), s = 1 / (1 - d); return [EYE[0] + (q[0] - EYE[0]) * s, EYE[1] + (q[1] - EYE[1]) * s]; };

  // Split a 3D polygon where coordinate `axis` crosses `at`: side +1 keeps the part at or above it, -1 the part at
  // or below. Points made by the cut are marked, so the cut itself is never drawn as an edge.
  function splitAt(poly, axis, at, side) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ina = (a[axis] - at) * side >= 0, inb = (b[axis] - at) * side >= 0;
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (a[axis] - at) / (a[axis] - b[axis]), p = [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t);
        p[axis] = at; p.cut = true; out.push(p);
      }
    }
    return out;
  }
  // at the apron: side +1 keeps d >= 0 (out in the room), -1 keeps d <= 0 (inside the desk)
  const split = (poly, side) => splitAt(poly, 2, 0, side);
  // the outline of a split polygon: its real edges only, not the one along the cut
  function outline(poly) {
    let d = '';
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a.cut && b.cut) continue;
      const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / 0.06));
      for (let k = 0; k <= n; k++) { const t = k / n, q = P([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); d += (k ? 'L' : 'M') + q[0].toFixed(2) + ',' + q[1].toFixed(2); }
    }
    return d;
  }
  // Edges that run across u are curves on screen: sample them before projecting.
  function sampled(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / 0.06));
      for (let k = 0; k < n; k++) { const t = k / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    return out.map(P);
  }
  // a rounded rectangle in the drawer's opening, at depth d, its corners r pixels round (the drawer fronts' 3 px)
  function roundUV(u0, u1, v0, v1, r, d) {
    const ru = r / OW, rv = r / OH, arc = (uc, vc, a0) => Array.from({ length: 9 }, (_, k) => { const a = a0 + k * Math.PI / 16; return [uc + ru * Math.cos(a), vc + rv * Math.sin(a), d]; });
    return sampled([[u0 + ru, v0, d], [u1 - ru, v0, d], ...arc(u1 - ru, v0 + rv, -Math.PI / 2).slice(1, -1), [u1, v0 + rv, d], [u1, v1 - rv, d],
      ...arc(u1 - ru, v1 - rv, 0).slice(1, -1), [u1 - ru, v1, d], [u0 + ru, v1, d], ...arc(u0 + ru, v1 - rv, Math.PI / 2).slice(1, -1), [u0, v1 - rv, d], [u0, v0 + rv, d],
      ...arc(u0 + ru, v0 + rv, Math.PI).slice(1, -1)]);
  }
  // An axis-aligned box in (u, v, d); faces wound so that one toward the eye has positive projected area.
  function box(u0, u1, v0, v1, d0, d1) {
    return {
      front:  [[u0, v0, d1], [u1, v0, d1], [u1, v1, d1], [u0, v1, d1]],
      top:    [[u0, v0, d0], [u1, v0, d0], [u1, v0, d1], [u0, v0, d1]],
      right:  [[u1, v0, d0], [u1, v1, d0], [u1, v1, d1], [u1, v0, d1]],
      left:   [[u0, v0, d1], [u0, v1, d1], [u0, v1, d0], [u0, v0, d0]],
    };
  }

  // Layout. u and v are fractions of the opening, d fractions of distance; sizes that belong to the cartridge
  // are given in scene pixels at the apron (d = 0) and turned into fractions here.
  const PLATE = 0.012;             // front thickness
  const RIM = 0;                   // v of the walls' top edge: level with the front's top, so their edges meet it at its corners
  const WALL = 0.012;              // side wall thickness in u
  // lies flat, cap toward you, label up. Its size is the slot's: carried there, its cap is the slot's own
  // opening (85 px wide and 40.7 thick at the apron, 0.14 of distance long).
  const CART = { w: 85 / OW, t: 40.7 / OH, len: 0.14 };
  // The drawer holds a moulded case: a block filling it to INSERT.top, with a recess for each cartridge, four
  // across and two deep. A cartridge sits in its recess with its top standing proud of the case; an empty
  // recess keeps the cartridge's shape.
  const INSERT = { top: 0.22, depth: 36 / OH };     // deep enough that a cartridge stands only 4.7 px proud
  const CLEAR = { u: 2 / OW, d: 0.0025 };          // the recess's play around the cartridge: a snug fit
  // a finger notch at the near end of each recess, a half circle 20 px across the apron (a pixel across is
  // 1/1.5 camera units, a unit of d is 1000), so a cartridge can be got hold of
  // the part of a cartridge below the case's top is drawn under the case and runs a hair above it, so the
  // two halves of a face meet without a hairline of background between them
  const SEAM = 0.006;
  const NOTCH = { u: 20 / OW, d: 20 / 1500, n: 10 };
  const COLS = 4, ROWS = 2, SLOTS = COLS * ROWS;   // slot 0 is front left; the front row fills first
  const COL_PITCH = 123 / OW;
  const GAP = { front: 0.035, row: 0.028, back: 0.022 };
  const RECESS = { w: CART.w + 2 * CLEAR.u, len: CART.len + 2 * CLEAR.d };
  const DEPTH = PLATE + GAP.front + ROWS * RECESS.len + (ROWS - 1) * GAP.row + GAP.back;
  const TRAVEL = DEPTH - GAP.back - 0.03;          // out until the back row is nearly clear of the apron
  const RISE = INSERT.top + INSERT.depth + 0.10;   // taking one: lifted until its underside clears the front
  const HANDLE = { u0: 0.40, u1: 0.60, v0: 0.30, v1: 0.42, out: 0.012 };

  // The pedestal desk (decided 2026-09-30). The apron becomes a rail under the desk top; under it, in the middle,
  // the knee space, where your legs would be: kept dark, nothing drawn in it but its two sides and the lower edge of
  // a modesty panel at the back (the floor and the chair are the empty-seat ending's); a pedestal either side, the
  // right one with a box drawer level with the cartridge drawer, another under it, and the file drawer at the
  // bottom with a holder for a card (the lower drawer: the polaroids); the left one a plain door.
  //
  // The pedestals are drawn in the desk's own bend, not the cartridge drawer's: a horizontal at centre-line height
  // y sags as the desk's edge and lip do, 92 at the lip and a little more lower down. The drawer's opening bends
  // more (114), which over its own width is 3 px; carried out to the pedestals it ran the top drawer into the lip
  // (Arnold, 2026-09-30). Points are (x, y, d): scene x and centre-line y on the desk's front, and d toward the eye.
  let TANKER = false;   // the steel tanker desk's details (stills first)
  const bendAt = y => 92 + 0.06 * (y - 1330);
  const F = ([x, y, d = 0]) => { const q = [x, y - bendAt(y) * Math.pow((x - 720) / 784, 2)], k = 1 / (1 - d); return [EYE[0] + (q[0] - EYE[0]) * k, EYE[1] + (q[1] - EYE[1]) * k]; };
  // a polygon's edges sampled every 20 px across, so they bend
  function bent(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.abs(q[0] - p[0]) / 20));
      for (let k = 0; k < n; k++) { const t = k / n; out.push(F([0, 1, 2].map(j => (p[j] ?? 0) + ((q[j] ?? 0) - (p[j] ?? 0)) * t))); }
    }
    return out;
  }
  const rect = (x0, x1, y0, y1, d = 0) => bent([[x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d]]);
  const PED = {
    // the knee space: 1000 px, about 70% of the 4:3 view (Arnold: wider, three times). The pedestals keep a real width
    // (280, drawers twice as wide as tall) rather than thinning; a 4:3 window may cut their outer edges, as it cuts the
    // outer racks, but never their pulls or the card holder. Further out, the lens bends their drawers more.
    K0: 220, K1: 1220,
    RAIL: 1490,                     // the rail's bottom, the top of the knee space
    FLOOR: 2030,                    // the floor: about 63 cm of knee room under the rail, a real desk's (it had 46)
    DB: -0.32,                      // how deep the knee space goes: about 55 cm (the first try went a metre and read as a corridor)
    PANEL: 1840,                    // the modesty panel's lower edge, at the back; from this high up only its lower part shows
    drawers: [[1240, 1480, 1352, 1462], [1240, 1480, 1490, 1640], [1240, 1480, 1665, 1995]],   // box (level), box, file
    door: [-40, 200, 1490, 1995],
    // the tanker desk (Arnold, 2026-10-01: a 70s/80s steel office desk): the left pedestal mirrors the right in drawers
    left: [[-40, 200, 1352, 1462], [-40, 200, 1490, 1640], [-40, 200, 1665, 1995]],    // its top level with the knee space's, as the right pedestal's second drawer is
  };
  // a rounded rectangle on the front at depth d (steel drawer fronts have softly rounded corners: 3 px)
  const R_DRAWER = 3;
  function roundRect(x0, x1, y0, y1, r, d = 0) {
    const arc = (cx, cy, a0) => Array.from({ length: 9 }, (_, k) => { const a = a0 + k * Math.PI / 16; return [cx + r * Math.cos(a), cy + r * Math.sin(a), d]; });
    return bent([[x0 + r, y0, d], [x1 - r, y0, d], ...arc(x1 - r, y0 + r, -Math.PI / 2).slice(1, -1), [x1, y0 + r, d], [x1, y1 - r, d],
      ...arc(x1 - r, y1 - r, 0).slice(1, -1), [x1 - r, y1, d], [x0 + r, y1, d], ...arc(x0 + r, y1 - r, Math.PI / 2).slice(1, -1), [x0, y1 - r, d], [x0, y0 + r, d],
      ...arc(x0 + r, y0 + r, Math.PI).slice(1, -1)]);
  }
  // a tanker desk's pull: a channel pressed into the front, its top lip catching the light
  function channel(x0, x1, y0, y1, d = 0) {
    const r = (y1 - y0) / 2, lip = [];
    for (let x = x0 + r; x <= x1 - r + .1; x += Math.min(20, (x1 - x0 - 2 * r) / 2)) lip.push(F([x, y1 - 2.5, d]));
    return `<polygon points="${pts(roundRect(x0, x1, y0, y1, r, d))}" fill="#D2D2D0" ${INK}/>`
      + `<path d="M${pts(lip).replace(/ /g, 'L')}" fill="none" stroke="#E2E2E0" stroke-width="1.2" stroke-linecap="round"/>`;
  }
  // a pull standing proud of a front (as the cartridge drawer's), its faces toward the eye only
  // a pull you can get your fingers behind: a slim bar held off the front by a post at each end. Given the area the old
  // block pull took (x0..x1 by y0..y1), the bar runs its length, 8 px thick, centred; the posts are 5 px. Horizontal
  // unless it is taller than wide (the door's).
  const STANDOFF = .012, BAR = .005;
  function pull(x0, x1, y0, y1, z = 0) {
    const vert = y1 - y0 > x1 - x0, cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
    const [bx0, bx1, by0, by1] = vert ? [cx - 4, cx + 4, y0, y1] : [x0, x1, cy - 4, cy + 4];
    const posts = vert ? [[bx0 + 1, bx1 - 1, by0, by0 + 5], [bx0 + 1, bx1 - 1, by1 - 5, by1]] : [[bx0, bx0 + 5, by0 + 1, by1 - 1], [bx1 - 5, bx1, by0 + 1, by1 - 1]];
    let out = '';
    const draw = (bx, faces) => { for (const [k, fill] of faces) { const sp = bent(bx[k]); if (area(sp) > 0.05) out += `<polygon points="${pts(sp)}" fill="${fill}" ${INK}/>`; } };
    for (const [p0, p1, q0, q1] of posts) draw(boxF(p0, p1, q0, q1, z, z + STANDOFF), [['top', '#DEDEDC'], ['left', '#D6D6D4'], ['right', '#D6D6D4']]);
    draw(boxF(bx0, bx1, by0, by1, z + STANDOFF, z + STANDOFF + BAR), [['top', '#E9E9E7'], ['left', '#DEDEDC'], ['right', '#DEDEDC'], ['front', '#ECECEA']]);
    return out;
  }
  // tally marks, scratched into the desk top's front edge at the right end, where a right hand rests: groups of
  // five, four down and one across, a little uneven, as by hand (the pedestal's side was tried: cramped, and the
  // rail hid all but the first group)
  function tally(n) {
    let a = 7;
    const r = () => (a = (a * 16807) % 2147483647) / 2147483647 - 0.5;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const g = Math.floor(i / 5), k = i % 5, x0 = 1262 + g * 34;   // over the right pedestal
      if (k === 4) { const xa = x0 - 3, xb = x0 + 21; lines.push([[xa, DESK.edge(xa) + 20 + r()], [xb, DESK.edge(xb) + 10 + r()]]); continue; }
      const x = x0 + k * 6 + r() * 1.4;
      lines.push([[x + r(), DESK.edge(x) + 7 + r() * 2], [x + r() * 1.6, DESK.lip(x) - 7 + r() * 2]]);
    }
    return `<path d="${lines.map(([p, q]) => `M${p[0].toFixed(2)},${p[1].toFixed(2)}L${q[0].toFixed(2)},${q[1].toFixed(2)}`).join('')}" fill="none" stroke="#B4B4B4" stroke-width="1" stroke-linecap="round"/>`;
  }
  function pedestal(fileFront = true) {
    const { K0, K1, RAIL, FLOOR, DB, PANEL } = PED;
    // the dark under the desk, the panel at its back, and its two sides: drawn before the desk top, which hides their far ends
    let inside = `<polygon points="${pts(rect(K0, K1, RAIL, FLOOR))}" fill="#D2D2D0"/>`;
    inside += `<polygon points="${pts(rect(K0, K1, RAIL, PANEL, DB))}" fill="#E2E2E0" ${INK}/>`;
    inside += `<polygon points="${pts(bent([[K0, RAIL, 0], [K0, FLOOR, 0], [K0, FLOOR, DB], [K0, RAIL, DB]]))}" fill="#DEDEDC" ${INK}/>`;
    inside += `<polygon points="${pts(bent([[K1, RAIL, DB], [K1, FLOOR, DB], [K1, FLOOR, 0], [K1, RAIL, 0]]))}" fill="#E2E2E0" ${INK}/>`;
    // the floor in front of the desk, then the front: the rail and the pedestals down to the floor, the knee space cut out
    const foot = []; for (let x = DESK.X1; x >= DESK.X0 - 1; x -= 20) foot.push(F([x, FLOOR]));
    let s = `<polygon points="${pts([[DESK.X0, 2600], [DESK.X1, 2600], ...foot])}" fill="#E8E8E6"/>`;
    const lip = []; for (let x = DESK.X0; x <= DESK.X1 + 1; x += 20) lip.push([x, DESK.lip(x)]);
    s += `<path d="M${pts([...lip, ...foot]).replace(/ /g, 'L')}ZM${pts(rect(K0, K1, RAIL, FLOOR)).replace(/ /g, 'L')}Z" fill="#F0F0EE" fill-rule="evenodd" ${INK}/>`;
    // the drawers and the door, flush, each a seam and a pull; the file drawer has a holder for a card
    const [box, mid, file] = PED.drawers, cx = (box[0] + box[1]) / 2;
    if (TANKER) {
      // (no kick plate: the pedestals go down to the floor, as they did; a recessed base was tried and read wrong)
      for (const [x0, x1, y0, y1] of [box, mid, ...PED.left.slice(0, 2)]) {
        s += `<polygon points="${pts(roundRect(x0, x1, y0, y1, R_DRAWER))}" fill="#F4F4F2" ${INK}/>`;
        s += channel((x0 + x1) / 2 - 84, (x0 + x1) / 2 + 84, y0 + 11, y0 + 24);
      }
      const lf = PED.left[2], lx = (lf[0] + lf[1]) / 2;   // the left file drawer stays shut
      s += `<polygon points="${pts(roundRect(lf[0], lf[1], lf[2], lf[3], R_DRAWER))}" fill="#F4F4F2" ${INK}/>`
        + `<polygon points="${pts(rect(lx - 34, lx + 34, lf[2] + 32, lf[2] + 54))}" fill="#FAFAF9" ${INK}/>` + channel(lx - 84, lx + 84, lf[2] + 11, lf[2] + 24);
    } else {
      for (const [x0, x1, y0, y1] of [box, mid, PED.door]) s += `<polygon points="${pts(rect(x0, x1, y0, y1))}" fill="#F4F4F2" ${INK}/>`;
      s += pull(cx - 48, cx + 48, box[2] + 33, box[2] + 46);           // the cartridge drawer's, a little shorter
      s += pull(cx - 48, cx + 48, mid[2] + 33, mid[2] + 46);
    }
    // the file drawer: its front, or (when renderFile draws it) the dark of its opening
    if (fileFront) s += fileFace(0);                     // (otherwise renderFile draws it, and its opening when it is out)
    const dr = PED.door;
    if (!TANKER) s += pull(dr[1] - 30, dr[1] - 17, dr[2] + 70, dr[2] + 160);
    return { inside, front: s };
  }

  // the desk top, its front face, and the apron: static, drawn once. With pedestal, the pedestal desk; with tally,
  // that many marks scratched into the desk's edge
  function desk({ pedestal: ped = true, tally: marks = 0, fileFront = true, tanker = false } = {}) {
    TANKER = tanker;
    const xs = []; for (let x = DESK.X0; x <= DESK.X1 + 1; x += 20) xs.push(x);
    const line = f => xs.map(x => [x, f(x)]);
    const top = [[DESK.X0, 1150], [DESK.X1, 1150], ...line(DESK.edge).reverse()];
    const face = [...line(DESK.edge), ...line(DESK.lip).reverse()];
    const apron = [...line(DESK.lip), [DESK.X1, DESK.bottom], [DESK.X0, DESK.bottom]];
    const hole = TANKER ? roundUV(0, 1, 0, 1, R_DRAWER, 0) : sampled([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);
    const p = ped ? pedestal(fileFront) : null;
    return (p ? p.inside : '') + `<polygon points="${pts(top)}" fill="#FBFBFB"/>`
      + `<polygon points="${pts(face)}" fill="#E9E9E7" ${INK}/>`
      + (TANKER ? [6, 24].map(k => `<path d="M${pts(line(x => DESK.edge(x) + k * (DESK.lip(x) - DESK.edge(x)) / 30)).replace(/ /g, 'L')}" fill="none" stroke="#D6D6D4" stroke-width="1"/>`).join('') : '')
      + (marks ? tally(marks) : '')
      + (p ? p.front : `<polygon points="${pts(apron)}" fill="#F0F0EE" ${INK}/>`)
      + `<polygon points="${pts(hole)}" fill="#D2D2D0" ${INK}/>`;
  }

  // slot i's recess, for a drawer out by D: its centre across, and its near and far ends
  function recessAt(i, D) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const uc = 0.5 + (col - (COLS - 1) / 2) * COL_PITCH;
    const near = D - PLATE - GAP.front - row * (RECESS.len + GAP.row);
    return { uc, u0: uc - RECESS.w / 2, u1: uc + RECESS.w / 2, near, far: near - RECESS.len };
  }
  // the recess's outline at height v, far edge first, with the notch bulging out of its near edge toward you
  function recessRing(r, v) {
    const arc = [];
    for (let k = 0; k <= NOTCH.n; k++) { const a = Math.PI * k / NOTCH.n; arc.push([r.uc + NOTCH.u * Math.cos(a), v, r.near + NOTCH.d * Math.sin(a)]); }
    return [[r.u0, v, r.far], [r.u1, v, r.far], [r.u1, v, r.near], ...arc, [r.u0, v, r.near]];
  }

  /* state: { travel: 0..1, carts: [{ slot, label, lift }] }
     returns { inner, outer, front, hole, hits, frontHit }: inner is clipped to the hole; outer and front
     (the drawer front and its handle) are drawn over the desk. */
  function render(state) {
    const D = TRAVEL * state.travel, back = D - DEPTH;
    const inner = [], outer = [];
    // a face, split at the apron (d = 0) into what is inside the desk and what is out in the room; with
    // `below`, also split at the case's top, the part under it going to that layer
    const face = (f, fill, layer, key, below) => {
      if (below !== undefined) {
        const up = splitAt(f, 1, INSERT.top, -1), down = splitAt(f, 1, INSERT.top - SEAM, 1);
        if (up.length >= 3) face(up, fill, layer, key);
        if (down.length >= 3) face(down, fill, below, key);
        return;
      }
      for (const side of [-1, 1]) {
        const part = split(f, side);
        if (part.length < 3) continue;
        const sp = sampled(part);
        if (area(sp) <= 0.05) continue;
        const whole = !part.some(p => p.cut);
        const svg = `<polygon points="${pts(sp)}" fill="${fill}"${whole ? ' ' + INK : ''}/>`
          + (!whole ? `<path d="${outline(part)}" fill="none" ${INK} stroke-linecap="round"/>` : '');
        (side < 0 ? inner : outer).push([layer, key, svg]);
      }
    };
    // a flat face with holes in it (the case's top), as one even-odd path per side of the apron
    const holed = (rings, fill, layer, key) => {
      for (const side of [-1, 1]) {
        const parts = rings.map(r => split(r, side)).filter(p => p.length >= 3);
        if (!parts.length || split(rings[0], side).length < 3) continue;
        const d = parts.map(p => 'M' + sampled(p).map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join('L') + 'Z').join('');
        (side < 0 ? inner : outer).push([layer, key, `<path d="${d}" fill="${fill}" fill-rule="evenodd"/>`
          + `<path d="${parts.map(outline).join('')}" fill="none" ${INK} stroke-linecap="round"/>`]);
      }
    };
    const TRAY = 0, SUNK = 1, CASE = 2, CARTS = 3;

    // the drawer's box above the case, seen from inside
    face(box(0, 1, RIM, INSERT.top, back, back + 0.01).front, '#DEDEDC', TRAY, 0);  // back wall
    const L = box(0, WALL, RIM, INSERT.top, back, D - PLATE), R = box(1 - WALL, 1, RIM, INSERT.top, back, D - PLATE);
    face(L.right, '#DEDEDC', TRAY, 2); face(R.left, '#DEDEDC', TRAY, 2);
    face(L.top, '#E9E9E7', TRAY, 3); face(R.top, '#E9E9E7', TRAY, 3);

    // the recesses: floor and the walls that face you, drawn before the case's top, which hides the rest
    const vT = INSERT.top, vB = INSERT.top + INSERT.depth, rings = [];
    for (let i = 0; i < SLOTS; i++) {
      // drawn before any cartridge's lower part, which sits in it
      const r = recessAt(i, D), k = r.far - 0.01;
      face(recessRing(r, vB), '#D8D8D6', SUNK, k);
      if (state.scratch && state.scratch.slot === i) {
        const pad = 0.012, u0 = r.u0 + pad, u1 = r.u1 - pad, d0 = r.far + 0.012, d1 = r.near - 0.016;
        (r.near + r.far >= 0 ? outer : inner).push([SUNK, k + 2e-5, scratched(state.scratch.lines, ([x, y]) => P([u0 + (u1 - u0) * x / 100, vB - 0.001, d0 + (d1 - d0) * y / 100]))]);
      }
      face([[r.u0, vT, r.far], [r.u1, vT, r.far], [r.u1, vB, r.far], [r.u0, vB, r.far]], '#D2D2D0', SUNK, k + 1e-5);
      face([[r.u0, vT, r.far], [r.u0, vB, r.far], [r.u0, vB, r.near], [r.u0, vT, r.near]], '#D6D6D4', SUNK, k + 1e-5);
      face([[r.u1, vT, r.near], [r.u1, vB, r.near], [r.u1, vB, r.far], [r.u1, vT, r.far]], '#D6D6D4', SUNK, k + 1e-5);
      rings.push(recessRing(r, vT));
    }
    holed([[[WALL, vT, back + 0.01], [1 - WALL, vT, back + 0.01], [1 - WALL, vT, D - PLATE], [WALL, vT, D - PLATE]], ...rings], '#E4E4E2', CASE, 0);

    // the cartridges; what is below the case's top is drawn with the recesses, so the case hides it
    const hits = [];
    for (const c of state.carts) {
      const { uc, v0, v1, dNear, dFar } = cartBox(c, D), key = dNear;
      const b = box(uc - CART.w / 2, uc + CART.w / 2, v0, v1, dFar, dNear);
      face(b.left, '#DEDEDC', CARTS, key, SUNK); face(b.right, '#DEDEDC', CARTS, key, SUNK);
      face(b.front, '#ECECEA', CARTS, key, SUNK);                                   // the cap, as in the slot
      face(b.top, '#F4F4F2', CARTS, key);
      // the label, a sticker on the top with the cartridge's name written on it
      const u0 = uc - CART.w * 0.38, u1 = uc + CART.w * 0.38, lf = dFar + CART.len * 0.18, ln = dFar + CART.len * 0.86;
      const sticker = [[u0, v0, lf], [u1, v0, lf], [u1, v0, ln], [u0, v0, ln]];
      face(sticker, '#FAFAF9', CARTS, key + 1e-5);
      if (c.label) {
        const o = P([u0, v0, lf]), ax = P([u1, v0, lf]), ay = P([u0, v0, ln]), W = 100, H = 60;
        const m = [(ax[0] - o[0]) / W, (ax[1] - o[1]) / W, (ay[0] - o[0]) / H, (ay[1] - o[1]) / H, o[0], o[1]].map(n => n.toFixed(4));
        const note = state.notes && state.notes[c.label];
        (split(sticker, 1).length >= 3 ? outer : inner).push([CARTS, key + 2e-5, labelText(m, c.label, '', note ? 31 : 38) + (note ? stickerNote(m, note) : '')]);
      }
      // marks on the cap: label band and grips, as on the slot cartridge
      const cap = (a0, a1, b0, b1) => {
        const x0 = uc - CART.w / 2 + a0 * CART.w, x1 = uc - CART.w / 2 + a1 * CART.w, y0 = v0 + b0 * CART.t, y1 = v0 + b1 * CART.t;
        const f = [[x0, y0, dNear], [x1, y0, dNear], [x1, y1, dNear], [x0, y1, dNear]];
        // above the case with the cartridge; below it, seen through the notch, with the recess
        for (const [half, layer] of [[splitAt(f, 1, INSERT.top, -1), CARTS], [splitAt(f, 1, INSERT.top - SEAM, 1), SUNK]]) {
          for (const side of [-1, 1]) {
            const part = split(half, side); if (part.length < 3) continue;
            const sp = sampled(part); if (area(sp) <= 0.05) continue;
            (side < 0 ? inner : outer).push([layer, key + 1e-5, `<polygon points="${pts(sp)}" fill="#D2D2D0"/>`]);
          }
        }
      };
      cap(0.08, 0.92, 0.18, 0.34); cap(0.08, 0.50, 0.68, 0.76); cap(0.62, 0.92, 0.68, 0.76);
      if (!c.lift && D > 0.05) hits.push({ slot: c.slot, points: pts(hull([...b.top, ...b.front].map(P))) });
    }

    // the drawer front and its handle
    const plate = box(0, 1, 0, 1, D - PLATE, D);
    const front = [];
    const solid = (b, faces) => {
      for (const [k, fill] of faces) { const sp = sampled(b[k]); if (area(sp) > 0.05) front.push(`<polygon points="${pts(sp)}" fill="${fill}" ${INK}/>`); }
    };
    if (state.tanker) {
      // one block: its rounded face carried back through the plate's thickness (only while it is out), then the face
      if (D > .001) front.push(`<polygon points="${pts(hull([...roundUV(0, 1, 0, 1, R_DRAWER, D - PLATE), ...roundUV(0, 1, 0, 1, R_DRAWER, D)]))}" fill="#E9E9E7" ${INK}/>`);
      front.push(`<polygon points="${pts(roundUV(0, 1, 0, 1, R_DRAWER, D))}" fill="#F7F7F5" ${INK}/>`);
    } else solid(plate, D > .001 ? [['top', '#E9E9E7'], ['left', '#DEDEDC'], ['right', '#DEDEDC'], ['front', '#F7F7F5']] : [['front', '#F7F7F5']]);   // (shut, its top and sides are inside the desk)
    if (state.tanker) {
      // the same channel as the pedestals' drawers: a rounded slot, its lower lip catching the light
      const slot = (u0, u1, v0, v1) => {
        const hv = (v1 - v0) / 2, hu = hv * OH / OW, vc = (v0 + v1) / 2, cap = (uc, a0) => Array.from({ length: 7 }, (_, k) => { const a = a0 + k * Math.PI / 6; return [uc + hu * Math.cos(a), vc + hv * Math.sin(a), D]; });
        return sampled([[u0 + hu, v0, D], [u1 - hu, v0, D], ...cap(u1 - hu, -Math.PI / 2).slice(1, -1), [u1 - hu, v1, D], [u0 + hu, v1, D], ...cap(u0 + hu, Math.PI / 2).slice(1, -1)]);
      };
      front.push(`<polygon points="${pts(slot(.355, .645, .12, .24))}" fill="#D2D2D0" ${INK}/>`);
      const lip = []; for (let k = 0; k <= 12; k++) lip.push(P([.355 + .12 * OH / OW * .5 + (.29 - .12 * OH / OW) * k / 12, .24 - 2.5 / OH, D]));
      front.push(`<path d="M${pts(lip).replace(/ /g, 'L')}" fill="none" stroke="#E2E2E0" stroke-width="1.2" stroke-linecap="round"/>`);
    } else {
      // a bar on two posts, as the pedestals' pulls: 8 px thick, posts 5 px, held .012 off the front
      const vc = (HANDLE.v0 + HANDLE.v1) / 2, hv = 4 / OH, pu = 5 / OW;
      for (const [p0, p1] of [[HANDLE.u0, HANDLE.u0 + pu], [HANDLE.u1 - pu, HANDLE.u1]]) solid(box(p0, p1, vc - hv + 1 / OH, vc + hv - 1 / OH, D, D + .012), [['top', '#DEDEDC'], ['left', '#D6D6D4'], ['right', '#D6D6D4']]);
      solid(box(HANDLE.u0, HANDLE.u1, vc - hv, vc + hv, D + .012, D + .017), [['top', '#E9E9E7'], ['left', '#DEDEDC'], ['right', '#DEDEDC'], ['front', '#ECECEA']]);
    }

    const order = list => list.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]).join('');
    return {
      inner: order(inner), outer: order(outer), front: front.join(''),
      hole: pts(state.tanker ? roundUV(0, 1, 0, 1, R_DRAWER, 0) : sampled([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]])),
      hits, frontHit: pts(sampled(plate.front)),
    };
  }

  function hull(ps) {
    const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // where a cartridge in its recess is, in the drawer's own coordinates; lift raises it straight up out of it
  function cartBox(c, D) {
    const r = recessAt(c.slot, D), dNear = r.near - CLEAR.d, dFar = dNear - CART.len;
    const v1 = INSERT.top + INSERT.depth - (c.lift || 0) * RISE, v0 = v1 - CART.t;
    return { uc: r.uc, v0, v1, dNear, dFar };
  }

  /* The cartridge in the air. The depth rule is a pinhole camera at the eye (the mug's CAM: f 1500, principal
     point at the vanishing centre), so a drawer point (u, v, d) is the camera point
     ((Q - EYE)·z0/f, z0·(1 - d)): its x and y do not depend on d. A cartridge is a rigid box in that space,
     cap toward you, and it keeps that orientation from the drawer to the slot, where it goes in the same way. */
  const CAM = { f: 1500, z0: 1000 };
  const toCam = ([u, v, d]) => { const q = Q(u, v); return [(q[0] - EYE[0]) * CAM.z0 / CAM.f, (q[1] - EYE[1]) * CAM.z0 / CAM.f, CAM.z0 * (1 - d)]; };
  const proj = ([x, y, z]) => [EYE[0] + CAM.f * x / z, EYE[1] + CAM.f * y / z];
  // pose: the centre of its cap in camera space, and its size (w across, t thick, L long)
  function cartPose(c, travel) {
    const b = cartBox(c, TRAVEL * travel), vm = (b.v0 + b.v1) / 2;
    const [x, y, z] = toCam([b.uc, vm, b.dNear]);
    const w = toCam([b.uc + CART.w / 2, vm, 0])[0] - toCam([b.uc - CART.w / 2, vm, 0])[0];
    const t = toCam([b.uc, b.v1, 0])[1] - toCam([b.uc, b.v0, 0])[1];
    return { x, y, z, w, t, L: CART.len * CAM.z0 };
  }
  // the pose whose cap, drawn, is the slot's opening pushed toward you by k (the slot code's depth rule),
  // for a slot of the given width centred at (cx, cy) in scene coordinates
  function slotPose(size, cx, cy, slotW, k) {
    const zc = CAM.f * size.w / slotW;
    return { ...size, x: (cx - EYE[0]) * zc / CAM.f, y: (cy - EYE[1]) * zc / CAM.f, z: zc / (1 + k) };
  }
  // how far out of the slot (in the slot code's k) it is when its back end is level with the slot's face
  const clearOfSlot = (size, slotW) => { const zc = CAM.f * size.w / slotW; return size.L / (zc - size.L); };

  // the name on a cartridge's sticker: one lettering for every cartridge, sized so the longest name (COOLANT,
  // seven letters) sits inside the sticker with a margin; shorter names are the same size, centred. The sticker is
  // a 100 x 60 box mapped onto the top by m.
  // handwriting (hand.js) mapped onto a surface by map([x, y]) -> screen
  function inked(lines, map, stroke = '#B4B4B4', width = 1) {
    const d = lines.map(l => l.map((p, i) => (i ? 'L' : 'M') + map(p).map(n => n.toFixed(2)).join(',')).join('')).join('');
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // Handwriting is Caveat (Arnold, 2026-10-02: one hand for what is written in this room). A seeded generator, so the
  // same words wear the same way every time.
  const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // weathered: each letter its own strength and a slight tilt, as pencil is worn by fingers and years; flat colour, no
  // filter. Returns tspans for a <text>.
  function weathered(t, seed, lo = .45, hi = .9) {
    const r = seeded(seed);
    return [...t].map(ch => ch === ' ' ? ' ' : `<tspan fill-opacity="${(lo + (hi - lo) * r()).toFixed(2)}" rotate="${((r() - .5) * 6).toFixed(1)}">${ch.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</tspan>`).join('');
  }
  // scratched into plastic: the letters' outlines as a pale gouge (stressed plastic goes lighter) over a thin darker edge,
  // broken now and then where the point skipped; lying on the surface, so foreshortened with it. map: (x, y) in a 100 x
  // 100 space on the surface -> screen. Strokes stay a screen pixel (non-scaling) whatever the surface's tilt.
  function scratched(lines, map) {
    const o = map([0, 0]), ax = map([1, 0]), ay = map([0, 1]);
    const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(n => n.toFixed(4)).join(' ');
    const r = seeded(29), dash = Array.from({ length: 14 }, (_, i) => (i % 2 ? .3 + r() * .5 : 2 + r() * 7).toFixed(2)).join(' ');
    const text = (dx, dy, stroke, w) => lines.map((t, j) => `<text transform="matrix(${m})" x="${(4 + dx).toFixed(2)}" y="${(36 + j * 34 + dy).toFixed(2)}" font-family="Caveat, cursive" font-size="25" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke" stroke-linejoin="round">${t}</text>`).join('');
    return text(.4, .9, '#BEBEBC', .6) + text(0, 0, '#F4F4F2', .8);   // (25: the longest line, don't trust, is 90 of the 100 across, 4 clear each side)
  }
  // a note written on a sticker under its name, in the sticker's own 100 x 60 space (m: its matrix), two lines.
  // That space is stretched (100 across is narrower on screen than 60 down), so the hand is widened to match.
  // In Caveat, in pencil, weathered. That space is stretched (100 across is narrower on screen than 60 down), so the
  // writing is widened by the same amount to stay upright and round.
  function stickerNote(m, note) {
    const k = m.map(Number), aspect = Math.hypot(k[2], k[3]) / Math.hypot(k[0], k[1]);   // (the matrix is per unit already)
    const words = note.split(' '), half = Math.ceil(words.length / 2), rows = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    return rows.map((t, j) => `<text transform="matrix(${m.join(' ')}) scale(${aspect.toFixed(4)} 1)" x="${(50 / aspect).toFixed(2)}" y="${45 + j * 10}" text-anchor="middle" font-family="Caveat, cursive" font-size="12" fill="#8E8E8C">${weathered(t, 3 + j)}</text>`).join('');
  }
  const LABEL = { size: 19, spacing: 1, maxW: 88 };
  function labelText(m, label, extra = '', y = 38) {
    const fit = label.length * (LABEL.size * .6 + LABEL.spacing) > LABEL.maxW ? ` textLength="${LABEL.maxW}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text transform="matrix(${m.join(' ')})" x="50" y="${y}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="${LABEL.size}" font-weight="600" letter-spacing="${LABEL.spacing}" fill="#8E8E8C"${fit}${extra}>${label}</text>`;
  }
  function renderCartridge(p, label, note = null) {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y0 = p.y - p.t / 2, y1 = p.y + p.t / 2, zn = p.z, zf = p.z + p.L;
    const faces = [
      ['front', [[x0, y0, zn], [x1, y0, zn], [x1, y1, zn], [x0, y1, zn]], [0, 0, -1], '#ECECEA'],
      ['top', [[x0, y0, zf], [x1, y0, zf], [x1, y0, zn], [x0, y0, zn]], [0, -1, 0], '#F4F4F2'],
      ['bottom', [[x0, y1, zn], [x1, y1, zn], [x1, y1, zf], [x0, y1, zf]], [0, 1, 0], '#D2D2D0'],
      ['left', [[x0, y0, zf], [x0, y0, zn], [x0, y1, zn], [x0, y1, zf]], [-1, 0, 0], '#DEDEDC'],
      ['right', [[x1, y0, zn], [x1, y0, zf], [x1, y1, zf], [x1, y1, zn]], [1, 0, 0], '#DEDEDC'],
    ];
    const seen = {};
    let svg = '';
    for (const [name, f, n, fill] of faces) {
      const c = f.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4, a[2] + q[2] / 4], [0, 0, 0]);
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] >= 0) continue;          // facing away from the eye
      seen[name] = true;
      svg += `<polygon points="${pts(f.map(proj))}" fill="${fill}" ${INK}/>`;
    }
    const rect = (a, b) => `<polygon points="${pts([a, [b[0], a[1], a[2]], b, [a[0], b[1], b[2]]].map(proj))}" fill="#D2D2D0"/>`;
    if (seen.front) {                                                         // label band and grips, as in the slot
      const X = a => x0 + a * p.w, Y = b => y0 + b * p.t;
      svg += rect([X(.08), Y(.18), zn], [X(.92), Y(.34), zn]) + rect([X(.08), Y(.68), zn], [X(.50), Y(.76), zn]) + rect([X(.62), Y(.68), zn], [X(.92), Y(.76), zn]);
    }
    if (seen.top) {                                                           // the sticker with its name
      const u0 = p.x - p.w * .38, u1 = p.x + p.w * .38, lf = zf - p.L * .18, ln = zf - p.L * .86;
      const st = [[u0, y0, lf], [u1, y0, lf], [u1, y0, ln], [u0, y0, ln]].map(proj);
      svg += `<polygon points="${pts(st)}" fill="#FAFAF9" ${INK}/>`;
      if (label) {
        const [o, ax, , ay] = st, W = 100, H = 60;
        const m = [(ax[0] - o[0]) / W, (ax[1] - o[1]) / W, (ay[0] - o[0]) / H, (ay[1] - o[1]) / H, o[0], o[1]].map(n => n.toFixed(4));
        svg += labelText(m, label, '', note ? 31 : 38) + (note ? stickerNote(m, note) : '');
      }
    }
    return svg;
  }
  /* The cartridge as a solid (solid.js), for when it turns in the hand (the key under Pong): the same box renderCartridge
     draws, its sticker and lettering, its cap's band and grips, and on its underside, if it has them, the key and a strip
     of tape. pose: { c: its centre, A across it, B along it toward its far end (into the slot), in camera space }; its
     top (the sticker) is A x B. Each face's grey follows where it faces, by a rule that gives exactly renderCartridge's
     greys when it lies as it does in the slot (top #F4, cap #EC, sides #DE, underside #D2), so the handover from the
     slot or the flight doesn't flash. size: cartPose's { w, t, L }. key: { a, b, turn } (mm on the underside, from its
     middle; turn in radians in its plane). */
  const greyOf = n => {
    const up = -n[1], toward = -n[2], g = 0xDE + (up > 0 ? up * (0xF4 - 0xDE) : up * (0xDE - 0xD2)) + Math.max(0, toward) * (0xEC - 0xDE) * (1 - Math.abs(up));
    const v = Math.round(Math.max(0xD2, Math.min(0xF4, g))), h = v.toString(16).toUpperCase();
    return '#' + h + h + (v - 2).toString(16).toUpperCase();
  };
  function renderCartridgeSolid(pose, size, { label = null, note = null, key = null, width = 1 } = {}) {
    if (!window.solid) return '';
    const MMu = window.key3d ? window.key3d.MM : 1 / 1.765, mm = u => u / MMu;
    const W = mm(size.w), L = mm(size.L), T = mm(size.t), { c, A, B } = pose;
    const N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const at = (a, b, n) => [0, 1, 2].map(i => c[i] + (A[i] * a + B[i] * b + N[i] * n) * MMu);
    const outer = []; const edge = (p, q, k) => { for (let i = 0; i < k; i++) outer.push([p[0] + (q[0] - p[0]) * i / k, p[1] + (q[1] - p[1]) * i / k]); };
    edge([-W / 2, -L / 2], [W / 2, -L / 2], 24); edge([W / 2, -L / 2], [W / 2, L / 2], 48); edge([W / 2, L / 2], [-W / 2, L / 2], 24); edge([-W / 2, L / 2], [-W / 2, -L / 2], 48);
    let svg = window.solid.extrusion({ outer, t: T }, at, proj, { cap: greyOf, wall: greyOf, hole: greyOf, floor: greyOf, pocketWall: greyOf }, { width });
    // a face is seen when its outward normal points back at the eye (at the origin): the top's is N, the cap's -B, the
    // underside's -N
    const seen = (nrm, p) => nrm[0] * p[0] + nrm[1] * p[1] + nrm[2] * p[2] < 0;
    // the top: the sticker and the name, where renderCartridge puts them (from .18 to .86 of the length from the far end,
    // .76 of the width)
    if (seen(N, at(0, 0, T / 2))) {
      const st = [at(-W * .38, L / 2 - L * .18, T / 2), at(W * .38, L / 2 - L * .18, T / 2), at(W * .38, L / 2 - L * .86, T / 2), at(-W * .38, L / 2 - L * .86, T / 2)].map(proj);
      svg += `<polygon points="${pts(st)}" fill="#FAFAF9" ${INK}/>`;
      if (label) {
        const [o, ax, , ay] = st, m = [(ax[0] - o[0]) / 100, (ax[1] - o[1]) / 100, (ay[0] - o[0]) / 60, (ay[1] - o[1]) / 60, o[0], o[1]].map(n => n.toFixed(4));
        svg += labelText(m, label, '', note ? 31 : 38) + (note ? stickerNote(m, note) : '');
      }
    }
    // the cap (the end that faces you in the slot): its band and grips, recessed, at renderCartridge's fractions
    // (measured down from the top)
    if (seen(B.map(v => -v), at(0, -L / 2, 0))) {
      const R = (u0, u1, f0, f1) => `<polygon points="${pts([[u0, f0], [u1, f0], [u1, f1], [u0, f1]].map(([u, f]) => proj(at(-W / 2 + u * W, -L / 2, T / 2 - f * T))))}" fill="#D2D2D0"/>`;
      svg += R(.08, .92, .18, .34) + R(.08, .5, .68, .76) + R(.62, .92, .68, .76);
    }
    // the underside, when it faces you: the key lying on it, and the tape across its blade, draped to the plastic
    if (key && window.key3d) {
      if (seen(N.map(v => -v), at(0, 0, -T / 2))) {
        const kt = key.turn || 0, KA = [0, 1, 2].map(i => A[i] * Math.cos(kt) + B[i] * Math.sin(kt)), KB = [0, 1, 2].map(i => -(-A[i] * Math.sin(kt) + B[i] * Math.cos(kt)));
        const kc = at(key.a, key.b, -T / 2 - 1);                                   // its middle, its face on the plastic
        svg += window.key3d.render({ c: kc, A: KA, B: KB }, proj, { width });
        const KN = [KA[1] * KB[2] - KA[2] * KB[1], KA[2] * KB[0] - KA[0] * KB[2], KA[0] * KB[1] - KA[1] * KB[0]];   // (out of the plastic)
        const kat = (ka, kb, kn) => [0, 1, 2].map(i => kc[i] + (KA[i] * (ka - 20) + KB[i] * kb + KN[i] * (kn - 1)) * MMu);
        const sec = [[-9, .04], [-3.6, .04], [-2.5, 2.08], [2.5, 2.08], [3.6, .04], [9, .04]], ends = [23.6, 29.8];
        for (let i = 0; i < sec.length - 1; i++) {
          const p = sec[i], q = sec[i + 1], f = [kat(ends[0], p[0], p[1]), kat(ends[0], q[0], q[1]), kat(ends[1], q[0], q[1]), kat(ends[1], p[0], p[1])];
          const face = window.solid.facing(f) ? f : f.slice().reverse(), n = window.solid.newell(face), Lt = window.solid.L;
          svg += `<polygon points="${pts(face.map(proj))}" fill="${n[0] * Lt[0] + n[1] * Lt[1] + n[2] * Lt[2] > .15 ? '#FAFAF9' : '#EFEFED'}" ${INK.replace('stroke-width="1"', `stroke-width="${width}"`)}/>`;
        }
      }
    }
    return svg;
  }
  // the flight between the drawer and the slot: up out of the drawer, then back toward the monitor, arriving
  // square to the slot along its depth. A cubic in camera space, eased so the hand slows to line it up.
  function flight(a, b) {
    const c1 = { x: a.x, y: a.y - 260, z: a.z + 120 };
    const c2 = { x: b.x, y: b.y, z: b.z - 0.4 * (b.z - a.z) };
    return s => {
      const e = s < .5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2, r = 1 - e;
      const k = [r * r * r, 3 * r * r * e, 3 * r * e * e, e * e * e];
      return { ...b, x: k[0] * a.x + k[1] * c1.x + k[2] * c2.x + k[3] * b.x, y: k[0] * a.y + k[1] * c1.y + k[2] * c2.y + k[3] * b.y, z: k[0] * a.z + k[1] * c1.z + k[2] * c2.z + k[3] * b.z };
    };
  }

  // ---- the file drawer, the right pedestal's lowest (design.md: the polaroids). In the pedestal's (x, y, d) and the
  // desk's bend. From a seated eye a deep, low drawer never shows its floor (pulled out, its front hides everything
  // in it below its top edge), so it is full of hanging files, the old operators' (initials on their tabs), and
  // whatever is left in it lies on top of them.
  const FILE = { x0: 1240, x1: 1480, y0: 1665, y1: 1995, rim: 1665, tops: 1685, wall: 8, plate: .012, depth: .28, travel: .16 };   // (out .16: at 4:3 the files and what lies on them stay in view)
  const boxF = (x0, x1, y0, y1, d0, d1) => ({
    front: [[x0, y0, d1], [x1, y0, d1], [x1, y1, d1], [x0, y1, d1]],
    top:   [[x0, y0, d0], [x1, y0, d0], [x1, y0, d1], [x0, y0, d1]],
    right: [[x1, y0, d0], [x1, y1, d0], [x1, y1, d1], [x1, y0, d1]],
    left:  [[x0, y0, d1], [x0, y1, d1], [x0, y1, d0], [x0, y0, d0]],
  });
  // the outline of a split polygon in (x, y, d): its real edges only
  function outlineF(poly) {
    let d = '';
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a.cut && b.cut) continue;
      const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / 20));
      for (let k = 0; k <= n; k++) { const t = k / n, q = F([0, 1, 2].map(j => a[j] + (b[j] - a[j]) * t)); d += (k ? 'L' : 'M') + q[0].toFixed(2) + ',' + q[1].toFixed(2); }
    }
    return d;
  }
  // the room's camera (drawer.js CAM: f 1500, z0 1000): the pedestal's (x, y, d) is the camera point
  // ((x - 720) / 1.5, (y - 813) / 1.5, 1000 (1 - d)); solids (the key) are posed there and projected back through F,
  // the lens's bend with it
  const toCamF = ([x, y, d]) => [(x - EYE[0]) * CAM.z0 / CAM.f, (y - EYE[1]) * CAM.z0 / CAM.f, CAM.z0 * (1 - d)];
  const roomF = ([X, Y, Z]) => F([EYE[0] + X * CAM.f / CAM.z0, EYE[1] + Y * CAM.f / CAM.z0, 1 - Z / CAM.z0]);
  const p3 = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
  // The lock (design.md, the file drawer is locked): a round escutcheon at the top centre of the front (in frame at
  // 4:3), its edge sampled every 0.2 px; its keyway a line, upright when locked, across once turned; hidden while the
  // key is in it.
  // sized for the key at 2.0 (2026-10-02; at 1.45 they were y 13, r 7, way 4.2, holder 38, pull 74): the escutcheon
  // 6.3 px under the front's top edge, the card holder and pull lowered so the key standing out of the lock clears the
  // holder by 11 px or more (audit-file.js). (window.FILE_LOCK_SIZE: a stills page may try another size)
  const LK = window.FILE_LOCK_SIZE || { y: 16, r: 9.7, way: 5.8, holder: 52, pull: 88 };
  const LOCK = { x: (FILE.x0 + FILE.x1) / 2, y: FILE.y0 + LK.y, r: LK.r, way: LK.way };     // (sized for the key: key3d.js SCALE)
  function lockFace(z, lock = {}) {
    const n = Math.ceil(2 * Math.PI * LOCK.r / .2);
    const ring = Array.from({ length: n }, (_, k) => { const t = 2 * Math.PI * k / n; return F([LOCK.x + LOCK.r * Math.cos(t), LOCK.y + LOCK.r * Math.sin(t), z]); });
    let svg = `<polygon points="${p3(ring)}" fill="#ECECEA" ${INK}/>`;
    if (!lock.key) {
      const w = lock.turn ? [[LOCK.x - LOCK.way, LOCK.y], [LOCK.x + LOCK.way, LOCK.y]] : [[LOCK.x, LOCK.y - LOCK.way], [LOCK.x, LOCK.y + LOCK.way]];
      svg += `<path d="M${p3(w.map(([x, y]) => F([x, y, z]))).replace(' ', 'L')}" fill="none" ${INK} stroke-linecap="round"/>`;
    }
    return svg;
  }
  // the key in the lock at depth z: along the depth into the front, its stop against the face; turn 0 upright (as it
  // goes in), 1 a quarter round (its flat level). Only what is outside the lock is drawn (key3d.js, solid.js).
  function lockKey(z, turn) {
    if (!window.key3d) return '';
    // A along it, into the lock; B across it: upright ([0, -1, 0]) as it goes in, a quarter round to level ([-1, 0, 0])
    const t = turn * Math.PI / 2, A = [0, 0, 1], B = [-Math.sin(t), -Math.cos(t), 0];
    const face = toCamF([LOCK.x, LOCK.y, z]);
    return window.key3d.render({ c: [face[0], face[1], face[2] + 2.5 * window.key3d.MM], A, B }, roomF, { maxA: 17.5 });
  }
  // the drawer's front at depth z: the plate's face, the card holder, the pull, and the lock. (The card holder and the
  // pull sit 14 px lower than they did before the lock: the key, turned level, stands out of it toward you, and on
  // screen its head comes down to about 30 px below the front's top edge; the holder starts 6 px or more under it, the
  // drawer shut or out.)
  function fileFace(z, lock = {}) {
    const { x0, x1, y0, y1 } = FILE, cx = (x0 + x1) / 2;
    if (TANKER) return `<polygon points="${pts(roundRect(x0, x1, y0, y1, R_DRAWER, z))}" fill="#F4F4F2" ${INK}/>`
      + `<polygon points="${pts(rect(cx - 34, cx + 34, y0 + 32, y0 + 54, z))}" fill="#FAFAF9" ${INK}/>` + channel(cx - 84, cx + 84, y0 + 11, y0 + 24, z);
    return `<polygon points="${pts(rect(x0, x1, y0, y1, z))}" fill="#F4F4F2" ${INK}/>`
      + `<polygon points="${pts(rect(cx - 34, cx + 34, y0 + LK.holder, y0 + LK.holder + 22, z))}" fill="#FAFAF9" ${INK}/>`
      + pull(cx - 48, cx + 48, y0 + LK.pull, y0 + LK.pull + 13, z) + lockFace(z, lock);
  }
  // a polaroid lying flat at height y, its centre at (x, d), turned by rot (radians); the photo up the far end, the
  // strip toward you. 88 x 107 mm, a 79 mm square photo. A pixel across is about 1.18 mm here, a unit of d 1760 mm.
  // Its edges sampled every 2 px, so they bend with the room as everything else does.
  // one millimetre scale for everything in the room's camera: 1.765 mm a camera unit (the key's, key3d.js), so 1.1767 mm
  // a pixel across at the desk's front and 1765 mm a unit of depth (it was 1.18 and 1760: 0.3% apart, which put a
  // polaroid lifted out of the drawer 0.18 px off the one drawn in it)
  const MM_CAM = 1 / 1.765, PX_MM = 1 / (MM_CAM * CAM.f / CAM.z0), D_MM = CAM.z0 / MM_CAM;
  const POLAROID = [[-44, -53.5], [44, -53.5], [44, 53.5], [-44, 53.5]];
  const ringOf = (o, C = POLAROID) => C.flatMap((c, i) => { const e = C[(i + 1) % C.length], n = Math.max(1, Math.ceil(Math.hypot(e[0] - c[0], e[1] - c[1]) / PX_MM / 2)); return Array.from({ length: n }, (_, k) => o(c[0] + (e[0] - c[0]) * k / n, c[1] + (e[1] - c[1]) * k / n)); });
  function polaroidAt({ x, d, rot = 0, y, photo }) {
    const at = (mx, my) => {                                   // polaroid mm, from its centre -> (x, y, d)
      const c = Math.cos(rot), s = Math.sin(rot), rx = mx * c - my * s, ry = mx * s + my * c;
      return F([x + rx / PX_MM, y, d + ry / D_MM]);
    };
    const frame = ringOf(at);
    let svg = `<polygon points="${p3(frame)}" fill="#FAFAF9" ${INK}/>`;
    svg += photoIn(at(-39.5, -47.5), at(39.5, -47.5), at(-39.5, 31.5), photo);
    if (photo.strip) svg += stripText(photo.strip, at(0, 44), at(1, 44), at(0, 45));   // in the polaroid's own mm
    return { svg, hit: p3(frame) };
  }
  // what is written on a polaroid's strip, in Caveat (assets/fonts, OFL): a different hand from M.'s, as nobody knows
  // who took the photos. o, ax, ay: where a point on the strip's baseline and a millimetre across and down land
  function stripText(text, o, ax, ay) {
    const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(n => n.toFixed(4));
    return `<text transform="matrix(${m.join(' ')})" x="0" y="0" text-anchor="middle" font-family="Caveat, cursive" font-size="10" fill="#6E6E6C">${text}</text>`;
  }
  // a photo of the room: the drawing itself, cropped square, mapped onto three corners (top left, top right,
  // bottom left); an affine fit, close enough for something this small or held up flat
  function photoIn(o, ax, ay, photo) {
    const m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(n => n.toFixed(3));
    const [cx, cy, cw, ch] = photo.crop || [180, 0, 1080, 1080];
    return `<g transform="matrix(${m.join(' ')})"><svg x="0" y="0" width="1" height="1" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="none" overflow="hidden">`
      + `<image href="${photo.src || 'scene.svg'}" x="-240" y="0" width="1920" height="1080"/></svg></g>`
      + `<polygon points="${pts([o, ax, [ax[0] + ay[0] - o[0], ax[1] + ay[1] - o[1]], ay])}" fill="none" stroke="#D6D6D4" stroke-width=".8"/>`;
  }

  /* The file drawer's inside (design.md, the file drawer; decided 2026-10-01 after three rejected interiors). Hanging
     folders, one per operator, oldest nearest you (ts, jk, rd, aw, m) and yours, the newest, at the back. Each is what
     you see of a folder from above: a taller back flap whose top edge rises into the tab (one line up over it and back
     down), a sheet or two of paper in it a little lower and inset, and a shorter front flap, so the tab and the papers
     show over it. M.'s is empty, the only one; yours holds one blank form. */
  const TAB = { w: 56, h: 13, shoulder: 12, r: 4, font: 10, base: 4 }, FL = 7;
  // the tab's shoulder, in the drawing's corner language (the drawer fronts' corners are circular arcs): an arc of radius
  // r out of the edge, a straight slant, an arc of radius r onto the tab's top, tangent at every meeting. The slant's
  // angle is the one that makes them meet: h cos a - 2r cos a + 2r = shoulder sin a (bisection). Points every 0.2 px of
  // arc: a chord strays from a 4 px arc by 0.001 px.
  const SHOULDER = (() => {
    const { h: TH, shoulder: SH, r: R } = TAB, STEP = .2;
    let lo = 0, hi = Math.PI / 2;
    for (let n = 0; n < 60; n++) { const a = (lo + hi) / 2; (TH * Math.cos(a) - 2 * R * Math.cos(a) + 2 * R - SH * Math.sin(a) > 0 ? lo = a : hi = a); }
    const PHI = (lo + hi) / 2, p = [], m = Math.max(2, Math.ceil(R * PHI / STEP));
    for (let k = 0; k <= m; k++) { const a = PHI * k / m; p.push([R * Math.sin(a), R - R * Math.cos(a)]); }
    const s0 = p[p.length - 1], s1 = [SH - R * Math.sin(PHI), TH - R + R * Math.cos(PHI)], ns = Math.max(1, Math.ceil(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) / STEP));
    for (let k = 1; k < ns; k++) p.push([s0[0] + (s1[0] - s0[0]) * k / ns, s0[1] + (s1[1] - s0[1]) * k / ns]);
    for (let k = m; k >= 0; k--) { const a = PHI * k / m; p.push([SH - R * Math.sin(a), TH - R + R * Math.cos(a)]); }
    return p;
  })();
  // back to front: whose, how thick (back flap to front flap, in depth), which cut, how many sheets. A sheet or two
  // each: every edge in the stack stands 6 px or more from the next on screen, or two lines read as one doubled.
  const WHO = [['you', .007, 2, 1], ['m', .007, 0, 0], ['aw', .007, 1, 1], ['rd', .013, 0, 2], ['jk', .007, 1, 1], ['ts', .007, 0, 1]];
  // The old operators' sheets are their letters (Arnold, 2026-10-04; letters.js): each folder's sheets as the real papers
  // in it: each its width in mm, or { w, at, sink } with at its centre's offset in px from the folder's middle, sink how
  // far lower it stands (px), and down: true for one that sits too low in its folder to be seen (it keeps its place in
  // the stack's spacing, and is not drawn); a folder not named keeps its sheets as they are. Placed by
  // `node audit-letters.js search`: every sheet's seen corners and ends 6 px or more from every seen line; ts's can't
  // stand clear of the drawer's front anywhere, so it sits low, unseen; rd's second, blank sheet is gone.
  // (window.FILE_PAPERS: a stills page or an audit may try another; {} is the folders as they were before the letters)
  const LETTER_PAPERS = { ts: [{ w: 216, at: -16, down: true }], rd: [{ w: 216, at: 4 }], jk: [{ w: 152, at: -26 }], aw: [{ w: 140, at: -28 }] };
  const PAPERS_MM = window.FILE_PAPERS !== undefined ? window.FILE_PAPERS : LETTER_PAPERS;
  // the folders' places, worked out once with the drawer fully out (they keep them while it moves)
  let STACK = null;
  function fileStack() {
    if (STACK) return STACK;
    const { x0, x1, rim, tops, wall, plate } = FILE, xi0 = x0 + wall, xi1 = x1 - wall, D = FILE.travel;
    // two cuts for the old operators; yours, at the back, its own: the drawer's back corner (the line where its back
    // meets the far wall) comes down onto your tab's flat top, clear of both shoulders, and the tab clear of the photo
    // filed there
    const cuts = [xi0 + 18, xi0 + 18 + TAB.w + 20, xi0 + 108], XS = [xi0, (xi0 + xi1) / 2, xi1], GAP = 6;
    const build = fb0 => {
      let w = 11; const r = () => (w = (w * 16807) % 2147483647) / 2147483647;
      const out = []; let fb = fb0;
      for (const [who, th, cut, np] of WHO) {
        // each back flap stands where its top is GAP px or more below the front flap before it, on screen
        if (out.length) { const pf = out[out.length - 1]; fb = pf.fd + .002; while (XS.some(x => F([x, tops, fb])[1] < F([x, tops + FL, pf.fd])[1] + GAP)) fb += .0002; }
        // the sheets evenly between the flaps in depth and in height, so the edges step down evenly; inset by a seeded amount
        const own = PAPERS_MM?.[who], n = own ? own.length : np;
        const papers = Array.from({ length: n }, (_, k) => {
          const a = xi0 + 22 + r() * 12, b = xi1 - 16 - r() * 22;
          if (!own) return { d: fb + th * (k + 1) / (n + 1), y: tops + FL * (k + 1) / (n + 1), a, b };
          const o = typeof own[k] === 'number' ? { w: own[k] } : own[k], w = o.w / PX_MM, mid = (xi0 + xi1) / 2 + (o.at ?? (r() - .5) * 16);
          return { d: fb + th * (k + 1) / (n + 1), y: tops + FL * (k + 1) / (n + 1) + (o.sink || 0), a: mid - w / 2, b: mid + w / 2, down: !!o.down };
        });
        out.push({ who, fb, fd: fb + th, cut, papers });
      }
      return out;
    };
    // nothing is cut by an edge: at the opening's top edge behind and the drawer front's top edge before, every line (the
    // flap tops, the sheets, the tabs' tops) stands 6 px or more clear of it on screen, or is wholly hidden behind it; and
    // every tab wholly in view. The stack's depth is the first, from the back, that is clean.
    const openY = x => F([x, rim, 0])[1], frontY = x => F([x, rim, D - plate])[1];
    const lines = fs => fs.flatMap(f => { const tx = cuts[f.cut]; return [[tops, f.fb, xi0, xi1], [tops - TAB.h, f.fb, tx, tx + TAB.w], [tops + FL, f.fd, xi0, xi1], ...f.papers.map(p => [p.y, p.d, p.a, p.b])]; });
    const clean = fs => lines(fs).every(([y, d, xa, xb]) => {
      const xs = Array.from({ length: 9 }, (_, k) => xa + (xb - xa) * k / 8), sy = xs.map(x => F([x, y, d])[1]);
      const o = sy.map((v, k) => v - openY(xs[k])), fr = sy.map((v, k) => frontY(xs[k]) - v);
      return (Math.min(...o) >= 6 || Math.max(...o) <= 0) && (Math.min(...fr) >= 6 || Math.max(...fr) <= 0);
    });
    const tabsShow = fs => fs.every(f => { const tx = cuts[f.cut]; return [tx, tx + TAB.w].every(x => F([x, tops - TAB.h, f.fb])[1] - openY(x) >= 6); });
    let files = null;
    for (let fb0 = -.02; fb0 <= .03 && !files; fb0 += .0002) { const t = build(fb0); if (clean(t) && tabsShow(t)) files = t; }
    // relative to the drawer, so they move with it
    STACK = { files: (files || build(.006)).map(f => ({ ...f, fb: f.fb - D, fd: f.fd - D, papers: f.papers.map(p => ({ ...p, d: p.d - D })) })), cuts, xi0, xi1, clean: !!files };
    return STACK;
  }
  // where things go: the night-1 polaroid loose on the folders, and standing in your folder once filed. Loose, it lies
  // turned 47 degrees, found by audit-loose.html against the drawer as drawn: across the folders' stripes (a line every
  // 6 px) its edges cross each one decisively, every corner has 3 px of clear background round it, and no tab's curve
  // is half under it. (A gentler turn crossed the stripes too shallowly, and its corners landed on lines.)
  const LOOSE = { x: .335, d: .604, rot: .83 }, FILED = { x: 1300, rise: 40, lean: .05 };

  /* the file drawer, out by travel 0..1. lock: { key, turn } (the key in the lock, turned 0..1); photos: [{ photo,
     filed }] (loose on the folders, or standing in your folder); initials: on your tab (blank until something is
     filed); lifted: whose sheet is out of its folder (not drawn); yours: your folder can be clicked too (something is filed
     in it out of sight: the award slip). Returns { opening, inner (clip to hole), outer, front,
     hole, hits: { front, loose, filed, folders: [{ who, points }] } }. */
  let TAB_IDS = 0;
  function renderFile({ travel = 0, lock = {}, photos = [], initials = '', lifted = null, yours = false } = {}) {
    const { x0, x1, y0, y1, rim, tops, wall, plate, depth } = FILE;
    const D = FILE.travel * travel, back = D - depth, dn = D - plate, xi0 = x0 + wall, xi1 = x1 - wall;
    const inner = [], outer = [], hits = {};
    const put = (poly, fill, stroke = true) => {
      for (const side of [-1, 1]) {
        const part = splitAt(poly, 2, 0, side); if (part.length < 3) continue;
        const sp = bent(part); if (area(sp) <= 0.05) continue;
        const whole = !part.some(p => p.cut);
        (side < 0 ? inner : outer).push(`<polygon points="${pts(sp)}" fill="${fill}"${whole && stroke ? ' ' + INK : ''}/>`
          + (!whole && stroke ? `<path d="${outlineF(part)}" fill="none" ${INK} stroke-linecap="round"/>` : ''));
      }
    };
    const across = (d, svg) => (d < 0 ? inner : outer).push(svg);
    if (D > .001) {
      put(boxF(xi0, xi1, rim, y1, back, back + .01).front, '#DEDEDC');                   // the back, all the way down
      // the far wall's inside faces you: behind everything in the drawer, so drawn first, down to the bottom
      put(boxF(xi1, x1, rim, y1, back, dn).left, '#DEDEDC');
      const { files, cuts } = fileStack();
      const at = (d, ps) => ps.map(([x, y]) => F([x, y, d]));
      const line = ps => `<path d="M${p3(ps).replace(/ /g, 'L')}" fill="none" ${INK} stroke-linecap="round"/>`;
      // an edge from xa to xb at height y, rising over a tab at tx if there is one; straight runs every 2 px (they bend
      // with the desk), each piece starting where the last ended
      const crest = (tx, y, xa = xi0, xb = xi1) => {
        const p = [], run = (u0, u1, yy) => { const n = Math.max(1, Math.ceil((u1 - u0) / 2)); for (let k = p.length ? 1 : 0; k <= n; k++) p.push([u0 + (u1 - u0) * k / n, yy]); };
        if (tx == null) { run(xa, xb, y); return p; }
        run(xa, tx, y);
        for (const [a, u] of SHOULDER.slice(1)) p.push([tx + a, y - u]);
        run(tx + TAB.shoulder, tx + TAB.w - TAB.shoulder, y - TAB.h);
        for (const [a, u] of SHOULDER.slice().reverse().slice(1)) p.push([tx + TAB.w - a, y - u]);
        run(tx + TAB.w, xb, y);
        return p;
      };
      const filed = photos.filter(p => p.filed);
      files.forEach(f0 => {
        const f = { ...f0, fb: f0.fb + D, fd: f0.fd + D }, tx = cuts[f.cut], edge = crest(tx, tops);
        // the back flap, the tab its own top edge; its line runs down its right end, where it meets the far wall
        across(f.fb, `<polygon points="${p3(at(f.fb, [...edge, [xi1, tops + 80], [xi0, tops + 80]]))}" fill="#E9E9E7"/>` + line(at(f.fb, [...edge, [xi1, tops + 80]])));
        // the old operators' initials in Caveat, handwritten, as the polaroids' strips are; yours typed, in the company's
        // lettering (Arnold, 2026-10-02: done while you were away), capitals; centred on the tab and mapped onto its plane
        // as the strips are; clipped to it. Your tab is blank until the night after something is filed.
        const text = f.who === 'you' ? initials.toUpperCase() : f.who, typed = f.who === 'you';
        if (text) {
          const base = []; for (let n = Math.ceil(TAB.w / 2), q = n; q >= 0; q--) base.push([tx + TAB.w * q / n, tops]);
          const tabPoly = [...crest(tx, tops).filter(([x]) => x > tx && x < tx + TAB.w), ...base];
          const cid = 'tab' + (++TAB_IDS), bx = tx + TAB.w / 2, by = tops - TAB.base;
          const o = F([bx, by, f.fb]), ax = F([bx + 1, by, f.fb]), ay = F([bx, by + 1, f.fb]), m = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map(v => v.toFixed(4));
          across(f.fb, `<clipPath id="${cid}"><polygon points="${p3(at(f.fb, tabPoly))}"/></clipPath>`
            + `<g clip-path="url(#${cid})"><text transform="matrix(${m.join(' ')})" x="0" y="0" text-anchor="middle" ${typed ? `font-family="ui-monospace, Consolas, monospace" font-size="${TAB.font * .78}" letter-spacing=".6"` : `font-family="Caveat, cursive" font-size="${TAB.font}"`} fill="#6E6E6C">${text}</text></g>`);
        }
        // the sheets, and anything filed here standing among them, far to near
        const inIt = [...(f.who === lifted ? [] : f0.papers.filter(p => !p.down)).map(p => ({ d: p.d + D, paper: p })), ...(f.who === 'you' ? filed.map((p, i) => ({ d: f.fb + (f.fd - f.fb) * (i + 1) / (filed.length + 2), photo: p })) : [])].sort((a, b) => a.d - b.d);
        for (const it of inIt) {
          if (it.paper) {
            const p = it.paper, top = crest(null, p.y, p.a, p.b);
            across(it.d, `<polygon points="${p3(at(it.d, [...top, [p.b, tops + 80], [p.a, tops + 80]]))}" fill="#FAFAF9"/>` + line(at(it.d, [[p.a, tops + 80], ...top, [p.b, tops + 80]])));
          } else { const s = polaroidStanding({ ...FILED, d: it.d, photo: it.photo.photo }); across(it.d, s.svg); hits.filed = s.hit; }
        }
        // the front flap, shorter: its top edge and its right end
        const front = crest(null, tops + FL);
        across(f.fd, `<polygon points="${p3(at(f.fd, [...front, [xi1, tops + 80], [xi0, tops + 80]]))}" fill="#F2F2F0"/>` + line(at(f.fd, [...front, [xi1, tops + 80]])));
      });
      // where each old operator's folder can be clicked (its things lifted out: letters.js): the band of it you see, from
      // its back flap's edge, tab and all, down to the next folder's edge (the nearest, down to the drawer front's top)
      hits.folders = [];
      files.forEach((f0, i) => {
        if (!['ts', 'jk', 'rd', 'aw'].includes(f0.who) && !(yours && f0.who === 'you')) return;
        const top = at(f0.fb + D, crest(cuts[f0.cut], tops)), next = files[i + 1];
        const bottom = next ? at(next.fb + D, crest(cuts[next.cut], tops)) : at(dn, crest(null, rim));
        hits.folders.push({ who: f0.who, points: p3([...top, ...bottom.reverse()]) });
      });
      // a photo standing in a folder: x its centre, rise how far its top stands over the tabs' line, lean its tilt in its
      // own plane (radians); its lower part hidden by what is before it in the folder and the front flap, drawn after it
      function polaroidStanding({ x, d, rise, lean = 0, photo }) {
        const H = 107 / PX_MM, cy = tops - rise + H / 2;
        const o = (mx, my) => { const px = mx / PX_MM, py = my / PX_MM, c = Math.cos(lean), s = Math.sin(lean); return F([x + px * c - py * s, cy + px * s + py * c, d]); };
        const ring = ringOf(o);
        return { svg: `<polygon points="${p3(ring)}" fill="#FAFAF9" ${INK}/>` + photoIn(o(-39.5, -47.5), o(39.5, -47.5), o(-39.5, 31.5), photo), hit: p3(ring) };
      }
      // what lies loose on the folders rests on the tabs, the highest things there
      for (const p of photos.filter(p => !p.filed)) {
        const L = p.at || LOOSE, d = back + L.d * depth, s = polaroidAt({ ...L, d, x: x0 + L.x * (x1 - x0), y: tops - TAB.h - .5, photo: p.photo });
        across(d, s.svg); hits.loose = s.hit;
      }
      put(boxF(x0, xi0, rim, tops, back, dn).right, '#DEDEDC');
      put(boxF(x0, xi0, rim, y1, back, dn).top, '#E9E9E7'); put(boxF(xi1, x1, rim, y1, back, dn).top, '#E9E9E7');
      // the drawer's outer side toward you, where it has come out of the pedestal (the far side faces away); after the
      // inside, which it hides below the rim
      put(boxF(x0, xi0, rim, y1, back, dn).left, '#E2E2E0');
    }
    // the front plate: one solid block, the face's outline carried back to the plate's back and the two joined (its top
    // and side, as one), so rounded corners meet what is behind them. Shut, the block is all inside the pedestal: only
    // its face shows.
    const outline = z => TANKER ? roundRect(x0, x1, y0, y1, R_DRAWER, z) : rect(x0, x1, y0, y1, z);
    // (its outline the block's silhouette edge by edge, every edge bent as the face's are: below and right of the eye you
    // see its top, its left side and its face. A convex hull of the two outlines, as it was until 2026-10-04, drew the
    // top's back edge as a straight chord up to 3 px above the bent edge, and the sheets the folders were placed against
    // the bent edge showed as slivers over the chord.)
    const block = TANKER ? hull([...outline(dn), ...outline(D)]) : bent([[x0, y0, dn], [x1, y0, dn], [x1, y0, D], [x1, y1, D], [x0, y1, D], [x0, y1, dn]]);
    let front = D > .001 ? `<polygon points="${pts(block)}" fill="#E2E2E0" ${INK}/>` : '';
    front += fileFace(D, lock) + (lock.key ? lockKey(D, lock.turn || 0) : '');
    hits.front = pts(outline(D));
    // the opening in the pedestal, dark, square like the box coming out of it; only while it is out
    const opening = D > .001 ? `<polygon points="${pts(rect(x0, x1, y0, y1))}" fill="#D2D2D0" ${INK}/>` : '';
    return { opening, inner: inner.join(''), outer: outer.join(''), front, hole: pts(rect(x0, x1, y0, y1)), hits };
  }
  // what stands in front of a folder's sheets, on screen, with the drawer all the way out: its own front flap's edge,
  // every nearer folder's back flap (tab and all) and front flap, and the drawer front's top. Each a polyline left to
  // right, drawn exactly as renderFile draws them (a lifted letter shows only above them while it rises: letters.js).
  function inFrontOf(who) {
    const { x0, x1, rim, tops, wall, plate } = FILE, D = FILE.travel, xi0 = x0 + wall, xi1 = x1 - wall;
    const { files, cuts } = fileStack(), i = files.findIndex(f => f.who === who);
    const crest = (tx, y) => {
      const p = [], run = (u0, u1, yy) => { const n = Math.max(1, Math.ceil((u1 - u0) / 2)); for (let k = p.length ? 1 : 0; k <= n; k++) p.push([u0 + (u1 - u0) * k / n, yy]); };
      if (tx == null) { run(xi0, xi1, y); return p; }
      run(xi0, tx, y);
      for (const [a, u] of SHOULDER.slice(1)) p.push([tx + a, y - u]);
      run(tx + TAB.shoulder, tx + TAB.w - TAB.shoulder, y - TAB.h);
      for (const [a, u] of SHOULDER.slice().reverse().slice(1)) p.push([tx + TAB.w - a, y - u]);
      run(tx + TAB.w, xi1, y);
      return p;
    };
    const at = (d, ps) => ps.map(([x, y]) => F([x, y, d]));
    const lines = [at(files[i].fd + D, crest(null, tops + FL))];
    for (const f of files.slice(i + 1)) lines.push(at(f.fb + D, crest(cuts[f.cut], tops)), at(f.fd + D, crest(null, tops + FL)));
    const front = []; for (let x = x0; x <= x1 + .01; x += 2) front.push([x, rim]);
    lines.push(at(D - plate, front));
    return lines;
  }
  /* a polaroid as a card in the camera, for when it moves (lifted out of the drawer, held up, filed): pose { c, A, B } in
     camera space, A along its width, B down it toward the strip, in polaroid millimetres; its picture faces -(A x B).
     Its edges sampled at the same points as the drawer's (every 2 px), so the room's bend curves them alike and the
     handover from the drawer is exact; the photo mapped on by three corners. Its back, when
     that is what faces you, plain. project: camera point -> screen (deskDrawer.proj near the eye, roomF in the room). */
  function renderCard({ c, A, B }, project, photo, width = 1) {
    const MMu = MM_CAM;                                  // (the room's millimetre: a polaroid is its real size)
    const at = (mx, my) => [0, 1, 2].map(i => c[i] + (A[i] * mx + B[i] * my) * MMu);
    const N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    const front = -(N[0] * c[0] + N[1] * c[1] + N[2] * c[2]) < 0;
    const C = POLAROID, ring = C.flatMap((p, i) => { const e = C[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(e[0] - p[0], e[1] - p[1]) / PX_MM / 2)); return Array.from({ length: n }, (_, k) => project(at(p[0] + (e[0] - p[0]) * k / n, p[1] + (e[1] - p[1]) * k / n))); });
    let svg = `<polygon points="${p3(ring)}" fill="${front ? '#FAFAF9' : '#F2F2F0'}" stroke="#B4B4B4" stroke-width="${width}" stroke-linejoin="round"/>`;
    if (front) {
      svg += photoIn(project(at(-39.5, -47.5)), project(at(39.5, -47.5)), project(at(-39.5, 31.5)), photo);
      if (photo.strip) svg += stripText(photo.strip, project(at(0, 44)), project(at(1, 44)), project(at(0, 45)));
    }
    return { svg, hit: p3(ring) };
  }
  // where the night-1 polaroid lies loose, and stands filed, as card poses in the camera (with the drawer fully out)
  function photoPose(filed) {
    const { x0, x1, tops, depth } = FILE, D = FILE.travel, back = D - depth;
    if (!filed) {
      const r = LOOSE.rot, c = toCamF([x0 + LOOSE.x * (x1 - x0), tops - TAB.h - .5, back + LOOSE.d * depth]);
      return { c, A: [Math.cos(r), 0, -Math.sin(r)], B: [-Math.sin(r), 0, -Math.cos(r)] };
    }
    const you = fileStack().files.find(f => f.who === 'you'), d = you.fb + D + (you.fd - you.fb) / 3, H = 107 / PX_MM, l = FILED.lean;
    return { c: toCamF([FILED.x, tops - FILED.rise + H / 2, d]), A: [Math.cos(l), Math.sin(l), 0], B: [-Math.sin(l), Math.cos(l), 0] };
  }
  // a polaroid held up in front of you, flat to the eye: centre (cx, cy), w wide, turned by rot degrees
  function polaroidHeld({ cx, cy, w, rot = 0, photo }) {
    const k = w / 88, o = (mx, my) => { const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [cx + (mx * c - my * s) * k, cy + (mx * s + my * c) * k]; };
    let svg = `<polygon points="${pts([o(-44, -53.5), o(44, -53.5), o(44, 53.5), o(-44, 53.5)])}" fill="#FAFAF9" stroke="#B4B4B4" stroke-width="1.5" stroke-linejoin="round"/>`;
    svg += photoIn(o(-39.5, -47.5), o(39.5, -47.5), o(-39.5, 31.5), photo);
    if (photo.strip) svg += stripText(photo.strip, o(0, 44), o(1, 44), o(0, 45));
    return svg;
  }
  window.deskDrawer = { LK, pullAt: pull, desk, render, P, F, slots: SLOTS, cartPose, slotPose, clearOfSlot, renderCartridge, renderCartridgeSolid, greyOf, proj, flight, renderFile, fileStack, inFrontOf, lockKey, renderCard, photoPose, polaroidHeld, FILE, TRAVEL, LOCK, LOOSE, FILED, TAB, FL, toCamF, roomF };


  // Motion, shared by the page and audit-drawer.js. A hand pull starts from rest and arrives at the slide's
  // end stop still moving (e(t) = (3t² - t³)/2 ends at 1.5x mean speed), so the drawer knocks against the
  // stop and gives back a little. A push is the same curve into the latch.
  const hand = t => (3 * t * t - t * t * t) / 2;
  const easeInOut = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  window.drawerMotion = {
    open:  { ms: 760, stopAt: 600 / 760,
             travel(u) { const s = this.stopAt; return u < s ? hand(u / s) : 1 - 0.03 * Math.sin(Math.PI * (u - s) / (1 - s)); } },
    close: { ms: 460, travel: u => 1 - hand(u) },
    // taking a cartridge from its recess: lifted straight up, slowing as it clears the drawer; `put` sets it
    // down the same way, slowing as it goes in
    take:  { ms: 380, lift: u => 1 - Math.pow(1 - u, 2) },
    put:   { ms: 380, lift: u => Math.pow(1 - u, 2) },
    // the flight between the drawer and the slot
    fly:   { ms: 900 },
    // the head tilting down to the desk and back up: how far the view travels, in scene units
    // with the drawer shut, and further once it is open, so the back row and the drawer front are both in view
    look:  { ms: 650, depth: 520, open: 700, ease: easeInOut },
  };
})();
