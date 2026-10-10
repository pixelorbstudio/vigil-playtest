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
  const W = 660, H = 413, K = 2;                       // design size, and the canvas scale
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
    'sup-tag': { color: '#22308f', bg: '#ff9d9d', glow: 'none' }, sup: { color: '#ffb4b4', glow: '#ff7a7a' },
    'rs-won': { color: '#22308f', bg: '#b8f0c2', glow: 'none' }, 'rs-lost': { color: '#22308f', bg: '#ffd28a', glow: 'none' },
    // the kinds of trouble, in the tube's own tones and never red (red is the supervisor's and the strikes'): DOWN the
    // phosphor at its brightest, HOT amber (as its LED), STUCK violet, LOSS cyan
    pdown: { color: '#ffffff', glow: '#ffffff' }, phot: { color: '#ffd28a' }, pstuck: { color: '#c7b8ff' }, ploss: { color: '#8fd3ff' },
  };

  window.createCRT = function ({ canvas, host, warp }) {
    canvas.width = W * K; canvas.height = H * K;
    const out = canvas.getContext('2d');
    const flat = document.createElement('canvas'), mid = document.createElement('canvas');
    flat.width = mid.width = W * K; flat.height = mid.height = H * K;
    const f = flat.getContext('2d'), m = mid.getContext('2d');
    f.setTransform(K, 0, 0, K, 0, 0);
    f.font = `${FONT}px ${FAMILY}`; f.textBaseline = 'middle';
    const CW = f.measureText('M').width;               // one monospace cell
    const COLS = Math.floor((W - 2 * PAD_X) / CW), ROWS = Math.floor((H - TOP - BOTTOM) / LH);
    const css = () => { const s = getComputedStyle(host); return { text: s.getPropertyValue('--term-text').trim() || '#e9edff', dim: s.getPropertyValue('--term-dim').trim() || '#aab4ee', glow: s.getPropertyValue('--term-glow').trim() || 'rgba(200,210,255,.45)' }; };
    const resolve = (c, pal) => c === 'var(--term-dim)' ? pal.dim : c === 'var(--term-text)' ? pal.text : c;

    /* view: { rows: [[{ text, cls }]], cursor: { row, col } | null, cursorOn, status: { energy, beans, low } | null,
       field: a square grid drawn over the text | null (see drawField) } */
    function paint(view) {
      const pal = css();
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
      view.rows.forEach((segs, r) => {
        const y = TOP + r * LH + LH / 2;
        let col = 0;
        for (const s of segs) {
          if (!s.text) continue;
          const st = Object.assign({}, ...String(s.cls || '').split(' ').map(c => CLS[c] || {})), x = PAD_X + col * CW;
          f.globalAlpha = st.alpha ?? 1;
          if (st.bg) { f.shadowBlur = 0; f.fillStyle = resolve(st.bg, pal); f.fillRect(x, y - LH / 2 + 1, s.text.length * CW, LH - 2); }
          f.fillStyle = resolve(st.color, pal) || pal.text;
          f.shadowColor = st.glow === 'none' ? 'transparent' : st.glow || pal.glow; f.shadowBlur = st.glow === 'none' ? 0 : 6 * K;
          f.fillText(s.text, x, y);
          col += [...s.text].length;
        }
      });
      f.globalAlpha = 1;
      if (view.field) view.field.pong ? drawPong(view.field, pal) : drawField(view.field, pal);
      if (view.cursor && view.cursorOn) {
        const x = PAD_X + view.cursor.col * CW, y = TOP + view.cursor.row * LH + LH / 2;
        f.shadowColor = pal.glow; f.shadowBlur = 6 * K; f.fillStyle = pal.text;
        f.fillRect(x, y - FONT * .55, FONT * .62, FONT * 1.05);
      }
      // rows never start above the first line, so only the bottom edge needs the old fade
      f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'destination-out'; f.shadowBlur = 0;
      const fade = f.createLinearGradient(0, (H - 10) * K, 0, H * K);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      f.fillStyle = fade; f.fillRect(0, (H - 10) * K, W * K, 10 * K);
      f.restore();
      if (view.status) drawStatus(view.status, pal);
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
    function drawProblems(list, pal) {
      const PF = 13, y = 41;
      f.font = `${PF}px ${FAMILY}`; f.shadowColor = pal.glow; f.shadowBlur = 5 * K;
      let x = PAD_X;
      const put = (t, color) => { f.fillStyle = color; f.fillText(t, x, y); x += f.measureText(t).width; };
      if (!list.length) put('all units nominal', pal.dim);
      // a rack dropping packets says what is wrong and what fixes it, in a few words (Eugene's second playtest, 2026-10-05:
      // LOSS alone left him stuck); short if the strip would run past the tube's edge
      const hint = (p, long) => p.kind === 'LOSS' && !p.fixing ? (long ? `  dropping packets: ROUTE cart, route ${p.unit}` : `  route ${p.unit}`) : '';
      const width = long => list.reduce((s, p, i) => s + f.measureText((i ? '  ·  ' : '') + p.unit + ' ' + (p.fixing ? 'FIXING' : p.kind) + hint(p, long)).width, 0);
      const long = width(true) <= W - 2 * PAD_X;
      list.forEach((p, i) => {
        if (i) put('  ·  ', pal.dim);
        put(p.unit + ' ', p.fixing ? pal.dim : pal.text);
        const st = CLS[{ DOWN: 'pdown', HOT: 'phot', STUCK: 'pstuck', LOSS: 'ploss' }[p.kind]] || {};
        if (p.fixing) put('FIXING', pal.dim); else { f.shadowColor = st.glow || pal.glow; put(p.kind, st.color || pal.text); f.shadowColor = pal.glow; }
        if (hint(p, long)) put(hint(p, long), pal.dim);
      });
    }
    // spurts: energy that just moved, [{ a, b, age }] (from a to b, age 0..1): drawn over the gauge where it moved, green
    // in, red out (the tube's ok green and the supervisor's red, the only colours it has besides the phosphor)
    function drawStatus({ energy, beans, low, strikes = 0, mail = null, beansLit = false, problems = null, spurts = [] }, pal) {
      if (problems) drawProblems(problems, pal);
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
        f.save(); f.strokeStyle = bright ? pal.text : pal.dim; f.lineWidth = 1.5; f.lineJoin = 'round'; f.lineCap = 'round';
        if (!bright) f.globalAlpha = .8;
        f.strokeRect(x + .75, top, ENV - 1.5, h);
        f.beginPath(); f.moveTo(x + 1.5, top + 1); f.lineTo(x + ENV / 2, top + h * .58); f.lineTo(x + ENV - 1.5, top + 1); f.stroke();
        f.restore();
        if (mcount) { f.fillStyle = pal.text; f.fillText(mcount, x + ENV + 5, y); }
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
    // A square grid over the text, for games that move in cells (snake): the text grid's cells are 2.4 times taller
    // than wide, so a game on them steps 10 across and 25 down and its pieces are slivers. field: { col, row (the
    // text cell of its top left corner), width (in text columns), cols, rows, cells: [[x, y, kind]] }; the grid's step
    // is one text row, and it is centred across the width. kind: head, body, food (a diamond), dead (a dead link: a small
    // cross, dim), port (the core port, open: a hollow square in the phosphor's green) or portShut (dim).
    function drawField(fd, pal) {
      const step = Math.min(fd.width * CW / fd.cols, LH), x0 = PAD_X + fd.col * CW + (fd.width * CW - fd.cols * step) / 2, y0 = TOP + fd.row * LH;
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
      const x0 = PAD_X + fd.col * CW, y0 = TOP + fd.row * LH;
      f.shadowColor = pal.glow; f.shadowBlur = 6 * K; f.fillStyle = pal.text;
      for (const [x, y, len] of fd.paddles) f.fillRect(x0 + x * CW + 1, y0 + y * LH + 2, CW - 2, len * LH - 4);
      if (fd.ball) { f.beginPath(); f.arc(x0 + (fd.ball[0] + .5) * CW, y0 + (fd.ball[1] + .5) * LH, FONT * .3, 0, Math.PI * 2); f.fill(); }
    }
    // the barrel: columns to the curved top and bottom, then rows to the curved sides (canvas pixels)
    function bend() {
      m.clearRect(0, 0, mid.width, mid.height);
      for (let x = 0; x < flat.width; x++) m.drawImage(flat, x, 0, 1, flat.height, x, warp.top[x], 1, flat.height + warp.bottom[x] - warp.top[x]);
      out.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < mid.height; y++) out.drawImage(mid, 0, y, mid.width, 1, warp.left[y], y, mid.width + warp.right[y] - warp.left[y], 1);
    }
    return { paint, COLS, ROWS, CW, LH, TOP, PAD_X, mailHit: () => mailHit };
  };
})();
