/* shift.js — the night shift: the clock, the incidents, uptime, and the operator's energy. Pure: it knows nothing
   about the page, so shift-audit.js can run whole nights in a second and check the pacing.

   23:00 to 05:30 is 390 shift minutes over the shift's real minutes (SHIFTS: 22, 20, 26 and 28).
   Incidents only happen on units whose LED the player can see, so every alert shows in the room:
     DOWN  not responding, LED dark.       Fixed by `reboot`.
     HOT   running hot, LED pulses amber.  Fixed by `reroute`. Left alone for a shift hour it goes DOWN.
     STUCK fragmented, LED steady amber.   A reboot won't hold; only the DEFRAG cartridge fixes it.
     LOSS  a whole rack dropping packets.  Only the ROUTE cartridge fixes it.
     OOM   out of memory, stalled.         Only the HEAP cartridge fixes it (from shift 2).
     INTRUSION probed, bursts of amber.    Only the FIREWALL cartridge fixes it (night 2). It waits as HOT does: no strike
                                           clock; left an hour, the remote session shuts it down and it is DOWN.
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
     (a returning operator, a reminder); LOSS after one on every night (the simulation report, 2026-10-06, item 5: after
     three, the slow, idle and exploring players barely met ROUTE on night 1), and not before `after` shift minutes have passed since its cartridge turned
     up (time to read the mail that brought it). Clean: fixed before it earned a strike and never escalated, or
     cartridge trouble won on the first try; so a slow, careful player still moves on, at their own pace.
     The cartridge's time counts from its hand-over (handOver(cart), the page's: the moment it is in the drawer to be
     taken), not from the shift deciding to give it.
     Night 1's lessons (Arnold, 2026-10-07): the first STUCK and the first LOSS skip the gate, each coming `lesson` shift
     minutes after its cartridge is handed over, as the night's teaching game (a slow player rarely makes clean fixes, so
     the gate kept DEFRAG and ROUTE from them). Like any first of a kind it comes alone, after the night's first trouble,
     and waits for a clear board and the quiet. Mastery still decides when the kind joins the night's mix after that.
     Grace: the night's first problem, and the first of each kind, comes alone: nothing new until it is fixed, or until it
     has stood GRACE.stand shift minutes with nobody playing its game (the simulation report's Rerun 2; Arnold, 2026-10-10:
     a first STUCK left open held the night from 00:48 to 04:52). Then DOWN and HOT, of the kinds already met, come again as
     usual around it; it stays open, the first of its kind, for its own teaching game, and a lesson due meanwhile waits for
     the board to clear as before. */
  const GRACE = { stand: 8 };
  const MASTERY = { order: ['DOWN', 'HOT', 'STUCK', 'LOSS', 'OOM', 'INTRUSION'], needs: { STUCK: 'DEFRAG', LOSS: 'ROUTE', OOM: 'HEAP', INTRUSION: 'FIREWALL' }, need: [3, 1, 1], kindNeed: { LOSS: 1, OOM: 1, INTRUSION: 1 }, after: 10 };
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
    sip: .17, sips: 3,                              // three sips to a mug, 17% each: 51% a mug (Arnold, 2026-10-05; it was five of 10%)
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
  // know them now) and hands over its own in turn: night 1 DEFRAG then ROUTE, night 2 HEAP, night 3 FIREWALL and POWER
  // then the finale (each joins as it is built; COOLANT was cut, 2026-10-10). A first win on one reveals the next (the fast path; Pong's
  // win reveals the night's first); failing that, from an hour after the last one turned up, half an hour of calm
  // racks brings it (the slow path), and at an hour and a half it comes on a timer, so nobody is left without it.
  // (2026-10-11: FIREWALL is Glenn's gift, not the chain's: section 5, "The unlocks tell the story, decided")
  // (2026-10-12, step 9: FIREWALL is night 2's, handed over by Glenn himself in his pane; the page says so, not Vigil's mail)
  const ORDER = ['PONG', 'DEFRAG', 'ROUTE', 'HEAP', 'FIREWALL', 'POWER'];
  // first: when the first trouble comes (shift minutes; QUIET otherwise). quiet: windows with no new trouble, held
  // for the story (decided 2026-09-30: a drip, with quiet around story moments): 04:44 and the minute before it.
  // Night 1 starts at 23:10 (Arnold, 2026-09-30: the first five real minutes were 60-100% idle).
  const NIGHTS = [
    { start: ['PONG'], chain: ['DEFRAG', 'ROUTE'], first: 10, lesson: 10, quiet: [[318, 352]], deliveries: { streaks: true, bag: true } },
    // night 2 (shift 3; 2026-10-12, build step 9): its first trouble at 23:10, as night 1's, the gift down the tube in the
    // minutes before it (section 5, the simulation report's planned fixes: night 2's first beat in its first minute or two).
    // FIREWALL is its one new cartridge, Glenn's gift (section 5, "The unlocks tell
    // the story, decided"), handed over when the chain would hand one over (section 5, "The last three cartridges, decided"):
    // the night's first cartridge win of any kind (anyWin), else thirty calm minutes from 00:00, else 00:30 on a timer. Its
    // first INTRUSION is its teaching game, 10 shift minutes after the hand-over, alone (lesson, for INTRUSION only: the
    // night's other kinds come as before). (Its empty canister cut: Arnold, 2026-10-06.)
    { start: ['PONG', 'DEFRAG', 'ROUTE', 'HEAP'], chain: ['FIREWALL'], anyWin: true, first: 10, lesson: 10, lessonKinds: ['INTRUSION'], quiet: [[318, 352]], deliveries: { streaks: true, bag: true } },
    // night 3 starts mid-crisis (decided 2026-09-30): the night never ended, so you log in tired (energy 45%; 60% since
    // Arnold, 2026-10-06: energy carries over between nights but a night never starts under 60%) to a unit
    // down, one stuck and a rack dropping packets, all just broken (2026-10-02, the player always in control: they used
    // to be a minute from a strike); nothing new comes until you fix one of them. With the finale at 03:00 this is what makes the run-up the test
    // (without it nobody lost night 3 before 03:00): a careful player relieved about a quarter of the time before then.
    // 45%, not 35%: at 35% the keys lagged in the first minute of triage (the controls fighting you, not the night);
    // the losses before 03:00 are all strikes, so it costs the night nothing
    { start: ['PONG', 'DEFRAG', 'ROUTE', 'HEAP'], chain: [], crisis: { energy: .6, open: [['DOWN', 0], ['STUCK', 0], ['LOSS', 0]] }, first: 0, deliveries: { streaks: false, bag: false } },   // POWER when built
  ];
  const SLOW = { wait: 60, calm: 30, latest: 90 };
  // Deliveries (design.md, "Deliveries"; Arnold, 2026-10-02). Coffee is earned by working well and comes down the tube
  // from upstairs. A streak is three clean fixes in a row: clean is fixed within 35 shift minutes (about 80 real
  // seconds) of its alert, or cartridge trouble won on the first try; a strike, a slow fix or a lost game resets it.
  // One canister a streak, at most two a night. What's in it: a bag of beans if you have fewer than two, otherwise a
  // note from Glenn (night 2's empty second one is cut: Arnold, 2026-10-06); night 3 has none (but for the one in the blackout, the page's). Glenn's
  // bag comes at 02:00 on nights 1 and 2 whatever. Every night starts with one bag (LEVELS beans).
  const DELIVERY = { clean: 35, streak: 3, perNight: 2, low: 2, bagAt: 180 };
  // cartridge trouble: the first of a kind half an hour after its cartridge turns up (or at the start, for one you
  // start the night with), then a share of the trouble. STUCK is fixed by DEFRAG, LOSS (a rack dropping packets)
  // by ROUTE. The rest is DOWN and HOT, the filler between games.
  // OOM (a unit out of memory) by HEAP, from shift 2 (2026-10-11): once it has joined the night, STUCK, LOSS and OOM are
  // about 15% each, so cartridge trouble stays under half (section 5, "The last three cartridges, decided")
  // INTRUSION by FIREWALL, from shift 3 (2026-10-12, step 9): once it has joined, INTRUSION 12% and the other three 13% each
  const TROUBLE = { STUCK: { cart: 'DEFRAG', share: .22 }, LOSS: { cart: 'ROUTE', share: .22 }, OOM: { cart: 'HEAP', share: .15 }, INTRUSION: { cart: 'FIREWALL', share: .12 } };
  const SHARE_WITH_OOM = .15, SHARE_WITH_INTRUSION = .13;
  const CART_KINDS = { STUCK: 'defrag', LOSS: 'route', OOM: 'heap', INTRUSION: 'firewall' };   // cartridge trouble, by its fix's verb
  // INTRUSION waits as HOT does: no strike clock; left this many shift minutes it is shut down by the remote session, DOWN
  const INTRUDE = 60;
  const FIRST_AFTER = 30;                           // a cartridge you start the night with counts as found this long ago
  const DIAL_FROM = 90;                             // DEFRAG's dial starts turning at 00:30
  // (play is spent while the game runs, over its minute, not at its start: the bar visibly ticks down faster while you
  // play; what is left of it when the game ends is spent then, so a game costs what it always did. Arnold, 2026-10-05)
  const CART = { play: .05, win: .08, lose: .12 };   // playing a cartridge game; winning it (a second wind); losing it, on top
  // a unit whose game was just lost waits a real minute before its game can be played again (the simulation report,
  // 2026-10-06, item 4: the worst unit took 7 to 9 tries a night, each one another loss); its strike clock doesn't run
  // meanwhile, since the wait is the game's, not the player's
  // (DEFRAG's is half that: playtest round 4, 2026-10-10, a minute after a lost DEFRAG read as the game gone; ROUTE's stays)
  // (2026-10-12, the playtest of shifts 1 and 2: every cartridge's wait is 10 real seconds, DEFRAG, ROUTE, HEAP, FIREWALL; a
  // wait of half a minute or more read as the game taken away)
  const COOL_MS = 10000, COOL = {};

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
    // (drain 1.05 since 2026-10-07, the simulation report, item 6: at .95 energy didn't need managing on night 1)
    { pace: 1.3, open: 3, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: 1.05, beans: 1, dial: { ahead: 0, faster: 0 } },
    // night 2: more at once, and faster; a quick player is relieved about one night in five, a careful one in three
    { pace: 1.7, open: 4, strike: { after: 60, again: 75, max: 3 }, hot: 50, drain: 1.05, beans: 1, dial: { ahead: 0, faster: 0 } },
    // night 3: strikes come a little sooner, heat turns to outages sooner, DEFRAG plays as it would 15 minutes later
    // and writes faster. It starts mid-crisis (NIGHTS) and hands over to the finale at 03:00: before then a careful
    // player is relieved about one night in five, a slow one in three, a quick one almost never
    { pace: 1.9, open: 4, strike: { after: 55, again: 70, max: 3 }, hot: 45, drain: 1.05, beans: 1, dial: { ahead: 15, faster: .25 } },
  ];

  /* The four shifts (Arnold, 2026-10-10; design.md section 5, "Surface and focus, decided", 1): night 1, night 1 again,
     night 2, night 3, at 22, 20, 26 and 28 real minutes. A shift plays its night's LEVELS and NIGHTS; the clock is the
     night's (23:00 to 05:30 in shift minutes, so the trouble, the strikes and the beats keep their shift times and only
     the real minutes change). The repeat (again) is the same night: it starts from where the first one ended (the pace,
     the kinds of trouble met, the cartridges handed over: carry), its first trouble at 23:03. */
  /* The pressure ramp (design.md section 5, "Surface and focus, decided", 6 and 10; playtest round 4, 4; 2026-10-11, step 4):
     on shift 1 nothing drains from the login until the first fix lands (teaching is free); on night 1 (both its shifts) the
     most problems open at once follow the pace the player has earned (flow): open 2 at flow 0.6 to 4 at 1.5, so a good
     player is pushed and a struggling one never is. The drain stays flat at 1.05 (Arnold, 2026-10-11: ramping it with the
     flow pushed the slow and idle players, whose flow climbs while they run out of energy; it ramped 0.95 to 1.25). The
     repeat starts at the flow shift 1 ended on (carry), so at its dial. Nights 2 and 3 keep LEVELS' own. */
  const RAMP = { flow: [.6, 1.5], drain: 1.05, open: [2, 4] };
  const SHIFTS = [
    { level: 1, min: 22 },
    // HEAP is the repeat's (Arnold, 2026-10-11: compliance buys tools): obeying Glenn's clash order hands it over at once
    // ("Operator cooperation noted!"); refusing one (letting it stand) still brings it `after` shift minutes on, as a
    // "Scheduled release."; with no clash by `latest` (03:00, the end of the first clash window, 01:50 to 03:00), on a timer. Never a gate, and
    // never by a cartridge win (that would buy it without the compliance). Its first OOM comes NIGHTS[0].lesson shift
    // minutes after the hand-over, alone, as its teaching game.
    { level: 1, min: 20, again: true, first: 3, offer: { cart: 'HEAP', after: 15, latest: 240 } },
    { level: 2, min: 26 },
    { level: 3, min: 28 },
  ];
  // the shift a night is first played on (?level=2 in the page, the audits' levels)
  const shiftOf = level => SHIFTS.findIndex(S => S.level === level) + 1;
  window.SHIFTS = SHIFTS;
  // carry: what the night before left (Arnold, 2026-10-06; the page keeps it from 05:30): { energy, beans }, and for the
  // repeat { flow, kinds, met, carts } too. The beans carry as they are; the energy too, but a night never starts under FLOOR.
  // Without it a night starts rested, with LEVELS' beans.
  const FLOOR = .6;
  window.createShift = function ({ units, racks = ['rack-left', 'rack-right'], realMs = null, rand = Math.random, level = 1, shift: shiftNo = null, carry = null }) {
    shiftNo = Math.max(1, Math.min(SHIFTS.length, shiftNo || shiftOf(Math.max(1, Math.min(LEVELS.length, level)))));
    const SH = SHIFTS[shiftNo - 1];
    realMs = realMs || SH.min * 60000;
    const L = LEVELS[SH.level - 1], STRIKE = L.strike;
    const N0 = NIGHTS[SH.level - 1];
    // the repeat: the cartridges handed over the first time are the night's from its start, and its chain goes on from there
    const had = SH.again && carry && Array.isArray(carry.carts) ? carry.carts.filter(c => ORDER.includes(c)) : [];
    const NIGHT = { ...N0, ...(SH.first != null ? { first: SH.first } : {}),
      start: [...new Set([...N0.start, ...had])], chain: N0.chain.filter(c => !had.includes(c)) };
    // the shift's own offer (HEAP on the repeat), handed over by compliance or later (offer, below)
    const OFFER = SH.offer && !NIGHT.start.includes(SH.offer.cart) ? SH.offer : null;
    const perMs = SPAN / realMs;                    // shift minutes per real millisecond
    const s = {
      t: 0,                                         // shift minutes since 23:00
      open: new Map(),                              // unit -> { kind, since, downSince, fixing }
      nextAt: NIGHT.first ?? QUIET, hushUntil: -Infinity,
      over: false, ending: null, reason: null,      // 'dawn' | 'relieved' (for 'uptime' or 'asleep')
      energy: ENERGY.start, beans: L.beans, idle: 0,     // idle: shift minutes since the operator last did anything
      strikes: 0,
      streak: 0, sent: 0, bagSent: false, queue: [],    // deliveries: clean fixes in a row, canisters sent tonight, Glenn's bag, what is on its way
      playing: new Map(),                              // cartridge games running: unit -> play cost still to spend
      seen: new Set(), found: new Map(NIGHT.start.map(c => [c, -FIRST_AFTER])), won: new Set(), calmSince: 0,   // found: cartridge -> when; seen: kinds of trouble met tonight
      handed: new Map(NIGHT.start.map(c => [c, -FIRST_AFTER])),   // cartridge -> when the page handed it over (in the drawer, to be taken)
      strain: 1,                                    // how hard the screen is on the eyes: brightness slows or speeds the drain
      kinds: new Set(['DOWN']), cleanSince: 0,      // mastery: the kinds of trouble that come tonight; clean fixes since the last one joined
      flow: FLOW.start, holds: new Set(),           // the pace the player has earned; why the energy isn't draining now (Glenn teaching, the mail)
      stats: { incidents: 0, fixed: 0, escalated: 0, downMin: 0, longest: { unit: null, min: 0 } },
      offerAt: Infinity,                            // the shift's offer, once refused: when it comes anyway
    };
    // a night that starts mid-crisis: its energy, and what is already broken (shown by the page at login)
    const initial = [];
    if (carry) { s.energy = Math.max(FLOOR, Math.min(1, +carry.energy || 0)); if (Number.isFinite(+carry.beans)) s.beans = Math.max(0, Math.round(+carry.beans)); }
    if (NIGHT.crisis) {
      if (!carry) s.energy = NIGHT.crisis.energy;      // (carried, it is what the night before left, never under FLOOR)
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
    // the repeat starts at the pace the first one ended on, with the trouble already met (met: no first-of-a-kind grace,
    // no lesson for it again)
    if (SH.again && carry) {
      if (Number.isFinite(+carry.flow)) s.flow = Math.max(FLOW.min, Math.min(FLOW.max, +carry.flow));
      for (const k of carry.kinds || []) if (MASTERY.order.includes(k)) { s.kinds.add(k); s.seen.add(k); }
      for (const k of carry.met || []) if (MASTERY.order.includes(k)) s.seen.add(k);   // (met by a lesson, not yet in the mix: mastery adds it)
    }
    // the next new trouble comes a gap after the crisis you log in to, not on top of it (it read as a timing accident)
    if (NIGHT.crisis) s.nextAt = gap();
    // the ramp (RAMP): night 1's most open by the pace earned, its drain flat; the other nights', their own
    const ramp = () => Math.max(0, Math.min(1, (s.flow - RAMP.flow[0]) / (RAMP.flow[1] - RAMP.flow[0])));
    const drainNow = () => SH.level === 1 ? RAMP.drain : L.drain;
    const openNow = () => SH.level === 1 ? Math.round(RAMP.open[0] + (RAMP.open[1] - RAMP.open[0]) * ramp()) : L.open;
    // shift 1: nothing drains until the first fix lands
    const freeStart = () => shiftNo === 1 && !s.stats.fixed;
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
      if (!next || s.cleanSince < Math.min(NEED, MASTERY.kindNeed[next] ?? NEED)) return;
      const cart = MASTERY.needs[next];
      if (cart && !(s.handed.has(cart) && s.t >= s.handed.get(cart) + MASTERY.after)) return;
      s.kinds.add(next); s.cleanSince = 0;
    }
    // grace: the night's first problem, and the first of each kind, come alone, while they are new or being played
    const holding = i => i.first && (i.fixing || s.t - i.since < GRACE.stand);
    const grace = () => [...s.open.values()].some(holding) || (!!NIGHT.crisis && !s.stats.fixed);   // night 3: nothing new until you fix something
    // a first of a kind left standing past its grace: the night goes on around it, with the trouble already met
    const outstayed = () => [...s.open.values()].some(i => i.first && !holding(i));
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
        if (!freeStart()) s.energy = Math.max(0, s.energy - dt * ENERGY.perMin * drainNow() * drainFactor());
      }
      // a cartridge game running: its play cost, spent over a real minute of play
      for (const [unit, left] of s.playing) {
        const take = Math.min(left, CART.play * dt / (60000 * perMs));
        s.energy = Math.max(0, s.energy - take); s.playing.set(unit, left - take);
      }
      if (s.energy <= 0) { end('relieved', events, 'asleep'); return; }
      const teaching = s.holds.has('teach');
      for (const [unit, inc] of s.open) {
        if (inc.downSince !== null) s.stats.downMin += dt;
        if (teaching) continue;
        if (inc.downSince !== null && !inc.fixing && !s.over && !(inc.coolUntil > s.t)) {
          inc.idle += dt;
          if (inc.idle >= (inc.strikeAfter ?? STRIKE.after) + inc.struck * STRIKE.again) {
            inc.struck++; s.strikes++; s.streak = 0; ease();
            events.push({ type: 'strike', unit, kind: inc.kind, n: s.strikes, min: Math.round(s.t - inc.downSince) });
            if (s.strikes >= STRIKE.max) end('relieved', events, 'strikes');
          }
        }
        if (inc.kind === 'HOT' && !inc.fixing && s.t - inc.since >= L.hot) {
          inc.kind = 'DOWN'; inc.since = s.t; inc.downSince = s.t; inc.slow = true; s.stats.escalated++; ease();
          events.push({ type: 'escalate', unit });
        }
        // probed an hour with nobody on it: the remote session shuts it down, and it is DOWN (its strike clock from now)
        if (inc.kind === 'INTRUSION' && !inc.fixing && s.t - inc.since >= INTRUDE) {
          inc.kind = 'DOWN'; inc.since = s.t; inc.downSince = s.t; inc.slow = true; s.stats.escalated++; ease();
          events.push({ type: 'escalate', unit, from: 'INTRUSION' });
        }
      }
      // held for the story: the night's quiet windows, and while the page says so (Glenn typing)
      // (and while the page protects a Pong match: the chase for M.'s score, up to three a night, Arnold 2026-10-05)
      const hushed = s.t < s.hushUntil || s.protect || teaching || (NIGHT.quiet || []).some(([a, b]) => s.t >= a && s.t < b);
      learn();
      // a first of a kind just past its grace: the next trouble comes a gap from now, as after any other (not at once)
      for (const i of s.open.values()) if (i.first && !i.outstayed && !holding(i)) { i.outstayed = true; s.nextAt = Math.max(s.nextAt, s.t + gap()); }
      // night 1's lessons: the first STUCK or LOSS, `lesson` minutes after its cartridge's hand-over, whatever the gate says.
      // Once one is due nothing else new starts, so the board clears for it (a slow player's is rarely clear by itself)
      const lesson = NIGHT.lesson != null && s.stats.incidents > 0 && s.t < SPAN
        && MASTERY.order.find(k => MASTERY.needs[k] && (!NIGHT.lessonKinds || NIGHT.lessonKinds.includes(k)) && !s.seen.has(k) && s.handed.has(MASTERY.needs[k]) && s.t >= s.handed.get(MASTERY.needs[k]) + NIGHT.lesson);
      // (a first of a kind outstaying its grace doesn't hold the night for a lesson behind it: the night goes on, below)
      if (lesson && !outstayed()) {
        if (!s.open.size && !hushed) {
          const pool = lesson === 'LOSS' ? racks : units, unit = pool[Math.floor(rand() * pool.length)];
          s.seen.add(lesson);
          s.open.set(unit, { kind: lesson, since: s.t, downSince: lesson === 'INTRUSION' ? null : s.t, fixing: false, idle: 0, struck: 0, first: true, lesson: true });
          s.stats.incidents++;
          events.push({ type: 'incident', unit, kind: lesson, first: true, lesson: true });
        }
      } else if (s.t >= s.nextAt && !hushed && !grace()) {
        s.nextAt = s.t + gap();
        // which trouble: a kind that has just joined meets you first, alone; then cartridge trouble takes its share and
        // the rest is DOWN, or HOT once it has joined. LOSS is a whole rack's.
        // (around a first of a kind outstaying its grace: only DOWN, or HOT if it has been met; nothing new, no cartridge trouble)
        const around = outstayed();
        const fresh = around ? null : MASTERY.order.find(k => s.kinds.has(k) && !s.seen.has(k));
        const carts = around ? [] : Object.keys(TROUBLE).filter(k => s.kinds.has(k));
        let kind = fresh;
        const share = k => s.kinds.has('INTRUSION') ? (k === 'INTRUSION' ? TROUBLE.INTRUSION.share : SHARE_WITH_INTRUSION) : s.kinds.has('OOM') ? SHARE_WITH_OOM : TROUBLE[k].share;
        if (!kind) { let r = rand(); for (const k of carts) { if (r < share(k)) { kind = k; break; } r -= share(k); } }
        const filler = () => s.kinds.has('HOT') && (!around || s.seen.has('HOT')) && rand() < .55 ? 'HOT' : 'DOWN';
        if (!kind) kind = filler();
        if (kind === 'LOSS' && !racks.some(r => !s.open.has(r))) kind = filler();
        const free = (kind === 'LOSS' ? racks : units).filter(u => !s.open.has(u));
        // the first of a kind (or the night's first) waits for the board to be clear, so it really is alone
        const alone = kind === fresh || s.stats.incidents === 0;
        const room = alone ? !s.open.size : s.open.size < openNow();
        if (room && free.length && s.t < SPAN) {
          const unit = free[Math.floor(rand() * free.length)];
          s.seen.add(kind);
          s.open.set(unit, { kind, since: s.t, downSince: kind === 'HOT' || kind === 'INTRUSION' ? null : s.t, fixing: false, idle: 0, struck: 0, first: alone });
          s.stats.incidents++;
          events.push({ type: 'incident', unit, kind, first: alone });
        } else if (alone) s.nextAt = s.t + .5;      // a first one waits for a clear board, then comes promptly
      }
      // calm: nothing DOWN or HOT for a while (cartridge trouble waits for its cartridge; it doesn't break the calm)
      const troubled = [...s.open.values()].some(i => i.kind === 'DOWN' || i.kind === 'HOT');
      if (troubled) s.calmSince = null; else if (s.calmSince === null) s.calmSince = s.t;
      // the shift's offer, refused or not taken by its latest: it comes anyway
      if (OFFER && !s.found.has(OFFER.cart) && !s.over && (s.t >= s.offerAt || s.t >= OFFER.latest)) reveal(OFFER.cart, 'timer', events);
      const next = NIGHT.chain.find(c => !s.found.has(c)), lastAt = Math.max(0, ...[...s.found].filter(([c]) => !OFFER || c !== OFFER.cart).map(([, t]) => t));
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
    // the page has handed a cartridge over: it is in the drawer to be taken. Its trouble counts from here (MASTERY).
    function handOver(cart) { if (!s.handed.has(cart)) s.handed.set(cart, s.t); }
    // a cartridge's game won; the first win reveals the next in the chain. Returns what happened.
    function won(cart) {
      const events = [];
      if (s.won.has(cart) || s.over) return events;
      s.won.add(cart);
      // the next in the story's order that this night hands over (Pong's win: the night's first)
      // (night 2: the night's first cartridge win of any kind hands its one over: anyWin)
      const next = NIGHT.anyWin ? NIGHT.chain.find(c => !s.found.has(c)) : cart === 'PONG' ? NIGHT.chain[0] : ORDER[ORDER.indexOf(cart) + 1];
      if (next && NIGHT.chain.includes(next) && !s.found.has(next)) reveal(next, 'won', events);
      return events;
    }
    // Glenn's clash order answered (the page's): obeyed, the shift's offer is handed over now; refused, it comes `after`
    // shift minutes on. Returns what happened (a found event, or nothing).
    function offer(how) {
      const events = [];
      if (!OFFER || s.found.has(OFFER.cart) || s.over) return events;
      if (how === 'obeyed') reveal(OFFER.cart, 'obeyed', events);
      else if (how === 'refused') s.offerAt = Math.min(s.offerAt, s.t + OFFER.after);
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
    // (free: someone else's keys (aw's batch, night 2): the fix starts, and its effort isn't yours)
    function fix(unit, verb, free = false) {
      const inc = s.open.get(unit);
      if (!inc) return { ok: false, reason: 'nothing wrong' };
      if (inc.fixing) return { ok: false, reason: 'already being fixed' };
      const need = { DOWN: 'reboot', HOT: 'reroute', ...CART_KINDS }[inc.kind];
      if (verb !== need) return { ok: false, reason: { DOWN: 'not responding', HOT: 'running hot', STUCK: 'fragmented', LOSS: 'dropping packets', OOM: 'out of memory', INTRUSION: 'under probe' }[inc.kind], need };
      if (inc.coolUntil > s.t) return { ok: false, reason: 'cooling', waitMs: (inc.coolUntil - s.t) / perMs };
      inc.fixing = true; s.idle = 0;
      if (Object.values(CART_KINDS).includes(verb)) s.playing.set(unit, CART.play);     // (spent as the game runs)
      else if (!free) s.energy = Math.max(0, s.energy - ENERGY.cost[verb]);
      return { ok: true, kind: inc.kind };
    }
    // a cartridge game lost: the unit stays as it was, and it costs you
    // the end of a cartridge game: what is left of its play cost is spent now
    function settle(unit) { const left = s.playing.get(unit); if (left) s.energy = Math.max(0, s.energy - left); s.playing.delete(unit); }
    function failed(unit) {
      settle(unit);
      const inc = s.open.get(unit);
      if (inc) { inc.fixing = false; inc.tries = (inc.tries || 0) + 1; inc.coolUntil = s.t + (COOL[inc.kind] || COOL_MS) * perMs; }
      s.energy = Math.max(0, s.energy - CART.lose);
      s.streak = 0;
      ease();
    }
    // how hard DEFRAG plays at this hour: more files and faster writes as the night goes on
    function defragDial() {
      const t = s.t + L.dial.ahead, u = Math.max(0, Math.min(1, (t - DIAL_FROM) / (330 - DIAL_FROM)));
      // (the fourth file from 04:30, not 04:00: the simulation report, item 4: wins fell from 30-76% to 5-19% at 04:00)
      return { files: t < 150 ? 2 : t < 330 ? 3 : 4, writeEvery: 8 - 3 * u - L.dial.faster * u };
    }
    // how hard HEAP plays at this hour (heap-audit.js; section 5, "The last three cartridges, decided"): the heap deeper at
    // the start, more rows to free, a row falling faster, the unit allocating more often: from 00:30 4 rows (a gap each), 4
    // to free, a row every 750 ms, an allocation every 14 s; 02:00 5, 5, 600 ms, 11 s; 04:00 6 (two gaps a row), 5, 480 ms,
    // 9 s; shift 4 late 7 (two gaps), 6, 400 ms, 7.5 s. The night's first game is the page's to make easy (teach).
    const HEAP_DIAL = [[0, 4, 1, 4, 750, 14000], [180, 5, 1, 5, 600, 11000], [300, 6, 2, 5, 480, 9000]];
    function heapDial() {
      const t = s.t + L.dial.ahead;
      if (LEVELS.indexOf(L) === 2 && t >= 300) return { start: 7, holes: 2, target: 6, fall: 400, grow: 7500 };
      const [, start, holes, target, fall, grow] = HEAP_DIAL.filter(([at]) => t >= at).pop();
      return { start, holes, target, fall, grow };
    }
    // how hard FIREWALL plays at this hour (firewall-audit.js; section 5, "The last three cartridges, decided", made longer
    // by Arnold: a bigger, slower block): after the night's first (teaching) game, 24 probes (four rows of six), a step every
    // 600 ms; 02:00 28 (four of seven), 590 ms; 04:00 28, 540 ms; shift 4 late 32 (four of eight), 590 ms. The night's first
    // game is the page's to make easy (teach: two rows of eight, 800 ms).
    function firewallDial() {
      const t = s.t + L.dial.ahead;
      if (LEVELS.indexOf(L) === 2 && t >= 300) return { rows: 4, per: 8, march: 590 };
      return t >= 300 ? { rows: 4, per: 7, march: 540 } : t >= 180 ? { rows: 4, per: 7, march: 590 } : { rows: 4, per: 6, march: 600 };
    }
    // how hard ROUTE plays at this hour (route-audit.js): more hops, more dead links, a faster train; night 3 more so.
    // The night's first game is the page's to make easy (teach).
    // (2026-10-12, the playtest of shifts 1 and 2: a tester lost five in a row from 04:24, a rack down 72 minutes. The late
    // dial eased, ending at 02:30's old setting, 8 hops, 6 dead links, 140 ms, where it ended at 9, 8, 130; and every game lost
    // on the rack eases the next one a step, back toward the night's first settings, so a struggling player recovers: a hop
    // fewer, two dead links fewer, the train 10 ms slower a step, at most three steps, never easier than 5, 0, 170, the
    // teaching game. A win clears it (the trouble is gone). route-audit.js prints both.)
    const ROUTE_EASE = { hops: 1, dead: 2, tick: 10, most: 3 };
    function routeDial(unit) {
      const t = s.t + L.dial.ahead, u = Math.max(0, Math.min(1, (t - DIAL_FROM) / (330 - DIAL_FROM)));
      const late = LEVELS.indexOf(L) === 2 ? 1 : 0, k = Math.min(ROUTE_EASE.most, (unit && s.open.get(unit)?.tries) || 0);
      return { hops: Math.max(5, Math.round(6 + 2 * u) + late - k * ROUTE_EASE.hops), dead: Math.max(0, Math.round(2 + 4 * u) + 2 * late - k * ROUTE_EASE.dead),
        tick: Math.min(170, Math.round(160 - 20 * u) - 5 * late + k * ROUTE_EASE.tick), eased: k };
    }
    // a fix lands: a reboot or reroute pays a little back, a cartridge win (a stuck unit freed) is a second wind
    // theirs: a fix someone else typed on your keys (aw's, night 2): the unit is back, and nothing of it is yours: no refund,
    // no streak, no pace, no mastery (2026-10-12, step 9; the story audit's fix 2: off your streak, as off your merit)
    function finish(unit, theirs = false) {
      settle(unit);
      const inc = s.open.get(unit);
      if (!inc) return;
      if (theirs) { endOutage(unit, inc); s.open.delete(unit); s.stats.fixed++; s.lastQuick = false; if (inc.first) s.nextAt = Math.max(s.nextAt, s.t + gap()); return false; }
      s.energy = Math.min(1, s.energy + (CART_KINDS[inc.kind] ? CART.win : ENERGY.refund[inc.kind] || 0));
      endOutage(unit, inc);
      s.open.delete(unit);
      s.stats.fixed++;
      // clean or not: mastery counts it, and the pace follows it
      const cart = !!CART_KINDS[inc.kind];
      const clean = cart ? !inc.tries : !inc.slow && !inc.struck;
      const quick = clean && (cart || s.t - inc.since <= FLOW.quick);
      if (clean) s.cleanSince++;
      if (quick) s.flow = Math.min(FLOW.max, s.flow + FLOW.up); else if (!clean) ease();
      // a delivery streak counts the quick clean ones (design.md, Deliveries: within 35 shift minutes, or won first try)
      streakAfter(quick);
      s.lastQuick = quick;                            // (the board: a clean fix, within 35 shift minutes, earns more)
      // after a first one, a breath before the next
      if (inc.first) s.nextAt = Math.max(s.nextAt, s.t + gap());
      learn();
      return clean;
    }
    // the energy holds still while the page says so: hold('glenn', true) while Glenn teaches, hold('mail', true) while
    // the mail is open
    // hold('teach', true): Glenn is waiting on a lesson (design.md section 5, "Surface and focus, decided", 6: one command,
    // then wait for the hands). The night holds its breath: no drain, nothing new, no strike clock and no heat turning into
    // a unit down; let go, the next trouble is a gap away if it came due meanwhile, as after any other (not at once, for
    // the time the lesson took; not later than it was due if it hadn't)
    function hold(why, on) {
      if (why === 'teach' && !on && s.holds.has('teach') && s.nextAt <= s.t) s.nextAt = s.t + gap();
      if (on) s.holds.add(why); else s.holds.delete(why);
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
    // (opts.strikeAfter: shift minutes before its first strike, if not STRIKE.after: night 2's R17, the order to leave it down)
    function inject(unit, kind, opts = {}) {
      if (s.open.has(unit) || s.over) return null;
      s.open.set(unit, { kind, since: s.t, downSince: kind === 'HOT' || kind === 'INTRUSION' ? null : s.t, fixing: false, idle: 0, struck: 0, ...(opts.strikeAfter ? { strikeAfter: opts.strikeAfter } : {}) });
      s.seen.add(kind); s.kinds.add(kind);
      s.stats.incidents++;
      return { type: 'incident', unit, kind };
    }
    // a small trouble for the lull (app.js LULL, 2026-10-12: no real minute of dead air in night 1's long stretches): the
    // kind the night has already shown you, HOT if you have met it, else DOWN, on a unit the page picks
    function lull(unit) { return inject(unit, s.seen.has('HOT') ? 'HOT' : 'DOWN'); }
    function find(cart) { if (s.found.has(cart)) return null; const events = []; reveal(cart, 'dev', events); return events[0]; }
    function useBean() { if (s.beans <= 0) return false; s.beans--; return true; }
    // beans in (a delivery, Glenn's bag): the page plays the tube's chirp for it (app.js giveBeans)
    function addBeans(n = 1) { s.beans += n; return s.beans; }

    const uptime = () => 1 - s.stats.downMin / (TOTAL_UNITS * Math.max(s.t, 1e-9));
    function report() {
      const st = s.stats;
      return { uptime: uptime(), strikes: s.strikes, incidents: st.incidents, fixed: st.fixed, escalated: st.escalated, open: s.open.size,
        longest: st.longest, downMin: st.downMin, ending: s.ending, reason: s.reason, at: clock().slice(0, 5) };
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
      // no new trouble at all while on (a protected Pong match); what is open still counts toward its strikes
      protect: on => { s.protect = !!on; },
      // POWER (2026-10-12, built on its own: no unit's trouble behind it): its play cost spent as it runs, as a unit's game's
      // is (playing), and what is left of it spent when it ends (settle); its win and loss are the page's (paidBack, spend)
      play: key => { s.playing.set(key, CART.play); s.idle = 0; }, settle,
      get lastQuick() { return !!s.lastQuick; },
      tick, fix, finish, failed, hold, won, offer, heapDial, firewallDial, handOver, poke, rest, paidBack, drainFactor, defragDial, routeDial, drink, spend, setStrain, useBean, addBeans, inject, lull, find, clock, uptime, report,
      get t() { return s.t; }, get over() { return s.over; }, get ending() { return s.ending; },
      get strikes() { return s.strikes; }, get energy() { return s.energy; }, get beans() { return s.beans; }, get playing() { return s.playing.size > 0; },
      get flow() { return s.flow; }, get offered() { return OFFER ? OFFER.cart : null; }, get kinds() { return [...s.kinds]; }, get held() { return [...s.holds]; }, MASTERY, FLOW, GRACE,
      get streak() { return s.streak; }, get sent() { return s.sent; }, DELIVERY,
      found: cart => s.found.has(cart), foundAt: cart => s.found.get(cart) ?? null, handedAt: cart => s.handed.get(cart) ?? null, startsWith: NIGHT.start, initial: () => initial.slice(),
      state: unit => s.open.get(unit) || null,
      // toStrike: shift minutes until this one's next strike (null while it can't give one: hot, or being fixed)
      // cooling: real ms until a lost game can be played again (0: it can)
      cooling: unit => { const inc = s.open.get(unit); return inc && inc.coolUntil > s.t ? (inc.coolUntil - s.t) / perMs : 0; },
      open: () => [...s.open.entries()].map(([unit, inc]) => ({ unit, ...inc, forMin: s.t - inc.since,
        toStrike: inc.downSince === null || inc.fixing ? null : (inc.strikeAfter ?? STRIKE.after) + inc.struck * STRIKE.again - inc.idle })),
      CART, PONG_BREAK: ENERGY.pong, SPAN, STRIKE, INTRUDE, level: LEVELS.indexOf(L) + 1,
      // which of the four shifts this is (1..4), whether it is a night played again on purpose (the repeat), its real length
      no: shiftNo, again: !!SH.again, realMs, SHIFTS,
      // what the next shift starts from (the page saves it at 05:30): energy, beans, the pace, the kinds met, the cartridges handed over
      carryOut: () => ({ energy: +s.energy.toFixed(3), beans: s.beans, flow: +s.flow.toFixed(3), kinds: [...s.kinds], met: [...s.seen], carts: [...s.handed.keys()] }),
    };
  };
})();
