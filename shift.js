/* shift.js — the night shift: the clock, the incidents, uptime, and the operator's energy. Pure: it knows nothing
   about the page, so shift-audit.js can run whole nights in a second and check the pacing.

   23:00 to 05:30 is 390 shift minutes over ten real minutes (about 39 shift seconds a real second).
   Incidents only happen on units whose LED the player can see, so every alert shows in the room:
     DOWN  not responding, LED dark.       Fixed by `reboot`.
     HOT   running hot, LED pulses amber.  Fixed by `reroute`. Left alone for a shift hour it goes DOWN.
     STUCK fragmented, LED steady amber.   A reboot won't hold; only the DEFRAG cartridge fixes it.
     LOSS  a whole rack dropping packets.  Only the ROUTE cartridge fixes it.
   Difficulty is earned, not scheduled (Eugene's playtest, 2026-10-02; design.md, "The player is always in control"):
   the kinds of trouble arrive by mastery, one at a time (DOWN, then HOT after clean DOWN fixes, then STUCK once DEFRAG
   is in the drawer, then LOSS once ROUTE is), each first one alone until it is fixed; and the pace follows the player
   (clean fixes bring the next one a little sooner, slow fixes, strikes and lost games ease it off, and every problem
   left open stretches the gap). The clock is only the deadline. Never two on one unit. Uptime counts down-minutes
   over all 128 units (the four racks in Arnold's 1920 frame), like a real ops number.

   Energy is the operator's: it drains with time and with every fix. Coffee gives it back (the mug and the
   brewing are the page's; the beans are counted here). At zero you nod off: an hour of the shift passes with
   nobody at the desk, and you wake a little rested. Nod off a second time and the supervisor finds you asleep:
   relieved of duty. After 01:00, if uptime falls below the line, you are relieved too. */
(function () {
  const START = 23 * 60, SPAN = 6.5 * 60;          // minutes past midnight at the start; shift length
  const QUIET = 30;                                 // first incident at 23:30 (a night can say otherwise)
  const TOTAL_UNITS = 128;
  /* Mastery (Eugene, 2026-10-02: "once the player masters one stage, the game introduces the next variable").
     The kinds come in this order. A kind joins when what it needs is there (its cartridge in the drawer) and the
     player has made `need` clean fixes since the last kind joined: three on night 1 (learning), one on a later night
     (a returning operator, a reminder), and not before `after` shift minutes have passed since its cartridge turned
     up (time to read the mail that brought it). Clean: fixed before it earned a strike and never escalated, or
     cartridge trouble won on the first try; so a slow, careful player still moves on, at their own pace.
     Grace: the night's first problem, and the first of each kind, comes alone: nothing new until it is fixed. */
  const MASTERY = { order: ['DOWN', 'HOT', 'STUCK', 'LOSS'], needs: { STUCK: 'DEFRAG', LOSS: 'ROUTE' }, need: [3, 1, 1], after: 10 };
  /* The pace follows the player (flow): a quick clean fix (inside `quick` shift minutes of the alert, about 80 real
     seconds) brings the next trouble a little sooner, a clean but slow one leaves the pace where it is, and a strike,
     an escalation or a lost game eases it off. Each problem left open stretches the gap by `open`. The gap is `base` to
     base + spread real seconds at flow 1, over the night's pace. */
  const FLOW = { start: 1, up: .08, down: .2, min: .6, max: 1.5, open: .5, base: 50, spread: 25, quick: 35 };
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
    idle: { after: 78, over: 78, most: .15 },       // idle past two real minutes: drain rises to +15% over the next two (Eugene: standing still to look around costs little)
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
    { start: ['PONG'], chain: ['DEFRAG', 'ROUTE'], first: 10, quiet: [[318, 352]], deliveries: { streaks: true, bag: true } },
    { start: ['PONG', 'DEFRAG', 'ROUTE'], chain: [], quiet: [[318, 352]], deliveries: { streaks: true, bag: true, empty: 2 } },          // COOLANT, HEAP when built
    // night 3 starts mid-crisis (decided 2026-09-30): the night never ended, so you log in tired (energy 45%) to a unit
    // down, one stuck and a rack dropping packets, all just broken (2026-10-02, the player always in control: they used
    // to be a minute from a strike); nothing new comes until you fix one of them. With the finale at 03:00 this is what makes the run-up the test
    // (without it nobody lost night 3 before 03:00): a careful player relieved about a quarter of the time before then.
    // 45%, not 35%: at 35% the keys lagged in the first minute of triage (the controls fighting you, not the night);
    // the losses before 03:00 are all strikes, so it costs the night nothing
    { start: ['PONG', 'DEFRAG', 'ROUTE'], chain: [], crisis: { energy: .45, open: [['DOWN', 0], ['STUCK', 0], ['LOSS', 0]] }, first: 0, deliveries: { streaks: false, bag: false } },   // POWER when built
  ];
  const SLOW = { wait: 60, calm: 30, latest: 90 };
  // Deliveries (design.md, "Deliveries"; Arnold, 2026-10-02). Coffee is earned by working well and comes down the tube
  // from upstairs. A streak is three clean fixes in a row: clean is fixed within 35 shift minutes (about 80 real
  // seconds) of its alert, or cartridge trouble won on the first try; a strike, a slow fix or a lost game resets it.
  // One canister a streak, at most two a night. What's in it: a bag of beans if you have fewer than two, otherwise a
  // note from Glenn. Night 2's second is empty; night 3 has none (but for the one in the blackout, the page's). Glenn's
  // bag comes at 02:00 on nights 1 and 2 whatever. Every night starts with one bag (LEVELS beans).
  const DELIVERY = { clean: 35, streak: 3, perNight: 2, low: 2, bagAt: 180 };
  // cartridge trouble: the first of a kind half an hour after its cartridge turns up (or at the start, for one you
  // start the night with), then a share of the trouble. STUCK is fixed by DEFRAG, LOSS (a rack dropping packets)
  // by ROUTE. The rest is DOWN and HOT, the filler between games.
  const TROUBLE = { STUCK: { cart: 'DEFRAG', share: .22 }, LOSS: { cart: 'ROUTE', share: .22 } };
  const FIRST_AFTER = 30;                           // a cartridge you start the night with counts as found this long ago
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
       beans  bags of beans to start the night with (a bag is a pot; more come by the tube)
       dial   DEFRAG's dial runs this many shift minutes ahead of the clock, and writes up to this much faster */
  const LEVELS = [
    // night 1: a careful first-timer (fixes within 40 s, drinks, plays DEFRAG) is relieved about one night in seven,
    // usually with a strike on the board and energy under 15% at some point; a quick one about one in thirty
    { pace: 1.3, open: 3, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: .95, beans: 1, dial: { ahead: 0, faster: 0 } },
    // night 2: more at once, and faster; a quick player is relieved about one night in five, a careful one in three
    { pace: 1.7, open: 4, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: 1.05, beans: 1, dial: { ahead: 0, faster: 0 } },
    // night 3: strikes come a little sooner, heat turns to outages sooner, DEFRAG plays as it would 15 minutes later
    // and writes faster. It starts mid-crisis (NIGHTS) and hands over to the finale at 03:00: before then a careful
    // player is relieved about one night in five, a slow one in three, a quick one almost never
    { pace: 1.9, open: 4, strike: { after: 55, again: 70, max: 3 }, hot: 45, drain: 1.05, beans: 1, dial: { ahead: 15, faster: .25 } },
  ];

  window.createShift = function ({ units, racks = ['rack-left', 'rack-right'], realMs = 900000, rand = Math.random, level = 1 }) {
    const L = LEVELS[Math.max(1, Math.min(LEVELS.length, level)) - 1], STRIKE = L.strike;
    const NIGHT = NIGHTS[LEVELS.indexOf(L)];
    const perMs = SPAN / realMs;                    // shift minutes per real millisecond
    const s = {
      t: 0,                                         // shift minutes since 23:00
      open: new Map(),                              // unit -> { kind, since, downSince, fixing }
      nextAt: NIGHT.first ?? QUIET, hushUntil: -Infinity,
      over: false, ending: null, reason: null,      // 'dawn' | 'relieved' (for 'uptime' or 'asleep')
      energy: ENERGY.start, beans: L.beans, idle: 0,     // idle: shift minutes since the operator last did anything
      strikes: 0,
      streak: 0, sent: 0, bagSent: false, queue: [],    // deliveries: clean fixes in a row, canisters sent tonight, Glenn's bag, what is on its way
      seen: new Set(), found: new Map(NIGHT.start.map(c => [c, -FIRST_AFTER])), won: new Set(), calmSince: 0,   // found: cartridge -> when; seen: kinds of trouble met tonight
      strain: 1,                                    // how hard the screen is on the eyes: brightness slows or speeds the drain
      kinds: new Set(['DOWN']), cleanSince: 0,      // mastery: the kinds of trouble that come tonight; clean fixes since the last one joined
      flow: FLOW.start, holds: new Set(),           // the pace the player has earned; why the energy isn't draining now (Glenn teaching, the mail)
      stats: { incidents: 0, fixed: 0, escalated: 0, downMin: 0, longest: { unit: null, min: 0 } },
    };
    // a night that starts mid-crisis: its energy, and what is already broken (shown by the page at login)
    const initial = [];
    if (NIGHT.crisis) {
      s.energy = NIGHT.crisis.energy;
      for (const [kind, ago] of NIGHT.crisis.open) {
        const pool = kind === 'LOSS' ? racks : units, free = pool.filter(u => !s.open.has(u)), unit = free[Math.floor(rand() * free.length)];
        s.open.set(unit, { kind, since: -ago, downSince: kind === 'HOT' ? null : -ago, fixing: false, idle: ago, struck: 0 });
        s.seen.add(kind); s.stats.incidents++;
        initial.push({ type: 'incident', unit, kind });
      }
    }
    const NEED = MASTERY.need[Math.min(LEVELS.indexOf(L), MASTERY.need.length - 1)];
    // a night that starts mid-crisis already has what it opened with
    for (const i of s.open.values()) s.kinds.add(i.kind);
    // the next new trouble comes a gap after the crisis you log in to, not on top of it (it read as a timing accident)
    if (NIGHT.crisis) s.nextAt = gap();
    // the gap to the next incident, in shift minutes: FLOW.base to base + spread real seconds (in a fifteen-minute night),
    // sooner as the player earns it (flow), longer for every problem already open. Fixed in shift time, so a shorter
    // test night has the same incidents.
    function gap() {
      const realS = (FLOW.base + rand() * FLOW.spread) / (L.pace * s.flow) * (1 + FLOW.open * s.open.size);
      return realS * 1000 * SPAN / 900000;
    }
    // the player's hand on the pace: a clean fix speeds it a little, trouble eases it
    const ease = () => { s.flow = Math.max(FLOW.min, s.flow - FLOW.down); };
    // the next kind of trouble joins once it can (its cartridge here a little while) and the last one is mastered
    function learn() {
      const next = MASTERY.order.find(k => !s.kinds.has(k));
      if (!next || s.cleanSince < NEED) return;
      const cart = MASTERY.needs[next];
      if (cart && !(s.found.has(cart) && s.t >= s.found.get(cart) + MASTERY.after)) return;
      s.kinds.add(next); s.cleanSince = 0;
    }
    // grace: the night's first problem, and the first of each kind, come alone
    const grace = () => [...s.open.values()].some(i => i.first) || (!!NIGHT.crisis && !s.stats.fixed);   // night 3: nothing new until you fix something
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
      if (!s.holds.size) {                            // held: Glenn teaching, the mail open (Eugene, 2026-10-02)
        s.idle += dt;
        s.energy = Math.max(0, s.energy - dt * ENERGY.perMin * L.drain * drainFactor());
      }
      if (s.energy <= 0) { end('relieved', events, 'asleep'); return; }
      for (const [unit, inc] of s.open) {
        if (inc.downSince !== null) s.stats.downMin += dt;
        if (inc.downSince !== null && !inc.fixing && !s.over) {
          inc.idle += dt;
          if (inc.idle >= STRIKE.after + inc.struck * STRIKE.again) {
            inc.struck++; s.strikes++; s.streak = 0; ease();
            events.push({ type: 'strike', unit, n: s.strikes, min: Math.round(s.t - inc.downSince) });
            if (s.strikes >= STRIKE.max) end('relieved', events, 'strikes');
          }
        }
        if (inc.kind === 'HOT' && !inc.fixing && s.t - inc.since >= L.hot) {
          inc.kind = 'DOWN'; inc.since = s.t; inc.downSince = s.t; inc.slow = true; s.stats.escalated++; ease();
          events.push({ type: 'escalate', unit });
        }
      }
      // held for the story: the night's quiet windows, and while the page says so (Glenn typing)
      const hushed = s.t < s.hushUntil || (NIGHT.quiet || []).some(([a, b]) => s.t >= a && s.t < b);
      learn();
      if (s.t >= s.nextAt && !hushed && !grace()) {
        s.nextAt = s.t + gap();
        // which trouble: a kind that has just joined meets you first, alone; then cartridge trouble takes its share and
        // the rest is DOWN, or HOT once it has joined. LOSS is a whole rack's.
        const fresh = MASTERY.order.find(k => s.kinds.has(k) && !s.seen.has(k));
        const carts = Object.keys(TROUBLE).filter(k => s.kinds.has(k));
        let kind = fresh;
        if (!kind) { let r = rand(); for (const k of carts) { if (r < TROUBLE[k].share) { kind = k; break; } r -= TROUBLE[k].share; } }
        const filler = () => s.kinds.has('HOT') && rand() < .55 ? 'HOT' : 'DOWN';
        if (!kind) kind = filler();
        if (kind === 'LOSS' && !racks.some(r => !s.open.has(r))) kind = filler();
        const free = (kind === 'LOSS' ? racks : units).filter(u => !s.open.has(u));
        // the first of a kind (or the night's first) waits for the board to be clear, so it really is alone
        const alone = kind === fresh || s.stats.incidents === 0;
        const room = alone ? !s.open.size : s.open.size < L.open;
        if (room && free.length && s.t < SPAN) {
          const unit = free[Math.floor(rand() * free.length)];
          s.seen.add(kind);
          s.open.set(unit, { kind, since: s.t, downSince: kind === 'HOT' ? null : s.t, fixing: false, idle: 0, struck: 0, first: alone });
          s.stats.incidents++;
          events.push({ type: 'incident', unit, kind, first: alone });
        } else if (alone) s.nextAt = s.t + .5;      // a first one waits for a clear board, then comes promptly
      }
      // calm: nothing DOWN or HOT for a while (cartridge trouble waits for its cartridge; it doesn't break the calm)
      const troubled = [...s.open.values()].some(i => i.kind === 'DOWN' || i.kind === 'HOT');
      if (troubled) s.calmSince = null; else if (s.calmSince === null) s.calmSince = s.t;
      const next = NIGHT.chain.find(c => !s.found.has(c)), lastAt = Math.max(0, ...s.found.values());
      if (next && s.t >= lastAt + SLOW.wait) {
        if (s.calmSince !== null && s.t - s.calmSince >= SLOW.calm) reveal(next, 'calm', events);
        else if (s.t >= lastAt + SLOW.latest) reveal(next, 'timer', events);
      }
      // Glenn's bag, at 02:00 on the nights that have it; and whatever a streak has sent
      const D = NIGHT.deliveries || {};
      if (D.bag && !s.bagSent && s.t >= DELIVERY.bagAt && !s.over) { s.bagSent = true; events.push({ type: 'delivery', why: 'bag', kind: 'beans' }); }
      while (s.queue.length) events.push(s.queue.shift());
      if (!s.over && s.t >= SPAN) end('dawn', events);
    }
    // a fix landed or a game was won: clean or not, the streak goes on or starts again; a third clean one sends a canister
    function streakAfter(clean) {
      if (!clean) { s.streak = 0; return; }
      if (++s.streak < DELIVERY.streak) return;
      s.streak = 0;
      const D = NIGHT.deliveries || {};
      if (!D.streaks || s.sent >= DELIVERY.perNight || s.over) return;
      s.sent++;
      const kind = D.empty === s.sent ? 'empty' : s.beans < DELIVERY.low ? 'beans' : 'note';
      s.queue.push({ type: 'delivery', why: 'streak', kind, n: s.sent });
    }

    /* advance by dtMs real milliseconds; returns what happened, in order:
       incident {unit, kind} | escalate {unit} | strike {unit, n, min} | found {cart, how} | delivery {why: streak|bag, kind:
       beans|note|empty, n} | relieved {report} | dawn {report} */
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
      if (inc) { inc.fixing = false; inc.tries = (inc.tries || 0) + 1; }
      s.energy = Math.max(0, s.energy - CART.lose);
      s.streak = 0;
      ease();
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
      // clean or not: mastery counts it, and the pace follows it
      const cart = inc.kind === 'STUCK' || inc.kind === 'LOSS';
      const clean = cart ? !inc.tries : !inc.slow && !inc.struck;
      const quick = clean && (cart || s.t - inc.since <= FLOW.quick);
      if (clean) s.cleanSince++;
      if (quick) s.flow = Math.min(FLOW.max, s.flow + FLOW.up); else if (!clean) ease();
      // a delivery streak counts the quick clean ones (design.md, Deliveries: within 35 shift minutes, or won first try)
      streakAfter(quick);
      // after a first one, a breath before the next
      if (inc.first) s.nextAt = Math.max(s.nextAt, s.t + gap());
      learn();
      return clean;
    }
    // the energy holds still while the page says so: hold('glenn', true) while Glenn teaches, hold('mail', true) while
    // the mail is open
    function hold(why, on) { if (on) s.holds.add(why); else s.holds.delete(why); }
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
      s.seen.add(kind); s.kinds.add(kind);
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
      tick, fix, finish, failed, hold, won, poke, rest, paidBack, drainFactor, defragDial, routeDial, drink, spend, setStrain, useBean, addBeans, inject, find, clock, uptime, report,
      get t() { return s.t; }, get over() { return s.over; }, get ending() { return s.ending; },
      get strikes() { return s.strikes; }, get energy() { return s.energy; }, get beans() { return s.beans; },
      get flow() { return s.flow; }, get kinds() { return [...s.kinds]; }, get held() { return [...s.holds]; }, MASTERY, FLOW,
      get streak() { return s.streak; }, get sent() { return s.sent; }, DELIVERY,
      found: cart => s.found.has(cart), foundAt: cart => s.found.get(cart) ?? null, startsWith: NIGHT.start, initial: () => initial.slice(),
      state: unit => s.open.get(unit) || null,
      // toStrike: shift minutes until this one's next strike (null while it can't give one: hot, or being fixed)
      open: () => [...s.open.entries()].map(([unit, inc]) => ({ unit, ...inc, forMin: s.t - inc.since,
        toStrike: inc.downSince === null || inc.fixing ? null : STRIKE.after + inc.struck * STRIKE.again - inc.idle })),
      CART, PONG_BREAK: ENERGY.pong, SPAN, STRIKE, level: LEVELS.indexOf(L) + 1,
    };
  };
})();
