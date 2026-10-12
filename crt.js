/* crt.js — draws the terminal on the tube: the text, the cursor, the status line, and the glass's barrel.

   The terminal used to be HTML bent by an SVG displacement filter. That filter moves pixels by whole pixels
   with no smoothing, so where the bend crossed a pixel boundary a row of text was cut and stepped: staggered,
   jagged text. Here the text is drawn flat into an offscreen canvas, then bent onto the visible one in two
   smooth resampling passes: each column is stretched to meet the glass's curved top and bottom edges, then each
   row is stretched to meet its curved sides. The browser interpolates between pixels, so the curve is smooth.

   Layout is the old terminal's, in its 660x413 design units (the canvases are twice that, for sharpness):
   19px monospace, 1.32 line height, 30px side padding, the first row 52px down (under the status line), the
   top and bottom faded out. Colours come from the terminal element's CSS variables, so themes still work. */
(function () {
  const W = 660, H = 413, K0 = 2;                      // design size, and the canvas scale (setK changes it per tube)
  const PAD_X = 30, TOP = 52, BOTTOM = 22, FONT = 19, LH = FONT * 1.32;
  const FAMILY = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const CLS = {                                        // the old #term-out classes, as colour and alpha
    dim: { color: 'var(--term-dim)' }, ok: { color: '#b8f0c2' }, alert: { color: '#ffd28a' },
    mx0: { color: '#f2fff4', glow: '#d8ffe0' }, mx1: { color: '#b6ffc4' }, mx2: { color: '#b6ffc4', alpha: .55 }, mx3: { color: '#b6ffc4', alpha: .25 },
    mxmsg: { color: '#ffffff', bg: 'rgba(8, 20, 40, .85)', glow: '#ffffff' },
    'dg-cur': { color: '#22308f', bg: 'var(--term-text)', glow: 'none' }, 'dg-held': { alpha: .3 },
    // DEFRAG: each file its own shade and tint; a whole file in the ok green; a block the unit just moved, flashing
    df0: { color: '#e9edff' }, df1: { color: '#8fd3ff' }, df2: { color: '#f5b3e6' }, df3: { color: '#c7b8ff' },
    dfok: { color: '#b8f0c2', glow: '#b8f0c2' }, dfw: { color: '#ffffff', glow: '#ffffff' },
    // the night supervisor: a tag in inverse red, and their words in red; nothing else on the tube is red
    'sup-tag': { color: '#22308f', bg: '#ff9d9d', glow: 'none' }, sup: { color: '#ffb4b4', glow: '#ff7a7a' }, 'sup-dim': { color: '#ffb4b4', glow: '#ff7a7a', alpha: .38 }, 'sup-time': { color: '#ffb4b4', glow: '#ff7a7a', alpha: .62 },
    // Vigil, the company (2026-10-12, the playtest: its lines were lost among the commands): a system broadcast, an inverse bar
    // across the tube, the glass's blue on a band of the bright phosphor; a message on several rows is one band
    vigil: { color: '#22308f', bg: 'var(--term-text)', glow: 'none', bar: true }, 'vigil-dim': { color: '#22308f', bg: 'var(--term-text)', glow: 'none', bar: true, soft: .78 },
    'rs-won': { color: '#22308f', bg: '#b8f0c2', glow: 'none' }, 'rs-lost': { color: '#22308f', bg: '#ffd28a', glow: 'none' },
    // the kinds of trouble, in the tube's own tones and never red (red is the supervisor's and the strikes'): DOWN the
    // phosphor at its brightest, HOT amber (as its LED), STUCK violet, LOSS cyan
    pdown: { color: '#ffffff', glow: '#ffffff' }, phot: { color: '#ffd28a' }, pstuck: { color: '#c7b8ff' }, ploss: { color: '#8fd3ff' },
    // OOM pink (2026-10-11: DEFRAG's second file's tint, the one tube tone left that isn't red, green or taken)
    poom: { color: '#f5b3e6' },
    // INTRUSION (2026-10-12, step 9): PROBED in the phosphor itself, its word blinking in threes as the LED does (probed())
    pprobed: { color: 'var(--term-text)' },
    // DEFRAG's 2019 file on night 2: grey, not yours (the cooled silhouette's grey, a little dim)
    df2019: { color: '#9ea3b8', alpha: .85 },
  };
  // the LED's bursts of three, as a word's alpha: three quick blinks, then a rest (1.6 s round), for PROBED on the strip
  const probed = (t = performance.now()) => { const u = t % 1600; return u < 600 && (u % 200) < 110 ? 1 : .35; };

  window.createCRT = function ({ canvas, host, warp: warp0 }) {
    // K: canvas pixels a design unit. 2 as the tube is seen from the chair; more while it is seen larger (the start's close-up
    // and the camera pulling back from it: setK), so the text is never a bitmap scaled up. The glass's bend tables (warp0) are
    // given at 2; at any other K they are resampled.
    let K = K0, warp = warp0;
    canvas.width = W * K; canvas.height = H * K;
    const out = canvas.getContext('2d');
    const flat = document.createElement('canvas'), mid = document.createElement('canvas');
    flat.width = mid.width = W * K; flat.height = mid.height = H * K;
    const f = flat.getContext('2d'), m = mid.getContext('2d');
    f.setTransform(K, 0, 0, K, 0, 0);
    f.font = `${FONT}px ${FAMILY}`; f.textBaseline = 'middle';
    const CW = f.measureText('M').width;               // one monospace cell
    const COLS = Math.floor((W - 2 * PAD_X) / CW), ROWS = Math.floor((H - TOP - BOTTOM) / LH);
    // Glenn's pane (design.md section 5, "Surface and focus, decided", 5, with Arnold's two changes of 2026-10-10): n rows
    // of his under the problem strip (3, or 1 folded), a hair rule, and the work under it. GAP: the rule's room, so the
    // work's first row doesn't touch it. ICON: the columns his silhouette takes on the left (3 rows only).
    const PANE = { GAP: { 3: 6, 1: 4 }, ICON: 5 };
    const workTop = n => n ? TOP + n * LH + PANE.GAP[n] : TOP;
    // the rows the work has under n rows of pane: at the prompt (the old bottom margin), and for a full view's frame (to
    // the glass's bottom, as frames always drew one row more than the shell)
    const layout = n => ({ top: workTop(n), rows: Math.floor((H - BOTTOM - workTop(n)) / LH), frameRows: Math.floor((H - 4 - workTop(n)) / LH),
      cols: n === 3 ? COLS - PANE.ICON : COLS });
    // where a box of rows (the menu's) sits: its left and top (design units), centred on the whole glass, never above the
    // first row (TOP); not snapped to the text's columns, whose spare room is all on the right. BW: its width in cells. The
    // page's clicks on it go through the same
    const boxAt = box => {
      const BW = box[0].reduce((n, s) => n + [...s.text].length, 0);
      return { x0: Math.max(PAD_X, (W - BW * CW) / 2), y0: Math.max(TOP, (H - box.length * LH) / 2), BW };
    };
    const css = () => { const s = getComputedStyle(host); return { text: s.getPropertyValue('--term-text').trim() || '#e9edff', dim: s.getPropertyValue('--term-dim').trim() || '#aab4ee', glow: s.getPropertyValue('--term-glow').trim() || 'rgba(200,210,255,.45)' }; };
    const resolve = (c, pal) => c === 'var(--term-dim)' ? pal.dim : c === 'var(--term-text)' ? pal.text : c;

    /* view: { rows: [[{ text, cls }]], cursor: { row, col } | null, cursorOn, status: { energy, beans, low } | null,
       field: a square grid drawn over the text | null (see drawField) } */
    let OFF = TOP;                                       // the work's first row's top (under the pane), this paint
    // A paint the same as the last is left out (the play's live audit, 2026-10-12: the tube was painted about 35 times a
    // second, 3.3 ms each, most of them the status line again with the energy a hair lower than the gauge can show). The view
    // is compared whole, as text, with the energy as the status line draws it: its percentage, and the gauge's fill in whole
    // canvas pixels (drawStatus snaps it there). Two things in a paint go by the clock, and their state now is part of the
    // comparison: PROBED's blink on the strip (probed()) and the FIREWALL scope's needle flickering in a jolt.
    let lastKey = null, cellPx = 0, cellK = 0;
    const keyOf = (view, pal) => {
      if (cellK !== K) { f.font = `15px ${FAMILY}`; cellPx = Math.round(f.measureText('M').width * K); cellK = K; }
      try {
        const clock = (view.status?.problems?.some(p => p.kind === 'INTRUSION' && !p.fixing) ? probed() : '') + '|' + (view.field?.scope && view.field.state === 'jolt' ? Math.floor(performance.now() / 70) % 2 : '');
        return K + '|' + pal.text + '|' + pal.dim + '|' + pal.glow + '|' + clock + '|' + JSON.stringify(view, function (k, v) {
          return k === 'energy' && this === view.status && typeof v === 'number' ? Math.round(v * 100) + ':' + Math.round(Math.max(0, Math.min(1, v)) * 12 * cellPx) : v;
        });
      } catch (e) { return null; }
    };
    function paint(view) {
      const pal = css();
      const key = keyOf(view, pal);
      if (key !== null && key === lastKey) return;
      lastKey = key;
      f.clearRect(0, 0, W, H);
      f.font = `${FONT}px ${FAMILY}`; f.textBaseline = 'middle';
      // burn-in: a prompt left on the tube for years, worn into the phosphor; it shows only with the brightness
      // turned down (view.burn, 0..1). In the status line's row, left of it, where nothing else is ever drawn (on the
      // bottom row, where a burned prompt would really be, today's prompt sat on top of it)
      if (view.burn > 0) {
        f.globalAlpha = .75 * view.burn; f.fillStyle = pal.dim; f.shadowBlur = 0;
        f.fillText(view.burnText || '', PAD_X, 22);
        f.globalAlpha = 1;
      }
      const top = view.pane ? workTop(view.pane.n) : TOP;
      OFF = top;
      const drawRow = (segs, y, x0 = PAD_X) => {
        let col = 0;
        // a Vigil row: its band first, the tube's width; a message's own rows meet (segs.cont: not its first row), and two
        // messages one under the other keep a hairline of the glass between them
        const bar = segs.find(s => s.text && String(s.cls || '').split(' ').some(c => CLS[c]?.bar));
        if (bar) { const st = CLS[String(bar.cls).split(' ').find(c => CLS[c]?.bar)], gap = segs.cont ? 0 : 2; f.globalAlpha = 1; f.shadowBlur = 0; f.fillStyle = resolve(st.bg, pal); f.fillRect(x0 - CW * .6, y - LH / 2 + gap, W - 2 * PAD_X + CW * 1.2, LH - gap); }
        for (const s of segs) {
          if (!s.text) continue;
          const st = Object.assign({}, ...String(s.cls || '').split(' ').map(c => CLS[c] || {})), x = x0 + col * CW;
          f.globalAlpha = st.alpha ?? 1;
          if (st.bar) f.globalAlpha = st.soft ?? 1;
          if (st.bg && !st.bar) { f.shadowBlur = 0; f.fillStyle = resolve(st.bg, pal); f.fillRect(x, y - LH / 2 + 1, s.text.length * CW, LH - 2); }
          f.fillStyle = resolve(st.color, pal) || pal.text;
          f.shadowColor = st.glow === 'none' ? 'transparent' : st.glow || pal.glow; f.shadowBlur = st.glow === 'none' ? 0 : 6 * K;
          f.fillText(s.text, x, y);
          col += [...s.text].length;
        }
      };
      view.rows.forEach((segs, r) => drawRow(segs, top + r * LH + LH / 2));
      f.globalAlpha = 1;
      // hair rules between rows (Glenn's log: between his messages), at the top of each listed row, the pane's rule's ink
      if (view.rules) { f.shadowBlur = 0; f.globalAlpha = .3; f.fillStyle = pal.dim; for (const r of view.rules) f.fillRect(PAD_X, Math.round(top + r * LH) - .5, W - 2 * PAD_X, 1); f.globalAlpha = 1; }
      if (view.field) view.field.pong ? drawPong(view.field, pal) : view.field.scope ? drawScope(view.field, pal) : drawField(view.field, pal);
      titleHits = view.title ? drawCloseUp(view.title, pal) : [];
      if (view.cursor && view.cursorOn) {
        const x = PAD_X + view.cursor.col * CW, y = top + view.cursor.row * LH + LH / 2;
        f.shadowColor = pal.glow; f.shadowBlur = 6 * K; f.fillStyle = pal.text;
        f.fillRect(x, y - FONT * .55, FONT * .62, FONT * 1.05);
      }
      // rows never start above the first line, so only the bottom edge needs the old fade
      f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'destination-out'; f.shadowBlur = 0;
      const fade = f.createLinearGradient(0, (H - 10) * K, 0, H * K);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      f.fillStyle = fade; f.fillRect(0, (H - 10) * K, W * K, 10 * K);
      f.restore();
      if (view.pane) drawPane(view.pane, pal);
      if (view.status) drawStatus(view.status, pal);
      // the menu's box (tubeMenu), over everything under the status line, Glenn's pane too: centred on the whole tube, not on
      // the work's rows (under the open pane they start three rows down, and the box ran off the glass's bottom); its cells
      // are cleared first, so nothing under it shows through
      if (view.box) {
        const { x0, y0, BW } = boxAt(view.box);
        f.globalAlpha = 1; f.clearRect(x0, y0, BW * CW, view.box.length * LH);
        view.box.forEach((segs, r) => drawRow(segs, y0 + r * LH + LH / 2, x0));
        f.globalAlpha = 1;
      }
      bend();
    }
    // the status line: "energy", a gauge, the percentage, a bean and the bean count, right-aligned at the top; and,
    // only once the supervisor has given one, a red X for each strike at its left.
    // The gauge is the terminal's own block bar (twelve cells, full and shaded), but drawn on the character grid
    // rather than typed: the block characters left seams between cells, dithered the empty ones, and stood taller
    // than the letters, off their centre. Here each cell is exactly one character wide, the cells join, and the
    // bar is as tall as the capitals and centred on the line. It sits a little lower than before so the glass's
    // curve, which lifts the top of the screen, does not press it against the bezel.
    // where the envelope was last drawn (design units), for the page's click
    let mailHit = null;
    // beansLit: the bean and its count bright for a moment, the one blink when beans come in
    // problems: every open problem, live, on a thin strip under the status line (Eugene's playtest, 2026-10-02), left to
    // right in the order they came: "L47 DOWN · L20 HOT", each kind in its tone, one being fixed dim. Null: not drawn.
    // The fix feel (design.md section 5, "Surface and focus, decided", 23; 2026-10-11): a unit just back shows "L47 ok" in
    // the ok green for a moment ({ unit, ok: true }), and the board cleared says "all units nominal" in the bright tone
    // (strip.lit) before it dims; strip.note is a word from the system, dim, after the rest ("tab fills them.", once)
    function drawProblems(list, pal, strip = {}) {
      const PF = 13, y = 41;
      f.font = `${PF}px ${FAMILY}`; f.shadowColor = pal.glow; f.shadowBlur = 5 * K;
      let x = PAD_X;
      const put = (t, color) => { f.fillStyle = color; f.fillText(t, x, y); x += f.measureText(t).width; };
      const oks = list.filter(p => p.ok); list = list.filter(p => !p.ok);
      oks.forEach((p, i) => { if (i) put('  ·  ', pal.dim); f.shadowColor = CLS.ok.color; put(p.unit + ' ok', CLS.ok.color); f.shadowColor = pal.glow; });
      if (oks.length && list.length) put('  ·  ', pal.dim);
      if (!list.length && !oks.length) { if (strip.lit) { f.shadowColor = '#d8ffe0'; f.shadowBlur = 9 * K; put('all units nominal', '#d8ffe0'); f.shadowColor = pal.glow; f.shadowBlur = 5 * K; } else put('all units nominal', pal.dim); }
      // a rack dropping packets says what is wrong and what fixes it, in a few words (Eugene's second playtest, 2026-10-05:
      // LOSS alone left him stuck); short if the strip would run past the tube's edge. A unit in pieces the same way (the
      // cold playtest's dry run, 2026-10-11: STUCK named nothing, and the first one struck at 90 minutes); and out of memory
      // (2026-10-11, step 8: "out of memory: HEAP cart, heap L33")
      // (INTRUSION: "probed", its cart and the command, as the others; 2026-10-12, step 9)
      const hint = (p, long) => p.fixing ? '' : p.kind === 'INTRUSION' ? (long ? `  under probe: FIREWALL cart, firewall ${p.unit}` : `  firewall ${p.unit}`)
        : p.kind === 'LOSS' ? (long ? `  dropping packets: ROUTE cart, route ${p.unit}` : `  route ${p.unit}`)
        : p.kind === 'STUCK' ? (long ? `  in pieces: DEFRAG cart, defrag ${p.unit}` : `  defrag ${p.unit}`)
        : p.kind === 'OOM' ? (long ? `  out of memory: HEAP cart, heap ${p.unit}` : `  heap ${p.unit}`) : '';
      // (what the strip calls each kind: INTRUSION doesn't fit, PROBED does; a unit with its time counting, as R17's on night 2
      // under the order to leave it down: "R17 DOWN 64m")
      const word = p => p.kind === 'INTRUSION' ? 'PROBED' : p.kind, count = p => p.count != null && !p.fixing ? ` ${p.count}m` : '';
      const width = long => list.reduce((s, p, i) => s + f.measureText((i ? '  ·  ' : '') + p.unit + ' ' + (p.fixing ? 'FIXING' : word(p)) + count(p) + hint(p, long)).width, 0);
      const long = width(true) <= W - 2 * PAD_X;
      list.forEach((p, i) => {
        if (i) put('  ·  ', pal.dim);
        put(p.unit + ' ', p.fixing ? pal.dim : pal.text);
        const st = CLS[{ DOWN: 'pdown', HOT: 'phot', STUCK: 'pstuck', LOSS: 'ploss', OOM: 'poom', INTRUSION: 'pprobed' }[p.kind]] || {};
        if (p.fixing) put('FIXING', pal.dim);
        else { f.shadowColor = st.glow || pal.glow; if (p.kind === 'INTRUSION') f.globalAlpha = probed(); put(word(p), resolve(st.color, pal) || pal.text); f.globalAlpha = 1; f.shadowColor = pal.glow; }
        if (count(p)) put(count(p), pal.dim);
        if (hint(p, long)) put(hint(p, long), pal.dim);
      });
      // (after the rest, if it fits before the tube's edge)
      if (strip.note) { const n = '   ' + strip.note; if (x + f.measureText(n).width <= W - PAD_X) put(n, pal.dim); }
      // a cartridge handed over, until it is taken out of the case (2026-10-12: an unlock went unnoticed)
      if (strip.carts?.length) { const n = `   new cart${strip.carts.length > 1 ? 's' : ''} in the drawer: ${strip.carts.join(', ')}`; if (x + f.measureText(n).width <= W - PAD_X) put(n, pal.dim); else { const m = '   new cart in the drawer.'; if (x + f.measureText(m).width <= W - PAD_X) put(m, pal.dim); } }
      // a canister waiting in the receiver, until it is collected (the dry run: a stranger looked at the ceiling for it)
      if (strip.tube) { const n = '   something in the tube.'; if (x + f.measureText(n).width <= W - PAD_X) put(n, pal.dim); }
    }
    // spurts: energy that just moved, [{ a, b, age }] (from a to b, age 0..1): drawn over the gauge where it moved, green
    // in, red out (the tube's ok green and the supervisor's red, the only colours it has besides the phosphor)
    function drawStatus({ energy, beans, low, strikes = 0, mail = null, beansLit = false, problems = null, strip = {}, spurts = [] }, pal) {
      if (problems) drawProblems(problems, pal, strip);
      const SF = 15, y = 22;                            // font size and the line's centre, in design units
      f.font = `${SF}px ${FAMILY}`;
      const w = t => f.measureText(t).width;
      // the percentage keeps three digits' room, so the line does not shift as it counts down
      const label = 'energy', pct = String(Math.round(energy * 100)).padStart(3) + '%', count = String(beans);
      const CELLS = 12, cw = Math.round(w('M') * K) / K, GAUGE = CELLS * cw, BEAN = 10, GAP = 9;
      const XS = strikes ? strikes * (w('M') + 4) - 4 + GAP * 3 : 0;   // the X's are a capital wide, 4 apart
      // the mail: an envelope drawn in the phosphor, first on the line; unread mail puts its count beside it, bright.
      // (Arnold, 2026-09-30: a way to see new mail at a glance, and to open it with the mouse.)
      const ENV = 17, unread = mail ? mail.unread : 0, mcount = unread ? String(unread) : '';
      const MS = mail ? ENV + (mcount ? 5 + w(mcount) : 0) + GAP * 3 : 0;
      const total = MS + XS + w(label) + GAP + GAUGE + GAP + w(pct) + GAP * 2 + BEAN + 5 + w(count);
      let x = W - PAD_X - total;
      const ink = low ? '#ffd28a' : pal.text;
      f.shadowColor = pal.glow; f.shadowBlur = 6 * K;
      // the gauge and the X's: their top and bottom are the capitals' own, measured, snapped to the canvas's pixels
      const cap = f.measureText('M'), snap = v => Math.round(v * K) / K;
      const gy = snap(y - cap.actualBoundingBoxAscent), ch = snap(y + cap.actualBoundingBoxDescent) - gy;
      mailHit = null;
      if (mail) {
        const top = gy + .5, h = ch - 1, bright = unread > 0;
        // (mail.pulse, 1..0..1: three or more unread, the envelope and its count breathe down to a third and back)
        const breath = mail.pulse == null ? 1 : .35 + .65 * mail.pulse;
        f.save(); f.strokeStyle = bright ? pal.text : pal.dim; f.lineWidth = 1.5; f.lineJoin = 'round'; f.lineCap = 'round';
        f.globalAlpha = (bright ? 1 : .8) * breath;
        f.strokeRect(x + .75, top, ENV - 1.5, h);
        f.beginPath(); f.moveTo(x + 1.5, top + 1); f.lineTo(x + ENV / 2, top + h * .58); f.lineTo(x + ENV - 1.5, top + 1); f.stroke();
        f.restore();
        if (mcount) { f.save(); f.globalAlpha = breath; f.fillStyle = pal.text; f.fillText(mcount, x + ENV + 5, y); f.restore(); }
        mailHit = { x0: x - 10, x1: x + MS - GAP * 3 + 10, y0: gy - 10, y1: gy + ch + 10 };
        x += MS;
      }
      // strikes: an X each, drawn in the supervisor's red (the only other red on the tube is theirs)
      if (strikes) {
        const s = w('M');
        f.save(); f.strokeStyle = '#ffb4b4'; f.shadowColor = '#ff7a7a'; f.lineWidth = 2; f.lineCap = 'round';
        for (let i = 0; i < strikes; i++) {
          const x0 = x + i * (s + 4) + 1, x1 = x0 + s - 2;
          f.beginPath(); f.moveTo(x0, gy + 1); f.lineTo(x1, gy + ch - 1); f.moveTo(x1, gy + 1); f.lineTo(x0, gy + ch - 1); f.stroke();
        }
        f.restore();
        x += XS;
      }
      f.fillStyle = pal.dim; f.fillText(label, x, y); x += w(label) + GAP;
      // the gauge: the full part solid, the rest a light shade of the same ink, as tall as the capitals. It fills to the
      // energy itself, not to whole cells, so it visibly ticks down (Arnold, 2026-10-05: twelve cells moved once in 8%)
      x = snap(x);
      const fillW = snap(Math.max(0, Math.min(1, energy)) * GAUGE);
      f.fillStyle = ink; f.fillRect(x, gy, fillW, ch);
      f.globalAlpha = .28; f.fillRect(x + fillW, gy, GAUGE - fillW, ch); f.globalAlpha = 1;
      // the spurts: bright at once, then fading, over the stretch of the bar that moved (at least a pixel and a half)
      for (const s of spurts) {
        const lo = Math.max(0, Math.min(s.a, s.b)), hi = Math.min(1, Math.max(s.a, s.b)), gain = s.b > s.a;
        let x0 = x + lo * GAUGE, x1 = x + hi * GAUGE;
        if (x1 - x0 < 1.5) { const m = (x0 + x1) / 2; x0 = m - .75; x1 = m + .75; }
        f.save(); f.globalAlpha = Math.max(0, 1 - s.age * s.age);
        f.fillStyle = gain ? '#b8f0c2' : '#ffb4b4'; f.shadowColor = gain ? '#b8f0c2' : '#ff7a7a'; f.shadowBlur = 8 * K;
        f.fillRect(x0, gy - 1, x1 - x0, ch + 2); f.restore();
      }
      x += GAUGE + GAP;
      f.fillStyle = low ? ink : pal.dim; f.fillText(pct, x, y); x += w(pct) + GAP * 2;
      // the bean, in the phosphor, its crease cut out so the glass shows through; as tall as the capitals, on them
      const by = gy + ch / 2, bh = ch / 2 + .5;
      f.save(); f.fillStyle = beansLit ? pal.text : pal.dim; f.beginPath(); f.ellipse(x + BEAN / 2, by, BEAN * .4, bh, 0, 0, Math.PI * 2); f.fill();
      f.globalCompositeOperation = 'destination-out'; f.shadowBlur = 0; f.lineWidth = 1.3; f.lineCap = 'round';
      f.beginPath(); f.moveTo(x + BEAN * .56, by - bh * .9); f.bezierCurveTo(x + BEAN * .3, by - bh * .4, x + BEAN * .72, by + bh * .4, x + BEAN * .44, by + bh * .92); f.stroke();
      f.restore();
      f.fillStyle = beansLit ? pal.text : pal.dim; f.fillText(count, x + BEAN + 5, y);
      f.font = `${FONT}px ${FAMILY}`;
    }
    // ---- Glenn's pane. p: { n: 3 | 1, icon, who: { name }, mood, rows: [{ segs: [{ text, dim, mark }], time, dim }],
    //      cursor: { row, col } | null, cursorOn }.
    // (Arnold, 2026-10-11: the tag on every message broke the reading line.) His silhouette on the left over rows 1 and 2,
    // and his nametag once, under it, as wide as it (the tag is his: a caption read as nobody); his lines start flush
    // against them.
    // At the end of each message, right-aligned and dim, the shift time it was said. A small ▸ in front of what he has asked
    // for and is waiting on (mark: drawn, not a glyph, so every font has it). His cursor is the player's, blinking, in red.
    // The silhouette: a rounded square in upstairs' red, its inside lit faintly red, a plain head and shoulders in the
    // glass's own dark (Arnold's stills, sf-1: the frame's line and two fills, a circle and the top of an ellipse cut square
    // by the frame, so nothing joins). It shows his mood without a face (mood): 'typing' brighter, 'quiet' dim, 'cooled'
    // flat grey (the three minutes after a refusal), 'static' (night 3, the link down: drawn as quiet until step 10 draws
    // it). Folded, there is no icon (at a row's height its head and shoulders would be under 6 px apart) and no name: his
    // red line, its ▸ and its time.
    const SUP = '#ffb4b4', SUPG = '#ff7a7a', GREY = '#9ea3b8';
    const MOOD = {
      typing: { ink: SUP, glow: SUPG, blur: 10, fill: 'rgba(255,157,157,.28)', line: 1, label: .62 },
      quiet: { ink: SUP, glow: SUPG, blur: 3, fill: 'rgba(255,157,157,.10)', line: .55, label: .42 },
      cooled: { ink: GREY, glow: 'transparent', blur: 0, fill: 'rgba(158,163,184,.10)', line: .6, label: .42 },
    };
    MOOD.static = MOOD.quiet;
    function icon(x, y, sz, mood = 'quiet') {
      const M = MOOD[mood] || MOOD.quiet;
      const r = sz * .12, head = { cx: x + sz / 2, cy: y + sz * .33, r: sz * .18 }, sh = { cx: x + sz / 2, cy: y + sz * 1.04, rx: sz * .36, ry: sz * .38 };
      const rr = () => { f.beginPath(); f.moveTo(x + r, y); f.arcTo(x + sz, y, x + sz, y + sz, r); f.arcTo(x + sz, y + sz, x, y + sz, r); f.arcTo(x, y + sz, x, y, r); f.arcTo(x, y, x + sz, y, r); f.closePath(); };
      f.save();
      rr(); f.shadowBlur = 0; f.fillStyle = M.fill; f.fill();
      f.save(); rr(); f.clip();
      f.fillStyle = '#0d1452';
      f.beginPath(); f.arc(head.cx, head.cy, head.r, 0, Math.PI * 2); f.fill();
      f.beginPath(); f.ellipse(sh.cx, sh.cy, sh.rx, sh.ry, 0, 0, Math.PI * 2); f.fill();
      f.restore();
      rr(); f.globalAlpha = M.line; f.strokeStyle = M.ink; f.shadowColor = M.glow; f.shadowBlur = M.blur; f.lineWidth = 1.5; f.lineJoin = 'round'; f.stroke();
      f.restore();
    }
    // the ▸: a small solid triangle on the line's centre, a cell wide, a cell's gap after it
    function mark(x, y, alpha) {
      const h = FONT * .42, w = h * .82;
      f.save(); f.globalAlpha = alpha; f.fillStyle = SUP; f.shadowColor = SUPG; f.shadowBlur = 6 * K;
      f.beginPath(); f.moveTo(x + 1.5, y - h / 2); f.lineTo(x + 1.5 + w, y); f.lineTo(x + 1.5, y + h / 2); f.closePath(); f.fill();
      f.restore();
    }
    // (also: a second voice on the link, her silhouette lit beside his, her own nametag under it: aw on night 2, layer 2;
    // { name, mood }. The text starts after both)
    function drawPane(p, pal) {
      const x0 = PAD_X + (p.icon ? PANE.ICON * CW * (p.also ? 2 : 1) : 0), M = MOOD[p.mood] || MOOD.quiet;
      const plate = (x, sz, name, mood) => {
        // his nametag, once (Arnold, 2026-10-11: the tag is his; on every message it broke the line, so it is a plate under
        // the square now, as wide as it): inverse red, his name in the glass's blue, in the third row. Grey when he's cooled.
        const TF = 14, ty = TOP + 2 * LH + LH / 2 - 1, th = TF + 4;
        f.save(); f.shadowBlur = 0; f.globalAlpha = mood === 'cooled' ? .8 : mood === 'typing' ? 1 : .85;
        f.fillStyle = mood === 'cooled' ? GREY : '#ff9d9d'; f.fillRect(x, ty - th / 2, sz, th);
        f.font = `${TF}px ${FAMILY}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillStyle = '#22308f';
        f.fillText(name, x + sz / 2, ty + .5);
        f.restore();
      };
      if (p.icon) {
        const sz = 2 * LH - 6;
        icon(PAD_X, TOP + 3, sz, p.mood);
        if (p.who?.name) plate(PAD_X, sz, p.who.name, p.mood);
        if (p.also) { const x = PAD_X + PANE.ICON * CW; icon(x, TOP + 3, sz, p.also.mood); plate(x, sz, p.also.name, p.also.mood); }
      }
      f.font = `${FONT}px ${FAMILY}`; f.textBaseline = 'middle';
      p.rows.forEach((row, r) => {
        const y = TOP + r * LH + LH / 2;
        let x = x0;
        for (const sg of row.segs) {
          if (sg.mark) { mark(x, y, sg.dim ? .45 : 1); x += 2 * CW; continue; }
          if (!sg.text) continue;
          f.globalAlpha = sg.dim ? .45 : 1; f.fillStyle = SUP; f.shadowColor = SUPG; f.shadowBlur = 6 * K; f.fillText(sg.text, x, y);
          x += [...sg.text].length * CW;
        }
        // the time it was said, right-aligned at the end of the message, dim
        if (row.time) { f.globalAlpha = .34; f.fillStyle = SUP; f.shadowColor = SUPG; f.shadowBlur = 3 * K; f.fillText(row.time, W - PAD_X - row.time.length * CW, y); }
        f.globalAlpha = 1;
      });
      // his cursor while he types: the player's own block, blinking with it, in his red, at the end of what has typed
      if (p.cursor && p.cursorOn) { const x = x0 + p.cursor.col * CW, y = TOP + p.cursor.row * LH + LH / 2; f.shadowColor = SUPG; f.shadowBlur = 6 * K; f.fillStyle = SUP; f.fillRect(x, y - FONT * .55, FONT * .62, FONT * 1.05); }
      // the rule between his rows and the work: the tube's dim ink, a hair, the width of the text
      const ry = TOP + p.n * LH + PANE.GAP[p.n] / 2;
      f.shadowBlur = 0; f.globalAlpha = .38; f.fillStyle = pal.dim; f.fillRect(PAD_X, ry - .5, W - 2 * PAD_X, 1); f.globalAlpha = 1;
    }
    // A square grid over the text, for games that move in cells (snake): the text grid's cells are 2.4 times taller
    // than wide, so a game on them steps 10 across and 25 down and its pieces are slivers. field: { col, row (the
    // text cell of its top left corner), width (in text columns), cols, rows, cells: [[x, y, kind]] }; the grid's step
    // is one text row, and it is centred across the width. kind: head, body, food (a diamond), dead (a dead link: a small
    // cross, dim), port (the core port, open: a hollow square in the phosphor's green) or portShut (dim).
    function drawField(fd, pal) {
      // (height: the text rows it fills, when its rows are more than those: ROUTE's 11 in 10, under Glenn's folded row)
      // (left: the grid from the field's left edge, not centred: HEAP's well, with its notes beside it)
      const step = Math.min(fd.width * CW / fd.cols, fd.height ? fd.height * LH / fd.rows : LH), x0 = PAD_X + fd.col * CW + (fd.left ? 0 : (fd.width * CW - fd.cols * step) / 2), y0 = OFF + fd.row * LH;
      f.shadowColor = pal.glow; f.shadowBlur = 6 * K;
      for (const [x, y, kind] of fd.cells) {
        const cx = x0 + (x + .5) * step, cy = y0 + (y + .5) * step;
        if (kind === 'food') {                           // a diamond, as the old ◆
          const r = step * .3; f.fillStyle = '#b8f0c2';
          f.beginPath(); f.moveTo(cx, cy - r); f.lineTo(cx + r, cy); f.lineTo(cx, cy + r); f.lineTo(cx - r, cy); f.closePath(); f.fill();
          continue;
        }
        if (kind === 'dead') {                           // a dead link: a small cross, dim
          const r = step * .22; f.save(); f.strokeStyle = pal.dim; f.globalAlpha = .7; f.lineWidth = 2; f.lineCap = 'round';
          f.beginPath(); f.moveTo(cx - r, cy - r); f.lineTo(cx + r, cy + r); f.moveTo(cx + r, cy - r); f.lineTo(cx - r, cy + r); f.stroke(); f.restore();
          continue;
        }
        if (kind === 'free') {                           // a free cell of HEAP's well: a small dim dot, so the well reads
          const r = Math.max(1, step * .07); f.save(); f.fillStyle = pal.dim; f.globalAlpha = .55; f.shadowBlur = 0;
          f.fillRect(cx - r, cy - r, 2 * r, 2 * r); f.restore();
          continue;
        }
        // FIREWALL (2026-10-12, step 9): a probe, a small hollow diamond; a refusal on its way up, a short bright bar
        if (kind === 'probe') {
          const r = step * .3; f.save(); f.strokeStyle = pal.text; f.lineWidth = 2; f.lineJoin = 'round';
          f.beginPath(); f.moveTo(cx, cy - r); f.lineTo(cx + r, cy); f.lineTo(cx, cy + r); f.lineTo(cx - r, cy); f.closePath(); f.stroke(); f.restore();
          continue;
        }
        if (kind === 'refusal') {
          const h = step * .62; f.save(); f.fillStyle = '#b8f0c2'; f.shadowColor = '#b8f0c2'; f.fillRect(cx - 1.5, cy - h / 2, 3, h); f.restore();
          continue;
        }
        if (kind === 'port' || kind === 'portShut') {    // the core port: a hollow square, lit when it opens
          const side = step - 6; f.save(); f.strokeStyle = kind === 'port' ? '#b8f0c2' : pal.dim; f.globalAlpha = kind === 'port' ? 1 : .6; f.lineWidth = 2;
          f.strokeRect(cx - side / 2, cy - side / 2, side, side); f.restore();
          continue;
        }
        const side = step - 4;                           // a square with a small gap to the next: nodes you can count
        f.fillStyle = pal.text; f.globalAlpha = kind === 'head' ? 1 : .72;
        f.fillRect(cx - side / 2, cy - side / 2, side, side);
      }
      f.globalAlpha = 1;
    }
    // Pong's ball and paddles, drawn where they are rather than on the text grid, so they move smoothly (Arnold,
    // 2026-10-05: on the grid the ball jumped a cell at a time): fd { pong: true, col, row (the court's top left text
    // cell), ball: [x, y] | null, paddles: [[x, y, len]] }, in cells, fractions allowed. A paddle is a text cell wide, as
    // the block it was; the ball the size of the round glyph it was.
    function drawPong(fd, pal) {
      // (rowStep: a court row's height, when its rows are more than the text rows it fills: Pong's 11 in 10)
      const x0 = PAD_X + fd.col * CW, y0 = OFF + fd.row * LH, R = fd.rowStep || LH;
      f.shadowColor = pal.glow; f.shadowBlur = 6 * K; f.fillStyle = pal.text;
      for (const [x, y, len] of fd.paddles) f.fillRect(x0 + x * CW + 1, y0 + y * R + 2, CW - 2, len * R - 4);
      if (fd.ball) { f.beginPath(); f.arc(x0 + (fd.ball[0] + .5) * CW, y0 + (fd.ball[1] + .5) * R, FONT * .3, 0, Math.PI * 2); f.fill(); }
    }
    // POWER's synchroscope (design.md section 5, "The last three cartridges, decided"; built 2026-10-12), drawn where the needle
    // is, as Pong is, not on the text grid: fd { scope: true, col, row, width, height (the text cells it is centred in),
    // theta (the needle, degrees clockwise from the top), win (the window's half width, degrees), state }. A ring of dim dots,
    // a tick over the top, the window at the top in the bright tone, a needle from the centre. state: 'idle' (before the first
    // key: the needle dim), 'jolt' (a trip: the needle flickering dim), 'closed' (a rack just back: the window lit green).
    function drawScope(fd, pal) {
      const cx = PAD_X + (fd.col + fd.width / 2) * CW, cy = OFF + (fd.row + fd.height / 2) * LH;
      const R = Math.min(fd.width * CW, fd.height * LH) / 2 - 12, rad = d => (d - 90) * Math.PI / 180;
      const at = (d, r) => [cx + r * Math.cos(rad(d)), cy + r * Math.sin(rad(d))];
      f.save(); f.lineCap = 'round';
      // the ring: a dot every 10 degrees, dim, none under the window
      f.shadowBlur = 0; f.fillStyle = pal.dim; f.globalAlpha = .6;
      for (let d = 0; d < 360; d += 10) { if (d <= fd.win || d >= 360 - fd.win) continue; const [x, y] = at(d, R); f.beginPath(); f.arc(x, y, 1.6, 0, Math.PI * 2); f.fill(); }
      // the window: an arc at the ring's radius, and a tick above it
      const lit = fd.state === 'closed', ink = lit ? '#b8f0c2' : pal.text;
      f.globalAlpha = 1; f.strokeStyle = ink; f.shadowColor = lit ? '#b8f0c2' : pal.glow; f.shadowBlur = (lit ? 10 : 6) * K;
      f.lineWidth = 3; f.beginPath(); f.arc(cx, cy, R, rad(-fd.win), rad(fd.win)); f.stroke();
      f.lineWidth = 2; f.beginPath(); f.moveTo(cx, cy - R - 4); f.lineTo(cx, cy - R - 10); f.stroke();
      // the needle and its hub
      const jolt = fd.state === 'jolt', idle = fd.state === 'idle';
      f.globalAlpha = idle ? .45 : jolt ? (Math.floor(performance.now() / 70) % 2 ? .25 : .6) : 1;
      f.strokeStyle = f.fillStyle = pal.text; f.shadowColor = pal.glow; f.shadowBlur = idle ? 0 : 6 * K;
      const [nx, ny] = at(fd.theta, R - 8);
      f.lineWidth = 2.5; f.beginPath(); f.moveTo(cx, cy); f.lineTo(nx, ny); f.stroke();
      f.beginPath(); f.arc(cx, cy, 3.5, 0, Math.PI * 2); f.fill();
      f.restore();
    }
    // The start's close-up (Arnold, 2026-10-11; docs/proposals/start-camera-and-eyelids-2026-10-11.md): the tube filling the
    // window, its glass dark, in the fall-asleep screen's lettering (#night-over: 30 px at the frame's 1080, #cfd6ff, a 10 px
    // glow), sized so that on the window it is that screen's size: t.unit is the stage pixels a design unit spans at the
    // close-up, so px(v) is v of the fall-asleep screen's pixels in design units. The name at twice its size, spaced; lines
    // of a question (t.lead); the choices in a row, 64 px apart, in brackets at half strength, the chosen one inverse (that
    // screen's hover); a dim line of how. Or t.box: the menu's rows (settings), centred at 22 px. Returns where the choices,
    // or the box's rows, lie (design units), for the page's click.
    let titleHits = [];
    const INK = '#cfd6ff', GLOW = 'rgba(200, 210, 255, .45)';
    function drawCloseUp(t, pal) {
      const px = v => v / t.unit, cx = W / 2, hits = [];
      f.save(); f.textBaseline = 'middle';
      if (t.box) {
        const fs = px(22), lh = fs * 1.32, cw = (f.font = `${fs}px ${FAMILY}`, f.measureText('M').width);
        const cols = Math.max(...t.box.map(r => r.reduce((n, sg) => n + [...sg.text].length, 0)));
        const x0 = cx - cols * cw / 2, y0 = H / 2 - t.box.length * lh / 2;
        t.box.forEach((row, r) => {
          const y = y0 + (r + .5) * lh; let x = x0;
          for (const sg of row) {
            const n = [...sg.text].length, cls = String(sg.cls || '');
            if (cls.includes('dg-cur')) { f.shadowBlur = 0; f.fillStyle = INK; f.fillRect(x, y - lh / 2 + px(1), n * cw, lh - px(2)); f.fillStyle = '#22308f'; }
            else { f.fillStyle = INK; f.globalAlpha = cls.includes('dim') ? .55 : 1; f.shadowColor = GLOW; f.shadowBlur = cls.includes('dim') ? 0 : px(10) * K; }
            f.fillText(sg.text, x, y); f.globalAlpha = 1; x += n * cw;
          }
          hits.push({ x0, x1: x0 + cols * cw, y0: y - lh / 2, y1: y + lh / 2 });
        });
        f.restore(); return hits;
      }
      // or t.card: the playtest's end card (2026-10-12), its lines at that screen's 30 px, centred, and t.hint under them,
      // dim at 22; nothing to choose
      if (t.card) {
        const fs = px(30), lh = fs * 1.5, gap = px(18), n = t.card.length;
        let y = H / 2 - (n * lh + (t.hint ? gap + px(22) * 1.5 : 0)) / 2 + lh / 2;
        f.textAlign = 'center'; f.fillStyle = INK; f.shadowColor = GLOW; f.shadowBlur = px(10) * K;
        f.font = `${fs}px ${FAMILY}`;
        for (const l of t.card) { f.fillText(l, cx, y); y += lh; }
        if (t.hint) { f.font = `${px(22)}px ${FAMILY}`; f.globalAlpha = .55; f.shadowBlur = 0; f.fillText(t.hint, cx, y - lh / 2 + gap + px(22) * .75); f.globalAlpha = 1; }
        f.restore(); return hits;
      }
      const fs = px(30), gap = px(18), lead = t.lead || [];
      let y = H / 2 - px(60) - lead.length * fs * .75;
      f.textAlign = 'center'; f.fillStyle = INK; f.shadowColor = GLOW; f.shadowBlur = px(10) * K;
      f.font = `${px(60)}px ${FAMILY}`; f.fillText([...t.name].join(' '), cx, y);
      y += px(30) + gap;
      f.font = `${fs}px ${FAMILY}`;
      for (const l of lead) { y += fs * .75; f.globalAlpha = l.dim ? .55 : 1; f.shadowBlur = l.dim ? 0 : px(10) * K; f.fillText(l.text, cx, y); f.globalAlpha = 1; y += fs * .75; }
      y += px(24) + fs * .75;
      const words = t.items.map(it => `[ ${it} ]`), pad = px(10), wid = words.map(w => f.measureText(w).width + 2 * pad);
      let x = cx - (wid.reduce((a, b) => a + b, 0) + px(64) * (words.length - 1)) / 2;
      f.textAlign = 'left';
      t.items.forEach((it, i) => {
        if (i === t.sel) { f.shadowBlur = 0; f.fillStyle = INK; f.fillRect(x, y - fs * .75, wid[i], fs * 1.5); f.fillStyle = '#22308f'; f.fillText(words[i], x + pad, y); }
        else {
          f.shadowColor = GLOW; f.shadowBlur = px(10) * K; f.fillStyle = INK;
          f.globalAlpha = .5; f.fillText('[', x + pad, y); f.fillText(']', x + pad + f.measureText(`[ ${it} `).width, y);
          f.globalAlpha = 1; f.fillText(it, x + pad + f.measureText('[ ').width, y);
        }
        hits.push({ x0: x, x1: x + wid[i], y0: y - fs * .75, y1: y + fs * .75 });
        x += wid[i] + px(64);
      });
      if (t.hint) { f.font = `${px(22)}px ${FAMILY}`; f.textAlign = 'center'; f.globalAlpha = .55; f.shadowBlur = 0; f.fillText(t.hint, cx, y + fs * .75 + gap + px(22) * .75); f.globalAlpha = 1; }
      f.restore();
      return hits;
    }
    // the barrel: columns to the curved top and bottom, then rows to the curved sides (canvas pixels)
    function setK(k) {
      // (a page loaded in a hidden or zero-size window has no size yet to scale by: keep the resolution it has; NaN went
      // through and the canvas threw on its gradient, the final sweep, 2026-10-11)
      if (!Number.isFinite(k)) return false;
      k = Math.max(K0, Math.min(12, Math.ceil(k)));
      if (k === K) return false;
      K = k;
      canvas.width = flat.width = mid.width = W * K; canvas.height = flat.height = mid.height = H * K;
      f.setTransform(K, 0, 0, K, 0, 0);
      const rs = (a, n) => Array.from({ length: n }, (_, i) => { const x = i * a.length / n, j = Math.min(a.length - 2, Math.floor(x)), u = x - j; return (a[j] * (1 - u) + a[j + 1] * u) * K / K0; });
      warp = K === K0 ? warp0 : { top: rs(warp0.top, W * K), bottom: rs(warp0.bottom, W * K), left: rs(warp0.left, H * K), right: rs(warp0.right, H * K) };
      return true;
    }
    // In strips of K/2 canvas pixels, half a design unit, each placed by the bend at its middle: at the chair (K 2) a strip
    // is one pixel, as it always was; seen larger (the start's close-up, K up to 12) a pixel a strip was 13,000 draws a
    // paint, which made the close-up's hover lag (the final sweep's live audit, 2026-10-11). The bend's slope is at most
    // about 0.15, so a strip's ends are within 0.1 design unit of the curve.
    function bend() {
      if (bendMode !== '2d' && gl.ready() && gl.fits()) { gl.draw(); out.clearRect(0, 0, canvas.width, canvas.height); out.drawImage(gl.canvas, 0, 0); return; }
      bend2d();
    }
    function bend2d() {
      const st = Math.max(1, Math.floor(K / 2)), W2 = flat.width, H2 = mid.height;
      m.clearRect(0, 0, mid.width, mid.height);
      for (let x = 0; x < W2; x += st) { const w = Math.min(st, W2 - x), c = Math.min(W2 - 1, x + (w >> 1)); m.drawImage(flat, x, 0, w, flat.height, x, warp.top[c], w, flat.height + warp.bottom[c] - warp.top[c]); }
      out.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < H2; y += st) { const h = Math.min(st, H2 - y), c = Math.min(H2 - 1, y + (h >> 1)); out.drawImage(mid, 0, y, mid.width, h, warp.left[c], y, mid.width + warp.right[c] - warp.left[c], h); }
    }
    // The same bend in one WebGL draw (the play's live audit, 2026-10-12): the strips above are 2,146 draws a paint at the
    // chair, 3 ms of the page's time and most of the GPU's while the tube moves every frame (Pong and the other games, the
    // typing). The shader does the same two passes for each pixel of the tube: the row's strip stretched to its curved sides
    // (its left and right from the tables, the pixel's share of the strip's span as its coverage), between the two columns
    // either side, each of them that column's strip stretched to its curved top and bottom (the same, upright), sampled from
    // the flat text with the same smoothing; the strips are the same strips (K/2 pixels, placed by the bend at their middle).
    // The text, the tables and the strips are the 2D path's; the difference is that the column pass isn't rounded to
    // 8 bits before the row pass reads it (a level or so here and there). Without WebGL2, or with its context lost, the 2D
    // strips draw it as before. bendMode '2d' (the audit's) draws with the strips.
    let bendMode = 'gl';
    const gl = (() => {
      let c = null, g = null, prog = null, flatTex = null, warpTex = null, warpFor = null, sizeFor = '', failed = false, why = '';
      const VS = '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
      const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D src; uniform highp sampler2D warp; uniform int W2; uniform int H2; uniform int st;
out vec4 o;
float cover(float a, float lo, float hi) { return clamp(min(a + 1.0, hi) - max(a, lo), 0.0, 1.0); }
// the column strip c's colour at row py (the column pass)
vec4 col(int c, float py) {
  int xs = (c / st) * st, w = min(st, W2 - xs), cc = min(W2 - 1, xs + (w >> 1));
  float T = texelFetch(warp, ivec2(cc, 0), 0).r, B = texelFetch(warp, ivec2(cc, 1), 0).r, h = float(H2);
  float sy = (h + B - T) / h;
  float v = (py + 0.5 - T) / sy;
  return cover(py, T, T + h * sy) * texture(src, vec2((float(c) + 0.5) / float(W2), v / h));
}
void main() {
  int px = int(gl_FragCoord.x), pyi = H2 - 1 - int(gl_FragCoord.y);
  float x = float(px), py = float(pyi), w = float(W2);
  int ys = (pyi / st) * st, hh = min(st, H2 - ys), cr = min(H2 - 1, ys + (hh >> 1));
  float L = texelFetch(warp, ivec2(cr, 2), 0).r, R = texelFetch(warp, ivec2(cr, 3), 0).r;
  float sx = (w + R - L) / w;
  float u = (x + 0.5 - L) / sx - 0.5, c0 = floor(u), fx = u - c0;
  int a = clamp(int(c0), 0, W2 - 1), b = clamp(int(c0) + 1, 0, W2 - 1);
  o = cover(x, L, L + w * sx) * mix(col(a, py), col(b, py), fx);
}`;
      function init() {
        try {
          c = document.createElement('canvas');
          g = c.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
          if (!g) throw new Error('no webgl2');
          const sh = (t, s) => { const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); if (!g.getShaderParameter(x, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(x)); return x; };
          prog = g.createProgram(); g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(prog);
          if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
          g.useProgram(prog);
          const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
          const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
          flatTex = g.createTexture(); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, flatTex);
          for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
          warpTex = g.createTexture(); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, warpTex);
          for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
          g.uniform1i(g.getUniformLocation(prog, 'src'), 0); g.uniform1i(g.getUniformLocation(prog, 'warp'), 1);
          c.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; });
        } catch (e) { failed = true; why = String(e && e.message || e); }
      }
      return {
        get canvas() { return c; }, get why() { return why; },
        ready() { if (!g && !failed) init(); return !failed && g && !g.isContextLost(); },
        // (a size WebGL can hold: its drawing buffer is quietly made smaller than asked past its limit, which scaled the close-up
        // at K 12, and the tables' texture is as wide as the longer side; past either, the strips draw it)
        fits() {
          const W2 = flat.width, H2 = flat.height;
          if (sizeFor !== W2 + 'x' + H2) { c.width = W2; c.height = H2; g.viewport(0, 0, W2, H2); sizeFor = W2 + 'x' + H2; warpFor = null; }
          return g.drawingBufferWidth === W2 && g.drawingBufferHeight === H2 && Math.max(W2, H2) <= g.getParameter(g.MAX_TEXTURE_SIZE);
        },
        draw() {
          const W2 = flat.width, H2 = flat.height;
          if (warpFor !== warp) {
            // the four tables as the rows of one float texture: top and bottom by column, left and right by row
            const n = Math.max(W2, H2), d = new Float32Array(n * 4);
            for (let i = 0; i < W2; i++) { d[i] = warp.top[i]; d[n + i] = warp.bottom[i]; }
            for (let i = 0; i < H2; i++) { d[2 * n + i] = warp.left[i]; d[3 * n + i] = warp.right[i]; }
            g.activeTexture(g.TEXTURE1); g.texImage2D(g.TEXTURE_2D, 0, g.R32F, n, 4, 0, g.RED, g.FLOAT, d);
            warpFor = warp;
          }
          g.activeTexture(g.TEXTURE0);
          g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, flat);
          g.uniform1i(g.getUniformLocation(prog, 'W2'), W2); g.uniform1i(g.getUniformLocation(prog, 'H2'), H2); g.uniform1i(g.getUniformLocation(prog, 'st'), Math.max(1, Math.floor(K / 2)));
          g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
          g.drawArrays(g.TRIANGLES, 0, 3);
        },
      };
    })();
    // (for the audit: draw the last view again with the strips or with WebGL, and read the tube's pixels)
    const bendAudit = { set: m => { bendMode = m; lastKey = null; }, get mode() { return bendMode; }, gl: () => gl.ready() || gl.why };
    return { paint, layout, boxAt, COLS, ROWS, CW, LH, TOP, PAD_X, PANE, W, H, mailHit: () => mailHit, titleHit: () => titleHits, setK, get K() { return K; }, bendAudit };
  };
})();
