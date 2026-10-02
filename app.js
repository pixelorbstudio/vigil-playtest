/* Vigil terminal room — interactive illustration
   Layers: scene svg (from Figma groups) → HTML terminal (matrix3d onto the CRT) → overlay svg (glare, steam) */

(async function main() {
  // ---- ?playtest: what the tester did and when, kept across reloads (a lost night reloads the page), saved as a
  // text file from a button beside hum and sound. Commands typed, the log's own lines (alerts, fixes, Glenn,
  // compliance), looking down, the drawer, cartridges, sips, energy every 10%, game results, losses, the tab hidden.
  // Nothing else about the game changes.
  const PLAYTEST = new URLSearchParams(location.search).has('playtest');
  const playtest = (() => {
    if (!PLAYTEST) return () => {};
    let log = []; try { log = JSON.parse(localStorage.getItem('vigil.playtest') || '[]'); } catch (e) {}
    const t0 = performance.now();
    log.push(`--- page loaded ${new Date().toString().slice(0, 24)}`);
    const save = () => { try { localStorage.setItem('vigil.playtest', JSON.stringify(log.slice(-6000))); } catch (e) {} };
    save();
    const note = what => {
      let c = '--:--'; try { c = shift.clock().slice(0, 5); } catch (e) {}
      log.push(`${((performance.now() - t0) / 1000).toFixed(1).padStart(7)}s  ${c}  ${what}`); save();
    };
    note.text = () => log.join('\n');
    return note;
  })();
  if (PLAYTEST) document.addEventListener('visibilitychange', () => playtest(document.hidden ? 'tab hidden' : 'tab visible'));
  const stage = document.getElementById('stage');
  const holder = document.getElementById('scene-holder');
  const overlay = document.getElementById('overlay');
  const terminal = document.getElementById('terminal');
  const termOut = document.getElementById('term-out');
  const termCanvas = document.getElementById('term-canvas');
  const termTube = document.getElementById('term-tube');
  const hint = document.getElementById('hint');
  const muteBtn = document.getElementById('mute');
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = n => Math.floor(Math.random() * n);
  const SVG = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------ load scene
  holder.innerHTML = await fetch('scene.svg').then(r => r.text());
  const scene = holder.querySelector('svg');
  // the art already runs past the frame's bottom (desk, keyboard front); the desk drawer is built below it
  // down to the floor under the desk (2030), and a little past it
  scene.setAttribute('viewBox', '-240 0 1920 2200'); scene.setAttribute('width', '1920'); scene.setAttribute('height', '2200');

  // ------------------------------------------------------------ fit stage
  let scale = 1, dolly = 1, shiftY = 0;               // dolly and shiftY: the head moving, used by the sip
  function placeStage() {
    const k = scale * dolly;   // scale about the stage centre, so the dolly reads as leaning in
    stage.style.transform = `translate(${-720 * k}px, ${-540 * k + shiftY * scale}px) scale(${k})`;
  }
  // The frame is 1920 x 1080. The height always fits; the width shows as much of the frame as the window's shape
  // allows, from the middle 1440 (4:3) to all of it (16:9). Past 16:9 the page shows at the sides.
  function fit() {
    const seen = Math.min(1920, Math.max(1440, 1080 * innerWidth / innerHeight));
    scale = Math.min(innerHeight / 1080, innerWidth / seen); placeStage();
  }
  addEventListener('resize', fit); fit();

  // ------------------------------------------------------------ layers (parallax)
  // depth: positive = far (moves with the mouse), negative = near (moves against it)
  const LAYERS = [
    { test: id => id === 'ceiling',                         depth:  1.0 },
    { test: id => id.startsWith('rack-'),                   depth:  0.6 },
    { test: id => ['desk','riser','housing-underside','tilt-swivel-stand','bezel','screen','chin-details'].includes(id), depth: 0.25 },
    { test: id => id === 'mug',                             depth: -0.45 },
    { test: id => /^(key-|keyboard|.*-row-frame$|divot)/.test(id), depth: -0.35 },
  ];
  const layered = [];
  // Wrap each consecutive run of same-layer siblings in one <g>, so z-order is untouched
  // and the keycaps keep their own transform free for the press animation.
  let run = null;
  for (const g of [...scene.querySelectorAll(':scope > g')]) {
    const L = LAYERS.find(l => l.test(g.id));
    if (!L) { run = null; continue; }
    if (!run || run.L !== L) {
      const wrap = document.createElementNS(SVG, 'g');
      wrap.classList.add('layer');
      scene.insertBefore(wrap, g);
      run = { L, wrap };
      layered.push({ el: wrap, depth: L.depth });
    }
    run.wrap.appendChild(g);
  }
  layered.push({ el: terminal, depth: 0.25, isTerminal: true });

  // ---- glare: the drawn sheen is replaced by gradient glare in the overlay, clipped to the tube face
  $('glass-sheen').remove();
  const screenG = $('screen');
  {
    const face = screenG.querySelector('svg');
    const p = face.querySelector('path:nth-of-type(2)').cloneNode();   // the blue inner face
    p.removeAttribute('id'); p.removeAttribute('stroke');
    p.setAttribute('transform', `translate(${face.getAttribute('x')} ${face.getAttribute('y')})`);
    $('screen-clip').appendChild(p);
  }
  // The glare drifts with the cursor (a reflection on convex glass moves toward the viewer's side)
  // and brightens a little when the cursor is up and to the left, where the room's light comes from.
  const glareMove = $('glare-move');
  const glares = [...glareMove.querySelectorAll('.glare')].map(el => ({ el, base: +el.getAttribute('opacity') }));
  function updateGlare(cx, cy) {
    glareMove.style.transform = `translate(${(cx * 26).toFixed(1)}px, ${(cy * 14).toFixed(1)}px)`;
    const k = 1 - (cx + cy) * .22;
    for (const { el, base } of glares) el.style.opacity = (base * k).toFixed(3);
  }

  // ------------------------------------------------------------ terminal projection
  // Blue CRT face corners, in the screen asset's own coordinates.
  const screenSvg = screenG.querySelector('svg');
  const sx = +screenSvg.getAttribute('x'), sy = +screenSvg.getAttribute('y');
  const quad = [[75.92, 15.87], [736.04, 15.87], [800.88, 428.69], [11.08, 428.69]].map(([x, y]) => [x + sx, y + sy]);
  // the terminal is laid out at twice its 660x413 design size (its contents use zoom: 2), so the barrel filter
  // below bends twice the pixels and the text stays crisp when the tube is drawn larger than that
  const TW = 1320, TH = 826;
  const H = homography([[0, 0], [TW, 0], [TW, TH], [0, TH]], quad);
  const baseMatrix = `matrix3d(${[H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, 1].join(',')})`;
  terminal.style.transform = baseMatrix;

  // ---- the glass is a barrel, not a flat quad: its top edge bows up ~9px at the centre, its sides out ~3.6px,
  // its bottom down ~1px. A perspective mapping keeps straight lines straight, so on its own the text sat in
  // straight rows under curved glass. crt.js bends the terminal before the mapping so its edges land on the
  // glass's edges and every row curves with them; these tables say how far, from the drawn face's own curves:
  // for each column, how far its top and bottom move (up or down), and for each row, how far its left and right
  // move (in or out), in terminal pixels.
  const WARP = { top: [], bottom: [], left: [], right: [] };
  if (new URLSearchParams(location.search).has('dev')) window.__warp = WARP;
  {
    const face = screenG.querySelector('svg path:nth-of-type(2)').getAttribute('d');
    const n = face.match(/-?[\d.]+/g).map(Number), segs = [];
    let p0 = [n[0], n[1]];
    for (let i = 2; i + 5 < n.length; i += 6) { const s = [p0, [n[i], n[i + 1]], [n[i + 2], n[i + 3]], [n[i + 4], n[i + 5]]]; segs.push(s); p0 = s[3]; }
    const bez = (s, t) => [0, 1].map(k => (1 - t) ** 3 * s[0][k] + 3 * (1 - t) ** 2 * t * s[1][k] + 3 * (1 - t) * t * t * s[2][k] + t ** 3 * s[3][k]);
    const sample = list => list.flatMap(s => Array.from({ length: 64 }, (_, i) => bez(s, i / 63)));
    // the outline runs bottom (BL to BR), right (up), top (right to left), left (down)
    const along = (pts, by, val) => { const a = pts.slice().sort((p, q) => p[by] - q[by]);
      return z => { let i = a.findIndex(p => p[by] >= z); if (i <= 0) return a[Math.max(0, i)][val]; const p = a[i - 1], q = a[i]; return p[val] + (q[val] - p[val]) * (z - p[by]) / ((q[by] - p[by]) || 1); }; };
    const yBot = along(sample([segs[0]]), 0, 1), xRight = along(sample([segs[1], segs[2]]), 1, 0);
    const yTop = along(sample([segs[3], segs[4]]), 0, 1), xLeft = along(sample([segs[5], segs[6]]), 1, 0);
    const [TL, TR, BR, BL] = quad.map(([x, y]) => [x - sx, y - sy]);
    const lineX = (a, b) => y => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    const xLeftS = lineX(TL, BL), xRightS = lineX(TR, BR);
    const map = ([x, y]) => { const w = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / w - sx, (H[3] * x + H[4] * y + H[5]) / w - sy]; };
    // offsets on the curved glass, in the scene, turned into terminal pixels by the mapping's local scale
    const scaleY = (x, y) => map([x, y + 1])[1] - map([x, y])[1], scaleX = (x, y) => map([x + 1, y])[0] - map([x, y])[0];
    for (let x = 0; x < TW; x++) {
      WARP.top[x] = (yTop(map([x, 0])[0]) - TL[1]) / scaleY(x, 0);
      WARP.bottom[x] = (yBot(map([x, TH - 1])[0]) - BL[1]) / scaleY(x, TH - 1);
    }
    for (let y = 0; y < TH; y++) {
      const L = map([0, y]), R = map([TW - 1, y]);
      WARP.left[y] = (xLeft(L[1]) - xLeftS(L[1])) / scaleX(0, y);
      WARP.right[y] = (xRight(R[1]) - xRightS(R[1])) / scaleX(TW - 1, y);
    }
  }

  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    return solve(A, b);
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  // ------------------------------------------------------------ LEDs
  const leds = [...scene.querySelectorAll('[id^="rack-"] path[fill="#9FD4A8"]')].map(p => ({ p, rack: p.closest('[id^="rack-left"]') ? 'left' : 'right' }));
  const ledClass = (l, cls, on) => l.p.classList.toggle(cls, on);
  // Mostly steady (70%, Arnold's pick), the rest blinking slowly: the wider racks show about 145 LEDs (70 on the left
  // rack beside the monitor), and with 70% of them blinking every 1-4 s the left of the screen never stopped flashing. Activity
  // bursts and the trouble states (down, hot, rebooting, stuck) are untouched, and stand out more against the calm.
  leds.forEach(l => {
    l.p.classList.add('led');
    if (Math.random() < .7) l.p.classList.add('steady');
    l.p.style.setProperty('--dur', (3 + Math.random() * 5).toFixed(2) + 's');
    l.p.style.setProperty('--delay', (-Math.random() * 8).toFixed(2) + 's');
  });
  function ledBurst(n = 7) {
    if (room.melting) return;
    hum.activity(n);
    for (let i = 0; i < n; i++) {
      const l = leds[rnd(leds.length)];
      if (['down', 'hot', 'rebooting', 'stuck'].some(c => l.p.classList.contains(c))) continue;
      ledClass(l, 'burst', false); void l.p.getBBox(); ledClass(l, 'burst', true);
      setTimeout(() => ledClass(l, 'burst', false), 340);
    }
  }
  const powerLed = $('bezel').querySelector('path[fill="#9FD4A8"]');
  powerLed.classList.add('power-led');

  // ------------------------------------------------------------ room state: power, brightness, theme
  const room = { power: true, brightness: 1, theme: 'blue', melting: false, coffee: 1 };
  const THEMES = {
    blue:  { text: '#e9edff', dim: '#aab4ee', glow: 'rgba(200,210,255,.45)' },
    green: { text: '#b6ffc4', dim: '#6fcf85', glow: 'rgba(140,255,170,.55)' },
    amber: { text: '#ffd28a', dim: '#d9a15a', glow: 'rgba(255,200,120,.55)' },
  };
  function setTheme(name) {
    const t = THEMES[name]; if (!t) return false;
    room.theme = name;
    terminal.style.setProperty('--term-text', t.text);
    terminal.style.setProperty('--term-dim', t.dim);
    terminal.style.setProperty('--term-glow', t.glow);
    return true;
  }
  // knobs on the monitor chin: left = power, right = brightness
  const chinPaths = $('chin-details').querySelectorAll('path');
  const knobPower = { face: chinPaths[13], mark: chinPaths[14], cx: 738.5, cy: 92.5 };
  const knobBright = { face: chinPaths[15], mark: chinPaths[16], cx: 797.5, cy: 91.5 };
  const setKnob = (k, deg) => k.mark.setAttribute('transform', `rotate(${deg} ${k.cx} ${k.cy})`);
  for (const k of [knobPower, knobBright]) { k.face.classList.add('knob'); k.mark.classList.add('knob-mark'); }

  function setBrightness(v) {
    room.brightness = clamp(v, 0, 1);
    // the text fades into the glass as the brightness goes down (Arnold, 2026-10-01: a brightness filter darkened it
    // toward a muddy bronze, the amber and red worst); the glass itself still dims
    termCanvas.style.opacity = (.3 + .7 * room.brightness).toFixed(3);
    screenG.style.filter = `brightness(${(.6 + .4 * room.brightness).toFixed(3)})`;
    setKnob(knobBright, -135 + 270 * room.brightness);
    eyeStrain();
    try { term.refresh(); } catch (e) {}              // (the burn-in shows with the brightness down)
  }
  // a dimmer screen tires you a little less: energy drains 15% slower with the brightness all the way down
  // (the knob is first set while the page loads, before the shift exists; startShift applies it then)
  function eyeStrain() { try { shift.setStrain(.85 + .15 * room.brightness); } catch (e) {} }
  setBrightness(1);
  {
    // Drag around the knob: its value follows the angle of the pointer around the knob's center,
    // like turning a real dial. Straight down is the dead zone between min and max.
    let dragging = false;
    const angleTo = e => {
      const r = knobBright.face.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      return Math.atan2(dx, -dy) * 180 / Math.PI;            // 0 = up, +90 = right, ±180 = down
    };
    const turnTo = e => {
      const a = angleTo(e);
      if (Math.abs(a) > 160) return;                          // ignore the dead zone at the bottom
      setBrightness((clamp(a, -135, 135) + 135) / 270);
    };
    knobBright.face.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; knobBright.face.setPointerCapture(e.pointerId); turnTo(e); });
    knobBright.face.addEventListener('pointermove', e => { if (dragging) turnTo(e); });
    const stop = () => { dragging = false; };
    knobBright.face.addEventListener('pointerup', stop);
    knobBright.face.addEventListener('pointercancel', stop);
    knobBright.face.addEventListener('wheel', e => { e.preventDefault(); setBrightness(room.brightness - Math.sign(e.deltaY) * .08); }, { passive: false });
  }

  // The monitor off costs something (Arnold, 2026-09-30: it could be turned off freely, which would cheapen the
  // finale's last act): the night carries on without you, alerts land where you can't see them, and a few seconds
  // in, once a night, Glenn notices and leaves a line on the dark screen, an order; turning it back on is doing it.
  // The knob always works. On night 3, with the racks dark, turning it off means something else (design.md).
  let darkTimer = 0, keptOnTimer = 0;
  async function setPower(on) {
    if (room.power === on) return;
    room.power = on;
    clearTimeout(darkTimer); clearTimeout(keptOnTimer);
    // a few seconds dark, once a night: you hear him typing upstairs; the line is there when the screen comes back,
    // and its order is about what comes next (an order about the past can't be obeyed)
    if (!on && !room.darkNoticed && !account.loggingIn) darkTimer = setTimeout(() => {
      if (room.power || room.darkNoticed) return;
      room.darkNoticed = true;
      glenn.leave("Screen went dark on my end, chief. When it's back on, be a pal and keep it on.");
      glenn.order('power', 'be a pal and keep it on');
    }, 4000);
    // kept on for two minutes after it: complied
    if (on) keptOnTimer = setTimeout(() => { if (room.power) glenn.complied('power'); }, 120000);
    setKnob(knobPower, on ? 0 : -70);
    hum.update(1.5);
    powerLed.classList.toggle('off', !on);
    if (!on) {
      term.setMode('off');
      terminal.classList.add('off');
      screenG.classList.add('off');
      degauss(false);
    } else {
      screenG.classList.remove('off');
      degauss(true);
      await wait(350);
      terminal.classList.remove('off');
      terminal.classList.add('warm');
      setTimeout(() => terminal.classList.remove('warm'), 1700);
      await wait(600);
      term.setMode('shell');
    }
  }
  // until the basics are done the knob won't turn: a stiff wiggle, a click, and it springs back (Glenn says why, once)
  function powerLocked() {
    if (glenn.basicsDone() || !room.power) return false;
    setKnob(knobPower, -9); detent(false);
    setTimeout(() => setKnob(knobPower, 4), 70); setTimeout(() => setKnob(knobPower, 0), 150);
    if (glenn.once('power-locked', "Be a pal and leave the power alone till we're through the basics, chief.")) glenn.order('power-alone', 'be a pal and leave the power alone till we\'re through the basics');
    return true;
  }
  knobPower.face.addEventListener('pointerdown', e => { e.preventDefault(); hint.classList.add('gone'); if (powerLocked()) return; setPower(!room.power); });
  // the knob turned by no hand, as the keys go down by themselves: it starts, hesitates, and goes (the night's end)
  async function turnItself(on) {
    if (room.power === on) return;
    setKnob(knobPower, on ? -58 : -12);
    await wait(on ? 380 : 420);
    await setPower(on);
  }

  // ---- the cartridge slot on the chin, left of the power LED
  // The cartridge is a box drawn in the illustration's language (top face, side, front cap, thin grey
  // strokes) and animated along the depth axis: at d=0 it sits flush in the slot; larger d means it
  // protrudes toward the viewer, so the cap projects lower and slightly larger and the top face appears.
  room.cart = false;
  const cart = document.createElementNS(SVG, 'g');
  cart.id = 'cart';
  cart.innerHTML = `
    <polygon class="cart-side"   fill="#DEDEDC" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"/>
    <polygon class="cart-bottom" fill="#D2D2D0" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"/>
    <polygon class="cart-cap"    fill="#ECECEA" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"/>
    <polygon class="cart-label"  fill="#D2D2D0"/>
    <polygon class="cart-grip"   fill="#D2D2D0"/>
    <polygon class="cart-grip2"  fill="#D2D2D0"/>`;
  $('chin-details').querySelector('svg').appendChild(cart);
  const cartEls = Object.fromEntries(['side', 'bottom', 'cap', 'label', 'grip', 'grip2'].map(k => [k, cart.querySelector('.cart-' + k)]));
  // The slot opening, from the drawing itself (chin asset coordinates): TL, TR, BR, BL.
  const SLOT = [[17.26, 78.70], [55.19, 79.67], [53.60, 98.00], [15.52, 96.90]];
  // The drawing's vanishing centre, in the same coordinates. Measured from the keycaps: their front edges
  // sit left of and below their back edges, which puts the eye roughly level with the top of the keyboard.
  // A point that comes toward the viewer moves away from this centre and scales up by the same factor.
  const EYE = [412, 196.5];
  const toward = ([x, y], k) => [EYE[0] + (x - EYE[0]) * (1 + k), EYE[1] + (y - EYE[1]) * (1 + k)];
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const quadAt = (q, u, v) => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);   // bilinear point in a quad
  const poly = (el, pts) => el.setAttribute('points', pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '));
  const subQuad = (q, u0, u1, v0, v1) => [quadAt(q, u0, v0), quadAt(q, u1, v0), quadAt(q, u1, v1), quadAt(q, u0, v1)];
  // k = how far the cartridge stands proud of the chin (0 = flush with the opening)
  function renderCart(k, alpha = 1) {
    const [fTL, fTR, fBR, fBL] = SLOT;
    const near = SLOT.map(p => toward(p, k));
    const [nTL, nTR, nBR, nBL] = near;
    poly(cartEls.side, [fTR, fBR, nBR, nTR]);        // right side, seen because the slot is left of the eye
    poly(cartEls.bottom, [fBL, fBR, nBR, nBL]);      // underside, seen because the eye is below the chin
    cartEls.side.style.display = cartEls.bottom.style.display = k > .002 ? '' : 'none';
    poly(cartEls.cap, near);
    poly(cartEls.label, subQuad(near, .08, .92, .18, .34));
    poly(cartEls.grip, subQuad(near, .08, .50, .68, .76));
    poly(cartEls.grip2, subQuad(near, .62, .92, .68, .76));
    cart.style.opacity = alpha;
  }
  let cartAnim = null;
  function animateCart(from, to, ms, ease, alphaOf, done) {
    cancelAnimationFrame(cartAnim);
    const t0 = performance.now();
    (function frame(now) {
      const u = Math.min(1, (now - t0) / ms), e = ease(u), d = from + (to - from) * e;
      renderCart(d, alphaOf ? alphaOf(u, d) : 1);
      if (u < 1) cartAnim = requestAnimationFrame(frame); else done?.();
    })(t0);
  }
  const easeInOut = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  // The shift starts with the slot empty: the cartridge is in the desk drawer. Reaching for the empty slot is
  // looking down to the drawer.
  room.cart = false;
  cart.style.display = 'none';
  for (const el of [chinPaths[1], chinPaths[2], cart]) {
    el.classList.add('slot');
    el.addEventListener('pointerdown', e => { e.preventDefault(); room.cart ? ejectCart() : reachForCart(); hint.classList.add('gone'); });
  }
  // The hand brings it square to the slot with its back end level with the chin (k = from), pushes it in, and
  // it seats a touch proud of the chin (k = .012) with a small settle.
  function insertCart(from, label) {
    playtest('cartridge in: ' + label);
    if (room.cart) return;
    room.cart = label;
    if (label === 'PONG') { glenn.once('pong', 'Pong! The last operator practically lived on that thing.'); }
    glenn.did('inserted');
    cart.style.display = '';
    animateCart(from, .012, 720 * (from - .012) / .063, u => easeInOut(u), null, () => {
      clunk(false);
      animateCart(.012, .02, 90, easeOut, null, () => animateCart(.02, .012, 140, easeOut));
    });
    term.mount(label);
  }
  // Resolves once the cartridge is back in its recess. swap: another one was picked from the drawer, so the
  // hand does not pause at the grip (the view is on the drawer, the slot out of sight above it).
  function ejectCart(swap = false) {
    if (!room.cart) return Promise.resolve();
    const label = room.cart;
    room.cart = false;
    clunk(true);
    term.mount(false);
    // pops out to a grip position, pauses, is drawn out until its back end clears the chin, then the hand
    // carries it back to the drawer
    return new Promise(done => animateCart(.012, .045, 380, easeOut, null, () => {
      setTimeout(() => animateCart(.045, handoffK(), 240, easeInOut, null, () => {
        cart.style.display = 'none'; putAway(CARTS[label].slot, label).then(done);
      }), swap ? 0 : 320);
    }));
  }

  // ---- looking down. The head rests in one of two places, on the screen or on the desk, and tilts between
  // them: the whole view slides up inside the frame (for a tilt this small, turning the head is close to
  // shifting the picture). The view is always pulled toward where it is heading by a critically damped
  // spring, so scrolling, a click or a drawer can redirect it midway without a jolt.
  //   - Scrolling (wheel or trackpad) moves the view directly; when it stops, the view settles on the nearer
  //     rest, or on the other one if it was pushed a fifth of the way there.
  //   - At the frame's edge toward the other rest, the cursor becomes an arrow and the view leans that way a
  //     little, which is the hint; a click there goes.
  //   - Typing looks at the screen.
  const lookEl = $('look'), DM = drawerMotion, DOWN = DM.look.depth;
  // how far down the desk rest is: further once the drawer is open, to take in the case and the drawer front
  const downRest = () => room.drawer ? DM.look.open : DOWN;
  // one step further: the pedestals, the knee space and the floor line (the pedestal desk, design.md)
  const FAR = 1000;
  const rests = () => [0, downRest(), FAR];
  const look = { y: 0, v: 0, rest: 0, target: 0, peek: 0, lean: 0, raf: 0, waiters: [] };
  const OMEGA = 10;                                      // spring stiffness: 95% there in about 0.47 s, no overshoot
  function lookRun() {
    if (look.raf) return;
    let last = performance.now();
    look.raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const a = OMEGA * OMEGA * (look.target - look.y) - 2 * OMEGA * look.v;
      look.v += a * dt; look.y += look.v * dt;
      const settled = Math.abs(look.target - look.y) < .5 && Math.abs(look.v) < 4;
      if (settled) { look.y = look.target; look.v = 0; }
      lookEl.style.transform = `translateY(${(-look.y).toFixed(2)}px)`;
      look.lean = Math.min(look.y, DOWN) / DOWN * .9;   // near things move a little more than far ones (no more past the desk)
      // whoever is waiting (the drawer, the hand) goes on once the view has arrived, not after the spring's
      // last half pixel; a lean at an edge counts as arrived
      if (look.waiters.length && Math.abs(look.target - look.y) < 15 && Math.abs(look.v) < 250) {
        const w = look.waiters; look.waiters = []; w.forEach(f => f());
      }
      if (settled) { look.raf = 0; return; }
      look.raf = requestAnimationFrame(frame);
    });
  }
  function aim() { look.target = look.rest + look.peek; lookRun(); }
  function lookAt(rest) {
    if (rest !== look.rest) playtest('look ' + (rest === 0 ? 'up' : rest >= 1000 ? 'down, all the way' : 'down'));
    look.rest = rest; look.peek = 0; placeZones(); aim();
    return new Promise(done => look.waiters.push(done));
  }
  const lookTo = down => lookAt(down ? downRest() : 0);
  // the rest one step below or above this one
  const stepFrom = (rest, dir) => { const rs = rests(), i = rs.findIndex(r => Math.abs(r - rest) < 1); return rs[clamp((i < 0 ? 0 : i) + dir, 0, rs.length - 1)]; };
  // the edges: an arrow cursor, a lean toward the other rest, and a click to go there
  const zones = { down: document.createElement('div'), up: document.createElement('div') };
  for (const [name, z] of Object.entries(zones)) {
    z.className = 'look-zone ' + name;
    document.body.appendChild(z);
    z.addEventListener('mouseenter', () => { look.peek = name === 'down' ? 30 : -30; aim(); });
    z.addEventListener('mouseleave', () => { look.peek = 0; aim(); });
    z.addEventListener('click', () => { lookAt(stepFrom(look.rest, name === 'down' ? 1 : -1)); hint.classList.add('gone'); });
  }
  function placeZones() {
    const r = stage.getBoundingClientRect(), band = r.height * .05;
    Object.assign(zones.down.style, { display: look.rest < FAR ? '' : 'none', top: (r.bottom - band) + 'px', height: (innerHeight - r.bottom + band) + 'px' });
    Object.assign(zones.up.style, { display: look.rest > 0 ? '' : 'none', top: '0px', height: (r.top + band) + 'px' });
  }
  addEventListener('resize', placeZones); placeZones();
  {
    // Scrolling over the monitor never tilts the view (that is where you read), and elsewhere a gesture has
    // to push past a small dead zone first, so a stray flick of the wheel does not send you to the desk.
    const DEAD = 60;
    let idle = 0, from = 0, pushed = 0;
    addEventListener('wheel', e => {
      if (e.target.closest?.('.knob')) return;          // the brightness knob turns on the wheel
      if (e.target.closest?.('#terminal, #screen, #bezel')) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (!idle) { from = look.rest; pushed = 0; }
      clearTimeout(idle);
      idle = setTimeout(() => {
        idle = 0;
        const moved = look.target - from;
        lookAt(Math.abs(moved) > DOWN * .2 ? stepFrom(from, Math.sign(moved)) : from);
      }, 160);
      const past = p => Math.sign(p) * Math.max(0, Math.abs(p) - DEAD);   // how far a push is past the dead zone
      const was = pushed; pushed += dy;
      const move = past(pushed) - past(was);
      if (!move) return;
      look.peek = 0;
      look.target = clamp(look.target + move, -40, FAR + 40);
      lookRun();
    }, { passive: true });
  }

  // ---- the desk drawer (geometry and motion in drawer.js). The desk's front, its apron and the drawer sit in
  // the desk's layer, under the keyboard, moved with the parallax of something nearer than the keyboard.
  const deskG = document.createElementNS(SVG, 'g');
  deskG.id = 'desk-front';
  let lostNights = 0; try { lostNights = +localStorage.getItem('vigil.lost') || 0; } catch (e) {}
  // The lost-night pieces (design.md, sleep is the exit): one more thing for every night lost, in a fixed order,
  // kept forever, never announced. 1 the mug's handle turned the other way; 2 `last` shows a login on a night not
  // played yet; 3 a hidden file in ~ from M.; 4 burn-in on the tube, readable with the brightness down; 5 a note
  // on Pong's sticker; 6 "don't trust the red" scratched into DEFRAG's recess; 7 a polaroid (with the polaroids);
  // 8 `ping <your name>` answers.
  const piece = n => lostNights >= n;
  // (the file drawer, the right pedestal's lowest, is drawn live in its own groups, first: its opening, its inside
  // clipped to it, its outside, its front)
  deskG.innerHTML = deskDrawer.desk({ pedestal: true, tally: lostNights, fileFront: false })
    + `<g></g><clipPath id="file-hole"><polygon/></clipPath><g clip-path="url(#file-hole)"></g><g></g><g class="slot"></g><g class="slot"></g>`
    + `<clipPath id="drawer-hole"><polygon/></clipPath><g clip-path="url(#drawer-hole)"></g><g></g><g></g><g class="slot"></g>`;
  const holeClip = deskG.querySelector('#drawer-hole polygon'), fileHoleClip = deskG.querySelector('#file-hole polygon');
  const [fileOpening, fileIn, fileOut, fileFront, fileHits, drawerIn, drawerOut, drawerHits, drawerFront] = deskG.querySelectorAll(':scope > g');
  $('desk').after(deskG);
  const DESK_FRONT_DEPTH = -.45;
  function deskParallax(cx, cy) {
    const k = DESK_FRONT_DEPTH - .25;                    // relative to the desk layer it sits in
    deskG.style.transform = `translate(${(cx * k * 9).toFixed(2)}px, ${(cy * k * 6).toFixed(2)}px)`;
  }

  room.drawer = false;
  // the cartridges in the case, each with its own recess (front row left to right, then the back row) in the
  // order the night hands them over: PONG is there from the start, the rest turn up during the night
  const CARTS = Object.fromEntries(['PONG', 'DEFRAG', 'ROUTE', 'COOLANT', 'HEAP', 'POWER', 'FIREWALL', 'SCAN'].map((c, slot) => [c, { slot }]));
  const tray = { travel: 0, carts: [{ slot: 0, label: 'PONG', lift: 0 }],
    notes: piece(4) ? { PONG: 'it lets you win.' } : {},
    scratch: piece(5) ? { slot: 1, lines: ["don't trust", 'the red'] } : null };
  let drawerBusy = false;
  function drawDrawer() {
    const r = deskDrawer.render(tray);
    holeClip.setAttribute('points', r.hole);
    drawerIn.innerHTML = r.inner;
    drawerOut.innerHTML = r.outer;
    drawerHits.innerHTML = r.hits.map(h =>
      `<polygon class="slot" data-slot="${h.slot}" points="${h.points}" fill="transparent" stroke="transparent" stroke-width="8" stroke-linejoin="round"/>`).join('');
    drawerFront.innerHTML = r.front;
  }
  const tween = (ms, step) => new Promise(done => {
    const t0 = performance.now();
    (function frame(now) {
      const u = Math.min(1, (now - t0) / ms);
      step(u); drawDrawer();
      if (u < 1) requestAnimationFrame(frame); else done();
    })(t0);
  });
  async function openDrawer() {
    if (!room.drawer) playtest('drawer open');
    glenn.complied('drawer');
    if (room.drawer) return;
    room.drawer = true;
    if (look.rest) { look.rest = downRest(); aim(); }      // the head follows it down
    drawerSound(true, DM.open.ms * DM.open.stopAt);
    await tween(DM.open.ms, u => { tray.travel = DM.open.travel(u); });
  }
  async function closeDrawer() {
    if (room.drawer) playtest('drawer closed');
    if (!room.drawer) return;
    room.drawer = false;
    if (look.rest) { look.rest = downRest(); aim(); }
    drawerSound(false, DM.close.ms);
    await tween(DM.close.ms, u => { tray.travel = DM.close.travel(u); });
  }
  // reaching for the empty slot: look down to the drawer and open it
  async function reachForCart() {
    if (drawerBusy) return;
    drawerBusy = true;
    await lookTo(true);
    await openDrawer();
    drawerBusy = false;
  }
  // ---- the hand: a cartridge carried between the drawer and the slot is drawn here, over everything, as one
  // rigid box (drawer.js). It lies flat with its cap forward the whole way, which is how the slot takes it.
  const handSvg = document.createElementNS(SVG, 'svg');
  handSvg.id = 'hand';
  handSvg.setAttribute('viewBox', '0 0 1440 2200'); handSvg.setAttribute('width', '1440'); handSvg.setAttribute('height', '2200');
  lookEl.appendChild(handSvg);
  // the slot in scene coordinates: its centre and width, from the drawing's opening in the chin
  const chinSvg = $('chin-details').querySelector('svg'), chinBox = ['x', 'y', 'width', 'height'].map(a => +chinSvg.getAttribute(a));
  const chinVB = chinSvg.getAttribute('viewBox').split(' ').map(Number);
  const inScene = ([x, y]) => [chinBox[0] + x * chinBox[2] / chinVB[2], chinBox[1] + y * chinBox[3] / chinVB[3]];
  const slotScene = SLOT.map(inScene);
  const slotC = [slotScene.reduce((a, p) => a + p[0], 0) / 4, slotScene.reduce((a, p) => a + p[1], 0) / 4];
  const slotW = (Math.hypot(slotScene[1][0] - slotScene[0][0], slotScene[1][1] - slotScene[0][1]) + Math.hypot(slotScene[2][0] - slotScene[3][0], slotScene[2][1] - slotScene[3][1])) / 2;
  const cartSize = deskDrawer.cartPose({ slot: 0, lift: 1 }, 1);
  function handoffK() { return deskDrawer.clearOfSlot(cartSize, slotW); }
  // parallax while carried: from the desk front's depth to the chin's
  let handDepth = DESK_FRONT_DEPTH;
  function handParallax(cx, cy) { handSvg.style.transform = `translate(${(cx * handDepth * 9).toFixed(2)}px, ${(cy * handDepth * 6).toFixed(2)}px)`; }
  // carry a cartridge along the flight from the drawer to the slot (or back, reversed)
  function carry(slot, label, toSlot) {
    const inDrawer = deskDrawer.cartPose({ slot, lift: 1 }, 1);
    const atSlot = deskDrawer.slotPose(cartSize, slotC[0], slotC[1], slotW, handoffK());
    const path = deskDrawer.flight(inDrawer, atSlot);
    return new Promise(done => {
      const t0 = performance.now();
      (function frame(now) {
        const u = Math.min(1, (now - t0) / DM.fly.ms), s = toSlot ? u : 1 - u;
        handDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s;
        handSvg.innerHTML = deskDrawer.renderCartridge(path(s), label, tray.notes[label]);
        if (u < 1) requestAnimationFrame(frame); else { handSvg.innerHTML = ''; done(); }
      })(t0);
    });
  }

  // a cartridge from the drawer goes to the slot: pulled toward you and lifted clear of the drawer, carried up
  // to the monitor as the head comes back up, and pushed in. The drawer is left open; its front closes it.
  // With another cartridge in the monitor, that one comes out and goes back to its recess first.
  async function takeCart(slot) {
    if (drawerBusy || !tray.carts.some(c => c.slot === slot)) return;
    if (room.cart) { drawerBusy = true; await ejectCart(true); }
    const c = tray.carts.find(c => c.slot === slot);
    if (!c) { drawerBusy = false; return; }
    drawerBusy = true;
    await tween(DM.take.ms, u => { c.lift = DM.take.lift(u); });
    tray.carts.splice(tray.carts.indexOf(c), 1); drawDrawer();
    lookTo(false);
    await carry(slot, c.label, true);
    insertCart(handoffK(), c.label);
    drawerBusy = false;
  }
  // an ejected cartridge goes back to its recess: carried down as the head looks down and the drawer opens,
  // lowered in. The drawer is left open.
  async function putAway(slot, label) {
    drawerBusy = true;
    lookTo(true);
    await Promise.all([carry(slot, label, false), openDrawer()]);
    const c = { slot, label, lift: 1 };
    tray.carts.push(c);
    await tween(DM.put.ms, u => { c.lift = DM.put.lift(u); });
    drawerBusy = false;
  }
  drawerFront.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (drawerBusy) return;
    hint.classList.add('gone');
    room.drawer ? closeDrawer() : openDrawer();
  });
  drawerHits.addEventListener('pointerdown', e => {
    const slot = e.target.dataset?.slot;
    if (slot === undefined) return;
    e.preventDefault();
    takeCart(+slot);
  });
  drawDrawer();

  // ---- the file drawer (design.md, the file drawer): locked from night 1; M.'s key, for beating 14 at Pong, opens it.
  // Inside, the old operators' folders, and the first polaroid loose on them until you have looked at it; then it is
  // filed in your folder, and your tab has your initials. Kept between nights and across a logout (the room remembers):
  // vigil.file = { unlocked, filed }.
  // key: where M.'s key is: 'none' (still under Pong), 'desk', or 'lock' (and the drawer unlocked)
  const file = { travel: 0, open: false, busy: false, unlocked: false, filed: false, clicks: 0, key: 'none', turn: 1 };
  try { Object.assign(file, JSON.parse(localStorage.getItem('vigil.file') || '{}')); } catch (e) {}
  if (file.key === 'coming') file.key = 'desk';          // (a page closed while the key was on its way to the desk)
  const keepFile = () => { try { localStorage.setItem('vigil.file', JSON.stringify({ unlocked: file.unlocked, filed: file.filed, key: file.key, filedShift: file.filedShift })); } catch (e) {} };
  // which shift this is, counted across nights: every start of one is a boot at 23:00 (a page load, or a night's end)
  let shiftNo = 0;
  // Your initial on your tab: not when the photo is filed. The tab stays blank the rest of that night; at the next 23:00
  // boot it is just there, in the hand of whoever labels these folders (Caveat), written in while you were away. No line
  // acknowledges it (Arnold, 2026-10-02).
  const initialsShown = () => file.filed && file.filedShift != null && shiftNo > file.filedShift;
  const NIGHT1_PHOTO = { strip: '23:00' };
  const initialsOf = name => (name || '').trim().split(/\s+/).map(w => w[0] || '').join('').toLowerCase().slice(0, 3) || (account.user || '').slice(0, 2);
  function drawFile() {
    const r = deskDrawer.renderFile({ travel: file.travel, lock: { key: file.unlocked, turn: file.unlocked ? file.turn : 0 },
      photos: file.unlocked && !file.lifted ? [{ photo: NIGHT1_PHOTO, filed: file.filed }] : [], initials: initialsShown() ? initialsOf(account.name) : '' });
    fileHoleClip.setAttribute('points', r.hole);
    fileOpening.innerHTML = r.opening; fileIn.innerHTML = r.inner; fileOut.innerHTML = r.outer;
    fileFront.innerHTML = r.front + `<polygon points="${r.hits.front}" fill="transparent"/>`;
    fileHits.innerHTML = r.hits.loose ? `<polygon data-hit="loose" points="${r.hits.loose}" fill="transparent"/>` : r.hits.filed ? `<polygon data-hit="filed" points="${r.hits.filed}" fill="transparent"/>` : '';
  }
  const fileTween = (ms, step) => new Promise(done => {
    const t0 = performance.now();
    (function frame(now) { const u = Math.min(1, (now - t0) / ms); step(u); drawFile(); if (u < 1) requestAnimationFrame(frame); else done(); })(t0);
  });
  // locked: it doesn't come out at all, it rattles in place, a couple of pixels (Arnold, 2026-10-02). Its sound is a
  // recording Arnold will supply (assets/sounds/fx/drawer-locked); silent until then.
  async function rattleFile() {
    file.busy = true; file.clicks++;
    playtest('file drawer: locked (' + file.clicks + ')');
    playFx('drawer-locked', .6, .45);
    const parts = [fileFront, fileOut, fileIn];
    for (const dx of [2, -2, 1.5, -1, .5, 0]) { for (const g of parts) g.style.transform = dx ? `translate(${dx}px, 0)` : ''; await wait(30); }
    file.busy = false;
    // the first time only, Glenn, and that is the order that logs; around the fifth try, once more
    if (glenn.once('file-locked', "That one stays locked, chief. Nothing in there for you. Be a pal and leave it be.")) glenn.order('file', 'be a pal and leave it be');
    if (file.clicks >= 5) glenn.once('file-persistent', "Persistent, aren't we?");
  }
  async function openFile() {
    if (file.open) return;
    file.open = true; file.busy = true;
    playtest('file drawer open');
    drawerSound(true, DM.open.ms * DM.open.stopAt);
    const t0 = file.travel;
    await fileTween(DM.open.ms, u => { file.travel = t0 + (1 - t0) * DM.open.travel(u); });
    file.busy = false;
    setTimeout(() => glenn.once('file-key', "Where'd you get that, chief?"), 2000);
  }
  async function closeFile() {
    if (!file.open) return;
    file.open = false; file.busy = true;
    playtest('file drawer closed');
    drawerSound(false, DM.close.ms);
    await fileTween(DM.close.ms, u => { file.travel = DM.close.travel(u); });
    file.busy = false;
  }
  fileFront.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (file.busy) return;
    hint.classList.add('gone');
    if (!file.unlocked) { rattleFile(); return; }
    if (held) return;
    file.open ? closeFile() : openFile();
  });
  setTimeout(drawFile);                               // (after the whole page is set up: your initials come from the login)

  // ---- M.'s key (design.md, the key is M.'s payoff for 14). The match in which you rally 15 or more ends; then the slot
  // pops by itself, the cartridge comes out and turns over in front of you, underside toward you, a key taped across it.
  // The key lifts off and is set on the desk by its front edge; the cartridge goes back to its recess. Click the key: the
  // view goes down and it flies to the lock, goes in, turns a quarter with a click, and the drawer comes out a little. It
  // stays in the lock. Everything here is a solid in the room's camera (solid.js, key3d.js), one size throughout.
  const keyLayer = document.createElementNS(SVG, 'svg');
  keyLayer.id = 'key-flight';
  keyLayer.setAttribute('viewBox', '0 0 1440 2200'); keyLayer.setAttribute('width', '1440'); keyLayer.setAttribute('height', '2200');
  lookEl.appendChild(keyLayer);
  let keyDepth = DESK_FRONT_DEPTH;
  function keyParallax(cx, cy) { keyLayer.style.transform = `translate(${(cx * keyDepth * 9).toFixed(2)}px, ${(cy * keyDepth * 6).toFixed(2)}px)`; }
  const deskKeyG = document.createElementNS(SVG, 'g');
  deskKeyG.classList.add('slot');
  deskG.appendChild(deskKeyG);
  // rotations: a frame (A, B, N = A x B) as a quaternion and back, and the shorter way between two
  const v3 = { add: (p, q) => p.map((v, i) => v + q[i]), mul: (p, k) => p.map(v => v * k), lerp: (p, q, t) => p.map((v, i) => v + (q[i] - v) * t),
    cross: (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], norm: p => { const l = Math.hypot(...p); return p.map(v => v / l); } };
  const rotAbout = (v, ax, t) => { const c = Math.cos(t), s = Math.sin(t), d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2], x = v3.cross(ax, v); return [0, 1, 2].map(i => v[i] * c + x[i] * s + ax[i] * d * (1 - c)); };
  function quatOf(A, B) {
    const N = v3.cross(A, B), m = [[A[0], B[0], N[0]], [A[1], B[1], N[1]], [A[2], B[2], N[2]]], tr = m[0][0] + m[1][1] + m[2][2];
    let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]; }
    else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [(m[2][1] - m[1][2]) / s, .25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]; }
    else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, .25 * s, (m[1][2] + m[2][1]) / s]; }
    else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, .25 * s]; }
    return q;
  }
  function frameOf([w, x, y, z]) {
    return { A: [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)], B: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)] };
  }
  function slerp(q0, q1, t) {
    let d = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3];
    if (d < 0) { q1 = q1.map(v => -v); d = -d; }
    if (d > .9995) { const q = q0.map((v, i) => v + (q1[i] - v) * t), l = Math.hypot(...q); return q.map(v => v / l); }
    const th = Math.acos(d), s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th);
    return q0.map((v, i) => v * s0 + q1[i] * s1);
  }
  // a pose between two: the centre along a cubic (c1, c2 its pulls), the turn the shorter way round
  const between = (p0, p1, t, c1 = p0.c, c2 = p1.c) => {
    const r = 1 - t, k = [r * r * r, 3 * r * r * t, 3 * r * t * t, t * t * t];
    return { c: [0, 1, 2].map(i => k[0] * p0.c[i] + k[1] * c1[i] + k[2] * c2[i] + k[3] * p1.c[i]), ...frameOf(slerp(quatOf(p0.A, p0.B), quatOf(p1.A, p1.B), t)) };
  };
  const easeIO = s => s < .5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
  const motion = (ms, step) => new Promise(done => { const t0 = performance.now(); (function frame(now) { const u = Math.min(1, (now - t0) / ms); step(u); if (u < 1) requestAnimationFrame(frame); else done(); })(t0); });
  const KMM = window.key3d ? key3d.MM : 1 / 1.765;
  // the poses. In the slot, as drawer.js's flight leaves it; held up close, framed on its taped end (the camera does the
  // work: the key is one size everywhere); the key on the cartridge's underside; on the desk by its front edge, right of
  // the keyboard; in front of the lock, upright; in it.
  const slotSolid = () => { const p = deskDrawer.slotPose(cartSize, slotC[0], slotC[1], slotW, handoffK()); return { c: [p.x, p.y, p.z + cartSize.L / 2], A: [1, 0, 0], B: [0, 0, 1] }; };
  // the key across the middle of the cartridge's underside, on a slant (key millimetres, key3d.js)
  const KEY_ON_CART = { a: 0, b: -6, turn: -32 * Math.PI / 180 };
  // held up in front of the tube, across, tipped back a little, underside toward you: brought about 2.1 times nearer than
  // the slot (it sits at a depth of about 1000; Arnold, 2026-10-02: at 6.7 times it loomed, then shrank going home)
  const heldCart = (() => {
    let A = [1, 0, 0], B = [0, -1, 0];
    for (const [ax, t] of [[[0, 0, 1], Math.PI / 2 - .04], [[1, 0, 0], -18 * Math.PI / 180], [[0, 1, 0], -9 * Math.PI / 180]]) { A = rotAbout(A, ax, t); B = rotAbout(B, ax, t); }
    const Z = 470;
    return { c: [0, (440 - 813) * Z / 1500, Z], A, B: v3.mul(B, -1) };
  })();
  function keyOnCart(pose) {             // as renderCartridgeSolid lays it on the underside
    const { c, A, B } = pose, N = v3.cross(A, B), T = cartSize.t / KMM, kt = KEY_ON_CART.turn;
    const KA = [0, 1, 2].map(i => A[i] * Math.cos(kt) + B[i] * Math.sin(kt)), KB = [0, 1, 2].map(i => -(-A[i] * Math.sin(kt) + B[i] * Math.cos(kt)));
    return { c: [0, 1, 2].map(i => c[i] + (A[i] * KEY_ON_CART.a + B[i] * KEY_ON_CART.b + N[i] * (-T / 2 - 1)) * KMM), A: KA, B: KB };
  }
  const DESK_KEY = (() => { const A = [Math.cos(.5), 0, Math.sin(.5)], N = [0, -1, 0]; return { c: v3.add(deskDrawer.toCamF([1300, 1300, -.02]), [0, -KMM, 0]), A, B: v3.cross(N, A) }; })();
  const lockPose = (out, z = 0) => { const f = deskDrawer.toCamF([deskDrawer.LOCK.x, deskDrawer.LOCK.y, z]); return { c: [f[0], f[1], f[2] + (2.5 - out) * KMM], A: [0, 0, 1], B: [0, -1, 0] }; };
  const flatOrRoom = s => p => { const a = deskDrawer.proj(p), b = deskDrawer.roomF(p); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]; };
  function drawDeskKey() {
    if (file.key !== 'desk') { deskKeyG.innerHTML = ''; return; }
    const [x, y] = deskDrawer.roomF(DESK_KEY.c);
    deskKeyG.innerHTML = key3d.render(DESK_KEY, deskDrawer.roomF) + `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="34" ry="16" fill="transparent"/>`;
  }
  // the key's small sounds: set down on the desk (two light metal ticks), going into the lock (a short scrape), turning
  // (a bright click with a knock under it)
  function keySound(kind) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    const noise = (at, ms, f, q, v, shape = 4) => { const len = Math.floor(ctx.sampleRate * ms / 1000), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape); const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = v; s.connect(bp).connect(g).connect(ctx.destination); s.start(at); };
    const ring = (at, f, v, ms) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(.0005, at + ms / 1000); o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + ms / 1000 + .01); };
    if (kind === 'land') { noise(t, 25, 3400, 3, .12); ring(t, 2900, .012, 90); noise(t + .07, 18, 3800, 3, .06); }
    if (kind === 'in') { noise(t, 140, 2400, 1.2, .07, 1.5); noise(t + .13, 20, 1600, 2, .12); }
    if (kind === 'turn') { noise(t, 22, 3000, 2.5, .18); ring(t, 1900, .02, 60); const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t + .01); o.frequency.exponentialRampToValueAtTime(80, t + .05); const g = ctx.createGain(); g.gain.setValueAtTime(.1, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .07); o.connect(g).connect(ctx.destination); o.start(t + .01); o.stop(t + .08); }
  }
  async function keyFromPong() {
    if (room.cart !== 'PONG' || file.key !== 'none' || file.unlocked) return;
    file.key = 'coming';
    playtest('pong: 14 beaten, the key');
    room.cart = false; clunk(true); term.mount(false);
    // pops out as it does on eject, and is drawn clear of the chin
    await new Promise(done => animateCart(.012, .045, 380, easeOut, null, () => setTimeout(() => animateCart(.045, handoffK(), 240, easeInOut, null, done), 320)));
    cart.style.display = 'none';
    // it comes toward you and turns over, underside toward you
    const from = slotSolid(), size = cartSize, note = tray.notes.PONG;
    await motion(1700, u => {
      const s = easeIO(u); handDepth = .25;
      handSvg.innerHTML = deskDrawer.renderCartridgeSolid(between(from, heldCart, s, v3.add(from.c, [0, 40, -60]), v3.add(heldCart.c, [0, -30, 30])), size, { label: 'PONG', note, key: KEY_ON_CART });
    });
    await wait(2600);
    // the key lifts off and is set on the desk; the cartridge turns back and goes home
    lookTo(true);
    const k0 = keyOnCart(heldCart);
    const flyKey = motion(1600, u => {
      const s = easeIO(u); keyDepth = .25 + (DESK_FRONT_DEPTH - .25) * s;
      keyLayer.innerHTML = key3d.render(between(k0, DESK_KEY, s, v3.add(k0.c, v3.mul(v3.cross(heldCart.A, heldCart.B), -40)), v3.add(DESK_KEY.c, [0, -90, 0])), flatOrRoom(s));
    }).then(() => { keyLayer.innerHTML = ''; file.key = 'desk'; keepFile(); drawDeskKey(); keySound('land'); });
    await motion(1200, u => { handSvg.innerHTML = deskDrawer.renderCartridgeSolid(between(heldCart, from, easeIO(u)), size, { label: 'PONG', note }); });
    handSvg.innerHTML = '';
    await Promise.all([putAway(CARTS.PONG.slot, 'PONG'), flyKey]);
  }
  async function keyToLock() {
    if (file.key !== 'desk' || file.busy) return;
    file.busy = true; deskKeyG.innerHTML = '';
    playtest('the key: to the lock');
    keyDepth = DESK_FRONT_DEPTH;
    lookAt(FAR);
    // (Arnold, 2026-10-02: it was too quick.) It rises off the desk and comes over in an arc, slows as it lines up with
    // the keyway a few centimetres out, and slides in, slowing to a stop rather than snapping home. A beat. Then the
    // turn: stiff at first, giving back a little, then the pins let go and it turns through with the click.
    const at = d => lockPose(d), drawAt = (d, pose = at(d)) => { keyLayer.innerHTML = key3d.render(pose, deskDrawer.roomF, { maxA: 17.5 + d }); };
    const out = at(30);
    await motion(1700, u => { keyLayer.innerHTML = key3d.render(between(DESK_KEY, out, easeIO(u), v3.add(DESK_KEY.c, [0, -190, -50]), v3.add(out.c, [0, -80, -90])), deskDrawer.roomF); });
    await motion(600, u => drawAt(30 - 21 * (1 - Math.pow(1 - u, 2))));
    keySound('in');
    await motion(700, u => drawAt(9 * Math.pow(1 - u, 3)));
    drawAt(0);
    await wait(450);
    keyLayer.innerHTML = '';
    // in the lock now, drawn with the drawer
    file.unlocked = true; file.key = 'lock'; file.turn = 0;
    const smooth01 = x => x * x * (3 - 2 * x);
    const TURN = [[0, 0], [.42, .13], [.52, .105], [.66, .17], [.86, .97], [1, 1]];    // [time, turn], eased within each step
    let clicked = false;
    await fileTween(1100, u => {
      let k = 1; while (k < TURN.length - 1 && u > TURN[k][0]) k++;
      const [t0, a0] = TURN[k - 1], [t1, a1] = TURN[k];
      file.turn = a0 + (a1 - a0) * smooth01(Math.min(1, Math.max(0, (u - t0) / (t1 - t0))));
      if (!clicked && u >= .84) { clicked = true; keySound('turn'); }
    });
    file.turn = 1;
    glenn.broke('file');
    keepFile();
    // and the drawer comes out a little, with the drawer's knock
    await wait(160);
    drawerSound(true, 140);
    await fileTween(260, u => { file.travel = .07 * (3 * u * u - u * u * u) / 2; });
    file.busy = false;
  }
  deskKeyG.addEventListener('pointerdown', e => { e.preventDefault(); keyToLock(); });
  setTimeout(drawDeskKey);

  // ---- the first polaroid (design.md, the first polaroid is yours, and you don't know it yet). Clicked where it lies
  // loose, it is lifted and held up in front of you; clicked away, it goes down into your folder at the back and stands
  // there, and only then does your tab have your initials. Never commented on. Clicked again, it comes out again. It
  // moves as a card in the camera, turning the shorter way; its projection blends from the room's (bent) to the near
  // camera's as it comes up, so it leaves the drawer and lands back in it exactly where the drawer draws it.
  const catcher = document.createElement('div');
  catcher.id = 'held-catcher';
  Object.assign(catcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(catcher);
  function heldPhoto() {                          // up in front of you, upright, a little turned, wherever you are looking
    const Z = 190, r = -2 * Math.PI / 180;           // (close enough to look at: about 300 px across)
    return { c: [0, (look.rest + 470 - 813) * Z / 1500, Z], A: [Math.cos(r), Math.sin(r), 0], B: [-Math.sin(r), Math.cos(r), 0] };
  }
  const roomOrFlat = s => p => { const a = deskDrawer.roomF(p), b = deskDrawer.proj(p); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]; };
  let held = false;
  async function liftPhoto() {
    if (file.busy || held || !file.open) return;
    file.busy = true; held = true;
    playtest('polaroid: lifted' + (file.filed ? ' (from your folder)' : ''));
    const from = deskDrawer.photoPose(file.filed), to = heldPhoto();
    file.lifted = true; drawFile();
    keyDepth = DESK_FRONT_DEPTH;
    await motion(700, u => {
      const s = easeIO(u); keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s;
      keyLayer.innerHTML = deskDrawer.renderCard(between(from, to, s, v3.add(from.c, [0, -60, -20]), v3.add(to.c, [0, 30, 40])), roomOrFlat(s), NIGHT1_PHOTO, 1 + .5 * s).svg;
    });
    catcher.style.display = '';
    file.busy = false;
  }
  async function putPhotoDown() {
    if (!held || file.busy) return;
    file.busy = true; catcher.style.display = 'none';
    playtest('polaroid: filed');
    const from = heldPhoto(), to = deskDrawer.photoPose(true);
    await motion(750, u => {
      const s = easeIO(u); keyDepth = .25 + (DESK_FRONT_DEPTH - .25) * s;
      keyLayer.innerHTML = deskDrawer.renderCard(between(from, to, s, v3.add(from.c, [0, 30, 40]), v3.add(to.c, [0, -70, 0])), roomOrFlat(1 - s), NIGHT1_PHOTO, 1.5 - .5 * s).svg;
    });
    keyLayer.innerHTML = '';
    if (!file.filed) file.filedShift = shiftNo;
    file.filed = true; file.lifted = false; held = false; keepFile(); drawFile();
    file.busy = false;
  }
  catcher.addEventListener('pointerdown', e => { e.preventDefault(); putPhotoDown(); });
  addEventListener('keydown', e => { if (held && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); putPhotoDown(); } }, true);
  fileHits.addEventListener('pointerdown', e => { if (!e.target.dataset?.hit) return; e.preventDefault(); liftPhoto(); });


  // ------------------------------------------------------------ parallax
  let tx = 0, ty = 0, cx = 0, cy = 0;
  const lean = { x: 0, y: 0 };                       // extra parallax while the head moves (the sip)
  addEventListener('mousemove', e => {
    tx = (e.clientX / innerWidth - .5) * 2;
    ty = (e.clientY / innerHeight - .5) * 2;
  });
  addEventListener('mouseleave', () => { tx = 0; ty = 0; });
  (function tick() {
    cx += (tx + lean.x - cx) * .08; cy += (ty + lean.y + look.lean - cy) * .08;
    for (const { el, depth, isTerminal } of layered) {
      const dx = cx * depth * 9, dy = cy * depth * 6;
      if (isTerminal) el.style.transform = `translate(${dx}px, ${dy}px) ${baseMatrix}`;
      else el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    updateGlare(cx, cy);
    deskParallax(cx, cy);
    handParallax(cx, cy);
    keyParallax(cx, cy);
    requestAnimationFrame(tick);
  })();

  // ------------------------------------------------------------ the mug
  // Coffee level drives the steam. Click to sip; `brew` refills.
  const steam = $('steam'), mug = $('mug');
  const coffeeWord = () => room.coffee > .75 ? 'hot' : room.coffee > .45 ? 'warm' : room.coffee > .15 ? 'lukewarm' : room.coffee > 0 ? 'cold' : 'empty';
  function setCoffee(v) {
    // whole percent: five sips of .2 from a full mug came to 1e-16, not 0, so an empty mug still let you drink
    room.coffee = Math.round(clamp(v, 0, 1) * 100) / 100;
    steam.style.setProperty('--steam', room.coffee.toFixed(2));
  }
  mug.addEventListener('mouseenter', () => steam.classList.add('hot'));
  mug.addEventListener('mouseleave', () => steam.classList.remove('hot'));
  // Click: a first-person sip with real geometry. The drawn mug fades out and a 3D mug takes its
  // place in the same pose, comes up toward the viewer's mouth, tips for the sip, and comes back down.
  const steamRig = $('steam-rig'), mug3dG = $('mug3d');
  const CAM = { f: 1500, px: 720, py: 813 };            // the drawing's camera: principal point at its vanishing centre
  const mug3d = createMug3D(CAM);
  let sipping = false;
  // poses in camera space (x right, y down, z forward). REST matches the drawing: body centre at the
  // drawn mug's centre, seen from four degrees above, leaning four and a half degrees to the right.
  const REST = { x: 578.5, y: 24, z: CAM.f, tilt: -.09, roll: -.078, yaw: 0 };
  const LIPS = { x: 26, y: 74, z: CAM.f / 2.5, tilt: .52, roll: -.02, yaw: .18 };
  const TIP  = { x: 22, y: 62, z: CAM.f / 2.65, tilt: .86, roll: -.02, yaw: .18 };
  function showMug(p) {
    const r = mug3d.render(turned(p), room.coffee);
    mug3dG.innerHTML = r.svg;
    steamRig.style.transform = `translate(${(r.rimFar.x - 1296).toFixed(1)}px, ${(r.rimFar.y - 756).toFixed(1)}px) scale(${r.rimFar.k.toFixed(3)})`;
  }
  // The drawn mug follows the 3D pose during the handoff so the two coincide when it takes over.
  const REST_CENTER = [CAM.px + REST.x, CAM.py + REST.y];
  function poseDrawnMug(p) {
    const k = CAM.f / p.z, cx = CAM.px + CAM.f * p.x / p.z, cy = CAM.py + CAM.f * p.y / p.z;
    mug.style.transform = `translate(${(cx - REST_CENTER[0]).toFixed(2)}px, ${(cy - REST_CENTER[1]).toFixed(2)}px) rotate(${((p.roll - REST.roll) * 180 / Math.PI).toFixed(3)}deg) scale(${k.toFixed(4)})`;
  }
  const sip = createSipTimeline({ REST, LIPS, TIP });
  const turned = p => p;                     // (the turned handle, once a lost-night piece, was cut: Arnold, 2026-10-02)
  mug.addEventListener('click', () => {
    if (sipping) return;
    hint.classList.add('gone');
    if (room.coffee <= 0) {                       // nothing left: a shake and a sad little sound
      mug.classList.remove('shake'); void mug.getBBox(); mug.classList.add('shake');
      sadSound();
      term.say(steam.dataset.said ? "still empty. try 'brew'." : 'that was the last of it.');
      steam.dataset.said = '1';
      return;
    }
    sipping = true;
    document.body.classList.add('sipping');
    showMug(REST); mug3dG.style.display = ''; mug3dG.style.opacity = 0;
    let sipped = false;
    const t0 = performance.now();
    (function frame(now) {
      const f = sip.at(now - t0);
      showMug(f.pose);
      dolly = f.dolly; shiftY = f.shiftY; placeStage();
      // the sip counts once the mug reaches it, on whatever frame gets there first. (It used to need a frame in
      // the sip's first 20 ms; a dropped frame skipped it, so the coffee never went down.)
      if (!sipped && (f.event === 'sip' || f.seg >= 3)) {
        sipped = true;
        if (room.coffee > 0) { playtest('sip'); sipSound(); steam.classList.add('puff'); setTimeout(() => steam.classList.remove('puff'), 900); setCoffee(room.coffee - .2); shift.drink(); updateVitals(); glenn.complied('coffee'); }
      }
      if (f.blend > 0) { poseDrawnMug(f.pose); mug.style.opacity = f.blend.toFixed(3); mug3dG.style.opacity = (1 - f.blend).toFixed(3); }
      else { mug.style.opacity = 0; mug3dG.style.opacity = 1; }
      if (f.event !== 'done') { requestAnimationFrame(frame); return; }
      mug.style.transform = ''; mug.style.opacity = '';
      mug3dG.style.display = 'none'; mug3dG.style.opacity = ''; mug3dG.innerHTML = ''; steamRig.style.transform = '';
      document.body.classList.remove('sipping');
      clink();
      sipping = false;
      if (room.coffee <= 0) { term.say('that was the last of it.'); steam.dataset.said = '1'; if (glenn.once('brew', "Out already? Be a pal and type brew. There's beans for three pots, so pace yourself.")) glenn.order('brew', 'be a pal and type brew'); } else steam.dataset.said = '';
    })(t0);
  });

  // ------------------------------------------------------------ sound
  let audio = null, muted = false;
  function ac() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  // Every key has a profile, like a real board: pitch shifts by row (higher at the top of the board,
  // lower at the bottom), by keycap size (wider caps sit lower and ring longer), and the stabilised
  // keys get the second impact of the stabiliser wire. Linear: one impact, no bump.
  const ROW_OF = {};
  for (const k of 'Esc Delete F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ')) ROW_OF['key-' + k] = 0;
  for (const k of 'Backtick 1 2 3 4 5 6 7 8 9 0 Minus Equals Backspace Home'.split(' ')) ROW_OF['key-' + k] = 1;
  for (const k of 'Tab Q W E R T Y U I O P BracketLeft BracketRight Backslash PageUp'.split(' ')) ROW_OF['key-' + k] = 2;
  for (const k of 'CapsLock A S D F G H J K L Semicolon Quote Enter PageDown'.split(' ')) ROW_OF['key-' + k] = 3;
  for (const k of 'LeftShift Z X C V B N M Comma Period Slash RightShift End ArrowUp'.split(' ')) ROW_OF['key-' + k] = 4;
  for (const k of 'LeftCtrl LeftSuper LeftAlt Space RightAlt Fn ArrowLeft ArrowDown ArrowRight'.split(' ')) ROW_OF['key-' + k] = 5;
  const SIZE_OF = {   // in keycap units; anything not listed is a 1u alpha
    'key-Backspace': 2, 'key-Tab': 1.5, 'key-Backslash': 1.5, 'key-CapsLock': 1.75, 'key-Enter': 2.25, 'key-LeftShift': 2.25,
    'key-RightShift': 2.75, 'key-LeftCtrl': 1.25, 'key-LeftSuper': 1.25, 'key-LeftAlt': 1.25, 'key-RightAlt': 1.25, 'key-Fn': 1.25, 'key-Space': 6.25,
  };
  function keyProfile(id) {
    const row = ROW_OF[id] ?? 3, size = SIZE_OF[id] || 1;
    const rowPitch = [1.06, 1.03, 1.0, .985, .965, .94][row];
    const sizePitch = size >= 6 ? .9 : size >= 2 ? .93 : size > 1 ? .96 : 1;
    return { pitch: rowPitch * sizePitch, stab: size >= 2, size, row };
  }

  // ---- recorded switch packs (assets/sounds, from kbsim by Thomas Lai, MIT). Press samples per row plus
  // SPACE, ENTER and BACKSPACE, and release samples. Packs load on first use and are cached.
  const PACKS = {
    // keys: a key played from another of the pack's recordings (Cream's backspace recording is all 1.6-2.3 kHz clack
    // with none of the letters' 120 Hz thock, so it borrows a letter's, pitched down to sound bigger)
    cream:     { note: 'NovelKeys Cream. linear, deep, hollow thock', keys: { 'key-Backspace': { sample: 'press/GENERIC_R3', rate: .86, gain: 1.15 } } },
    // alphaEq: filters on the letters only. Red Ink's letters sit low (a 200 Hz body) and its mods bright
    // (1.7-2 kHz): the letters get less of the first and more of the second, for the mods' snap
    redink:    { note: 'Gateron Red Ink. linear, lighter Ink', alphaEq: [{ f: 210, q: 1.4, db: -4 }, { f: 1900, q: 1.1, db: 6 }], alphaGain: .75 },   // the boost adds 2.5 dB; taken back
    alpaca:    { note: 'Alpaca. linear, clacky, bright' },
    mxblack:   { note: 'Cherry MX Black. linear, classic, full' },
    turquoise: { note: 'Turquoise Tealios. linear, smooth, mid' },
    topre:     { note: 'Topre. electro-capacitive, the classic thock' },
    boxnavy:   { note: 'Kailh Box Navy. heavy click' },
    mxblue:    { note: 'Cherry MX Blue. click' },
    // Mechvibes' built-in packs (MIT): one long recording with a table of offsets, or one file per key
    oreo:      { mv: true, dir: 'eg-oreo', note: 'EG Oreo. linear, custom-board deep thock' },
    creamkeys: { mv: true, dir: 'nk-cream', note: 'NK Cream, every key recorded separately' },
    // community packs from mechvibes.com
    melodic:   { mv: true, dir: 'neo80-melodic', note: 'Gateron Melodic on a Neo80. bright plate' },
    rosewood:  { mv: true, dir: 'akko-rosewood', note: 'Akko Rosewood. a little thock, per key' },
    sk61:      { mv: true, dir: 'sk61-brown', note: 'SK61 with lubed Browns. tactile, mid' },
    // from Thock for macOS (MIT): tuned custom-board packs, every key recorded separately
    marbly:    { mv: true, dir: 'creamy_marbly', note: 'creamy marbly. custom board, per key' },
    creamyv2:  { mv: true, dir: 'creamy_thock_v2', note: 'creamy thock v2. custom board, per key' },
    heavy:     { mv: true, dir: 'creamy_heavy', note: 'creamy heavy. deeper, per key' },
    pefoam:    { mv: true, dir: 'pe_foam_creamy', note: 'PE foam creamy. the PE sheet sound, per key' },
    glassy:    { mv: true, dir: 'glassy_custom', note: 'glassy custom. brighter, per key' },
    overlubed: { mv: true, dir: 'overlubed_custom', note: 'overlubed custom. muted and smooth, per key' },
    creamloud: { mv: true, dir: 'nk_cream_loud', note: 'NK Cream, loud take, per key' },
    // from wayclick (MIT)
    boxwhite:  { mv: true, dir: 'kailh_box_white', note: 'Kailh Box White. light click' },
  };
  let SIG_NAMES = Object.keys(PACKS);
  // any pack folder dropped into assets/sounds shows up too (the server lists them at /packs)
  // (on a static host there is no server: build-static.js writes the list to assets/sounds/packs.json)
  fetch('/packs').then(r => r.ok ? r.json() : Promise.reject()).catch(() => fetch('assets/sounds/packs.json').then(r => r.ok ? r.json() : [])).then(list => {
    for (const p of list) {
      const known = Object.entries(PACKS).find(([k, v]) => (v.dir || k) === p.dir);
      if (known) continue;
      const key = p.dir.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || p.dir;
      PACKS[key] = { dir: p.dir, mv: p.kind === 'mechvibes', note: p.title + ' (dropped in)' };
    }
    SIG_NAMES = Object.keys(PACKS);
  }).catch(() => {});
  let sigName = 'cream';
  let borrowedVoice = null;                          // while set, your own keys sound like this (04:44)
  try { let saved = localStorage.getItem('keysig'); if (saved === 'neo80') saved = 'melodic'; if (saved && PACKS[saved]) sigName = saved; } catch (e) {}
  const MV_CODE = { 'key-Esc': 1, 'key-Minus': 12, 'key-Equals': 13, 'key-Backspace': 14, 'key-Tab': 15, 'key-BracketLeft': 26, 'key-BracketRight': 27,
    'key-Enter': 28, 'key-LeftCtrl': 29, 'key-Semicolon': 39, 'key-Quote': 40, 'key-Backtick': 41, 'key-LeftShift': 42, 'key-Backslash': 43,
    'key-Comma': 51, 'key-Period': 52, 'key-Slash': 53, 'key-RightShift': 54, 'key-LeftAlt': 56, 'key-Space': 57, 'key-CapsLock': 58,
    'key-F11': 87, 'key-F12': 88, 'key-Home': 3655, 'key-PageUp': 3657, 'key-End': 3663, 'key-PageDown': 3665, 'key-Delete': 3667,
    'key-LeftSuper': 3675, 'key-RightAlt': 3640, 'key-Fn': 3613, 'key-ArrowUp': 57416, 'key-ArrowLeft': 57419, 'key-ArrowRight': 57421, 'key-ArrowDown': 57424 };
  '1234567890'.split('').forEach((d, i) => MV_CODE['key-' + d] = i === 9 ? 11 : 2 + i);
  'QWERTYUIOP'.split('').forEach((c, i) => MV_CODE['key-' + c] = 16 + i);
  'ASDFGHJKL'.split('').forEach((c, i) => MV_CODE['key-' + c] = 30 + i);
  'ZXCVBNM'.split('').forEach((c, i) => MV_CODE['key-' + c] = 44 + i);
  for (let i = 1; i <= 10; i++) MV_CODE['key-F' + i] = 58 + i;
  const MV_FALLBACK = { 0: 'key-F5', 1: 'key-5', 2: 'key-T', 3: 'key-G', 4: 'key-B', 5: 'key-Space' };   // per row, when a pack lacks a key
  const packCache = {};
  const packLoading = {};
  function loadPack(name) {
    if (packCache[name]) return Promise.resolve(packCache[name]);
    if (!packLoading[name]) packLoading[name] = loadPackNow(name).catch(e => { console.warn('pack failed', name, e); delete packLoading[name]; });
    return packLoading[name];
  }
  // Community packs often keep room tone after the hit. Once a sample has fallen 26 dB below its own peak
  // and stays there, it is faded out over 15 ms and silenced, so nothing breathes between keystrokes.
  function gateTail(buf) {
    const sr = buf.sampleRate, win = Math.floor(sr * .004);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      let peak = 0; const env = [];
      for (let i = 0; i < d.length; i += win) { let m = 0; for (let j = i; j < Math.min(d.length, i + win); j++) m = Math.max(m, Math.abs(d[j])); env.push(m); if (m > peak) peak = m; }
      const thr = peak * .05; let last = 0;
      for (let k = 0; k < env.length; k++) if (env[k] > thr) last = k;
      const cut = Math.min(d.length, (last + 2) * win), fade = Math.floor(sr * .015);
      for (let i = cut; i < d.length; i++) { const u = (i - cut) / fade; d[i] *= u < 1 ? 1 - u : 0; }
    }
    return buf;
  }
  // Levels. Every pack's letter keys play equally loud, measured the way the ear judges a click: the RMS of its
  // loudest 25 ms (matching packs by their loudest peak left them 16 dB apart; timing from the onset was thrown
  // by the soft travel noise some recordings have before the bottom-out). Space, enter,
  // backspace and the other wide keys are held between 3 dB under and 2 dB over the letters: some packs
  // recorded them four times as hot (+12 dB), so every backspace slapped.
  const LOUD = .0172;                                   // the letters' loudest 25 ms: midway between where Cream and Alpaca played before (-35 dB)
  const BIG_RANGE = [.7, 1.25];
  const LETTERS = 'ASDFGHJKLQWERTYUIOPZXCVBNM'.split('').map(c => 'key-' + c);
  function hitLoudness(buf, from = 0, len = null) {
    const sr = buf.sampleRate, d = buf.getChannelData(0);
    const a = Math.floor(from * sr), b = Math.min(d.length, len == null ? d.length : a + Math.floor(len * sr));
    return loudest25(d, a, b, sr);
  }
  // the RMS of the loudest 25 ms window in d[a, b), stepping 5 ms
  function loudest25(d, a, b, sr) {
    const w = Math.floor(sr * .025), hop = Math.floor(sr * .005);
    let best = 0;
    for (let s = a; s + w <= b || s === a; s += hop) {
      let sq = 0; const e = Math.min(b, s + w);
      for (let i = s; i < e; i++) sq += d[i] * d[i];
      best = Math.max(best, sq / Math.max(1, e - s));
      if (e >= b) break;
    }
    return Math.sqrt(best);
  }
  const median = a => { const s = a.filter(x => x > 0).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  // keys within a pack can differ a lot (SK61's rows are 5 dB apart): each is pulled three quarters of the way
  // to the pack's level, so they match but are not all identical
  const EVEN = .75;
  const evenGain = (l, row) => l > 0 && row > 0 ? Math.min(2, Math.max(.5, Math.pow(row / l, EVEN))) : 1;
  const bigGain = (l, row) => l > 0 && row > 0 ? Math.min(1, row * BIG_RANGE[1] / l) * Math.max(1, row * BIG_RANGE[0] / l) : 1;
  const normTo = row => row > 0 ? Math.min(12, Math.max(.02, LOUD / row)) : 1;   // hot recordings (NK Cream loud, Box White) need well under .2
  // a Mechvibes/Thock pack: the recording a key plays (the same choice click() makes), as buffer, start and length
  function mvSegment(pack, id) {
    let code = MV_CODE[id]; if (!(code in pack.defines)) code = MV_CODE[MV_FALLBACK[keyProfile(id).row]];
    const def = pack.defines[code];
    if (def == null) return null;
    if (pack.mv === 'single') return pack.buffers.sprite ? { buf: pack.buffers.sprite, from: def[0] / 1000, len: def[1] / 1000 } : null;
    const buf = pack.buffers[def] || pack.buffers[pack.defines[MV_CODE[MV_FALLBACK[keyProfile(id).row]]]];
    return buf ? { buf, from: 0, len: null } : null;
  }
  function levelMv(pack) {
    const loud = id => { const s = mvSegment(pack, id); return s ? hitLoudness(s.buf, s.from, s.len) : 0; };
    const row = median(LETTERS.map(loud));
    pack.norm = normTo(row);
    pack.keyGain = {};
    for (const id of Object.keys(MV_CODE)) pack.keyGain[id] = (BIG.has(id) ? bigGain : evenGain)(loud(id), row);
    return pack;
  }
  async function loadPackNow(name) {
    const ctx = ac();
    if (PACKS[name].mv) {
      const dir = 'assets/sounds/' + (PACKS[name].dir || name) + '/';
      const cfg = await fetch(dir + 'config.json').then(r => r.json());
      if (cfg.mappings && !cfg.defines) { cfg.defines = cfg.mappings; cfg.key_define_type = 'multi'; }
      const pack = { mv: cfg.key_define_type, defines: cfg.defines, buffers: {} };
      if (cfg.key_define_type === 'single') {
        pack.buffers.sprite = await ctx.decodeAudioData(await (await fetch(dir + cfg.sound)).arrayBuffer());
      } else {
        const files = [...new Set(Object.values(cfg.defines))];
        await Promise.all(files.map(async f => { try { pack.buffers[f] = await ctx.decodeAudioData(await (await fetch(dir + encodeURIComponent(f))).arrayBuffer()); } catch (e) { pack.buffers[f] = null; } }));
      }
      for (const b of Object.values(pack.buffers)) if (b) gateTail(b);
      return (packCache[name] = levelMv(pack));
    }
    const files = ['press/GENERIC_R0', 'press/GENERIC_R1', 'press/GENERIC_R2', 'press/GENERIC_R3', 'press/GENERIC_R4', 'press/SPACE', 'press/ENTER', 'press/BACKSPACE', 'release/GENERIC', 'release/SPACE', 'release/ENTER', 'release/BACKSPACE'];
    const entries = await Promise.all(files.map(async f => {
      try { const r = await fetch('assets/sounds/' + name + '/' + f + '.mp3'); if (!r.ok) return [f, null]; return [f, await ctx.decodeAudioData(await r.arrayBuffer())]; }
      catch (e) { return [f, null]; }
    }));
    const pack = Object.fromEntries(entries);
    for (const [, b] of entries) if (b) gateTail(b);
    // kbsim: the letters are the row recordings, evened in place; the big keys have their own, brought into range
    const rowBufs = [0, 1, 2, 3, 4].map(r => pack['press/GENERIC_R' + r]).filter(Boolean);
    const row = median([1, 2, 3, 4].map(r => pack['press/GENERIC_R' + r]).filter(Boolean).map(b => hitLoudness(b)));   // R0 is the function row
    pack.norm = normTo(row);
    for (const b of rowBufs) { const g = evenGain(hitLoudness(b), row); if (g !== 1) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; } }
    const relRow = pack['release/GENERIC'] ? hitLoudness(pack['release/GENERIC']) : 0;
    for (const k of ['SPACE', 'ENTER', 'BACKSPACE']) for (const dir of ['press/', 'release/']) {
      const b = pack[dir + k];
      if (!b) continue;
      const g = bigGain(hitLoudness(b), dir === 'press/' ? row : relRow);
      if (g !== 1) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
    }
    return (packCache[name] = pack);
  }
  function setSignature(name) {
    if (!PACKS[name]) return false;
    sigName = name; try { localStorage.setItem('keysig', name); } catch (e) {}
    loadPack(name);
    return true;
  }
  loadPack(sigName);

  let limiter = null;
  function keyLimiter(ctx) {
    if (limiter) return limiter;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .1;
    limiter = ctx.createBiquadFilter(); limiter.type = 'highpass'; limiter.frequency.value = 80; limiter.Q.value = .6;   // keeps any low rumble in a recording off the speakers
    limiter.connect(comp).connect(ctx.destination);
    return limiter;
  }
  // which recording a key uses: the dedicated ones for space, enter and backspace, otherwise its row
  function sampleFor(id, up) {
    if (id === 'key-Space') return up ? 'release/SPACE' : 'press/SPACE';
    if (id === 'key-Enter') return up ? 'release/ENTER' : 'press/ENTER';
    if (id === 'key-Backspace') return up ? 'release/BACKSPACE' : 'press/BACKSPACE';
    if (up) return 'release/GENERIC';
    const row = ROW_OF[id] ?? 3;
    return 'press/GENERIC_R' + Math.min(4, row);
  }
  // as: another keyboard than yours (the voices type on their own switches): { pack, gain, lowpass }
  function click(kind = 'key', up = false, id = '', as = null) {
    if (muted) return;
    if (!as && borrowedVoice) as = borrowedVoice;
    const S = as?.pack || sigName;
    const pack = packCache[S];
    if (!pack) { loadPack(S); return; }
    const ctx = ac(), t = ctx.currentTime;
    const P = keyProfile(id);
    let buf, offset = 0, duration;
    if (pack.mv) {
      let code = MV_CODE[id]; if (!(code in pack.defines)) code = MV_CODE[MV_FALLBACK[P.row]] ;
      const def = pack.defines[code];
      if (pack.mv === 'single') { buf = pack.buffers.sprite; offset = def[0] / 1000; duration = def[1] / 1000; }
      else { buf = pack.buffers[def]; if (!buf) buf = pack.buffers[pack.defines[MV_CODE[MV_FALLBACK[P.row]]]]; }
      if (!buf) return;
      if (up) duration = Math.min(duration || .06, .05);
    } else {
      buf = pack[sampleFor(id, up)] || pack[up ? 'release/GENERIC' : 'press/GENERIC_R3'];
      if (!buf) return;
    }
    const over = !up && PACKS[S].keys?.[id];
    if (over && !pack.mv && pack[over.sample]) buf = pack[over.sample];
    const src = ctx.createBufferSource(); src.buffer = buf;
    // a little life: pitch and level never quite the same twice, wide keys a touch lower
    src.playbackRate.value = (P.size >= 2 ? .97 : 1) * (1 + (Math.random() - .5) * .05);
    const g = ctx.createGain(); g.gain.value = (pack.norm || 1) * (pack.keyGain?.[id] || 1) * (PACKS[S].gain || 1) * (up ? (pack.mv ? .25 : .55) : 1) * (.9 + Math.random() * .2);
    if (pack.mv && up) src.playbackRate.value *= 1.25;
    if (over) { src.playbackRate.value *= over.rate || 1; g.gain.value *= over.gain || 1; }
    let head = src;
    if (PACKS[S].alphaEq && !BIG.has(id)) g.gain.value *= PACKS[S].alphaGain || 1;
    if (PACKS[S].alphaEq && !BIG.has(id)) for (const e of PACKS[S].alphaEq) { const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = e.f; f.Q.value = e.q; f.gain.value = e.db; head = head.connect(f); }
    if (PACKS[S].cut) { const c = PACKS[S].cut, pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = c.f; pk.Q.value = c.q; pk.gain.value = c.db; head = head.connect(pk); }
    if (PACKS[S].hiss) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = PACKS[S].hiss; lp.Q.value = .5; head = head.connect(lp); }
    if (as?.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = as.lowpass; lp.Q.value = .5; head = head.connect(lp); }
    if (as?.gain) g.gain.value *= as.gain;
    head.connect(g);
    g.connect(keyLimiter(ctx));
    if (duration !== undefined) src.start(t, offset, duration); else src.start(t, offset);
  }
  function beep(freq = 880, dur = .08, vol = .04) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  }
  // CRT power: a low "bwomp" collapsing down on off, a rising hum on warm-up
  function degauss(on) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain();
    if (on) {
      o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(110, t + .9);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .25); g.gain.exponentialRampToValueAtTime(.001, t + 1.3);
    } else {
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(24, t + .55);
      g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + .6);
    }
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1.4);
    detent(on);
  }
  // the power knob's detent: a short bright snap and a small low knock, not a keyboard switch. (It used to
  // call the key click, which became a recorded keystroke when key sounds moved to recorded packs.)
  function detent(on) {
    const ctx = ac(), t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * .03), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = on ? 3200 : 2600; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = .22;
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(90, t + .04);
    const og = ctx.createGain(); og.gain.setValueAtTime(.12, t); og.gain.exponentialRampToValueAtTime(.001, t + .05);
    o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + .06);
  }
  // cartridge: a plastic clunk seating into the slot, a lighter latch click on eject
  function clunk(eject) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * .09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = eject ? 2200 : 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(eject ? .18 : .32, t); g.gain.exponentialRampToValueAtTime(.001, t + (eject ? .05 : .09));
    src.connect(lp).connect(g).connect(ctx.destination); src.start(t);
    if (!eject) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(65, t + .1);
      const og = ctx.createGain(); og.gain.setValueAtTime(.3, t); og.gain.exponentialRampToValueAtTime(.001, t + .13);
      o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + .15);
    }
  }
  // drawer: the tray running on its slides, louder as the hand speeds it up, then the knock at the end
  // stop (open) or the thud of the latch (closed)
  function drawerSound(open, slideMs) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime, dur = slideMs / 1000;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const u = i / len; d[i] = (Math.random() * 2 - 1) * u * (2 - u); }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .7;
    const g = ctx.createGain(); g.gain.value = .07;
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t);
    const at = t + dur;
    const klen = Math.floor(ctx.sampleRate * .08), kbuf = ctx.createBuffer(1, klen, ctx.sampleRate), kd = kbuf.getChannelData(0);
    for (let i = 0; i < klen; i++) kd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / klen, 3);
    const k = ctx.createBufferSource(); k.buffer = kbuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = open ? 1400 : 700;
    const kg = ctx.createGain(); kg.gain.setValueAtTime(open ? .14 : .22, at); kg.gain.exponentialRampToValueAtTime(.001, at + .08);
    k.connect(lp).connect(kg).connect(ctx.destination); k.start(at);
    if (!open) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(55, at + .1);
      const og = ctx.createGain(); og.gain.setValueAtTime(.22, at); og.gain.exponentialRampToValueAtTime(.001, at + .12);
      o.connect(og).connect(ctx.destination); o.start(at); o.stop(at + .14);
    }
  }
  // a quiet sip: shaped noise through a narrow band
  function sipSound() {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime, dur = .42;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const u = i / len; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.pow(u, .6)); }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(420, t); bp.frequency.exponentialRampToValueAtTime(900, t + dur); bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = .16;
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t);
  }
  // recorded effects Arnold supplies, dropped into assets/sounds/fx as <name>.wav, .mp3 or .ogg: played if there,
  // silent if not (the drawer's locked rattle, the relay's click; code-made versions didn't work: Arnold, 2026-10-02)
  const fxCache = {};
  function fxBuffer(name) {
    if (!(name in fxCache)) fxCache[name] = (async () => {
      for (const ext of ['wav', 'mp3', 'ogg']) {
        try { const r = await fetch(`assets/sounds/fx/${name}.${ext}`); if (r.ok) return await ac().decodeAudioData(await r.arrayBuffer()); } catch (e) {}
      }
      return null;
    })();
    return fxCache[name];
  }
  async function playFx(name, gain = .6, pan = 0) {
    if (muted) return;
    const buf = await fxBuffer(name); if (!buf) return;
    const ctx = ac(), src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
    src.buffer = buf; g.gain.value = gain; p.pan.value = pan;
    src.connect(g).connect(p).connect(ctx.destination); src.start();
  }
  // an empty mug: two notes, both going the wrong way
  function sadSound() {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    for (const [f0, f1, t0, d] of [[392, 340, 0, .22], [330, 262, .24, .34]]) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(f0, t + t0); o.frequency.exponentialRampToValueAtTime(f1, t + t0 + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t + t0); g.gain.exponentialRampToValueAtTime(.06, t + t0 + .03); g.gain.exponentialRampToValueAtTime(.001, t + t0 + d);
      o.connect(g).connect(ctx.destination); o.start(t + t0); o.stop(t + t0 + d + .02);
    }
  }
  // ceramic clink for the mug
  function clink() {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime;
    for (const [f, a, d] of [[2350, .05, .09], [3900, .02, .05]]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + .01);
      const g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + .02);
    }
  }
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.textContent = muted ? 'sound: off' : 'sound: on';
    if (!muted) click();
  });

  // ------------------------------------------------------------ ambient hum
  // Fans (pink noise, low-passed, slowly wobbling) over a transformer hum (60Hz and harmonics).
  // It swells with rack activity and drops when the screen is powered down. On by default (Arnold, 2026-09-30: the
  // room is the immersion), fading in at the first key or click, since a page may not make sound before one; the
  // button's choice is remembered.
  const hum = (() => {
    let nodes = null, on = true, busy = 0;
    try { on = localStorage.getItem('vigil.hum') !== 'off'; } catch (e) {}
    function build() {
      const ctx = ac();
      const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // pink noise (Paul Kellet's filter), looped
      const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .96900 * b2 + w * .1538520;
        b3 = .86650 * b3 + w * .3104856; b4 = .55000 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = .5;
      const fan = ctx.createGain(); fan.gain.value = .5;
      src.connect(lp).connect(fan).connect(master); src.start();
      // a faint fan tone and its wobble
      const lfo = ctx.createOscillator(); lfo.frequency.value = .06;
      const lg = ctx.createGain(); lg.gain.value = .07; lfo.connect(lg).connect(fan.gain); lfo.start();
      for (const [f, a] of [[60, .05], [120, .022], [180, .008], [240, .004]]) {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = a; o.connect(g).connect(master); o.start();
      }
      nodes = { master };
    }
    const level = () => on ? (.55 + Math.min(busy, 1) * .45) * (room.power ? 1 : .4) : 0;
    function update(ramp = .8) { if (nodes) nodes.master.gain.setTargetAtTime(level() * .12, ac().currentTime, ramp); }
    setInterval(() => { busy *= .82; update(); }, 300);
    const wake = () => { removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true); if (on && !nodes) { build(); update(1.2); } };
    addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
    return {
      get on() { return on; },
      toggle() { on = !on; if (on && !nodes) build(); update(on ? 1.2 : .4); try { localStorage.setItem('vigil.hum', on ? 'on' : 'off'); } catch (e) {} return on; },
      activity(n) { busy = Math.min(2, busy + n * .05); },
      update,
    };
  })();
  if (PLAYTEST) {
    const b = $('export'); b.hidden = false;
    b.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([playtest.text() + '\n'], { type: 'text/plain' }));
      const d = new Date(), p = n => String(n).padStart(2, '0');   // the tester's own clock
      a.download = `vigil-playtest-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
  const humBtn = $('hum');
  const showHum = on => { humBtn.setAttribute('aria-pressed', String(!on)); humBtn.textContent = on ? 'hum: on' : 'hum: off'; };
  showHum(hum.on);
  humBtn.addEventListener('click', () => showHum(hum.toggle()));

  // ------------------------------------------------------------ 04:44
  // The wake-up (design.md, story, night 1): your keys start to sound like someone else's; then the keyboard isn't
  // yours. One line types itself on your prompt, slowly, on the previous operator's soft switch, the keycaps going
  // down with it; it waits; it takes itself back, letter by letter, and gives you your line back. Glenn has a cover
  // story. The log keeps a trace.
  const M_VOICE = () => ({ pack: sigName === 'overlubed' ? 'pefoam' : 'overlubed' });
  const idOfChar = ch => ch === ' ' ? 'key-Space' : ch === "'" ? 'key-Quote' : ch === '.' ? 'key-Period' : ch === ',' ? 'key-Comma' : ch === 'Backspace' ? 'key-Backspace' : 'key-' + ch.toUpperCase();
  const tap = ch => { const id = idOfChar(ch); press(id); setTimeout(() => release(id), 70); };
  async function wakeUp() {
    const voice = M_VOICE();
    await loadPack(voice.pack);
    borrowedVoice = voice;                              // whatever you type now isn't quite your keyboard
    await wait(3500);
    term.hold(true);
    const kept = term.takeLine();
    const msg = "you've done this before.";
    for (let i = 0; i < msg.length; i++) {
      term.ghost(msg[i]); tap(msg[i]);
      await wait(msg[i] === ' ' ? 170 : 90 + rnd(110) + (i === 6 ? 600 : 0));   // slow, and a hesitation after "you've"
    }
    await wait(1700);
    for (let i = 0; i < msg.length; i++) { term.unghost(); tap('Backspace'); await wait(40 + rnd(30)); }
    term.giveLine(kept); term.hold(false);
    borrowedVoice = null;
    room.replayedAt = shift.clock().slice(0, 5);        // only dmesg says what that was
    await wait(1400);
    glenn.say("Ha! Don't mind that, chief. Old buffer. It does that when it rains.");
  }

  // ------------------------------------------------------------ keyboard
  const CODE_TO_ID = {
    Escape: 'key-Esc', Delete: 'key-Delete', Backquote: 'key-Backtick', Home: 'key-Home',
    Backspace: 'key-Backspace', Minus: 'key-Minus', Equal: 'key-Equals', PageUp: 'key-PageUp',
    Tab: 'key-Tab', Backslash: 'key-Backslash', BracketLeft: 'key-BracketLeft', BracketRight: 'key-BracketRight',
    PageDown: 'key-PageDown', CapsLock: 'key-CapsLock', Enter: 'key-Enter', Quote: 'key-Quote',
    Semicolon: 'key-Semicolon', End: 'key-End', ShiftLeft: 'key-LeftShift', ShiftRight: 'key-RightShift',
    ArrowUp: 'key-ArrowUp', ArrowDown: 'key-ArrowDown', ArrowLeft: 'key-ArrowLeft', ArrowRight: 'key-ArrowRight',
    Slash: 'key-Slash', Period: 'key-Period', Comma: 'key-Comma', ControlLeft: 'key-LeftCtrl',
    ControlRight: 'key-LeftCtrl', MetaLeft: 'key-LeftSuper', MetaRight: 'key-LeftSuper',
    AltLeft: 'key-LeftAlt', AltRight: 'key-RightAlt', Space: 'key-Space', ContextMenu: 'key-Fn',
  };
  for (let i = 1; i <= 12; i++) CODE_TO_ID['F' + i] = 'key-F' + i;
  for (let i = 0; i <= 9; i++) CODE_TO_ID['Digit' + i] = 'key-' + i;
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') CODE_TO_ID['Key' + c] = 'key-' + c;
  const BIG = new Set(['key-Space', 'key-Enter', 'key-Backspace', 'key-LeftShift', 'key-RightShift', 'key-CapsLock', 'key-Tab']);

  // what a mouse click on a keycap should send to the terminal
  const ID_TO_KEY = { 'key-Space': ' ', 'key-Backtick': '`', 'key-Minus': '-', 'key-Equals': '=',
    'key-Backslash': '\\', 'key-BracketLeft': '[', 'key-BracketRight': ']', 'key-Semicolon': ';',
    'key-Quote': "'", 'key-Comma': ',', 'key-Period': '.', 'key-Slash': '/',
    'key-Enter': 'Enter', 'key-Backspace': 'Backspace', 'key-Tab': 'Tab', 'key-Esc': 'Escape',
    'key-ArrowUp': 'ArrowUp', 'key-ArrowDown': 'ArrowDown', 'key-ArrowLeft': 'ArrowLeft', 'key-ArrowRight': 'ArrowRight' };

  const keys = new Map();
  for (const id of new Set(Object.values(CODE_TO_ID))) {
    const g = $(id); if (!g) continue;
    g.classList.add('key'); keys.set(id, g);
  }
  $('key-Fn')?.classList.add('key');

  function press(id) {
    const g = keys.get(id) || $(id); if (!g || g.classList.contains('pressed')) return;
    g.classList.add('pressed');
    click(BIG.has(id) ? 'big' : 'key', false, id);
    ledBurst(4 + rnd(5));
  }
  function release(id) {
    const g = keys.get(id) || $(id); if (!g || !g.classList.contains('pressed')) return;
    g.classList.remove('pressed');
    click('key', true, id);
  }

  const WORD_DELETE = e => e.ctrlKey && (e.code === 'Backspace' || e.code === 'Delete');
  const PASS_THROUGH = e => e.metaKey || /^F(5|11|12)$/.test(e.code) || (e.ctrlKey && !WORD_DELETE(e));
  // Some virtual keyboards and automation send key events without a physical code; derive one from the key.
  const KEY_TO_CODE = { ' ': 'Space', '`': 'Backquote', '-': 'Minus', '=': 'Equal', '\\': 'Backslash', '[': 'BracketLeft',
    ']': 'BracketRight', ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash', 'Escape': 'Escape',
    'Enter': 'Enter', 'Backspace': 'Backspace', 'Tab': 'Tab', 'Shift': 'ShiftLeft', 'Control': 'ControlLeft', 'Alt': 'AltLeft' };
  const codeOf = e => e.code || KEY_TO_CODE[e.key] || (/^[a-z]$/i.test(e.key) ? 'Key' + e.key.toUpperCase() : /^[0-9]$/.test(e.key) ? 'Digit' + e.key : '');
  const HANDLED = new Set(['Backspace', 'Enter', 'Tab', 'Space', 'Escape']);
  addEventListener('keydown', e => {
    const code = codeOf(e), id = CODE_TO_ID[code];
    if (!PASS_THROUGH(e)) lookTo(false);
    if (id && !e.repeat) press(id);           // keycaps animate even for shortcuts we don't handle
    if (PASS_THROUGH(e)) return;
    if (WORD_DELETE(e)) { e.preventDefault(); term.input('DeleteWord'); hint.classList.add('gone'); return; }
    if (e.key.length === 1 || HANDLED.has(code) || code.startsWith('Arrow')) {
      e.preventDefault();
      if (!e.repeat || e.key.length === 1 || code === 'Backspace' || code.startsWith('Arrow')) typeKey(e.key);
    }
    hint.classList.add('gone');
  });
  addEventListener('keyup', e => { const id = CODE_TO_ID[codeOf(e)]; if (id) release(id); });
  function typeKey(k) {
    if (asleep) return;
    const lag = shift.energy < .25 ? (.25 - shift.energy) / .25 * 180 : 0;
    lag ? setTimeout(() => term.input(k), lag) : term.input(k);
  }
  addEventListener('blur', () => keys.forEach((g, id) => release(id)));
  // Night 1's first wrong thing in the room (design.md, story): a key presses itself, with its own switch sound, and
  // the letter stays on your prompt line. See it, hear it, or come back to an "m" you didn't type; start typing
  // without noticing and the shell says "mstatus: command not found". A bumped key, probably.
  function ghostKey(ch) {
    const id = 'key-' + ch.toUpperCase();
    if (!term.ghost(ch)) return;
    press(id); setTimeout(() => release(id), 110);
  }

  // mouse on keycaps
  let mouseKey = null;
  for (const [id, g] of keys) {
    g.addEventListener('mousedown', e => {
      e.preventDefault(); mouseKey = id; press(id);
      const letter = id.slice(4);
      const k = ID_TO_KEY[id] ?? (letter.length === 1 ? letter.toLowerCase() : null);
      if (k !== null) term.input(k);
      hint.classList.add('gone');
    });
  }
  addEventListener('mouseup', () => { if (mouseKey) release(mouseKey); mouseKey = null; });

  // ------------------------------------------------------------ Glenn, the night supervisor
  // The guide (design.md, story): cheerful, folksy, "chief", proper sentences with capitals, in red, "upstairs".
  // Every instruction he gives comes with "be a pal": the trigger the night 3 reveal counts (design.md), so it goes
  // on orders only, never on small talk.
  // His voice is how he types (design.md, voices): fast and sure on a clicky office board, heard muffled, as if
  // through the ceiling. His lines type in above your prompt; yours are left alone. The tutorial's lines come once
  // ever (a returning operator is just welcomed back); strikes are his every time.
  const glenn = (() => {
    const VOICE = { pack: 'mxblue', gain: .5, lowpass: 3000 };
    const MUFFLED = { pack: 'mxblue', gain: .28, lowpass: 750 };   // heard through the ceiling, with the screen dark (Arnold: more muffled)
    const TAG = '<span class="sup-tag"> GLENN </span><span class="sup"> </span>';
    let queue = Promise.resolve(), arrived = false, drawerTimer = 0, arrivalTimer = 0;
    const taught = new Set();
    try { for (const k of JSON.parse(localStorage.getItem('vigil.glenn') || '[]')) taught.add(k); } catch (e) {}
    const remember = k => { taught.add(k); try { localStorage.setItem('vigil.glenn', JSON.stringify([...taught])); } catch (e) {} };
    // fast, sure, a breath at the end of a sentence
    const pace = (ch, next) => /[.!?]/.test(ch) && next === ' ' ? 240 + Math.random() * 140 : ch === ',' ? 130 + Math.random() * 70 : 30 + Math.random() * 28;
    const idOf = ch => ch === ' ' ? 'key-Space' : /[a-z]/i.test(ch) ? 'key-' + ch.toUpperCase() : 'key-J';
    const key = (ch, v = VOICE) => { const id = idOf(ch); click('key', false, id, v); setTimeout(() => click('key', true, id, v), 55); };
    // An order ("be a pal and ...") waits for the thing it asked for; when you do it, the system notes it in the log,
    // quietly, from night 1: "operator compliance: yes (be a pal and read the runbook)". Nothing shows on the tube.
    const orders = new Map();                          // what was asked -> the words it was asked in
    function order(what, words) { orders.set(what, words.match(/be a pal[^.!?]*/i)?.[0].toLowerCase().replace(/, chief$/, '') || what); }
    function complied(what) {
      if (!orders.has(what)) return;
      logLine(`vigild[1]: operator compliance: yes (${orders.get(what)})`);
      orders.delete(what);
    }
    function broke(what) {
      if (!orders.has(what)) return;
      logLine(`vigild[1]: operator compliance: no (${orders.get(what)})`);
      orders.delete(what);
    }
    function say(...texts) {
      loadPack(VOICE.pack);
      queue = queue.then(async () => {
        await wait(500 + Math.random() * 400);            // he reads it before he answers
        while (!term.talkable() || account.loggingIn) await wait(300);   // never over the boot or the login
        for (const t of texts) {
          logLine('glenn: ' + t);
          shift?.hush(t.length * 60 + 2500);             // nothing new breaks while he is talking (a drip, with quiet for the story)
          room.talking = true;                           // (the racks' alarms go quieter under his keys)
          await term.typeLine(TAG, t, 'sup', key, pace);
          room.talking = false;
          await wait(420 + Math.random() * 300);
        }
      });
      return queue;
    }
    // a line left on the dark screen: no typing to watch, it is simply there when the monitor comes back on
    function leave(t) {
      logLine('glenn: ' + t);
      term.leave({ html: TAG + `<span class="sup">${t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>` });
      loadPack(VOICE.pack);
      let at = 0;                                        // heard, not seen: his keys, upstairs, at his pace
      for (let i = 0; i < t.length; i++) { const ch = t[i]; setTimeout(() => key(ch, MUFFLED), at); at += pace(ch, t[i + 1]); }
    }
    function once(k, ...texts) { if (taught.has(k)) return false; remember(k); say(...texts); return true; }
    // the start of the night: an introduction the first time, a welcome back after that
    // one arrival pending at a time: a logout cancels the last operator's
    function arriveIn(ms) { clearTimeout(arrivalTimer); arrivalTimer = setTimeout(arrive, ms); }
    function arrive() {
      clearTimeout(arrivalTimer);
      if (arrived) return;
      if (account.loggingIn) { arriveIn(1000); return; }
      arrived = true;
      if (taught.has('intro')) {
        if (!taught.has('basics')) remember('basics');
        say(shift.initial().length ? "Evening, chief. You're walking into a mess tonight." : 'Evening, chief! Back already. You know the drill.');
        return;
      }
      once('intro',
        "Evening, chief! Glenn here. I'm your night supervisor.",
        "I'm upstairs, keeping an eye on the same racks you are.",
        "It's quiet for now. When something breaks, it'll tell you right here. Be a pal and check status now and then.");
      order('status', 'be a pal and check status now and then');
      // the cartridges: if you haven't found the drawer by yourself in a while
      // the cartridges, Pong first (a Pong win is the fast way to DEFRAG): after the first fix, once it's quiet and
      // you're not typing (or two minutes in, if that doesn't come); not if you've found the drawer by yourself
      const since = performance.now();
      drawerTimer = setTimeout(function drawer() {
        if (room.cart || room.drawer || taught.has('drawer')) return;
        const quiet = taught.has('fixed') && !shift.open().length;
        if (term.idleFor() < 4000 || (!quiet && performance.now() - since < 120000)) { drawerTimer = setTimeout(drawer, 1000); return; }
        // a suggestion, not an order (Arnold, 2026-10-02): Glenn sends you to Pong as fuel for the job; it logs nothing.
        // He doesn't know what's taped under the cartridge.
        once('drawer', (quiet ? "It's quiet now. " : '') + "Take five, chief. Play a round of Pong. Rested operators last longer.");
      }, 6000);
    }
    // The basics (Arnold, 2026-09-30: constraints, as games have them): the power knob stays locked until the operator
    // has fixed a unit and put a cartridge in. Glenn marks the end. A returning operator starts with them done.
    function basicsDone() { return taught.has('basics'); }
    function checkBasics() {
      if (basicsDone() || !taught.has('fixed') || !taught.has('inserted')) return;
      once('basics', "That's the basics, chief. You're on your own from here.");
      complied('power-alone');
    }
    function did(what) { if (!taught.has(what)) { remember(what); checkBasics(); } }
    // a new operator (after logout) is someone Glenn hasn't met
    function forget() { taught.clear(); arrived = false; clearTimeout(drawerTimer); clearTimeout(arrivalTimer); try { localStorage.removeItem('vigil.glenn'); } catch (e) {} }
    // clocked out and back in: he arrives again ("Back already.")
    function newNight() { arrived = false; }
    return { say, leave, once, arrive, arriveIn, forget, newNight, order, complied, broke, did, basicsDone, checkBasics, taught: k => taught.has(k) };
  })();

  // ------------------------------------------------------------ mail
  // The inbox (design.md, story): the welcome, then the night's mail as it arrives, corporate life with something
  // slightly off in each one, every message setting something up for later; and the previous operator's notes.
  // "You have new mail." lands above the prompt like Glenn's lines. mail shows the inbox, mail <n> opens one
  // (Arnold: one command, laid out properly). The night's mail comes again every night: it is the
  // same night.
  const inbox = (() => {
    let box = [];
    const NIGHT = [
      { t: 30, from: 'IT Operations', addr: 'it@site4.vigil', subject: 'Maintenance tonight, 03:00', body: () => [
        'Scheduled power maintenance tonight between 03:00 and 03:05. You may notice a brief interruption. No action is needed.',
        '', 'Please do not touch the breaker panel.', '', { text: 'IT Operations, Site 4', cls: 'dim' }] },
      { t: 120, from: 'Facilities', addr: 'facilities@site4.vigil', subject: 'Lift out of service', body: () => [
        'The lift on level 2 is out of service until further notice. Please use the stairs.',
        '', 'We apologise for any inconvenience.', '', { text: 'Facilities, Site 4', cls: 'dim' }] },
      { t: 210, from: 'Vigil Weekly', addr: 'news@vigil', subject: 'Operator of the month', body: () => [
        "This month's operator of the month is M., Site 4, nights.",
        '', '11,408 consecutive shifts, and not one missed. Congratulations, M.!',
        '', { text: 'Vigil Weekly. Someone is always awake.', cls: 'dim' }] },
      { t: 375, from: 'day shift', addr: 'dayshift@site4.vigil', subject: 'running late', body: () => [
        'running a bit late. hold the fort.', '', { text: '- day shift', cls: 'dim' }] },
    ];
    const welcome = {
      from: 'Vigil Systems', addr: 'people@site4.vigil', subject: 'Welcome to the night shift', at: '23:00', welcome: true,
      body: () => [
        `${account.name}, welcome to Site 4. You are our night operator.`,
        '',
        "Keep the racks alive from 23:00 until the day shift arrives at 05:30. Trouble shows up on this terminal. Your supervisor, Glenn, will walk you through the rest. Coffee is provided. We're so glad you're here.",
        '',
        { text: 'Vigil Systems. Someone is always awake.', cls: 'dim' }],
    };
    let sent = new Set();
    // a new night: the welcome (read if you read it before), and the night's mail still to come
    function reset() { box = [{ ...welcome, read: !!account.mailRead }]; sent = new Set(); }
    function add(m, quiet = false) {
      box.push({ at: shift.clock().slice(0, 5), ...m, read: false });
      logLine(`mail: new message from ${m.from}`);
      if (!quiet) { term.announce([{ text: 'You have new mail.', cls: 'dim' }]); beep(740, .04, .02); }
      updateVitals();
    }
    // the night's mail, by the shift clock
    function tick(t) { for (const m of NIGHT) if (t >= m.t && !sent.has(m)) { sent.add(m); add(m); } }
    const unread = () => box.filter(m => !m.read);
    function read(i, footer = true) {
      const m = box[i];
      if (!m) return [`mail: there's no message ${i + 1}. type mail to see them.`];
      m.read = true;
      if (m.welcome) { account.mailRead = true; try { localStorage.setItem('vigil.mailRead', '1'); } catch (e) {} }
      const more = unread().length;
      return [{ text: `From: ${m.from}${m.addr ? ` <${m.addr}>` : ''}`, cls: 'dim' }, { text: `Subject: ${m.subject}`, cls: 'dim' }, '',
        ...m.body(), ...(more && footer ? [{ text: `(${more} more unread: type mail)`, cls: 'dim' }] : [])];
    }
    // mail <n> still opens one when typed; plain mail is the picker in the terminal (arrows and enter)
    function command(args) {
      const a0 = (args[0] || '').toLowerCase();
      return /^[0-9]+$/.test(a0) ? read(+a0 - 1) : null;
    }
    return { reset, add, tick, command, items: () => box, open: i => read(i, false), unread: () => unread().length };
  })();

  // ------------------------------------------------------------ the shift (clock, incidents, energy: shift.js)
  // Incidents only happen on units whose LED the player can see, at any window shape from 4:3 to 16:9 (measured
  // in the page on Arnold's 1920 frame: most of the inner left rack, and 13 units of the inner right one through
  // its door glass; the outer racks are cropped at 4:3, and the left one's mesh door hides its LEDs). Eleven of
  // them, spread top to bottom, as the pacing in shift-audit.js was tuned for. Short names, for typing fast.
  const UNITS = {};
  for (const [side, nums] of [['left', [10, 14, 20, 27, 33, 41, 47]], ['right', [10, 17, 29, 47]]]) {
    for (const n of nums) {
      const g = $(`rack-${side}-unit-${n}`), paths = g ? [...g.querySelectorAll('path[fill="#9FD4A8"]')] : [];
      UNITS[side[0].toUpperCase() + n] = { side, n, leds: leds.filter(l => paths.includes(l.p)) };
    }
  }
  const unitName = u => !UNITS[u] ? 'the whole rack' : `rack-${UNITS[u].side}, unit ${UNITS[u].n}`;   // a no-break space: the wrap keeps 'unit 10' together
  // an incident's look on its unit's LED: dark when down, a slow amber pulse when hot, a fast blink rebooting
  // a rack dropping packets (LOSS): the inner rack's LEDs drop out and come back, each on its own beat
  const RACK_LEDS = { 'rack-left': leds.filter(l => l.p.closest('#rack-left')), 'rack-right': leds.filter(l => l.p.closest('#rack-right')) };
  function rackLed(rack, on) {
    for (const l of RACK_LEDS[rack] || []) { ledClass(l, 'dropping', on); if (on) l.p.style.setProperty('--drop', (-Math.random() * 1.7).toFixed(2) + 's'); }
  }
  // traffic flowing again: the rack's LEDs blink in a chain, top to bottom
  function rackFlow(rack) {
    const list = (RACK_LEDS[rack] || []).slice().sort((a, b) => a.p.getBBox().y - b.p.getBBox().y);
    list.forEach((l, i) => setTimeout(() => { ledClass(l, 'burst', false); void l.p.getBBox(); ledClass(l, 'burst', true); setTimeout(() => ledClass(l, 'burst', false), 340); }, i * 18));
  }
  function fixLanded(u) {
    if (!UNITS[u]) { unitLed(u, null); return; }
    playFx('relay-click', .5, UNITS[u].side === 'left' ? -.6 : .6);
    unitLed(u, 'stuck');
    setTimeout(() => unitLed(u, 'down'), 240);
    setTimeout(() => { if (!shift.open().some(o => o.unit === u)) unitLed(u, null); }, 520);
  }
  function unitLed(u, look) {
    if (!UNITS[u]) { rackLed(u, look === 'loss'); return; }
    for (const l of UNITS[u].leds) for (const c of ['down', 'hot', 'rebooting', 'stuck', 'flash']) ledClass(l, c, c === look);
  }
  let shift = null, shiftT = 0, asleep = false, ghostAt = Infinity, ghostDone = false, woke = false;
  // ---- the second login (design.md, night 1's off-notes; Arnold, 2026-10-02). Once a night, about 01:30, a session
  // opens on tty2 with no name on it, and the live log says so, quietly. For about a real minute someone types somewhere
  // else in the building, far off, on a switch none of the other voices has; then it closes, and the log says that too.
  // who shows it while it is open; last keeps it, its times and no name.
  const tty2 = { open: null, closed: null };
  async function tty2Session() {
    tty2.open = shift.clock().slice(0, 5); tty2.closed = null;
    logLine('tty2: session opened.');
    const pack = ['topre', 'boxwhite', 'alpaca'].find(p => p !== sigName && p !== 'mxblue');
    await loadPack(pack);
    const far = { pack, gain: .1, lowpass: 820 }, KEYS = ['key-E', 'key-T', 'key-A', 'key-O', 'key-N', 'key-S', 'key-R', 'key-I', 'key-H', 'key-L', 'key-Space', 'key-Space', 'key-Enter'];
    const end = performance.now() + 58000 + Math.random() * 6000;
    while (performance.now() < end && !asleep && !room.melting) {
      const n = 5 + rnd(14);
      for (let i = 0; i < n && performance.now() < end; i++) { const k = KEYS[rnd(KEYS.length)]; click('key', false, k, far); setTimeout(() => click('key', true, k, far), 60 + rnd(40)); await wait(95 + rnd(120)); }
      await wait(1200 + rnd(3200));
    }
    tty2.closed = shift.clock().slice(0, 5);
    logLine('tty2: session closed.');
    try { const t2 = JSON.parse(localStorage.getItem('vigil.tty2') || '[]'); t2.push({ date: new Date().toDateString().slice(0, 10), open: tty2.open, closed: tty2.closed }); localStorage.setItem('vigil.tty2', JSON.stringify(t2.slice(-8))); } catch (e) {}
  }
  // who is on shift: the name typed at login, kept between nights (the night doesn't carry over; you do)
  const account = { name: null, user: 'operator', lastLogin: null, loggingIn: true };
  try { account.name = localStorage.getItem('vigil.operator'); account.lastLogin = localStorage.getItem('vigil.lastLogin'); } catch (e) {}
  // the login name, as a shell would have it: the first word, lower case, letters and digits
  const userOf = name => (name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'operator').slice(0, 12);
  if (account.name) account.user = userOf(account.name);
  // anything the operator does keeps them from sitting idle (idle past a real minute, energy drains faster)
  for (const ev of ['keydown', 'pointerdown', 'wheel']) addEventListener(ev, () => shift?.poke(), { capture: true, passive: true });
  const lastAlert = new Map();                         // unit -> real time it last alerted, for reminders
  // what the previous operator says about each cartridge as it turns up, and how it reaches you
  const NOTES = {
    DEFRAG: {
      body: ["when one gets stuck and a reboot won't hold it:", 'DEFRAG. desk drawer, next to pong.'],
      won: { head: '(sent when you beat pong)', pre: ['not bad. I left you something.'] },
      calm: { head: '(sent by cron, on a quiet night)', post: ["(or beat my score at pong. it's quicker.)"] },
      timer: { head: '(sent by cron, on a timer)', post: ["(or beat my score at pong. it's quicker.)"] },
    },
    ROUTE: {
      body: ['when a rack starts dropping packets:', 'ROUTE. desk drawer, third along.'],
      won: { head: '(sent when you fixed a stuck unit)', pre: ['you put it back together. good.'] },
      calm: { head: '(sent by cron, on a quiet night)', post: ["(or win at defrag. it's quicker.)"] },
      timer: { head: '(sent by cron, on a timer)', post: ["(or win at defrag. it's quicker.)"] },
    },
  };
  function startShift() {
    playtest('night starts');
    try { shiftNo = (+localStorage.getItem('vigil.shifts') || 0) + 1; localStorage.setItem('vigil.shifts', String(shiftNo)); } catch (e) { shiftNo++; }
    if (typeof drawFile === 'function') setTimeout(drawFile);   // (a tab's initials may have been written in while you were away)
    for (const u in UNITS) unitLed(u, null);
    lastAlert.clear();
    // ?night=60 plays a whole night in 60 real seconds, for trying it out; ?level=2 plays the second night.
    // Which night you are on is kept (vigil.night): clocking out at the end of one moves you to the next, up to
    // the third; a lost night reloads the page into the same night again; a new operator starts at the first.
    const q = new URLSearchParams(location.search), night = +q.get('night');
    let kept = 1; try { kept = Math.min(3, Math.max(1, +localStorage.getItem('vigil.night') || 1)); } catch (e) {}
    const level = +q.get('level') || kept;
    shift = createShift({ units: Object.keys(UNITS), level, ...(night > 0 ? { realMs: night * 1000 } : {}) });
    // a night that starts mid-crisis (night 3): the LEDs already say so behind the login; the alerts come once you're in
    for (const e of shift.initial()) unitLed(e.unit, { DOWN: 'down', HOT: 'hot', STUCK: 'stuck', LOSS: 'loss' }[e.kind]);
    shiftT = performance.now();
    // a new night starts with only what the night hands over: Pong in the drawer, the rest found again
    tray.carts = shift.startsWith.filter(l => l !== room.cart).map(label => ({ slot: CARTS[label].slot, label, lift: 0 })); drawDrawer();
    if (room.cart && room.cart !== 'PONG') shift.find(room.cart);   // one still in the slot stays yours
    eyeStrain();
    if (room.coffee < 1) setCoffee(1);                 // a new night starts with a full mug
    room.defragTaught = false;                         // and the night's first DEFRAG teaches
    room.pongHaunted = false;                          // and the night's first Pong isn't only yours
    inbox.reset();                                     // the welcome, and the night's mail to come
    room.tty2Done = false; woke = false;               // tty2, and 04:44
    tty2.open = tty2.closed = null;
    room.darkNoticed = false;                          // Glenn notices the monitor going dark, once a night
    room.routeTaught = false; room.routeWon = false;   // the night's first ROUTE teaches; 23 answers once it is won
    room.mShortcut = false;                            // M.'s note on doing several at once (night 1, when it gets busy)
    ghostAt = 75 + Math.random() * 45; ghostDone = false;   // the key that presses itself: 00:15 to 01:00
  }
  startShift();

  // what the racks do, shown in the room: the LED, the log, and an alert above whatever is being typed
  function showEvent(e, quiet = false) {
    if (e.type === 'incident') {
      unitLed(e.unit, { DOWN: 'down', HOT: 'hot', STUCK: 'stuck', LOSS: 'loss' }[e.kind]);
      const text = e.kind === 'LOSS' ? `${e.unit} dropping packets (${12 + rnd(20)}% loss)`
        : e.kind === 'DOWN' ? `${e.unit} not responding (${unitName(e.unit)})`
        : e.kind === 'HOT' ? `${e.unit} at ${74 + rnd(7)}C, throttling (${unitName(e.unit)})`
        : `${e.unit} stuck: fragmented, jobs piling up (${unitName(e.unit)})`;
      quiet ? logLine('vigild[412]: ' + text) : raiseAlert(text, e.unit);
    } else if (e.type === 'escalate') {
      unitLed(e.unit, 'down');
      quiet ? logLine(`vigild[412]: ${e.unit} overheated and shut down`) : raiseAlert(`${e.unit} overheated and shut down`, e.unit);
    } else if (e.type === 'strike') {
      // the night supervisor, who is watching the same racks from somewhere else
      glenn.say(e.n === 1 ? `${e.unit} has been down ${e.min} minutes, chief. That's one. No big deal. Everybody gets one.`
        : e.n === 2 ? `${e.unit}. ${e.min} minutes. That's two, chief. Let's not make it three.`
        : `${e.unit}. That's three, chief. I'm sorry. Be a pal and go on home.`);
      beep(294, .14, .035); setTimeout(() => beep(220, .2, .035), 170);   // lower and slower than an alert
    } else if (e.type === 'relieved' || e.type === 'dawn') {
      endOfNight(e.report);
    } else if (e.type === 'found') {
      // the next cartridge turns up, pointed to by the previous operator: a message on the cartridge just beaten
      // (the fast path), or a note left on a timer for a quiet night (the slow path, which says so)
      if (!tray.carts.some(c => c.label === e.cart) && room.cart !== e.cart) { tray.carts.push({ slot: CARTS[e.cart].slot, label: e.cart, lift: 0 }); drawDrawer(); }
      const n = NOTES[e.cart], src = n[e.how] || n.calm;
      // one quote: the note's own lines between the previous operator's words before and after (short enough not to wrap)
      const said = [...(src.pre || []), ...n.body, ...(src.post || [])];
      // it comes as mail (Arnold, 2026-09-30: it used to land on the screen mid-typing), from no one it will name
      // (the previous operator stays a mystery), how it got here
      // in the first line, then the note
      inbox.add({ from: '(unknown)', addr: '', subject: '(no subject)', body: () => [{ text: src.head, cls: 'dim' }, '', ...said] });
    }
  }
  setInterval(() => {
    const now = performance.now(), dt = now - shiftT; shiftT = now;
    if (room.melting || asleep || account.loggingIn) return;   // the room is busy dying, you are out, or not in yet
    for (const e of shift.tick(dt)) showEvent(e);
    inbox.tick(shift.t);
    // the second login, about 01:30, when nobody is talking
    if (!room.tty2Done && shift.t >= 150 && shift.t < 300 && !room.talking && !borrowedVoice) { room.tty2Done = true; tty2Session(); }
    // 04:44 (344 shift minutes in), at the shell, looking at the screen; if you are busy, as soon as you're not
    if (!woke && shift.t >= 344 && shift.t < 380 && term.inShell() && look.rest === 0 && !document.hidden) { woke = true; wakeUp(); }
    // the first dip in energy: the company line, then coffee (one moment, not two: the coffee line used to come at 45%)
    if (shift.energy < .5 && glenn.once('coffee', 'Stay sharp, chief. Operators found asleep get reassigned. Company policy!', "You're fading on me. Be a pal and have some coffee. Give the mug a click.")) glenn.order('coffee', 'be a pal and have some coffee');
    // M.'s first shortcut (design.md: one each night), help arriving when the racks pile up late on night 1: past
    // 03:00 with two problems open, or at 04:15 whatever happens. It names two units that are down right then.
    if (shift.level === 1 && !room.mShortcut && !shift.over && ((shift.t >= 240 && shift.open().length >= 2) || shift.t >= 315)) {
      room.mShortcut = true;
      const down = shift.open().filter(o => o.kind === 'DOWN' && !o.fixing).map(o => o.unit), [a, b] = down.length >= 2 ? down : ['L27', 'L41'];
      inbox.add({ from: '(unknown)', addr: '', subject: '(no subject)', body: () => [{ text: '(sent by cron, when it got busy)', cls: 'dim' }, '',
        "you don't have to do them one at a time.", `reboot ${a} ${b}`, 'reroute takes more than one too.', '', "he won't like it.",
        { text: '(it was never my plan to stay this long.)', cls: 'dim' }] });   // ("my plan": a breadcrumb to finger m)
    }
    // once a night, while you sit looking at an empty prompt, the M key goes down by itself
    if (!ghostDone && !shift.over && shift.t >= ghostAt && look.rest === 0 && !document.hidden && term.idleFor() > 5000 && term.lineEmpty()) { ghostDone = true; ghostKey('m'); }
    // an incident left alone says so again, without the fix: the player works that out
    if (!shift.over) for (const o of shift.open()) {
      if (o.fixing || now - (lastAlert.get(o.unit) || now) < 40000) continue;
      lastAlert.set(o.unit, now);
      term.announce([{ text: `! ${o.unit} still ${{ DOWN: 'down', HOT: 'running hot', STUCK: 'stuck', LOSS: 'dropping packets' }[o.kind]} (${Math.round(o.forMin)} min)`, cls: 'alert' }]);
      beep(660, .06, .02);
    }
    updateVitals();
  }, 250);
  // an alert: into the log, onto the screen above whatever is being typed, and a short two-tone beep.
  // It says what is wrong, never the fix.
  function raiseAlert(text, unit) {
    if (glenn.once('alert', "There's your first one! Be a pal and read the runbook: type cat runbook. It's a real page-turner.")) glenn.order('runbook', 'be a pal and read the runbook');
    logLine('vigild[412]: ' + text);
    lastAlert.set(unit, performance.now());
    term.announce([{ text: '! ' + text, cls: 'alert' }]);
    beep(880, .05, .03); setTimeout(() => beep(660, .07, .03), 90);
  }

  // ---- the racks under strain (design.md: rack trouble is heard). Not a beep (a piezo chirp was tried: Arnold, "suuuuuper
  // annoying"): a rack with trouble on it spins its fans up, a low rush from its side of the room that rises in level
  // and pitch as its most urgent problem nears its next strike and dies away when it is fixed, felt more than heard,
  // kept under the room's hum; the one signal that reaches you during a cartridge game. A down unit, dark, flashes
  // amber on the same clock (stuck stays steady amber, hot pulses, rebooting flickers; red is Glenn's).
  // And Glenn: once per problem, about ten shift minutes before its strike, an order ("Be a pal and get L47 back up,
  // chief."), so fixing it is complying and the log says so; silent once the supervisor link is down (night 3).
  (() => {
    const PAN = { left: -.65, right: .65 };
    const nextFlash = new Map(), fans = {}, warned = new Map();
    // 0 when fresh (or hot: no strike yet), 1 at the strike
    const urgency = o => o.kind === 'HOT' || o.toStrike === null ? 0 : 1 - Math.max(0, Math.min(1, o.toStrike / shift.STRIKE.after));
    // a rack's fans: looped noise through a band that rises with their speed, panned to the rack's side
    function fan(side) {
      if (fans[side]) return fans[side];
      const ctx = ac(), len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9; bp.frequency.value = 150;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner(); p.pan.value = PAN[side];
      src.connect(bp).connect(lp).connect(g).connect(p).connect(ctx.destination); src.start();
      return (fans[side] = { g, bp });
    }
    // u: null, nothing wrong on that rack; 0..1, how near its worst problem is to a strike
    function spin(side, u) {
      if (!fans[side] && (u === null || muted)) return;
      const F = fan(side), t = ac().currentTime;
      // as heard (A-weighted, measured in the page against the hum as built): 12 dB under the hum fresh, 2 dB under it
      // at the strike. The gain falls as the pitch rises, because the higher rush is the easier one to hear.
      const level = u === null || muted ? 0 : (.0042 - .0018 * u) * (room.talking || borrowedVoice ? .5 : 1);
      F.g.gain.setTargetAtTime(level, t, 1.2);                     // fans take a moment to spin up, and to run down
      F.bp.frequency.setTargetAtTime(150 + 330 * (u ?? 0), t, 1.5);
    }
    // Glenn's order before a strike, in words that fit the trouble
    const ORDER = { DOWN: u => `get ${u} back up`, STUCK: u => `get ${u} unstuck`, LOSS: u => `get ${u} routing again` };
    setInterval(() => {
      if (!shift || shift.over || asleep || room.melting || account.loggingIn) { nextFlash.clear(); spin('left', null); spin('right', null); return; }
      const now = performance.now(), worst = {}, down = new Set(), open = shift.open();
      for (const o of open) {
        if (o.fixing) continue;
        const side = UNITS[o.unit] ? UNITS[o.unit].side : o.unit.replace('rack-', ''), u = urgency(o);
        worst[side] = Math.max(worst[side] ?? 0, u);
        if (o.toStrike !== null && o.toStrike <= 10 && warned.get(o.unit) !== o.since && ORDER[o.kind] && !room.linkDown) {
          warned.set(o.unit, o.since);
          const line = `Be a pal and ${ORDER[o.kind](o.unit)}, chief.`;
          glenn.say(line); glenn.order('fix:' + o.unit, line);
        }
        if (o.kind !== 'DOWN' || !UNITS[o.unit]) continue;
        down.add(o.unit);
        if (now < (nextFlash.get(o.unit) ?? 0)) continue;
        const l = UNITS[o.unit].leds[0];              // one LED flashes, the unit's others stay dark
        if (l) { ledClass(l, 'flash', true); setTimeout(() => ledClass(l, 'flash', false), 90); }
        nextFlash.set(o.unit, now + 2000 - 1400 * u);   // 2 s fresh, 0.6 s at the strike
      }
      for (const u of [...nextFlash.keys()]) if (!down.has(u)) nextFlash.delete(u);
      // a warned problem that is no longer open was fixed: that was doing as he asked
      for (const [u, since] of [...warned]) if (!open.some(o => o.unit === u && o.since === since)) { glenn.complied('fix:' + u); warned.delete(u); }
      for (const side of ['left', 'right']) spin(side, side in worst ? worst[side] : null);
    }, 250);
  })();

  // ?dev: a console handle for trying things out: dev.stuck('L47'), dev.hot('R29'), dev.down('L10'), dev.found()
  if (new URLSearchParams(location.search).has('dev')) window.dev = {
    stuck: u => { const e = shift.inject(u, 'STUCK'); if (e) showEvent(e); }, hot: u => { const e = shift.inject(u, 'HOT'); if (e) showEvent(e); },
    down: u => { const e = shift.inject(u, 'DOWN'); if (e) showEvent(e); }, found: (c = 'DEFRAG') => { const e = shift.find(c); if (e) showEvent(e); },
    insert: (label = 'DEFRAG') => { const had = room.cart; if (had) ejectCart(); setTimeout(() => insertCart(.0667, label), had ? 1400 : 0); },
    loss: (r = 'rack-left') => { const e = shift.inject(r, 'LOSS'); if (e) showEvent(e); },
    get shift() { return shift; }, ghost: () => ghostKey('m'), wake: () => { woke = true; wakeUp(); },
    skip: (t = 385) => { shift.skip(t); for (const u in UNITS) unitLed(u, null); },   // 385: 05:25
    // the file drawer: unlock it (as if the key had turned), file the photo, or put it all back as it was on night 1
    file: { unlock: () => { file.unlocked = true; file.key = 'lock'; keepFile(); drawFile(); }, keyToDesk: () => { file.key = 'desk'; keepFile(); drawDeskKey(); }, keyFromPong: () => keyFromPong(), fileIt: () => { file.filed = true; file.filedShift = shiftNo; keepFile(); drawFile(); }, nextShift: () => { shiftNo++; drawFile(); },
      reset: () => { Object.assign(file, { unlocked: false, filed: false, clicks: 0, travel: 0, open: false, key: 'none', turn: 1 }); keepFile(); drawFile(); drawDeskKey(); }, get state() { return { ...file }; } },
    look: rest => lookAt(rest),
  };

  // the night ends at dawn, or early when you are relieved of duty
  function endOfNight(r) {
    const head = r.ending === 'dawn' ? ['shift over. 05:30. handing over.']
      : r.reason === 'asleep' ? [`${r.at}. your eyes closed. the supervisor found you asleep at the desk.`, 'reassigned.']
      : [`${r.at}. supervisor: I'm taking it from here.`, 'relieved of duty. go home.'];
    const strikes = r.strikes ? `${r.strikes} strike${r.strikes === 1 ? '' : 's'}` : 'no strikes';
    const lines = [
      ...head,
      `shift report: ${r.incidents} incident${r.incidents === 1 ? '' : 's'}, ${r.fixed} fixed${r.open ? `, ${r.open} still open` : ''}, ${strikes}.`,
      ...(r.longest.unit ? [`longest outage: ${r.longest.unit}, ${Math.round(r.longest.min)} min.`] : []),
      ...(r.ending === 'dawn' ? [r.strikes === 0 ? 'clean shift. the racks barely noticed you were here.'
        : r.strikes === 1 ? 'a few rough patches. the log will survive.'
        : 'rough night. the next operator is going to read this log.'] : []),
    ];
    for (const l of lines) logLine('vigild[412]: ' + l);
    if (r.ending !== 'dawn') {
      if (r.reason === 'asleep') term.announce([{ text: 'your eyes are closing.', cls: 'dim' }]);
      darkEnd(r, lines.slice(head.length));            // the report
      return;
    }
    clockOut(lines);
  }

  // The night's end (design.md, story: every night's end; no dawn, the room has no windows). At 05:30 the shift is
  // over and Glenn says the day shift is on its way; the clock rolls on and nobody comes; then the power knob turns
  // itself off, and at the next login back on, and the tube boots at 23:00 into the next night, "0 minutes later".
  // The knob stays yours throughout. The log keeps you clocking out and back in, and those lines outlive the night.
  async function clockOut(lines) {
    room.darkNoticed = true;                           // no dark-screen order from Glenn after the shift
    logLine(`vigild[1]: operator ${account.user} clocked out`);
    // at the shell with the screen on: a game in progress finishes first, and a dark screen waits for you
    while (!(room.power && term.inShell())) await wait(500);
    term.announce(lines.map(t => ({ text: t, cls: 'dim' })));
    await wait(1500);
    glenn.complied('file');                           // the file drawer left alone all night
    await glenn.say("That's the night, chief! Day shift's on their way. Nice work.");
    // nobody comes (shift minutes: 390 is 05:30)
    for (const [t, text] of [[394, 'handover: waiting for the day shift.'], [397, 'handover: waiting.'], [400, 'handover: day shift not on site.']]) {
      while (shift.t < t) await wait(250);
      logLine('vigild[412]: ' + text);
      term.announce([{ text: `${shift.clock().slice(0, 5)}  ${text}`, cls: 'dim' }]);
    }
    while (shift.t < 403) await wait(250);
    // the knob turns itself off (if you have turned it off already, it stays off)
    await turnItself(false);
    await wait(2600);
    // the next night, up to the third (until the finale is built, the third comes round again)
    try { localStorage.setItem('vigil.night', String(Math.min(3, shift.level + 1))); } catch (e) {}
    account.loggingIn = true;                          // the clock waits for the login
    asleep = false;
    startShift(); updateVitals(); glenn.newNight();
    logLine(`vigild[1]: operator ${account.user} clocked in, 0 minutes later`);
    term.clear();
    // and back on by itself (turned on by hand in the dark, it just boots a moment sooner)
    await turnItself(true);
    await term.boot(['Last shift ended ....... 05:30, 0 minutes ago'], firstAlert);
    clockedIn();
  }
  // Night 3 starts mid-crisis, and the room is failing before you have sat down: its first alert always prints
  // between the login and the welcome (nights 1 and 2: the welcome and the mail first, always). The rest after.
  async function firstAlert() { const [e] = shift.initial(); if (e) { showEvent(e); await wait(700); } }
  function clockedIn() {
    for (const e of shift.initial().slice(1)) showEvent(e);
    // Glenn arrives a moment after you're in (he used to wait for you to read your mail, or 25 s: a long silence)
    glenn.arriveIn(3000);
  }

  // a lost night (asleep, or three strikes): the room goes dark and stays dark. What happened, and two choices:
  // reboot (the page reloads: a clean night from 23:00) or report (the shift report, there in the dark).
  const nightOver = document.getElementById('night-over');
  function darkEnd(r, lines) {
    playtest(`NIGHT LOST: ${r.reason === 'asleep' ? 'asleep' : 'three strikes'}`);
    asleep = true;                                   // nothing more happens in the room
    // one more scratch in the desk's edge, there when the room comes back (design.md: the tally marks)
    try { localStorage.setItem('vigil.lost', String(lostNights + 1)); } catch (e) {}
    lookEl.classList.add('dark');
    document.body.classList.add('lost');
    document.getElementById('no-what').textContent = r.reason === 'asleep'
      ? `${r.at}. you fell asleep at the desk.\nreassigned.`   // (design.md: operators found asleep are reassigned; strikes are relieved of duty)
      : `${r.at}. three strikes. the supervisor sent you home.\nrelieved of duty.`;
    document.getElementById('no-report-text').textContent = lines.join('\n');
    const what = $('no-what'), choices = $('no-choices'), yet = $('no-yet');
    setTimeout(async () => {
      nightOver.hidden = false; requestAnimationFrame(() => nightOver.classList.add('shown'));
      // Asleep with the racks still running (design.md: sleep is the exit, but not while the racks run): before
      // anything else, one line on the black screen, typed slowly on the previous operator's switch. Every lost
      // night by sleep, until the finale, where the racks go dark and sleep means something else.
      if (r.reason === 'asleep') {
        what.hidden = choices.hidden = true; yet.hidden = false; yet.textContent = '';
        const voice = M_VOICE(); await loadPack(voice.pack);
        await wait(1600);
        borrowedVoice = voice;
        const msg = 'not yet.';
        for (let i = 0; i < msg.length; i++) {
          yet.textContent += msg[i]; tap(msg[i]);
          await wait(msg[i] === ' ' ? 180 : 110 + rnd(120) + (i === 2 ? 700 : 0));   // a hesitation after "not"
        }
        borrowedVoice = null;
        await wait(2400);
        yet.classList.add('gone');
        await wait(1300);
        yet.hidden = true; yet.classList.remove('gone');
        what.hidden = choices.hidden = false;
      }
      document.getElementById('no-reboot').focus();
    }, 1900);
  }
  const reboot = () => location.reload();
  const showReport = () => { const t = document.getElementById('no-report-text'); t.hidden = !t.hidden; };
  document.getElementById('no-reboot').addEventListener('click', reboot);
  document.getElementById('no-report').addEventListener('click', showReport);
  // while it is up, the keyboard answers it and nothing else: r reboots, p shows the report
  window.addEventListener('keydown', e => {
    if (nightOver.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if ($('no-choices').hidden) return;               // not yet
    if (e.key === 'r' || e.key === 'R') reboot();
    else if (e.key === 'p' || e.key === 'P') showReport();
    else if (e.key === 'Enter' && document.activeElement?.closest('#night-over')) document.activeElement.click();
  }, true);

  // the HUD: a status line top right of the terminal, energy and beans (and strikes, once there are any), drawn with the rest of the tube (crt.js)
  let energyTenth = 10;
  function updateVitals() {
    const e = shift.energy;
    if (PLAYTEST && Math.floor(e * 10) !== energyTenth) { energyTenth = Math.floor(e * 10); playtest(`energy below ${(energyTenth + 1) * 10}%`); }
    // (the shift starts before the terminal exists; the first status is drawn once it does, below)
    try { term.setStatus({ energy: e, beans: shift.beans, low: e < .3, strikes: shift.strikes, mail: { unread: inbox.unread() } }); } catch (err) { return; }
    // tired: below 30% the screen softens, and below 25% the keys lag (see typeKey)
    termCanvas.style.filter = e < .3 ? `blur(${((.3 - e) / .3 * 1.1).toFixed(2)}px)` : '';
  }
  updateVitals();

  // ------------------------------------------------------------ the room's log (feeds tail -f and the LEDs)
  const LOG_TEMPLATES = [
    'vigild[412]: job {id} scheduled on rack-{r} unit {u}',
    'vigild[412]: job {id} finished in {ms}ms',
    'vigild[412]: unit {u} temperature {t}C, fans nominal',
    'vigild[412]: checkpoint written to /srv/models/tuned-2026-09.bin',
    'vigild[412]: rack-{r} unit {u} reports {p}% utilization',
    'vigild[412]: heartbeat ({up}/128 units)',
    'vigild[412]: coffee level {c}%, ' + '{cw}',
  ];
  const logLines = [];
  const logListeners = new Set();
  const stamp = () => shift.clock();
  // The log outlives the night (design.md: the "be a pal" reveal is found by rewinding it on night 3): Glenn's lines
  // and what the system notes about the operator are kept in localStorage, and the nights before are read back at
  // the top of logs/vigild.log. Everything else in the log is the night's own.
  const KEEP = /^(glenn:|vigild\[1\]: operator)/;
  let pastLog = [];
  try { pastLog = JSON.parse(localStorage.getItem('vigil.record') || '[]'); } catch (e) {}
  const kept = [];
  function keep(l) { kept.push(l); try { localStorage.setItem('vigil.record', JSON.stringify([...pastLog, ...kept].slice(-600))); } catch (e) {} }
  function logLine(text, noise = false) {
    const l = `${stamp()} ${text}`;
    if (!noise) playtest('log  ' + text);
    if (KEEP.test(text)) keep(l);
    logLines.push(l); if (logLines.length > 300) logLines.shift();
    logListeners.forEach(fn => fn(l));
    return l;
  }
  function randomLog() {
    const t = LOG_TEMPLATES[rnd(LOG_TEMPLATES.length)];
    return t.replace('{id}', 'j' + (1000 + rnd(9000))).replace('{r}', Math.random() < .5 ? 'left' : 'right')
      .replace('{u}', 1 + rnd(49)).replace('{ms}', 120 + rnd(4000)).replace('{t}', 31 + rnd(14))
      .replace('{p}', 5 + rnd(95)).replace('{up}', 128 - shift.open().filter(o => o.kind === 'DOWN').length).replace('{c}', Math.round(room.coffee * 100)).replace('{cw}', coffeeWord());
  }
  for (let i = 0; i < 12; i++) logLines.push(`${stamp()} ${randomLog()}`);
  (function logTick() {
    if (!room.melting) { logLine(randomLog(), true); ledBurst(3 + rnd(4)); }
    setTimeout(logTick, 1800 + Math.random() * 3800);
  })();

  // ------------------------------------------------------------ terminal
  const term = (() => {
    const MAX = 400;             // scrollback
    let lines = [];              // finished lines, as {text, cls}
    let line = '';               // current input
    let mode = 'boot';           // boot | shell | proc | game | off
    let frame = null;            // when set, the screen shows only these lines (top, snake, ...)
    let field = null;            // with a frame: a square grid drawn over it (crt.js drawField), for snake
    let stopProc = null;         // ends the running proc/game
    let gameKey = null;          // key handler while a game runs
    let hist = [], histIdx = -1, histDraft = '';
    let cwd = '~', lastTyped = 0, locked = false;
    const prompt = () => `${account.user}@vigil:${cwd}$ `;
    const LOGIN = 'site4 login: ';
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const span = l => typeof l === 'string' ? esc(l) : l.html !== undefined ? l.html : `<span class="${l.cls || ''}">${esc(l.text)}</span>`;

    // ---- drawing: lines become rows of coloured runs, wrapped to the tube's width; crt.js draws and bends them
    const crt = createCRT({ canvas: termCanvas, host: terminal, warp: WARP });
    let status = null, scrollBack = 0, total = 0, cursorOn = true;
    const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    // a line is a string, { text, cls }, or { html } made of flat <span class="..."> runs (matrix, defrag)
    function runsOf(l) {
      if (typeof l === 'string') return [{ text: l }];
      if (l.html === undefined) return [{ text: l.text ?? '', cls: l.cls }];
      const out = []; let last = 0;
      for (const m of l.html.matchAll(/<span class="([^"]*)">([\s\S]*?)<\/span>/g)) {
        if (m.index > last) out.push({ text: unesc(l.html.slice(last, m.index)) });
        out.push({ text: unesc(m[2]), cls: m[1] }); last = m.index + m[0].length;
      }
      if (last < l.html.length) out.push({ text: unesc(l.html.slice(last)) });
      return out;
    }
    const lenOf = row => row.reduce((n, r) => n + [...r.text].length, 0);
    // wrap at the tube's width, between words where it can (a word longer than half a row is broken where it
    // falls); the old wrap broke anywhere, which cut words like "operator" in two
    function wrap(runs) {
      const lines = [[]];
      for (const r of runs) for (const ch of r.text) {
        let line = lines[lines.length - 1];
        if (line.length === crt.COLS) {
          const sp = ch === ' ' ? -1 : line.map(c => c.ch).lastIndexOf(' ');
          const carry = sp > crt.COLS / 2 ? line.splice(sp + 1) : [];
          lines.push(line = carry);
          if (ch === ' ' && !carry.length) continue;       // a space at the break is the break
        }
        line.push({ ch, cls: r.cls });
      }
      return lines.map(line => {
        const row = [];
        for (const { ch, cls } of line) { const prev = row[row.length - 1]; if (prev && prev.cls === cls) prev.text += ch; else row.push({ text: ch, cls }); }
        return row;
      });
    }
    function render() {
      let rows, cursor = null;
      if (frame) rows = frame.map(runsOf);                          // full-screen programs draw fixed frames
      else {
        const all = [];
        for (const l of lines.slice(-MAX)) all.push(...wrap(runsOf(l)));
        if (mode === 'shell') all.push(...wrap([{ text: prompt() + line }]));
        else if (mode === 'login') all.push(...wrap([{ text: LOGIN + line }]));
        if (mode !== 'off') {
          if (!all.length) all.push([]);
          let col = lenOf(all[all.length - 1]);
          if (col >= crt.COLS) { all.push([]); col = 0; }
          cursor = { row: all.length - 1, col };
        }
        total = all.length;
        scrollBack = Math.max(0, Math.min(scrollBack, total - crt.ROWS));
        const end = total - scrollBack, start = Math.max(0, end - crt.ROWS);
        rows = all.slice(start, end);
        if (cursor) cursor = scrollBack ? null : { row: cursor.row - start, col: cursor.col };
      }
      crt.paint({ rows, cursor, cursorOn, status, field: frame ? field : null,
        burn: piece(3) ? clamp((.35 - room.brightness) / .35, 0, 1) : 0, burnText: 'm@vigil:~$' });
      termOut.textContent = rows.map(r => r.map(x => x.text).join('')).join('\n');   // for screen readers
    }
    // the cursor blinks, and the wheel over the tube scrolls back through what has been said
    setInterval(() => { cursorOn = !cursorOn; if (!frame) render(); }, 525);
    termCanvas.addEventListener('wheel', e => { e.preventDefault(); scrollBack += Math.sign(e.deltaY) * -3; render(); }, { passive: false });
    // The envelope in the status line. The click is taken back into the terminal's own pixels through where its four
    // corners are on the page now (invisible markers at the corners: they follow the glass mapping, the parallax and
    // the look-down; the browser's offsetX doesn't follow the 3D mapping); the glass's bow at the top is taken off,
    // and the terminal's pixels are twice the tube's design units.
    const corners = [[0, 0], [TW, 0], [TW, TH], [0, TH]].map(([x, y]) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;visibility:hidden;pointer-events:none`;
      terminal.appendChild(d); return d;
    });
    const toTerminal = (cx, cy) => {
      const M = homography(corners.map(d => { const r = d.getBoundingClientRect(); return [r.left, r.top]; }), [[0, 0], [TW, 0], [TW, TH], [0, TH]]);
      const w = M[6] * cx + M[7] * cy + 1;
      return [(M[0] * cx + M[1] * cy + M[2]) / w, (M[3] * cx + M[4] * cy + M[5]) / w];
    };
    const onEnvelope = e => {
      const r = crt.mailHit(); if (!r) return false;
      const [tx, ty] = toTerminal(e.clientX, e.clientY);
      const x = tx / 2, y = (ty - (WARP.top[Math.round(tx)] || 0)) / 2;
      return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    };
    termCanvas.addEventListener('mousemove', e => { termCanvas.style.cursor = onEnvelope(e) && mode === 'shell' ? 'pointer' : ''; });
    termCanvas.addEventListener('pointerdown', e => {
      if (!onEnvelope(e) || mode !== 'shell') return;
      e.preventDefault();
      lines.push({ text: prompt() + 'mail' }); line = '';
      runMailPicker();
    });
    function print(text = '', cls) { lines.push({ text, cls }); if (lines.length > MAX) lines.shift(); scrollBack = 0; render(); }
    function setMode(m) { mode = m; if (m === 'shell') { frame = null; field = null; } render(); }
    // a line typed in by someone else, a character at a time, above the prompt: head is its fixed start (a tag),
    // then the text in cls; key(ch) is called as each character lands (its sound), pace(ch, next) says how long
    // until the next. Resolves when the line is all there.
    function typeLine(head, text, cls, key, pace) {
      if (mode === 'off') return Promise.resolve();
      const l = { html: head };
      lines.push(l); if (lines.length > MAX) lines.shift();
      let i = 0;
      return new Promise(done => {
        (function next() {
          if (i >= text.length) { done(); return; }
          const ch = text[i++];
          l.html = head + `<span class="${cls}">${esc(text.slice(0, i))}</span>`;
          scrollBack = 0; render(); key?.(ch);
          setTimeout(next, pace(ch, text[i]));
        })();
      });
    }
    function announce(texts, cls) { if (mode === 'off') return; for (const t of texts) { lines.push(typeof t === 'string' ? { text: t, cls } : t); if (lines.length > MAX) lines.shift(); } render(); }

    // ---- filesystem
    const FS = {
      README: [
        'VIGIL TERMINAL ROOM',
        '',
        'This is an illustration you can type into. The keyboard is yours,',
        'the racks are listening, and the coffee is still warm.',
        '',
        'Try: help, status, cat runbook, top, tail -f logs/vigild.log.',
      ],
      // laid out for the tube (about 52 columns, 13 rows with the command and the prompt): what you see, what to type
      runbook: [
        { html: 'RUNBOOK  <span class="dim">rack operations, night shift</span>' },
        { text: 'a unit that...', cls: 'dim' },
        "  isn't responding    reboot <unit>",
        '  is running hot      reroute <unit>',
        { text: '                      (left hot, it shuts down)', cls: 'dim' },
        "  won't stay fixed    ask the last operator;",
        { text: '                      their things are in the desk.', cls: 'dim' },
        '',
        '  rack-left           L10 L14 L20 L27 L33 L41 L47',
        '  rack-right          R10 R17 R29 R47',
        { text: "status: what's open.  top: every unit.", cls: 'dim' },
      ],
      'vigil.conf': ['[daemon]', 'workers = 128', 'checkpoint_interval = 15m', 'coffee = required', '', '[terminal]', 'phosphor = blue', 'scanlines = on'],
      models: {
        MANIFEST: ['base-7b.bin        7.1G   sha256:9f2e...c41a', 'tuned-2026-09.bin  7.3G   sha256:41d0...77be'],
        'base-7b.bin': ['(binary, 7.1G) - you do not want to cat this.'],
        'tuned-2026-09.bin': ['(binary, 7.3G) - still no.'],
      },
      logs: {
        'vigild.log': () => [...pastLog, ...logLines],
        'access.log': () => ['operator  tty1  ' + new Date().toDateString() + '  still here'],
      },
    };
    // the third lost-night piece: a file M. left in the home directory, hidden (ls -a)
    if (piece(2)) FS['.plan'] = ['i stopped counting the scratches at forty.', '— m'];
    const isDir = n => n && typeof n === 'object' && !Array.isArray(n);
    const readFile = n => Array.isArray(n) ? n : typeof n === 'function' ? n() : null;
    const listDir = n => Object.keys(n).map(k => isDir(n[k]) ? k + '/' : k);
    function resolve(path = '.') {
      const absolute = path.startsWith('~') || path.startsWith('/');
      const parts = absolute ? [] : cwd.replace(/^~\/?/, '').split('/').filter(Boolean);
      for (const p of path.replace(/^[~/]+/, '').split('/').filter(Boolean)) {
        if (p === '.') continue;
        if (p === '..') parts.pop(); else parts.push(p);
      }
      let node = FS;
      for (const p of parts) { if (isDir(node) && p in node) node = node[p]; else return { node: null, parts }; }
      return { node, parts };
    }

    // ---- commands
    // help: a list, one command a line with what it does, grouped. The tube is about 55 columns and 13 rows.
    const HELP = {
      job: ['the job', [
        ['status', "what's wrong, and for how long"],
        ['reboot <unit>', 'restart a unit'],
        ['reroute <unit>', "move a unit's load elsewhere"],
        ['ping <unit>', 'see whether a unit answers'],
        ['cat runbook', 'which fix is for which trouble'],
        ['coffee', 'a sip from the mug'],
        ['brew', 'make another pot'],
      ]],
      room: ['the room', [
        ['mail', 'your inbox'],
        ['eject', 'the cartridge comes out'],
        ['power off', 'the monitor off (left knob: on)'],
        ['brightness <0-100>', 'the screen (or the right knob)'],
        ['theme <colour>', 'blue, green or amber'],
        ['switch', 'how your keyboard sounds'],
        ['name <new name>', 'go by another name'],
        ['shift', 'the time'],
      ]],
      shell: ['the shell', [
        ['ls  cd  cat  pwd', 'look around'],
        ['grep <word> <file>', 'the lines with a word in them'],
        ['tail -f <file>', 'watch a file as it grows'],
        ['top', 'the units, live'],
        ['history  clear', 'what you typed; a clean screen'],
        ['whoami  date', 'who you are; the date'],
        ['logout', 'log in as someone else'],
      ]],
    };
    const helpList = key => {
      const [title, rows] = HELP[key];
      return [title, ...rows.map(([c, d]) => ({ html: `  ${esc(c.padEnd(21))}<span class="dim">${esc(d)}</span>` }))];
    };
    const COMMANDS = {
      // one help, everything in it (Arnold: one is all a player needs). It is longer than the tube, so the job
      // comes last, where it stays on screen above the prompt; the wheel scrolls back to the rest.
      help: () => [...helpList('shell'), { text: 'keys: up/down history   tab completes', cls: 'dim' }, { text: '      ctrl+backspace deletes a word', cls: 'dim' },
        '', ...helpList('room'), '', ...helpList('job'), { text: '(scroll up over the screen for the rest)', cls: 'dim' }],
      status: () => {
        glenn.complied('status');
        const open = shift.open();
        return [
          `${shift.clock()}  on shift ${hm(shift.t)}  strikes ${shift.strikes ? `${shift.strikes} of ${shift.STRIKE.max}` : 'none'}`,
          ...(open.length ? open.map(o => `${o.unit.padEnd(4)} ${(o.fixing ? 'FIXING' : o.kind).padEnd(7)}${String(Math.round(o.forMin)).padStart(3)} min   ${unitName(o.unit)}`)
            : [{ text: 'all units nominal', cls: 'ok' }]),
          `coffee .......... ${coffeeWord()} (${Math.round(room.coffee * 100)}%)`,
        ];
      },
      reboot: args => args.length > 1 ? fixMany('reboot', args) : fixUnit('reboot', args[0]),
      reroute: args => args.length > 1 ? fixMany('reroute', args) : fixUnit('reroute', args[0]),
      shift: () => [shift.over ? `it is ${shift.clock()}. the shift ended at 05:30. the day shift is not here yet.` : `the shift runs until 05:30. it is ${shift.clock()}.`],
      coffee: () => [(room.coffee > 0 ? `coffee: ${coffeeWord()}, ${Math.round(room.coffee * 100)}% left. click the mug.` : 'coffee: none. try brew.') + ` ${shift.beans} bean${shift.beans === 1 ? '' : 's'} left.`],
      brew: () => {
        if (room.coffee >= 1) return ['the mug is already full.'];
        if (!shift.useBean()) return ['no beans left. that was the last pot.'];
        glenn.complied('brew');
        updateVitals();
        mode = 'proc'; stopProc = null;
        (async () => {
          print('brewing', 'dim'); await wait(500);
          const progress = lines[lines.length - 1];
          for (let i = 0; i < 7; i++) { progress.text += ' .'; render(); beep(220 + i * 30, .04, .02); await wait(620); }
          setCoffee(1); ledBurst(5); print('done. mind the steam.'); setMode('shell');
        })();
        return [];
      },
      ls: (args) => {
        const all = args.some(a => /^-\w*a/.test(a)), target = args.find(a => !a.startsWith('-'));
        const { node } = resolve(target);
        if (!node) return [`ls: ${target}: no such file or directory`];
        return isDir(node) ? [[...(all ? ['.', '..'] : []), ...listDir(node).filter(n => all || !n.startsWith('.'))].join('   ')] : [target];
      },
      cd: (args) => {
        const { node, parts } = resolve(args[0] || '~');
        if (!node) return [`cd: ${args[0]}: no such directory`];
        if (!isDir(node)) return [`cd: ${args[0]}: not a directory`];
        cwd = '~' + (parts.length ? '/' + parts.join('/') : '');
        return [];
      },
      pwd: () => [cwd.replace('~', '/home/operator')],
      // finger: who has had this account, as an old Unix box would say (a hidden layer: nothing needed to survive or
      // to reach an ending depends on it; M.'s note mentions "my plan" for those who know). Everyone before you was
      // reassigned. M.'s plan says "not yet."; the others have none; yours is the only blank one, filled only by the note
      // you leave if you stay, at the finale (Arnold: M.'s scratches line stays in M.'s hidden file, never yours).
      finger: (args) => {
        const you = account.user, since = (() => { try { return (JSON.parse(localStorage.getItem('vigil.logins') || '[]')[0] || '').slice(4, 16); } catch (e) { return ''; } })();
        const OLD = [
          ['ts', 'T. S.', 'Fri Jan 13 23:00 2012'], ['jk', 'J. K.', 'Thu Nov 17 23:00 2016'], ['rd', 'R. D.', 'Sun Oct  1 23:00 2017'],
          ['aw', 'A. W.', 'Wed Jun  6 23:00 2018'], ['m', '(unknown)', 'Mon Apr  1 23:00 2019'],
        ];
        const plan = u => u === 'm' ? ['not yet.'] : null;
        if (!args[0]) return [
          { text: 'Login   Name       Since         Status', cls: 'dim' },   // (the tube is about 52 columns)
          `${you.slice(0, 7).padEnd(8)}${(account.name || '').slice(0, 10).padEnd(11)}${since.slice(0, 6).padEnd(14)}active`,
          ...OLD.slice().reverse().map(([u, n, d]) => `${u.padEnd(8)}${n.padEnd(11)}${(d.slice(4, 10) + ' ' + d.slice(-4)).padEnd(14)}reassigned`),
        ];
        const who = args[0].toLowerCase(), old = OLD.find(o => o[0] === who);
        // Glenn: always on since three seconds after you logged in, upstairs, never idle (Arnold, 2026-10-02: odd, never
        // conclusive; not in the list, only asked for by name)
        if (who === 'glenn') {
          const at = account.loginAt ? new Date(account.loginAt.getTime() + 3000) : null;
          const fmt = d => d.toString().slice(0, 3) + ' ' + d.toString().slice(4, 10).replace(/ 0/, '  ') + ' ' + d.toTimeString().slice(0, 8);
          return [`Login: glenn               Name: Glenn`, `Directory: /home/glenn       Shell: /bin/sh`, `On since ${at ? fmt(at) : 'login + 3s'} on tty0 (upstairs).`, 'Idle: 0 minutes.', 'No mail.', 'Plan:', 'Keep those racks up, chief!'];
        }
        if (who !== you && !old) return [`finger: ${args[0]}: no such user.`];
        const p = plan(who);
        return [
          `Login: ${who.padEnd(20)}Name: ${old ? old[1] : account.name || who}`,
          `Directory: /home/operator   Shell: /bin/sh`,
          old ? `Last login ${old[2]} on tty1.` : `On since ${since} on tty1.`,
          old ? 'Status: reassigned.' : 'Status: active.',
          'No mail.',
          ...(p ? ['Plan:', ...p] : ['No Plan.']),
        ];
      },
      // logins, newest first, as a real last prints them; the second lost-night piece is one on a night not played yet
      last: () => {
        const u = account.user.padEnd(9), stamp = s => s.slice(0, 16);
        let past = []; try { past = JSON.parse(localStorage.getItem('vigil.logins') || '[]'); } catch (e) {}
        const rows = past.slice().reverse().map((s, i) => `${u}tty1     ${stamp(s)}   ${i ? 'gone - no logout' : 'still logged in'}`);
        if (piece(1)) {
          const t = new Date(Date.now() + 864e5);
          rows.unshift(`${u}tty2     ${t.toDateString().slice(0, 10)} 23:00   still logged in`);
        }
        let t2 = []; try { t2 = JSON.parse(localStorage.getItem('vigil.tty2') || '[]'); } catch (e) {}
        rows.unshift(...t2.slice().reverse().map(x => `${''.padEnd(9)}tty2     ${x.date} ${x.open} - ${x.closed || 'still logged in'}${x.closed ? `  (${(m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'))(((+x.closed.slice(0, 2) * 60 + +x.closed.slice(3)) - (+x.open.slice(0, 2) * 60 + +x.open.slice(3)) + 1440) % 1440)})` : ''}`));
        return [...rows, '', { text: `wtmp begins ${stamp(past[0] || '')}`, cls: 'dim' }];
      },
      cat: (args) => {
        if (!args[0]) return ['cat: what?'];
        const { node } = resolve(args[0]);
        if (!node) return [`cat: ${args[0]}: no such file`];
        if (isDir(node)) return [`cat: ${args[0]}: is a directory`];
        if (node === FS.runbook) glenn.complied('runbook');
        const text = readFile(node);
        return node === FS.logs['vigild.log'] ? text.slice(-14) : text;
      },
      // grep [-i] <pattern> <file>: the lines of a file with the pattern in them. A pattern in quotes can have spaces.
      grep: (args) => {
        let rest = args.join(' '), ci = false;
        if (/^-i\s/.test(rest)) { ci = true; rest = rest.slice(3).trim(); }
        const m = rest.match(/^"([^"]*)"\s+(\S+)$/) || rest.match(/^'([^']*)'\s+(\S+)$/) || rest.match(/^(\S+)\s+(\S+)$/);
        if (!m) return ['usage: grep [-i] <pattern> <file>   e.g. grep -i "hot" logs/vigild.log'];
        const [, pat, file] = m, { node } = resolve(file);
        if (!node) return [`grep: ${file}: no such file`];
        if (isDir(node)) return [`grep: ${file}: is a directory`];
        const has = t => ci ? t.toLowerCase().includes(pat.toLowerCase()) : t.includes(pat);
        const found = readFile(node).map(l => typeof l === 'string' ? l : l.text ?? '').filter(has);
        return found.length ? found : [];
      },
      tail: (args) => {
        const follow = args[0] === '-f'; const file = (follow ? args[1] : args[0]) || 'logs/vigild.log';
        const { node } = resolve(file);
        if (!node || isDir(node)) return [`tail: ${file}: no such file`];
        if (!follow) return readFile(node).slice(-8);
        readFile(node).slice(-6).forEach(l => print(l, 'dim'));
        mode = 'proc';
        const fn = l => { print(l, 'dim'); ledBurst(5); };
        logListeners.add(fn);
        stopProc = () => { logListeners.delete(fn); print('^C'); setMode('shell'); };
        return [];
      },
      top: () => { runTop(); return []; },
      history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`),
      clear: () => { lines = []; return []; },
      echo: (args) => [args.join(' ')],
      who: () => {
        const d = new Date().toDateString().slice(4, 10), me = { text: `${account.user.padEnd(10)} tty1   ${d} 23:00` };
        // the second session, while it is open: no name on it
        return tty2.open && !tty2.closed ? [me, { text: `${''.padEnd(10)} tty2   ${d} ${tty2.open}` }] : [me];
      },
      // the kernel's ring buffer: where the 04:44 replay is written down, and nowhere else
      dmesg: () => [
        '[    0.000000] Linux version 2.4.20-vigil (root@site4) (gcc version 2.95.3)',
        '[    0.000000] Kernel command line: ro root=/dev/hda1 console=tty1',
        '[    1.204411] hda: VIGIL VS-04, ATA DISK drive',
        '[    2.881030] tty1: console registered',
        '[    2.881214] tty2: console registered',
        '[    3.402117] vigild: watchdog armed, 1 operator',
        ...(room.replayedAt ? [`[${(20640 + Math.round(shift.t * 60)).toString().padStart(5)}.000000] tty1: input replayed from tty2 (${room.replayedAt})`] : []),
      ],
      whoami: () => [account.user, { text: "(to go by another name: name <new name>)", cls: 'dim' }],
      name: (args) => {
        const n = args.join(' ').trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 24);
        if (!n) return [account.name, { text: 'usage: name <new name>', cls: 'dim' }];
        account.name = n; account.user = userOf(n);
        try { localStorage.setItem('vigil.operator', n); } catch (e) {}
        return [`you are ${n} now.`];
      },
      mail: (args) => inbox.command(args) || (runMailPicker(), []),
      logout: () => { setTimeout(() => logout(), 300); return ['logout']; },
      date: () => [`${new Date().toDateString()} ${shift.clock()}`],
      uptime: () => [`${shift.clock()} up ${hm(shift.t)}, 1 user, load average: ${(.4 + shift.open().length * .6).toFixed(2)}, ${(.3 + shift.open().length * .4).toFixed(2)}, 0.21`],
      power: (args) => {
        if (args[0] !== 'off') return ['usage: power off   (the left knob under the screen turns it back on)'];
        if (powerLocked()) return ['power: locked during onboarding.'];
        setTimeout(() => setPower(false), 250);
        return ['powering down...'];
      },
      brightness: (args) => {
        const v = parseInt(args[0], 10);
        if (Number.isNaN(v)) return [`brightness ${Math.round(room.brightness * 100)}%   (usage: brightness <0-100>, or drag the right knob)`];
        setBrightness(v / 100); return [`brightness ${Math.round(room.brightness * 100)}%`];
      },
      theme: (args) => setTheme(args[0]) ? [`phosphor: ${args[0]}`] : ['usage: theme <blue|green|amber>'],
      ping: (args) => { if ((args[0] || '') === '23') return room.routeWon ? (runPing23(), []) : ['ping: 23: no such unit']; if (piece(7) && [account.user, (account.name || '').toLowerCase()].includes((args[0] || '').toLowerCase())) { runPing23(args[0]); return []; } if (UNITS[(args[0] || '').toUpperCase()]) { runPingUnit(args[0].toUpperCase()); return []; } const r = (args[0] || '').replace(/^rack-/, ''); if (!['left', 'right'].includes(r)) return ['usage: ping <rack-left|rack-right>']; runPing(r); return []; },
      neofetch: () => [
        '__      __          operator@vigil',
        '\\ \\    / /          --------------',
        ' \\ \\  / /           OS: VigilOS 2.4 (terminal-server-room)',
        '  \\ \\/ /            Racks: 4 cabinets, 128 units',
        `   \\__/             Uptime: ${Math.floor(performance.now() / 60000)}m ${Math.floor(performance.now() / 1000) % 60}s`,
        `                    Shell: rsh 1.0   Phosphor: ${room.theme}`,
        `                    Coffee: ${coffeeWord()}`,
      ],
      about: () => ['Vigil Systems. this room is an illustration; the terminal is real enough.', 'drawn in figma, wired up in a browser. type help.'],
      matrix: () => { runMatrix(); return []; },
      switch: (args) => {
        const a = (args[0] || '').toLowerCase();
        if (!a || a === 'list') { runSwitchPicker(); return []; }   // "switch cream", next and prev still work typed
        let name = a;
        if (a === 'next' || a === 'prev') name = SIG_NAMES[(SIG_NAMES.indexOf(sigName) + (a === 'next' ? 1 : SIG_NAMES.length - 1)) % SIG_NAMES.length];
        if (!setSignature(name)) return ["switch: no signature called '" + a + "'. try: switch list"];
        setTimeout(() => { for (const [i, id] of ['key-T', 'key-H', 'key-O', 'key-C', 'key-K'].entries()) setTimeout(() => { click('key', false, id); setTimeout(() => click('key', true, id), 65); }, i * 110); }, 150);
        return ['switches: ' + name + '. ' + PACKS[name].note];
      },
      pong: () => { if (room.cart && room.cart !== 'PONG') return ['pong: not on this cartridge.']; if (!room.cart) return ['pong: no such program.', { text: '(something in the slot on the monitor might help.)', cls: 'dim' }]; runPong(); return []; },
      defrag: (args) => {
        if (room.cart !== 'DEFRAG') return ['defrag: command not found'];
        const u = (args[0] || '').toUpperCase();
        if (!UNITS[u]) return [`usage: defrag <unit>   (see cart/README)`];
        return runDefrag(u);
      },
      route: (args) => {
        if (room.cart !== 'ROUTE') return ['route: command not found'];
        const r = (args[0] || '').toLowerCase().replace(/^(left|right)$/, 'rack-$1');
        if (!['rack-left', 'rack-right'].includes(r)) return ['usage: route <rack-left|rack-right>   (see cart/README)'];
        return runRoute(r);
      },
      eject: () => { if (!room.cart) return ['eject: nothing in the slot.']; ejectCart(); return []; },
      sudo: (args) => args.join(' ') === 'make me a sandwich' ? ['okay.'] : ['operator is not in the sudoers file. this incident will be reported.'],
      make: (args) => args.join(' ') === 'me a sandwich' ? ['what? make it yourself.'] : ['make: *** no targets. stop.'],
      exit: () => ['there is no exit. only more racks.'],
      rm: (args) => {
        if (/^-[rf]{2}$/.test(args[0]) && args[1] === '/') { meltdown(); return []; }
        return args.length ? [`rm: cannot remove '${args.join(' ')}': permission denied (and rude)`] : ['rm: missing operand'];
      },
      eastereggs: () => [
        { text: 'things this room does that help does not mention:', cls: 'dim' },
        'rm -rf /                  do not. (fine. do.)',
        'sudo make me a sandwich   the classic',
        'make me a sandwich        the other half of it',
        'xyzzy  42  hello  hi      small talk',
        'exit                      good luck',
        'rm <anything else>        it has feelings',
        'cat models/base-7b.bin    it warns you',
        'click the mug             sip; brew refills',
        'the two knobs             power, brightness',
        'theme green / amber       other phosphors',
        'the slot on the chin      put something in it. then: ls cart',
        'pong                      only runs from the cartridge',
        'matrix                    you know what this does',
        { text: 'and eastereggs itself, which you found.', cls: 'dim' },
      ],
      secrets: (a) => COMMANDS.eastereggs(a),
      hello: () => ['hello, operator.'],
      hi: () => ['hi.'],
      xyzzy: () => ['nothing happens. the racks hum.'],
      42: () => ['yes.'],
    };

    function runCommand(raw) {
      const [cmd, ...args] = raw.trim().split(/\s+/);
      if (!cmd) return;
      const fn = COMMANDS[cmd.toLowerCase()];
      const out = fn ? fn(args) : [`${cmd}: command not found`];
      out.forEach(l => typeof l === 'string' ? print(l) : l.html !== undefined ? (lines.push(l), render()) : print(l.text, l.cls));
    }

    const hm = t => `${Math.floor(t / 60)}h${String(Math.floor(t % 60)).padStart(2, '0')}m`;
    // ---- fixing a unit: the verb has to fit the trouble, and the fix costs its time (the terminal is busy)
    function fixUnit(verb, name) {
      if (/^rack-(left|right)$/i.test(name || '')) {
        const st = shift.state(name.toLowerCase());
        return [st && st.kind === 'LOSS' ? `${name.toLowerCase()} is dropping packets. a ${verb} won't route them.` : `${verb} works on a unit, not a whole rack.`];
      }
      const u = (name || '').toUpperCase();
      if (!UNITS[u]) return [`usage: ${verb} <unit>   units: ${Object.keys(UNITS).join(' ')}`];
      const r = shift.fix(u, verb);
      if (!r.ok && r.reason === 'fragmented') {
        if (verb !== 'reboot') return [`${u} is fragmented: its files are in pieces. ${verb} won't put them back.`];
        mode = 'proc'; stopProc = null;
        (async () => {
          shift.spend(.02); updateVitals();   // a reboot's effort, for nothing
          unitLed(u, 'rebooting'); print(`rebooting ${u}`, 'dim');
          const progress = lines[lines.length - 1];
          for (let i = 0; i < 6; i++) { await wait(950); progress.text += ' .'; render(); beep(300 + i * 30, .03, .015); }
          unitLed(u, 'stuck'); beep(200, .15, .03);
          print(`${u} came back fragmented. a reboot won't hold it.`, 'alert');
          setMode('shell');
        })();
        return [];
      }
      if (!r.ok) return [r.reason === 'nothing wrong' ? `${u} is fine. nothing to ${verb}.`
        : r.reason === 'already being fixed' ? `${u} is already being seen to.` : `${u} is ${r.reason}. try ${r.need}.`];
      mode = 'proc'; stopProc = null;
      (async () => {
        const reboot = verb === 'reboot';
        if (reboot) unitLed(u, 'rebooting');
        print(reboot ? `rebooting ${u}` : `moving jobs off ${u}`, 'dim');
        const progress = lines[lines.length - 1];
        for (let i = 0; i < (reboot ? 6 : 3); i++) { await wait(reboot ? 950 : 900); progress.text += ' .'; render(); beep(300 + i * 30, .03, .015); }
        shift.finish(u); fixLanded(u); ledBurst(4);
        glenn.once('fixed', "Look at you go. That's the whole job, chief."); glenn.checkBasics();
        // the line a fix ends on changes by night (design.md: fixes carry the story)
        const done = shift.level >= 3 ? `${u}: cycle maintained.` : (reboot ? `${u} back online.` : `${u} rerouted, cooling.`) + (shift.level === 2 ? ' it missed you.' : '');
        logLine('vigild[412]: ' + done); print(done, 'ok');
        setMode('shell');
      })();
      return [];
    }
    // M.'s shortcut (design.md, mastery shrinks the chore): several units in one line, seen to together in one wait.
    // Each still costs its own energy; it saves time. Glenn wants it done by the book: the first time, he says so (an
    // order); after that, every time is logged as not complying.
    function fixMany(verb, names) {
      const out = [], go = [];
      for (const n of [...new Set(names.map(x => x.toUpperCase()))]) {
        if (!UNITS[n]) { out.push(`${verb}: ${n}: no such unit`); continue; }
        const r = shift.fix(n, verb);
        if (r.ok) { go.push(n); continue; }
        out.push(r.reason === 'nothing wrong' ? `${n} is fine. nothing to ${verb}.` : r.reason === 'already being fixed' ? `${n} is already being seen to.`
          : r.reason === 'fragmented' ? `${n} is fragmented. ${verb} won't put it back.` : `${n} is ${r.reason}. try ${r.need}.`);
      }
      if (!go.length) return out;
      for (const l of out) print(l);
      updateVitals();
      mode = 'proc'; stopProc = null;
      (async () => {
        const reboot = verb === 'reboot';
        if (reboot) for (const u of go) unitLed(u, 'rebooting');
        print(`${reboot ? 'rebooting' : 'moving jobs off'} ${go.join(' ')}`, 'dim');
        const progress = lines[lines.length - 1];
        for (let i = 0; i < (reboot ? 6 : 3); i++) { await wait(reboot ? 950 : 900); progress.text += ' .'; render(); beep(300 + i * 30, .03, .015); }
        for (const u of go) {
          shift.finish(u); fixLanded(u);
          const done = shift.level >= 3 ? `${u}: cycle maintained.` : (reboot ? `${u} back online.` : `${u} rerouted, cooling.`) + (shift.level === 2 ? ' it missed you.' : '');
          logLine('vigild[412]: ' + done); print(done, 'ok');
        }
        ledBurst(6); glenn.checkBasics();
        setMode('shell');
        if (glenn.taught('book')) logLine('vigild[1]: operator compliance: no (be a pal and keep it by the book)');
        else if (glenn.once('book', "Whoa there, chief. Be a pal and keep it by the book. One at a time.")) glenn.order('book', 'be a pal and keep it by the book');
      })();
      return [];
    }
    // ---- ping one unit: a down one times out, a hot one answers slowly
    async function runPingUnit(u) {
      mode = 'proc'; let stopped = false;
      stopProc = () => { stopped = true; };
      const st = shift.state(u), U = UNITS[u];
      print(`PING ${u} (10.0.${U.side === 'left' ? 1 : 2}.${U.n}): 56 data bytes`);
      let got = 0;
      for (let seq = 0; seq < 4 && !stopped; seq++) {
        await wait(st && st.kind === 'DOWN' ? 700 : 350);
        if (st && st.kind === 'DOWN') { print(`request timeout for seq ${seq}`); continue; }
        U.leds.forEach(l => { ledClass(l, 'ping', true); setTimeout(() => ledClass(l, 'ping', false), 160); });
        print(`64 bytes from ${u}: seq=${seq} ttl=64 time=${st ? (180 + rnd(220)) : (0.3 + Math.random() * .6).toFixed(1)} ms`);
        beep(1200, .03, .02); got++;
      }
      if (!stopped) print(`--- 4 packets transmitted, ${got} received, ${(4 - got) * 25}% packet loss ---`, 'dim');
      setMode('shell');
    }

    // ---- how a cartridge game ends: a card on the tube in the game's own box. The title in inverse video (green
    // won, amber lost) flashes in with a few notes, then what it came to comes up line by line, then any key.
    // lines: [label, value, cls?]. Returns { key, cancel }; done() runs on a key once the card has settled.
    function resultCard({ head, won, title, lines: rows, foot }, done) {
      playtest(`game over: ${title || head || ''} ${won ? 'WON' : 'lost'}`);
      const IN = 48, bar = '+' + '-'.repeat(IN) + '+';
      const pad = t => t + ' '.repeat(Math.max(0, IN - [...t].length));
      const plain = (t = '') => ({ html: '|' + esc(pad(t)) + '|' });
      const spaced = title.toUpperCase().split('').join(' ');
      const centred = ' '.repeat(Math.floor((IN - spaced.length) / 2)) + spaced;
      const body = [plain(), null, plain(), ...rows.map(([k, v, cls]) => {
        const lead = '    ' + k.padEnd(11);
        return cls ? { html: '|' + esc(lead) + `<span class="${cls}">${esc(v)}</span>` + esc(' '.repeat(Math.max(0, IN - lead.length - v.length))) + '|' } : plain(lead + v);
      }), plain()];
      let shown = 0, lit = true, ready = false, i = 0;
      const draw = () => {
        const banner = { html: '|' + (lit ? `<span class="${won ? 'rs-won' : 'rs-lost'}">${esc(pad(centred))}</span>` : esc(pad(''))) + '|' };
        const fl = '    ' + foot, key = ready ? 'any key' : '';
        const footRow = { html: '|' + esc(fl + ' '.repeat(Math.max(1, IN - fl.length - 11))) + `<span class="dim">${esc(key.padEnd(11))}</span>` + '|' };
        const all = [...body, footRow];
        frame = [{ text: head, cls: 'dim' }, bar, ...all.map((r, j) => j >= shown ? plain() : j === 1 ? banner : r), bar];
        render();
      };
      const notes = won ? [523, 659, 784, 1046] : [392, 311, 233];
      notes.forEach((f, j) => setTimeout(() => beep(f, j === notes.length - 1 ? .22 : .09, .03), j * 95));
      const steps = [() => { shown = 2; }, () => { lit = false; }, () => { lit = true; }, () => { lit = false; }, () => { lit = true; }];
      for (let j = 2; j < body.length + 1; j++) steps.push(() => { shown++; beep(1800, .012, .012); });
      steps.push(() => { ready = true; });
      const t = setInterval(() => { steps[i++](); draw(); if (i >= steps.length) clearInterval(t); }, 90);
      draw();
      return { key: () => { if (ready) done(); }, cancel: () => clearInterval(t) };
    }
    const secs = ms => `${Math.round(ms / 1000)} s`;
    const energyDelta = e0 => { const d = Math.round((shift.energy - e0) * 100); return (d > 0 ? '+' : '') + d + '%'; };

    // ---- DEFRAG, from its cartridge (the game is defrag.js): put a stuck unit's files back together
    function runDefrag(u) {
      const e0 = shift.energy, r = shift.fix(u, 'defrag');
      if (!r.ok) return [r.reason === 'nothing wrong' ? `${u} is fine. nothing to defrag.`
        : r.reason === 'already being fixed' ? `${u} is already being seen to.` : `${u} isn't fragmented. it's ${r.reason}.`];
      updateVitals();
      mode = 'game'; gameName = 'defrag';
      // the night's first game teaches: one file is a single block from whole
      const dial = shift.defragDial(), d = createDefrag({ files: dial.files, headStart: !room.defragTaught });
      room.defragTaught = true;
      if (window.dev) window.dev.game = d;                  // ?dev: the running game, for trying things out
      // four files, four shades you can't confuse at a glance, each with its own tint (all in the terminal font, so
      // all the same width). A whole file turns green. Under the board: the goal, and how far along each file is.
      const GLYPH = ['██', '▓▓', '▒▒', '░░'], LIMIT = 60000, t0 = performance.now();
      let over = null, card = null, nextWrite = t0 + dial.writeEvery * 1000, flash = null, handed = [];   // flash: the unit's last write
      const draw = () => {
        const now = performance.now(), left = Math.max(0, Math.ceil((LIMIT - (now - t0)) / 1000));
        const lit = flash && now < flash.until;
        const tint = f => d.whole(f) ? 'dfok' : 'df' + f;
        const rows = [];
        for (let y = 0; y < d.ROWS; y++) {
          let h = '|';
          for (let x = 0; x < d.COLS; x++) {
            const i = y * d.COLS + x, c = d.cells[i];
            if (i === d.cursor) { h += `<span class="dg-cur">${d.held !== null ? GLYPH[d.cells[d.held]] : c === null ? '··' : GLYPH[c]}</span>`; continue; }
            if (lit && (i === flash.from || i === flash.to)) { h += `<span class="dfw">${c === null ? '··' : GLYPH[c]}</span>`; continue; }
            if (c === null) { h += '<span class="dim">··</span>'; continue; }
            h += `<span class="${tint(c)}${i === d.held ? ' dg-held' : ''}">${GLYPH[c]}</span>`;
          }
          rows.push({ html: h + '|' });
        }
        const border = '+' + '-'.repeat(d.COLS * 2) + '+';
        const joined = d.sizes.map((n, f) => `<span class="${tint(f)}">${GLYPH[f]} ${d.whole(f) ? 'whole' : `${d.together(f)}/${n}`}</span>`).join('   ');
        frame = [{ text: ` defrag ${u}   ${String(left).padStart(2)}s   arrows + space: pick up, put down`, cls: 'dim' }, border, ...rows, border,
          { html: `<span class="dim"> together:</span>  ${joined}` },
          { text: " goal: each file's blocks side by side, in one row.", cls: 'dim' }];
        render();
      };
      // quiet: the game was stopped from outside (the cartridge pulled), so no card, straight back to the shell
      const finish = (won, why, quiet) => {
        if (over) return;
        clearInterval(timer);
        const whole = d.sizes.filter((_, f) => d.whole(f)).length, took = performance.now() - t0;
        if (won) {
          shift.finish(u); shift.paidBack(e0, shift.CART.win); fixLanded(u); ledBurst(8);
          handed = shift.won('DEFRAG');
          logLine(`vigild[412]: ${u} defragmented, back in service.`);
          over = `defrag complete. ${u} is back.`;
        } else {
          shift.failed(u);
          logLine(`vigild[412]: ${u} still stuck (defrag ${why}).`);
          over = `${why}. ${u} is still stuck.`;
        }
        updateVitals();
        if (quiet) return;
        card = resultCard({
          head: ` defrag ${u}`, won, title: won ? 'defrag complete' : 'defrag failed',
          lines: [['unit', won ? `${u} back in service` : `${u} still stuck`, won ? 'ok' : 'alert'],
            ['files', `${whole} of ${d.sizes.length} whole`], ['time', won ? secs(took) : why], ['energy', energyDelta(e0)]],
          foot: won ? (handed.length ? 'someone sent you mail.' : 'the racks settle.') : 'it keeps writing.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); if (longest >= 15 && steadying) setTimeout(keyFromPong, 600); });
      };
      const timer = setInterval(() => {
        const now = performance.now();
        if (now >= nextWrite) {
          const w = d.write(); nextWrite += dial.writeEvery * 1000;
          if (w) { flash = { ...w, until: now + 700 }; beep(140, .03, .015); }
          if (d.won()) finish(true);
        }
        if (now - t0 >= LIMIT) finish(false, 'out of time');
        draw();
      }, 200);
      stopProc = () => {
        if (!over) finish(false, 'aborted', true);
        clearInterval(timer); card?.cancel(); gameKey = null; gameName = null;
        print(over, over.startsWith('defrag complete') ? 'ok' : 'alert'); setMode('shell');
      };
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (k === 'q' || k === 'Escape') { finish(false, 'aborted'); return; }
        if (k === 'ArrowLeft') d.move(-1, 0); else if (k === 'ArrowRight') d.move(1, 0);
        else if (k === 'ArrowUp') d.move(0, -1); else if (k === 'ArrowDown') d.move(0, 1);
        else if (k === ' ') { beep(d.act() === 'pick' ? 700 : 900, .03, .02); if (d.won()) finish(true); }
        draw();
      };
      draw();
      return [];
    }

    // ---- top: a live view of the units you can see
    function runTop() {
      mode = 'proc';
      const units = Object.keys(UNITS).map(name => ({ name, util: .2 + Math.random() * .6, temp: 33 + rnd(9) }));
      const draw = () => {
        frame = [
          { text: `top - ${stamp()}  128 units, ${shift.open().length} alerts  strikes ${shift.strikes}/${shift.STRIKE.max}  (any key exits)`, cls: 'dim' },
          '',
          'UNIT  UTIL                      TEMP  STATE',
          ...units.map(u => {
            const st = shift.state(u.name), down = st && st.kind === 'DOWN', hot = st && st.kind === 'HOT';
            const util = down ? 0 : u.util, n = Math.round(util * 18);
            const temp = down ? '--' : hot ? String(74 + rnd(7)) : String(u.temp);
            const state = st ? (st.fixing ? 'FIXING' : st.kind) : 'ok';
            return `${u.name.padEnd(5)} ${'█'.repeat(n)}${'░'.repeat(18 - n)} ${String(Math.round(util * 100)).padStart(3)}%  ${down ? '-- ' : temp.padStart(2) + 'C'}  ${state}`;
          }),
        ];
        render();
      };
      draw();
      const t = setInterval(() => {
        units.forEach(u => { u.util = clamp(u.util + (Math.random() - .5) * .25, .02, 1); u.temp = clamp(u.temp + rnd(3) - 1, 29, 47); });
        if (Math.random() < .6) ledBurst(3);
        draw();
      }, 700);
      stopProc = () => { clearInterval(t); setMode('shell'); };
    }

    // ---- ping: a pulse travels down a rack
    async function runPing(rack) {
      mode = 'proc'; let stopped = false;
      stopProc = () => { stopped = true; };
      const list = leds.filter(l => l.rack === rack), dropping = shift.state('rack-' + rack)?.kind === 'LOSS';
      let lost = 0;
      print(`PING rack-${rack} (10.0.${rack === 'left' ? 1 : 2}.1): 56 data bytes`);
      for (let seq = 0; seq < 4 && !stopped; seq++) {
        if (dropping && (seq === 1 || Math.random() < .35)) { await wait(700); if (stopped) break; print(`request timeout for seq ${seq}`); lost++; continue; }
        for (const l of list) { ledClass(l, 'ping', true); setTimeout(() => ledClass(l, 'ping', false), 160); await wait(14); if (stopped) break; }
        print(`64 bytes from rack-${rack}: seq=${seq} ttl=64 time=${(list.length * .014 + Math.random() * .3).toFixed(1)} ms`);
        beep(1200, .03, .02);
        await wait(300);
      }
      if (!stopped) print(`--- 4 packets transmitted, ${4 - lost} received, ${lost * 25}% packet loss ---`, lost ? 'alert' : 'dim');
      setMode('shell');
    }
    // unit 23, which is in no rack, answers once ROUTE has been won (design.md: ROUTE's story layer)
    // (the eighth lost-night piece: your name answers too, from 10.0.0.51, a unit that isn't in any rack)
    async function runPing23(name = '23') {
      mode = 'proc'; let stopped = false;
      stopProc = () => { stopped = true; };
      print(`PING ${name} (${name === '23' ? '10.0.0.23' : '10.0.0.51'}): 56 data bytes`);   // your name: an address of its own (unit 23's leaned the mystery one way)
      for (let seq = 0; seq < 4 && !stopped; seq++) { await wait(900); print(`64 bytes from ${name}: seq=${seq} ttl=64 time=0.0 ms`); beep(1200, .03, .015); }
      if (!stopped) print('--- 4 packets transmitted, 4 received, 0% packet loss ---', 'dim');
      setMode('shell');
    }

    // ---- ROUTE, from its cartridge (the game is route.js): a rack dropping packets, played as Snake on the square grid
    function runRoute(rack) {
      const e0 = shift.energy, fixed = shift.fix(rack, 'route');
      if (!fixed.ok) return [fixed.reason === 'nothing wrong' ? `${rack} is fine. nothing to route.`
        : fixed.reason === 'already being fixed' ? `${rack} is already being seen to.` : `${rack} isn't dropping packets. it's ${fixed.reason}.`];
      updateVitals();
      mode = 'game'; gameName = 'route';
      // the night's first game teaches: five hops, no dead links, a slow train
      const dial = room.routeTaught ? shift.routeDial() : { hops: 5, dead: 0, tick: 170 };
      room.routeTaught = true;
      const g = createRoute({ hops: dial.hops, dead: dial.dead });
      if (window.dev) window.dev.game = g;
      const BOX = 48, LIMIT = 60000;
      let t0 = performance.now(), started = false, over = null, card = null, timer = 0, handed = [], reached = 0;
      const centerText = (t, w) => { const pad = w - t.length; return ' '.repeat(Math.floor(pad / 2)) + t + ' '.repeat(Math.ceil(pad / 2)); };
      const draw = () => {
        const left = started ? Math.max(0, Math.ceil((LIMIT - (performance.now() - t0)) / 1000)) : 60;
        const border = '+' + '-'.repeat(BOX) + '+', empty = '|' + ' '.repeat(BOX) + '|';
        // one line above the board (the tube has no room below it): the clock, the hops, the drops; when the last hop
        // is reached, the port is open, in green
        const hops = g.open() ? '<span class="dfok">port open</span>' : `hops ${g.reached()}/${g.total}`;
        frame = [{ html: ` <span class="dim">route ${rack}   ${String(left).padStart(2)}s</span>   ${hops}   <span class="dim">dropped ${g.drops()}/${g.DROPS}</span>` },
          border, ...Array(g.ROWS).fill(empty), border];
        if (!started) frame[2 + Math.floor(g.ROWS / 2) - 2] = '|' + centerText('press an arrow key', BOX) + '|';
        field = { col: 1, row: 2, width: BOX, cols: g.COLS, rows: g.ROWS, cells: [
          ...g.deadLinks.map(([x, y]) => [x, y, 'dead']),
          [g.port[0], g.port[1], g.open() ? 'port' : 'portShut'],
          ...(g.hop() ? [[g.hop()[0], g.hop()[1], 'food']] : []),
          ...g.train.map(([x, y], i) => [x, y, i ? 'body' : 'head']).filter(([x]) => x >= 0)] };
        render();
      };
      const finish = (won, why, quiet) => {
        if (over) return;
        clearTimeout(timer);
        const took = performance.now() - t0;
        if (won) {
          shift.finish(rack); shift.paidBack(e0, shift.CART.win); unitLed(rack, null); rackFlow(rack);
          handed = shift.won('ROUTE'); room.routeWon = true;
          logLine(`vigild[412]: ${rack} routing restored, 0% loss.`);
          over = `route delivered. ${rack} is passing traffic.`;
        } else {
          shift.failed(rack);
          logLine(`vigild[412]: ${rack} still dropping packets (route ${why}).`);
          over = `${why}. ${rack} is still dropping packets.`;
        }
        updateVitals();
        if (quiet) return;
        field = null;
        card = resultCard({
          head: ` route ${rack}`, won, title: won ? 'route delivered' : 'route lost',
          lines: [['rack', won ? `${rack} passing traffic` : `${rack} still dropping`, won ? 'ok' : 'alert'],
            ['hops', `${g.reached()} of ${g.total}`], ['dropped', `${g.drops()} of ${g.DROPS}`], ['time', won ? secs(took) : why], ['energy', energyDelta(e0)]],
          foot: won ? (handed.length ? 'someone sent you mail.' : 'traffic flows again.') : 'the rack keeps dropping.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); });
      };
      const tick = () => {
        if (over) return;
        if (started && performance.now() - t0 >= LIMIT) { finish(false, 'out of time'); return; }
        let wait = dial.tick;
        if (started) {
          const res = g.step();
          if (res === 'won') { beep(1320, .12, .04); finish(true); return; }
          if (res === 'lost') { beep(120, .35, .05); finish(false, 'three packets dropped'); return; }
          if (res === 'dropped') { beep(160, .2, .04); wait = 700; }
          else if (g.reached() > reached) { reached = g.reached(); beep(880 + reached * 40, .05, .03); ledBurst(4); }
        }
        draw();
        timer = setTimeout(tick, wait);
      };
      stopProc = () => {
        if (!over) finish(false, 'aborted', true);
        clearTimeout(timer); card?.cancel(); gameKey = null; gameName = null; field = null;
        print(over, over.startsWith('route delivered') ? 'ok' : 'alert'); setMode('shell');
      };
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (k === 'q' || k === 'Escape') { finish(false, 'aborted'); return; }
        const name = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[k];
        if (!name) return;
        if (!started) { started = true; t0 = performance.now(); }
        g.steer(name);
      };
      tick();
      return [];
    }

    // ---- snake, on the tube. Not a command any more (Arnold, 2026-09-30): it becomes the ROUTE cartridge
    function runSnake() {
      mode = 'game';
      // the board is the box's 48 x 11 text cells, played as a grid of true squares one text row on a side (20 x 11):
      // on the text cells themselves every node was a sliver and a step down was 2.4 steps across
      const BOX = 48, Hh = 11, W = Math.floor(BOX * crt.CW / crt.LH);
      let s = [[10, 5], [9, 5], [8, 5]], dir = [1, 0], next = dir, food = null, score = 0, dead = false, started = false;
      const place = () => { do food = [rnd(W), rnd(Hh)]; while (s.some(([x, y]) => x === food[0] && y === food[1])); };
      place();
      const centerText = (t, w) => { const pad = w - t.length; return ' '.repeat(Math.floor(pad / 2)) + t + ' '.repeat(Math.ceil(pad / 2)); };
      const draw = () => {
        const border = '+' + '-'.repeat(BOX) + '+', empty = '|' + ' '.repeat(BOX) + '|';
        frame = [{ text: dead ? ` snake   score ${score}   game over, any key` : ` snake   score ${score}   arrows to steer, q to quit`, cls: dead ? 'alert' : 'dim' },
          border, ...Array(Hh).fill(empty), border];
        if (!started) frame[5] = '|' + centerText('press an arrow key', BOX) + '|';
        field = { col: 1, row: 2, width: BOX, cols: W, rows: Hh, cells: [[food[0], food[1], 'food'], ...s.map(([x, y], i) => [x, y, i ? 'body' : 'head'])] };
        render();
      };
      const step = () => {
        if (!started || dead) return;
        dir = next;
        const h = [s[0][0] + dir[0], s[0][1] + dir[1]];
        if (h[0] < 0 || h[0] >= W || h[1] < 0 || h[1] >= Hh || s.some(([x, y]) => x === h[0] && y === h[1])) {
          dead = true; beep(140, .35, .05); draw(); return;
        }
        s.unshift(h);
        if (h[0] === food[0] && h[1] === food[1]) { score++; beep(900 + score * 30, .05, .03); ledBurst(6); place(); }
        else s.pop();
        draw();
      };
      const t = setInterval(step, 130);
      draw();
      stopProc = () => { clearInterval(t); gameKey = null; print(`snake: score ${score}`); setMode('shell'); };
      gameKey = k => {
        if (dead || k === 'q' || k === 'Escape') { stopProc(); return; }
        const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
        if (!d) return;
        if (started && d[0] === -dir[0] && d[1] === -dir[1]) return;   // no reversing into yourself
        next = d; if (!started) { started = true; draw(); }
      };
    }

    // ---- the mail picker (Arnold: like the switch picker, not numbers): up/down chooses, enter opens it on the
    // tube, enter or esc goes back to the inbox, esc there leaves. Unread messages bright, read ones dim.
    function runMailPicker() {
      mode = 'game'; gameName = 'mail';
      const box = inbox.items();
      let sel = Math.max(0, box.findIndex(m => !m.read)), reading = false;
      const P = { from: 14, subject: 27 };
      const asRows = lines => lines.flatMap(l => wrap(runsOf(l)).map(row => ({ html: row.map(r => r.cls ? `<span class="${r.cls}">${esc(r.text)}</span>` : esc(r.text)).join('') })));
      const draw = () => {
        if (reading) {
          frame = [...asRows(inbox.open(sel)), '', { text: ' enter or esc: back to the inbox', cls: 'dim' }];
        } else {
          const n = inbox.unread();
          const rows = box.map((m, i) => {
            const t = ` ${m.from.slice(0, P.from).padEnd(P.from)} ${m.subject.slice(0, P.subject).padEnd(P.subject)} ${m.at}`;
            if (i === sel) return { html: `<span class="dg-cur">${esc(t.padEnd(crt.COLS))}</span>` };
            return m.read ? { text: t, cls: 'dim' } : { text: t };
          });
          frame = [{ html: ` inbox  <span class="dim">${box.length} message${box.length === 1 ? '' : 's'}${n ? `, ${n} new` : ''}</span>` }, '', ...rows, '',
            { text: ' up/down to choose, enter to open, esc to leave', cls: 'dim' }];
        }
        render();
      };
      const close = () => { gameKey = null; gameName = null; stopProc = null; setMode('shell'); };
      stopProc = close;
      gameKey = k => {
        if (reading) { if (k === 'Enter' || k === 'Escape' || k === 'q') { reading = false; draw(); } return; }
        if (k === 'Escape' || k === 'q') { close(); return; }
        if (k === 'ArrowDown' || k === 'ArrowUp') { sel = (sel + (k === 'ArrowDown' ? 1 : -1) + box.length) % box.length; draw(); return; }
        if (k === 'Enter' && box[sel]) { reading = true; draw(); }
      };
      draw();
    }

    // ---- the switch picker: up/down moves and plays a couple of keystrokes on that switch, enter picks it, esc
    // leaves without changing anything, and typing narrows the list (by name or description)
    function runSwitchPicker() {
      mode = 'game'; gameName = 'switch';
      const start = sigName, VIS = crt.ROWS - 3;
      let filter = '', sel = Math.max(0, SIG_NAMES.indexOf(sigName)), top = 0;
      const list = () => SIG_NAMES.filter(n => n.includes(filter) || PACKS[n].note.toLowerCase().includes(filter));
      // hear a switch without choosing it: play through it for a moment, then put the chosen one back
      const as = (name, fn) => { const prev = sigName; sigName = name; try { fn(); } finally { sigName = prev; } };
      const audition = name => loadPack(name).then(() => {
        if (gameName !== 'switch' || list()[sel] !== name) return;
        ['key-J', 'key-K'].forEach((id, i) => setTimeout(() => { as(name, () => click('key', false, id)); setTimeout(() => as(name, () => click('key', true, id)), 60); }, i * 120));
      });
      const draw = () => {
        const L = list(); sel = Math.min(sel, Math.max(0, L.length - 1));
        if (sel < top) top = sel;
        if (sel >= top + VIS) top = sel - VIS + 1;
        top = Math.max(0, Math.min(top, Math.max(0, L.length - VIS)));
        const rows = L.slice(top, top + VIS).map((n, i) => {
          const t = `${top + i === sel ? '>' : ' '}${n === start ? '*' : ' '}${n.padEnd(11)}${PACKS[n].note}`.slice(0, crt.COLS);   // * the one in use
          if (top + i === sel) return { html: `<span class="dg-cur">${esc(t.padEnd(crt.COLS))}</span>` };
          return { text: t, cls: n === start ? '' : 'dim' };
        });
        frame = [{ text: ' switches (* in use)   up/down to listen, enter to pick', cls: 'dim' },
          { text: ` find: ${filter}` + (L.length ? '' : '   (nothing by that name)') },
          ...rows,
          ...(L.length > VIS ? [{ text: ` ${top + 1}-${Math.min(L.length, top + VIS)} of ${L.length}`, cls: 'dim' }] : [])];
        render();
      };
      const close = () => { gameKey = null; gameName = null; stopProc = null; setMode('shell'); };
      stopProc = close;
      gameKey = k => {
        const L = list();
        if (k === 'Escape') { close(); return; }
        if (k === 'ArrowDown' || k === 'ArrowUp') {
          if (!L.length) return;
          sel = (sel + (k === 'ArrowDown' ? 1 : -1) + L.length) % L.length;
          draw(); audition(L[sel]); return;
        }
        if (k === 'Enter') {
          const n = L[sel]; if (!n) return;
          close(); print(prompt() + 'switch ' + n); runCommand('switch ' + n); return;
        }
        if (k === 'Backspace') filter = filter.slice(0, -1);
        else if (k === 'DeleteWord') filter = '';
        else if (k.length === 1 && /[a-z0-9 -]/i.test(k)) filter = (filter + k.toLowerCase()).trimStart();
        else return;
        sel = 0; top = 0; draw();
      };
      draw();
    }

    // ---- pong, from the cartridge
    function runPong() {
      mode = 'game'; gameName = 'pong';
      const W = 48, Hh = 11, PL = 3;
      let py = 4, cy = 4, bx = 24, by = 5, vx = 1, vy = .5, you = 0, cpu = 0, started = false, over = null, tick = 0;
      // a rally is the hits in one point, both paddles; the previous operator's best on this cart was 14
      let rally = 0, longest = 0, card = null, best = 14, bestBy = 'm';
      const t0 = performance.now(), pongE0 = shift.energy;
      try { best = +localStorage.getItem('nightshift.pongBest') || 14; bestBy = localStorage.getItem('nightshift.pongBestBy') || 'm'; } catch {}
      // Once a night, in the first game, your paddle stops listening for about two seconds and returns the ball by
      // itself, perfectly; the arrow keys on the drawn keyboard go down on their own while it does. Lag, probably.
      // (design.md, story: night 1's small wrong things; it happens while your eyes are on the tube.)
      let possessed = 0;
      const haunt = !room.pongHaunted;
      // While M.'s key is still under the cart, the CPU steadies match by match (design.md: most players can't beat 14 on
      // night 1, and "it lets you win."): from your second match it tracks the ball every tick, from the third it also
      // sends it back without adding angle. Counted across nights; nothing says so.
      const steadying = file.key === 'none' && !file.unlocked;
      let matchN = 0; try { matchN = (+localStorage.getItem('vigil.pongMatches') || 0) + 1; } catch (e) {}
      const cpuEvery = steadying && matchN >= 2 ? 1 : 2, cpuStraight = steadying && matchN >= 3;
      const centerText = (t, w) => { const pad = w - t.length; return ' '.repeat(Math.floor(pad / 2)) + t + ' '.repeat(Math.ceil(pad / 2)); };
      const serve = dir => { rally = 0; bx = 24; by = 5; vx = dir; vy = (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .3); };
      const draw = () => {
        const g = Array.from({ length: Hh }, () => Array(W).fill(' '));
        for (let i = 0; i < PL; i++) { g[py + i][1] = '█'; g[cy + i][W - 2] = '█'; }
        const byi = clamp(Math.round(by), 0, Hh - 1);
        if (!over) g[byi][clamp(bx, 0, W - 1)] = '●';
        const border = '+' + '-'.repeat(W) + '+';
        frame = [{ text: ` pong   you ${you}   cpu ${cpu}   up/down, first to 5, q to quit`, cls: 'dim' }, border, ...g.map(r => '|' + r.join('') + '|'), border];
        if (!started) { frame[6] = '|' + centerText('press up or down to serve', W) + '|'; frame[8] = '|' + centerText(`cart best: ${best} hits, ${bestBy}`, W) + '|'; }
        render();
      };
      const step = () => {
        if (!started || over) return;
        tick++;
        if (haunt && !room.pongHaunted && tick > 40 && vx < 0 && bx === 30) { room.pongHaunted = true; possessed = 30; }
        if (possessed > 0) {
          possessed--;
          const want = clamp(Math.round(by) - 1, 0, Hh - PL);
          if (want !== py) { const k = want < py ? 'key-ArrowUp' : 'key-ArrowDown'; py += want < py ? -1 : 1; press(k); setTimeout(() => release(k), 60); }
        }
        bx += vx; by += vy;
        if (by < 0) { by = 0; vy = -vy; } else if (by > Hh - 1) { by = Hh - 1; vy = -vy; }
        const byi = Math.round(by);
        if (bx === 2 && vx < 0 && byi >= py && byi < py + PL) { vx = 1; vy += (byi - (py + 1)) * .35; beep(660, .03, .03); longest = Math.max(longest, ++rally); }
        if (bx === W - 3 && vx > 0 && byi >= cy && byi < cy + PL) { vx = -1; if (!cpuStraight) vy += (byi - (cy + 1)) * .35; beep(520, .03, .03); longest = Math.max(longest, ++rally); }
        vy = clamp(vy, -1.1, 1.1);
        if (bx < 0) { cpu++; beep(200, .2, .04); serve(1); }
        if (bx >= W) { you++; beep(1000, .12, .04); ledBurst(6); serve(-1); }
        // the cpu tracks the ball, but only every other tick and with a little hesitation
        if (tick % cpuEvery === 0 && vx > 0 && Math.random() < .85) { const target = byi - 1; if (cy < target) cy++; else if (cy > target) cy--; }
        cy = clamp(cy, 0, Hh - PL);
        if (you >= 5 || cpu >= 5) { end(you >= 5); return; }
        draw();
      };
      if (window.dev) window.dev.game = { point: () => { you++; } };   // ?dev: score a point, for trying the ending
      let handed = [];
      const end = won => {
        over = won ? 'you win' : 'cpu wins';
        clearInterval(t);
        if (won) handed = shift.won('PONG');
        shift.rest();                                    // a game of Pong is a short break, win or lose
        if (won) shift.paidBack(pongE0, shift.PONG_BREAK); // and a win pays for its minute
        updateVitals();
        const record = longest > best;
        if (record) { best = longest; bestBy = account.user; try { localStorage.setItem('nightshift.pongBest', String(best)); localStorage.setItem('nightshift.pongBestBy', bestBy); } catch {} }
        card = resultCard({
          head: ' pong', won, title: won ? 'you win' : 'cpu wins',
          lines: [['score', `${you} - ${cpu}`], ['longest', `${longest} hit${longest === 1 ? '' : 's'}`],
            ['cart best', record ? `${best} hits, a new best` : `${best} hits, ${bestBy}`, record ? 'ok' : undefined], ['time', secs(performance.now() - t0)], ['energy', energyDelta(pongE0)]],
          foot: handed.length ? 'someone sent you mail.' : won ? 'the cpu paddle waits a moment.' : 'it has had a lot of practice.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); });
      };
      const t = setInterval(step, 85);
      draw();
      stopProc = () => { clearInterval(t); card?.cancel(); gameKey = null; gameName = null; print(`pong: you ${you}, cpu ${cpu}`); setMode('shell'); };
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (k === 'q' || k === 'Escape') { stopProc(); return; }
        if (possessed > 0 && (k === 'ArrowUp' || k === 'ArrowDown')) return;   // not yours, for a moment
        if (k === 'ArrowUp') py = Math.max(0, py - 1);
        else if (k === 'ArrowDown') py = Math.min(Hh - PL, py + 1);
        else return;
        if (!started) { started = true; serve(-1); if (steadying) try { localStorage.setItem('vigil.pongMatches', String(matchN)); } catch (e) {} }
        draw();
      };
    }

    // ---- matrix: rain on the tube, then the room has a word with you
    function runMatrix() {
      mode = 'proc';
      const W = 52, Hh = 14, GLYPHS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ$#%&*+=<>/\|;:^~';
      const prevTheme = room.theme; setTheme('green');
      const cols = Array.from({ length: W }, () => ({ y: -rnd(Hh * 2), speed: .25 + Math.random() * .7, len: 4 + rnd(9), chars: Array.from({ length: Hh }, () => GLYPHS[rnd(GLYPHS.length)]) }));
      const t0 = performance.now();
      const LINES = ['wake up, operator.', 'the racks have you.', 'knock, knock.'];
      let msg = '', msgIdx = 0, msgChar = 0, lastMsg = 0, phase = 0;
      const draw = () => {
        const now = performance.now(), el = now - t0;
        // the message: after five seconds, lines type out over the rain, one at a time
        if (el > 5000) {
          if (msgIdx < LINES.length) {
            if (now - lastMsg > (msgChar === 0 ? 900 : 55)) {
              lastMsg = now; msgChar++; msg = LINES[msgIdx].slice(0, msgChar);
              if (msgChar > 0 && msgChar <= LINES[msgIdx].length) beep(1400 + rnd(300), .02, .015);
              if (msgChar > LINES[msgIdx].length + 22) { msgIdx++; msgChar = 0; msg = ''; ledBurst(12); }
            }
          }
        }
        const rows = [];
        for (let r = 0; r < Hh; r++) {
          let html = '';
          for (let c = 0; c < W; c++) {
            const col = cols[c], d = col.y - r;         // distance behind the head
            let cls = '';
            if (d < 0 || d > col.len) { html += ' '; continue; }
            if (Math.random() < .04) col.chars[r] = GLYPHS[rnd(GLYPHS.length)];
            cls = d < 1 ? 'mx0' : d < col.len * .35 ? 'mx1' : d < col.len * .7 ? 'mx2' : 'mx3';
            html += `<span class="${cls}">${col.chars[r]}</span>`;
          }
          rows.push({ html });
        }
        if (msg) {
          const pad = Math.max(0, Math.floor((W - msg.length - 2) / 2));
          rows[6] = { html: ' '.repeat(pad) + `<span class="mxmsg"> ${esc(msg)} </span>` };
        }
        frame = rows; render();
      };
      const t = setInterval(() => {
        for (const col of cols) { col.y += col.speed; if (col.y - col.len > Hh) { col.y = -rnd(6); col.speed = .25 + Math.random() * .7; col.len = 4 + rnd(9); } }
        if (Math.random() < .5) ledBurst(2);
        draw();
      }, 70);
      draw();
      stopProc = () => { clearInterval(t); setTheme(prevTheme); print('matrix: connection closed.', 'dim'); setMode('shell'); };
    }

    // ---- the cartridge: mounts a directory that only exists while it's in the slot
    const CART_FILES = { PONG: {
      NOTES: [
        'NOTES  (left by the previous operator)',
        '',
        '- the left knob is power. the right one is not volume. I checked.',
        '- rack-left unit 23 makes a noise around 3am. it is fine. probably.',
        '- if the screen goes blue, that is just the screen.',
        "- I got to 14 rallies on this. beat that and I'll tell you something.",
        '- do not type rm -rf /. I mean it.',
        '  ...ok I did it once.',
      ],
      'pong.bin': ['(binary) run it with: pong'],
      'old.log': [
        '2019-04-02 03:07:41 vigild[88]: unit 23 reports a noise',
        '2019-04-02 03:07:42 vigild[88]: noise acknowledged',
        '2019-04-02 03:11:09 vigild[88]: coffee level 0%',
        '2019-04-02 03:11:10 operator: going home',
      ],
    }, DEFRAG: {
      README: [
        'DEFRAG  (disk defragmenter, rack edition)',
        '',
        'usage: defrag <unit>',
        '',
        'a stuck unit has its files in pieces. put each one back together:',
        "all of a file's blocks side by side, in one row.",
        'arrows move, space picks a block up and puts it down.',
        'under the disk: how many of each file are together so far.',
        'a whole file turns green, and the unit leaves it alone.',
        'the unit keeps writing while you work: watch for the flash.',
        'you have a minute.',
      ],
      'defrag.bin': ['(binary) run it with: defrag <unit>'],
    }, ROUTE: {
      README: [
        'ROUTE  (packet router, rack edition)',
        '',
        'usage: route <rack-left|rack-right>',
        '',
        "a rack dropping packets has lost its way. you're the train:",
        'arrows steer. reach each hop as it lights up; each one',
        'adds a car. when the last is reached the core port opens',
        'on the right edge: deliver the train into it.',
        'hit a dead link, a wall or yourself and a packet drops:',
        'you come back in at the uplink. three drops and it is lost.',
        'you have a minute.',
      ],
      'route.bin': ['(binary) run it with: route <rack>'],
    } };
    function mount(on, quiet = false) {
      if (on) {
        FS.cart = CART_FILES[on];
        if (mode === 'shell' && !quiet) (async () => {
          lines.push({ text: prompt() + line }); line = '';
          print('slot0: media detected', 'dim'); await wait(650);
          print('mounting /dev/slot0 on ~/cart ... ok', 'dim'); render();
        })();
      } else {
        delete FS.cart;
        if (cwd.startsWith('~/cart')) cwd = '~';
        if (mode === 'game' && (gameName === 'pong' || gameName === 'defrag')) { stopProc?.(); print(`${gameName}: cartridge removed`, 'dim'); }
        if (mode === 'shell') { lines.push({ text: prompt() + line }); line = ''; print('slot0: media removed', 'dim'); }
      }
    }
    let gameName = null;

    // ---- rm -rf /: the racks die, the tube rolls, then it all comes back
    async function meltdown() {
      mode = 'proc'; room.melting = true; stopProc = null;
      print('rm: descending into /', 'dim');
      const victims = ['/srv/models/base-7b.bin', '/srv/models/tuned-2026-09.bin', '/var/log/vigild.log', '/etc/vigil.conf', '/bin/sh', '/dev/coffee'];
      for (const v of victims) { await wait(260); print('removed ' + v); beep(300, .04, .02); }
      await wait(400); print('rm: cannot remove /: device is busy... removing anyway', 'dim');
      for (let i = 0; i < leds.length; i++) {
        const l = leds[i];
        ledClass(l, 'amber', true);
        setTimeout(() => { ledClass(l, 'amber', false); ledClass(l, 'dead', true); }, 220);
        if (i % 2 === 0) await wait(22);
      }
      beep(90, .8, .05);
      terminal.classList.add('glitch');
      await wait(1500);
      terminal.classList.remove('glitch');
      frame = ['']; render();
      await wait(700);
      screenG.classList.add('off'); terminal.classList.add('off'); degauss(false);
      await wait(1600);
      screenG.classList.remove('off'); terminal.classList.remove('off'); terminal.classList.add('warm'); degauss(true);
      setTimeout(() => terminal.classList.remove('warm'), 1700);
      for (let i = 0; i < leds.length; i++) { ledClass(leds[i], 'dead', false); if (i % 3 === 0) await wait(20); }
      lines = []; frame = null; room.melting = false;
      await boot(['restored from snapshot ' + stamp() + '.', 'that one is on you, operator.']);
    }

    // ---- tab completion
    function complete() {
      const parts = line.split(/\s+/);
      const last = parts[parts.length - 1];
      let cands;
      if (parts.length === 1) cands = Object.keys(COMMANDS).filter(c => c.startsWith(last) && (c !== 'defrag' || room.cart === 'DEFRAG') && (c !== 'route' || room.cart === 'ROUTE'));
      else if (parts.length === 2 && parts[0] === 'route') cands = ['rack-left', 'rack-right'].filter(n => n.startsWith(last.toLowerCase()));
      else if ((parts.length === 2 && ['ping', 'defrag'].includes(parts[0])) || (parts.length >= 2 && ['reboot', 'reroute'].includes(parts[0]))) {
        const names = [...new Set([...shift.open().map(o => o.unit), ...Object.keys(UNITS)])];
        cands = names.filter(n => n.startsWith(last.toUpperCase()));
      } else {
        const slash = last.lastIndexOf('/');
        const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '', filePart = last.slice(slash + 1);
        const { node } = resolve(dirPart || '.');
        if (!node || !isDir(node)) return;
        cands = listDir(node).filter(n => n.startsWith(filePart)).map(n => dirPart + n);
      }
      if (!cands.length) return;
      let common = cands[0];
      for (const c of cands) while (!c.startsWith(common)) common = common.slice(0, -1);
      parts[parts.length - 1] = common + (cands.length === 1 && !common.endsWith('/') ? ' ' : '');
      line = parts.join(' ');
      if (cands.length > 1 && common === last) { print(prompt() + line); print(cands.join('   '), 'dim'); }
    }

    // the welcome email from Vigil Systems: who you are and what the job is
    // login: the tube asks who you are the first time, and remembers you after that
    let loginDone = null;
    function askLogin() { mode = 'login'; line = ''; render(); return new Promise(done => { loginDone = done; }); }
    async function login() {
      account.loggingIn = true;
      if (!account.name) await askLogin();
      else {
        await wait(300); print(LOGIN + account.name); beep(660, .035);
        if (account.lastLogin) { await wait(260); print('Last login: ' + account.lastLogin + ' on tty1', 'dim'); }
      }
      account.user = userOf(account.name);
      playtest('logged in');
      try { account.mailRead = localStorage.getItem('vigil.mailRead') === '1'; } catch (e) {}
      const d = new Date(), p = n => String(n).padStart(2, '0');
      account.loginAt = d;                           // (finger glenn: on since three seconds after this)
      const stamp = `${d.toDateString().slice(0, 10)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      try {
        localStorage.setItem('vigil.operator', account.name); localStorage.setItem('vigil.lastLogin', stamp);
        const logins = JSON.parse(localStorage.getItem('vigil.logins') || '[]'); logins.push(stamp);   // for last
        localStorage.setItem('vigil.logins', JSON.stringify(logins.slice(-8)));
      } catch (e) {}
    }
    // the shift clock runs from here: after the login and the welcome
    function clockOn() { account.loggingIn = false; shiftT = performance.now(); drawFile(); }
    // logout: back to the login prompt, as someone else if you like
    async function logout() {
      account.name = null; account.user = 'operator'; account.mailRead = false; glenn.forget();
      try { localStorage.removeItem('vigil.operator'); localStorage.removeItem('vigil.mailRead'); localStorage.removeItem('vigil.night'); } catch (e) {}
      lines = []; mode = 'boot'; render();
      await wait(500);
      await login();
      await welcome();
      clockOn();
      setMode('shell');
      glenn.arriveIn(3000);
    }
    async function welcome() {
      await wait(250); print('');
      print('Welcome to the Vigil terminal.');
      await wait(200);
      if (!account.mailRead) { print('You have new mail.'); print("Type 'mail' to see it.", 'dim'); }
      else print("Type 'help' to see what it can do.", 'dim');
    }

    // afterLogin: what the room shows between the login and the welcome (night 3's first alert)
    async function boot(extra = [], afterLogin = null) {
      mode = 'boot'; frame = null;
      const seq = [
        ['VIGIL BIOS  v2.4            (c) Vigil Systems', 'dim', 200],
        ['Memory test ............ 640K OK', '', 380],
        ['Scanning racks ......... 4 cabinets, 128 units', '', 520],
        ['Mounting /srv/models ... ok', 'ok', 300],
        FS.cart ? ['Mounting /dev/slot0 .... ok', 'ok', 260] : ['Cartridge slot ......... empty', '', 260],
        ['Starting vigild ........ ok', 'ok', 340],
        ['', '', 250],
        ...extra.map(t => [t, 'dim', 260]),
      ];
      for (const [t, cls, ms] of seq) { await wait(ms); print(t, cls); if (t) beep(t.includes('ok') ? 1046 : 660, .035); }
      await login();
      await afterLogin?.();
      await welcome();
      await wait(200); setMode('shell');
      clockOn();                                        // last: whatever follows the boot shows before the clock runs
    }

    return {
      input(key) {
        if (locked) return;                              // someone else has the keyboard
        lastTyped = performance.now();
        if (mode === 'off' || mode === 'boot') return;
        scrollBack = 0;
        if (mode === 'login') {
          if (key === 'Enter') {
            const name = line.trim().replace(/\s+/g, ' ');
            if (!name) { print(LOGIN); return; }
            account.name = name; print(LOGIN + name); line = ''; mode = 'boot'; beep(520, .05);
            loginDone?.(); loginDone = null; return;
          }
          if (key === 'Backspace') line = line.slice(0, -1);
          else if (key === 'DeleteWord') line = line.replace(/\s*\S*\s*$/, '');
          else if (key === 'Escape') line = '';
          else if (key.length === 1 && /[\p{L}\p{N} .'-]/u.test(key) && line.length < 24) line += key;
          render(); return;
        }
        if (mode === 'game') { gameKey?.(key); return; }
        if (mode === 'proc') { stopProc?.(); return; }
        if (key === 'Enter') {
          const l = line; print(prompt() + l); line = '';
          if (l.trim()) { hist.push(l); if (hist.length > 100) hist.shift(); }
          histIdx = -1; playtest('> ' + l); runCommand(l); beep(520, .05);
        }
        else if (key === 'Backspace') line = line.slice(0, -1);
        else if (key === 'DeleteWord') line = line.replace(/\s*\S*\s*$/, '');
        else if (key === 'Tab') complete();
        else if (key === 'Escape') line = '';
        else if (key === 'ArrowUp') { if (hist.length) { if (histIdx === -1) { histDraft = line; histIdx = hist.length; } histIdx = Math.max(0, histIdx - 1); line = hist[histIdx]; } }
        else if (key === 'ArrowDown') { if (histIdx !== -1) { histIdx++; if (histIdx >= hist.length) { histIdx = -1; line = histDraft; } else line = hist[histIdx]; } }
        else if (key.length === 1 && line.length < 600) line += key;   // room for sentences; the tube wraps long lines
        if (mode === 'shell') render();
      },
      // a one-line remark from the room, only when the shell is idle
      setStatus(s) { status = s; render(); },
      refresh: () => render(),
      // a remark from the room: printed above the prompt like an alert, leaving whatever is being typed alone
      say(text) { if (mode !== 'shell') return false; announce([{ text, cls: 'dim' }]); return true; },
      idleFor: () => performance.now() - lastTyped,
      lineEmpty: () => mode === 'shell' && !line,
      talkable: () => mode !== 'boot' && mode !== 'login' && mode !== 'off',
      // a line left on the screen while it is off, there when it comes back on
      leave(l) { lines.push(l); if (lines.length > MAX) lines.shift(); },
      ghost(ch) { if (mode !== 'shell') return false; line += ch; render(); return true; },
      unghost() { line = line.slice(0, -1); render(); },
      hold(on) { locked = on; },
      takeLine() { const l = line; line = ''; render(); return l; },
      giveLine(l) { line = l; render(); },
      inShell: () => mode === 'shell',
      clear() { lines = []; line = ''; scrollBack = 0; render(); },   // a reboot: nothing on the tube, nothing half-typed
      mount, setMode, boot, announce, typeLine,
    };
  })();

  updateVitals();
  term.refresh();
  await wait(500);
  await term.boot([], firstAlert);
  clockedIn();
})();
