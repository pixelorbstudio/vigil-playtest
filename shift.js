/* shift.js — the night shift: the clock, the incidents, uptime, and the operator's energy. Pure: it knows nothing
   about the page, so shift-audit.js can run whole nights in a second and check the pacing.

   23:00 to 05:30 is 390 shift minutes over ten real minutes (about 39 shift seconds a real second).
   Incidents only happen on units whose LED the player can see, so every alert shows in the room:
     DOWN  not responding, LED dark.       Fixed by `reboot`.
     HOT   running hot, LED pulses amber.  Fixed by `reroute`. Left alone for a shift hour it goes DOWN.
     STUCK fragmented, LED steady amber.   A reboot won't hold; only the DEFRAG cartridge fixes it. The first comes
           at 00:30. Once the racks have been calm a while (nothing DOWN or HOT for 30 shift minutes), the room
           gives up DEFRAG; after that, some of the night's trouble is STUCK.
   Quiet until 23:30; then one every 60-90 real seconds, tightening to 30-40 by 04:00, and faster for every
   unit left down (neglect snowballs). At most three open, never two on one unit. Uptime counts down-minutes
   over all 128 units (the four racks in Arnold's 1920 frame), like a real ops number.

   Energy is the operator's: it drains with time and with every fix. Coffee gives it back (the mug and the
   brewing are the page's; the beans are counted here). At zero you nod off: an hour of the shift passes with
   nobody at the desk, and you wake a little rested. Nod off a second time and the supervisor finds you asleep:
   relieved of duty. After 01:00, if uptime falls below the line, you are relieved too. */
(function () {
  const START = 23 * 60, SPAN = 6.5 * 60;          // minutes past midnight at the start; shift length
  const QUIET = 30, TIGHT = 300;                    // first incident at 23:30; fully tight by 04:00
  const TOTAL_UNITS = 128;
  const SNOWBALL = .25;                             // each unit left down makes incidents this much more frequent
  // Energy (decided with Arnold 2026-09-29). At rest it drains by the body clock (easy at 23:00, heaviest around
  // 03:30, easing toward dawn), faster while you sit idle, and faster for every problem left open: broken racks are
  // stressful, which is a reason to fix them now. Work costs by effort and pays a little back when it lands, a
  // cartridge win is a second wind, a loss knocks you down hard, and a game of Pong is a short break.
  const ENERGY = {
    start: 1,                                       // you arrive rested (Arnold, 2026-09-30; it was .9)
    perMin: 1 / 300,                                // the base: a full bar lasts five shift hours at a normal pace (tuned with shift-audit.js)
    cost: { reboot: .02, reroute: .01 },            // starting a fix
    refund: { DOWN: .01, HOT: .005 },               // when the fix lands (the unit back up, the heat gone)
    sip: .1,                                        // five sips to a mug
    stress: .20,                                    // drain +20% for each open problem
    idle: { after: 39, over: 39, most: .5 },        // idle past a real minute (39 shift min): drain rises to +50% over the next
    pong: .03,                                      // a game of Pong: a break, once per game
  };
  // the body clock: how hard the night weighs at shift minute t (0 = 23:00, 270 = 03:30, 390 = 05:30)
  const bodyClock = t => .8 + .25 * Math.min(1, t / 120) + .35 * Math.exp(-Math.pow((t - 270) / 75, 2));
  // strikes from the night supervisor: a unit down (or stuck) for L.strike.after shift minutes with nobody on it is one,
  // and it earns another every L.strike.again it stays that way. Time spent fixing it (a reboot, a DEFRAG game)
  // doesn't count. Three and you are relieved, at any hour.
  // The cartridges in the order the story hands them over, spread across the three nights (decided with Arnold
  // 2026-09-30: each night a stage with new games in it). A night starts with what the nights before gave you (you
  // know them now) and hands over its own in turn: night 1 DEFRAG then ROUTE, night 2 COOLANT then HEAP, night 3
  // POWER then the finale (each joins as it is built). A first win on one reveals the next (the fast path; Pong's
  // win reveals the night's first); failing that, from an hour after the last one turned up, half an hour of calm
  // racks brings it (the slow path), and at an hour and a half it comes on a timer, so nobody is left without it.
  const ORDER = ['PONG', 'DEFRAG', 'ROUTE', 'COOLANT', 'HEAP', 'POWER'];
  // first: when the first trouble comes (shift minutes; QUIET otherwise). quiet: windows with no new trouble, held
  // for the story (decided 2026-09-30: a drip, with quiet around story moments): 04:44 and the minute before it.
  // Night 1 starts at 23:10 (Arnold, 2026-09-30: the first five real minutes were 60-100% idle).
  const NIGHTS = [
    { start: ['PONG'], chain: ['DEFRAG', 'ROUTE'], first: 10, quiet: [[318, 352]] },
    { start: ['PONG', 'DEFRAG', 'ROUTE'], chain: [], quiet: [[318, 352]] },          // COOLANT, HEAP when built
    // night 3 starts mid-crisis (decided 2026-09-30): the night never ended, so you log in tired (energy 45%) to a unit
    // down and one stuck, each about 70 real seconds from its first strike, and a rack dropping packets; trouble comes
    // from the first minute and is at full rate by 01:00. With the finale at 03:00 this is what makes the run-up the test
    // (without it nobody lost night 3 before 03:00): a careful player relieved about a quarter of the time before then.
    // 45%, not 35%: at 35% the keys lagged in the first minute of triage (the controls fighting you, not the night);
    // the losses before 03:00 are all strikes, so it costs the night nothing
    { start: ['PONG', 'DEFRAG', 'ROUTE'], chain: [], crisis: { energy: .45, open: [['DOWN', 25], ['STUCK', 25], ['LOSS', 15]] }, ramp: { quiet: 0, tight: 120 } },   // POWER when built
  ];
  const SLOW = { wait: 60, calm: 30, latest: 90 };
  // cartridge trouble: the first of a kind half an hour after its cartridge turns up (or at the start, for one you
  // start the night with), then a share of the trouble. STUCK is fixed by DEFRAG, LOSS (a rack dropping packets)
  // by ROUTE. The rest is DOWN and HOT, the filler between games.
  const TROUBLE = { STUCK: { cart: 'DEFRAG', share: .22 }, LOSS: { cart: 'ROUTE', share: .22 } };
  const FIRST_AFTER = 30;
  const DIAL_FROM = 90;                             // DEFRAG's dial starts turning at 00:30
  const CART = { play: .05, win: .08, lose: .12 };   // playing a cartridge game; winning it (a second wind); losing it, on top

  /* How hard the night is (decided with Arnold 2026-09-29: it should be hard, and ramp up night after night the
     way the story does). A returning player knows the room and fixes things faster, so each night is tuned harder
     for a faster player (shift-audit.js prints all three):
       pace   incidents come this much more often than the base gap
       open   how many can be open at once
       strike shift minutes a unit may sit down with nobody on it before a strike, and between further ones
       hot    shift minutes a HOT unit lasts before it shuts down
       drain  the base energy drain, times this
       beans  refills of the mug in the night
       dial   DEFRAG's dial runs this many shift minutes ahead of the clock, and writes up to this much faster */
  const LEVELS = [
    // night 1: a careful first-timer (fixes within 40 s, drinks, plays DEFRAG) is relieved about one night in seven,
    // usually with a strike on the board and energy under 15% at some point; a quick one about one in thirty
    { pace: 1.3, open: 3, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: .95, beans: 3, dial: { ahead: 0, faster: 0 } },
    // night 2: more at once, and faster; a quick player is relieved about one night in five, a careful one in three
    { pace: 1.7, open: 4, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: 1.05, beans: 3, dial: { ahead: 0, faster: 0 } },
    // night 3: strikes come a little sooner, heat turns to outages sooner, DEFRAG plays as it would 15 minutes later
    // and writes faster. It starts mid-crisis (NIGHTS) and hands over to the finale at 03:00: before then a careful
    // player is relieved about one night in five, a slow one in three, a quick one almost never
    { pace: 1.9, open: 4, strike: { after: 55, again: 70, max: 3 }, hot: 45, drain: 1.05, beans: 3, dial: { ahead: 15, faster: .25 } },
  ];

  window.createShift = function ({ units, racks = ['rack-left', 'rack-right'], realMs = 900000, rand = Math.random, level = 1 }) {
    const L = LEVELS[Math.max(1, Math.min(LEVELS.length, level)) - 1], STRIKE = L.strike;
    const NIGHT = NIGHTS[LEVELS.indexOf(L)];
    const perMs = SPAN / realMs;                    // shift minutes per real millisecond
    const s = {
      t: 0,                                         // shift minutes since 23:00
      open: new Map(),                              // unit -> { kind, since, downSince, fixing }
      nextAt: NIGHT.ramp ? NIGHT.ramp.quiet : NIGHT.first ?? QUIET, hushUntil: -Infinity,
      over: false, ending: null, reason: null,      // 'dawn' | 'relieved' (for 'uptime' or 'asleep')
      energy: ENERGY.start, beans: L.beans, idle: 0,     // idle: shift minutes since the operator last did anything
      strikes: 0,
      seen: new Set(), found: new Map(NIGHT.start.map(c => [c, -FIRST_AFTER])), won: new Set(), calmSince: 0,   // found: cartridge -> when; seen: kinds of trouble met tonight
      strain: 1,                                    // how hard the screen is on the eyes: brightness slows or speeds the drain
      stats: { incidents: 0, fixed: 0, escalated: 0, downMin: 0, longest: { unit: null, min: 0 } },
    };
    // a night that starts mid-crisis: its energy, and what is already broken (shown by the page at login)
    const initial = [];
    if (NIGHT.crisis) {
      s.energy = NIGHT.crisis.energy;
      for (const [kind, ago] of NIGHT.crisis.open) {
        const free = units.filter(u => !s.open.has(u)), unit = free[Math.floor(rand() * free.length)];
        s.open.set(unit, { kind, since: -ago, downSince: kind === 'HOT' ? null : -ago, fixing: false, idle: ago, struck: 0 });
        s.seen.add(kind); s.stats.incidents++;
        initial.push({ type: 'incident', unit, kind });
      }
    }
    const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
    const downCount = () => [...s.open.values()].filter(i => i.kind === 'DOWN').length;
    // the next new trouble comes a gap after the crisis you log in to, not on top of it (it read as a timing accident)
    if (NIGHT.crisis) s.nextAt = gap();
    // the gap to the next incident, in shift minutes: what 60-90 real seconds are in a ten-minute night at
    // first, 30-40 from 04:00; shorter for every unit left down. Fixed in shift time, so a shorter test night
    // has the same incidents.
    function gap() {
      const R = NIGHT.ramp || { quiet: QUIET, tight: TIGHT };   // a night can have its own: night 3 is a storm from the start
      const u = (s.t - R.quiet) / (R.tight - R.quiet);
      const realS = lerp(60, 30, u) + rand() * lerp(30, 10, u);
      return realS * 1000 * SPAN / 600000 / L.pace / (1 + SNOWBALL * downCount());
    }
    function endOutage(unit, inc) {
      if (inc.downSince === null) return;
      const min = s.t - inc.downSince;
      if (min > s.stats.longest.min) s.stats.longest = { unit, min };
      inc.downSince = null;
    }
    function end(why, events, reason = null) {
      s.over = true; s.ending = why; s.reason = reason;
      for (const [unit, inc] of s.open) endOutage(unit, inc);
      events.push({ type: why, report: report() });
    }

    // advance by dt shift minutes; pushes what happened onto events
    function step(dt, events) {
      if (s.over) { s.t += dt; return; }
      s.t += dt;
      // energy at zero: you fall asleep at the desk, and that is the night (decided 2026-09-29)
      s.idle += dt;
      s.energy = Math.max(0, s.energy - dt * ENERGY.perMin * L.drain * drainFactor());
      if (s.energy <= 0) { end('relieved', events, 'asleep'); return; }
      for (const [unit, inc] of s.open) {
        if (inc.downSince !== null) s.stats.downMin += dt;
        if (inc.downSince !== null && !inc.fixing && !s.over) {
          inc.idle += dt;
          if (inc.idle >= STRIKE.after + inc.struck * STRIKE.again) {
            inc.struck++; s.strikes++;
            events.push({ type: 'strike', unit, n: s.strikes, min: Math.round(s.t - inc.downSince) });
            if (s.strikes >= STRIKE.max) end('relieved', events, 'strikes');
          }
        }
        if (inc.kind === 'HOT' && !inc.fixing && s.t - inc.since >= L.hot) {
          inc.kind = 'DOWN'; inc.since = s.t; inc.downSince = s.t; s.stats.escalated++;
          events.push({ type: 'escalate', unit });
        }
      }
      // held for the story: the night's quiet windows, and while the page says so (Glenn typing)
      const hushed = s.t < s.hushUntil || (NIGHT.quiet || []).some(([a, b]) => s.t >= a && s.t < b);
      if (s.t >= s.nextAt && !hushed) {
        s.nextAt = s.t + gap();
        // which trouble: a kind of cartridge trouble meets you first as soon as it can (its cartridge found half an
        // hour ago), then takes its share; the rest is DOWN or HOT. LOSS is a whole rack's.
        const ready = Object.entries(TROUBLE).filter(([, t]) => s.found.has(t.cart) && s.t >= s.found.get(t.cart) + FIRST_AFTER).map(([k]) => k);
        const fresh = ready.find(k => !s.seen.has(k));
        let kind = fresh;
        if (!kind) { let r = rand(); for (const k of ready) { if (r < TROUBLE[k].share) { kind = k; break; } r -= TROUBLE[k].share; } }
        if (!kind) kind = rand() < .55 ? 'HOT' : 'DOWN';
        const pool = (kind === 'LOSS' ? racks : units).filter(u => !s.open.has(u));
        if (!pool.length && kind === 'LOSS') kind = rand() < .55 ? 'HOT' : 'DOWN';
        const free = (kind === 'LOSS' ? racks : units).filter(u => !s.open.has(u));
        if (s.open.size < L.open && free.length && s.t < SPAN) {
          const unit = free[Math.floor(rand() * free.length)];
          s.seen.add(kind);
          s.open.set(unit, { kind, since: s.t, downSince: kind === 'HOT' ? null : s.t, fixing: false, idle: 0, struck: 0 });
          s.stats.incidents++;
          events.push({ type: 'incident', unit, kind });
        }
      }
      // calm: nothing DOWN or HOT for a while (cartridge trouble waits for its cartridge; it doesn't break the calm)
      const troubled = [...s.open.values()].some(i => i.kind === 'DOWN' || i.kind === 'HOT');
      if (troubled) s.calmSince = null; else if (s.calmSince === null) s.calmSince = s.t;
      const next = NIGHT.chain.find(c => !s.found.has(c)), lastAt = Math.max(0, ...s.found.values());
      if (next && s.t >= lastAt + SLOW.wait) {
        if (s.calmSince !== null && s.t - s.calmSince >= SLOW.calm) reveal(next, 'calm', events);
        else if (s.t >= lastAt + SLOW.latest) reveal(next, 'timer', events);
      }
      if (!s.over && s.t >= SPAN) end('dawn', events);
    }

    /* advance by dtMs real milliseconds; returns what happened, in order:
       incident {unit, kind} | escalate {unit} | strike {unit, n, min} | found {cart, how} | relieved {report} | dawn {report} */
    function tick(dtMs) {
      const events = [];
      step(dtMs * perMs, events);
      return events;
    }

    // a cartridge turns up in the drawer: how is 'won' (a first win on the one before), 'calm', 'timer' or 'dev'
    function reveal(cart, how, events) { s.found.set(cart, s.t); events.push({ type: 'found', cart, how }); }
    // a cartridge's game won; the first win reveals the next in the chain. Returns what happened.
    function won(cart) {
      const events = [];
      if (s.won.has(cart) || s.over) return events;
      s.won.add(cart);
      // the next in the story's order that this night hands over (Pong's win: the night's first)
      const next = cart === 'PONG' ? NIGHT.chain[0] : ORDER[ORDER.indexOf(cart) + 1];
      if (next && NIGHT.chain.includes(next) && !s.found.has(next)) reveal(next, 'won', events);
      return events;
    }

    // how much faster than the base energy drains right now, and why (the page's status line can explain it)
    function drainFactor() {
      const I = ENERGY.idle, idle = 1 + I.most * Math.max(0, Math.min(1, (s.idle - I.after) / I.over));
      return s.strain * bodyClock(s.t) * idle * (1 + ENERGY.stress * s.open.size);
    }
    // the operator did something (a key, a click): not idle any more
    function poke() { s.idle = 0; }

    // starting a fix: the verb has to match the trouble, and it costs energy. The fix completes with finish(unit).
    function fix(unit, verb) {
      const inc = s.open.get(unit);
      if (!inc) return { ok: false, reason: 'nothing wrong' };
      if (inc.fixing) return { ok: false, reason: 'already being fixed' };
      const need = { DOWN: 'reboot', HOT: 'reroute', STUCK: 'defrag', LOSS: 'route' }[inc.kind];
      if (verb !== need) return { ok: false, reason: { DOWN: 'not responding', HOT: 'running hot', STUCK: 'fragmented', LOSS: 'dropping packets' }[inc.kind], need };
      inc.fixing = true; s.idle = 0;
      s.energy = Math.max(0, s.energy - (verb === 'defrag' || verb === 'route' ? CART.play : ENERGY.cost[verb]));
      return { ok: true, kind: inc.kind };
    }
    // a cartridge game lost: the unit stays as it was, and it costs you
    function failed(unit) {
      const inc = s.open.get(unit);
      if (inc) inc.fixing = false;
      s.energy = Math.max(0, s.energy - CART.lose);
    }
    // how hard DEFRAG plays at this hour: more files and faster writes as the night goes on
    function defragDial() {
      const t = s.t + L.dial.ahead, u = Math.max(0, Math.min(1, (t - DIAL_FROM) / (330 - DIAL_FROM)));
      return { files: t < 150 ? 2 : t < 300 ? 3 : 4, writeEvery: 8 - 3 * u - L.dial.faster * u };
    }
    // how hard ROUTE plays at this hour (route-audit.js): more hops, more dead links, a faster train; night 3 more so.
    // The night's first game is the page's to make easy (teach).
    function routeDial() {
      const t = s.t + L.dial.ahead, u = Math.max(0, Math.min(1, (t - DIAL_FROM) / (330 - DIAL_FROM)));
      const late = LEVELS.indexOf(L) === 2 ? 1 : 0;
      return { hops: Math.round(6 + 3 * u) + late, dead: Math.round(2 + 6 * u) + 2 * late, tick: Math.round(160 - 30 * u) - 5 * late };
    }
    // a fix lands: a reboot or reroute pays a little back, a cartridge win (a stuck unit freed) is a second wind
    function finish(unit) {
      const inc = s.open.get(unit);
      if (!inc) return;
      s.energy = Math.min(1, s.energy + (inc.kind === 'STUCK' || inc.kind === 'LOSS' ? CART.win : ENERGY.refund[inc.kind] || 0));
      endOutage(unit, inc);
      s.open.delete(unit);
      s.stats.fixed++;
    }
    // a cartridge game won pays for itself (Arnold, 2026-09-30: winning used to leave you worse off, since the game's
    // minute of drain was more than the win gave back): energy goes back to where it was when the game began, plus
    // the bonus, if that is more than it is now
    function paidBack(e0, bonus) { s.energy = Math.min(1, Math.max(s.energy, e0 + bonus)); }
    // a sip of coffee; a scoop of beans for the next pot
    function drink() { s.energy = Math.min(1, s.energy + ENERGY.sip); }
    function spend(x) { s.energy = Math.max(0, s.energy - x); }
    // a short break (a game of Pong)
    function rest() { s.energy = Math.min(1, s.energy + ENERGY.pong); s.idle = 0; }
    // a dimmer screen is easier on the eyes: the page sets this from the brightness knob
    function setStrain(k) { s.strain = k; }
    // for trying things out (?dev in the page): make trouble now, or hand over a cartridge
    function inject(unit, kind) {
      if (s.open.has(unit) || s.over) return null;
      s.open.set(unit, { kind, since: s.t, downSince: kind === 'HOT' ? null : s.t, fixing: false, idle: 0, struck: 0 });
      s.seen.add(kind);
      s.stats.incidents++;
      return { type: 'incident', unit, kind };
    }
    function find(cart) { if (s.found.has(cart)) return null; const events = []; reveal(cart, 'dev', events); return events[0]; }
    function useBean() { if (s.beans <= 0) return false; s.beans--; return true; }
    // beans in (a delivery, Glenn's bag): the page plays the tube's chirp for it (app.js giveBeans)
    function addBeans(n = 1) { s.beans += n; return s.beans; }

    const uptime = () => 1 - s.stats.downMin / (TOTAL_UNITS * Math.max(s.t, 1e-9));
    function report() {
      const st = s.stats;
      return { uptime: uptime(), strikes: s.strikes, incidents: st.incidents, fixed: st.fixed, escalated: st.escalated, open: s.open.size,
        longest: st.longest, ending: s.ending, reason: s.reason, at: clock().slice(0, 5) };
    }
    // the shift clock as HH:MM:SS (it runs on past dawn)
    function clock() {
      const m = START + s.t, h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60), ss = Math.floor((m * 60) % 60);
      return [h, mm, ss].map(n => String(n).padStart(2, '0')).join(':');
    }
    return {
      // for trying things out (?dev): jump the clock forward to shift minute t, with nothing open
      skip: t => { s.t = Math.max(s.t, t); s.open.clear(); },
      // no new trouble for the next realMs (the page, while Glenn is typing)
      hush: realMs => { s.hushUntil = Math.max(s.hushUntil, s.t + realMs * perMs); },
      tick, fix, finish, failed, won, poke, rest, paidBack, drainFactor, defragDial, routeDial, drink, spend, setStrain, useBean, addBeans, inject, find, clock, uptime, report,
      get t() { return s.t; }, get over() { return s.over; }, get ending() { return s.ending; },
      get strikes() { return s.strikes; }, get energy() { return s.energy; }, get beans() { return s.beans; },
      found: cart => s.found.has(cart), foundAt: cart => s.found.get(cart) ?? null, startsWith: NIGHT.start, initial: () => initial.slice(),
      state: unit => s.open.get(unit) || null,
      // toStrike: shift minutes until this one's next strike (null while it can't give one: hot, or being fixed)
      open: () => [...s.open.entries()].map(([unit, inc]) => ({ unit, ...inc, forMin: s.t - inc.since,
        toStrike: inc.downSince === null || inc.fixing ? null : STRIKE.after + inc.struck * STRIKE.again - inc.idle })),
      CART, PONG_BREAK: ENERGY.pong, SPAN, STRIKE, level: LEVELS.indexOf(L) + 1,
    };
  };
})();
