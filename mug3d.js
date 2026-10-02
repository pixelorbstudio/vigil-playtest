/* mug3d.js — a small flat-shaded vector renderer for the mug.
   Builds a cylinder with a rim, an inner wall, a coffee surface and a D handle, projects it through the
   drawing's own camera (principal point at the vanishing centre), and draws it as SVG polygons in the
   illustration's language: flat fills from the grey range and one-pixel grey outlines on silhouettes
   and creases. Nothing here is lit realistically; it is a line drawing that happens to know its depth. */

window.createMug3D = function createMug3D({ f = 1500, px = 720, py = 813 } = {}) {
  // ---- dimensions, in stage units, matched to the drawn mug
  const R = 70.5, H = 160, N = 64, RIM = 4.5, COFFEE = .74;
  const HANDLE = { x: 75, y: 15.5, a: 22, b: 40, r: 10, nu: 40, nv: 12 };

  // ---- materials: [lit, shade]
  const MAT = {
    body:   ['#FBFBFA', '#EFEFED'],
    rim:    ['#F7F7F5', '#ECECEA'],
    inner:  ['#E4E4E2', '#E4E4E2'],     // one tone inside: a split there reads as a fold
    coffee: ['#4B4744', '#413D3A'],
    floor:  ['#D2D2D0', '#D2D2D0'],     // an empty cup's bottom: its own tone, or the inside reads as bottomless
    handle: ['#F7F7F5', '#E8E8E6'],
  };
  const OUTLINE = '#B4B4B4';

  // ---- geometry (model space: y up, z toward the viewer is negative)
  const V = [], F = [];
  const add = (x, y, z) => V.push([x, y, z]) - 1;
  const ring = (r, y) => Array.from({ length: N }, (_, i) => { const a = i / N * 2 * Math.PI; return add(r * Math.cos(a), y, r * Math.sin(a)); });
  // strip: faces that run around a ring (or along the handle) carry their two rails so same-tone runs
  // can be merged into one polygon and drawn without seams.
  const face = (idx, mat, group = mat, strip = null) => F.push({ idx, mat, group, strip });

  const top = ring(R, H / 2), topIn = ring(R - RIM, H / 2);
  const foot = ring(R * .985, -H / 2), coffee = ring(R - RIM, -H / 2 + H * COFFEE);
  const COFFEE_FLOOR = -H / 2 + 5, COFFEE_FULL = -H / 2 + H * COFFEE;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    face([top[i], foot[i], foot[j], top[j]], 'body', 'wall', { id: 'wall', i, ai: top[i], aj: top[j], bi: foot[i], bj: foot[j], wrap: true });
    face([top[i], top[j], topIn[j], topIn[i]], 'rim', 'rim', { id: 'rim', i, ai: top[i], aj: top[j], bi: topIn[i], bj: topIn[j], wrap: true });
    face([topIn[i], topIn[j], coffee[j], coffee[i]], 'inner', 'inner', { id: 'inner', i, ai: topIn[i], aj: topIn[j], bi: coffee[i], bj: coffee[j], wrap: true });
  }
  face([...foot].reverse(), 'body', 'bottom');                   // bottom, downward
  // the drawing's two rings round the body, the lip line under the rim and the foot ring above the base: lines
  // only, no faces, as Arnold drew them
  const LIP = ring(R, H / 2 - 9), FOOT = ring(R, -H / 2 + 10);
  face([...coffee], 'coffee');                                   // coffee surface, upward

  // D handle: an elliptical torus in the plane of the mug's side
  {
    const { x: hx, y: hy, a, b, r, nu, nv } = HANDLE;
    const grid = [];
    const uMax = Math.acos((R - 3 - hx) / a);          // where the ring's centreline meets the body wall
    for (let i = 0; i <= nu; i++) {
      const u = -uMax + (i / nu) * 2 * uMax;
      const c = [hx + a * Math.cos(u), hy + b * Math.sin(u), 0];
      let nx = b * Math.cos(u), ny = a * Math.sin(u); const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      const row = [];
      for (let k = 0; k < nv; k++) {
        const v = k / nv * 2 * Math.PI;
        row.push(add(c[0] + r * Math.cos(v) * nx, c[1] + r * Math.cos(v) * ny, c[2] + r * Math.sin(v)));
      }
      grid.push(row);
    }
    for (let i = 0; i < nu; i++) for (let k = 0; k < nv; k++) {
      const i2 = i + 1, k2 = (k + 1) % nv;
      face([grid[i][k], grid[i][k2], grid[i2][k2], grid[i2][k]], 'handle', 'handle', { id: 'h' + k, i, ai: grid[i][k], aj: grid[i2][k], bi: grid[i][k2], bj: grid[i2][k2], wrap: false });
    }
  }

  // ---- edges: which faces share each edge (for silhouettes and creases)
  const edgeMap = new Map();
  F.forEach((fc, fi) => {
    const n = fc.idx.length;
    for (let i = 0; i < n; i++) {
      const a = fc.idx[i], b = fc.idx[(i + 1) % n];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!edgeMap.has(key)) edgeMap.set(key, { a, b, faces: [] });
      edgeMap.get(key).faces.push(fi);
    }
  });
  const edges = [...edgeMap.values()];
  const faceEdges = F.map(() => []);
  edges.forEach((e, ei) => e.faces.forEach(fi => faceEdges[fi].push(ei)));

  const strips = new Map();
  F.forEach((fc, fi) => { if (!fc.strip) return; if (!strips.has(fc.strip.id)) strips.set(fc.strip.id, []); strips.get(fc.strip.id)[fc.strip.i] = fi; });

  const L = norm([-.55, -.35, -.75]);   // light from upper left, in front (camera space, y down)
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  /* pose: { x, y, z } camera-space position of the mug's centre (y down, z forward),
           tilt: radians, top of the mug toward the viewer; roll: radians about the view axis;
           yaw: radians about the mug's own axis. Returns { svg, rimFar: {x, y, k} } */
  function render(pose, level = 1, { outline = 1 } = {}) {
    const { x: X, y: Y, z: Z, tilt = 0, roll = 0, yaw = 0 } = pose;
    const empty = level <= .01;
    const COFFEE_Y = COFFEE_FLOOR + (COFFEE_FULL - COFFEE_FLOOR) * Math.max(0, Math.min(1, level));
    const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll), cy = Math.cos(yaw), sy = Math.sin(yaw);
    // the coffee stays level in the world: its surface is the horizontal plane through the coffee line,
    // expressed in the mug's frame, and it climbs toward the near rim as the mug tips
    const slope = Math.tan(tilt);
    for (const vi of coffee) {
      const v = V[vi];
      v[1] = empty ? COFFEE_FLOOR : Math.max(COFFEE_FLOOR, Math.min(H / 2 - 1.5, COFFEE_Y - slope * (v[0] * sy + v[2] * cy)));
    }
    // transform every vertex to camera space
    const C = V.map(([x, y, z]) => {
      let x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y;              // yaw about the mug's axis
      let y2 = y1 * ct + z1 * st, z2 = -y1 * st + z1 * ct;               // tilt: top toward the viewer
      let xc = x1, yc = -y2;                                              // model y up -> camera y down
      let x3 = xc * cr - yc * sr, y3 = xc * sr + yc * cr;                 // roll about the view axis
      return [x3 + X, y3 + Y, z2 + Z];
    });
    const P = C.map(([x, y, z]) => [px + f * x / z, py + f * y / z]);

    // per-face: normal, visibility, depth, colour
    const info = F.map(fc => {
      // the normal from the whole outline (Newell's method), not three corners: a low coffee surface in a tipped
      // mug folds (level with the world on one side, resting on the floor on the other), and three corners of a
      // fold can point the wrong way, which hid the coffee and showed the mug's white bottom through it
      let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
      const k = fc.idx.length;
      for (let q = 0; q < k; q++) {
        const p0 = C[fc.idx[q]], p1 = C[fc.idx[(q + 1) % k]];
        nx += (p0[1] - p1[1]) * (p0[2] + p1[2]); ny += (p0[2] - p1[2]) * (p0[0] + p1[0]); nz += (p0[0] - p1[0]) * (p0[1] + p1[1]);
        cx += p0[0] / k; cy += p0[1] / k; cz += p0[2] / k;
      }
      const n = norm([nx, ny, nz]);
      const visible = (n[0] * cx + n[1] * cy + n[2] * cz) < 0;
      let zsum = 0; for (const i of fc.idx) zsum += C[i][2];
      const lit = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) > .15;
      const mat = fc.mat === 'coffee' && empty ? 'floor' : fc.mat;
      return { n, visible, depth: zsum / fc.idx.length, fill: MAT[mat][lit ? 0 : 1] };
    });

    // draw items: single faces, or runs of adjacent same-tone faces along a strip merged into one polygon
    const items = [];
    const single = new Set();
    for (const [, list] of strips) {
      const n = list.length, wrap = F[list[0]].strip.wrap;
      const ok = i => { const fi = list[i]; return fi !== undefined && info[fi].visible; };
      // start a run where the previous face is absent or differs, so runs are maximal
      let start = 0;
      if (wrap) { start = -1; for (let i = 0; i < n; i++) { const p = (i + n - 1) % n; if (!ok(i) || !ok(p) || info[list[i]].fill !== info[list[p]].fill) { start = i; break; } } if (start < 0) start = 0; }
      let i = 0;
      while (i < n) {
        const idx = (start + i) % n;
        if (!ok(idx)) { i++; continue; }
        const run = [list[idx]]; let j = i + 1;
        while (j < n && (wrap || start + j < n)) {
          const nx = (start + j) % n;
          if (!ok(nx) || info[list[nx]].fill !== info[run[0]].fill || (!wrap && nx < idx)) break;
          run.push(list[nx]); j++;
        }
        const rail = run.map(fi => F[fi].strip);
        const pts = [...rail.map(r => r.ai), rail[rail.length - 1].aj, rail[rail.length - 1].bj, ...rail.map(r => r.bi).reverse()];
        let depth = 0; for (const fi of run) depth += info[fi].depth;
        items.push({ faces: run, pts, group: F[run[0]].group, fill: info[run[0]].fill, depth: depth / run.length });
        i = j;
      }
      for (const fi of list) single.add(fi);
    }
    F.forEach((fc, fi) => { if (!single.has(fi) && info[fi].visible) items.push({ faces: [fi], pts: fc.idx, group: fc.group, fill: info[fi].fill, depth: info[fi].depth }); });

    // draw order: the mug's topology decides which surfaces can cover which (the inside can never paint
    // over the front wall), and depth only orders items within a group, far to near.
    // The handle is painted first: its ends run into the wall, and wherever it falls inside the body's
    // silhouette the inner wall, coffee and outer wall paint over it, exactly as a real handle is hidden.
    const GROUP_ORDER = { handle: 0, bottom: 1, inner: 2, coffee: 3, wall: 4, rim: 5 };
    items.sort((a, b) => (GROUP_ORDER[a.group] - GROUP_ORDER[b.group]) || (b.depth - a.depth));
    const drawn = new Uint8Array(F.length);
    let out = '';
    for (const it of items) {
      out += `<polygon points="${it.pts.map(i => P[i][0].toFixed(1) + ',' + P[i][1].toFixed(1)).join(' ')}" fill="${it.fill}" stroke="${it.fill}" stroke-width="1" stroke-linejoin="round"/>`;
      for (const fi of it.faces) drawn[fi] = 1;
      let lines = '';
      for (const fi of it.faces) for (const ei of faceEdges[fi]) {
        const e = edges[ei];
        if (e.faces.length !== 2) continue;
        const other = e.faces[0] === fi ? e.faces[1] : e.faces[0];
        if (it.faces.includes(other)) continue;                      // interior to this run
        const oi = info[other];
        let draw = false;
        if (!oi.visible) draw = true;                                 // silhouette: this face is the visible side
        else if (drawn[other]) {                                       // crease: both visible, drawn once, with the nearer
          const d = info[fi].n[0] * oi.n[0] + info[fi].n[1] * oi.n[1] + info[fi].n[2] * oi.n[2];
          draw = d < Math.cos(55 * Math.PI / 180);
        }
        if (draw) lines += `M${P[e.a][0].toFixed(1)} ${P[e.a][1].toFixed(1)}L${P[e.b][0].toFixed(1)} ${P[e.b][1].toFixed(1)}`;
      }
      if (lines) out += `<path d="${lines}" stroke="${OUTLINE}" stroke-width="${outline}" stroke-linecap="round" fill="none"/>`;
    }
    // the rings, on the side of the body that faces the eye
    for (const rg of [LIP, FOOT]) {
      let d = '', on = false;
      for (let i = 0; i <= N; i++) {
        const vi = rg[i % N], a = (i % N) / N * 2 * Math.PI;
        // the outward normal, turned as the vertices are (yaw, tilt, roll)
        const nx1 = Math.cos(a) * cy - Math.sin(a) * sy, nz1 = Math.cos(a) * sy + Math.sin(a) * cy;
        const ny2 = nz1 * st, nz2 = nz1 * ct, nyc = -ny2;
        const nx3 = nx1 * cr - nyc * sr, ny3 = nx1 * sr + nyc * cr;
        const c = C[vi], vis = nx3 * (c[0]) + ny3 * (c[1]) + nz2 * (c[2]) < 0;
        if (vis) { d += (on ? 'L' : 'M') + P[vi][0].toFixed(1) + ' ' + P[vi][1].toFixed(1); on = true; } else on = false;
      }
      if (d) out += `<path d="${d}" stroke="#D6D6D4" stroke-width="1" stroke-linecap="round" fill="none"/>`;
    }

    // where the steam should rise from: the far point of the rim, and the projected scale there
    const farIdx = top[Math.round(N * .25)];   // the +z point of the top ring (away from the viewer at rest)
    const rimFar = { x: P[farIdx][0], y: P[farIdx][1], k: f / C[farIdx][2] };
    return { svg: out, rimFar };
  }

  return { render, R, H };
};

/* The sip, as a pure function of time. poses: { REST, LIPS, TIP } in camera space.
   at(ms) -> { pose, dolly, shiftY, blend, event }  where blend (0..1) is how far the drawn mug has
   taken over again at the end, and event is 'sip' on the frame the sip happens, 'done' at the end. */
window.createSipTimeline = function createSipTimeline({ REST, LIPS, TIP }) {
  const easeInOut = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const mix = (p, q, t) => Object.fromEntries(Object.keys(p).map(k => [k, p[k] + (q[k] - p[k]) * t]));
  const SEG = [
    { ms: 700, from: REST, to: LIPS, blendIn: .16 },                         // up to the lips; the drawing fades out over the first 16%
    { ms: 240, hold: LIPS, breathe: .025 },                                  // settle
    { ms: 320, from: LIPS, to: TIP },                                        // tip
    { ms: 460, hold: TIP, breathe: .02, event: 'sip' },                      // the sip
    { ms: 340, from: TIP, to: LIPS },                                        // level out
    { ms: 760, from: LIPS, to: REST, handoff: .8 },                          // back down; the drawing takes over in the last 20%, when it is nearly still
  ];
  const duration = SEG.reduce((s, x) => s + x.ms, 0);
  const upEnd = SEG[0].ms, downStart = duration - SEG[5].ms;
  function at(ms) {
    let t = Math.max(0, Math.min(duration, ms)), i = 0;
    while (i < SEG.length - 1 && t > SEG[i].ms) { t -= SEG[i].ms; i++; }
    const seg = SEG[i], u = Math.min(1, t / seg.ms), e = easeInOut(u);
    let pose;
    if (seg.hold) pose = { ...seg.hold, tilt: seg.hold.tilt + Math.sin(u * Math.PI) * seg.breathe };
    else pose = mix(seg.from, seg.to, e);
    const dolly = ms < upEnd ? 1 + .03 * easeInOut(ms / upEnd) : ms < downStart ? 1.03 : 1.03 - .03 * easeInOut((ms - downStart) / SEG[5].ms);
    const shiftY = -12 * (dolly - 1) / .03;
    let blend = 0;
    if (seg.handoff !== undefined && u > seg.handoff) blend = (u - seg.handoff) / (1 - seg.handoff);
    if (seg.blendIn !== undefined && u < seg.blendIn) blend = 1 - u / seg.blendIn;
    const event = seg.event === 'sip' && t < 20 ? 'sip' : ms >= duration ? 'done' : null;
    return { pose, dolly, shiftY, blend, event, seg: i, u };
  }
  return { duration, at };
};
