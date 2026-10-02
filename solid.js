/* solid.js — flat-shaded solids in the room's camera, in the mug's manner (mug3d.js): faces facing the eye
   are drawn, each in its material's lit or shade tone by one light; lines only where a face turns away (silhouette)
   or two faces meet at a real corner (crease), never between the facets of a sampled curve.

   An extrusion: an outer loop and hole loops in a plane (a, b in mm), thickness t along n; pockets: loops cut into the
   top face to a depth. frame(a, b, n) -> camera point (mm in, camera units out); project(camera point) -> screen. */
(function () {
  const L = norm([-.55, -.35, -.75]);                 // the mug's light: upper left, in front (camera space, y down)
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  function newell(P) {
    let x = 0, y = 0, z = 0; const k = P.length;
    for (let i = 0; i < k; i++) { const p = P[i], q = P[(i + 1) % k]; x += (p[1] - q[1]) * (p[2] + q[2]); y += (p[2] - q[2]) * (p[0] + q[0]); z += (p[0] - q[0]) * (p[1] + q[1]); }
    return norm([x, y, z]);
  }
  const centre = P => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length, a[2] + p[2] / P.length], [0, 0, 0]);
  const facing = P => dot(newell(P), centre(P)) < 0;                     // the eye is at the origin
  // a material is [lit, shade] (by the mug's light), or a function of the face's normal giving its grey
  const tone = (P, mat) => typeof mat === 'function' ? mat(newell(P)) : mat[dot(newell(P), L) > .15 ? 0 : 1];
  const fmt = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
  const pathOf = ps => 'M' + fmt(ps).split(' ').join('L');
  const area2 = ps => { let s = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i], q = ps[(i + 1) % ps.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const CREASE = Math.cos(25 * Math.PI / 180);
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round" fill="none"';

  // walls round a loop: quads between its top (n = top) and bottom (n = bot) copies. outward: +1 if the loop's walls
  // face out of the solid as the loop runs (outer loops), -1 for holes and pockets. Returns fills and lines.
  function walls(loop, top, bot, frame, project, mat, outward, width) {
    const n = loop.length, T = loop.map(([a, b]) => frame(a, b, top)), B = loop.map(([a, b]) => frame(a, b, bot));
    const quad = i => { const j = (i + 1) % n; return outward > 0 ? [T[i], B[i], B[j], T[j]] : [T[j], B[j], B[i], T[i]]; };
    const vis = [], nrm = [], fill = [];
    for (let i = 0; i < n; i++) { const q = quad(i); vis.push(facing(q)); nrm.push(newell(q)); fill.push(tone(q, mat)); }
    let out = '', lines = '';
    // runs of visible quads with one tone become one polygon (no seams between facets)
    const PT = T.map(project), PB = B.map(project);
    const same = (h, i) => vis[h] && vis[i] && fill[h] === fill[i];
    const starts = []; for (let i = 0; i < n; i++) if (vis[i] && !same((i - 1 + n) % n, i)) starts.push(i);
    for (const i0 of starts) {
      let i = i0; const top = [PT[i]], bottom = [PB[i]];
      do { const j = (i + 1) % n; top.push(PT[j]); bottom.push(PB[j]); i = j; } while (same((i - 1 + n) % n, i) && i !== i0);
      out += `<polygon points="${fmt([...top, ...bottom.reverse()])}" fill="${fill[i0]}"/>`;
    }
    if (!starts.length && vis.every(v => v)) for (let i = 0; i < n; i++) out += `<polygon points="${fmt([PT[i], PT[(i + 1) % n], PB[(i + 1) % n], PB[i]])}" fill="${fill[i]}"/>`;
    // the upright edges between quads: silhouettes, and real corners
    for (let i = 0; i < n; i++) {
      const h = (i - 1 + n) % n;
      if (!(vis[h] || vis[i])) continue;
      if (vis[h] !== vis[i] || dot(nrm[h], nrm[i]) < CREASE) lines += `<path d="${pathOf([PT[i], PB[i]])}" ${INK} stroke-width="${width}"/>`;
    }
    // the bottom edge: drawn where a wall is seen and the face below it is not (the top edge is the top face's outline)
    const runs = [];
    for (let i = 0; i < n; i++) if (vis[i]) runs.push(i);
    let d = '';
    for (const i of runs) d += `M${fmt([PB[i]])}L${fmt([PB[(i + 1) % n]])}`;
    return { fills: out, lines, bottom: d, vis, anyVisible: vis.some(v => v) };
  }

  /* render an extrusion. shape: { outer, holes: [loop], pockets: [{ loop, depth }], t }, loops counter-clockwise in
     (a, b). mats: { cap, wall, hole, floor, pocketWall } each [lit, shade]. Returns svg. */
  function extrusion(shape, frame, project, mats, { width = 1, stamp = null } = {}) {
    const { outer, holes = [], pockets = [], t } = shape, top = t / 2, bot = -t / 2;
    const capTop = outer.map(([a, b]) => frame(a, b, top)), capBot = outer.map(([a, b]) => frame(a, b, bot)).reverse();
    const topSeen = facing(capTop), botSeen = facing(capBot);
    const capN = topSeen ? top : bot;
    let svg = '';
    // the outer walls (the bottom outline where the cap there is turned away)
    const w = walls(outer, top, bot, frame, project, mats.wall, 1, width);
    svg += w.fills + w.lines;
    if (!botSeen && w.bottom) svg += `<path d="${w.bottom}" ${INK} stroke-width="${width}"/>`;
    if (!topSeen) {
      // seen from below: the top outline is a silhouette where walls are seen
      let d = ''; const PT = outer.map(([a, b]) => project(frame(a, b, top)));
      w.vis.forEach((v, i) => { if (v) d += `M${fmt([PT[i]])}L${fmt([PT[(i + 1) % PT.length]])}`; });
      if (d) svg += `<path d="${d}" ${INK} stroke-width="${width}"/>`;
    }
    // through the holes: their far walls, and the far rim of the other face
    for (const h of holes) {
      const hw = walls(h, top, bot, frame, project, mats.hole, -1, width);
      svg += hw.fills + hw.lines;
      const far = h.map(([a, b]) => project(frame(a, b, topSeen ? bot : top)));
      let d = ''; hw.vis.forEach((v, i) => { if (v) d += `M${fmt([far[i]])}L${fmt([far[(i + 1) % far.length]])}`; });
      if (d) svg += `<path d="${d}" ${INK} stroke-width="${width}"/>`;
    }
    // pockets, only in the top face, seen when it is
    if (topSeen) for (const p of pockets) {
      const fl = top - p.depth;
      const pw = walls(p.loop, top, fl, frame, project, mats.pocketWall, -1, width);
      const floor = p.loop.map(([a, b]) => project(frame(a, b, fl)));
      svg += `<polygon points="${fmt(floor)}" fill="${tone(p.loop.map(([a, b]) => frame(a, b, fl)), mats.floor)}"/>` + pw.fills + pw.lines;
      let d = ''; pw.vis.forEach((v, i) => { if (v) d += `M${fmt([floor[i]])}L${fmt([floor[(i + 1) % floor.length]])}`; });
      if (d) svg += `<path d="${d}" ${INK} stroke-width="${width}"/>`;
    }
    // the cap toward the eye, last, its holes and pockets cut out of it, with its outline
    const loops = [outer, ...holes, ...(topSeen ? pockets.map(p => p.loop) : [])].map(l => l.map(([a, b]) => project(frame(a, b, capN))));
    const capFill = tone(topSeen ? capTop : capBot, mats.cap);              // (the cap toward the eye, wound as it faces)
    const d = loops.map(l => pathOf(l) + 'Z').join('');
    svg += `<path d="${d}" fill="${capFill}" fill-rule="evenodd"/><path d="${d}" ${INK} stroke-width="${width}"/>`;
    if (stamp && topSeen) svg += stamp(frame, project, capN);
    return svg;
  }
  window.solid = { extrusion, facing, newell, L };
})();
