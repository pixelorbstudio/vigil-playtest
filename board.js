/* board.js — the board (design.md section 5, "The board"; docs/proposals/the-promotion-2026-10-05.md, section 7 and v1 3.2
   to 3.4): the six sites' night operators ranked live by merit. Pure, so the page (app.js, "the board") and
   shift-audit.js run the same numbers.

   Your merit is honest: attendance (half a point a shift minute at the console with the tube on), work (a fix 10, a
   clean one 5 more, a cartridge won 25, a strike -100) and conduct (an order obeyed 50, a canister opened 50, an order
   refused -40). The other five run on par curves held within about 15% of you: each is your merit times (1 + its
   offset), and the offsets cross zero at the night's beats (5th by about 23:45, 4th about 01:00, 3rd at the turn,
   about 02:00, 2nd about 03:30; ek stays just ahead). The pull follows you up at once and down over about 30 shift
   minutes, so a refusal or a strike drops you visibly and you climb back. At 05:30 the company puts you first on a
   clocked-out night 1 (finalize): it is the company's board, not Vigil the system's, and the report beside it shows
   your honest numbers. */
(function () {
  const RIVALS = [
    { op: 'ek', site: 1 }, { op: 'cv', site: 3 }, { op: 'dn', site: 2 }, { op: 'hb', site: 6 }, { op: 'rd', site: 5 },
  ];
  // each rival's offset over the night (shift minutes, fraction of your merit), night 1
  const OFFSETS = {
    1: {
      ek: [[0, .18], [200, .08], [300, .05], [344, .035], [390, .035]],
      cv: [[0, .16], [250, .03], [270, 0], [290, -.025], [390, -.05]],
      dn: [[0, .15], [160, .03], [180, 0], [200, -.03], [390, -.07]],
      hb: [[0, .14], [100, .03], [120, 0], [150, -.05], [390, -.10]],
      rd: [[0, .12], [40, .02], [45, 0], [60, -.06], [120, -.12], [390, -.14]],
    },
  };
  const MERIT = { minute: .5, fix: 10, clean: 5, win: 25, strike: -100, obeyed: 50, canister: 50, refused: -40 };
  const PULL_DOWN = 30;                                // shift minutes for the pull to close a drop
  const at = (pts, t) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
    return pts[pts.length - 1][1];
  };
  // a little life in each rival's number, the same every time (no randomness: a replay shows the same board), fading
  // out as the rival nears you, so a pass happens once, not back and forth
  const wobble = (i, t, off) => 2.5 * Math.sin(t / (7 + i * 3) + i * 1.7) * Math.min(1, Math.abs(off) / .06);
  const ORD = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

  window.createBoard = function ({ level = 1, you = 'you' } = {}) {
    const offs = OFFSETS[Math.min(level, 1)] || OFFSETS[1];
    const m = { attendance: 0, work: 0, conduct: 0 }, counts = { fixes: 0, clean: 0, wins: 0, strikes: 0, obeyed: 0, refused: 0, canisters: 0 };
    let base = 0, t = 0, fixed = null;                  // fixed: the 05:30 board, once the company has written it
    const total = () => m.attendance + m.work + m.conduct;
    function add(line, n) { m[line] += n; if (total() > base) base = total(); }
    const B = {
      MERIT, ORD,
      // the shift clock moved on dt minutes; attending: at the console with the tube on
      tick(dtMin, attending) {
        t += dtMin;
        if (attending) add('attendance', MERIT.minute * dtMin);
        if (total() < base) base += (total() - base) * Math.min(1, dtMin / PULL_DOWN);
      },
      fix(clean) { counts.fixes++; add('work', MERIT.fix); if (clean) { counts.clean++; add('work', MERIT.clean); } },
      win() { counts.wins++; add('work', MERIT.win); },
      strike() { counts.strikes++; add('work', MERIT.strike); },
      obeyed() { counts.obeyed++; add('conduct', MERIT.obeyed); },
      canister() { counts.canisters++; add('conduct', MERIT.canister); },
      refused() { counts.refused++; add('conduct', MERIT.refused); },
      get merit() { return { total: Math.round(total()), attendance: Math.round(m.attendance), work: Math.round(m.work), conduct: Math.round(m.conduct) }; },
      get counts() { return { ...counts }; },
      get t() { return t; },
      // the rows, best first: { op, site, merit, you }; ties go against you (you have the least service)
      rows(now = t) {
        if (fixed) return fixed.map(r => ({ ...r }));
        const b = Math.max(base, 0);
        // (ordered by the unrounded numbers: rounded, two nearly level flickered past each other)
        const rows = RIVALS.map((r, i) => ({ op: r.op, site: r.site, raw: Math.max(0, b * (1 + at(offs[r.op], now)) + Math.min(1, b / 200) * wobble(i, now, at(offs[r.op], now))), you: false }));
        rows.push({ op: you, site: 4, raw: total(), you: true });
        return rows.sort((a, c) => c.raw - a.raw || (a.you ? 1 : c.you ? -1 : 0)).map(({ raw, ...r }) => ({ ...r, merit: Math.round(raw) }));
      },
      rank(now = t) { return B.rows(now).findIndex(r => r.you) + 1; },
      // 05:30 on a clocked-out night: you first, the others as they stood, under you
      finalize() {
        const rows = B.rows(), mine = Math.round(total());
        let gap = 4;
        fixed = [{ op: you, site: 4, merit: mine, you: true }, ...rows.filter(r => !r.you).map(r => ({ ...r, merit: Math.min(r.merit, mine - (gap += 3 + (r.op.charCodeAt(0) % 5))) }))];
        return fixed;
      },
      setYou(name) { you = name; },
    };
    return B;
  };
  // the nights before tonight on the board, newest first: ek topped the two before yours (night 1 was ek's review)
  window.boardNightsBefore = function (date) {
    const day = n => { const d = new Date(date.getTime() - n * 864e5); return d.toDateString().slice(4, 10); };
    return [['ek', 918], ['ek', 884], ['cv', 902], ['dn', 871], ['ek', 893], ['rd', 860], ['cv', 879], ['ek', 905], ['hb', 852], ['dn', 888]].map(([op, merit], i) => ({ date: day(i + 1), op, merit }));
  };
  window.BOARD = { RIVALS, MERIT, ORD };
})();
