/* lathe.js (scratch, for the tube stills): a surface of revolution in the room's camera, in solid.js's manner.
   profile: [[h, r, mat?], ...] along the axis (h) and out from it (r), in mm, listed so the material lies to the right
   of the way it runs in the (h, r) plane (h across, r up); each band takes the mat of the point it starts from.
   seal: each fill also stroked in its own tone, half a px (where a piece is cut in two, the antialiased seam showed).
   split: false keeps a band in one piece across its near and far halves (when the caller orders things itself rather than
   sorting near against far; split, a band's two runs could leave a ring line stopping short at the seam).
   noGenerators: materials whose silhouettes along the axis are not drawn (a tube's inside seen through its mouth: its
   silhouette leaves the rim's inner ring on its tangent and runs a px or two from it, a sliver; tone alone shows it).
   open: profile indices of rings left without a line (where a piece is cut to be drawn in two parts).
   matEdges: also a ring where the material changes along a flush run (bands too small to draw raised); true for every
   change, or a list of materials, for the changes into or out of those only.
   frame: { C, A, U, V } camera space: C the origin on the axis, A the axis, U and V across it, each one mm long.
   Returns items [{ depth, svg }] to be sorted far to near with other items. */
(function () {
  const L = window.solid.L;
  const CREASE = Math.cos(25 * Math.PI / 180);
  const INK = 'stroke="#B4B4B4" stroke-linejoin="round" stroke-linecap="round" fill="none"';
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const fmt = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
  const tone = (n, mat) => typeof mat === 'function' ? mat(n) : mat[dot(n, L) > .15 ? 0 : 1];

  function lathe(profile, { C, A, U, V }, project, mats, { width = 1, sectors = 360, cut = null, genStep = 8, matEdges = false, open = [], noGenerators = [], split = true, seal = false } = {}) {
    const N = sectors;
    const pt = (h, r, i) => { const a = 2 * Math.PI * i / N, c = Math.cos(a) * r, s = Math.sin(a) * r; return [C[0] + A[0] * h + U[0] * c + V[0] * s, C[1] + A[1] * h + U[1] * c + V[1] * s, C[2] + A[2] * h + U[2] * c + V[2] * s]; };
    const radial = i => { const a = 2 * Math.PI * (i + .5) / N; return norm([U[0] * Math.cos(a) + V[0] * Math.sin(a), U[1] * Math.cos(a) + V[1] * Math.sin(a), U[2] * Math.cos(a) + V[2] * Math.sin(a)]); };
    const Au = norm(A);
    const inCut = i => cut && (cut.i0 <= cut.i1 ? i >= cut.i0 && i < cut.i1 : i >= cut.i0 || i < cut.i1);
    const rings = profile.map(([h, r]) => Array.from({ length: N + 1 }, (_, i) => pt(h, r, i)));
    const screen = rings.map(ring => ring.map(project));
    const B = profile.length - 1;
    // per band and sector: the outward normal (from the profile's direction), whether it is seen, its tone
    const bands = [];
    for (let j = 0; j < B; j++) {
      const [h0, r0] = profile[j], [h1, r1] = profile[j + 1], mat = mats[profile[j][2] || 'body'];
      const dh = h1 - h0, dr = r1 - r0, len = Math.hypot(dh, dr) || 1;
      const sec = [];
      for (let i = 0; i < N; i++) {
        const R = radial(i), n = norm([-dr / len * Au[0] + dh / len * R[0], -dr / len * Au[1] + dh / len * R[1], -dr / len * Au[2] + dh / len * R[2]]);
        const q = [rings[j][i], rings[j + 1][i], rings[j + 1][i + 1], rings[j][i + 1]];
        const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
        const zero = r0 === 0 && r1 === 0;
        // a window: walls between its heights lose the sectors it spans
        const gone = cut && dh !== 0 && Math.min(h0, h1) >= cut.h0 - 1e-9 && Math.max(h0, h1) <= cut.h1 + 1e-9 && inCut(i);
        sec.push({ n, vis: !zero && !gone && dot(n, c) < 0, fill: tone(n, mat), near: dot(R, C) < 0 });
      }
      bands.push({ sec, flat: dh === 0 });
    }
    const items = [];
    for (let j = 0; j < B; j++) {
      const { sec } = bands[j];
      const same = (h, i) => sec[h].vis && sec[i].vis && sec[h].fill === sec[i].fill && (!split || sec[h].near === sec[i].near);
      const starts = [];
      for (let i = 0; i < N; i++) if (sec[i].vis && !same((i - 1 + N) % N, i)) starts.push(i);
      if (!starts.length && sec.every(s => s.vis)) starts.push(0);
      for (const i0 of starts) {
        let i = i0; const run = [i0];
        while (true) { const k = (i + 1) % N; if (k === i0 || !same(i, k)) break; run.push(k); i = k; }
        const [h0, r0] = profile[j], [h1, r1] = profile[j + 1], m = Math.max(1, Math.ceil(Math.hypot(h1 - h0, r1 - r0) / genStep));
        const gen = (i, from, to) => { const out = []; for (let k = 1; k < m; k++) { const t = from + (to - from) * k / m; out.push(project(pt(h0 + (h1 - h0) * t, r0 + (r1 - r0) * t, i))); } return out; };
        const a = run.map(i => screen[j][i]).concat([screen[j][run[run.length - 1] + 1]]);
        const b = run.map(i => screen[j + 1][i]).concat([screen[j + 1][run[run.length - 1] + 1]]);
        const right = gen(run[run.length - 1] + 1, 0, 1), left = gen(run[0], 1, 0);
        let svg = `<polygon points="${fmt([...a, ...right, ...b.reverse(), ...left])}" fill="${sec[i0].fill}"${seal ? ` stroke="${sec[i0].fill}" stroke-width=".5" stroke-linejoin="round"` : ''}${window.LATHE_DEBUG ? ` data-band="${j}" data-mat="${profile[j][2] || 'body'}" data-h="${profile[j][0]},${profile[j + 1][0]}" data-r="${profile[j][1]},${profile[j + 1][1]}"` : ''}/>`;
        // lines: generators where the band turns from seen to unseen; rings where the profile turns or the next band
        // is not seen there (or there is none)
        let d = '';
        const first = run[0], last = run[run.length - 1], after = (last + 1) % N;
        const genLine = i => 'M' + fmt([screen[j][i], ...gen(i, 0, 1), screen[j + 1][i]]).split(' ').join('L');
        let dg = '';
        const gens = !noGenerators.includes(profile[j][2] || 'body');
        if (gens && !sec[(first - 1 + N) % N].vis) dg += genLine(first);
        if (gens && !sec[after].vis) dg += genLine(last + 1);
        if (window.LATHE_DEBUG) { if (dg) svg += `<path d="${dg}" stroke="#e00" fill="none" stroke-width="${width}"/>`; } else d += dg;
        for (const [side, nb] of [[j, j - 1], [j + 1, j + 1]]) {
          if (profile[side][1] === 0 || open.includes(side)) continue;
          let path = [];
          const flush = () => { if (path.length > 1) d += 'M' + fmt(path).split(' ').join('L'); path = []; };
          for (const i of run) {
            const other = bands[nb]?.sec[i];
            const edge = !other || !other.vis || dot(other.n, sec[i].n) < CREASE || (matEdges && (profile[nb][2] || 'body') !== (profile[j][2] || 'body') && (matEdges === true || matEdges.includes(profile[nb][2] || 'body') || matEdges.includes(profile[j][2] || 'body')));
            if (edge) { if (!path.length) path.push(screen[side][i]); path.push(screen[side][i + 1]); } else flush();
          }
          flush();
        }
        if (d) svg += window.LATHE_DEBUG ? `<path d="${d}" stroke="#00e" fill="none" stroke-width="${width}"/>` : `<path d="${d}" ${INK} stroke-width="${width}"/>`;
        const pts3 = run.flatMap(i => [rings[j][i], rings[j + 1][i]]);
        const depth = pts3.reduce((s, p) => s + Math.hypot(p[0], p[1], p[2]), 0) / pts3.length;
        items.push({ depth, svg, mat: profile[j][2] || 'body', near: sec[i0].near });
      }
    }
    if (cut) {
      const { h0, h1, i0, i1, rIn, rOut } = cut, mat = mats[cut.mat || 'body'];
      const span = []; for (let i = i0; i !== i1; i = (i + 1) % N) span.push(i);
      const tangent = i => { const a = 2 * Math.PI * i / N; return norm([-Math.sin(a) * U[0] + Math.cos(a) * V[0], -Math.sin(a) * U[1] + Math.cos(a) * V[1], -Math.sin(a) * U[2] + Math.cos(a) * V[2]]); };
      const faces = [
        { P: [pt(h0, rIn, i0), pt(h0, rOut, i0), pt(h1, rOut, i0), pt(h1, rIn, i0)], n: tangent(i0) },
        { P: [pt(h0, rIn, i1), pt(h0, rOut, i1), pt(h1, rOut, i1), pt(h1, rIn, i1)], n: tangent(i1).map(x => -x) },
        { P: [...span.map(i => pt(h0, rOut, i)), pt(h0, rOut, i1), pt(h0, rIn, i1), ...span.slice().reverse().map(i => pt(h0, rIn, i))], n: Au },
        { P: [...span.map(i => pt(h1, rOut, i)), pt(h1, rOut, i1), pt(h1, rIn, i1), ...span.slice().reverse().map(i => pt(h1, rIn, i))], n: Au.map(x => -x) },
      ];
      for (const f of faces) {
        const c = f.P.reduce((a, p) => [a[0] + p[0] / f.P.length, a[1] + p[1] / f.P.length, a[2] + p[2] / f.P.length], [0, 0, 0]);
        if (dot(f.n, c) >= 0) continue;
        const sp = f.P.map(project);
        items.push({ mat: 'cut', depth: f.P.reduce((s, p) => s + Math.hypot(p[0], p[1], p[2]), 0) / f.P.length, svg: `<polygon points="${fmt(sp)}" fill="${tone(f.n, mat)}"/><path d="M${fmt(sp).split(' ').join('L')}Z" ${INK} stroke-width="${width}"/>` });
      }
    }
    return items;
  }
  const compose = (...lists) => lists.flat().sort((a, b) => b.depth - a.depth).map(x => x.svg).join('');
  window.lathe = { lathe, compose };
})();
