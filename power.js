/* power.js — POWER's rules (docs/proposals/cartridges-2026-10-11/POWER.md; decided by Arnold 2026-10-11, design.md section 5,
   "The last three cartridges, decided"; built on its own 2026-10-12, step 10's game without night 3's story). Pure: the page
   (app.js runPower) draws it on the tube (crt.js drawScope) and power-audit.js plays it at human speed, as heap.js and
   heap-audit.js.

   After the breaker, on battery. The room comes back one rack at a time, each through its own breaker, and a breaker can
   only be closed when the rack's supply is in step with the mains: a synchroscope, a needle going round a dial, in step
   when it points straight up. Space closes the breaker. Closed with the needle inside the window at the top, the rack comes
   back (its LEDs, its fans, its clients); outside it, the breaker trips: the rack jolts and stays dark, the battery takes
   the surge (`trip` UPS minutes), and the needle runs on. Four racks back and the room is back. Three trips and the main
   trips again: the game is lost and can be tried again after a wait, while the battery lasts.

   The needle hunts: its speed swings about its mean (`hunt`, 0 steady to under 1, where it all but stops at the slow end
   of each swing). The dial is the battery: the lower it is when you play, the faster and the more it hunts. Each rack's
   needle is a little faster than the last. There is no separate teaching game: the first rack's needle is the slowest. */
(function () {
  (typeof window !== 'undefined' ? window : global).createPower = function ({ racks = 4, speed = 160, hunt = .3, period = 2600, window: win = 18, trip = 2, rand = Math.random } = {}) {
    let rack = 0, theta = 0, t = 0, phase = 0, w = 0, state = 'running', trips = 0, upsLost = 0, jolt = 0;
    function setRack() {
      w = speed * (1 + .12 * rack); phase = rand() * Math.PI * 2;
      theta = 60 + rand() * 240;                    // it starts away from the top
    }
    setRack();
    const omega = () => w * (1 + hunt * Math.sin(2 * Math.PI * t / period + phase));   // degrees a second
    const off = () => { const a = ((theta % 360) + 360) % 360; return a > 180 ? a - 360 : a; };   // from the top, -180..180
    function close() {
      if (state !== 'running' || jolt > 0) return null;
      if (Math.abs(off()) <= win) { rack++; if (rack >= racks) state = 'won'; else setRack(); return 'closed'; }
      trips++; upsLost += trip; jolt = 1200;          // the rack jolts and goes dark; a moment before it can be tried again
      if (trips >= 3) state = 'lost';
      return 'tripped';
    }
    function tick(ms) {
      if (state !== 'running') return state;
      jolt = Math.max(0, jolt - ms);
      for (let k = 0; k < ms; k += 2) { theta += omega() * 2 / 1000; t += 2; }
      return state;
    }
    // where the needle will be in ms, from the top (for the audit's player, who watches it come round)
    function peek(ms) { let th = theta, tt = t; for (let k = 0; k < ms; k += 2) { th += w * (1 + hunt * Math.sin(2 * Math.PI * tt / period + phase)) * 2 / 1000; tt += 2; } const a = ((th % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
    return {
      close, tick, off, omega, peek, win, racks, mean: () => w,
      get rack() { return rack; }, get theta() { return theta; }, get state() { return state; }, get trips() { return trips; }, get upsLost() { return upsLost; }, get jolt() { return jolt; },
    };
  };
  // the dial: the battery's minutes left (57 at the breaker) set the needle's mean speed and how much it hunts
  (typeof window !== 'undefined' ? window : global).powerDial = ups => { const k = 1 - Math.max(0, Math.min(57, ups)) / 57; return { speed: 150 + 110 * k, hunt: .25 + .6 * k }; };
})();
