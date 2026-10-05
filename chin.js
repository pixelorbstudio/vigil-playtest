/* chin.js — what the monitor's chin carries besides the drawing's own lines (Arnold, 2026-10-03, round 2): the cartridge slot
   as a dark mouth in a recessed surround with a lip, the plate above the knobs as the shift clock's readout, and the power
   LED moved beside the power knob. Pure: shapes in the chin's own coordinates (scene.svg's chin-details svg, about a
   pixel a unit), each through the bilinear map of the drawn plate it belongs to, so it leans with the lens exactly as that
   plate does. app.js draws them; audit-chin.js checks them.
   Every straight run is sampled every 0.25 units through its map (a leaning edge stays exact). */
(function () {
  // the drawing's plates, corners tl, tr, br, bl (a119_Vector_2: the slot's plate; a119_Vector_3: its opening, the
  // cartridge's end, which the cartridge is drawn through; a119_Vector: the plate above the knobs)
  const PLATE_SLOT = [[4.92499, 65.7021], [70.235, 67.2321], [66.565, 111.312], [0.625002, 109.272]];
  const OPEN_SLOT = [[17.2556, 78.7021], [55.1856, 79.6721], [53.5956, 98.0021], [15.5156, 96.9021]];
  const PLATE_CLOCK = [[707.256, 1.76001], [812.716, .750001], [817.786, 46.22], [711.086, 48]];
  const bilinear = ([tl, tr, br, bl]) => ([s, t]) => [0, 1].map(i => (1 - t) * ((1 - s) * tl[i] + s * tr[i]) + t * ((1 - s) * bl[i] + s * br[i]));
  const STEP = .25;
  const runST = (map, a, b) => { const A = map(a), B = map(b), n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / STEP)); return Array.from({ length: n }, (_, k) => map([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])); };
  const ring = (map, q) => q.flatMap((p, i) => runST(map, p, q[(i + 1) % q.length]));
  // a point in the map's (s, t), found by Newton's method
  function invert(map, p) {
    let s = .5, t = .5;
    for (let i = 0; i < 40; i++) {
      const q = map([s, t]), e = 1e-5, qs = map([s + e, t]), qt = map([s, t + e]);
      const a = (qs[0] - q[0]) / e, b = (qt[0] - q[0]) / e, c = (qs[1] - q[1]) / e, d = (qt[1] - q[1]) / e, det = a * d - b * c, dx = p[0] - q[0], dy = p[1] - q[1];
      s += (d * dx - b * dy) / det; t += (-c * dx + a * dy) / det;
    }
    return [s, t];
  }
  const span = (map, a, b) => Math.hypot(...[0, 1].map(i => map(b)[i] - map(a)[i]));

  // ---- the slot: the plate grows into a recessed surround twice as wide as tall (104 x 52: the room the LED left), a
  // raised lip 6 px wide round the opening, and the opening a dark mouth with a lighter lower lip inside its bottom edge
  const slotMap = bilinear(PLATE_SLOT), openST = OPEN_SLOT.map(p => invert(slotMap, p));
  const PW = span(slotMap, [0, .5], [1, .5]), PH = span(slotMap, [.5, 0], [.5, 1]);
  const SLOT = { w: 104, h: 52, lip: 6.1 };   // (6 chin units are 5.99 px)
  function slot() {
    const sC = openST.reduce((a, p) => a + p[0], 0) / 4, tC = openST.reduce((a, p) => a + p[1], 0) / 4;
    const W = SLOT.w / PW, H = SLOT.h / PH, ds = SLOT.lip / PW, dt = SLOT.lip / PH, o = openST;
    const surround = [[sC - W / 2, tC - H / 2], [sC + W / 2, tC - H / 2], [sC + W / 2, tC + H / 2], [sC - W / 2, tC + H / 2]];
    const lip = [[o[0][0] - ds, o[0][1] - dt], [o[1][0] + ds, o[1][1] - dt], [o[2][0] + ds, o[2][1] + dt], [o[3][0] - ds, o[3][1] + dt]];
    const lipLine = runST(slotMap, [o[3][0] + 4 / PW, o[3][1] - 3 / PH], [o[2][0] - 4 / PW, o[2][1] - 3 / PH]);
    return { surround: ring(slotMap, surround), lip: ring(slotMap, lip), mouth: ring(slotMap, o), lipLine,
      corners: { surround: surround.map(slotMap), lip: lip.map(slotMap), mouth: o.map(slotMap) } };
  }

  // ---- the clock: a window inset 7 px in the plate, and in it the time in four seven-segment digits and a colon, only
  // the lit segments (the unlit ones an old LCD shows made 02:14 read 02:1H at 1:1)
  const clockMap = bilinear(PLATE_CLOCK);
  const CW = span(clockMap, [0, .5], [1, .5]), CH = span(clockMap, [.5, 0], [.5, 1]);
  const inPlate = ([x, y]) => clockMap([x / CW, y / CH]);
  const polyPx = pts => pts.flatMap((a, i) => { const b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP)); return Array.from({ length: n }, (_, k) => inPlate([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])); });
  const DIGITS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  // (20 tall in a window inset 6.6: the digits 6 px or more from its line, the window 6 px or more from the plate's)
  const DIGIT = { w: 12, h: 20, t: 2.8, gap: 7, colon: 10, joint: .6, inset: [9, 6.6] };
  function digit(x, y, on) {
    const { w, h, t, joint: g } = DIGIT, m = h / 2;
    const hs = (x0, x1, yc) => [[x0 + t / 2 + g, yc], [x0 + t + g, yc - t / 2], [x1 - t - g, yc - t / 2], [x1 - t / 2 - g, yc], [x1 - t - g, yc + t / 2], [x0 + t + g, yc + t / 2]];
    const vs = (xc, y0, y1) => [[xc, y0 + t / 2 + g], [xc + t / 2, y0 + t + g], [xc + t / 2, y1 - t - g], [xc, y1 - t / 2 - g], [xc - t / 2, y1 - t - g], [xc - t / 2, y0 + t + g]];
    const segs = { a: hs(x, x + w, y + t / 2), g: hs(x, x + w, y + m), d: hs(x, x + w, y + h - t / 2),
      f: vs(x + t / 2, y, y + m), b: vs(x + w - t / 2, y, y + m), e: vs(x + t / 2, y + m, y + h), c: vs(x + w - t / 2, y + m, y + h) };
    return [...on].map(k => polyPx(segs[k]));
  }
  // text: "HH:MM"
  function clock(text) {
    const { w, h, gap, colon, inset } = DIGIT, chars = text.replace(':', '');
    const win = polyPx([[inset[0], inset[1]], [CW - inset[0], inset[1]], [CW - inset[0], CH - inset[1]], [inset[0], CH - inset[1]]]);
    let x = (CW - (4 * w + 2 * gap + colon)) / 2 - 1; const y = (CH - h) / 2, segs = [];
    for (let i = 0; i < 4; i++) {
      segs.push(...digit(x, y, DIGITS[chars[i]] || ''));
      x += w + (i === 1 ? 0 : gap);
      if (i === 1) { const cx = x + colon / 2; for (const cy of [y + h * .32, y + h * .68]) segs.push(polyPx([[cx - 1.4, cy - 1.4], [cx + 1.4, cy - 1.4], [cx + 1.4, cy + 1.4], [cx - 1.4, cy + 1.4]])); x += colon; }
    }
    return { window: win, segs };
  }

  // ---- the power LED (the bezel's a117_Vector_2, its own drawn shape) beside the power knob (a119_Vector_14), level with
  // its centre and as far from it as the power knob is from the brightness knob (a119_Vector_16): 22.5 px edge to edge.
  // In the stage's coordinates: the LED drawn at about (405.95, 719.2), 15.1 across; the knobs 1027.2..1064.5 and
  // 1087.0..1123.4 across, the power knob's centre at y 709.3.
  const LED = { from: [229.97 + 176.27 * 980.06 / 981.85, 114.17 + 605.11 * 658.56 / 658.61], r: 7.55, to: [1027.2 - (1087.0 - 1064.5) - 7.55, 709.3] };

  // ---- the knobs' engravings (approved by Arnold 2026-10-04 from the stills; app.js draws them). Cut into the
  // chin the way the knobs' own pointers are drawn (their grey, #BDBDBB, 1.2 px, round ends): a power symbol by the power
  // knob, beside the LED; round the brightness knob a scale of short ticks between a moon at its low end and a sun at its high
  // end. Everything is laid out flat in the chin's plane, the clock plate's map carried on down the chin (the plate sits
  // right over the knobs), so it leans and bends as the plate does. The brightness knob turns 270 degrees (-135 to 135,
  // app.js setBrightness, the dead zone straight down), so the scale runs over the top from 7:30 to 4:30, and each tick
  // sits exactly where the pointer points at its value: the pointer is turned on the screen, not in the plane, so each
  // tick's direction in the plane is found from the pointer's.
  const fromStage = ([x, y]) => [(x - 308.88) * 818.536 / 817.20, (y - 616.90) * 117.113 / 117.14];
  const toPlane = p => { const [s, t] = invert(clockMap, p); return [s * CW, t * CH]; };
  const arcPts = (c, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / (STEP / 2))); return Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; }); };
  const lineUV = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (STEP / 2))); return Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); };
  const KNOB_POWER = { c: [738.5, 92.5] }, KNOB_BRIGHT = { c: [797.5, 91.5], tip: [796.445, 77.1534] };   // (app.js's rotation centres)
  const MARKS = { ticks: 11, tickIn: 27, tickOut: 31, moonAt: 31, sunAt: 32.5, power: { r: 4.6, gap: 45, top: -6.6, foot: -.9 },
    moon: { r: 4.6, bite: 4.0, off: [1.9, -1.5] }, sun: { r: 2.3, rayIn: 4.1, rayOut: 6.1, rays: 8 }, colour: '#BDBDBB', width: 1.2 };
  function knobMarks({ powerAt = 'left' } = {}) {
    const P = p => inPlate(p), strokes = [], fills = [], M = MARKS;
    // the brightness scale: the pointer's direction at each value, turned on the screen as app.js turns it
    const C = KNOB_BRIGHT.c, d0 = [KNOB_BRIGHT.tip[0] - C[0], KNOB_BRIGHT.tip[1] - C[1]], l0 = Math.hypot(...d0), Cp = toPlane(C);
    const dirAt = v => { const a = (-135 + 270 * v) * Math.PI / 180, d = [d0[0] / l0, d0[1] / l0], q = [C[0] + 27 * (d[0] * Math.cos(a) - d[1] * Math.sin(a)), C[1] + 27 * (d[0] * Math.sin(a) + d[1] * Math.cos(a))], qp = toPlane(q); return Math.atan2(qp[1] - Cp[1], qp[0] - Cp[0]); };
    const ray = (a, r) => [Cp[0] + r * Math.cos(a), Cp[1] + r * Math.sin(a)];
    const ticks = [];
    // (the moon and the sun are the scale's two end marks: the pointer at off points at the moon, at full at the sun)
    for (let i = 1; i < M.ticks - 1; i++) { const a = dirAt(i / (M.ticks - 1)); const t = lineUV(ray(a, M.tickIn), ray(a, M.tickOut)).map(P); ticks.push(t); strokes.push(t); }
    // the moon: a disc with a bite out of its upper right, a flat fill; its two tips are real corners
    const mc = ray(dirAt(0), M.moonAt), { r: R1, bite: R2, off } = M.moon, c2 = [mc[0] + off[0], mc[1] + off[1]];
    const d = Math.hypot(off[0], off[1]), a = (R1 * R1 - R2 * R2 + d * d) / (2 * d), h = Math.sqrt(R1 * R1 - a * a), ux = off[0] / d, uy = off[1] / d;
    const cusp = [[mc[0] + a * ux - h * uy, mc[1] + a * uy + h * ux], [mc[0] + a * ux + h * uy, mc[1] + a * uy - h * ux]];
    const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    let o0 = ang(mc, cusp[0]), o1 = ang(mc, cusp[1]); const away = Math.atan2(-off[1], -off[0]);
    // the outer arc goes the long way, through the side away from the bite
    const norm = x => Math.atan2(Math.sin(x), Math.cos(x));
    if (Math.abs(norm((o0 + o1) / 2 - away)) > Math.PI / 2) o1 += o1 > o0 ? -2 * Math.PI : 2 * Math.PI;
    let i1 = ang(c2, cusp[1]), i0 = ang(c2, cusp[0]); const toward = Math.atan2(-off[1], -off[0]);
    if (Math.abs(norm((i0 + i1) / 2 - toward)) > Math.PI / 2) i0 += i0 > i1 ? -2 * Math.PI : 2 * Math.PI;
    const moon = [...arcPts(mc, R1, o0, o1), ...arcPts(c2, R2, i1, i0).slice(1, -1)].map(P);
    fills.push(moon);
    // the sun: a disc and eight short rays
    const sc = ray(dirAt(1), M.sunAt), sun = arcPts(sc, M.sun.r, 0, 2 * Math.PI).slice(0, -1).map(P), rays = [];
    fills.push(sun);
    for (let k = 0; k < M.sun.rays; k++) { const t = k * 2 * Math.PI / M.sun.rays - Math.PI / 2, r = lineUV([sc[0] + M.sun.rayIn * Math.cos(t), sc[1] + M.sun.rayIn * Math.sin(t)], [sc[0] + M.sun.rayOut * Math.cos(t), sc[1] + M.sun.rayOut * Math.sin(t)]).map(P); rays.push(r); strokes.push(r); }
    // the power symbol: a ring broken at its top and a bar down into the break, upright in the plane
    const led = fromStage(LED.to), ledP = toPlane(led), ledR = LED.r, pw = M.power;
    const pc = powerAt === 'above' ? [ledP[0], ledP[1] - ledR - 7 - pw.r - 1] : [ledP[0] - ledR - 7 - pw.r, ledP[1]];
    const g = pw.gap * Math.PI / 180, ringP = arcPts(pc, pw.r, -Math.PI / 2 + g, 3 * Math.PI / 2 - g).map(P), bar = lineUV([pc[0], pc[1] + pw.top], [pc[0], pc[1] + pw.foot]).map(P);
    strokes.push(ringP, bar);
    return { strokes, fills, ticks, moon, sun, rays, power: { ring: ringP, bar }, centres: { moon: P(mc), sun: P(sc), power: P(pc), bright: C } };
  }

  const COLOURS = { surround: '#E2E2E0', lip: '#ECECEA', mouth: '#B4B4B4', lipLine: '#D2D2D0', window: '#E2E2E0', digit: '#5F6A5F' };
  const api = { PLATE_SLOT, OPEN_SLOT, PLATE_CLOCK, SLOT, DIGIT, LED, COLOURS, MARKS, slot, clock, bilinear, knobMarks, fromStage };
  if (typeof window !== 'undefined') window.chin = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
