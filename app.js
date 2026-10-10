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
  // down to the floor under the desk (2030), and a little past it; and above the frame's top, the ceiling, for looking up
  // (it already runs up there: ceilup.js continues it where the 16:9 frame's corners need more)
  const SCENE_TOP = -620;
  scene.setAttribute('viewBox', `-240 ${SCENE_TOP} 1920 ${2200 - SCENE_TOP}`); scene.setAttribute('width', '1920'); scene.setAttribute('height', String(2200 - SCENE_TOP));
  scene.style.top = SCENE_TOP + 'px'; scene.style.height = (2200 - SCENE_TOP) + 'px';   // (style.css gives it 2200)

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
  // ---- the ceiling above the frame (Arnold, 2026-10-05; ceilup.js): looking up shows the drawing's own ceiling, which
  // already runs up past the frame's top; past its outline's top arch (only at the 16:9 frame's top corners) its depth
  // lines go on through the camera fitted to its grid, each from its drawn end on its drawn tangent, and its fill. The
  // outline's top arch becomes one of its lines (its darker stroke off: it was never seen before).
  {
    const ceil = $('ceiling'), CU = window.ceilingUp, paths = [...ceil.querySelectorAll('path')], num = p => +(p.id.split('_')[1] || 1);
    const radials = paths.filter(p => num(p) >= 2 && num(p) <= 52).map(p => ({ j: num(p) - 27, d: p.getAttribute('d') }));
    const arch = paths.find(p => p.id === 'Vector_53'), len = arch.getTotalLength(), n = Math.ceil(len / .5);
    const top = Array.from({ length: n + 1 }, (_, i) => { const q = arch.getPointAtLength(len * i / n); return [q.x - 240, q.y]; });   // (#ceiling sits at translate(-240 0))
    const above = CU.above({ radials, top, view: [-260, SCENE_TOP, 1700, 0] });
    paths.find(p => p.id === 'Vector').setAttribute('stroke', 'none');
    const under = document.createElementNS(SVG, 'g'), over = document.createElementNS(SVG, 'g');
    under.innerHTML = above.under; over.innerHTML = above.over;
    ceil.before(under); ceil.after(over);
  }

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
    if (room.melting || room.still) return;
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

  // ---- someone in the chair (the simulation report, 2026-10-06, item 7: the page couldn't tell an empty chair, and the
  // beats played to an empty room): a key, a click, the wheel or the mouse moving over the room (Arnold, 2026-10-07) in the
  // last 30 s. Taken first of all the page's listeners, before the menu's takes its keys. A move counts only if the pointer
  // really went somewhere: the browser sends moves of its own when the page shifts under a still cursor.
  let lastHand = performance.now(), lastPointer = null;
  for (const ev of ['keydown', 'pointerdown', 'wheel']) addEventListener(ev, () => { lastHand = performance.now(); }, { capture: true, passive: true });
  addEventListener('pointermove', e => {
    if (lastPointer && (e.screenX !== lastPointer[0] || e.screenY !== lastPointer[1])) lastHand = performance.now();
    lastPointer = [e.screenX, e.screenY];
  }, { capture: true, passive: true });
  const present = () => performance.now() - lastHand < 30000;

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
  knobPower.mark.dataset.knob = 'power'; knobBright.mark.dataset.knob = 'bright';   // (for the night-1 polaroid's picture)

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
  // powerTurn: each turn of the knob takes a ticket, and a warm-up that a later turn has overtaken stops where it is
  // (Eugene's playtest: three quick clicks left the screen showing with the monitor off)
  let darkTimer = 0, keptOnTimer = 0, powerTurn = 0;
  async function setPower(on) {
    if (room.power === on) return;
    room.power = on;
    const turn = ++powerTurn, current = () => turn === powerTurn;
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
      if (!current()) return;
      terminal.classList.remove('off');
      terminal.classList.add('warm');
      setTimeout(() => terminal.classList.remove('warm'), 1700);
      await wait(600);
      if (!current()) return;
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

  // ---- the sticky note on the bezel (Eugene's playtest, 2026-10-02: a new player didn't know what to type at the login;
  // redone in round 2, Arnold, 2026-10-03: note.js has its shape). A standard Post-it, 76 mm, muted Post-it yellow, under the
  // tube between the vents and the slot, "login: / your name" in Caveat. Once you are logged in a click takes it off: it
  // peels forward held at its top, lets go and falls at its own scale, turning over to its plain back, behind the keyboard.
  // Kept off (vigil.noteOff) until a new operator logs in.
  const noteG = document.createElementNS(SVG, 'g');
  noteG.id = 'login-note';
  $('chin-details').after(noteG);
  const placeNote = (peel = 0, drop = 0) => { noteG.innerHTML = loginNote.svg(peel, drop); };
  placeNote();
  // ---- the stills' places for night 1's award slip (award.js; slip-stills.html ?slipdraft=chin|top). Arnold chose the
  // chin (2026-10-06): the page puts it there itself ("the award slip", after the deliveries)
  const slipDraft = new URLSearchParams(location.search).get('slipdraft');
  if (slipDraft && window.award?.PLACES[slipDraft]) {
    const g = document.createElementNS(SVG, 'g');
    g.innerHTML = award.svg(slipDraft, { to: new URLSearchParams(location.search).get('name') || 'Anna Arden', date: new Date(Date.now() + 864e5).toDateString() });
    award.PLACES[slipDraft].under ? $('bezel').before(g) : noteG.before(g);
  }
  let noteOff = false;
  try { noteOff = localStorage.getItem('vigil.noteOff') === '1'; } catch (e) {}
  if (noteOff) noteG.style.display = 'none';
  noteG.style.cursor = 'pointer';
  noteG.addEventListener('pointerdown', async e => {
    e.preventDefault();
    if (noteOff || account.loggingIn) return;           // it stays while you need it
    noteOff = true; try { localStorage.setItem('vigil.noteOff', '1'); } catch (e) {}
    playtest('login note taken off');
    noteG.style.cursor = '';
    const t0 = performance.now();
    await new Promise(done => (function frame() {
      const ms = performance.now() - t0, m = loginNote.motionAt(ms);
      placeNote(m.peel, m.drop);
      // gone once it is wholly behind the keyboard (audit-note.html: never over the desk on the way)
      if (ms > 1200 || Math.min(...loginNote.shapes(m.peel, m.drop).outline.map(p => p[1])) > loginNote.END) { noteG.style.display = 'none'; done(); return; }
      requestAnimationFrame(frame);
    })());
  });
  // a new operator finds it back on the bezel
  function noteBack() { noteOff = false; try { localStorage.removeItem('vigil.noteOff'); } catch (e) {} placeNote(); noteG.style.display = ''; noteG.style.cursor = 'pointer'; }

  // ---- the cartridge slot on the chin
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
  // The slot redrawn (Arnold, 2026-10-03, round 2; chin.js): it read as a button. The drawing's plate grows into a recessed
  // surround twice as wide as tall, a raised lip runs round the opening, and the opening (the cartridge's end, unchanged:
  // the cartridge is drawn through it) is a dark mouth with a lighter lower lip inside its bottom edge.
  {
    const P = chin.slot(), C = chin.COLOURS, pts = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
    const INK = { stroke: '#B4B4B4', 'stroke-width': '1', 'stroke-linejoin': 'round' };
    const set = (el, attrs) => { for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
    set(chinPaths[1], { d: 'M' + pts(P.surround).split(' ').join('L') + 'Z', fill: C.surround, ...INK });
    const lip = set(document.createElementNS(SVG, 'polygon'), { points: pts(P.lip), fill: C.lip, ...INK });
    chinPaths[1].after(lip);
    set(chinPaths[2], { d: 'M' + pts(P.mouth).split(' ').join('L') + 'Z', fill: C.mouth, ...INK });
    const lipLine = set(document.createElementNS(SVG, 'path'), { d: 'M' + pts(P.lipLine).split(' ').join('L'), fill: 'none', stroke: C.lipLine, 'stroke-width': '1.2', 'stroke-linecap': 'round' });
    lipLine.style.pointerEvents = 'none';
    chinPaths[2].after(lipLine);
    for (const el of [chinPaths[1], lip, chinPaths[2], cart]) {
      el.classList.add('slot');
      el.addEventListener('pointerdown', e => { e.preventDefault(); room.cart ? ejectCart() : reachForCart(); hint.classList.add('gone'); });
    }
  }
  // The power LED beside the power knob (Arnold, 2026-10-03): on a CRT the light sits by the power button, so the knob turning
  // and the light changing are one glance. The drawing's own LED, moved: level with the knob's centre, as far from it as the
  // power knob is from the brightness knob. (It is drawn in the bezel's coordinates, a hair from the stage's.)
  powerLed.setAttribute('transform', `translate(${((chin.LED.to[0] - chin.LED.from[0]) * 981.85 / 980.06).toFixed(3)} ${((chin.LED.to[1] - chin.LED.from[1]) * 658.61 / 658.56).toFixed(3)})`);
  // The clock readout (Arnold, 2026-10-03; chin.js): the plate above the knobs shows the shift's time, minute by minute,
  // in seven segments, muted grey-green. It is the monitor's, not the tube's: lit with the screen off (05:30 to 05:43 it
  // counts on with nobody coming). At the night's end it holds its last minute until the tube boots again, then reads
  // 23:00. 04:44 is just 04:44. It stops with the night's clock when the game is paused.
  const clockG = document.createElementNS(SVG, 'g');
  clockG.id = 'clock-readout'; clockG.style.pointerEvents = 'none';
  chinPaths[0].after(clockG);
  let clockShown = null, clockHeld = false;
  function drawClock(force, at = null) {
    if (clockHeld && !force) return;
    let t = '23:00'; try { t = shift.clock().slice(0, 5); } catch (e) {}
    if (at) t = at;
    if (t === clockShown) return;
    clockShown = t;
    clockG.innerHTML = clockSvg(t);
  }
  function clockSvg(t) {
    const C = chin.clock(t), K = chin.COLOURS, pts = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
    return `<polygon points="${pts(C.window)}" fill="${K.window}" stroke="#B4B4B4" stroke-width="1" stroke-linejoin="round"/>` +
      C.segs.map(sg => `<polygon points="${pts(sg)}" fill="${K.digit}"/>`).join('');
  }
  drawClock();
  setInterval(drawClock, 250);
  // The knobs' engravings (Arnold, 2026-10-04, from the stills; chin.js knobMarks): a power symbol in a row with the LED and
  // the power knob; round the brightness knob a scale from 7:30 to 4:30 over the top, a moon at off and a sun at full as
  // its two ends, each tick where the pointer points at its value. Cut into the chin as the pointers are drawn, under
  // the knobs, and never in the way of a click.
  {
    const M = chin.knobMarks(), pts = ps => ps.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
    const marksG = document.createElementNS(SVG, 'g');
    marksG.id = 'knob-marks'; marksG.style.pointerEvents = 'none';
    marksG.innerHTML = M.fills.map(f => `<polygon points="${pts(f)}" fill="${chin.MARKS.colour}"/>`).join('')
      + M.strokes.map(s => `<polyline points="${pts(s)}" fill="none" stroke="${chin.MARKS.colour}" stroke-width="${chin.MARKS.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    chinPaths[13].before(marksG);
  }
  // The hand brings it square to the slot with its back end level with the chin (k = from), pushes it in, and
  // it seats a touch proud of the chin (k = .012) with a small settle.
  function insertCart(from, label) {
    playtest('cartridge in: ' + label);
    if (room.cart) return;
    room.cart = label;
    if (label === 'PONG') {
      glenn.once('pong', 'Pong! The last operator practically lived on that thing.');
      // (proud of the chase: once a match has put M.'s score beside yours, runPong's end)
    }
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
  // and up: the ceiling (Arnold, 2026-10-05), where the tube goes into it and the night 2 tile is; the view slides 500 px down
  // inside the frame (at 4:3 it is all the drawing's own ceiling)
  const UP = -500;
  const rests = () => [UP, 0, downRest(), FAR];
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
      look.lean = Math.max(0, Math.min(look.y, DOWN)) / DOWN * .9;   // near things move a little more than far ones (no more past the desk; none looking up)
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
    if (rest !== look.rest) playtest('look ' + (rest < 0 ? 'up at the ceiling' : rest === 0 ? 'at the screen' : rest >= 1000 ? 'down, all the way' : 'down'));
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
    Object.assign(zones.up.style, { display: look.rest > UP ? '' : 'none', top: '0px', height: (r.top + band) + 'px' });
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
      look.target = clamp(look.target + move, UP - 40, FAR + 40);
      lookRun();
    }, { passive: true });
  }

  // ---- the desk drawer (geometry and motion in drawer.js). The desk's front, its apron and the drawer sit in
  // the desk's layer, under the keyboard, moved with the parallax of something nearer than the keyboard.
  const deskG = document.createElementNS(SVG, 'g');
  deskG.id = 'desk-front';
  let lostNights = 0; try { lostNights = +localStorage.getItem('vigil.lost') || 0; } catch (e) {}
  // The lost-night pieces (design.md, sleep is the exit): one more thing for every night lost, in a fixed order,
  // kept forever, never announced. 1 `last` shows a login on a night not played yet; 2 a hidden file in ~ from M.;
  // 3 burn-in on the tube, readable with the brightness down; 4 and 5 open (the writing on Pong's sticker and in
  // DEFRAG's recess, parked below); 6 the ceiling-tile polaroid (not built); 7 `ping <your name>` answers; 8 open.
  const piece = n => lostNights >= n;
  let board = null;                                   // the night's board (board.js; "the board", below)
  // ---- a night played again (Arnold, 2026-10-05: losing a night late shouldn't mean sitting through it all again).
  // What you have seen, night by night (vigil.seen; cleared with the operator, at logout or a fresh start): a story
  // moment seen on this night before plays short, or not at all if it was only telling you something; a night started
  // before is a replay, and Glenn skips his welcome-back question. The night's job and the lost-night pieces are as ever.
  const seen = (() => {
    let all = {}; try { all = JSON.parse(localStorage.getItem('vigil.seen') || '{}'); } catch (e) {}
    const save = () => { try { localStorage.setItem('vigil.seen', JSON.stringify(all)); } catch (e) {} };
    const list = k => (all[k] = all[k] || []);
    return {
      // a night starting: true if it has been started before
      start(level) { const was = String(level) in all; list(String(level)); save(); return was; },
      // a beat on this night (or '*': on any night, for what is the same every night)
      has: (beat, level = shift.level) => list(String(level)).includes(beat),
      mark(beat, level = shift.level) { const l = list(String(level)); if (!l.includes(beat)) { l.push(beat); save(); } },
      // a new operator has seen nothing (this night is still started)
      clear() { all = { [String(shift.level)]: [] }; save(); },
    };
  })();
  // Parked, not cut (Arnold, 2026-10-02): the written clues, "it lets / you win." in pencil on Pong's sticker and
  // "don't trust / the red" scratched into DEFRAG's recess, kept for atmosphere later. Off, their slots left open.
  const WRITING_PARKED = true;
  // (the file drawer, the right pedestal's lowest, is drawn live in its own groups, first: its opening, its inside
  // clipped to it, its outside, its front)
  deskG.innerHTML = deskDrawer.desk({ pedestal: true, tally: lostNights, fileFront: false })
    + `<g></g><clipPath id="file-hole"><polygon/></clipPath><g clip-path="url(#file-hole)"></g><g></g><g class="slot"></g><g class="slot"></g>`
    + `<clipPath id="drawer-hole"><polygon/></clipPath><g clip-path="url(#drawer-hole)"></g><g></g><g></g><g class="slot"></g>`;
  const holeClip = deskG.querySelector('#drawer-hole polygon'), fileHoleClip = deskG.querySelector('#file-hole polygon');
  const [fileOpening, fileIn, fileOut, fileFront, fileHits, drawerIn, drawerOut, drawerHits, drawerFront] = deskG.querySelectorAll(':scope > g');
  fileFront.id = 'file-front'; fileHits.id = 'file-hits';
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
    notes: !WRITING_PARKED && piece(4) ? { PONG: 'it lets you win.' } : {},
    scratch: !WRITING_PARKED && piece(5) ? { slot: 1, lines: ["don't trust", 'the red'] } : null };
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

  // ---- where night 1's award slip is (below, "the award slip"): 'monitor', 'sheet' (in the cheat sheet's drawer), 'folder'
  // (yours, in the file drawer), or null (not come yet, or still in its canister); what it says (to, date) and whether it
  // has its tape on, kept wherever it is (vigil.award). held: up in front of you (lifted from where it is).
  const awd = { where: null, to: '', date: '', taped: false, held: false, busy: false };
  try { Object.assign(awd, JSON.parse(localStorage.getItem('vigil.award') || '{}'), { held: false, busy: false }); } catch (e) {}
  const keepAward = () => { try { localStorage.setItem('vigil.award', JSON.stringify({ where: awd.where, to: awd.to, date: awd.date, taped: awd.taped })); } catch (e) {} };
  // ---- the file drawer (design.md, the file drawer): locked from night 1; M.'s key, for beating 14 at Pong, opens it.
  // Inside, the old operators' folders, and the first polaroid loose on them until you have looked at it; then it is
  // filed in your folder, and your tab has your initials. Kept between nights and across a logout (the room remembers):
  // vigil.file = { unlocked, filed }.
  // key: where M.'s key is: 'none' (still under Pong), 'desk', or 'lock' (and the drawer unlocked)
  const file = { travel: 0, open: false, busy: false, unlocked: false, filed: false, clicks: 0, key: 'none', turn: 1 };
  // an old operator's things out of their folder (below, "the old operators' letters"): whose, which is in front
  const letter = { who: null, busy: false, page: 0, photo: {} };
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
  // two letters: the first two words' first letters, or a one-word name's first two; never anyone else's in the world (the
  // story audit, 2026-10-06: Mike was "m", under "all time: m", and a second ek could happen), then the first and third and on
  const TAKEN = new Set(['m', 'ts', 'jk', 'rd', 'aw', 'ek', 'cv', 'dn', 'hb', 'ny', 'ol', 'pf', 'gl']);
  const initialsOf = name => {
    const words = (name || '').toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    if (!words.length) return '';
    const flat = words.join(''), tries = [];
    if (words.length > 1) tries.push(words[0][0] + words[1][0]);
    for (let i = 1; i < flat.length; i++) tries.push(flat[0] + flat[i]);
    return tries.find(t => !TAKEN.has(t)) || flat[0] + '4';
  };
  function drawFile() {
    const r = deskDrawer.renderFile({ travel: file.travel, lock: { key: file.unlocked, turn: file.unlocked ? file.turn : 0 }, lifted: letter.who, yours: awd.where === 'folder' && !awd.held,
      photos: file.unlocked && !file.lifted ? [{ photo: NIGHT1_PHOTO, filed: file.filed }] : [], initials: initialsShown() ? initialsOf(account.name) : '' });
    fileHoleClip.setAttribute('points', r.hole);
    fileOpening.innerHTML = r.opening; fileIn.innerHTML = r.inner; fileOut.innerHTML = r.outer;
    fileFront.innerHTML = r.front + `<polygon points="${r.hits.front}" fill="transparent"/>`;
    // the old operators' folders first, the photo over them (it lies on them, or stands in your folder at the back)
    fileHits.innerHTML = (file.open ? (r.hits.folders || []).map(h => `<polygon data-folder="${h.who}" points="${h.points}" fill="transparent"/>`).join('') : '')
      + (r.hits.loose ? `<polygon data-hit="loose" points="${r.hits.loose}" fill="transparent"/>` : r.hits.filed ? `<polygon data-hit="filed" points="${r.hits.filed}" fill="transparent"/>` : '');
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
    // Glenn never wanted it found (design.md, Glenn and the opened drawer): damage control, played down. While you look
    // through it he says nothing about it, and never mentions M.'s folder.
    glenn.once('file-open', "That's just old paperwork, chief. HR's been meaning to clear it out.");
  }
  async function closeFile() {
    if (!file.open) return;
    file.open = false; file.busy = true;
    playtest('file drawer closed');
    drawerSound(false, DM.close.ms);
    await fileTween(DM.close.ms, u => { file.travel = DM.close.travel(u); });
    file.busy = false;
    // the first close: an order, and the closing is the compliance, logged under his line (it shows in night 3's grep)
    const said = glenn.once('file-close', 'Be a pal and put everything back the way you found it.');
    if (said) { glenn.order('file-back', 'be a pal and put everything back the way you found it'); said.then(() => glenn.complied('file-back')); }
  }
  fileFront.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (file.busy) return;
    hint.classList.add('gone');
    if (!file.unlocked) { rattleFile(); return; }
    if (held || letter.who) return;
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
    // Glenn, at the key (the plan: Glenn and Pong): about three seconds of nothing, then the question; the drawer's order if
    // he hasn't given it yet; the wife, if he hasn't said it (distracted, he lets it slip); and his warmth slips for the night
    room.cold = true;
    setTimeout(() => {
      glenn.once('file-key', "Where'd you get that, chief?");
      if (!glenn.taught('file-locked') && !glenn.taught('file-key-order')) { glenn.once('file-key-order', 'Whatever that opens, be a pal and leave it be.'); glenn.order('file', 'be a pal and leave it be'); }
      if (shift.level === 1) glenn.once('wife', "The wife's been on at me about these hours.");
    }, 3000);
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
    // (his "Where'd you get that, chief?" comes at the key's drop now: at the turn he says nothing)
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
  fileHits.addEventListener('pointerdown', e => {
    const folder = e.target.dataset?.folder;
    if (folder === 'you') { e.preventDefault(); liftAward('folder'); return; }
    if (folder) { e.preventDefault(); liftLetter(folder); return; }
    if (!e.target.dataset?.hit || letter.who) return;
    e.preventDefault(); liftPhoto();
  });

  // ---- the old operators' letters (Arnold, 2026-10-04; design.md, "The old operators' folders, decided"; letters.js draws
  // the papers, traces.js the two photos). Clicking a folder lifts what is in it, the way the slips come: the letter rises
  // straight up out of its folder (shown only above what is in front of it), then comes up to you as the polaroid does;
  // in ts's and aw's, their polaroid comes with it, tucked behind it in the drawer and opening out behind the held letter,
  // its top showing. Held, a click brings the next to the front (the one in front drops away below and comes up behind),
  // and after the last a click puts them back the way they came; so do q and Backspace. jk's and rd's are letters alone.
  for (const w of Object.keys(letters.PHOTO_OF)) traces.photo(w).then(p => { letter.photo[w] = p; });
  for (const f of ['Nothing You Could Do', 'Indie Flower']) document.fonts.load(`20px '${f}'`).catch(() => {});   // (ready before a letter is held)
  const letterCatcher = document.createElement('div');
  letterCatcher.id = 'letter-catcher';
  Object.assign(letterCatcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(letterCatcher);
  const LETTER_MS = { rise: 420, fly: 700, next: 560, back: 320 };
  const photoOf = who => letters.PHOTO_OF[who] ? letter.photo[who] : null;
  // the letter (and its photo) while it rises in its folder: clipped to above what is in front of it, in the room's camera
  function drawRising(who, rise) {
    const env = letters.envelope(who), pose = letters.inFolder(who, rise), ph = photoOf(who);
    keyLayer.innerHTML = `<clipPath id="letter-rise"><polygon points="${env.clip.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}"/></clipPath><g clip-path="url(#letter-rise)">`
      + (ph ? deskDrawer.renderCard(letters.photoWith(who, pose, 0, look.rest), deskDrawer.roomF, ph).svg : '') + letters.paper(who, pose, deskDrawer.roomF).svg + '</g>';
  }
  // between the drawer and your hands: s 0 (just clear of the folders) to 1 (held)
  const letterFlight = (who, s) => { const from = letters.inFolder(who, letters.clearRise(who)), to = letters.heldPose(look.rest); return between(from, to, s, v3.add(from.c, [0, -60, -20]), v3.add(to.c, [0, 30, 40])); };
  function drawFlying(who, s) {
    const pose = letterFlight(who, s), pr = roomOrFlat(s), ph = photoOf(who);
    keyLayer.innerHTML = (ph ? deskDrawer.renderCard(letters.photoWith(who, pose, s, look.rest), pr, ph, 1 + .5 * s).svg : '') + letters.paper(who, pose, pr, 1 + .5 * s).svg;
  }
  // held: t from 0 (the letter in front, the photo behind it) to 1 (the photo in front); on the way the letter drops
  // away below and comes back up behind it
  function drawHeldLetter(who, t) {
    const ph = photoOf(who), H = letters.heldPose(look.rest), pr = deskDrawer.proj;
    if (!ph) { keyLayer.innerHTML = letters.paper(who, H, pr, 1.5).svg; return; }
    const behind = letters.behindPose(look.rest, who), front = letters.photoFront(look.rest);
    const low = { ...H, c: v3.add(H.c, [0, 340 * H.c[2] / 1500, 0]) };
    const letterPose = t <= 0 || t >= 1 ? H : t < .5 ? between(H, low, t * 2) : between(low, H, t * 2 - 1);
    const photoPose = t <= 0 ? behind : t >= 1 ? front : between(behind, front, t);
    const L = letters.paper(who, letterPose, pr, 1.5).svg, P = deskDrawer.renderCard(photoPose, pr, ph, 1.5).svg;
    keyLayer.innerHTML = t < .5 ? P + L : L + P;
  }
  async function liftLetter(who) {
    if (!file.open || file.busy || held || letter.who || letter.busy) return;
    if (letters.PHOTO_OF[who] && !letter.photo[who]) letter.photo[who] = await traces.photo(who);
    letter.who = who; letter.busy = true; letter.page = 0;
    playtest('file drawer: ' + who + "'s folder, lifted out");
    mdSound('paper-slide');
    drawFile();
    keyDepth = DESK_FRONT_DEPTH;
    const R = letters.clearRise(who);
    await motion(LETTER_MS.rise, u => drawRising(who, R * (1 - Math.pow(1 - u, 2))));
    await motion(LETTER_MS.fly, u => { const s = easeIO(u); keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s; drawFlying(who, s); });
    keyDepth = .25;
    drawHeldLetter(who, 0);
    letterCatcher.style.display = '';
    letter.busy = false;
  }
  async function nextLetterPage() {
    letter.busy = true;
    playtest('file drawer: ' + letter.who + "'s polaroid to the front");
    mdSound('paper-flick');
    await motion(LETTER_MS.next, u => drawHeldLetter(letter.who, easeIO(u)));
    letter.page = 1; drawHeldLetter(letter.who, 1);
    letter.busy = false;
  }
  async function putLetterBack() {
    if (!letter.who || letter.busy) return;
    const who = letter.who;
    letter.busy = true; letterCatcher.style.display = 'none';
    playtest('file drawer: ' + who + "'s things put back");
    // the photo goes back behind the letter first, then they go down together the way they came
    if (letter.page === 1) await motion(LETTER_MS.back, u => drawHeldLetter(who, 1 - easeIO(u)));
    mdSound('paper-slide');
    await motion(LETTER_MS.fly, u => { const s = easeIO(1 - u); keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s; drawFlying(who, s); });
    keyDepth = DESK_FRONT_DEPTH;
    const R = letters.clearRise(who);
    await motion(LETTER_MS.rise, u => drawRising(who, R * (1 - u * u)));
    keyLayer.innerHTML = '';
    letter.who = null; letter.page = 0; drawFile();
    letter.busy = false;
  }
  letterCatcher.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (letter.busy) return;
    if (photoOf(letter.who) && letter.page === 0) nextLetterPage(); else putLetterBack();
  });
  // (q and Backspace put them back: "anything held", after M.'s drawer)

  // ---- the cheat sheet (Eugene's playtest, 2026-10-02; sheet.js): the right pedestal's top drawer opens as the others
  // do, and in it lies a handwritten card: what the trouble means and its fix. Clicked, the card is lifted and held up
  // in front of you, as the polaroid is; clicked again (or anywhere else), it goes back where it lay (Esc is the menu's). Glenn mentions it once,
  // in his introduction.
  // Lifted out of a drawer, a thing is drawn under the drawer's near walls while it still overlaps them (lying in the
  // drawer, they hide part of it; drawn over everything from the first frame, the hidden part popped into view), and over
  // everything once it is clear of them; the parallax starts its move only from there, so the change of layer can't show
  // (audit-sheet.js, 2026-10-03)
  const polysOf = svg => [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].trim().split(/\s+/).map(q => q.split(',').map(Number)));
  const insidePoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const overlaps = (pts, walls) => pts.some(p => walls.some(w => insidePoly(p, w)));
  const ptsOf = (svg, every = 1) => [...svg.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].filter((_, i) => i % every === 0).map(m => [+m[1], +m[2]]);
  const CS = window.cheatSheet;
  const sheet = { travel: 0, open: false, busy: false, held: false };
  const [sheetUnder, sheetAwardG, sheetCardG, sheetOver, sheetHit] = ['under', 'award', 'card', 'over', 'hit'].map(n => { const g = document.createElementNS(SVG, 'g'); g.id = 'sheet-' + n; deskG.appendChild(g); return g; });
  function drawSheet() {
    const d = CS.drawer(sheet.travel);
    sheetUnder.innerHTML = d.under;
    // (only once it is wholly out of the pedestal: before that it is inside, in the dark of the opening)
    const lying = CS.cardOut(sheet.travel) && !sheet.held ? CS.card(CS.lyingPose(sheet.travel), deskDrawer.roomF) : null;
    sheetCardG.innerHTML = lying ? lying.svg : '';
    // the award slip, if it was put in here: behind the card, leaning on the drawer's back
    const slip = awd.where === 'sheet' && !awd.held && award.sheetOut(sheet.travel) ? award.paper(award.inSheet(sheet.travel), deskDrawer.roomF, awd) : null;
    sheetAwardG.innerHTML = slip ? slip.svg : '';
    sheetOver.innerHTML = d.over;
    sheetHit.innerHTML = `<polygon data-hit="front" points="${CS.drawerHit(sheet.travel)}" fill="transparent"/>` + (slip && sheet.open && sheet.travel >= CS.OPEN - 1e-6 ? `<polygon data-hit="award" points="${awardSheetHit(slip.hit)}" fill="transparent"/>` : '') + (lying && sheet.open ? `<polygon data-hit="card" points="${lying.hit}" fill="transparent"/>` : '');
  }
  // where the slip in the drawer can be clicked: only what is seen of it, the band over the card and inside the walls
  // (its whole outline would take clicks meant for the drawer's front, which hides the rest of it); worked out once
  let AWARD_HIT = null;
  function awardSheetHit(hit) {
    if (AWARD_HIT) return AWARD_HIT;
    const ring = ptsOf(hit), cover = [...polysOf(CS.drawer(CS.OPEN).over), ptsOf(CS.card(CS.lyingPose(CS.OPEN), deskDrawer.roomF).hit)];
    const xs = ring.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), bottom = Math.max(...ring.map(p => p[1]));
    const top = [], low = [];
    for (let x = x0 + 1; x <= x1 - 1; x += 2) {
      let y = null; for (let yy = bottom; yy > bottom - 200; yy -= .5) if (insidePoly([x, yy], ring)) { if (y === null || yy < y) y = yy; } else if (y !== null) break;
      if (y === null || cover.some(c => insidePoly([x, y + .5], c))) continue;
      let yb = y + .5; while (yb < bottom && insidePoly([x, yb], ring) && !cover.some(c => insidePoly([x, yb], c))) yb += .5;
      top.push([x, y]); low.unshift([x, yb]);
    }
    return (AWARD_HIT = [...top, ...low].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
  }
  const sheetTween = (ms, step) => new Promise(done => {
    const t0 = performance.now();
    (function frame(now) { const u = Math.min(1, (now - t0) / ms); step(u); drawSheet(); if (u < 1) requestAnimationFrame(frame); else done(); })(t0);
  });
  async function openSheet() {
    if (sheet.open || sheet.busy) return;
    sheet.open = true; sheet.busy = true;
    playtest('cheat sheet drawer open');
    drawerSound(true, DM.open.ms * DM.open.stopAt);
    await sheetTween(DM.open.ms, u => { sheet.travel = CS.OPEN * DM.open.travel(u); });
    sheet.busy = false;
  }
  async function closeSheet() {
    if (!sheet.open || sheet.busy || sheet.held) return;
    sheet.open = false; sheet.busy = true;
    playtest('cheat sheet drawer closed');
    drawerSound(false, DM.close.ms);
    await sheetTween(DM.close.ms, u => { sheet.travel = CS.OPEN * DM.close.travel(u); });
    sheet.busy = false;
  }
  const sheetCatcher = document.createElement('div');
  Object.assign(sheetCatcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(sheetCatcher);
  async function liftSheet() {
    if (sheet.busy || sheet.held || !sheet.open) return;
    sheet.busy = true; sheet.held = true;
    playtest('cheat sheet: lifted');
    const from = CS.lyingPose(sheet.travel), to = CS.heldPose(look.rest);
    drawSheet();
    keyDepth = DESK_FRONT_DEPTH;
    const walls = polysOf(CS.drawer(sheet.travel).over);
    let clearAt = null;
    await motion(700, u => {
      const s = easeIO(u), c = CS.card(between(from, to, s, v3.add(from.c, [0, -60, -20]), v3.add(to.c, [0, 30, 40])), roomOrFlat(s), 1 + .5 * s);
      if (clearAt === null && overlaps(ptsOf(c.hit), walls)) { sheetCardG.innerHTML = c.svg; keyLayer.innerHTML = ''; return; }
      if (clearAt === null) { clearAt = s; sheetCardG.innerHTML = ''; }
      keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * (s - clearAt) / (1 - clearAt || 1);
      keyLayer.innerHTML = c.svg;
    });
    sheetCatcher.style.display = '';
    sheet.busy = false;
  }
  async function putSheetBack() {
    if (!sheet.held || sheet.busy) return;
    sheet.busy = true; sheetCatcher.style.display = 'none';
    playtest('cheat sheet: put back');
    const from = CS.heldPose(look.rest), to = CS.lyingPose(sheet.travel);
    // going back in: over everything until it meets the drawer's near walls, then under them (the parallax arrives at the
    // desk's as it gets there: the same moment, measured first)
    const walls = polysOf(CS.drawer(sheet.travel).over), pose = s => between(from, to, s, v3.add(from.c, [0, 30, 40]), v3.add(to.c, [0, -60, -20]));
    let meetAt = 1; for (let k = 0; k <= 60; k++) { const s = k / 60; if (overlaps(ptsOf(CS.card(pose(s), roomOrFlat(1 - s)).hit), walls)) { meetAt = s; break; } }
    await motion(650, u => {
      const s = easeIO(u), c = CS.card(pose(s), roomOrFlat(1 - s), 1.5 - .5 * s);
      keyDepth = .25 + (DESK_FRONT_DEPTH - .25) * Math.min(1, s / (meetAt || 1));
      if (s >= meetAt) { keyLayer.innerHTML = ''; sheetCardG.innerHTML = c.svg; } else keyLayer.innerHTML = c.svg;
    });
    keyLayer.innerHTML = '';
    sheet.held = false; drawSheet();
    sheet.busy = false;
  }
  sheetHit.addEventListener('pointerdown', e => {
    const hit = e.target.dataset?.hit; if (!hit) return;
    e.preventDefault(); hint.classList.add('gone');
    if (hit === 'card') liftSheet(); else if (hit === 'award') liftAward('sheet'); else sheet.open ? closeSheet() : openSheet();
  });
  sheetCatcher.addEventListener('pointerdown', e => { e.preventDefault(); putSheetBack(); });
  drawSheet();
  // ---- the deliveries (design.md, "Deliveries", "The tube"; drawing in post.js and delivery.js). Coffee is earned by working
  // well and comes down from upstairs, by the pneumatic tube in front of the inner left rack (Arnold, 2026-10-05: the
  // delivery drawer took steps away from the night; the tube is back, visible): a rattle down the tube from above, the
  // canister drops into the receiver's window on the desk's back left corner with a thunk, and its flag swings up. One
  // click on the receiver (Arnold, 2026-10-05: the tube was meant to be fewer steps than the drawer) and it all comes to
  // you: the canister rises out of the window and up into your hands, the lid springing open as it arrives (that logs
  // compliance, and an issue slip puts a bag in the status line), then the slip comes out of its mouth and up to you,
  // unrolling, while the canister goes back down into the receiver. A click (after any other papers) and it all goes
  // back: the canister comes up to meet the slip, it rolls back in, the lid shuts, the canister goes down into the
  // receiver and back up the tube. An empty one comes up open and empty, a beat, then goes back up by itself. Nothing
  // stays on the desk, and a canister can't be put back unopened any more: it waits in the receiver until it is clicked.
  // One at a time: another waits in the tube until the receiver is empty. The motion is post.flow's timelines, which
  // tube-audit.html renders frame by frame. shift.js decides when and what (streaks, the cap, the nights); night 3's
  // canister for aw comes in the blackout.
  const PO = window.post, lensRoom = PO.lensFrom(scene), ST = PO.station(lensRoom), stSt = ST.S.st;
  const stationG = document.createElementNS(SVG, 'g');
  stationG.id = 'post-station';
  stationG.innerHTML = `<g>${ST.ring}${ST.back}</g><g></g><g>${ST.front}</g><g></g><g class="slot"><polygon points="${ST.hit}" fill="transparent"/></g>`;
  const [, canInG, , flagG, stationHit] = stationG.children;
  deskG.after(stationG);
  // the station's parallax: it stands from the desk (the desk's depth) up past the rack to the ceiling (the ceiling's), so
  // the mouse moves it more the higher up it is: a shear and a stretch, its ring moving exactly with the ceiling, its
  // foot with the desk (as one layer, its ring slipped 3.6 px against the ceiling). It sits in the desk's layer, so the
  // shift is relative to that.
  const ringY = ST.S.jn.TL[1], footY = ST.S.st.foot[1];
  const depthB = (1 - .25) / (ringY - footY), depthA = .25 - depthB * footY - .25;   // (relative to the desk layer's .25)
  Object.assign(stationG.style, { transformBox: 'view-box', transformOrigin: '0 0' });
  stationG.classList.add('layer');
  function stationParallax(cx, cy) { stationG.style.transform = `matrix(1, 0, ${(cx * 9 * depthB).toFixed(5)}, ${(1 + cy * 6 * depthB).toFixed(5)}, ${(cx * 9 * depthA).toFixed(3)}, ${(cy * 6 * depthA).toFixed(3)})`; }
  const canLayer = document.createElementNS(SVG, 'svg');
  canLayer.id = 'can-flight';
  canLayer.setAttribute('viewBox', '0 0 1440 2200'); canLayer.setAttribute('width', '1440'); canLayer.setAttribute('height', '2200');
  Object.assign(canLayer.style, { position: 'absolute', left: '0', top: '0', width: '1440px', height: '2200px', overflow: 'visible', pointerEvents: 'none' });
  lookEl.appendChild(canLayer);
  const RECEIVER_DEPTH = .3;                          // (the receiver's window, in the parallax's terms: between the desk and the rack)
  let canDepth = RECEIVER_DEPTH;
  function canParallax(cx, cy) { canLayer.style.transform = `translate(${(cx * canDepth * 9).toFixed(2)}px, ${(cy * canDepth * 6).toFixed(2)}px)`; }
  // Glenn's notes (Arnold, 2026-10-02), in order and never repeated in a run (kept in vigil.notes; a new operator starts
  // again); the one for aw in the blackout is the first, word for word, with "aw" for "chief"
  const GLENN_NOTES = [
    ['Three clean ones in a row, chief.', 'I see you down there.', 'Keep it up!'],
    ["That's my operator!", 'Upstairs noticed, chief.'],
    ['Clean work tonight, chief.', "Don't let it go to your head."],
    ['Saw that, chief.', "Keep 'em coming."],
  ];
  const AW_NOTE = ['Three clean ones in a row, aw.', 'I see you down there.', 'Keep it up!'];
  // Night 2's notes (Arnold, 2026-10-03, round 3): Glenn possessive, picked in order, never repeated in a run (vigil.notes2);
  // night 3 has none (the link is down; aw's is the old one)
  const GLENN_NOTES_2 = [
    ['I like knowing where you are, chief.'],
    ['Stay where I can see you, chief.'],
    ["You'd tell me if you were thinking", 'of leaving, right, chief?'],
    ["Nobody's stayed as long as you, chief.", "Let's keep it that way."],
  ];
  function nextNote() {
    const two = shift.level >= 2, key = two ? 'vigil.notes2' : 'vigil.notes', list = two ? GLENN_NOTES_2 : GLENN_NOTES;
    let i = 0; try { i = +localStorage.getItem(key) || 0; localStorage.setItem(key, String(i + 1)); } catch (e) {}
    return list[i % list.length];                        // (a run that loses nights could use all four; then they come round again)
  }
  // What each canister carries besides (design.md, "The slips carry story"), by night and by which canister it is:
  // night 1, Glenn's 02:00 bag a reused slip (aw's, struck through) and the second streak's beans a carbon of M.'s old
  // request; night 2, the first streak's slip comes with a misrouted memo and the 02:00 bag's with a timesheet. The first
  // canister of night 1 is the normal, so the rest has something to differ from. (Night 2's empty second streak canister is cut: Arnold, 2026-10-06.)
  function storyOf(item) {
    if (item.aw) return null;
    const n = shift.level;
    if (n === 1) return item.why === 'bag' ? 'reused' : item.why === 'streak' && item.n === 2 && item.kind === 'beans' ? 'carbon' : null;
    if (n === 2) return item.why === 'bag' ? 'timesheet' : item.why === 'streak' && item.n === 1 ? 'memo' : null;
    return null;
  }
  // can: what stands in the receiver (an item, or { spent } while its slip is out); canH: its base above the receiver's
  // floor (mm: 0 landed); the flag: 0 down, 1 up
  const dlv = { can: null, canH: 0, item: null, stage: 'idle', busy: false, queue: [], flag: 0, page: 0 };
  function drawDlv() { canInG.innerHTML = dlv.can ? ST.can(dlv.canH, !!dlv.can.aw) : ''; flagG.innerHTML = ST.flag(dlv.flag + flagKick); }
  // the receiver's flag ticks once with each key typed upstairs by another voice (the proposal, section 1: the line to
  // upstairs alive; Glenn's keys never move it): a small kick on its spring, and back
  let flagKick = 0, kickTimer = 0;
  function flagTick() { flagKick = dlv.flag > .5 ? -.07 : .09; flagG.innerHTML = ST.flag(dlv.flag + flagKick); clearTimeout(kickTimer); kickTimer = setTimeout(() => { flagKick = 0; flagG.innerHTML = ST.flag(dlv.flag); }, 70); }
  // the flag swings up past upright and settles (a spring), or falls back (a canister's beans joining one already there)
  async function flagTo(up) {
    if (up === (dlv.flag > .5 ? 1 : 0) && Math.abs(dlv.flag - up) < .01) return;
    const f0 = dlv.flag;
    if (up) { dlvSound('flag'); await motion(380, u => { dlv.flag = f0 + (1 - f0) * (1 - Math.pow(1 - u, 3) * Math.cos(u * Math.PI * 2.5)); drawDlv(); }); }
    else await motion(220, u => { dlv.flag = f0 * (1 - u * u); drawDlv(); });
    dlv.flag = up; drawDlv();
  }
  // ---- its sounds, made here unless Arnold's recordings are in assets/sounds/fx (tube-rattle, tube-thunk, canister-open,
  // tube-up)
  async function dlvSound(name) {
    if (muted) return;
    if (await fxBuffer(name)) { playFx(name, .6, -.45); return; }
    const ctx = ac(), t = ctx.currentTime, pan = ctx.createStereoPanner(); pan.connect(ctx.destination);
    const noise = (at, ms, f, q, v, shape = 3) => { const len = Math.floor(ctx.sampleRate * ms / 1000), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape); const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = v; s.connect(bp).connect(g).connect(pan); s.start(at); };
    if (name === 'tube-rattle') {
      // the carrier coming down the tube from above: a hollow rush under it, its felt bands knocking the tube's joints,
      // nearer and to the left (where the receiver is) as it comes, 1.4 s
      pan.pan.setValueAtTime(-.1, t); pan.pan.linearRampToValueAtTime(-.45, t + 1.4);
      const len = Math.floor(ctx.sampleRate * 1.45), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const u = i / len; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (.4 + .6 * u); }
      const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(420, t); bp.frequency.linearRampToValueAtTime(260, t + 1.4); bp.Q.value = 1.4;
      const g = ctx.createGain(); g.gain.value = .05; s.connect(bp).connect(g).connect(pan); s.start(t);
      let at = .12; while (at < 1.35) { noise(t + at, 9, 1800 + Math.random() * 900, 3, .05 + .07 * at / 1.35); at += .06 + Math.random() * .12; }
    } else if (name === 'tube-thunk') {
      // it lands in the receiver: a dull knock (measured: about a key press, -33 dB RMS)
      pan.pan.value = -.45;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .14);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + .2);
      o.connect(g).connect(pan); o.start(t); o.stop(t + .22);
      noise(t, 40, 380, 1.2, .035, 4);
    } else if (name === 'canister-open') {
      // the lid springing open: a small tock and the hinge's tick
      pan.pan.value = 0;
      noise(t, 22, 1500, 2.5, .12, 4); noise(t + .05, 10, 3200, 3, .05, 3);
    } else if (name === 'flag') {
      // the arrival flag flicked up by its spring: a light tick and a short steel twang, from the receiver's side
      pan.pan.value = -.45;
      noise(t, 8, 4200, 3, .05, 3);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(1180, t + .16);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.012, t + .004); g.gain.exponentialRampToValueAtTime(.0004, t + .18);
      o.connect(g).connect(pan); o.start(t); o.stop(t + .2);
    } else if (name === 'tube-up') {
      // drawn back up: a rush of air rising and going away up the tube, 0.8 s
      pan.pan.setValueAtTime(-.45, t); pan.pan.linearRampToValueAtTime(-.15, t + .8);
      const len = Math.floor(ctx.sampleRate * .85), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const u = i / len; d[i] = (Math.random() * 2 - 1) * Math.min(1, u * 12) * Math.pow(1 - u, 1.6); }
      const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(240, t); bp.frequency.exponentialRampToValueAtTime(700, t + .8); bp.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.value = .06; s.connect(bp).connect(g).connect(pan); s.start(t);
      noise(t, 30, 600, 1.4, .03, 4);                     // (the carrier leaving the receiver: a soft knock)
    }
  }
  // ---- playing post.flow: each frame drawn from its state (the canister in the receiver, behind its walls; the one out of
  // it, over everything, at its own parallax depth; the slip; the flag), its events when their time comes (a sound, unless
  // `on` says otherwise)
  let slipShown = false;
  function drawState(S, o) {
    const f = PO.frame(S, stSt, look.rest, o);
    canInG.innerHTML = f.inRec; canLayer.innerHTML = f.can; flagG.innerHTML = f.flag; dlv.flag = S.flag || 0;
    canDepth = RECEIVER_DEPTH + (.25 - RECEIVER_DEPTH) * f.near;
    if (S.slip != null) { keyDepth = .25; keyLayer.innerHTML = f.slip; slipShown = true; }
    else if (slipShown) { keyLayer.innerHTML = ''; slipShown = false; }
  }
  async function play(seq, o, on = {}) {
    const ev = seq.events.slice().sort((a, b) => a[0] - b[0]);
    let next = 0;
    await motion(seq.ms, u => {
      const t = u * seq.ms;
      while (next < ev.length && ev[next][0] <= t) { const n = ev[next++][1]; on[n] ? on[n]() : dlvSound(n); }
      drawState(seq.at(t), o);
    });
  }
  // ---- the flow
  // Beans are never held up (Arnold, 2026-10-03; in the playtest an unopened canister kept Glenn's 02:00 bag in the tube for
  // three hours): beans due while a canister waits unopened (in the receiver, or on its way) go into it as a second slip,
  // and opening it gives both. They still come down the tube: its rattle and thunk, nothing else to see.
  function waitingCan() {
    if (dlv.incoming) return dlv.incoming;
    if (dlv.can && !dlv.can.spent) return dlv.can;
    return null;
  }
  function joinCan(can, item) {
    playtest(`delivery: ${item.why}, ${item.kind}, into the waiting canister`);
    if (can.kind === 'empty') { can.kind = item.kind; can.why = item.why; can.story = item.story; }   // (an empty one: it brings the bag, and its slip; none come now but 04:44's, which never joins)
    else (can.more = can.more || []).push(item);       // (with its own slip: the story stays with the canister it was given to)
    dlvSound('tube-rattle'); setTimeout(() => { dlvSound('tube-thunk'); if (dlv.can === can) flagTo(1); }, 1450);
  }
  async function dlvArrive(item) {
    if (item.story === undefined) item.story = storyOf(item);
    const can = item.kind === 'beans' && !item.aw ? waitingCan() : null;
    if (can && !can.aw && !can.storyCan) { joinCan(can, item); return; }   // (beans never join a story canister)
    if (dlv.can || dlv.item || dlv.busy) { dlv.queue.push(item); return; }
    dlv.busy = true; dlv.incoming = item;
    playtest(`delivery: ${item.why}, ${item.kind}`);
    // the rattle, the drop into the window, the thunk and the flag (post.flow.arrive)
    await play(PO.flow.arrive(), { aw: !!item.aw }, {
      'tube-thunk': () => {
        dlv.incoming = null; dlv.can = item; item.landedAt = performance.now(); dlvSound('tube-thunk');
        // the night's first delivery, Glenn says so, once (Arnold, 2026-10-03: in the playtest it passed unnoticed at the
        // terminal); after that, only the sound and the flag
        if (!room.dlvSaid && !item.aw && !item.storyCan && !room.linkDown && !seen.has('tube')) { room.dlvSaid = true; seen.mark('tube'); glenn.say('Something came down the tube for you, chief.'); }   // (not aw's, in the blackout: the link is down)
      },
    });
    dlv.canH = 0; drawDlv();
    await wait(200);
    dlv.busy = false;
  }
  // ---- a story canister (night 1's at 04:44; the proposal, section 1): it never queues and never joins. One waiting in the
  // receiver goes back up first (seen: it rises and is gone) and comes down again later, unopened, as the next delivery.
  // The beat has already waited for anything in your hands to be put back.
  async function dlvStory(item) {
    item.storyCan = true;
    await dlvClearForStory();
    return dlvArrive(item);
  }
  // (the receiver cleared ahead of a story canister: 04:44 does it during its scroll, so its drop keeps its second)
  async function dlvClearForStory() {
    while (dlv.busy || dlv.item) await wait(200);
    if (dlv.can && !dlv.can.spent) {
      const back = dlv.can; dlv.busy = true; dlvKept();
      await play({ ms: 520, events: [[0, 'tube-up']], at: t => ({ canH: PO.flow.DROP * Math.min(1, t / 420) ** 2, flag: Math.max(0, 1 - t / 220) }) }, { aw: !!back.aw });
      dlv.can = null; dlv.canH = 0; dlv.flag = 0; drawDlv(); dlv.queue.unshift(back); dlv.busy = false;
    }
  }
  function dlvNext() { if (dlv.queue.length && !dlv.can && !dlv.item) setTimeout(() => { const n = dlv.queue.shift(); if (n) dlvArrive(n); }, 1500); }
  // A story canister left unopened a minute, with others waiting behind it in the tube, goes back up (in view: you're
  // looking at the screen), the ones waiting come down, and it comes down again after them (the story audit, 2026-10-06:
  // it blocked every delivery behind it, and 23:00 lost the ones waiting). Nothing waiting, it just waits.
  setInterval(() => {
    const c = dlv.can;
    if (!c || c.spent || !c.storyCan || dlv.busy || dlv.item || !dlv.queue.length || look.rest !== 0 || (document.hidden && !NOPAUSE)) return;
    if (performance.now() - (c.landedAt || 0) < 60000 || window.vigilTime?.paused) return;
    playtest('delivery: the story canister goes back up, the ones waiting come first');
    (async () => {
      dlv.busy = true; dlvKept();
      await play({ ms: 520, events: [[0, 'tube-up']], at: t => ({ canH: PO.flow.DROP * Math.min(1, t / 420) ** 2, flag: Math.max(0, 1 - t / 220) }) }, { aw: !!c.aw });
      dlv.can = null; dlv.canH = 0; dlv.flag = 0; drawDlv(); dlv.queue.push(c); dlv.busy = false;
      dlvNext();
    })();
  }, 1000);
  stationHit.addEventListener('pointerdown', e => { e.preventDefault(); dlvStationClick(); });
  function dlvStationClick() {
    if (dlv.busy || dlv.item || !dlv.can || dlv.can.spent || handsFull()) return;
    hint.classList.add('gone');
    dlvTake();
  }
  const dlvCatcher = document.createElement('div');
  Object.assign(dlvCatcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(dlvCatcher);
  // the lid springs open: opening it is accepting it, the log notes it, quietly (design.md: so gifts accepted show in night
  // 3's grep); an issue slip's bag goes into the status line now
  function dlvOpened(it) {
    dlvSound('canister-open');
    // a story canister (04:44's): nothing was asked, so it logs nothing and pays nothing (the proposal, section 1)
    if (it.storyCan) { playtest(`canister: opened (${it.kind}, nobody sent it)`); return; }
    logLine('vigild[1]: operator compliance: yes (delivery opened)');
    playtest(`canister: opened (${it.kind})`);
    if (it.kind === 'beans') giveBeans(1, it.why === 'bag' ? "glenn's bag" : 'delivery');
    for (const m of it.more || []) setTimeout(() => giveBeans(1, (m.why === 'bag' ? "glenn's bag" : 'delivery') + ', second slip'), 420);
  }
  // the one click: up into your hands, the lid springing open, the slip out and up to you (or, empty, a beat and back up)
  async function dlvTake() {
    const it = dlv.item = dlv.can, empty = it.kind === 'empty';
    dlvKept();
    dlv.can = null; dlv.busy = true; dlv.stage = 'taking'; dlvCatcher.style.display = '';
    if (it.kind === 'note') it.note = it.aw ? AW_NOTE : nextNote();
    playtest('canister: taken from the receiver' + (it.kind === 'note' ? ` (${it.note[0]})` : '') + (it.story ? `, with the ${it.story}` : '') + (it.more?.length ? `, and ${it.more.map(m => m.kind + (m.story ? ' (' + m.story + ')' : '')).join(', ')}` : ''));
    await play(PO.flow.take(stSt, empty), { aw: !!it.aw, print: empty ? '' : frontPrint(it) }, { open: () => dlvOpened(it) });
    canLayer.innerHTML = '';
    if (empty) { canInG.innerHTML = ''; dlvCatcher.style.display = 'none'; dlvDone(); return; }
    dlv.can = { spent: true, aw: it.aw }; dlv.canH = 0; drawDlv();
    dlv.page = 0;
    // the papers that came with it come out from behind it (the slip's flight ends exactly on delivery.slip()'s held one)
    const place = { cx: 720, cy: look.rest + 470, k: 1 };
    slipShown = false;
    if (papersOf(it).length > 1) await motion(380, u => { keyLayer.innerHTML = slipFor(it, place, 0, easeIO(u)); });
    keyLayer.innerHTML = slipFor(it, place, 0);
    dlv.stage = 'slip'; dlv.busy = false;
  }
  // the slips held up: what came first in front, a second one (beans that joined it) behind it and higher, its printed
  // head showing over the first (VIGIL SYSTEMS, ISSUE SLIP), as two papers held together (offset to the left as well, the
  // ends of its typed lines showed down its side as stray letters)
  // A slip's story papers come with it (design.md, "The slips carry story"): the memo folded in behind it, the timesheet
  // clipped to it (a little behind and higher, a clip over both top edges); a reused or carbon slip is the slip itself.
  // Held up, a click brings the next paper to the front (each must be read: behind, only its head shows), and after the
  // last, puts them away. page: which paper is in front (fractional while one goes to the back). out: how far the papers
  // behind have come out from behind the front one (0 hidden behind it, 1 in their places).
  function papersOf(it) {
    const to = account.name || account.user, papers = [];
    const add = (m, no, pair) => {
      papers.push({ kind: m.kind, opts: { note: m.note, to, aw: m.aw, no, struck: m.story === 'reused', carbon: m.story === 'carbon' }, pair });
      if (m.story === 'memo') papers.push({ kind: 'memo', opts: {} });
      if (m.story === 'timesheet') papers.push({ kind: 'timesheet', opts: {}, clipped: true, pair });
    };
    if (it.kind === 'award') return [{ kind: 'award', opts: { to: account.name || account.user, date: it.date } }];
    add(it, 412, 0); (it.more || []).forEach((m, j) => add(m, 413 + j, j + 1));
    return papers;
  }
  function slipFor(it, place, page = 0, out = 1) {
    const papers = papersOf(it), n = papers.length;
    // where the paper k places behind the front one is: higher and to the right, a clipped one closer (as a clip holds it)
    const slot = (order, k) => { let dx = 0, dy = 0; for (let i = 1; i <= k; i++) { const p = order[i]; dx += p.clipped ? 12 : 18; dy -= p.clipped ? 40 : 76; } return k ? { cx: place.cx + dx * place.k * out, cy: place.cy + dy * place.k * out, k: place.k, rot: -3 + 2 * out } : place; };
    const orderAt = pg => Array.from({ length: n }, (_, i) => papers[(pg + i) % n]);
    const p0 = Math.floor(page), f = page - p0, A = orderAt(p0), B = orderAt(p0 + 1);
    const lerp = (a, b, t) => ({ cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, k: a.k + (b.k - a.k) * t, rot: (a.rot ?? -3) + ((b.rot ?? -3) - (a.rot ?? -3)) * t });
    // going to the back, the front paper drops away below first, then rises behind the rest
    const placeOf = p => { const ka = A.indexOf(p), kb = B.indexOf(p), pa = slot(A, ka), pb = slot(B, kb); if (!f) return pa; if (ka === 0) { const low = { ...pa, cy: pa.cy + 340 * place.k }; return f < .5 ? lerp(pa, low, f * 2) : lerp(low, pb, f * 2 - 1); } return lerp(pa, pb, f); };
    const order = f < .5 ? A : B;
    let svg = '';
    for (let i = n - 1; i >= 0; i--) {
      if (i > 0 && out <= 0) continue;
      const p = order[i], pl = placeOf(p);
      svg += delivery.slip(p.kind, p.opts, pl);
      const behind = order[i + 1];
      if (!f && out >= 1 && behind && behind.pair === p.pair && behind.pair !== undefined && (behind.clipped || p.clipped)) svg += delivery.clip(pl, 40);
    }
    return svg;
  }
  async function dlvNextPaper() {
    dlv.busy = true;
    const it = dlv.item, cy = look.rest + 470, p0 = dlv.page || 0;
    playtest('slip: the next paper (' + papersOf(it)[(p0 + 1) % papersOf(it).length].kind + ')');
    await motion(560, u => { keyLayer.innerHTML = slipFor(it, { cx: 720, cy, k: 1 }, p0 + easeIO(u)); });
    dlv.page = p0 + 1; keyLayer.innerHTML = slipFor(it, { cx: 720, cy, k: 1 }, dlv.page);
    dlv.busy = false;
  }
  // the front paper's print (delivery.slip's, without its outline: post.js unrolls the paper under it)
  const frontPrint = it => { const p = papersOf(it)[0]; return PO.slipPrint(p.kind, p.opts); };
  // done with it: it all goes back. The papers behind go in behind the front one; then post.flow.putAway: the canister
  // comes up out of the receiver to meet the slip, which rolls back into its mouth; the lid shuts; it goes back down into
  // the receiver and up the tube
  async function dlvPutAway() {
    if (dlv.item?.kind === 'award') return awardFromCanister(dlv.item);   // (onto the monitor: "the award slip", below)
    dlv.busy = true; dlvCatcher.style.display = 'none';
    const it = dlv.item, page = dlv.page || 0, place = { cx: 720, cy: look.rest + 470, k: 1 };
    playtest('slip: put away');
    if (papersOf(it).length > 1) {
      // (round to the first paper in front again, then the rest go in behind it)
      if (page % papersOf(it).length) { await motion(420, u => { keyLayer.innerHTML = slipFor(it, place, page + easeIO(u) * (papersOf(it).length - page % papersOf(it).length)); }); }
      await motion(300, u => { keyLayer.innerHTML = slipFor(it, place, 0, 1 - easeIO(u)); });
    }
    dlv.can = null;
    await play(PO.flow.putAway(), { aw: !!it.aw, print: frontPrint(it) });
    canLayer.innerHTML = ''; keyLayer.innerHTML = ''; slipShown = false;
    dlv.canH = 0; drawDlv();
    dlvDone();
  }
  function dlvDone() { dlv.item = null; dlv.stage = 'idle'; dlv.page = 0; dlv.busy = false; dlvNext(); }
  dlvCatcher.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (dlv.busy || dlv.stage !== 'slip') return;
    (dlv.page || 0) < papersOf(dlv.item).length - 1 ? dlvNextPaper() : dlvPutAway();
  });
  // a new night: the receiver empty, nothing on its way
  // A canister left unopened in the receiver is still there at the next 23:00 (nobody comes for it; the next night starts
  // with it waiting, the flag up), and a reload finds it as it stood at that 23:00 (vigil.receiver); what was still on its
  // way down, unseen, never arrives.
  let dlvBooted = false;
  function dlvKept() { try { localStorage.removeItem('vigil.receiver'); } catch (e) {} }
  // A story canister still in the tube at the night's end (it went back up, and was to come again) isn't lost with what
  // was on its way: it comes down a little after the next login, in front of you (vigil.tubeStory).
  function dlvReset() {
    let keep = dlv.can && !dlv.can.spent && !dlv.busy ? dlv.can : null;
    let coming = [dlv.incoming, ...dlv.queue].find(i => i && i.storyCan) || null;
    if (!dlvBooted) { dlvBooted = true; try { keep = JSON.parse(localStorage.getItem('vigil.receiver') || 'null'); coming = JSON.parse(localStorage.getItem('vigil.tubeStory') || 'null'); } catch (e) {} }
    if (keep) coming = null;
    try { keep ? localStorage.setItem('vigil.receiver', JSON.stringify(keep)) : localStorage.removeItem('vigil.receiver'); } catch (e) {}
    try { coming ? localStorage.setItem('vigil.tubeStory', JSON.stringify(coming)) : localStorage.removeItem('vigil.tubeStory'); } catch (e) {}
    dlv.comingStory = coming;
    dlvEmpty();
    if (keep) { dlv.can = keep; dlv.canH = 0; dlv.flag = 1; drawDlv(); playtest(`delivery: ${keep.why}, ${keep.kind}, still in the receiver from last night`); }
  }
  function dlvEmpty() { if (dlv.stage === 'slip' || slipShown) keyLayer.innerHTML = ''; slipShown = false; room.dlvSaid = false; dlv.incoming = null; dlv.queue = []; dlv.can = null; dlv.canH = 0; dlv.item = null; dlv.stage = 'idle'; dlv.flag = 0; dlv.busy = false; dlv.page = 0; canLayer.innerHTML = ''; dlvCatcher.style.display = 'none'; drawDlv(); }
  // (after the login: clockedIn)
  function dlvAfterLogin() {
    const c = dlv.comingStory; if (!c) return;
    dlv.comingStory = null;
    setTimeout(async () => { await eyesOnScreen(); try { localStorage.removeItem('vigil.tubeStory'); } catch (e) {} delete c.landedAt; dlvArrive(c); }, 9000);
  }
  window.__dlv = { afterLogin: dlvAfterLogin, arrive: dlvArrive, story: dlvStory, clear: dlvClearForStory, reset: dlvReset, state: dlv, click: dlvStationClick, putAway: dlvPutAway, tick: flagTick,   // (click, putAway: for trying it from the console)
    // night 3: the canister in the blackout, with the supervisor link down, for aw (the blackout calls this once it is built)
    aw: () => dlvArrive({ why: 'aw', kind: 'note', aw: true }) };
  drawDlv();

  // ---- the award slip (Arnold, 2026-10-06; award.js draws it). It comes in 04:44's canister (night 1). Put away after
  // reading, it doesn't go back up the tube: it goes onto the monitor and you tape it there, flat over the vents at the
  // chin (the place chosen from the stills), the two strips laid on one after the other; the canister, done with, goes
  // back up the tube by itself as every empty one does. Clicked there, it comes away with its tape and is held up like
  // any paper; put away from there (a click, q or Backspace) it goes, with the view, into your folder in the file drawer,
  // or, while that is still locked, into the right pedestal's top drawer with the cheat sheet, behind the card. Clicked
  // in either, it comes up again; put away again it goes to your folder if the file drawer is open to you, or back. Left
  // in the cheat sheet's drawer once the file drawer is unlocked, it is in your folder at the next 23:00, filed by
  // whoever labels the folders, while you were away (as your initials are). It keeps its name and date wherever it is,
  // and stays where it was put across the nights (vigil.award). Every move has a cause: you, the tube, or that hand.
  const heldAt = () => ({ cx: 720, cy: look.y + 470, k: 1, rot: -3 });   // (held as the slips are, in front of you as the view moves)
  const awardG = document.createElementNS(SVG, 'g');
  awardG.id = 'award-slip';
  noteG.before(awardG);
  // on the monitor (grow: the tape going on, each strip 0..1)
  function drawAwardOn(grow) {
    const on = awd.where === 'monitor' && !awd.held;
    awardG.style.cursor = on && !grow ? 'pointer' : '';
    awardG.innerHTML = !on ? '' : award.flat(award.ON, { to: awd.to, date: awd.date, taped: awd.taped, grow })
      + (grow ? '' : `<polygon points="${award.outline('chin').map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}" fill="transparent"/>`);
  }
  drawAwardOn();
  awardG.addEventListener('pointerdown', e => { e.preventDefault(); liftAward('monitor'); });
  const awardCatcher = document.createElement('div');
  Object.assign(awardCatcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(awardCatcher);
  awardCatcher.addEventListener('pointerdown', e => { e.preventDefault(); putAwardAway(); });
  const drawAwardHeld = () => { keyDepth = .25; keyLayer.innerHTML = award.flat(heldAt(), awd); };
  // held in front of you while the view goes where it is going
  function followHeld() { let on = true; (function f() { if (!on) return; drawAwardHeld(); requestAnimationFrame(f); })(); return { stop() { on = false; } }; }
  // in your folder: how far it rises before all of it is above what is in front of it (2 px clear), and while it rises,
  // shown only above that (letters.js's envelope for your folder)
  let AWARD_RISE = null;
  function awardRise() {
    if (AWARD_RISE != null) return AWARD_RISE;
    const { env } = letters.envelope('you'), under = (x, y) => { const e = env.find(p => p[0] >= x); return e && y > e[1] - 2; };
    for (let r = 0; r < 400; r += 2) if (!ptsOf(award.paper(award.inFolder(r), deskDrawer.roomF, awd).hit).some(([x, y]) => under(x, y))) return (AWARD_RISE = r);
    return (AWARD_RISE = 400);
  }
  function drawAwardRising(rise) {
    keyLayer.innerHTML = `<clipPath id="award-rise"><polygon points="${letters.envelope('you').clip.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}"/></clipPath>`
      + `<g clip-path="url(#award-rise)">${award.paper(award.inFolder(rise), deskDrawer.roomF, awd).svg}</g>`;
  }
  // between your folder (just clear of it, s 0) and your hands (s 1)
  const folderFlight = s => { const from = award.inFolder(awardRise()), to = award.poseOf(heldAt()); return between(from, to, s, v3.add(from.c, [0, -60, -20]), v3.add(to.c, [0, 30, 40])); };
  // what the slip goes behind in the cheat sheet's drawer: the drawer's near walls and the card
  const sheetCover = () => [...polysOf(CS.drawer(sheet.travel).over), ...(CS.cardOut(sheet.travel) && !sheet.held ? [ptsOf(CS.card(CS.lyingPose(sheet.travel), deskDrawer.roomF).hit)] : [])];
  async function liftAward(from) {
    if (awd.busy || awd.held || holding() || handsFull()) return;
    if (from === 'sheet' ? !sheet.open || sheet.busy : from === 'folder' ? !file.open || file.busy : awd.where !== 'monitor') return;
    awd.busy = true; awd.held = true;
    playtest('award slip: lifted from ' + { monitor: 'the monitor', sheet: "the cheat sheet's drawer", folder: 'your folder' }[from]);
    if (from === 'monitor') {
      // the tape comes away with it
      mdSound('tape-peel'); drawAwardOn(); keyDepth = .25;
      const a = award.poseOf(award.ON);
      await motion(650, u => { keyLayer.innerHTML = award.paper(between(a, award.poseOf(heldAt()), easeIO(u)), deskDrawer.proj, awd).svg; });
    } else if (from === 'sheet') {
      // as the card is lifted: under the drawer's near walls and the card while it still overlaps them, then over everything
      mdSound('paper-slide');
      const a = award.inSheet(sheet.travel), walls = sheetCover();
      drawSheet(); keyDepth = DESK_FRONT_DEPTH;
      let clearAt = null;
      await motion(700, u => {
        const s = easeIO(u), b = award.poseOf(heldAt()), p = award.paper(between(a, b, s, v3.add(a.c, [0, -60, -20]), v3.add(b.c, [0, 30, 40])), roomOrFlat(s), awd);
        if (clearAt === null && overlaps(ptsOf(p.hit), walls)) { sheetAwardG.innerHTML = p.svg; keyLayer.innerHTML = ''; return; }
        if (clearAt === null) { clearAt = s; sheetAwardG.innerHTML = ''; }
        keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * (s - clearAt) / (1 - clearAt || 1);
        keyLayer.innerHTML = p.svg;
      });
    } else {
      // as the old operators' letters are: straight up out of the folder, then up to you
      mdSound('paper-slide');
      drawFile(); keyDepth = DESK_FRONT_DEPTH;
      const R = awardRise();
      await motion(LETTER_MS.rise, u => drawAwardRising(R * (1 - Math.pow(1 - u, 2))));
      await motion(LETTER_MS.fly, u => { const s = easeIO(u); keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s; keyLayer.innerHTML = award.paper(folderFlight(s), roomOrFlat(s), awd).svg; });
    }
    drawAwardHeld();
    awardCatcher.style.display = '';
    awd.busy = false;
  }
  async function putAwardAway() {
    if (!awd.held || awd.busy) return;
    awd.busy = true; awardCatcher.style.display = 'none';
    const toFolder = file.unlocked;
    playtest('award slip: put away, ' + (toFolder ? 'in your folder' : "in the cheat sheet's drawer"));
    // the view goes down to it (the slip held in front of you on the way) and you open the drawer
    const follow = followHeld();
    await Promise.all([toFolder ? lookAt(FAR) : lookTo(true), toFolder ? openFile() : openSheet()]);
    while (file.busy || sheet.busy) await wait(50);
    follow.stop();
    if (toFolder) {
      const R = awardRise();
      mdSound('paper-slide');
      await motion(LETTER_MS.fly, u => { const s = easeIO(1 - u); keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * s; keyLayer.innerHTML = award.paper(folderFlight(s), roomOrFlat(s), awd).svg; });
      keyDepth = DESK_FRONT_DEPTH;
      await motion(LETTER_MS.rise, u => drawAwardRising(R * (1 - u * u)));
      keyLayer.innerHTML = '';
      awd.where = 'folder';
    } else {
      // going in: over everything until it meets the drawer's near walls or the card, then behind them (the parallax
      // arrives at the desk's as it gets there)
      const a = award.poseOf(heldAt()), b = award.inSheet(sheet.travel), walls = sheetCover();
      const pose = s => between(a, b, s, v3.add(a.c, [0, 30, 40]), v3.add(b.c, [0, -60, -20]));
      let meetAt = 1; for (let k = 0; k <= 60; k++) { const s = k / 60; if (overlaps(ptsOf(award.paper(pose(s), roomOrFlat(1 - s), awd).hit), walls)) { meetAt = s; break; } }
      mdSound('paper-slide');
      await motion(650, u => {
        const s = easeIO(u), p = award.paper(pose(s), roomOrFlat(1 - s), awd);
        keyDepth = .25 + (DESK_FRONT_DEPTH - .25) * Math.min(1, s / (meetAt || 1));
        if (s >= meetAt) { keyLayer.innerHTML = ''; sheetAwardG.innerHTML = p.svg; } else keyLayer.innerHTML = p.svg;
      });
      keyLayer.innerHTML = '';
      awd.where = 'sheet';
    }
    awd.held = false; keepAward();
    drawFile(); drawSheet();
    awd.busy = false;
  }
  // from 04:44's canister, the first time it is put away: onto the monitor, taped, and the canister back up the tube
  async function awardFromCanister(it) {
    dlv.busy = true; dlvCatcher.style.display = 'none'; awd.busy = true;
    Object.assign(awd, { to: account.name || account.user, date: it.date, taped: false, held: false });
    playtest('award slip: put on the monitor');
    if (look.rest !== 0) { const follow = followHeld(); await lookTo(false); follow.stop(); }
    const a = award.poseOf(heldAt()), b = award.poseOf(award.ON), T = PO.flow.T;
    keyDepth = .25;
    // (the canister goes back up while you put the slip up: the receiver is empty for the next one)
    const back = (async () => {
      await wait(350);
      await play({ ms: T.rest + T.up, events: [[T.rest, 'tube-up']], at: t => t < T.rest ? { canH: 0, flag: 0 } : { canH: PO.flow.DROP * ((t - T.rest) / T.up) ** 2, flag: 0 } }, { aw: false });
      dlv.can = null; dlv.canH = 0; drawDlv();
    })();
    await motion(700, u => { keyLayer.innerHTML = award.paper(between(a, b, easeIO(u)), deskDrawer.proj, awd).svg; });
    awd.where = 'monitor'; drawAwardOn([0, 0]); keyLayer.innerHTML = '';
    // the tape: the left strip, then the right, each pressed down along its length
    mdSound('tape-press'); await motion(170, u => drawAwardOn([easeIO(u), 0]));
    mdSound('tape-press'); await motion(170, u => drawAwardOn([1, easeIO(u)]));
    awd.taped = true; keepAward(); drawAwardOn();
    await back;
    awd.busy = false;
    dlvDone();
  }

  // ---- M.'s drawer and the ceiling tile (design.md, "M.'s password"; Arnold, 2026-10-03, round 3; drawing in mdrawer.js
  // and ceiling.js). On night 2 one tile above the desk is out of place. Clicked, it lifts about an inch and there is a
  // glint in the gap; it settles back, and Glenn: "Be a pal and leave the ceiling to maintenance, chief." (an order: it
  // logs). Clicked again, it is pushed aside, and a small older key with a paper tag slides off the edge and drops to the
  // desk with a clink; taking it logs "operator compliance: no". The key opens the right pedestal's middle drawer (an old
  // keyhole the Pong key plainly doesn't fit), with the first key's motion; using it logs nothing (Glenn never knew of that
  // drawer: there was no order about it). Inside, M.'s things in a pencil tray and a sealed envelope from IT: held up and
  // opened, its slip has m's temporary password. Kept between nights and across a logout (the room remembers):
  // vigil.mdrawer = { key: 'ceiling' | 'desk' | 'lock', opened }.
  const MD = window.mDrawer, CT = window.ceilingTile;
  const CEILING_ORDER = 'Be a pal and leave the ceiling to maintenance, chief.';
  const mdr = { travel: 0, open: false, busy: false, key: 'ceiling', turn: 1, opened: false, held: false, envSlip: 0 };
  try { Object.assign(mdr, JSON.parse(localStorage.getItem('vigil.mdrawer') || '{}')); } catch (e) {}
  if (!['ceiling', 'desk', 'lock'].includes(mdr.key)) mdr.key = mdr.key === 'falling' ? 'desk' : 'ceiling';
  const keepMdr = () => { try { localStorage.setItem('vigil.mdrawer', JSON.stringify({ key: mdr.key, opened: mdr.opened })); } catch (e) {} };
  // its groups go under the cheat sheet's (the top drawer, pulled out, is in front of this one)
  const [mdUnder, mdThings, mdOver, mdKeyG, mdHit] = ['under', 'things', 'over', 'key', 'hit'].map(n => { const g = document.createElementNS(SVG, 'g'); g.id = 'mdrawer-' + n; sheetUnder.before(g); return g; });
  let mdThingsAt = null;                               // (the tray's contents drawn at this travel; they are heavy, so kept)
  function drawMdr() {
    const r = MD.drawer(mdr.travel, { key: mdr.key === 'lock' ? 'lock' : 'none', turn: mdr.turn, tray: { held: mdr.held, env: { opened: mdr.opened } } });
    mdUnder.innerHTML = r.under;
    const at = `${mdr.travel}|${mdr.held}|${mdr.opened}`;
    if (at !== mdThingsAt) { mdThings.innerHTML = r.things; mdThingsAt = at; }
    mdOver.innerHTML = r.over; mdKeyG.innerHTML = r.key;
    mdHit.innerHTML = `<polygon data-hit="front" points="${r.hit}" fill="transparent"/>` + (r.trayHit && mdr.open && !mdr.held ? `<polygon data-hit="tray" points="${r.trayHit}" fill="transparent"/>` : '');
  }
  const mdTween = (ms, step) => new Promise(done => { const t0 = performance.now(); (function frame(now) { const u = Math.min(1, (now - t0) / ms); step(u); drawMdr(); if (u < 1) requestAnimationFrame(frame); else done(); })(t0); });
  // the small sounds here, made in code as the drawer's others are: the tile lifting (a dry scrape of mineral board on its
  // grid) and settling (a soft knock); the key's slide off the tile, its clink on the desk; a quiet metallic slide in the
  // ceiling (the safety net); the envelope opened (a paper flick) and its slip drawn out (a soft slide)
  function mdSound(kind, opt = {}) {
    if (muted) return;
    const ctx = ac(), t = ctx.currentTime, pan = ctx.createStereoPanner(); pan.connect(ctx.destination);
    const noise = (at, ms, f, q, v, shape = 3, type = 'bandpass') => { const len = Math.floor(ctx.sampleRate * ms / 1000), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) { const u = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - u, shape) * Math.min(1, u * 40); } const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = v; s.connect(bp).connect(g).connect(pan); s.start(at); };
    const ring = (at, f, v, ms) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(.0005, at + ms / 1000); o.connect(g).connect(pan); o.start(at); o.stop(at + ms / 1000 + .01); };
    if (kind === 'tile-lift') { pan.pan.value = .15; noise(t, 260, 900, .9, .05, 1.2); noise(t + .02, 30, 2400, 2, .03); }
    if (kind === 'tile-settle') { pan.pan.value = .15; noise(t, 50, 500, 1.2, .07, 4); }
    // a heavy step on the floor above: a low thud through the slab and a dull scuff (opt.pan where it lands; the last, right
    // over you, heavier, with the ceiling's grid ticking). Made here until Arnold's recording (the proposal: footsteps,
    // three gaits) is in assets/sounds/fx
    if (kind === 'step') {
      pan.pan.value = opt.pan ?? 0;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + .18);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(opt.last ? .16 : .09, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .26);
      o.connect(g).connect(pan); o.start(t); o.stop(t + .28);
      noise(t, 90, 260, 1, opt.last ? .05 : .03, 3, 'lowpass');
      if (opt.last) { noise(t + .03, 18, 2600, 3, .02, 3); noise(t + .09, 12, 3100, 3, .012, 3); }
    }
    if (kind === 'key-slide') { pan.pan.value = .15; noise(t, 220, 3200, 2.5, .025, 1); }
    if (kind === 'clink') { pan.pan.value = -.2; noise(t, 20, 3800, 3, .12); ring(t, 3300, .014, 160); ring(t, 4700, .008, 90); noise(t + .09, 14, 4200, 3, .05); ring(t + .09, 3300, .005, 80); }
    if (kind === 'ceiling-slide') { pan.pan.value = .2; noise(t, 520, 2600, 3, .012, .8, 'bandpass'); noise(t + .48, 30, 1800, 2, .01); }
    if (kind === 'paper-flick') { pan.pan.value = 0; noise(t, 30, 2200, 1.4, .09, 4); }
    if (kind === 'paper-slide') { pan.pan.value = 0; noise(t, 420, 1400, .8, .03, .9); }
    // tape: pressed down along its length (a soft smoothing hiss and a tick), and peeled off (a short dry crackle)
    if (kind === 'tape-press') { pan.pan.value = 0; noise(t, 150, 2600, 1.2, .022, 1.5); noise(t + .13, 12, 3400, 2.5, .04, 4); }
    if (kind === 'tape-peel') { pan.pan.value = 0; let at = 0; while (at < .16) { noise(t + at, 8, 3000 + Math.random() * 2500, 3, .03 + Math.random() * .03, 3); at += .012 + Math.random() * .02; } }
  }

  // ---- the tile. Its shapes come from the drawing's ceiling curves, measured once, when there is a tile to draw.
  const tileG = document.createElementNS(SVG, 'g');
  tileG.id = 'ceiling-tile'; tileG.classList.add('slot');
  $('ceiling').after(tileG);
  let ceilingCell = null;
  // (Arnold, 2026-10-05: up there, out of the usual view, two rows above the frame straight over the monitor, so you have
  // to look up to find it; its lift and tilt are px in the old cell, this one is nearer and bigger by TILE_SCALE)
  const TILE_AT = [789, -247];
  let TILE_SCALE = 1;
  const cellOf = () => {
    if (ceilingCell) return ceilingCell;
    const samplers = [...$('ceiling').querySelectorAll('path')].map(p => { const len = p.getTotalLength(); return { len, at: l => { const q = p.getPointAtLength(Math.max(0, Math.min(len, l))); return [q.x - 240, q.y]; } }; });   // (#ceiling sits at translate(-240 0))
    ceilingCell = CT.build(samplers, TILE_AT); TILE_SCALE = ceilingCell.cellH / CT.build(samplers).cellH;
    return ceilingCell;
  };
  const tile = { state: null, lift: 0, tilt: 0, busy: false, key: null, slid: false };
  function drawTile() {
    if (!tile.state) { tileG.innerHTML = ''; return; }
    const c = cellOf(), glint = tile.state === 'glint' ? (tile.lift > 10 ? CT.GLINT.peek : CT.GLINT.out) : tile.state === 'peek' ? CT.GLINT.peek : null;
    tileG.innerHTML = c.svg(tile.lift * TILE_SCALE, tile.tilt * TILE_SCALE, { glint, inner: tile.key || '' }) + (tile.state !== 'aside' ? `<polygon points="${c.hit}" fill="transparent"/>` : '');
  }
  const tileTo = (ms, [l1, t1], ease = easeIO) => { const l0 = tile.lift, t0 = tile.tilt; return motion(ms, u => { const s = ease(u); tile.lift = l0 + (l1 - l0) * s; tile.tilt = t0 + (t1 - t0) * s; drawTile(); }); };
  // a new night: the tile in place at every 23:00 (the story audit, 2026-10-06: it was already out at night 2's 23:00, so
  // the footsteps couldn't be what moved it); on night 2, about 02:10, the last heavy step over you jolts it out, grit
  // falling from its gap (heavySteps, below). Pushed aside by your hand, it stays as you left it, every night after
  // (vigil.tile). (Night 3's tile is the finale's: behind it, nothing, built with the breaker.)
  const tileAside = () => { try { return localStorage.getItem('vigil.tile') === 'aside'; } catch (e) { return false; } };
  function tileNight() {
    const aside = tileAside();
    tile.state = aside ? 'aside' : null; tile.slid = false; tile.key = null;
    [tile.lift, tile.tilt] = aside ? CT.STATES.aside : [0, 0];
    drawTile();
  }
  // ---- grit (the proposal, Q36: a few flat grey specks): from the tile's gap, down past the top of the frame onto the
  // monitor, falling as dust does (a little drift, a little slower than a stone), and gone as they land
  const gritLayer = document.createElementNS(SVG, 'svg');
  gritLayer.id = 'grit';
  gritLayer.setAttribute('viewBox', `0 ${SCENE_TOP} 1440 ${2200 - SCENE_TOP}`); gritLayer.setAttribute('width', '1440'); gritLayer.setAttribute('height', String(2200 - SCENE_TOP));
  Object.assign(gritLayer.style, { position: 'absolute', left: '0', top: SCENE_TOP + 'px', overflow: 'visible', pointerEvents: 'none' });
  lookEl.appendChild(gritLayer);
  const GRIT_GREYS = ['#B4B4B4', '#A6A6A4', '#C2C2C0'];
  function grit(n = 9) {
    const g = cellOf().coons(CT.KEY_AT), land = 108;   // (the monitor's top edge, the bezel's, is at about 115 under the tile)
    const specks = Array.from({ length: n }, (_, i) => ({ x: g[0] - 30 + Math.random() * 60, y: g[1], vx: (Math.random() - .5) * 18, at: i * 70 + rnd(90), r: 1 + Math.random() * 1.4, fill: GRIT_GREYS[i % 3], land: land + rnd(8) }));
    const g0 = performance.now(), fallMs = 1500;
    return motion(fallMs + n * 70 + 200, () => {
      const t = performance.now() - g0;
      gritLayer.innerHTML = specks.map(p => {
        const u = Math.max(0, (t - p.at) / fallMs); if (u <= 0 || u >= 1) return '';
        const y = p.y + (p.land - p.y) * (u * u * .55 + u * .45), x = p.x + p.vx * u, k = p.r;
        return `<path d="M${(x - k).toFixed(2)},${y.toFixed(2)}L${x.toFixed(2)},${(y - k * .8).toFixed(2)}L${(x + k).toFixed(2)},${(y + k * .3).toFixed(2)}L${(x - k * .2).toFixed(2)},${(y + k).toFixed(2)}Z" fill="${p.fill}"/>`;
      }).join('');
    }).then(() => { gritLayer.innerHTML = ''; });
  }
  // ---- the heavy footsteps over you (night 2, about 02:10; the proposal 2.4, its first part): steps cross from the left,
  // the receiver's flag ticking with each, and stop right above you; the last one jolts the tile out of place, grit falls
  // from its gap past the top of the frame, and the view leans up by itself, once, and settles (the story audit, 2026-10-06,
  // fix 15: nothing taught looking up). Glenn: "Don't mind the footsteps, chief. Stretching my legs." (the proposal's line)
  async function heavySteps() {
    room.beat = true;
    await eyesOnScreen();
    playtest('night 2: the heavy steps over you; the tile jolts out');
    const N = 5;
    for (let i = 0; i < N; i++) { mdSound('step', { pan: -.6 + .6 * i / (N - 1), last: i === N - 1 }); flagTick(); await wait(i === N - 1 ? 0 : 620 + rnd(80)); }
    if (mdr.key === 'ceiling' && !tileAside()) {
      tile.state = 'out'; [tile.lift, tile.tilt] = [0, 0];
      await tileTo(90, CT.STATES.out.map(v => v * 1.5), s => 1 - Math.pow(1 - s, 2));
      tileTo(260, CT.STATES.out);
    }
    const falling = grit();
    if (look.rest === 0 && !holding()) { look.peek = -30; aim(); setTimeout(() => { look.peek = 0; aim(); }, 1500); }
    await falling;
    room.beat = false;
    await wait(1400);
    glenn.say("Don't mind the footsteps, chief. Stretching my legs.");
  }
  const handsFull = () => held || sheet.held || mdr.held || dlv.stage !== 'idle' || dlv.busy || file.busy || mdr.busy || awd.held || awd.busy;
  async function tileClick() {
    if (tile.busy || !tile.state || tile.state === 'aside' || handsFull()) return;
    tile.busy = true; hint.classList.add('gone');
    if (tile.state === 'out') {
      // the first click: lifted about an inch, a glint in the gap; it settles back, and Glenn
      playtest('ceiling tile: lifted (a glint)');
      tile.state = 'peek'; mdSound('tile-lift');
      await tileTo(380, CT.STATES.peek, s => 1 - Math.pow(1 - s, 3));
      await wait(750);
      tile.state = 'glint';
      await tileTo(420, CT.STATES.out, s => s * s);
      mdSound('tile-settle');
      tile.busy = false;
      if (glenn.once('ceiling', CEILING_ORDER)) glenn.order('ceiling', CEILING_ORDER);
      else if (glenn.taught('ceiling')) glenn.order('ceiling', CEILING_ORDER);   // (said on an earlier night: it still stands)
      return;
    }
    // the second click: lifted and pushed aside; the key slides off the edge and drops to the desk
    playtest('ceiling tile: pushed aside (the key)');
    tile.state = 'aside'; mdSound('tile-lift');
    try { localStorage.setItem('vigil.tile', 'aside'); } catch (e) {}   // (it stays as you left it)
    await tileTo(520, CT.STATES.aside, s => 1 - Math.pow(1 - s, 3));
    await keyFalls();
    tile.busy = false;
  }
  tileG.addEventListener('pointerdown', e => { e.preventDefault(); tileClick(); });

  // ---- the second key, from the ceiling to the desk, and from the desk to the lock. One true size (2.0, as the first).
  const deskKey2G = document.createElementNS(SVG, 'g');
  deskKey2G.classList.add('slot');
  deskKeyG.after(deskKey2G);
  function drawDeskKey2() {
    if (mdr.key !== 'desk') { deskKey2G.innerHTML = ''; return; }
    const p = MD.deskPose(), [x, y] = deskDrawer.roomF(p.c);
    deskKey2G.innerHTML = MD.oldKey(p, deskDrawer.roomF) + `<ellipse cx="${(x - 14).toFixed(1)}" cy="${y.toFixed(1)}" rx="46" ry="16" fill="transparent"/>`;
  }
  const KEY_FALL_AT = 330;                            // (where in the frame the view keeps the falling key, px from its top)
  async function keyFalls() {
    // where it starts: at the gap's lower edge, far up (it is about 35 px there), drawn by the near camera (no bend) so
    // it is exactly at the gap; it lands on the desk drawn by the room's (bent), as it lies there
    const g = cellOf().coons(CT.KEY_AT), Z0 = 2900, c0 = [(g[0] - 720) * Z0 / 1500, (g[1] - 813) * Z0 / 1500, Z0];
    const A0 = v3.norm([1, 0, .25]), B0 = v3.norm(v3.cross([0, -1, 0], A0));
    const start = { c: c0, A: A0, B: B0 }, edge = { c: v3.add(c0, [40, 25, -30]), A: v3.norm([1, .5, .25]), B: B0 }, end = MD.deskPose();
    keyDepth = 1.0;                                    // with the ceiling, then down to the desk's
    mdSound('key-slide');
    await motion(320, u => { const s = easeIO(u); keyLayer.innerHTML = MD.oldKey(between(start, edge, s), flatOrRoom(0)); });
    // it falls: slow off the edge, faster and faster, turning over once on the way. The view follows it down, aiming to keep
    // it a third of the way down the frame (sent straight to the desk, the view went ahead of the key, which left the top of
    // the frame for half its fall); the spring keeps the following smooth
    look.rest = downRest(); look.peek = 0; placeZones();
    await motion(760, u => {
      const s = u * u, pose = between(edge, end, s, v3.add(edge.c, [0, 250, -200]), v3.add(end.c, [0, -420, 60]));
      keyDepth = 1.0 + (DESK_FRONT_DEPTH - 1.0) * s;
      keyLayer.innerHTML = MD.oldKey(pose, flatOrRoom(s));
      // (aiming where it will be a quarter of the fall later: aimed where it was, the view lagged and it landed under the frame)
      const ua = Math.min(1, u + .25), sa = ua * ua, ahead = between(edge, end, sa, v3.add(edge.c, [0, 250, -200]), v3.add(end.c, [0, -420, 60]));
      look.target = clamp(flatOrRoom(sa)(ahead.c)[1] - KEY_FALL_AT, UP, look.rest); lookRun();
    });
    aim();
    keyLayer.innerHTML = '';
    mdr.key = 'desk'; keepMdr(); drawDeskKey2(); mdSound('clink');
    // taking it is not leaving the ceiling to maintenance
    glenn.refused('ceiling', CEILING_ORDER);
  }
  // To the lock, as the first key goes to its own: it rises off the desk and comes over in an arc, slows as it lines up
  // with the keyhole, slides in and comes to rest; a beat; the turn, stiff, giving back, then through with the click; and
  // the drawer comes out a little. It stays in the lock.
  async function key2ToLock() {
    if (mdr.key !== 'desk' || mdr.busy || handsFull()) return;
    mdr.busy = true; deskKey2G.innerHTML = '';
    playtest('the second key: to the lock');
    keyDepth = DESK_FRONT_DEPTH;
    lookAt(FAR);
    const at = d => MD.lockPose(d), drawAt = d => { keyLayer.innerHTML = MD.oldKey(at(d), deskDrawer.roomF, { maxA: MD.lockMaxA(d), tag: false }); };
    const from = MD.deskPose(), out = at(34);
    await motion(1700, u => { keyLayer.innerHTML = MD.oldKey(between(from, out, easeIO(u), v3.add(from.c, [0, -190, -50]), v3.add(out.c, [0, -80, -90])), deskDrawer.roomF, { tag: u < .5 }); });
    await motion(600, u => drawAt(34 - 24 * (1 - Math.pow(1 - u, 2))));
    keySound('in');
    await motion(700, u => drawAt(10 * Math.pow(1 - u, 3)));
    drawAt(0);
    await wait(450);
    keyLayer.innerHTML = '';
    mdr.key = 'lock'; mdr.turn = 0; keepMdr();
    const smooth01 = x => x * x * (3 - 2 * x);
    const TURN = [[0, 0], [.42, .13], [.52, .105], [.66, .17], [.86, .97], [1, 1]];
    let clicked = false;
    await mdTween(1100, u => {
      let k = 1; while (k < TURN.length - 1 && u > TURN[k][0]) k++;
      const [t0, a0] = TURN[k - 1], [t1, a1] = TURN[k];
      mdr.turn = a0 + (a1 - a0) * smooth01(Math.min(1, Math.max(0, (u - t0) / (t1 - t0))));
      if (!clicked && u >= .84) { clicked = true; keySound('turn'); }
    });
    mdr.turn = 1;
    await wait(160);
    drawerSound(true, 140);
    await mdTween(260, u => { mdr.travel = .015 * (3 * u * u - u * u * u) / 2; });
    mdr.busy = false;
  }
  deskKey2G.addEventListener('pointerdown', e => { e.preventDefault(); key2ToLock(); });

  // ---- the drawer: locked, it rattles in place as the file drawer does (the same sound) and Glenn says nothing about it
  async function rattleMdr() {
    mdr.busy = true;
    playtest("m's drawer: locked");
    playFx('drawer-locked', .6, .45);
    for (const dx of [2, -2, 1.5, -1, .5, 0]) { for (const g of [mdUnder, mdThings, mdOver, mdKeyG]) g.style.transform = dx ? `translate(${dx}px, 0)` : ''; await wait(30); }
    mdr.busy = false;
  }
  async function openMdr() {
    if (mdr.open || mdr.busy) return;
    mdr.open = true; mdr.busy = true;
    playtest("m's drawer open");
    drawerSound(true, DM.open.ms * DM.open.stopAt);
    const t0 = mdr.travel;
    await mdTween(DM.open.ms, u => { mdr.travel = t0 + (MD.OPEN - t0) * DM.open.travel(u); });
    mdr.busy = false;
  }
  async function closeMdr() {
    if (!mdr.open || mdr.busy || mdr.held) return;
    mdr.open = false; mdr.busy = true;
    playtest("m's drawer closed");
    drawerSound(false, DM.close.ms);
    await mdTween(DM.close.ms, u => { mdr.travel = MD.OPEN * DM.close.travel(u); });
    mdr.busy = false;
  }
  // ---- the tray (mtray.js): clicked in the open drawer, it is lifted out and held up in front of you, about three times
  // nearer, its back raised so you look into it (opened at 4:3 the drawer is mostly past the frame's right edge, and the
  // things are small there; Arnold, 2026-10-04); under the drawer's near walls until it is clear of them, as the cheat
  // sheet's card. Held: a click on the envelope lifts it out of the tray and holds it up over it; a click opens it and the
  // slip comes up out of it; a click puts it back in the tray, opened. A click anywhere else puts the tray back.
  const mdCatcher = document.createElement('div');
  Object.assign(mdCatcher.style, { position: 'fixed', inset: '0', zIndex: '50', display: 'none', cursor: 'pointer' });
  document.body.appendChild(mdCatcher);
  const TR = window.mTray;
  const envAt = (pose, pr, width = 1) => MD.envelope(pose, pr, { opened: mdr.opened, slipOut: mdr.envSlip, width });
  const trayHeld = () => TR.heldPose(), heldPr = s => TR.heldProject(look.rest, s);   // (held: one pose, the picture slid with the view)
  // the held view: the tray (full detail) and, over it, the envelope if it is out of it
  let heldTrayHit = null, heldEnvHit = null;
  function drawHeldTray(envPose = null) {
    const r = TR.render(trayHeld(), heldPr(1), { env: { lifted: !!envPose || mdr.envHeld, opened: mdr.opened }, width: 1.5 });
    heldTrayHit = r.hit; heldEnvHit = r.envHit;
    let svg = r.svg;
    if (envPose || mdr.envHeld) { const e = envAt(envPose || MD.heldEnvelope(0), heldPr(1), 1.5); svg += e.svg; heldEnvHit = e.hit; }
    keyLayer.innerHTML = svg;
  }
  async function liftTray() {
    if (mdr.busy || mdr.held || !mdr.open || handsFull()) return;
    mdr.busy = true; mdr.held = true;
    playtest("m's tray: lifted out");
    const from = TR.drawerPose(mdr.travel), to = trayHeld(), walls = polysOf(MD.drawer(mdr.travel).over);
    mdThingsAt = null; drawMdr();
    let clearAt = null;
    await motion(800, u => {
      const sm = easeIO(u), r = TR.render(between(from, to, sm, v3.add(from.c, [0, -70, -30]), v3.add(to.c, [0, 30, 40])), heldPr(sm), { env: { opened: mdr.opened }, width: 1 + .5 * sm, fast: true });
      if (clearAt === null && overlaps(ptsOf(r.hit), walls)) { mdThings.innerHTML = r.svg; mdThingsAt = null; keyLayer.innerHTML = ''; return; }
      if (clearAt === null) { clearAt = sm; mdThings.innerHTML = ''; }
      keyDepth = DESK_FRONT_DEPTH + (.25 - DESK_FRONT_DEPTH) * (sm - clearAt) / (1 - clearAt || 1);
      keyLayer.innerHTML = r.svg;
    });
    mdThingsAt = null; drawMdr();
    drawHeldTray();
    mdCatcher.style.display = '';
    mdr.busy = false;
  }
  async function putTrayBack() {
    mdr.busy = true; mdCatcher.style.display = 'none';
    playtest("m's tray: put back");
    const from = trayHeld(), to = TR.drawerPose(mdr.travel), walls = polysOf(MD.drawer(mdr.travel).over);
    const pose = sm => between(from, to, sm, v3.add(from.c, [0, 30, 40]), v3.add(to.c, [0, -70, -30]));
    let meetAt = 1; for (let k = 0; k <= 40; k++) { const sm = k / 40; if (overlaps(ptsOf(TR.render(pose(sm), heldPr(1 - sm), { fast: true, bare: true }).hit), walls)) { meetAt = sm; break; } }
    await motion(700, u => {
      const sm = easeIO(u), r = TR.render(pose(sm), heldPr(1 - sm), { env: { opened: mdr.opened }, width: 1.5 - .5 * sm, fast: true });
      keyDepth = .25 + (DESK_FRONT_DEPTH - .25) * Math.min(1, sm / (meetAt || 1));
      if (sm >= meetAt) { keyLayer.innerHTML = ''; mdThings.innerHTML = r.svg; mdThingsAt = null; } else keyLayer.innerHTML = r.svg;
    });
    keyLayer.innerHTML = '';
    mdr.held = false; mdThingsAt = null; drawMdr();
    mdr.busy = false;
  }
  // the envelope, out of the held tray and up over it, and back
  async function liftEnvelope() {
    mdr.busy = true;
    playtest('envelope: lifted' + (mdr.opened ? ' (opened)' : ''));
    const from = TR.envelopePose(TR.frameOf(trayHeld())), to = MD.heldEnvelope(0);
    await motion(600, u => drawHeldTray(between(from, to, easeIO(u), v3.add(from.c, [0, -20, -30]), to.c)));
    mdr.envHeld = true; drawHeldTray();
    if (mdr.opened) await slipUp();
    mdr.busy = false;
  }
  async function slipUp() {
    mdSound('paper-slide');
    await motion(520, u => { mdr.envSlip = easeIO(u); drawHeldTray(); });
  }
  async function openEnvelope() {
    mdr.busy = true;
    playtest('envelope: opened');
    mdSound('paper-flick');
    mdr.opened = true; keepMdr();
    drawHeldTray();
    await wait(160);
    await slipUp();
    mdr.busy = false;
  }
  async function putEnvelopeBack() {
    mdr.busy = true;
    playtest('envelope: put back in the tray');
    if (mdr.envSlip > 0) { mdSound('paper-slide'); await motion(300, u => { mdr.envSlip = 1 - easeIO(u); drawHeldTray(); }); }
    mdr.envSlip = 0; mdr.envHeld = false;
    const from = MD.heldEnvelope(0), to = TR.envelopePose(TR.frameOf(trayHeld()));
    await motion(550, u => drawHeldTray(between(from, to, easeIO(u), from.c, v3.add(to.c, [0, -20, -30]))));
    drawHeldTray();
    mdr.busy = false;
  }
  // where a click lands on the stage (the held view is drawn in the look's own coordinates)
  const stagePoint = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) * 1440 / r.width, (e.clientY - r.top) * 1080 / r.height + look.y]; };
  const onPoly = (pt, pts) => !!pts && insidePoly(pt, pts.trim().split(/\s+/).map(q => q.split(',').map(Number)));
  mdCatcher.addEventListener('pointerdown', e => {
    e.preventDefault(); if (mdr.busy) return;
    const pt = stagePoint(e);
    if (mdr.envHeld) { mdr.opened ? putEnvelopeBack() : openEnvelope(); return; }
    if (onPoly(pt, heldEnvHit)) { liftEnvelope(); return; }
    putTrayBack();
  });
  mdHit.addEventListener('pointerdown', e => {
    const hit = e.target.dataset?.hit; if (!hit) return;
    e.preventDefault(); hint.classList.add('gone');
    if (mdr.busy) return;
    if (mdr.key !== 'lock') { rattleMdr(); return; }
    if (hit === 'tray') liftTray(); else mdr.open ? closeMdr() : openMdr();
  });
  setTimeout(() => { drawMdr(); drawDeskKey2(); });

  // ---- anything held up in front of you (Arnold, 2026-10-04): the night-1 polaroid, an old operator's letters, the cheat
  // sheet, the canister and its slips, M.'s tray and the envelope. q and Backspace put it back, all the way, the way a
  // click after the last does (the tray's envelope back into the tray first, then the tray; a slip back into its
  // canister and up the tube; a canister on its way up to you or back finishes by itself). A click still
  // does what it did. While anything is held, or on its way, the view stays where it is. Any other key typed puts it back
  // too, and goes on to the prompt once it is put away, as typed then (the story audit, 2026-10-06: every other key did
  // nothing, so a typed answer, "yes" to Glenn's question with a slip in your hands, was lost; nothing typed may vanish).
  // Esc still opens the menu (and under the menu every key is the menu's); the browser's own shortcuts pass.
  const holding = () => !!(held || letter.who || sheet.held || mdr.held || dlv.item || awd.held);
  async function putBackHeld() {
    if (letter.who) { putLetterBack(); return; }
    if (held) { putPhotoDown(); return; }
    if (awd.held) { putAwardAway(); return; }
    if (sheet.held) { putSheetBack(); return; }
    if (mdr.held) {
      if (mdr.busy) return;
      if (mdr.envHeld) await putEnvelopeBack();
      putTrayBack();
      return;
    }
    if (dlv.item && !dlv.busy && dlv.stage === 'slip') dlvPutAway();
  }
  const heldKeys = [];
  async function typeAfterHeld() {
    while (holding() || handsFull()) { putBackHeld(); await wait(120); }
    lookTo(false);
    const keys = heldKeys.splice(0);
    for (const k of keys) { const id = CODE_TO_ID[codeOf({ key: k })]; if (id) { press(id); setTimeout(() => release(id), 60); } typeKey(k); }
  }
  addEventListener('keydown', e => {
    if (!(holding() || heldKeys.length) || window.vigilTime?.paused || tubeMenu?.opened) return;
    if (e.key === 'Escape' || e.code === 'Escape' || PASS_THROUGH(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.ctrlKey || e.altKey) return;
    if ((e.key === 'q' || e.key === 'Q' || e.key === 'Backspace') && !heldKeys.length) { if (!e.repeat) putBackHeld(); return; }
    if (e.key.length !== 1 && e.key !== 'Enter' && e.key !== 'Backspace') return;
    if (heldKeys.push(e.key) === 1) typeAfterHeld();
  }, true);


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
    canParallax(cx, cy);
    stationParallax(cx, cy);
    keyParallax(cx, cy);
    requestAnimationFrame(tick);
  })();

  // ------------------------------------------------------------ the mug
  // Coffee level drives the steam. Click to sip; `brew` refills.
  const steam = $('steam'), mug = $('mug');
  const coffeeWord = () => room.coffee > .75 ? 'hot' : room.coffee > .45 ? 'warm' : room.coffee > .15 ? 'lukewarm' : room.coffee > 0 ? 'cold' : 'empty';
  function setCoffee(v) {
    // whole percent: five sips of .2 from a full mug came to 1e-16, not 0, so an empty mug still let you drink (a sip now
    // takes a third, counted in whole thirds: 100, 67, 33, 0)
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
    const r = mug3d.render(p, room.coffee);
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
  mug.addEventListener('click', () => {
    if (sipping) return;
    hint.classList.add('gone');
    if (room.coffee <= 0) {                       // nothing left: a shake and a sad little sound
      mug.classList.remove('shake'); void mug.getBBox(); mug.classList.add('shake');
      sadSound();
      // (with no beans left it doesn't send you to brew: the story audit, 2026-10-06)
      term.say(!steam.dataset.said ? 'that was the last of it.' : shift.beans > 0 ? "still empty. try 'brew'." : 'still empty. no beans left.');
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
        if (room.coffee > 0) { playtest('sip'); sipSound(); steam.classList.add('puff'); setTimeout(() => steam.classList.remove('puff'), 900); setCoffee(Math.max(0, Math.round(room.coffee * 3 - 1)) / 3); shift.drink(); updateVitals(); glenn.complied('coffee'); }
      }
      if (f.blend > 0) { poseDrawnMug(f.pose); mug.style.opacity = f.blend.toFixed(3); mug3dG.style.opacity = (1 - f.blend).toFixed(3); }
      else { mug.style.opacity = 0; mug3dG.style.opacity = 1; }
      if (f.event !== 'done') { requestAnimationFrame(frame); return; }
      mug.style.transform = ''; mug.style.opacity = '';
      mug3dG.style.display = 'none'; mug3dG.style.opacity = ''; mug3dG.innerHTML = ''; steamRig.style.transform = '';
      document.body.classList.remove('sipping');
      clink();
      sipping = false;
      if (room.coffee <= 0) { term.say('that was the last of it.'); steam.dataset.said = '1'; if (shift.beans > 0 && glenn.once('brew', "Out already? Be a pal and type brew. Beans don't grow on trees, so pace yourself.")) glenn.order('brew', 'be a pal and type brew'); } else steam.dataset.said = '';
    })(t0);
  });

  // ------------------------------------------------------------ sound
  let audio = null, muted = false;
  // the volume (the menu's settings): one gain in front of the speakers, in every context; kept in vigil.volume
  let volume = .8;
  try { const v = localStorage.getItem('vigil.volume'); if (v !== null && !Number.isNaN(+v)) volume = clamp(+v, 0, 1); } catch (e) {}
  function makeAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.master) return ctx;                       // (audit-sound.js hands back one context for all)
    const master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    try { Object.defineProperty(ctx, 'destination', { value: master }); ctx.master = master; } catch (e) {}
    return ctx;
  }
  function setVolume(v) {
    volume = clamp(v, 0, 1);
    try { localStorage.setItem('vigil.volume', volume.toFixed(2)); } catch (e) {}
    if (audio?.master) audio.master.gain.setTargetAtTime(volume, audio.currentTime, .02);
  }
  // (the room's sound carries on while the game is paused: the hum, the fans, the keys)
  function ac() {
    if (!audio) audio = makeAudio();
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

  // ------------------------------------------------------------ the menu (Esc): its keys
  // The menu is on the tube (Arnold, 2026-10-03: a page overlay that cut the sound was wrong for this game; tubeMenu, by the
  // terminal, draws it). Its keys are taken here, first of all the page's: Esc opens it from anywhere and closes it; while it
  // is open every key goes to it and nothing reaches the room, the drawn keyboard included (the story audit, 2026-10-06: its
  // keys went down under the menu, the room moving while paused; only the Esc that opens it is pressed). The lost night's
  // dark screen keeps its own keys, and the menu never opens over it (below, open). Before the tube exists, nothing.
  let tubeMenu = null;
  const RECOMMENDED = ['cream', 'topre', 'creamyv2'];
  addEventListener('keydown', e => {
    if (!tubeMenu || !$('night-over').hidden) return;
    const isEsc = e.key === 'Escape' || e.code === 'Escape';
    if (!tubeMenu.opened && !isEsc) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!tubeMenu.opened) { const id = CODE_TO_ID[codeOf(e)]; if (id && !e.repeat) press(id); tubeMenu.open('esc'); return; }
    tubeMenu.key(isEsc ? 'Escape' : e.key);
  }, true);
  // the tab or the window loses focus: paused, the menu up (alt-tabbing never drains energy); ?nopause leaves that off, for
  // testing in a hidden pane. And if the page were ever full screen, the browser takes the first Esc to leave it, so leaving
  // it opens the menu: one Esc still pauses.
  if (!new URLSearchParams(location.search).has('nopause')) {
    addEventListener('blur', () => tubeMenu?.open('focus lost'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) tubeMenu?.open('tab hidden'); });
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) tubeMenu?.open('left full screen'); });

  const limiters = new Map();                         // one per audio context
  function keyLimiter(ctx) {
    if (limiters.has(ctx)) return limiters.get(ctx);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .1;
    const limiter = ctx.createBiquadFilter(); limiter.type = 'highpass'; limiter.frequency.value = 80; limiter.Q.value = .6;   // keeps any low rumble in a recording off the speakers
    limiter.connect(comp).connect(ctx.destination);
    limiters.set(ctx, limiter);
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
  // Beans in (Arnold, 2026-10-02): the PC speaker's little success chirp, from the tube, not a game's ding. Three quick
  // notes rising, a square wave through a small speaker's band, 0.28 s. Level measured with the sound audit against the
  // hum (design.md, "Beans in"); BEAN_CHIRP.gain is the one knob.
  const BEAN_CHIRP = { gain: .012, notes: [[880, 0, .055], [1175, .07, .055], [1760, .14, .14]] };   // [Hz, start s, length s]
  function beanChirp() {
    if (muted) return;
    const ctx = ac(), t0 = ctx.currentTime + .01;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .7;   // a small speaker: no lows, softened highs
    const out = ctx.createGain(); out.gain.value = BEAN_CHIRP.gain; bp.connect(out).connect(ctx.destination);
    for (const [hz, at, d] of BEAN_CHIRP.notes) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz;
      const g = ctx.createGain(), s = t0 + at;                // 4 ms in and 20 ms out, so no note clicks
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1, s + .004); g.gain.setValueAtTime(1, s + d - .02); g.gain.linearRampToValueAtTime(0, s + d);
      o.connect(g).connect(bp); o.start(s); o.stop(s + d + .01);
    }
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
    // (room.still: 04:44, the room stops; room.dip: IT's 03:00 "brief interruption", a dip for a beat)
    const level = () => on && !room.still ? (.55 + Math.min(busy, 1) * .45) * (room.power ? 1 : .4) * (room.dip ? .15 : 1) : 0;
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
    $('build-note').hidden = false;
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
  // Seen on this night before (a replay, Arnold, 2026-10-05): the same line, typed quickly, held a moment, and no cover
  // story (the keyboard is not yours for about 3 s instead of about 11).
  async function wakeUp() {
    const short = seen.has('wake');
    seen.mark('wake'); playtest(short ? '04:44 (seen: short)' : '04:44');
    await typedByItself(short, short ? 900 : 3500);
    room.replayedAt = shift.clock().slice(0, 5);        // only dmesg says what that was
    if (short) return;
    await wait(1400);
    glenn.say("Ha! Don't mind that, chief. Old buffer. It does that when it rains.");
  }
  // the keyboard isn't yours: "you've done this before." types itself on your prompt on M.'s soft switch, the keys going
  // down with it, hesitating after "you've"; it waits; it takes itself back, letter by letter, and gives you your line back
  // inGame: a cartridge game frozen with the room (04:44): it types over the game's top line instead of the prompt
  async function typedByItself(short, before, inGame = false) {
    const voice = M_VOICE();
    await loadPack(voice.pack);
    borrowedVoice = voice;                              // whatever you type now isn't quite your keyboard
    await wait(before);
    const msg = "you've done this before.";
    let kept = '', n = 0;
    const show = () => term.overTop({ text: ' ' + msg.slice(0, n) });
    if (!inGame) { term.hold(true); kept = term.takeLine(); } else show();
    for (let i = 0; i < msg.length; i++) {
      if (inGame) { n++; show(); } else term.ghost(msg[i]);
      tap(msg[i]);
      await wait(short ? 45 : msg[i] === ' ' ? 170 : 90 + rnd(110) + (i === 5 ? 600 : 0));   // slow, and a hesitation after "you've" (its e)
    }
    await wait(short ? 700 : 1700);
    for (let i = 0; i < msg.length; i++) { if (inGame) { n--; show(); } else term.unghost(); tap('Backspace'); await wait(short ? 25 : 40 + rnd(30)); }
    if (inGame) term.overTop(null); else { term.giveLine(kept); term.hold(false); }
    borrowedVoice = null;
  }

  // ---- night 1's climax at 04:44 (design.md section 5; the proposal 2.2, second by second). It waits until you're at
  // the shell, looking at the screen, with nothing held. Sound off and without reading: the board opens by itself and
  // scrolls on its own to a row dated tomorrow with your initials first; at that instant the room stops (every LED on
  // both racks jumps to the bright tone and holds, units in trouble keeping their own state; the hum and the fans stop;
  // the steam stops; the chin's clock holds 04:44); a canister nobody sent rattles down and drops in; the keyboard types
  // "you've done this before." by itself and takes it back; the room comes back; Glenn's cover. Inside the canister:
  // OPERATOR OF THE NIGHT, your name, tomorrow's date. On a night played again (vigil.seen) the room still stops and the
  // canister still drops, quickly: no scroll (the board opens on tomorrow's row), the keys type quickly, no cover.
  function roomStill(on) {
    room.still = on;
    for (const l of leds) { if (on && inTrouble(l)) continue; ledClass(l, 'ping', on); }
    steam.classList.toggle('still', on);
    hum.update(on ? .04 : 1.2);                          // cut out; then swell back
    // (04:44 itself, M.'s minute: the room stops 3 s into the scroll, by then 04:45 or later; the story audit, 2026-10-06)
    if (on) { drawClock(true, '04:44'); clockHeld = true; } else { clockHeld = false; drawClock(true); }
  }
  // It doesn't wait on the tube (the story audit, 2026-10-06: it waited with no limit, so the board or a match could push it
  // past 05:30): a view (top, the board, the mail) gives way, closing by itself a moment after it is due; a cartridge game
  // freezes with the room (Arnold, 2026-10-06): its clock and its keys stop, the room stops, the canister drops, the keys
  // type over the game's top line and take it back, the room comes back, and the game goes on. The board doesn't open over a
  // game; tomorrow's row is on it all the same, for whoever looks.
  async function climax0444() {
    room.beat = true;
    const due = performance.now();
    let inGame = false;
    while (true) {
      await eyesOnScreen();
      if (term.inShell()) break;
      const v = term.view();
      if (v === 'game') { inGame = true; break; }
      if (v === 'view' && performance.now() - due > 2500) { playtest('04:44: the view gives way'); term.closeView(); }
      await wait(250);
    }
    if (inGame) return climaxInGame();
    const short = seen.has('climax'); seen.mark('climax');
    shift.hush(short ? 8000 : 24000);                   // (nothing new breaks while the room holds its breath: the quiet window ends at 04:52)
    const t0 = performance.now(), mark = what => playtest(`04:44 ${what} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    mark(short ? 'climax (seen: short)' : 'climax');
    const rows = board.rows(), me = rows.find(r => r.you), tomorrow = new Date(Date.now() + 864e5);
    room.tomorrowRow = { date: tomorrow.toDateString().slice(4, 10), op: me.op, merit: me.merit + 52 };   // (it stays on the board the rest of the night)
    // t 0: the board opens by itself, your row at the top, highlighted
    term.announce([{ text: 'board: new leader.', cls: 'dim' }]);
    const bv = term.board({ top: { ...me, merit: Math.max(me.merit, rows[0].merit + 3) } });
    const target = boardLines().findIndex(l => l.text === ' NIGHTS BEFORE');
    if (!short) {
      // t 1: your row drops to second; the board scrolls by itself, past tonight, past "all time: m", 2 s
      await wait(1000); bv.set({ top: null });
      window.__dlv.clear();                              // (a canister waiting in the receiver goes back up meanwhile)
      for (let k = 1; k <= target; k++) { await wait(2000 / target); bv.set({ scroll: k }); }
    } else { bv.set({ top: null, scroll: target }); await window.__dlv.clear(); await wait(300); }
    // t 3: it stops on tomorrow's row, and the room stops; in the stillness, a rattle down the tube
    mark('the room stops');
    roomStill(true);
    // (a night played again, the award already on the monitor or put away: the canister still comes, and comes empty)
    const arrived = window.__dlv.story({ why: 'award', kind: awd.where ? 'empty' : 'award', date: tomorrow.toDateString() });
    // t 4.5: the canister drops in (the thunk, the only sound); the board closes by itself, the prompt is back
    await wait(1500); await arrived;
    bv.close();
    mark('canister in');
    // t 5.5: the keys go down by themselves: "you've done this before.", and back (to about t 12.5)
    await typedByItself(short, short ? 300 : 1000);
    room.replayedAt = shift.clock().slice(0, 5);         // (dmesg)
    // t 14: the room comes back
    await wait(short ? 300 : 1000);
    roomStill(false);
    mark('the room back');
    // t 16: Glenn's cover, now with the board in it
    if (!short) { await wait(800); glenn.say(cold() ? "Don't mind that, chief. The board's on an old buffer." : "Ha! Don't mind that, chief. The board's on an old buffer. It does that when it rains."); }
    room.climaxed = true; room.beat = false;
  }
  async function climaxInGame() {
    const short = seen.has('climax'); seen.mark('climax');
    shift.hush(short ? 8000 : 20000);
    const t0 = performance.now(), mark = what => playtest(`04:44 ${what} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    mark('climax, over a game: it freezes with the room');
    const me = board.rows().find(r => r.you), tomorrow = new Date(Date.now() + 864e5);
    room.tomorrowRow = { date: tomorrow.toDateString().slice(4, 10), op: me.op, merit: me.merit + 52 };
    term.announce([{ text: 'board: new leader.', cls: 'dim' }]);     // (above the prompt, there when the game is done)
    term.freeze(true);
    await window.__dlv.clear();
    roomStill(true);
    const arrived = window.__dlv.story({ why: 'award', kind: awd.where ? 'empty' : 'award', date: tomorrow.toDateString() });
    await wait(1500); await arrived;
    mark('canister in');
    await typedByItself(short, short ? 300 : 1000, true);
    room.replayedAt = shift.clock().slice(0, 5);
    await wait(short ? 300 : 1000);
    roomStill(false); term.freeze(false);
    mark('the room back, the game goes on');
    if (!short) glenn.say(cold() ? "Don't mind that, chief. The board's on an old buffer." : "Ha! Don't mind that, chief. The board's on an old buffer. It does that when it rains.");
    room.climaxed = true; room.beat = false;
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
  const CLEAR_LINE = e => e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'KeyU' || (!e.code && /^u$/i.test(e.key)));   // ctrl+u, as a shell has it (the browser's view-source is held back)
  const PASS_THROUGH = e => e.metaKey || /^F(5|11|12)$/.test(e.code) || (e.ctrlKey && !WORD_DELETE(e) && !CLEAR_LINE(e));
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
    if (CLEAR_LINE(e)) { e.preventDefault(); typeKey('ClearLine'); hint.classList.add('gone'); return; }
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
      if (k === 'Escape') { setTimeout(() => tubeMenu?.open('the drawn esc'), 120); return; }   // the drawn esc, as the real one: the menu
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
  // his warmth: slipped for the night once M.'s key is out (room.cold), and for a while after a refusal (room.coolUntil)
  const cold = () => room.cold || performance.now() < (room.coolUntil || 0);
  const glenn = (() => {
    const VOICE = { pack: 'mxblue', gain: .5, lowpass: 3000 };
    const MUFFLED = { pack: 'mxblue', gain: .28, lowpass: 750 };   // heard through the ceiling, with the screen dark (Arnold: more muffled)
    const TAG = '<span class="sup-tag"> GLENN </span><span class="sup"> </span>';
    let arrived = false, drawerTimer = 0, arrivalTimer = 0;
    // taught: what he has said (or has queued to say); kept: what is saved. A line is saved once it has typed (the story
    // audit, 2026-10-06: saved when queued, a reload in his first minute lost his Pong pointer for good)
    const taught = new Set(), kept = new Set();
    try { for (const k of JSON.parse(localStorage.getItem('vigil.glenn') || '[]')) { taught.add(k); kept.add(k); } } catch (e) {}
    const save = () => { try { localStorage.setItem('vigil.glenn', JSON.stringify([...kept])); } catch (e) {} };
    const remember = k => { taught.add(k); kept.add(k); save(); };
    // fast, sure, a breath at the end of a sentence
    const pace = (ch, next) => /[.!?]/.test(ch) && next === ' ' ? 240 + Math.random() * 140 : ch === ',' ? 130 + Math.random() * 70 : 30 + Math.random() * 28;
    const idOf = ch => ch === ' ' ? 'key-Space' : /[a-z]/i.test(ch) ? 'key-' + ch.toUpperCase() : 'key-J';
    const key = (ch, v = VOICE) => { const id = idOf(ch); click('key', false, id, v); setTimeout(() => click('key', true, id, v), 55); };
    // An order ("be a pal and ...") waits for the thing it asked for; when you do it, the system notes it in the log,
    // quietly, from night 1: "operator compliance: yes (be a pal and read the runbook)". Nothing shows on the tube
    // until night 3 (logLine).
    // An order stands from the moment its words start typing (the simulation report, 2026-10-06, item 9: it stood once the
    // whole call had typed, so a player who typed status while his last introduction line was still going got nothing for
    // it); done or refused before then, it is simply dropped (the story audit: a thing done before he has said it isn't
    // obeying him). Words he isn't going to type (left on the dark screen, said on an earlier night, a night played again)
    // stand at once. A strike after a fix order is the order refused, and at 05:30 the orders still open are closed
    // (closeOrders).
    const orders = new Map(), pending = new Map();     // what was asked -> the words it was asked in
    const wordsOf = (what, words) => words.match(/be a pal[^.!?]*/i)?.[0].toLowerCase().replace(/, chief$/, '') || what;
    const says = (t, w) => t.toLowerCase().includes(w);
    function order(what, words) {
      const w = wordsOf(what, words);
      let coming = calls.some(c => c.texts.some(t => says(t, w)));
      for (let c = current; c && !coming; c = c.outer) coming = c.texts.slice(c.next).some(t => says(t, w));
      if (coming) pending.set(what, w); else { pending.delete(what); orders.set(what, w); }
    }
    // a line about to type: any order in it stands from now
    function standing(t) { for (const [what, w] of pending) if (says(t, w)) { pending.delete(what); orders.set(what, w); } }
    // a refusal shows (the simulation report, item 8: it showed only as a dip on the board): his warmth slips for a while
    // after one, his colder lines in place of the warm ones (room.cold, once M.'s key is out, is for the rest of the night)
    const COOL = 180000;
    const cooled = () => { room.coolUntil = performance.now() + COOL; playtest('glenn: a refusal, his warmth slips for a while'); };
    function complied(what) {
      if (pending.delete(what) || !orders.has(what)) return;
      logLine(`vigild[1]: operator compliance: yes (${orders.get(what)})`);
      orders.delete(what);
    }
    function broke(what) {
      if (pending.delete(what) || !orders.has(what)) return;
      logLine(`vigild[1]: operator compliance: no (${orders.get(what)})`);
      orders.delete(what); cooled();
    }
    // refused there and then (the ceiling's key taken as he says it): logged at once, whether or not his line has typed
    function refused(what, words) {
      pending.delete(what);
      logLine(`vigild[1]: operator compliance: no (${orders.get(what) || wordsOf(what, words)})`);
      orders.delete(what); cooled();
    }
    // 05:30: a fix order still open is a unit still down, refused; the rest asked for nothing with a deadline and close
    // without a line (they used to stand into the next night, and a unit gone with the night logged "yes" at 23:00)
    function closeOrders() {
      pending.clear();
      for (const [what, w] of orders) if (what.startsWith('fix:')) logLine(`vigild[1]: operator compliance: no (${w})`);
      orders.clear();
    }
    // ---- his queue: one call at a time, nobody typing over anybody. While you are somewhere else (a game, the mail, the
    // board, top, looking up or down, a paper held up: the simulation report, 2026-10-06, item 3: most of night 1's lines
    // were typed behind those and read late, his introduction behind the welcome mail) he waits between lines; what can't
    // wait, a strike and an order to fix a unit before its strike (urgent), types at once and goes ahead of the rest.
    // teach: what he says once holds the energy while he says it (Eugene's playtest, 2026-10-02), not while he waits for you.
    const calls = [];
    let current = null, running = false;
    const elsewhere = () => !!term.view() || look.rest !== 0 || holding();
    function call(texts, { urgent = false, teach = false, pre = true, line }) {
      const sh = shift;
      return new Promise(done => { calls.push({ texts, urgent, teach, pre, line, sh, done, next: 0 }); run(); });
    }
    async function run() {
      if (running) return;
      running = true;
      while (calls.length) {
        const i = elsewhere() ? calls.findIndex(c => c.urgent) : 0;
        if (i < 0) { await wait(250); continue; }
        await play(calls.splice(i, 1)[0]);
      }
      running = false;
    }
    async function play(c) {
      c.outer = current; current = c;
      const hold = on => { if (c.teach) c.sh?.hold('glenn', on); };
      hold(true);
      if (c.pre) await wait(500 + Math.random() * 400);  // he reads it before he answers
      for (; c.next < c.texts.length;) {
        // never over the boot or the login; and, unless it can't wait, not while you're elsewhere (an urgent call goes meanwhile)
        while (!term.talkable() || account.loggingIn || (!c.urgent && elsewhere())) {
          if (term.talkable() && !account.loggingIn && !c.urgent) hold(false);
          const u = calls.findIndex(x => x.urgent);
          if (!c.urgent && u >= 0 && term.talkable() && !account.loggingIn) await play(calls.splice(u, 1)[0]);
          else await wait(300);
        }
        hold(true);
        const t = c.texts[c.next++];
        standing(t);
        await c.line(t);
      }
      hold(false);
      current = c.outer;
      c.done();
    }
    const glennLine = async t => {
      logLine('glenn: ' + t);
      shift?.hush(t.length * 60 + 2500);               // nothing new breaks while he is talking (a drip, with quiet for the story)
      room.talking = true;                             // (the racks' alarms go quieter under his keys)
      await term.typeLine(TAG, t, 'sup', key, pace);
      room.talking = false;
      await wait(420 + Math.random() * 300);
    };
    function say(...texts) { loadPack(VOICE.pack); return call(texts, { line: glennLine }); }
    // a strike, an order to fix a unit before its strike: typed whatever you are looking at
    function urgent(...texts) { loadPack(VOICE.pack); return call(texts, { urgent: true, line: glennLine }); }
    // ---- other voices on the link (the plan: red means upstairs; each with their own tag and switch, muffled as his is).
    // They share his queue, so nobody types over anybody. aw, site 2's shift lead: lowercase, warm, her own soft switch
    // (sk61-brown, no other voice's). Each of her keys ticks the receiver's flag. fast: a night played again.
    const VOICES = { aw: { tag: '<span class="sup-tag"> AW </span><span class="sup"> </span>', pack: 'sk61-brown', gain: .26, lowpass: 820 } };
    function voice(who, text, { fast = false } = {}) {
      const V = VOICES[who];
      loadPack(V.pack);
      return call([text], { pre: false, line: async t => {
        logLine(`${who}: ${t}`);
        shift?.hush(t.length * 90 + 2000);
        room.talking = true;
        await term.typeLine(V.tag, t, 'sup', ch => { const id = idOf(ch); click('key', false, id, V); setTimeout(() => click('key', true, id, V), 60); window.__dlv?.tick(); },
          (ch, next) => fast ? 35 : /[.,]/.test(ch) && next === ' ' ? 300 : 75 + Math.random() * 60);
        room.talking = false;
        await wait(300);
      } });
    }
    // a line left on the dark screen: no typing to watch, it is simply there when the monitor comes back on
    function leave(t) {
      logLine('glenn: ' + t);
      term.leave({ html: TAG + `<span class="sup">${t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>` });
      loadPack(VOICE.pack);
      let at = 0;                                        // heard, not seen: his keys, upstairs, at his pace
      for (let i = 0; i < t.length; i++) { const ch = t[i]; setTimeout(() => key(ch, MUFFLED), at); at += pace(ch, t[i + 1]); }
    }
    // a question waiting for its answer. yes replays a short version of the tutorial (it is teaching: the energy holds);
    // no, and he lets it go; anything else is just a command, and the question still stands (Eugene's second playtest,
    // 2026-10-05: the welcome says "Type 'mail'", so mail came first, the question lapsed, and "yes" was then "command not
    // found"). It lapses only after two real minutes unanswered.
    let asked = null, askedAt = 0;
    const YES = /^(y|yes|yeah|yea|yep|yup|ya|yah|sure|ok|okay|please|yes please|yes sir|sure thing|go on|go ahead|why not)$/;
    const NO = /^(n|no|nope|nah|no thanks|no thank you|nah thanks|im good|i'm good|skip|not now|not yet|not)$/;
    // the answer is the line's first word, or the whole of a short phrase (the story audit, 2026-10-06: "yes chief" was "no
    // answer.", and M.'s "not yet" wasn't read); "not yet" is a no
    function answer(raw) {
      if (!asked) return false;
      if (performance.now() - askedAt > 120000) { asked = null; return false; }
      const whole = raw.trim().toLowerCase().replace(/[.!?,]+/g, '').replace(/\s+/g, ' ');
      const a = YES.test(whole) || NO.test(whole) ? whole : /^not yet\b/.test(whole) ? 'not yet' : whole.split(' ')[0];
      if (!YES.test(a) && !NO.test(a)) return false;
      asked = null;
      heardAt = performance.now();                       // (answered: "can't hear you down there" can't follow it)
      if (YES.test(a)) {
        playtest('refresher: yes');
        teach("Trouble shows up right here, and in the strip along the top of the screen.",
          "Not responding: reboot it. Running hot: reroute it. Anything stranger, the cheat sheet in the top right drawer has you covered.",
          "Type top to see every rack. That's the drill, chief.");
        return true;
      }
      playtest('refresher: no'); say('Alright, chief.'); return true;
    }
    // talked to at the terminal (Arnold, 2026-10-05): he answers, but it is never a conversation: a few lines, in turn,
    // and not again for 25 real seconds (the terminal says "no answer." meanwhile). Not before he has arrived, nor with
    // the supervisor link down.
    const HEARD = ["Can't hear you down there, chief. Type help.", "This line only runs one way, chief. Try help.",
      'I just watch the racks, chief. Help has the rest.', "Save the chat for the day shift, chief. Type help if you're stuck."];
    let heardAt = -1e9, heardN = 0;
    function heard() {
      if (!arrived || room.linkDown || performance.now() - heardAt < 25000) return false;
      heardAt = performance.now(); say(HEARD[heardN++ % HEARD.length]); return true;
    }
    // false if said before; otherwise the promise of his saying it (truthy, so it reads as "said")
    // (what he says once is teaching: the energy holds while he says it, Eugene's playtest, 2026-10-02)
    function once(k, ...texts) { if (taught.has(k)) return false; taught.add(k); return teach(...texts).then(() => { kept.add(k); save(); }); }
    function teach(...texts) { loadPack(VOICE.pack); return call(texts, { teach: true, line: glennLine }); }
    // the start of the night: an introduction the first time, a welcome back after that
    // one arrival pending at a time: a logout cancels the last operator's
    // (the energy holds from the login until he is here: the first seconds of a night never cost anything)
    function arriveIn(ms) { clearTimeout(arrivalTimer); shift?.hold('arrival', true); arrivalTimer = setTimeout(arrive, ms); }
    function arrive() {
      clearTimeout(arrivalTimer);
      if (!account.loggingIn) shift?.hold('arrival', false);
      if (arrived) return;
      if (account.loggingIn) { arriveIn(1000); return; }
      arrived = true;
      // the nightly standing order (design.md section 5, the board): pays at 05:30, "no" if you fall asleep. Night 1 only
      // so far. On a night played again it is given without a word (Glenn skips his speeches; the order still stands).
      const seeIt = () => { if (shift.level !== 1) return; const line = 'Be a pal and see it through to the day shift, chief.'; if (!room.replay) say(line); order('seeit', line); };
      if (taught.has('intro')) {
        if (!taught.has('basics')) remember('basics');
        // a night played again (Arnold, 2026-10-05): no question, he knows you've been here
        if (room.replay) { playtest('replay: glenn skips the refresher'); say('You know the drill, chief.'); seeIt(); return; }
        seeIt();
        // a returning night: he offers a refresher (Eugene's playtest, 2026-10-02); the next thing you type answers him
        say(shift.initial().length ? "Evening, chief. You're walking into a mess tonight. Need a refresher? (yes/no)" : 'Back already, chief. Need a refresher? (yes/no)');
        asked = 'refresher'; askedAt = performance.now();
        return;
      }
      once('intro',
        "Evening, chief! Glenn here. I'm your night supervisor.",
        "I'm upstairs, keeping an eye on the same racks you are.",
        ...(shift.level === 1 ? ["You're on the board tonight, chief. Sixth of six. Everybody starts at the bottom."] : []),
        "It's quiet for now. When something breaks, it'll tell you right here. Be a pal and check status now and then.",
        "There's a cheat sheet in the top right drawer of your desk, if you ever need it. And type top to see every rack at once.")
        .then(() => { if (!account.mailRead && !inbox.items()[0]?.read) { term.announce([{ text: 'You have new mail.' }, { text: "Type 'mail' to see it.", cls: 'dim' }]); beep(740, .04, .02); } });
      order('status', 'be a pal and check status now and then');
      seeIt();
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
    function forget() { taught.clear(); kept.clear(); orders.clear(); pending.clear(); asked = null; room.coolUntil = 0; arrived = false; clearTimeout(drawerTimer); clearTimeout(arrivalTimer); try { localStorage.removeItem('vigil.glenn'); } catch (e) {} }
    // clocked out and back in: he arrives again ("Back already.")
    function newNight() { arrived = false; }
    return { say, urgent, leave, once, arrive, arriveIn, forget, newNight, order, complied, broke, refused, closeOrders, did, basicsDone, checkBasics, answer, heard, voice, taught: k => taught.has(k) };
  })();

  // ------------------------------------------------------------ mail
  // The inbox (design.md, story): the welcome, then the night's mail as it arrives, corporate life with something
  // slightly off in each one, every message setting something up for later; and Vigil's notes on the maintenance tools.
  // "You have new mail." lands above the prompt like Glenn's lines. mail shows the inbox, mail <n> opens one
  // (Arnold: one command, laid out properly). The night's mail comes again every night: it is the
  // same night.
  const inbox = (() => {
    let box = [];
    const NIGHT = [
      { t: 30, from: 'IT Operations', addr: 'it@site4.vigil', subject: 'Maintenance tonight, 03:00', body: () => [
        'Scheduled power maintenance tonight between 03:00 and 03:05. You may notice a brief interruption. No action is needed.',
        '', 'Please do not touch the breaker panel.', '', { text: 'IT Operations, Site 4', cls: 'dim' }] },
      // how the post works (Arnold's words, 2026-10-03, round 3); the last line is for later (nothing lets you send anything up)
      { t: 30, from: 'Facilities', addr: 'facilities@site4.vigil', subject: 'Internal post', body: () => [
        "Site 4 is served by internal post from Stores, Level 2. Supplies come down the tube to the receiver on your left.",
        '', 'When the flag is up, something has come for you. Take what is inside; the carrier goes back up by itself.',
        '', 'Please do not put anything else in the carrier.', '', { text: 'Facilities, Site 4', cls: 'dim' }] },
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
        // (the handbook named: the story audit, 2026-10-06; draft words)
        '', 'Your handbook is in ~/handbook. It explains the board.',
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
  // a unit's LEDs clicked: "status <unit>" typed into the prompt (Eugene's playtest, 2026-10-02), quickly, on your keys;
  // whatever was half-typed goes. Enter is still yours to press.
  const PROBLEM_CLS = { DOWN: 'pdown', HOT: 'phot', STUCK: 'pstuck', LOSS: 'ploss' };
  function typeIn(text) {
    if (!term.inShell() || !room.power) return;
    term.input('ClearLine');
    [...text].forEach((ch, i) => setTimeout(() => {
      const id = ch === ' ' ? 'key-Space' : ch === '-' ? 'key-Minus' : 'key-' + ch.toUpperCase();
      press(id); setTimeout(() => release(id), 55); term.input(ch);
    }, i * 42));
  }
  for (const [u, U] of Object.entries(UNITS)) {
    const g = $(`rack-${U.side}-unit-${U.n}`); if (!g) continue;
    g.classList.add('unit-hit');
    // (a unit that is fine, on a rack dropping packets: the rack's status, the trouble its LEDs show; the simulation report,
    // 2026-10-06, item 10: it typed the unit's, which answered "ok")
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); hint.classList.add('gone'); playtest('led click ' + u);
      const rack = 'rack-' + U.side;
      typeIn('status ' + (!shift.state(u) && shift.state(rack)?.kind === 'LOSS' ? rack : u));
    });
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
    // (seen on this night before: about 15 s of it, not a minute)
    const short = seen.has('tty2'); seen.mark('tty2');
    const end = performance.now() + (short ? 13000 + Math.random() * 3000 : 58000 + Math.random() * 6000);
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
  // how each cartridge is announced as it turns up: Vigil's system mail, cheerful (Arnold, 2026-10-04: M. is someone
  // who already put it down, not a guide, so the pointers are the company's). Why it came, then what and where.
  const NOTES = {
    DEFRAG: {
      body: ['Maintenance tools unlocked: DEFRAG (desk drawer, tray 2).', "For units that won't hold a reboot."],
      won: 'PONG match won!', calm: 'Thirty quiet minutes on the racks!', timer: 'Scheduled release.',
    },
    ROUTE: {
      body: ['Maintenance tools unlocked: ROUTE (desk drawer, tray 3).', 'For racks dropping packets.'],
      won: 'DEFRAG: unit restored!', calm: 'Thirty quiet minutes on the racks!', timer: 'Scheduled release.',
    },
  };
  // ---- the board (design.md section 5, "The board"; board.js has the numbers): the six sites' night operators ranked
  // live by merit, you last at 23:00. `board` is a view like top. A change of rank lands as one dim line above the
  // prompt, at most one every 30 real seconds and never over someone typing; the first pass into 3rd is the turn
  // (below). It is the company's board (People's lines, "board:"), never vigild's. Night 1 only so far.
  let boardT = 0;
  const boardSeen = { rank: 6, at: 0 };
  const ORD = window.BOARD.ORD;
  // a fix landed (a game won is one too): the board counts it, clean if within 35 shift minutes
  function landed(u, win = false) { shift.finish(u); board.fix(shift.lastQuick); if (win) board.win(); }
  const review = () => { try { return +localStorage.getItem('vigil.review') || 0; } catch (e) { return 0; } };
  // your clocked-out nights on the board's nights before, newest first (vigil.boardNights; the story audit, 2026-10-06: the
  // list was fixed, so on night 2 ek still topped yesterday): each night's row goes on top at 05:30, its real date
  const boardNights = () => { try { return JSON.parse(localStorage.getItem('vigil.boardNights') || '[]'); } catch (e) { return []; } };
  // the board as the tube shows it: tonight, the review, the all-time line, then the nights before (with tomorrow's row
  // once 04:44 has put it there). top: show this row first (04:44's moment as leader).
  function boardLines({ top = null } = {}) {
    const rows = top ? [top, ...board.rows().filter(r => !r.you)] : board.rows();
    const out = [
      { text: ` THE BOARD · nights · ${shift.clock().slice(0, 5)}`.padEnd(40) + 'q closes', cls: 'dim' },
      { text: '  #  op    site   merit', cls: 'dim' },
      ...rows.map((r, i) => r.you ? { text: `  ${i + 1}  ${r.op.padEnd(5)} ${String(r.site).padEnd(5)}${String(r.merit).padStart(6)}   you`, cls: 'ok' }
        : `  ${i + 1}  ${r.op.padEnd(5)} ${String(r.site).padEnd(5)}${String(r.merit).padStart(6)}`),
      { text: ` shift review: top 3 nights running. you: ${review()} of 3`, cls: 'dim' },
      { text: ' all time: m · 1,412 · reassigned', cls: 'dim' },
      { text: ' NIGHTS BEFORE', cls: 'dim' },
      ...(room.tomorrowRow ? [{ text: `  ${room.tomorrowRow.date}  ${room.tomorrowRow.op.padEnd(5)}1st  ${String(room.tomorrowRow.merit).padStart(5)}`, cls: 'ok' }] : []),
      ...[...boardNights(), ...boardNightsBefore(new Date())].map(n => `  ${n.date}  ${n.op.padEnd(5)}1st  ${String(n.merit).padStart(5)}`),
    ];
    return out;
  }
  // the clients (design.md section 5, "The clients"; the proposal's section 6): each unit's, read and never typed.
  // [full, short, what top says it is doing, closed]. The service words are for Glenn's one line about a closed client, and only
  // where "at this hour" is odd (the story audit, 2026-10-06: an overnight batch and wake-up calls do run at night); "gate:
  // lowered", not "down", which reads as DOWN.
  const CLIENTS = {
    L10: ['Pinecrest Public Library, overdue notices', 'Pinecrest Library, notices', () => `notices: ${(1206 + clientTick.L10).toLocaleString('en-US')} queued`],
    L14: ['Harlow Dental, appointment reminders', 'Harlow Dental, reminders', () => 'reminders: next 09:15', 'dental reminders'],
    L20: ['Brightwater Coin Laundry, change machine', 'Brightwater Laundry, change', () => 'change: 0 dispensed'],
    L27: ['Lakeview Lanes, lane scoring', 'Lakeview Lanes, scoring', () => 'lanes: 0 of 24 in use', 'lane scores'],
    L33: ['Meridian Parking, gate controller', 'Meridian Parking, gate', () => 'gate: lowered, 0 cars'],
    L41: ['Dunmore Garden Centre, greenhouse misters', 'Dunmore Garden, misters', () => clientTick.L41 % 2 ? 'misters: off' : `misters: on, ${1 + clientTick.L41 % 3} min`],
    L47: ["Corrigan's Bakery, proofing ovens", "Corrigan's Bakery, ovens", () => `ovens: proofing, ${27 + clientTick.L47 % 2}C`],
    R10: ['Tri-County Bingo Hall, number caller', 'Tri-County Bingo, caller', () => `calling: ${'BINGO'[clientTick.R10 % 5]} ${1 + (clientTick.R10 * 7) % 15 + 15 * (clientTick.R10 % 5)}`, 'bingo called'],
    R17: ['First Plains Credit Union, overnight batch', 'First Plains CU, batch', () => `batch: ${Math.min(99, 41 + clientTick.R17)}% posted`],
    R29: ['Sunset Motor Inn, wake-up calls', 'Sunset Motor Inn, wake-ups', () => 'next call: room 12, 05:30'],
    R47: ['(spare)', '(spare)', () => '(idle)'],
  };
  const clientTick = Object.fromEntries(Object.keys(CLIENTS).map(u => [u, 0]));
  const clientShort = u => CLIENTS[u] ? CLIENTS[u][1] : unitName(u);
  const clientName = u => CLIENTS[u] ? CLIENTS[u][0].split(',')[0].replace(/[()]/g, '') : unitName(u);   // (R47: "(spare)" in an alert reads "spare")
  // their own lines above the prompt, sparse (Arnold, Q17): at most one every 3 real minutes, in a quiet stretch (nothing
  // open, nothing typed for 20 s, at the shell, nobody typing upstairs), never on night 3. Drafts.
  const CLIENT_LINES = [
    'R29 Sunset Motor Inn: wake-up call, room 9. no answer.',
    'L14 Harlow Dental: reminder sent. cleaning, Thu 09:15.',
    'L47 Corrigan\'s Bakery: oven 2 at temperature.',
    'L10 Pinecrest Library: 3 notices returned undelivered.',
    'R10 Tri-County Bingo: N 31. no card.',
    'L27 Lakeview Lanes: lane 7 reset.',
    'L33 Meridian Parking: gate raised. no car.',
    'L41 Dunmore Garden: misters on, house 2.',
    'R17 First Plains CU: batch paused, waiting on branch 4.',
    'L20 Brightwater Laundry: change machine refilled. 0 coins.',
  ];
  let clientLineAt = 0, clientLineN = 0, longN = 0;
  // Night 1's long stretch, 03:00 to 04:44 (Arnold, 2026-10-06: the 3-minute limit was a guide; no dead air right before
  // 04:44): after about a minute with nothing new on the tube and nothing open, a client's line, or every third time a short
  // line from Glenn (approved by Arnold, 2026-10-06).
  const LONG_GLENN = ['Quiet one, chief.', 'Still with me, chief?', "Board's holding. Keep it that way, chief.", 'Hang in there, chief. Not long now.'];
  const LONG = { from: 240, to: 344, after: 60000 };
  // ---- the room's new moves (the proposal, section 1: the room carries every climax; sound off, it still shows)
  // the bright tone (.led.ping) rippling up both racks from the bottom, unit after unit, over about 0.6 s; units in
  // trouble keep their own state (the game lies about the story, never about the rules)
  const TROUBLE_CLS = ['down', 'hot', 'rebooting', 'stuck', 'dropping'];
  const inTrouble = l => TROUBLE_CLS.some(c => l.p.classList.contains(c));
  function rackRipple(ms = 600) {
    for (const rack of ['rack-left', 'rack-right']) {
      const list = RACK_LEDS[rack].filter(l => !inTrouble(l)).map(l => ({ l, y: l.p.getBBox().y })).sort((a, b) => b.y - a.y);
      const y0 = list[0]?.y ?? 0, y1 = list[list.length - 1]?.y ?? 1;
      for (const { l, y } of list) setTimeout(() => { if (inTrouble(l)) return; ledClass(l, 'ping', true); setTimeout(() => ledClass(l, 'ping', false), 220); }, ms * (y0 - y) / Math.max(1, y0 - y1));
    }
  }
  // a soft cascade of relays clicking in, with the ripple: Arnold's relay recording (assets/sounds/fx/relay-click) if it
  // is there, each one a little quieter; until then a small made click (measured, it sits under a keystroke)
  async function relayCascade(ms = 600, n = 9) {
    if (muted) return;
    const rec = await fxBuffer('relay-click');
    for (let i = 0; i < n; i++) setTimeout(() => {
      const pan = i % 2 ? .55 : -.55;
      if (rec) { playFx('relay-click', .35 - i * .02, pan); return; }
      const ctx = ac(), t = ctx.currentTime, len = Math.floor(ctx.sampleRate * .012), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 4);
      const s = ctx.createBufferSource(); s.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + rnd(600); bp.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = .05 - i * .003; const p = ctx.createStereoPanner(); p.pan.value = pan;
      s.connect(bp).connect(g).connect(p).connect(ctx.destination); s.start(t);
    }, ms * i / n);
  }
  // a beat waits until you are looking at the screen with nothing held (and, if asked, at the shell), and for someone in the
  // chair (present: a key or a click in the last 30 s); still looking down or up 20 s after it was due, the view comes back
  // up by itself, as typing brings it up
  const NOPAUSE = new URLSearchParams(location.search).has('nopause');
  async function eyesOnScreen({ shell = false } = {}) {
    const due = performance.now();
    while (true) {
      // (?nopause, for testing in a hidden pane, counts a hidden page as looked at)
      const ready = look.rest === 0 && !holding() && room.power && (!document.hidden || NOPAUSE) && (!shell || term.inShell()) && present();
      if (ready) return;
      if (performance.now() - due > 20000 && look.rest !== 0 && !holding()) lookTo(false);
      await wait(250);
    }
  }
  // the report's board lines (People's, never vigild's): the rank next to the honest numbers (Arnold, Q5: the rigging is
  // a clue), then the review count
  function boardReport(r) {
    const c = board.counts, m = board.merit, n = v => String(v).replace('-', '−');
    return [`board: ${ORD(board.rank())} of 6 · fixes ${c.fixes} · strikes ${c.strikes} · units down ${Math.round(r.downMin || 0)} min`,
      `merit ${n(m.total)} (work ${n(m.work)} · attendance ${m.attendance} · conduct ${n(m.conduct)})`,
      `shift review: top 3 nights running. you: ${review()} of 3`];
  }
  // ---- the turn (night 1, about 02:00; the proposal 2.1): the first time you pass dn into 3rd (most often it is opening
  // Glenn's 02:00 bag that does it). Sound off, no reading: both racks ripple up in the bright tone, with a soft cascade of
  // relays; then the receiver's flag ticks with each key typed upstairs, by a voice that isn't Glenn's: " AW ", "nice
  // work, 4"; then Glenn: "Ha! Third!". It waits until you're looking at the screen with nothing held. On a night played
  // again (vigil.seen) the room still ripples and aw still types, quickly; Glenn says nothing.
  async function turnBeat() {
    room.beat = true;
    await eyesOnScreen({ shell: true });                 // (at the shell: in a game its words landed under it; the story audit, 2026-10-06)
    const short = seen.has('turn'); seen.mark('turn');
    playtest(short ? 'the turn (seen: short)' : `the turn: ${ORD(board.rank())} of 6, aw`);
    boardSeen.rank = board.rank(); boardSeen.at = performance.now();
    rackRipple(); relayCascade();
    term.announce([{ text: `board: ${ORD(boardSeen.rank)} of 6.`, cls: 'dim' }]);
    await wait(short ? 500 : 1500);
    await glenn.voice('aw', 'nice work, 4', { fast: short });
    if (!short) { await wait(900); glenn.say(cold() ? "Third. Site 2's noticing, chief." : "Ha! Third! Even site 2's noticing, chief."); }
    room.beat = false;
  }
  function boardTick(now) {
    for (const u in clientTick) if (Math.random() < .02) clientTick[u]++;
    const dt = shift.t - boardT; boardT = shift.t;
    if (dt > 0 && !shift.over) board.tick(dt, room.power && !asleep && !account.loggingIn);
    if (account.loggingIn || shift.over || room.beat || asleep) return;
    // night 1's long stretch: nothing new for a minute, something comes
    const longStretch = shift.level === 1 && shift.t >= LONG.from && shift.t < LONG.to && !room.climaxed;
    if (longStretch && !shift.open().length && term.quietFor() > LONG.after && now - clientLineAt > LONG.after && term.inShell() && !room.talking && room.power && term.talkable()) {
      clientLineAt = now;
      if (longN++ % 3 === 2) glenn.say(LONG_GLENN[Math.floor(longN / 3 - 1) % LONG_GLENN.length]);
      else term.announce([{ text: `${shift.clock().slice(0, 5)}  ${CLIENT_LINES[clientLineN++ % CLIENT_LINES.length]}`, cls: 'dim' }]);
      playtest('long stretch: a line after a quiet minute');
      return;
    }
    // a client's line, once in a quiet while
    if (shift.level < 3 && !shift.open().length && now - clientLineAt > 180000 && term.idleFor() > 20000 && term.inShell() && !room.talking && room.power && shift.t > 30) {
      clientLineAt = now;
      term.announce([{ text: `${shift.clock().slice(0, 5)}  ${CLIENT_LINES[clientLineN++ % CLIENT_LINES.length]}`, cls: 'dim' }]);
    }
    if (shift.level !== 1) return;
    const r = board.rank();
    if (r === boardSeen.rank) return;
    if (r <= 3 && !room.turned) { room.turned = true; turnBeat(); return; }   // the first pass into 3rd: the turn
    if (now - boardSeen.at < 30000 || room.talking || !term.talkable()) return;
    boardSeen.rank = r; boardSeen.at = now;
    term.announce([{ text: `board: ${ORD(r)} of 6.`, cls: 'dim' }]);
    playtest(`board: ${ORD(r)} of 6 (merit ${board.merit.total})`);
    if (r === 5) glenn.once('fifth', 'Fifth! Told you it moves, chief.');
    if (r === 2 && !glenn.taught('second')) glenn.once('second', cold() ? 'Second. Only ek left, chief.' : 'Second, chief. Only ek left. I like our odds.');
  }
  function startShift() {
    playtest('night starts');
    try { logNewNight(); } catch (e) {}                // (not at the page's first night: the log isn't there yet, and the record is fresh)
    try { shiftNo = (+localStorage.getItem('vigil.shifts') || 0) + 1; localStorage.setItem('vigil.shifts', String(shiftNo)); } catch (e) { shiftNo++; }
    // the award slip left in the cheat sheet's drawer, once the file drawer is unlocked, is in your folder now: filed while
    // you were away by whoever labels these folders (as your initials are)
    if (awd.where === 'sheet' && file.unlocked && !awd.held) { awd.where = 'folder'; keepAward(); playtest('award slip: filed in your folder while you were away'); }
    if (typeof drawFile === 'function') setTimeout(() => { drawFile(); drawSheet(); });   // (a tab's initials may have been written in while you were away)
    for (const u in UNITS) unitLed(u, null);
    lastAlert.clear();
    // ?night=60 plays a whole night in 60 real seconds, for trying it out; ?level=2 plays the second night.
    // Which night you are on is kept (vigil.night): clocking out at the end of one moves you to the next, up to
    // the third; a lost night reloads the page into the same night again; a new operator starts at the first.
    const q = new URLSearchParams(location.search), night = +q.get('night');
    let kept = 1; try { kept = Math.min(3, Math.max(1, +localStorage.getItem('vigil.night') || 1)); } catch (e) {}
    const level = +q.get('level') || kept;
    // what the night before left you with (vigil.carry, saved at its 05:30; Arnold, 2026-10-06): the beans as they were, and
    // the energy, but never under 60%. None on a first night (or a fresh start, or a new name).
    let carry = null; try { carry = JSON.parse(localStorage.getItem('vigil.carry') || 'null'); } catch (e) {}
    shift = createShift({ units: Object.keys(UNITS), level, carry, ...(night > 0 ? { realMs: night * 1000 } : {}) });
    room.replay = seen.start(shift.level);              // (this night, played before: its seen beats play short)
    // the board starts from nothing every night (a lost night replays it as it was at 23:00)
    board = createBoard({ level: shift.level, you: initialsOf(account.name) || 'you' }); boardSeen.rank = 6; boardSeen.at = 0; boardT = 0;
    room.turned = false; room.cold = file.key !== 'none' || file.unlocked; room.coolUntil = 0; room.climaxed = false; room.pongProtected = 0; room.tomorrowRow = null; room.dipped = false;   // (the turn, 04:44's climax: once a night; Glenn's warmth, once the key is out, stays slipped: the story audit, 2026-10-06)
    // a night that starts mid-crisis (night 3): the LEDs already say so behind the login; the alerts come once you're in
    for (const e of shift.initial()) unitLed(e.unit, { DOWN: 'down', HOT: 'hot', STUCK: 'stuck', LOSS: 'loss' }[e.kind]);
    shiftT = performance.now();
    // a new night starts with only what the night hands over: Pong in the drawer, the rest found again
    tray.carts = shift.startsWith.filter(l => l !== room.cart).map(label => ({ slot: CARTS[label].slot, label, lift: 0 })); drawDrawer();
    window.__dlv?.reset();
    tileNight();                                       // the ceiling tile: out of place on night 2 until its key is taken
    if (room.cart && room.cart !== 'PONG') { shift.find(room.cart); shift.handOver(room.cart); }   // one still in the slot stays yours
    eyeStrain();
    if (room.coffee < 1) setCoffee(1);                 // a new night starts with a full mug
    room.defragTaught = false;                         // and the night's first DEFRAG teaches
    room.pongHaunted = false;                          // and the night's first Pong isn't only yours
    inbox.reset();                                     // the welcome, and the night's mail to come
    room.tty2Done = false; woke = false;               // tty2, and 04:44
    tty2.open = tty2.closed = null;
    room.darkNoticed = false;                          // Glenn notices the monitor going dark, once a night
    room.routeTaught = false; room.routeWon = false; room.stepsDone = false;   // the night's first ROUTE teaches; 23 answers once it is won
    ghostAt = 75 + Math.random() * 45; ghostDone = false;   // the key that presses itself: 00:15 to 01:00
  }
  startShift();

  // the hand-over: a cartridge the night gives you is put in the drawer, to be taken. The one place it happens: whatever
  // the hand-over comes to look like (straps in the case, being drawn now), shift.handOver goes where the cartridge is free
  // to take, since its first trouble follows it (night 1's lessons in shift.js: STUCK or LOSS ten shift minutes on).
  function handOver(cart) {
    if (!tray.carts.some(c => c.label === cart) && room.cart !== cart) { tray.carts.push({ slot: CARTS[cart].slot, label: cart, lift: 0 }); drawDrawer(); }
    shift.handOver(cart);
  }
  // what the racks do, shown in the room: the LED, the log, and an alert above whatever is being typed
  function showEvent(e, quiet = false) {
    if (e.type === 'incident') {
      unitLed(e.unit, { DOWN: 'down', HOT: 'hot', STUCK: 'stuck', LOSS: 'loss' }[e.kind]);
      // (the alert keeps the unit and names its client: design.md section 5, the clients)
      const text = e.kind === 'LOSS' ? `${e.unit} dropping packets (${12 + rnd(20)}% loss)`
        : e.kind === 'DOWN' ? `${e.unit} not responding (${clientName(e.unit)})`
        : e.kind === 'HOT' ? `${e.unit} at ${74 + rnd(7)}C, throttling (${clientName(e.unit)})`
        : `${e.unit} stuck: fragmented, jobs piling up (${clientName(e.unit)})`;
      quiet ? logLine('vigild[412]: ' + text) : raiseAlert(text, e.unit);
      // night 1: the first trouble at a closed client's unit, and Glenn waves the wrong note away in its own words
      // (design.md section 5, the clients); small talk, so not once his warmth has slipped
      const svc = CLIENTS[e.unit]?.[3];
      if (svc && shift.level === 1 && !cold() && !quiet) glenn.once('closed-client', `Don't ask me who needs ${svc} at this hour, chief. The client pays, we watch.`);
    } else if (e.type === 'escalate') {
      unitLed(e.unit, 'down');
      quiet ? logLine(`vigild[412]: ${e.unit} overheated and shut down`) : raiseAlert(`${e.unit} overheated and shut down`, e.unit);
    } else if (e.type === 'strike') {
      board.strike();
      glenn.broke('fix:' + e.unit);                    // (his order to fix it, if he gave one, refused: the strike says so)
      // the night supervisor, who is watching the same racks from somewhere else
      glenn.urgent(e.n === 1 ? `${e.unit} has been down ${e.min} minutes, chief. That's one. No big deal. Everybody gets one.`
        : e.n === 2 ? `${e.unit}. ${e.min} minutes. That's two, chief. Let's not make it three.`
        : `${e.unit}. That's three, chief. I'm sorry. Be a pal and go on home.`);
      beep(294, .14, .035); setTimeout(() => beep(220, .2, .035), 170);   // lower and slower than an alert
    } else if (e.type === 'delivery') {
      window.__dlv?.arrive({ why: e.why, kind: e.kind, n: e.n });
    } else if (e.type === 'relieved' || e.type === 'dawn') {
      endOfNight(e.report);
    } else if (e.type === 'found') {
      // the next cartridge turns up, announced by Vigil: after a first win on the one before (the fast path), or a
      // quiet stretch or a timer (the slow path, which says so). As mail, never onto the screen mid-typing.
      handOver(e.cart);
      const n = NOTES[e.cart], why = n[e.how] || n.calm;
      inbox.add({ from: 'Vigil Systems', addr: 'tools@site4.vigil', subject: `Maintenance tools unlocked: ${e.cart}`,
        body: () => [why, ...n.body, '', { text: 'Vigil Systems. Someone is always awake.', cls: 'dim' }] });
    }
  }
  setInterval(() => {
    const now = performance.now(), dt = now - shiftT; shiftT = now;
    if (room.melting || asleep || account.loggingIn) return;   // the room is busy dying, you are out, or not in yet
    for (const e of shift.tick(dt)) showEvent(e);
    inbox.tick(shift.t);
    boardTick(now);
    // the ceiling's safety net (night 2): late, once, if the key is still up there, something shifts on the tile. No text.
    if (shift.level === 2 && (tile.state === 'out' || tile.state === 'glint') && !tile.slid && shift.t >= 310 && !shift.over) { tile.slid = true; playtest('ceiling: the slide (the key still up there)'); mdSound('ceiling-slide'); setTimeout(() => grit(5), 350); }
    // night 2, about 02:10: the heavy steps, and the tile jolted out (once a night; not if your hand has moved it already)
    if (shift.level === 2 && !room.stepsDone && shift.t >= 190 && shift.t < 300 && !shift.over && !room.beat && !room.talking) { room.stepsDone = true; heavySteps(); }
    // night 1, 03:00: IT's "brief interruption" (the night's mail): the hum dips for a beat, nothing else (sets up night 3)
    if (shift.level === 1 && !room.dipped && shift.t >= 240 && shift.t < 250) { room.dipped = true; room.dip = true; hum.update(.05); setTimeout(() => { room.dip = false; hum.update(.3); }, 700); }
    // night 1, the first quiet after 01:00, before tty2: Glenn, a man with a home (approved 2026-10-02; placed by the plan)
    if (shift.level === 1 && !cold() && shift.t >= 120 && shift.t < 150 && !shift.open().length && !room.talking && term.inShell() && !glenn.taught('wife')) glenn.once('wife', "The wife's been on at me about these hours.");
    // the second login, about 01:30, when nobody is talking
    if (!room.tty2Done && shift.t >= 150 && shift.t < 300 && !room.talking && !borrowedVoice && present()) { room.tty2Done = true; tty2Session(); }
    // 04:44 (344 shift minutes in), at the shell, looking at the screen; if you are busy, as soon as you're not
    // (night 1: the climax, which waits for your eyes itself and brings the view up after 20 s; ?nopause counts a hidden pane)
    if (!woke && shift.t >= 344 && shift.t < 380 && shift.level === 1) { if (!room.beat) { woke = true; climax0444(); } }
    else if (!woke && shift.t >= 344 && shift.t < 380 && term.inShell() && look.rest === 0 && !holding() && (!document.hidden || NOPAUSE) && present()) { woke = true; wakeUp(); }   // (not over a held paper: the story audit, 2026-10-06)
    // the first dip in energy: the company line, then coffee (one moment, not two: the coffee line used to come at 45%)
    if (shift.energy < .5 && glenn.once('coffee', 'Stay sharp, chief. Operators found asleep get reassigned. Company policy!', "You're fading on me. Be a pal and have some coffee. Give the mug a click.")) glenn.order('coffee', 'be a pal and have some coffee');
    // once on night 1 (and its replays), while you sit looking at an empty prompt, the M key goes down by itself (the story
    // audit, 2026-10-06: it pressed itself every night)
    if (!ghostDone && shift.level === 1 && !shift.over && shift.t >= ghostAt && look.rest === 0 && !document.hidden && term.idleFor() > 5000 && term.lineEmpty() && present()) { ghostDone = true; ghostKey('m'); }
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
      const level = u === null || muted || room.still ? 0 : (.0042 - .0018 * u) * (room.talking || borrowedVoice ? .5 : 1);
      F.g.gain.setTargetAtTime(level, t, room.still ? .05 : 1.2);   // fans take a moment to spin up, and to run down (at 04:44 they stop dead)
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
          glenn.urgent(line); glenn.order('fix:' + o.unit, line);
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
    beans: (n = 1) => giveBeans(n, 'dev'),           // beans in, with the chirp
    // the login note posed by hand (its peel in radians, its drop in camera units), for checking its motion; note() puts it back
    note: (peel, drop) => { noteG.style.display = ''; return placeNote(peel || 0, drop || 0); },
    // a delivery now: kind beans | note | empty | aw; why streak | bag (and n, the night's first or second streak) gives
    // it the slip that canister carries on this night (design.md, "The slips carry story"); the streak so far
    delivery: (kind = 'beans', why = 'dev', n) => kind === 'aw' ? window.__dlv.aw() : window.__dlv.arrive({ why, kind, n }),
    get streak() { return shift.streak; },
    chirp: () => beanChirp(),
    file: { unlock: () => { file.unlocked = true; file.key = 'lock'; keepFile(); drawFile(); }, keyToDesk: () => { file.key = 'desk'; keepFile(); drawDeskKey(); }, keyFromPong: () => keyFromPong(), fileIt: () => { file.filed = true; file.filedShift = shiftNo; keepFile(); drawFile(); }, nextShift: () => { shiftNo++; drawFile(); },
      reset: () => { Object.assign(file, { unlocked: false, filed: false, clicks: 0, travel: 0, open: false, key: 'none', turn: 1 }); keepFile(); drawFile(); drawDeskKey(); }, get state() { return { ...file }; } },
    look: rest => lookAt(rest),
    screen: n => term.screen(n),
    get board() { return board; },                    // the night's board: dev.board.rows(), .rank(), .merit
    turn: () => turnBeat(), ripple: () => { rackRipple(); relayCascade(); },   // night 1's turn, again; the ripple alone
    // the award slip put somewhere ('monitor', 'sheet', 'folder', or null), as if it had been; award: where it is now
    award: (where, date = new Date(Date.now() + 864e5).toDateString()) => { if (where !== undefined) { Object.assign(awd, { where, date, to: account.name || account.user, taped: !!where }); keepAward(); drawAwardOn(); drawFile(); drawSheet(); } return { ...awd }; },
    steps: () => heavySteps(), grit: n => grit(n),   // night 2's heavy steps over you (the tile jolted out), and grit alone
    climax: () => climax0444(), still: on => roomStill(on),   // night 1's 04:44, now; the room stopped, or not                      // the tube's last lines, as text
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
    // 05:30 (design.md section 5, night 1's aftermath): the standing orders pay out (see it through; the file drawer left
    // alone all night; night 2's ceiling, the key not taken) and the rest close with the night; on nights 1 and 2 the
    // company puts you first (the board is fixed now, your night goes on the board's nights before and the review count
    // moves); and the next night is saved, with the energy and beans it starts from (the story audit, 2026-10-06: saved only
    // at 05:43, a tab closed after 05:30 replayed the night; every save is made once the thing has happened)
    glenn.complied('seeit'); glenn.complied('file'); glenn.complied('ceiling');
    glenn.closeOrders();
    const top = shift.level <= 2;
    if (top) {
      board.finalize();
      const row = { date: new Date().toDateString().slice(4, 10), op: initialsOf(account.name) || 'you', merit: board.merit.total };
      try {
        localStorage.setItem('vigil.boardNights', JSON.stringify([row, ...boardNights()].slice(0, 12)));
        localStorage.setItem('vigil.review', String(shift.level));
      } catch (e) {}
    }
    try {
      localStorage.setItem('vigil.night', String(Math.min(3, shift.level + 1)));
      localStorage.setItem('vigil.carry', JSON.stringify({ energy: +shift.energy.toFixed(3), beans: shift.beans }));
    } catch (e) {}
    // at the shell with the screen on: a game in progress finishes first, a beat still playing (04:44) finishes, and a dark
    // screen waits for you
    while (room.beat || !(room.power && term.inShell())) await wait(500);
    if (top) {
      await eyesOnScreen();
      playtest(`board: first at 05:30 (merit ${board.merit.total})`);
      rackRipple(); relayCascade();
      term.announce([{ text: 'board: 1st of 6.', cls: 'dim' }]);
      await wait(900);
    }
    term.announce([...lines, ...(top ? boardReport(shift.report()) : [])].map(t => ({ text: t, cls: 'dim' })));
    const shown = performance.now();
    await wait(1500);
    await glenn.say(shift.level !== 1 ? "That's the night, chief! Day shift's on their way. Nice work."
      : cold() ? "That's the night, chief. Top of the board. Day shift's on their way."
      : "That's the night, chief! Top of the board, first time out. Day shift's on their way.");
    // nobody comes (shift minutes: 390 is 05:30). Timed from the report too (the story audit, 2026-10-06: it showed for
    // about 30 s before the boot cleared it): each handover line no sooner than 14, 26 and 38 real seconds after it, and the
    // knob no sooner than 50
    for (const [t, after, text] of [[394, 14000, 'handover: waiting for the day shift.'], [397, 26000, 'handover: waiting.'], [400, 38000, 'handover: day shift not on site.']]) {
      while (shift.t < t || performance.now() - shown < after) await wait(250);
      logLine('vigild[412]: ' + text);
      term.announce([{ text: `${shift.clock().slice(0, 5)}  ${text}`, cls: 'dim' }]);
    }
    while (shift.t < 403 || performance.now() - shown < 50000) await wait(250);
    // what you hold you put down first: it is still where you put it at 23:00 (every night: a held slip used to vanish)
    while (holding() || awd.busy || dlv.busy) await wait(250);
    // the knob turns itself off (if you have turned it off already, it stays off)
    await turnItself(false);
    const blink = shift.level === 1;
    await wait(blink ? 2000 : 2600);
    // night 1: the blink (design.md section 5; the proposal 2.3): the room is not drawn for a beat, black; it comes back on
    // the next night, 23:00, the mug full and steaming
    if (blink) { document.body.classList.add('blink'); playtest('the blink'); }
    clockHeld = true;                                  // (the clock readout keeps its last minute in the dark)
    account.loggingIn = true;                          // the clock waits for the login
    asleep = false;
    startShift(); updateVitals(); glenn.newNight();
    if (blink) { await wait(800); document.body.classList.remove('blink'); await wait(600); }
    logLine(`vigild[1]: operator ${account.user} clocked in, 0 minutes later`);
    term.clear();
    // and back on by itself (turned on by hand in the dark, it just boots a moment sooner)
    await turnItself(true);
    clockHeld = false; drawClock(true);                // 23:00, with the screen
    await term.boot(['Last shift ended ....... 05:30, 0 minutes ago'], firstAlert);
    clockedIn();
  }
  // Night 3 starts mid-crisis, and the room is failing before you have sat down: its first alert always prints
  // between the login and the welcome (nights 1 and 2: the welcome and the mail first, always). The rest after.
  async function firstAlert() { const [e] = shift.initial(); if (e) { showEvent(e); await wait(700); } }
  function clockedIn() {
    for (const e of shift.initial().slice(1)) showEvent(e);
    window.__dlv?.afterLogin();
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
    if (r.reason === 'asleep') glenn.broke('seeit');   // (the standing order: you didn't see it through)
    document.getElementById('no-report-text').textContent = [...lines, ...(shift.level === 1 ? boardReport(r) : [])].join('\n');
    const what = $('no-what'), choices = $('no-choices'), yet = $('no-yet');
    setTimeout(async () => {
      nightOver.hidden = false; requestAnimationFrame(() => nightOver.classList.add('shown'));
      // Asleep with the racks still running (design.md: sleep is the exit, but not while the racks run): before
      // anything else, one line on the black screen. It appears the way Vigil's lines do, whole and without a sound
      // (Arnold, 2026-10-04: no longer typed on the previous operator's switch; whose line it is, is never settled).
      // Every lost night by sleep, until the finale, where the racks go dark and sleep means something else.
      if (r.reason === 'asleep') {
        // (seen before, on any night: the line comes sooner and goes sooner, 3.2 s before the choices instead of 6.5)
        const short = seen.has('notyet', '*'); seen.mark('notyet', '*');
        what.hidden = choices.hidden = true; yet.hidden = false; yet.textContent = '';
        await wait(short ? 800 : 1600);
        yet.textContent = 'not yet.';
        await wait(short ? 1800 : 3600);
        yet.classList.add('gone');
        await wait(short ? 600 : 1300);
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
  // Every way beans come in goes through here (a delivery, Glenn's 02:00 bag, anything later): the count goes up, the
  // tube chirps, and the count in the status line blinks once with it.
  let beansLitUntil = 0;
  function giveBeans(n = 1, why = '') {
    shift.addBeans(n);
    playtest(`beans +${n}${why ? ' (' + why + ')' : ''}: ${shift.beans}`);
    beanChirp();
    beansLitUntil = performance.now() + 260; updateVitals();
    setTimeout(updateVitals, 280);
  }
  // Energy as a system you can see (Arnold, 2026-10-05): every time it moves, the bar shows it, a short spurt over the
  // part of the bar that moved, sized to the amount: green when it comes in (a sip, a won game, a refund), red when it
  // is spent (a fix, a game, a loss). The slow drain shows as small red spurts too, every 1%, while problems are open or
  // a game is running (a game spends its cost as it runs: shift.js CART.play), and stays quiet otherwise.
  const SPURT = { ms: 700, jump: .004, drip: .01 }, spurts = [];
  let lastEnergy = null, dripAcc = 0, spurtTimer = 0;
  function trackEnergy(e) {
    const now = performance.now();
    if (lastEnergy !== null) {
      const d = e - lastEnergy;
      if (Math.abs(d) >= SPURT.jump) { spurts.push({ a: lastEnergy, b: e, t0: now }); dripAcc = 0; }
      else if (d < 0 && (shift.open().length || shift.playing)) {
        dripAcc -= d;
        if (dripAcc >= SPURT.drip) { spurts.push({ a: e + dripAcc, b: e, t0: now }); dripAcc = 0; }
      } else if (!shift.open().length && !shift.playing) dripAcc = 0;
    }
    lastEnergy = e;
    while (spurts.length && now - spurts[0].t0 > SPURT.ms) spurts.shift();
    // while one is showing, the line is redrawn every frame or so, until the last has faded
    if (spurts.length && !spurtTimer) spurtTimer = setInterval(() => { if (!spurts.length) { clearInterval(spurtTimer); spurtTimer = 0; } updateVitals(); }, 40);
    return spurts.map(s => ({ a: s.a, b: s.b, age: (now - s.t0) / SPURT.ms }));
  }
  function updateVitals() {
    const e = shift.energy;
    if (PLAYTEST && Math.floor(e * 10) !== energyTenth) { energyTenth = Math.floor(e * 10); playtest(`energy below ${(energyTenth + 1) * 10}%`); }
    const sp = trackEnergy(e);
    // (the shift starts before the terminal exists; the first status is drawn once it does, below)
    try { term.setStatus({ energy: e, beans: shift.beans, low: e < .3, strikes: shift.strikes, mail: account.loggingIn ? null : { unread: term.mailUnread() }, problems: account.loggingIn || !shift ? null : shift.open().map(o => ({ unit: o.unit, kind: o.kind, fixing: o.fixing })), beansLit: performance.now() < beansLitUntil, spurts: sp }); } catch (err) { return; }
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
  let kept = [];
  const RECORD = 3000;                                 // lines of the record kept (it was 600: three nights' worth and more now)
  function keep(l) { kept.push(l); try { localStorage.setItem('vigil.record', JSON.stringify([...pastLog, ...kept].slice(-RECORD))); } catch (e) {} }
  // a new night (startShift): the night before's kept lines go into the record read at the top of vigild.log, and the live
  // log starts again (the story audit, 2026-10-06: nights don't reload the page, so in one sitting the record stayed as it
  // was at the page's load and the night's lines fell out of the 300-line buffer: night 3's grep began late in night 2)
  function logNewNight() {
    pastLog = [...pastLog, ...kept].slice(-RECORD); kept = [];
    logLines.length = 0;
  }
  function logLine(text, noise = false) {
    const l = `${stamp()} ${text}`;
    if (!noise) playtest('log  ' + text);
    if (KEEP.test(text)) keep(l);
    // the board's conduct is the compliance log (design.md section 5: layer 1): obeyed +50, a canister opened +50, refused -40
    const cmp = text.match(/operator compliance: (yes|no) ((.*))/);
    if (cmp && board) cmp[1] === 'no' ? board.refused() : cmp[2] === 'delivery opened' ? board.canister() : board.obeyed();
    logLines.push(l); if (logLines.length > 300) logLines.shift();
    logListeners.forEach(fn => fn(l));
    // night 3: Vigil stops hiding the compliance lines (Arnold, 2026-10-04). Each prints dim on the tube as it is
    // logged, so the pattern shows itself to a player who never got into m's account (m's history has the grep).
    const said = text.match(/operator compliance: .*/);
    if (said && shift?.level === 3) term.announce([{ text: `${shift.clock().slice(0, 5)}  ${said[0]}`, cls: 'dim' }]);
    return l;
  }
  function randomLog() {
    const t = LOG_TEMPLATES[rnd(LOG_TEMPLATES.length)];
    // (never unit 23: it is in no rack, and only answers a ping once ROUTE is won)
    return t.replace('{id}', 'j' + (1000 + rnd(9000))).replace('{r}', Math.random() < .5 ? 'left' : 'right')
      .replace('{u}', (n => n >= 23 ? n + 1 : n)(1 + rnd(48))).replace('{ms}', 120 + rnd(4000)).replace('{t}', 31 + rnd(14))
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
    // a game frozen with the room (04:44, the story audit, 2026-10-06): since when (0: not frozen); what the running game
    // shifts its clocks by when it goes on; and a line typed over the game's top line while it is frozen
    let frozen = 0, onThaw = null, overTop = null;
    let field = null;            // with a frame: a square grid drawn over it (crt.js drawField), for snake
    let stopProc = null;         // ends the running proc/game
    let gameKey = null;          // key handler while a game runs
    let hist = [], histIdx = -1, histDraft = '';
    let cwd = '~', lastTyped = 0, locked = false;
    // su m (design.md, "M.'s password"): while it is set, the shell is m's: m's prompt (the one burned into the tube), m's
    // mail, m's history (and the arrow keys walk it); logout returns to you. Not kept: a reload is you again.
    let su = null, suTry = null;
    const prompt = () => `${su ? su.user : account.user}@vigil:${cwd}$ `;
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
    // when anything new last showed on the tube (a line, or a line being typed in): the quiet before 04:44 counts from it
    let lastNew = performance.now(), lastSeen = '';
    function render() {
      { const k = lines.length + '|' + (lines[lines.length - 1]?.text || ''); if (k !== lastSeen) { lastSeen = k; lastNew = performance.now(); } }
      let rows, cursor = null;
      if (frame) rows = frame.map(runsOf);                          // full-screen programs draw fixed frames
      else {
        const all = [];
        for (const l of lines.slice(-MAX)) all.push(...wrap(runsOf(l)));
        if (mode === 'shell') all.push(...wrap([{ text: prompt() + line }]));
        else if (mode === 'login') all.push(...wrap([{ text: LOGIN + line }]));
        else if (mode === 'password') all.push(...wrap([{ text: 'Password: ' }]));   // (typed without echo)
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
      // the menu (tubeMenu): a box laid over whatever the tube shows, its own cells replacing those under it; the game's
      // grid (ROUTE's) is left out while it is up, and there is no cursor
      if (frame && overTop !== null) { rows = rows.slice(); rows[0] = runsOf(overTop); }
      if (menuBox) { rows = boxOver(rows, menuBox.map(runsOf)); cursor = null; }
      crt.paint({ rows, cursor, cursorOn, status, field: frame && !menuBox ? field : null,
        burn: piece(3) ? clamp((.35 - room.brightness) / .35, 0, 1) : 0, burnText: 'm@vigil:~$' });
      termOut.textContent = rows.map(r => r.map(x => x.text).join('')).join('\n');   // for screen readers
    }
    // the menu's box over the rows: centred across, and a little above the middle
    let menuBox = null;
    function boxOver(rows, box) {
      const BW = lenOf(box[0]), c0 = Math.max(0, Math.floor((crt.COLS - BW) / 2)), r0 = Math.max(0, Math.floor((crt.ROWS - box.length) / 2) - 1);
      const out = rows.slice(); while (out.length < r0 + box.length) out.push([]);
      const cells = row => { const c = []; for (const r of row) for (const ch of r.text) c.push({ ch, cls: r.cls }); return c; };
      const runs = c => { const row = []; for (const { ch, cls } of c) { const p = row[row.length - 1]; if (p && p.cls === cls) p.text += ch; else row.push({ text: ch, cls }); } return row; };
      box.forEach((b, i) => {
        const c = cells(out[r0 + i] || []); while (c.length < c0) c.push({ ch: ' ' });
        c.splice(c0, BW, ...cells(b));
        out[r0 + i] = runs(c);
      });
      return out;
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
    // A click on it opens the mail from wherever the tube is, as typing mail would (Eugene's second playtest, 2026-10-05:
    // it answered only at a bare prompt, though it is drawn on every screen): a view that q closes (top, tail -f, the
    // matrix) closes first; a command still running (a reboot, a ping) finishes first, the mail queued behind it as if
    // typed; inside a cartridge game or the inbox it does nothing. The click is taken at the page, by where it lands, so
    // it never depends on which element the browser says was clicked under the tube's 3D mapping.
    const envelopeOpens = () => mode === 'shell' || mode === 'proc';
    termCanvas.addEventListener('mousemove', e => { termCanvas.style.cursor = onEnvelope(e) && envelopeOpens() ? 'pointer' : ''; });
    addEventListener('pointerdown', e => {
      if (e.button || !crt.mailHit() || !onEnvelope(e) || !envelopeOpens()) return;
      if (document.querySelector('#night-over:not([hidden])') || window.vigilTime?.paused) return;
      e.preventDefault(); e.stopPropagation();
      playtest('mail: the envelope clicked (' + mode + ')');
      if (mode === 'proc' && stopProc) { stopProc(); }
      if (mode === 'shell') { lines.push({ text: prompt() + 'mail' }); line = ''; runMailPicker(su ? M_BOX : inbox); return; }   // (as m, m's)
      // busy: as if typed now, run once it is free
      for (const k of ['ClearLine', 'm', 'a', 'i', 'l', 'Enter']) pending.push(k);
      drain();
    }, true);
    function print(text = '', cls) { lines.push({ text, cls }); if (lines.length > MAX) lines.shift(); scrollBack = 0; render(); }
    function setMode(m) { mode = m; if (m === 'shell') { frame = null; field = null; drain(); } render(); }
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
        "  won't stay fixed    a cartridge from the drawer.",
        // (a rack dropping packets: what it means and what fixes it; Eugene's round 2, #11; approved 2026-10-07)
        { text: 'a rack dropping packets is losing traffic.', cls: 'dim' },
        '  the ROUTE cartridge fixes it: route <rack>',
        '  rack-left           L10 L14 L20 L27 L33 L41 L47',
        '  rack-right          R10 R17 R29 R47',
        { text: "status: what's open.  top: every unit.", cls: 'dim' },
      ],
      // the operator handbook (design.md section 5, the world; the story audit, 2026-10-06, fix 20: layer 1 needs the company's
      // own words behind "conduct"). Eight short pages; the lines the proposal decided, and Arnold's for the ladder (2026-10-06);
      // the rest are drafts for him. Reading one holds the energy, as the mail does (cat, below).
      handbook: Object.fromEntries([
        ['1-the-job', 'the job', ['Vigil Systems sells one promise: Someone is always awake.', 'Our clients pay for a human watching every second, from 23:00 until the day shift arrives at 05:30.', 'You are that human.']],
        ['2-the-ladder', 'the ladder', ['Operator. Senior operator. Shift lead. Supervisor.', 'Operators and senior operators keep the night chair at their site.', 'Shift leads and supervisors for every site work upstairs, on Level 2.']],
        ['3-the-board', 'the board', ["The six sites' night operators are ranked on the board, live, by merit.", 'Merit is earned by the work.', 'Ties go to the longer service.', 'Top of the board three nights running brings a shift review: the third night is the review.']],
        ['4-the-review', 'the review', ['A shift review is a night like any other.', "Placement is at the company's discretion."]],
        ['5-attendance', 'attendance', ['The night operator attends the console from 23:00 until relieved by the day shift.', 'Operators found asleep are reassigned.', 'An operator who leaves the console unattended is reassigned.']],
        ['6-conduct', 'conduct', ["Your supervisor's requests are part of the work.", 'Do not touch the breaker panel.', 'The internal post is for supplies and notices.']],
        ['7-leave', 'leave', ['Requests for leave go to Operator Care.', "Your request for leave will be received. We'll be in touch at the end of your shift."]],
        ['8-words', 'words', ['merit ........ what the board counts.', 'conduct ...... how the work is done.', 'reassigned ... no longer at this console.']],
      ].map(([f, title, body], i) => [f, [{ html: `OPERATOR HANDBOOK  <span class="dim">${i + 1} of 8 · ${title}</span>` }, '', ...body, '', { text: 'Vigil Systems. Someone is always awake.', cls: 'dim' }]])),
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
    // M.'s old shell history, left in the home directory, hidden (ls -a). The only trace of doing several units in
    // one line (Arnold, 2026-10-04): batch fixing is never advertised; it sits here among old commands from 2019.
    FS['.history'] = [
      '2019-03-29 23:02  status', '2019-03-29 23:41  reboot L20', '2019-03-30 01:17  status', '2019-03-30 01:18  cat runbook',
      '2019-03-31 02:52  reboot L20 L47 L33', '2019-03-31 02:53  status', '2019-03-31 03:20  reroute R17', '2019-04-01 23:06  top',
      '2019-04-01 23:07  status'];
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
        ['board', 'how the six sites stand tonight'],
        ['reboot <unit>', 'restart a unit'],
        ['reroute <unit>', "move a unit's load elsewhere"],
        ['ping <unit>', 'see whether a unit answers'],
        ['cat runbook', 'which fix is for which trouble'],
        ['coffee', 'how much is left, and the beans'],
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
    // defrag and route typed without their cartridge in: as pong's, a hint; where the cartridge is, once it has turned up
    function cartHint(cmd, label) {
      const found = shift.found(label);
      return [room.cart ? `${cmd}: not on this cartridge.` : `${cmd}: no such program.`,
        { text: found ? `(it runs from the ${label} cartridge, in the desk drawer.)` : '(it runs from a maintenance cartridge. none has turned up yet.)', cls: 'dim' }];
    }
    const COMMANDS = {
      // one help, everything in it (Arnold: one is all a player needs). It is longer than the tube, so the job
      // comes last, where it stays on screen above the prompt; the wheel scrolls back to the rest.
      help: () => [...helpList('shell'), { text: 'keys: up/down history   tab completes', cls: 'dim' }, { text: '      ctrl+backspace deletes a word, ctrl+u the line', cls: 'dim' }, { text: '      esc pauses', cls: 'dim' },
        '', ...helpList('room'), '', ...helpList('job'), { text: '(scroll up over the screen for the rest)', cls: 'dim' }],
      status: args => {
        glenn.complied('status');
        const open = shift.open();
        if (args[0]) {
          const n = args[0].toUpperCase(), r = args[0].toLowerCase();
          const o = open.find(x => x.unit === n || x.unit === r);
          if (!UNITS[n] && !RACK_LEDS[r]) return [`status: ${args[0]}: no such unit   units: ${Object.keys(UNITS).join(' ')}`];
          if (!o) return UNITS[n] ? [{ text: `${n}  ok   answering`, cls: 'ok' }, { text: `     ${CLIENTS[n][0]}`, cls: 'dim' }] : [{ text: `${r}  ok   the whole rack, answering`, cls: 'ok' }];
          const what = o.fixing ? 'being seen to' : { DOWN: 'not responding', HOT: 'running hot', STUCK: 'fragmented: jobs piling up', LOSS: 'dropping packets' }[o.kind];
          return [{ html: `${o.unit.padEnd(4)} <span class="${PROBLEM_CLS[o.kind]}">${o.fixing ? 'FIXING' : o.kind}</span>  ${esc(what)}, ${Math.round(o.forMin)} min` }, { text: `     ${CLIENTS[o.unit] ? CLIENTS[o.unit][0] : unitName(o.unit)}`, cls: 'dim' }];
        }
        return [
          `${shift.clock()}  on shift ${hm(shift.t)}  strikes ${shift.strikes ? `${shift.strikes} of ${shift.STRIKE.max}` : 'none'}`,
          ...(open.length ? open.map(o => `${o.unit.padEnd(4)} ${(o.fixing ? 'FIXING' : o.kind).padEnd(7)}${String(Math.round(o.forMin)).padStart(3)} min   ${clientShort(o.unit)}`)
            : [{ text: 'all units nominal', cls: 'ok' }]),
          `coffee .......... ${coffeeWord()} (${Math.round(room.coffee * 100)}%)`,
        ];
      },
      reboot: args => args.length > 1 ? fixMany('reboot', args) : fixUnit('reboot', args[0]),
      reroute: args => args.length > 1 ? fixMany('reroute', args) : fixUnit('reroute', args[0]),
      shift: () => [shift.over ? `it is ${shift.clock()}. the shift ended at 05:30. the day shift is not here yet.` : `the shift runs until 05:30. it is ${shift.clock()}.`],
      coffee: () => [(room.coffee > 0 ? `coffee: ${coffeeWord()}, ${Math.round(room.coffee * 100)}% left. click the mug.` : shift.beans > 0 ? 'coffee: none. try brew.' : 'coffee: none.') + ` ${shift.beans} bean${shift.beans === 1 ? '' : 's'} left.`],
      brew: () => {
        if (room.coffee >= 1) return ['the mug is already full.'];
        if (!shift.useBean()) return ['no beans left. supplies come down the tube.'];   // (not "the last pot": beans do come; the story audit, 2026-10-06)
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
          rows.unshift(`${u}tty1     ${t.toDateString().slice(0, 10)} 23:00   still logged in`);   // (tty1, your seat: on tty2, upstairs', it foretold an accept; the story audit, 2026-10-06)
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
        // a handbook page: reading it holds the energy, as the mail does, until the next command (or 40 real seconds)
        if (Object.values(FS.handbook).includes(node)) { playtest('handbook: ' + args[0]); shift.hold('handbook', true); clearTimeout(handbookHold); handbookHold = setTimeout(() => shift.hold('handbook', false), 40000); }
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
        print('(q or backspace: stop)', 'dim');
        readFile(node).slice(-6).forEach(l => print(l, 'dim'));
        mode = 'proc';
        const fn = l => { print(l, 'dim'); ledBurst(5); };
        logListeners.add(fn);
        stopProc = () => { logListeners.delete(fn); print('^C'); setMode('shell'); };
        return [];
      },
      top: () => { runTop(); return []; },
      board: () => { playtest(`board (${ORD(board.rank())} of 6)`); runBoard(); return []; },
      history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`),   // (as m, m's: hist is m's while su is on)
      clear: () => { lines = []; return []; },
      echo: (args) => [args.join(' ')],
      who: () => {
        const d = new Date().toDateString().slice(4, 10), me = { text: `${account.user.padEnd(10)} tty1   ${d} 23:00` };
        // the second session, while it is open: no name on it
        return tty2.open && !tty2.closed ? [me, { text: `${''.padEnd(10)} tty2   ${d} ${tty2.open}` }] : [me];
      },
      // the kernel's ring buffer: where the 04:44 replay is written down, and nowhere else (no source: tty2 has no session
      // open at 04:44, and Vigil never lies; the story audit, 2026-10-06)
      dmesg: () => [
        '[    0.000000] Linux version 2.4.20-vigil (root@site4) (gcc version 2.95.3)',
        '[    0.000000] Kernel command line: ro root=/dev/hda1 console=tty1',
        '[    1.204411] hda: VIGIL VS-04, ATA DISK drive',
        '[    2.881030] tty1: console registered',
        '[    2.881214] tty2: console registered',
        '[    3.402117] vigild: watchdog armed, 1 operator',
        ...(room.replayedAt ? [`[${(20640 + Math.round(shift.t * 60)).toString().padStart(5)}.000000] tty1: input replayed, no source (${room.replayedAt})`] : []),
      ],
      whoami: () => su ? [su.user] : [account.user, { text: "(to go by another name: name <new name>)", cls: 'dim' }],
      su: (args) => runSu(args.filter(a => a !== '-' && a !== '-l')[0] || 'root'),
      name: (args) => {
        const n = args.join(' ').trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 24);
        if (!n) return [account.name, { text: 'usage: name <new name>', cls: 'dim' }];
        account.name = n; account.user = userOf(n);
        try { localStorage.setItem('vigil.operator', n); } catch (e) {}
        return [`you are ${n} now.`];
      },
      mail: (args) => su ? (runMailPicker(M_BOX), []) : inbox.command(args) || (runMailPicker(), []),
      logout: () => { if (su) { suEnd(); return []; } setTimeout(() => logout(), 300); return ['logout']; },
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
      // (without their cartridge, a hint as pong gives one: the simulation report, 2026-10-06, item 10; draft words)
      defrag: (args) => {
        if (room.cart !== 'DEFRAG') return cartHint('defrag', 'DEFRAG');
        const u = (args[0] || '').toUpperCase();
        if (!UNITS[u]) return [`usage: defrag <unit>   (see cart/README)`];
        return runDefrag(u);
      },
      route: (args) => {
        if (room.cart !== 'ROUTE') return cartHint('route', 'ROUTE');
        const r = (args[0] || '').toLowerCase().replace(/^(left|right)$/, 'rack-$1');
        if (!['rack-left', 'rack-right'].includes(r)) return ['usage: route <rack-left|rack-right>   (see cart/README)'];
        return runRoute(r);
      },
      eject: () => { if (!room.cart) return ['eject: nothing in the slot.']; ejectCart(); return []; },
      sudo: (args) => args.join(' ') === 'make me a sandwich' ? ['okay.'] : ['operator is not in the sudoers file. this incident will be reported.'],
      make: (args) => args.join(' ') === 'me a sandwich' ? ['what? make it yourself.'] : /^(coffee|a pot|more coffee|a coffee)$/i.test(args.join(' ')) ? COMMANDS.brew() : ['make: *** no targets. stop.'],
      exit: () => su ? (suEnd(), []) : ['there is no exit. only more racks.'],
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

    let handbookHold = 0;
    function runCommand(raw) {
      let [cmd, ...args] = raw.trim().split(/\s+/);
      if (!cmd) return;
      shift.hold('handbook', false); clearTimeout(handbookHold);   // (a handbook page held the energy while it was read)
      if (glenn.answer(raw)) return;                     // (his question: "Need a refresher? (yes/no)")
      if (/^(please|pls|plz)$/i.test(cmd) && args.length) [cmd, ...args] = args;   // (please reboot L14)
      args = args.filter(a => !/^(please|pls|plz|thanks|thx)[.!]?$/i.test(a));   // (reboot L14 please)
      const name = cmd.toLowerCase().replace(/(.)[?!.,]+$/, '$1');   // (status? is status)
      const fn = COMMANDS[name] && !talkedTo(raw, name, args) ? COMMANDS[name] : null;
      const out = fn ? fn(args) : notFound(raw, cmd, name, args);
      out.forEach(l => typeof l === 'string' ? print(l) : l.html !== undefined ? (lines.push(l), render()) : print(l.text, l.cls));
    }

    // ---- the terminal never ignores you (Arnold, 2026-10-05). A line that isn't a command: a word players use for one
    // runs it, and says which it was; fix and its kin run whatever fits the unit's trouble (or say which does, as
    // fixUnit does); a close misspelling is still not found, with the command it was probably meant to be (so the M
    // key that presses itself still leaves "mstatus: command not found", now with "did you mean status?"); talking to
    // Glenn gets one of a few lines from him, never a conversation; anything else, a pointer at help.
    const FIX_WORDS = new Set(['fix', 'repair', 'restart', 'reset', 'restore', 'recover', 'revive', 'heal', 'resolve', 'solve', 'unstick', 'unfreeze', 'start', 'boot', 'bounce', 'cycle', 'powercycle', 'cure', 'mend', 'unjam']);
    const ALIASES = {
      dir: 'ls', list: 'ls', ll: 'ls', look: 'ls', 'cd..': ['cd', '..'], cls: 'clear',
      man: 'help', '?': 'help', commands: 'help', info: 'help', manual: 'help', h: 'help', guide: 'help', tutorial: 'help',
      check: 'status', stat: 'status', state: 'status', report: 'status', units: 'status', racks: 'status', alerts: 'status', problems: 'status',
      ps: 'top', htop: 'top', monitor: 'top',
      more: 'cat', less: 'cat', type: 'cat', open: 'cat', view: 'cat', read: args => args.length ? ['cat', ...args] : ['mail'],
      email: 'mail', inbox: 'mail', messages: 'mail', mails: 'mail',
      time: 'shift', clock: 'shift', when: 'shift',
      drink: 'coffee', sip: 'coffee', mug: 'coffee', caffeine: 'coffee',
      refill: 'brew',
      cool: 'reroute', cooldown: 'reroute', migrate: 'reroute', offload: 'reroute',
      play: args => /^(defrag|route)$/i.test(args[0] || '') ? [args[0].toLowerCase(), ...args.slice(1)] : ['pong'], game: 'pong', games: 'pong',
      quit: 'exit', bye: 'exit', leave: 'exit', logoff: 'logout', signout: 'logout',
      runbook: ['cat', 'runbook'], shutdown: ['power', 'off'], poweroff: ['power', 'off'], halt: ['power', 'off'],
      defragment: 'defrag', reroot: 'reroute', rereoute: 'reroute',
    };
    const SAYS = {
      vi: 'no editor on this terminal. cat reads a file.', vim: 'no editor on this terminal. cat reads a file.', nano: 'no editor on this terminal. cat reads a file.',
      emacs: 'no editor on this terminal. cat reads a file.', edit: 'no editor on this terminal. cat reads a file.',
      kill: 'nothing to kill. q stops a live view; reboot restarts a unit.', killall: 'nothing to kill. q stops a live view; reboot restarts a unit.',
      sleep: 'not on shift.', nap: 'not on shift.', rest: 'not on shift. coffee helps.', undo: 'there is no undo. only the next thing.',
    };
    // what a player is likely to have meant: the commands, and the words above for them (a misspelt alias suggests its
    // command); never the jokes
    const JOKES = new Set(['eastereggs', 'secrets', 'xyzzy', '42', 'hello', 'hi', 'sudo', 'make', 'rm', 'neofetch', 'about', 'matrix', 'echo', 'su', 'dmesg', 'finger', 'last']);
    const meant = () => [...Object.keys(COMMANDS).filter(c => !JOKES.has(c)).map(c => [c, c]), ...Object.entries(ALIASES).filter(([, t]) => typeof t === 'string').map(([w, t]) => [w, t]), ...[...FIX_WORDS].map(w => [w, w])];
    // edits apart, a swap of two neighbours counting one
    function editsApart(a, b) {
      const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      return d[a.length][b.length];
    }
    function didYouMean(name) {
      if (name.length < 2) return null;
      let best = null;
      for (const [w, to] of meant()) {
        const e = editsApart(name, w), most = name.length <= 4 ? 1 : 2;
        if (e && e <= most && (!best || e < best.e)) best = { e, to };
      }
      return best && best.to;
    }
    // talking, not typing a command: a question, a greeting, a sentence, his name
    const QWORD = /^(who|what|whats|what's|why|where|how|hows|how's|is|are|am|can|could|would|will|do|does|did|should|shall|may)$/;
    const TALK = /^(hey|hiya|yo|sup|howdy|greetings|morning|evening|glenn|thanks|thank|thx|ty|sorry|ok|okay|k|yes|no|yeah|yea|yep|nope|nah|sure|lol|haha|hmm|um|uh|oops|ugh|i|im|i'm|ive|i've|you|youre|you're|we|my|me|it|its|it's|this|that|there|wtf|omg|damn|great|nice|wow|good|bad|night|goodnight|anyone|anybody|someone|hellooo*|helo)$/;
    function talkedTo(raw, name, args) {
      const w = raw.trim().toLowerCase();
      // a real command runs (finger glenn, name glenn), but for who, hello and hi with words after them: who are you
      if (COMMANDS[name]) return (name === 'who' || name === 'hello' || name === 'hi') && args.length > 0;
      if (/\bglenn\b/.test(w)) return true;
      if (ALIASES[name] || FIX_WORDS.has(name) || SAYS[name]) return false;
      if (/\?\s*$/.test(w) || (QWORD.test(name) && args.length) || TALK.test(name)) return true;
      return args.length >= 2 && !UNITS[(args[0] || '').toUpperCase()];   // a sentence: three words or more
    }
    function notFound(raw, cmd, name, args) {
      if (talkedTo(raw, name, args)) {
        playtest('talked to glenn: ' + raw);
        return glenn.heard() ? [] : [{ text: 'no answer. type help for the commands.', cls: 'dim' }];
      }
      if (FIX_WORDS.has(name)) return fixAny(name, args);
      const al = ALIASES[name];
      if (al) {
        const [to, ...pre] = typeof al === 'function' ? al(args) : typeof al === 'string' ? [al, ...args] : [...al, ...args];
        print(`(${name}: that's ${[to, ...pre].join(' ')} here)`, 'dim');
        return COMMANDS[to](pre);
      }
      if (SAYS[name]) return [SAYS[name]];
      if (UNITS[cmd.toUpperCase()]) return [`${cmd.toUpperCase()} is a unit: status ${cmd.toUpperCase()} shows it, reboot or reroute fixes it.`];
      if (/^(rack-)?(left|right)$/i.test(cmd)) { const r = 'rack-' + cmd.toLowerCase().replace('rack-', ''); return [`${r} is a rack: status ${r} shows it, ping ${r} checks it.`]; }
      const m = didYouMean(name);
      if (m) return [`${cmd}: command not found. did you mean ${m}?`];
      return [`${cmd}: command not found. type help for the commands.`];
    }
    // fix, repair, restart and the like: the command that fits the unit's trouble, run (one in the slot), or named
    function fixAny(word, args) {
      if (!args.length) return [`${word} what?   ${word} <unit>, or status to see what's wrong.`];
      if (/^pong$/i.test(args[0])) return COMMANDS.pong([]);                 // (start pong)
      const fits = name => {
        const r = name.toLowerCase().replace(/^(left|right)$/, 'rack-$1'), u = name.toUpperCase();
        const o = shift.open().find(x => x.unit === u || x.unit === r);
        if (/^rack-(left|right)$/.test(r)) return !o ? { say: `${r} is fine. nothing to ${word}.` } : o.fixing ? { say: `${r} is already being seen to.` }
          : room.cart === 'ROUTE' ? { verb: 'route', arg: r } : { say: `${r} is dropping packets: that takes route, from the ROUTE cartridge.` };
        if (!UNITS[u]) return { say: `${word}: ${name}: no such unit   units: ${Object.keys(UNITS).join(' ')}` };
        if (!o) return { say: `${u} is fine. nothing to ${word}.` };
        if (o.fixing) return { say: `${u} is already being seen to.` };
        if (o.kind === 'STUCK') return room.cart === 'DEFRAG' ? { verb: 'defrag', arg: u } : { say: `${u} is fragmented: that takes defrag, from the DEFRAG cartridge.` };
        return { verb: o.kind === 'HOT' ? 'reroute' : 'reboot', arg: u, why: o.kind === 'HOT' ? 'running hot' : 'down' };
      };
      const each = [...new Set(args)].map(fits), runs = each.filter(f => f.verb), verbs = new Set(runs.map(f => f.verb));
      // several units: one command for all of them if it fits them all; otherwise each says which fits
      if (runs.length && verbs.size === 1 && !(runs.length > 1 && runs[0].verb !== 'reboot' && runs[0].verb !== 'reroute')) {
        each.filter(f => f.say).forEach(f => print(f.say));
        const v = runs[0].verb, units = runs.map(f => f.arg);
        print(`(${word}: ${units.length === 1 && runs[0].why ? `${units[0]} is ${runs[0].why}, so ` : ''}${v} ${units.join(' ')})`, 'dim');
        return COMMANDS[v](units);
      }
      return each.map(f => f.say || `${f.arg}: ${f.verb} ${f.arg}`);
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
        landed(u); fixLanded(u); ledBurst(4);
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
          landed(u); fixLanded(u);
          const done = shift.level >= 3 ? `${u}: cycle maintained.` : (reboot ? `${u} back online.` : `${u} rerouted, cooling.`) + (shift.level === 2 ? ' it missed you.' : '');
          logLine('vigild[412]: ' + done); print(done, 'ok');
        }
        ledBurst(6); glenn.checkBasics();
        setMode('shell');
        if (glenn.taught('book')) glenn.refused('book', 'be a pal and keep it by the book');
        else if (glenn.once('book', "Whoa there, chief. Be a pal and keep it by the book. One at a time.")) glenn.order('book', 'be a pal and keep it by the book');
      })();
      return [];
    }
    // ---- ping one unit: a down one times out, a hot one answers slowly
    // (a ping runs out by itself in a few seconds; what you type meanwhile waits for the prompt)
    async function runPingUnit(u) {
      mode = 'proc'; let stopped = false;
      stopProc = null;
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
    // lines: [label, value, cls?], or { centre: [[text, cls?], ...] } for a line set in the middle. finale: steps run
    // after the lines are up and before the card settles, one a tick (null waits a tick); each gets set(i, line) to
    // change line i. Returns { key, cancel }; done() runs on a key once the card has settled.
    function resultCard({ head, won, title, lines: rows, foot, finale = [] }, done) {
      playtest(`game over: ${title || head || ''} ${won ? 'WON' : 'lost'}`);
      const IN = 48, bar = '+' + '-'.repeat(IN) + '+';
      const pad = t => t + ' '.repeat(Math.max(0, IN - [...t].length));
      const plain = (t = '') => ({ html: '|' + esc(pad(t)) + '|' });
      const spaced = title.toUpperCase().split('').join(' ');
      const centred = ' '.repeat(Math.floor((IN - spaced.length) / 2)) + spaced;
      const line = r => {
        if (r.centre) {
          const len = r.centre.reduce((n, [t]) => n + [...t].length, 0), l = Math.floor((IN - len) / 2);
          return { html: '|' + esc(' '.repeat(l)) + r.centre.map(([t, c]) => c ? `<span class="${c}">${esc(t)}</span>` : esc(t)).join('') + esc(' '.repeat(IN - l - len)) + '|' };
        }
        const [k, v, cls] = r, lead = '    ' + k.padEnd(11);
        return cls ? { html: '|' + esc(lead) + `<span class="${cls}">${esc(v)}</span>` + esc(' '.repeat(Math.max(0, IN - lead.length - v.length))) + '|' } : plain(lead + v);
      };
      const body = [plain(), null, plain(), ...rows.map(line), plain()];
      const set = (j, r) => { body[3 + j] = line(r); };
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
      for (const f of finale) steps.push(f && (() => f(set)));
      steps.push(() => { ready = true; });
      const t = setInterval(() => { steps[i++]?.(); draw(); if (i >= steps.length) clearInterval(t); }, 90);
      draw();
      return { key: () => { if (ready) done(); }, cancel: () => clearInterval(t) };
    }
    const secs = ms => `${Math.round(ms / 1000)} s`;
    // q in a cartridge game asks first (Arnold, 2026-10-03: a stray q must never cost a game): the game's top line becomes
    // the question; q again quits, as a loss; any other key is the game's again (and does what it does there)
    const QUIT_ASK = { text: ' quit? this counts as a loss. press q again to quit', cls: 'alert' };
    function quitter(onQuit, redraw) {
      let asking = false;
      return { get asking() { return asking; }, key(k) {
        if (k === 'q' || k === 'Q') { if (asking) { asking = false; onQuit(); } else { asking = true; redraw(); } return true; }
        if (asking) { asking = false; redraw(); }
        return false;
      } };
    }
    const energyDelta = e0 => { const d = Math.round((shift.energy - e0) * 100); return (d > 0 ? '+' : '') + d + '%'; };

    // ---- DEFRAG, from its cartridge (the game is defrag.js): put a stuck unit's files back together
    function runDefrag(u) {
      const e0 = shift.energy, r = shift.fix(u, 'defrag');
      // (a game just lost: the unit waits a minute before it can be played again; the simulation report, 2026-10-06, item 4)
      if (!r.ok) return [r.reason === 'nothing wrong' ? `${u} is fine. nothing to defrag.`
        : r.reason === 'already being fixed' ? `${u} is already being seen to.`
        : r.reason === 'cooling' ? `${u}'s disk is still settling. try again in ${Math.ceil(r.waitMs / 1000)} s.` : `${u} isn't fragmented. it's ${r.reason}.`];
      updateVitals();
      mode = 'game'; gameName = 'defrag';
      // the night's first game teaches: two files, the slowest writes, one file a single block from whole, whatever the hour
      // (as ROUTE's first does; with trouble by mastery the first STUCK can come late, when the clock's dial gave three files)
      const dial = room.defragTaught ? shift.defragDial() : { files: 2, writeEvery: 8 }, d = createDefrag({ files: dial.files, headStart: !room.defragTaught });
      room.defragTaught = true;
      if (window.dev) window.dev.game = d;                  // ?dev: the running game, for trying things out
      // four files, four shades you can't confuse at a glance, each with its own tint (all in the terminal font, so
      // all the same width). A whole file turns green. Under the board: the goal, and how far along each file is.
      const GLYPH = ['██', '▓▓', '▒▒', '░░'], LIMIT = 60000;
      let t0 = performance.now();
      let over = null, card = null, nextWrite = t0 + dial.writeEvery * 1000, flash = null, handed = [], quit = null;   // flash: the unit's last write
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
        frame = [quit?.asking ? QUIT_ASK : { text: ` defrag ${u}   ${String(left).padStart(2)}s   arrows + space: pick up, put down`, cls: 'dim' }, border, ...rows, border,
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
          landed(u, true); shift.paidBack(e0, shift.CART.win); fixLanded(u); ledBurst(8);
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
          foot: won ? (handed.length ? 'you have new mail.' : 'the racks settle.') : 'it keeps writing.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); });
      };
      onThaw = d => { t0 += d; nextWrite += d; };
      const timer = setInterval(() => {
        if (frozen) return;
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
      quit = quitter(() => finish(false, 'quit'), () => draw());
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (quit.key(k)) return;
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
          { text: `top - ${stamp()}  128 units, ${shift.open().length} alerts  strikes ${shift.strikes}/${shift.STRIKE.max}`, cls: 'dim' },
          // (each unit's client, doing whatever it does at this hour: design.md section 5, the clients)
          'UNIT LOAD      TEMP STATE  CLIENT',
          ...units.map(u => {
            const st = shift.state(u.name), down = st && st.kind === 'DOWN', hot = st && st.kind === 'HOT';
            const util = down ? 0 : u.util, n = Math.round(util * 8);
            const temp = down ? '--' : hot ? String(74 + rnd(7)) : String(u.temp);
            const state = st ? (st.fixing ? 'FIXING' : st.kind) : 'ok';
            // (a unit that isn't answering can't say what it is doing: the story audit, 2026-10-06)
            return `${u.name.padEnd(5)}${'█'.repeat(n)}${'░'.repeat(8 - n)}  ${down ? '-- ' : temp.padStart(2) + 'C'}  ${state.padEnd(7)}${!CLIENTS[u.name] ? '' : down ? '(no response)' : CLIENTS[u.name][2]()}`;
          }),
          { text: ' q or backspace: close', cls: 'dim' },
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

    // ---- board: the board, a view as top is (design.md section 5): q or backspace closes it, up and down scroll it, and
    // reading it holds the energy. script: 04:44's, which drives it (top: the row shown first; scroll, set from outside).
    let procKey = null;
    // a view that holds the energy (the board, the mail) holds it only for a while, as a handbook page does (the simulation
    // report, 2026-10-06, item 10: left open, they held it for as long as they stayed open)
    const VIEW_HOLD = 40000;
    function runBoard(script = null) {
      mode = 'proc';
      const st = { scroll: 0, top: null, ...(script || {}) };
      shift.hold('board', true);
      const holdT = setTimeout(() => shift.hold('board', false), VIEW_HOLD);
      const draw = () => {
        const all = boardLines({ top: st.top });
        st.scroll = Math.max(0, Math.min(st.scroll, all.length - 12));
        frame = [...all.slice(st.scroll, st.scroll + 12), { text: ' q or backspace: close · up, down: scroll', cls: 'dim' }];
        render();
      };
      draw();
      const t = setInterval(draw, 1000);
      procKey = k => { if (k !== 'ArrowDown' && k !== 'ArrowUp') return false; st.scroll += k === 'ArrowDown' ? 1 : -1; draw(); return true; };
      stopProc = () => { clearInterval(t); clearTimeout(holdT); procKey = null; shift.hold('board', false); setMode('shell'); };
      return { set(o) { Object.assign(st, o); draw(); }, get length() { return boardLines({ top: st.top }).length; }, close: () => { if (mode === 'proc' && procKey) stopProc(); } };
    }

    // ---- ping: a pulse travels down a rack
    async function runPing(rack) {
      mode = 'proc'; let stopped = false;
      stopProc = null;
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
      stopProc = null;
      print(`PING ${name} (${name === '23' ? '10.0.0.23' : '10.0.0.51'}): 56 data bytes`);   // your name: an address of its own (unit 23's leaned the mystery one way)
      for (let seq = 0; seq < 4 && !stopped; seq++) { await wait(900); print(`64 bytes from ${name}: seq=${seq} ttl=64 time=0.0 ms`); beep(1200, .03, .015); }
      if (!stopped) print('--- 4 packets transmitted, 4 received, 0% packet loss ---', 'dim');
      setMode('shell');
    }

    // ---- ROUTE, from its cartridge (the game is route.js): a rack dropping packets, played as Snake on the square grid
    function runRoute(rack) {
      const e0 = shift.energy, fixed = shift.fix(rack, 'route');
      if (!fixed.ok) return [fixed.reason === 'nothing wrong' ? `${rack} is fine. nothing to route.`
        : fixed.reason === 'already being fixed' ? `${rack} is already being seen to.`
        : fixed.reason === 'cooling' ? `${rack}'s links are still resetting. try again in ${Math.ceil(fixed.waitMs / 1000)} s.` : `${rack} isn't dropping packets. it's ${fixed.reason}.`];
      updateVitals();
      mode = 'game'; gameName = 'route';
      // the night's first game teaches: five hops, no dead links, a slow train
      const dial = room.routeTaught ? shift.routeDial() : { hops: 5, dead: 0, tick: 170 };
      room.routeTaught = true;
      const g = createRoute({ hops: dial.hops, dead: dial.dead });
      if (window.dev) window.dev.game = g;
      const BOX = 48, LIMIT = 60000;
      let t0 = performance.now(), started = false, over = null, card = null, timer = 0, handed = [], reached = 0, quit = null;
      const centerText = (t, w) => { const pad = w - t.length; return ' '.repeat(Math.floor(pad / 2)) + t + ' '.repeat(Math.ceil(pad / 2)); };
      const draw = () => {
        const left = started ? Math.max(0, Math.ceil((LIMIT - (performance.now() - t0)) / 1000)) : 60;
        const border = '+' + '-'.repeat(BOX) + '+', empty = '|' + ' '.repeat(BOX) + '|';
        // one line above the board (the tube has no room below it): the clock, the hops, the drops; when the last hop
        // is reached, the port is open, in green
        const hops = g.open() ? '<span class="dfok">port open</span>' : `hops ${g.reached()}/${g.total}`;
        frame = [quit?.asking ? QUIT_ASK : { html: ` <span class="dim">route ${rack}   ${String(left).padStart(2)}s</span>   ${hops}   <span class="dim">dropped ${g.drops()}/${g.DROPS}</span>` },
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
          landed(rack, true); shift.paidBack(e0, shift.CART.win); unitLed(rack, null); rackFlow(rack);
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
          foot: won ? (handed.length ? 'you have new mail.' : 'traffic flows again.') : 'the rack keeps dropping.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); });
      };
      onThaw = d => { t0 += d; };
      const tick = () => {
        if (over) return;
        if (frozen) { timer = setTimeout(tick, 100); return; }
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
      quit = quitter(() => finish(false, 'quit'), () => draw());
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (quit.key(k)) return;
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
    // tube, enter, q or backspace goes back to the inbox, q or backspace there closes it (esc is the menu's, everywhere).
    // Unread messages bright, read ones dim.
    function runMailPicker(src = inbox) {
      const inbox = src;                                 // (m's, as m)
      mode = 'game'; gameName = 'mail';
      shift.hold('mail', true);                          // reading the mail costs no energy (Eugene's playtest, 2026-10-02), for a while
      const holdT = setTimeout(() => shift.hold('mail', false), VIEW_HOLD);
      const box = inbox.items();
      let sel = Math.max(0, box.findIndex(m => !m.read)), reading = false;
      const P = { from: 14, subject: 27 };
      const asRows = lines => lines.flatMap(l => wrap(runsOf(l)).map(row => ({ html: row.map(r => r.cls ? `<span class="${r.cls}">${esc(r.text)}</span>` : esc(r.text)).join('') })));
      const draw = () => {
        if (reading) {
          frame = [...asRows(inbox.open(sel)), '', { text: ' enter, q or backspace: back to the inbox', cls: 'dim' }];
        } else {
          const n = inbox.unread();
          const rows = box.map((m, i) => {
            const t = ` ${m.from.slice(0, P.from).padEnd(P.from)} ${m.subject.slice(0, P.subject).padEnd(P.subject)} ${m.at}`;
            if (i === sel) return { html: `<span class="dg-cur">${esc(t.padEnd(crt.COLS))}</span>` };
            return m.read ? { text: t, cls: 'dim' } : { text: t };
          });
          frame = [{ html: ` inbox  <span class="dim">${box.length} message${box.length === 1 ? '' : 's'}${n ? `, ${n} new` : ''}</span>` }, '', ...rows, '',
            { text: ' up/down to choose, enter to open, q or backspace: close', cls: 'dim' }];
        }
        render();
      };
      const close = () => { clearTimeout(holdT); shift.hold('mail', false); gameKey = null; gameName = null; stopProc = null; setMode('shell'); };
      stopProc = close;
      gameKey = k => {
        if (reading) { if (k === 'Enter' || k === 'q' || k === 'Q' || k === 'Backspace') { reading = false; draw(); } return; }
        if (k === 'q' || k === 'Q' || k === 'Backspace') { close(); return; }
        if (k === 'ArrowDown' || k === 'ArrowUp') { sel = (sel + (k === 'ArrowDown' ? 1 : -1) + box.length) % box.length; draw(); return; }
        if (k === 'Enter' && box[sel]) { reading = true; draw(); }
      };
      draw();
    }

    // ---- the switch picker: up/down moves and plays a couple of keystrokes on that switch, enter picks it, q (or backspace
    // with nothing typed) closes it without changing anything, and typing narrows the list (by name or description)
    function runSwitchPicker() {
      mode = 'game'; gameName = 'switch';
      const start = sigName, VIS = crt.ROWS - 4;
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
          { text: ' q or backspace: close' + (L.length > VIS ? `   (${top + 1}-${Math.min(L.length, top + VIS)} of ${L.length})` : ''), cls: 'dim' }];
        render();
      };
      const close = () => { gameKey = null; gameName = null; stopProc = null; setMode('shell'); };
      stopProc = close;
      gameKey = k => {
        const L = list();
        if (k === 'q' || k === 'Q' || (k === 'Backspace' && !filter)) { close(); return; }
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
        else if (k === 'DeleteWord' || k === 'ClearLine') filter = '';
        else if (k.length === 1 && /[a-z0-9 -]/i.test(k)) filter = (filter + k.toLowerCase()).trimStart();
        else return;
        sel = 0; top = 0; draw();
      };
      draw();
    }

    // ---- pong, from the cartridge (its rules: pong.js)
    // The score that counts is your returns over the whole match, counted live along the top (Arnold, 2026-10-05; it was
    // the longest rally, which a point could end long before anyone got near 14); the match is still first to 5. The
    // cart's high score is the goal, arcade style: HI 14 M on the start screen, and every card puts your own best beside
    // it (YOU 9 · HI 14 M). Beat it and your score takes M.'s place on the card.
    // The ball and the paddles are drawn where they are, between the rules' ticks, every frame (crt.js drawPong), so they
    // move smoothly; the rules still move in ticks (pong.js TICK).
    function runPong() {
      mode = 'game'; gameName = 'pong';
      const P = window.pong, W = P.W, Hh = P.H, PL = P.PL;
      let card = null, best = 14, bestBy = 'm', mine = 0, quit = null, over = null;
      let t0 = performance.now();
      const pongE0 = shift.energy;
      try { best = +localStorage.getItem('vigil.pongBest') || 14; bestBy = localStorage.getItem('vigil.pongBestBy') || 'm'; mine = +localStorage.getItem('vigil.pongReturns') || 0; } catch {}
      // (the record's holder by initials: M.'s one letter, yours two; the story audit, 2026-10-06: Mike's "M" read as M.'s)
      const hiText = (hi, by) => `HI ${hi} ${(!by || by === 'm' ? 'm' : by.length > 2 ? initialsOf(by) : by).toUpperCase()}`;
      // Once a night, in the first game, your paddle stops listening for about two seconds and returns the ball by
      // itself, perfectly; the arrow keys on the drawn keyboard go down on their own while it does. Lag, probably.
      // (design.md, story: night 1's small wrong things; it happens while your eyes are on the tube.)
      let possessed = 0;
      const haunt = !room.pongHaunted;
      // While M.'s key is still under the cart, the cpu steadies match by match (design.md: most players can't beat 14 on
      // night 1, so everyone gets there in the end; pong.js MATCH, tuned with pong-audit.js). Counted across nights;
      // nothing says so.
      const steadying = file.key === 'none' && !file.unlocked;
      // the protected chase (design.md section 5, night lengths): while M.'s key is under the cart, on nights 1 and 2, up
      // to three matches a night bring no new trouble, and their drain is paid back, won or lost (not on a quit)
      const protect = steadying && shift.level <= 2 && (room.pongProtected || 0) < 3;
      let protecting = false;
      let matchN = 0; try { matchN = (+localStorage.getItem('vigil.pongMatches') || 0) + 1; } catch (e) {}
      const set = P.MATCH(steadying ? matchN : 1), TICK = set.tick;
      const game = P.createPong({ cpu: set.cpu, to: set.to }), g = game.s;
      // where things were at the last tick, to draw them in between; your paddle eases to its row
      let prev = { bx: g.bx, by: g.by, vx: g.vx, vy: g.vy, cy: g.cy }, pyShown = g.py, lastFrame = performance.now();
      const header = () => {
        const passed = g.returns > best;
        return { html: `<span class="dim"> pong   you ${g.you} · cpu ${g.cpu}   returns </span><span class="${passed ? 'ok' : ''}">${g.returns}</span><span class="dim">   ${hiText(best, bestBy)}</span>` };
      };
      const frameNow = () => {
        const rows = Array.from({ length: Hh }, () => Array(W).fill(' '));
        if (!g.started) {                                // the start screen, between the paddles
          const put = (row, t) => { const l = Math.floor((W - t.length) / 2); for (let i = 0; i < t.length; i++) rows[row][l + i] = t[i]; };
          put(2, hiText(best, bestBy)); put(7, 'press up or down to serve'); put(8, `first to ${g.to}. q quits.`);
        }
        const border = '+' + '-'.repeat(W) + '+';
        frame = [quit?.asking ? QUIT_ASK : header(), border, ...rows.map(r => '|' + r.join('') + '|'), border];
      };
      // a frame: the ball where it is between ticks (its bounce off a wall taken as it happens), the cpu's paddle sliding
      // to its row, yours easing to the row your keys put it on
      const reflect = y => { let v = y; for (let k = 0; k < 4; k++) { if (v < 0) v = -v; else if (v > Hh - 1) v = 2 * (Hh - 1) - v; else break; } return v; };
      const drawFrame = () => {
        if (over || card) return;
        const now = performance.now(), a = Math.max(0, Math.min(1, acc / TICK)), dt = now - lastFrame; lastFrame = now;
        pyShown += (g.py - pyShown) * Math.min(1, dt / 45);
        if (Math.abs(g.py - pyShown) < .02) pyShown = g.py;
        const ball = g.started ? [prev.bx + prev.vx * a, reflect(prev.by + prev.vy * a)] : null;
        frameNow();
        field = { pong: true, col: 1, row: 2, ball, paddles: [[0, pyShown, PL], [W - 1, prev.cy + (g.cy - prev.cy) * a, PL]] };
        render();
      };
      // the frame loop runs the rules too: they tick off the time that has passed since the last frame (TICK ms a tick),
      // and the frame is drawn at the fraction of a tick left over, so where the ball is drawn always matches the clock.
      // (On a timer of their own the rules fired late now and then, and the ball stood still for a frame, then caught up.)
      // A timer stands in when frames stop coming (a hidden tab), so the match never freezes half-played.
      let raf = 0, acc = 0, lastTick = performance.now(), stopped = false;
      const advance = () => {
        const now = performance.now();
        if (g.started && !g.over && !stopped && !frozen) { acc += Math.min(now - lastTick, 1000); while (acc >= TICK && !over && !stopped) { acc -= TICK; step(); } }
        lastTick = now;
      };
      const fallback = setInterval(() => { if (!stopped && performance.now() - lastTick > 150) advance(); }, 100);
      const loop = () => { raf = 0; if (over || card || stopped || mode !== 'game' || gameName !== 'pong') return; advance(); drawFrame(); raf = requestAnimationFrame(loop); };
      const step = () => {
        if (!g.started || g.over) return;
        if (haunt && !room.pongHaunted && g.tick > 40 && g.vx < 0 && g.bx === 30) { room.pongHaunted = true; possessed = 30; }
        if (possessed > 0) {
          possessed--;
          const want = clamp(Math.round(g.by) - 1, 0, Hh - PL);
          if (want !== g.py) { const k = want < g.py ? 'key-ArrowUp' : 'key-ArrowDown'; game.move(want < g.py ? -1 : 1); press(k); setTimeout(() => release(k), 60); }
        }
        prev = { bx: g.bx, by: g.by, vx: g.vx, vy: g.vy, cy: g.cy };
        const ev = game.step();
        // (this tick's path is where it was and how it was moving, its bounce off a wall folded in as it is drawn; a new
        // ball, served, is not drawn sliding from the old one)
        if (ev.includes('serve')) prev = { bx: g.bx, by: g.by, vx: g.vx, vy: g.vy, cy: g.cy };
        if (ev.includes('you')) beep(660, .03, .03);
        if (ev.includes('cpuHit')) beep(520, .03, .03);
        if (ev.includes('missed')) beep(200, .2, .04);
        if (ev.includes('point')) { beep(1000, .12, .04); ledBurst(6); }
        if (ev.includes('over')) end(g.you >= g.to);
      };
      onThaw = d => { t0 += d; lastTick = performance.now(); };
      if (window.dev) window.dev.game = { point: () => { g.you++; }, returns: n => { g.returns = n; }, rally: n => { g.returns = n; }, state: g };   // ?dev: score a point, set the returns, for trying the ending
      let handed = [];
      // quit: a lost match without the break (quitting at once would otherwise pay Pong's 3%)
      const end = (won, quitting = false) => {
        over = won ? 'you win' : 'cpu wins';
        stopped = true; clearInterval(fallback); if (raf) cancelAnimationFrame(raf); raf = 0; field = null;
        if (won) handed = shift.won('PONG');
        if (protecting) { shift.protect(false); protecting = false; }
        if (!quitting) shift.rest();                     // a game of Pong is a short break, win or lose
        if (won || (protect && !quitting)) shift.paidBack(pongE0, shift.PONG_BREAK); // and a win pays for its minute (a protected match, either way)
        // the record falls: Glenn starts to cheer, and stops mid-word as the slot pops (the plan: Glenn and Pong)
        if (g.returns > 14 && steadying && g.returns > best && shift.level === 1) glenn.say("Ha! That's M.'s record gone, ch");
        // proud of the chase while M.'s key is still under the cart (the plan: Glenn and Pong), once per operator: after a
        // match whose card has put your score beside M.'s (the story audit, 2026-10-06: at the cartridge going in, it came
        // before any score had shown)
        else if (steadying && !cold() && !quitting) glenn.once('pong-chase', "That's M.'s score you're after? Go get it, chief.");
        updateVitals();
        const returns = g.returns, record = returns > best, was = hiText(best, bestBy);
        mine = Math.max(mine, returns); try { localStorage.setItem('vigil.pongReturns', String(mine)); } catch {}
        if (record) { best = returns; bestBy = initialsOf(account.name) || account.user.slice(0, 2); playtest(`pong: new high score, ${best} returns`); try { localStorage.setItem('vigil.pongBest', String(best)); localStorage.setItem('vigil.pongBestBy', bestBy); } catch {} }
        playtest(`pong: ${won ? 'won' : 'lost'} ${g.you}-${g.cpu}, ${returns} returns (match ${matchN}${steadying ? '' : ', the key found'})`);
        // YOU · HI, the last line on the card; on a new best the old HI blinks out and yours takes its place
        const ARCADE = 5, arcade = (hi, cls) => ({ centre: [[`YOU ${mine}`], ['  ·  ', 'dim'], [hi, cls]] });
        const blink = on => set => set(ARCADE, arcade(on ? was : ' '.repeat(was.length)));
        const finale = !record ? [] : [null, null, null, null, null, null,
          blink(false), null, null, blink(true), null, null, blink(false), null, null, blink(true), null, null, blink(false), null, null, null,
          set => { set(ARCADE, arcade(hiText(best, bestBy), 'ok')); [784, 1046, 1568].forEach((f, j) => setTimeout(() => beep(f, j === 2 ? .2 : .08, .03), j * 110)); },
          null, null, null, null, null];
        card = resultCard({
          head: ' pong', won, title: won ? 'you win' : 'cpu wins',
          lines: [['score', `${g.you} - ${g.cpu}`], ['returns', `${returns}`], ['time', secs(performance.now() - t0)], ['energy', energyDelta(pongE0)],
            { centre: [] }, arcade(was)],
          finale,
          foot: handed.length ? 'you have new mail.' : won ? 'the cpu paddle waits a moment.' : 'it has had a lot of practice.',
        }, () => { stopProc(); for (const e of handed) showEvent(e); if (returns > 14 && steadying) setTimeout(keyFromPong, 600); });
      };
      frameNow(); drawFrame();
      stopProc = () => { stopped = true; if (protecting) { shift.protect(false); protecting = false; } clearInterval(fallback); if (raf) cancelAnimationFrame(raf); raf = 0; field = null; card?.cancel(); gameKey = null; gameName = null; print(`pong: you ${g.you}, cpu ${g.cpu}, ${g.returns} returns`); setMode('shell'); };
      quit = quitter(() => { stopped = true; end(false, true); }, () => drawFrame());
      gameKey = k => {
        if (over) { card?.key(k); return; }
        if (quit.key(k)) return;
        if (possessed > 0 && (k === 'ArrowUp' || k === 'ArrowDown')) return;   // not yours, for a moment
        if (k === 'ArrowUp') game.move(-1);
        else if (k === 'ArrowDown') game.move(1);
        else return;
        if (!g.started) { game.start(); prev = { bx: g.bx, by: g.by, vx: g.vx, vy: g.vy, cy: g.cy }; acc = 0; lastTick = performance.now(); if (steadying) try { localStorage.setItem('vigil.pongMatches', String(matchN)); } catch (e) {} if (protect) { protecting = true; shift.protect(true); room.pongProtected = (room.pongProtected || 0) + 1; playtest(`pong: protected match ${room.pongProtected} of 3`); } }
        if (!raf) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // ---- matrix: rain on the tube, then the room has a word with you
    function runMatrix() {
      mode = 'proc';
      const W = 52, Hh = 13, GLYPHS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ$#%&*+=<>/\|;:^~';
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
        frame = [...rows, { text: ' q or backspace: close', cls: 'dim' }]; render();
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
        '- the right knob is not volume. I checked.',
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
        if (mode === 'game' && ['pong', 'defrag', 'route'].includes(gameName)) { const g = gameName; stopProc?.(); print(`${g}: cartridge removed`, 'dim'); }
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

    // ---- su: m's account (design.md, "M.'s password"). su <user> asks for the password, typed without echo; wrong (or
    // any account but m's: only m's password is anywhere to be found), "su: Authentication failure" after a moment, as su
    // does; right, the shell is m's until logout. The password is on the slip in IT's envelope in M.'s drawer.
    const OLD_USERS = ['ts', 'jk', 'rd', 'aw', 'm', 'root', 'glenn'];
    function runSu(user) {
      user = user.toLowerCase();
      if (su && su.user === user) return [];
      if (!OLD_USERS.includes(user) && user !== account.user) return [`su: user ${user} does not exist`];
      suTry = user; line = ''; mode = 'password'; render();
      playtest('su ' + user);
      return [];
    }
    async function suCheck(p) {
      const user = suTry; suTry = null; mode = 'proc'; stopProc = null; render();
      const ok = user === 'm' && p === window.mDrawer.PASSWORD;
      await wait(ok ? 350 : 1600);                      // (su takes its time over a wrong one)
      if (!ok) { playtest(`su ${user}: authentication failure`); print('su: Authentication failure'); setMode('shell'); return; }
      playtest('su m: in');
      logLine('su[2207]: session opened for user m by ' + account.user);
      su = { user: 'm', saved: { hist, cwd } }; hist = M_HISTORY.slice(); histIdx = -1; cwd = '~';
      // as your own login does (the story audit, 2026-10-06: su m said nothing, and m's mail is where night 2's evidence is)
      if (M_BOX.unread()) print('You have new mail.');
      updateVitals();
      setMode('shell');
    }
    function suEnd(quiet = false) {
      if (!su) return;
      if (!quiet) { print('logout'); logLine('su[2207]: session closed for user m'); playtest('su m: logout'); }
      hist = su.saved.hist; cwd = su.saved.cwd; histIdx = -1; su = null;
      updateVitals();
      if (!quiet) render();
    }
    // m's history: the job, then less of it; what M. found (the grep the player finds on night 3); Glenn; the override's
    // code years ago (the finale's: power --authorize); not yet, as a command; the last line logout. Never commented on.
    const M_HISTORY = ['status', 'reboot L20', 'status', 'reroute R17', 'top', 'status', 'defrag L41', 'reboot L33', 'status', 'route rack-left',
      'reroute L14', 'status', 'reboot L47', 'top', 'status', 'grep -i "be a pal" logs/vigild.log', 'status', 'finger glenn',
      'power --authorize 7219', 'status', 'not yet', 'logout'];
    // m's mail: Glenn's lines, word for word, years before yours; IT's account notice (the envelope's, which M. never
    // opened: unread; dated 03:20, in the night, sent down the tube, so M. could have left it sealed in the drawer and locked
    // it: at 06:02, after "no operator found on site", nobody could have; the story audit, 2026-10-06); Vigil Weekly's operator of the month; the day shift running late. Nothing from M. to anyone.
    const M_MAIL = [
      { from: 'Glenn', addr: 'glenn@site4.vigil', subject: '(no subject)', at: 'Jun  7', date: 'Thu, 7 Jun 2018 23:14', read: true, body: () => ['Be a pal and read the runbook: type cat runbook.'] },
      { from: 'Glenn', addr: 'glenn@site4.vigil', subject: '(no subject)', at: 'Aug 13', date: 'Mon, 13 Aug 2018 01:52', read: true, body: () => ['Be a pal and keep it by the book.'] },
      { from: 'Glenn', addr: 'glenn@site4.vigil', subject: '(no subject)', at: 'Oct 12', date: 'Fri, 12 Oct 2018 03:40', read: true, body: () => ['Be a pal and leave it be.'] },
      { from: 'Glenn', addr: 'glenn@site4.vigil', subject: '(no subject)', at: 'Mar  9', date: 'Sat, 9 Mar 2019 02:26', read: true, body: () => ['Be a pal and leave the ceiling to maintenance.'] },
      { from: 'Vigil Weekly', addr: 'news@vigil', subject: 'Operator of the month', at: 'Mar 15', date: 'Fri, 15 Mar 2019 02:30', read: true, body: () => [
        "This month's operator of the month is M., Site 4, nights.", '', '11,408 consecutive shifts, and not one missed. Congratulations, M.!', '', { text: 'Vigil Weekly. Someone is always awake.', cls: 'dim' }] },
      { from: 'IT Operations', addr: 'it@site4.vigil', subject: 'Account notice', at: 'Apr  2', date: 'Tue, 2 Apr 2019 03:20', read: false, body: () => [
        'ACCOUNT NOTICE · SITE 4 · CONFIDENTIAL', '', 'ACCOUNT: m', `TEMPORARY PASSWORD: ${window.mDrawer.PASSWORD}`, 'LOG IN WITH: su m', '',
        'Change it at first login. Do not write it down.', '', { text: 'IT Operations, Site 4', cls: 'dim' }] },
      { from: 'day shift', addr: 'dayshift@site4.vigil', subject: 'running late', at: 'Apr  2', date: 'Tue, 2 Apr 2019 05:15', read: true, body: () => [
        'running a bit late. hold the fort.', '', { text: '- day shift', cls: 'dim' }] },
    ];
    const M_BOX = {
      items: () => M_MAIL, unread: () => M_MAIL.filter(m => !m.read).length,
      open: i => { const m = M_MAIL[i]; m.read = true; return [{ text: `From: ${m.from} <${m.addr}>`, cls: 'dim' }, { text: `Subject: ${m.subject}`, cls: 'dim' }, { text: `Date: ${m.date}`, cls: 'dim' }, '', ...m.body()]; },
    };

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
    function askLogin() { mode = 'login'; line = ''; render(); drain(); return new Promise(done => { loginDone = done; }); }
    async function login() {
      account.loggingIn = true; updateVitals();
      if (!account.name) await askLogin();
      else {
        await wait(300); print(LOGIN + account.name); beep(660, .035);
        if (account.lastLogin) { await wait(260); print('Last login: ' + account.lastLogin + ' on tty1', 'dim'); }
      }
      account.user = userOf(account.name);
      board?.setYou(initialsOf(account.name));          // (your row on the board: your initials, as on your folder's tab)
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
    function clockOn() { account.loggingIn = false; shiftT = performance.now(); drawFile(); updateVitals(); }   // (the mail shows from here)
    // logout: back to the login prompt, as someone else if you like
    // (the story audit, 2026-10-06: the running night used to pass to the new name, its clock, strikes and rank with it; now
    // a new name starts night 1 at 23:00 with a fresh board, as design.md says. The room keeps its memory: a logout isn't a
    // new run.)
    async function logout() {
      account.name = null; account.user = 'operator'; account.mailRead = false; glenn.forget(); noteBack();
      try { for (const k of ['vigil.operator', 'vigil.mailRead', 'vigil.night', 'vigil.notes', 'vigil.carry', 'vigil.review', 'vigil.boardNights']) localStorage.removeItem(k); } catch (e) {}
      account.loggingIn = true;
      startShift(); seen.clear(); room.replay = false;
      clockHeld = false; drawClock(true);
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
      // (the welcome mail's notice waits for Glenn's introduction, the first time: the simulation report, 2026-10-06, item
      // 3: he typed it while the player read the mail the screen had just sent them to)
      if (!account.mailRead) { if (glenn.taught('intro')) { print('You have new mail.'); print("Type 'mail' to see it.", 'dim'); } }
      else print("Type 'help' to see what it can do.", 'dim');
      // the board's pointer, under the mail (design.md section 5: "board: 6th of 6. type board.")
      if (shift.level === 1 && board) print(`board: ${ORD(board.rank())} of 6. type board.`, 'dim');
    }

    // afterLogin: what the room shows between the login and the welcome (night 3's first alert)
    async function boot(extra = [], afterLogin = null) {
      if (su) suEnd(true);                              // (a boot is you again)
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

    // Typed ahead (Arnold, 2026-10-03: nothing typed may ever vanish): while the keyboard isn't yours (04:44), the tube is
    // dark or booting (the night's end, the monitor off) or the shell is busy (a reboot, a brew, a ping), what you type
    // waits here, and once the moment is over it lands at the prompt as if typed then: Enter included, so a command runs.
    let pending = [];
    function drain() {
      setTimeout(() => {
        if (!pending.length || locked || !(mode === 'shell' || mode === 'login' || mode === 'password')) return;
        const keys = pending; pending = [];
        for (const k of keys) term.input(k);
      }, 0);
    }
    return {
      // (?dev: the tube's last n lines as text, for checking what it says: dev.screen())
      screen: (n = 14) => lines.slice(-n).map(l => l.text ?? String(l.html || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')),
      input(key) {
        lastTyped = performance.now();
        if (window.dev) { const k = (window.dev.keys = window.dev.keys || []); k.push(`${key}:${mode}${locked ? ':locked' : ''}:${line}`); if (k.length > 400) k.shift(); }   // ?dev: the last 400 keys and where each went
        if (locked || mode === 'off' || mode === 'boot' || (mode === 'proc' && !stopProc)) { if (pending.length < 400) pending.push(key); return; }
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
          else if (key === 'ClearLine') line = '';
          else if (key.length === 1 && /[\p{L}\p{N} .'-]/u.test(key) && line.length < 24) line += key;
          render(); return;
        }
        if (mode === 'password') {
          if (key === 'Enter') { const p = line; line = ''; print('Password: '); suCheck(p); return; }
          if (key === 'Backspace') line = line.slice(0, -1);
          else if (key === 'ClearLine' || key === 'DeleteWord') line = '';
          else if (key.length === 1 && line.length < 64) line += key;
          return;                                        // (nothing shows: no echo)
        }
        if (mode === 'game') { if (!frozen) gameKey?.(key); return; }   // (frozen with the room: the keys aren't yours)
        // a live view (top, tail -f, matrix): q or backspace closes it; nothing else does
        if (mode === 'proc') { if (procKey?.(key)) return; if (key === 'q' || key === 'Q' || key === 'Backspace') stopProc?.(); return; }
        if (key === 'Enter') {
          const l = line; print(prompt() + l); line = '';
          if (l.trim()) { hist.push(l); if (hist.length > 100) hist.shift(); }
          histIdx = -1; playtest('> ' + l); runCommand(l); beep(520, .05);
        }
        else if (key === 'Backspace') line = line.slice(0, -1);
        else if (key === 'DeleteWord') line = line.replace(/\s*\S*\s*$/, '');
        else if (key === 'Tab') complete();
        else if (key === 'ClearLine') line = '';           // ctrl+u (esc is the menu's)
        else if (key === 'ArrowUp') { if (hist.length) { if (histIdx === -1) { histDraft = line; histIdx = hist.length; } histIdx = Math.max(0, histIdx - 1); line = hist[histIdx]; } }
        else if (key === 'ArrowDown') { if (histIdx !== -1) { histIdx++; if (histIdx >= hist.length) { histIdx = -1; line = histDraft; } else line = hist[histIdx]; } }
        else if (key.length === 1 && line.length < 600) line += key;   // room for sentences; the tube wraps long lines
        if (mode === 'shell') render();
      },
      // a one-line remark from the room, only when the shell is idle
      setStatus(s) { status = s; render(); },
      // the envelope's count: m's mail while you are m
      mailUnread: () => su ? M_BOX.unread() : inbox.unread(),
      refresh: () => render(),
      // a remark from the room: printed above the prompt like an alert, leaving whatever is being typed alone
      say(text) { if (mode !== 'shell') return false; announce([{ text, cls: 'dim' }]); return true; },
      idleFor: () => performance.now() - lastTyped,
      quietFor: () => performance.now() - lastNew,
      lineEmpty: () => mode === 'shell' && !line,
      talkable: () => mode !== 'boot' && mode !== 'login' && mode !== 'off',
      // a line left on the screen while it is off, there when it comes back on
      leave(l) { lines.push(l); if (lines.length > MAX) lines.shift(); },
      ghost(ch) { if (mode !== 'shell') return false; line += ch; render(); return true; },
      unghost() { line = line.slice(0, -1); render(); },
      hold(on) { locked = on; if (!on) drain(); },
      takeLine() { const l = line; line = ''; render(); return l; },
      giveLine(l) { line = l; render(); drain(); },
      inShell: () => mode === 'shell',
      // what the tube is showing, for a beat that won't wait: a view (top, the board, tail -f, the matrix, the mail, the
      // switches) gives way to it; a cartridge game freezes with the room
      view: () => mode === 'proc' && stopProc && !frozen ? 'view' : mode === 'game' && ['mail', 'switch'].includes(gameName) ? 'view' : mode === 'game' && gameName && !frozen ? 'game' : null,
      closeView() { if (stopProc) stopProc(); },
      freeze(on) {
        if (on && !frozen) frozen = performance.now();
        else if (!on && frozen) { const d = performance.now() - frozen; frozen = 0; overTop = null; onThaw?.(d); render(); }
      },
      // a line typed over a frozen game's top line (null: the game's own again)
      overTop(l) { overTop = l; render(); },
      // a reboot: nothing on the tube; what was half-typed goes ahead of anything typed in the dark, to come back at the
      // next prompt (it never vanishes)
      clear() { lines = []; pending = [...line, ...pending]; line = ''; scrollBack = 0; render(); },
      mount, setMode, boot, announce, typeLine,
      // the menu's box (tubeMenu), drawn over what is on the tube until it is taken away
      showMenu(lines) { menuBox = lines; render(); },
      // which of the menu box's lines a click is on (null: not on the box), through the glass as the envelope's click is
      menuLineAt(e) {
        if (!menuBox) return null;
        const [tx, ty] = toTerminal(e.clientX, e.clientY);
        const x = tx / 2, y = (ty - (WARP.top[Math.round(tx)] || 0)) / 2;
        const BW = lenOf(runsOf(menuBox[0])), c0 = Math.max(0, Math.floor((crt.COLS - BW) / 2)), r0 = Math.max(0, Math.floor((crt.ROWS - menuBox.length) / 2) - 1);
        const row = Math.floor((y - crt.TOP) / crt.LH) - r0, col = Math.floor((x - crt.PAD_X) / crt.CW) - c0;
        return row >= 0 && row < menuBox.length && col >= 0 && col < BW ? row : null;
      },
      board: script => runBoard(script),               // (04:44 opens the board by itself)
      hideMenu() { menuBox = null; render(); },
    };
  })();

  // ------------------------------------------------------------ the menu (Esc), on the tube
  // On the CRT, in the terminal's own font and phosphor, like the mail picker (Arnold, 2026-10-03): a box over whatever the
  // tube shows (the prompt, a game, the mail), with resume, restart the night (asked first) and settings (the volume, the
  // switches, three marked recommended); up/down and enter, left/right for the volume, Esc resumes from any page of it.
  // Paused (pause.js), the night's clock and the clock readout, the energy, Glenn mid-sentence, the story's moments and
  // every motion stop on the frame they were on; the room keeps breathing: the hum, the rack fans, the LEDs. With the
  // monitor off, Esc wakes the tube to show it, and it goes dark again on resume; the knob doesn't move. A click on the room
  // does nothing while it is up.
  // ---- the night-1 polaroid's picture: the room at 23:00 as you saw it on your first night (the story audit, 2026-10-06: it
  // was the bare drawing, without the chin's clock, the slot's surround, the moved LED, the login note and the tube, a false
  // "one thing different"). Taken from the room as built, once, when the page is up: the clock on 23:00, the note on the
  // bezel, the slot empty, the receiver empty, the knobs where they start, nothing on the monitor; no parallax. The note's
  // Caveat goes in with it (a picture can't load fonts).
  (async () => {
    const clone = scene.cloneNode(true);
    clone.removeAttribute('style'); clone.setAttribute('viewBox', '-240 0 1920 1080'); clone.setAttribute('width', '1920'); clone.setAttribute('height', '1080');
    for (const el of clone.querySelectorAll('[style]')) { for (const k of ['transform', 'display', 'opacity', 'cursor', 'filter']) el.style.removeProperty(k); if (!el.getAttribute('style')) el.removeAttribute('style'); }   // (what the page set: the parallax, a hidden note)
    const at = id => clone.querySelector('#' + id);
    at('clock-readout').innerHTML = clockSvg('23:00');
    at('login-note').innerHTML = loginNote.svg(0, 0);
    at('award-slip').innerHTML = '';
    at('ceiling-tile').innerHTML = '';
    at('cart').setAttribute('display', 'none');
    const st = at('post-station').children; st[1].innerHTML = ''; st[3].innerHTML = ST.flag(0);
    clone.querySelector('[data-knob="power"]')?.setAttribute('transform', `rotate(0 ${knobPower.cx} ${knobPower.cy})`);
    clone.querySelector('[data-knob="bright"]')?.setAttribute('transform', `rotate(135 ${knobBright.cx} ${knobBright.cy})`);
    let font = '';
    try { const b = new Uint8Array(await (await fetch('assets/fonts/caveat-latin-400-normal.woff2')).arrayBuffer()); let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode(...b.subarray(i, i + 8192)); font = `@font-face { font-family: 'Caveat'; src: url(data:font/woff2;base64,${btoa(bin)}) format('woff2'); }`; } catch (e) {}
    const style = document.createElementNS(SVG, 'style'); style.textContent = font; clone.insertBefore(style, clone.firstChild);
    NIGHT1_PHOTO.src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    drawFile();
  })();

  tubeMenu = (() => {
    const IN = 44, catcher = document.createElement('div');
    Object.assign(catcher.style, { position: 'fixed', inset: '0', zIndex: '60', display: 'none' });
    document.body.appendChild(catcher);
    let opened = false, page = 'main', sel = 0, swTop = 0, woke = false;
    const escH = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const pad = t => t + ' '.repeat(Math.max(0, IN - [...t].length));
    const row = (t = '', cls) => ({ html: '|' + (cls ? `<span class="${cls}">${escH(pad(t))}</span>` : escH(pad(t))) + '|' });
    const bar = { text: '+' + '-'.repeat(IN) + '+' };
    const switches = () => [...RECOMMENDED.filter(n => PACKS[n]), ...SIG_NAMES.filter(n => !RECOMMENDED.includes(n))];
    const SW_ROWS = 5;
    // each page's choices: { label, act }, a switch, or the volume
    // The menu's restart (Arnold, 2026-10-05): a completely fresh start, as for a new player: night 1, the login, Glenn's
    // tutorial, the mail unread, full energy, the sticky note back on the monitor; nothing carried over. Only the settings
    // stay (the volume, the hum) and a playtester's log. (A lost night's reboot, the in-story loop, is another thing and
    // keeps the room's memory.)
    function freshStart() {
      playtest('start over: a fresh start');
      try { for (const k of Object.keys(localStorage)) if (k.startsWith('vigil.') && !['vigil.volume', 'vigil.hum', 'vigil.playtest'].includes(k)) localStorage.removeItem(k); } catch (e) {}
      location.reload();
    }
    function items() {
      if (page === 'main') return [{ label: 'resume', act: close }, { label: 'start over', act: () => go('restart', 0) }, { label: 'settings', act: () => go('settings', 0) }];
      if (page === 'restart') return [{ label: 'no, go back', act: () => go('main', 1) }, { label: 'yes, start over', act: freshStart }];
      return [{ volume: true }, ...switches().map(n => ({ sw: n })), { label: 'back', act: () => go('main', 2) }];
    }
    const go = (p, s) => { page = p; sel = s; swTop = 0; draw(); };
    // the mouse (the simulation report, 2026-10-06, item 10: the drawn esc opened it and nothing a mouse could do closed it):
    // a click on a choice on the tube takes it, as enter does; a click on the drawn esc resumes
    let lineItem = [];
    catcher.addEventListener('pointerdown', e => {
      if (!opened) return;
      e.preventDefault();
      const esc = $('key-Esc')?.getBoundingClientRect();
      if (esc && e.clientX >= esc.left && e.clientX <= esc.right && e.clientY >= esc.top && e.clientY <= esc.bottom) { press('key-Esc'); setTimeout(() => release('key-Esc'), 90); close(); return; }
      const at = term.menuLineAt(e), i = at === null ? undefined : lineItem[at];
      if (i === undefined) return;
      sel = i; draw();
      if (!items()[i].volume) key('Enter');
    });
    function draw() {
      const L = items(), lines = [bar];
      lineItem = [];
      const choice = (i, text) => { lineItem[lines.length] = i; lines.push(i === sel ? row(' > ' + text, 'dg-cur') : row('   ' + text)); };
      if (page === 'main') {
        lines.push(row('              P A U S E D'), row());
        L.forEach((it, i) => choice(i, it.label));
        // (a night left halfway is played again from 23:00: the story audit, 2026-10-06; "progress saves automatically" alone
        // was false for it)
        lines.push(row(), row('   progress saves automatically.', 'dim'), row('   a night left halfway starts at 23:00.', 'dim'), row('   up/down and enter.  esc: resume', 'dim'));
      } else if (page === 'restart') {
        // (Arnold, 2026-10-06: "restart the night" read as playing tonight again, and it wipes the run)
        lines.push(row('   start over?'), row('   you start over, from your first night.', 'dim'), row());
        L.forEach((it, i) => choice(i, it.label));
        lines.push(row(), row('   esc: resume', 'dim'));
      } else {
        const sw = switches(), filled = Math.round(volume * 20);
        lines.push(row('           S E T T I N G S'));
        choice(0, `volume   ${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${String(Math.round(volume * 100)).padStart(3)}%`);
        lines.push(row('   switches  (* in use)', 'dim'));
        const si = sel - 1;                              // which switch is chosen, if one is
        if (si >= 0 && si < sw.length) { if (si < swTop) swTop = si; if (si >= swTop + SW_ROWS) swTop = si - SW_ROWS + 1; }
        for (let k = swTop; k < Math.min(sw.length, swTop + SW_ROWS); k++) choice(k + 1, `${sw[k].padEnd(12)}${RECOMMENDED.includes(sw[k]) ? 'recommended' : '           '}${sw[k] === sigName ? '  *' : ''}`);
        choice(L.length - 1, 'back');
        lines.push(row(`   up/down, left/right, enter.  esc: resume`, 'dim'));
      }
      lines.push(bar);
      term.showMenu(lines);
    }
    // a switch heard as it is chosen (on the page's clock: the room's is stopped)
    let lastHeard = 0;
    function audition(name) {
      const now = window.vigilTime ? window.vigilTime.realNow() : performance.now();
      if (now - lastHeard < 90) return; lastHeard = now;
      const later = window.vigilTime ? window.vigilTime.later : setTimeout;
      loadPack(name).then(() => ['key-J', 'key-K'].forEach((id, i) => later(() => { click('key', false, id, { pack: name }); later(() => click('key', true, id, { pack: name }), 60); }, i * 120)));
    }
    function key(k) {
      if (k === 'Escape') { close(); return; }
      const L = items(), it = L[sel];
      if (k === 'ArrowDown' || k === 'ArrowUp') { sel = (sel + (k === 'ArrowDown' ? 1 : L.length - 1)) % L.length; draw(); if (L[sel].sw) audition(L[sel].sw); return; }
      if ((k === 'ArrowLeft' || k === 'ArrowRight') && it.volume) { setVolume(Math.round((volume + (k === 'ArrowRight' ? .05 : -.05)) * 20) / 20); draw(); audition(sigName); return; }
      if (k === 'Enter' || k === ' ') {
        if (it.act) it.act();
        else if (it.sw) { setSignature(it.sw); playtest('switch: ' + it.sw); draw(); audition(it.sw); }
      }
    }
    // (not over a lost night's dark screen: the night is over, nothing to pause, and its keys are its own. The story audit,
    // 2026-10-06: a tab switch there opened the menu, which paused the dark screen's own timers and took no keys: frozen)
    function open(why) {
      if (opened || asleep) return;
      opened = true; page = 'main'; sel = 0;
      window.vigilTime?.pause();
      playtest(`menu open (${why})`);
      // the monitor off: the tube wakes to show the menu (the knob doesn't move), and goes dark again on resume
      if (!room.power) { woke = true; screenG.classList.remove('off'); terminal.classList.remove('off'); }
      catcher.style.display = '';
      draw();
    }
    function close() {
      if (!opened) return;
      opened = false; term.hideMenu();
      if (woke && !room.power) { screenG.classList.add('off'); terminal.classList.add('off'); }
      woke = false; catcher.style.display = 'none';
      playtest('menu closed');
      window.vigilTime?.resume();
    }
    return { open, close, key, get opened() { return opened; } };
  })();

  updateVitals();
  term.refresh();
  await wait(500);
  await term.boot([], firstAlert);
  clockedIn();
})();
