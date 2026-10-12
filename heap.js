/* heap.js — HEAP's rules (docs/proposals/cartridges-2026-10-11/HEAP.md; decided by Arnold 2026-10-11, design.md section 5,
   "The last three cartridges, decided"; built 2026-10-11, step 8). Pure: the page (app.js runHeap) draws it on the tube and
   heap-audit.js plays it at human speed, as route.js and route-audit.js.

   A unit out of memory: its heap is a well COLS x ROWS that starts part full of fragmented allocations (rows with a gap or
   two). Allocations fall in, one at a time (the seven four-block shapes); left and right move one, up turns it, down drops
   it. A full row is freed: it goes, and everything above comes down a row. Free `target` rows inside the minute and the
   unit runs again. The opponent is the unit itself: every `grow` ms it allocates a fragmented row under the heap, pushing
   it up (it waits for the falling one to land, so nothing is pushed into your hands). Lose: the heap reaches the top (a new
   allocation can't come in), or the minute runs out.

   teach: the night's first game. The bottom rows share one gap and the first allocation is the long one, so the first drop
   frees them and shows what freeing looks like; nothing grows. */
(function () {
  const COLS = 10, ROWS = 16;
  const SHAPES = {                                   // each as its four cells in rotation 0, turned about its box
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const BOX = { I: 4, O: 4 };                        // the turning box (3 for the rest)
  function turned(name, r) {
    const n = BOX[name] || 3; let cs = SHAPES[name];
    for (let k = 0; k < (r & 3); k++) cs = cs.map(([x, y]) => [n - 1 - y, x]);
    return cs;
  }

  (typeof window !== 'undefined' ? window : global).createHeap = function ({ start = 5, holes = 1, target = 4, fall = 700, grow = 0, teach = false, rand = Math.random } = {}) {
    const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));   // 0 free, 1 allocated
    const gapCol = Math.floor(rand() * COLS);
    const junk = (gaps) => { const row = new Array(COLS).fill(1); const g = new Set(gaps); while (g.size < holes) g.add(Math.floor(rand() * COLS)); for (const c of g) row[c] = 0; return row; };
    for (let i = 0; i < start; i++) grid[ROWS - 1 - i] = teach ? junk([gapCol]) : junk([]);
    if (teach) for (let i = 0; i < start; i++) grid[ROWS - 1 - i] = grid[ROWS - 1 - i].map((v, c) => (c === gapCol ? 0 : 1));
    let count = 0, bag = [], piece = null, state = 'running', freed = 0, lastFreed = [], locks = 0, sinceFall = 0, sinceGrow = 0, owed = 0, first = teach;
    const next = () => { if (first) { first = false; return 'I'; } if (!bag.length) { bag = Object.keys(SHAPES); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } } return bag.pop(); };
    let queued = next();
    const cells = (p = piece) => turned(p.name, p.r).map(([x, y]) => [p.x + x, p.y + y]);
    const fits = p => cells(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !grid[y][x]));
    function spawn() {
      // (wholly in the well from the moment it comes in, its top row on the well's first: it came in a row higher, half of
      // it above the well, and you couldn't see what it was; the playtest, 2026-10-12). It waits a row's fall there before it
      // falls, so it reaches the heap when it did when it came in a row higher.
      piece = { name: queued, r: 0, x: 3, y: -Math.min(...turned(queued, 0).map(c => c[1])) }; count++; sinceFall -= fall;
      queued = next();
      if (!fits(piece)) { state = 'lost'; return; }
    }
    function lock() {
      for (const [x, y] of cells()) { if (y < 0) { state = 'lost'; return 0; } grid[y][x] = 1; }
      let n = 0; locks++;
      // (lastFreed: the rows freed by this landing, as they stood before they went, for the page's flash)
      lastFreed = []; for (let y = 0; y < ROWS; y++) if (grid[y].every(v => v)) lastFreed.push(y);
      for (let y = ROWS - 1; y >= 0; y--) if (grid[y].every(v => v)) { grid.splice(y, 1); grid.unshift(new Array(COLS).fill(0)); n++; y++; }
      freed += n;
      if (freed >= target) { state = 'won'; return n; }
      // the unit's allocations owed while this one fell come in under the heap now
      for (; owed > 0; owed--) { if (grid[0].some(v => v)) { state = 'lost'; return n; } grid.shift(); grid.push(junk([])); }
      spawn();
      return n;
    }
    function move(dx) { if (state !== 'running') return false; const p = { ...piece, x: piece.x + dx }; if (fits(p)) { piece = p; return true; } return false; }
    function turn() {
      if (state !== 'running') return false;
      for (const dx of [0, -1, 1]) { const p = { ...piece, r: (piece.r + 1) & 3, x: piece.x + dx }; if (fits(p)) { piece = p; return true; } }
      return false;
    }
    function drop() { if (state !== 'running') return 0; while (fits({ ...piece, y: piece.y + 1 })) piece.y++; return lock(); }
    // time passes: gravity, and the unit's own allocations
    function tick(ms) {
      if (state !== 'running') return state;
      sinceFall += ms;
      if (grow) { sinceGrow += ms; while (sinceGrow >= grow) { sinceGrow -= grow; owed++; } }
      while (sinceFall >= fall && state === 'running') {
        sinceFall -= fall;
        if (fits({ ...piece, y: piece.y + 1 })) piece.y++; else lock();
      }
      return state;
    }
    spawn();
    return {
      COLS, ROWS, grid, move, turn, drop, tick, cells, fits, turned, target,
      get piece() { return piece; }, get count() { return count; }, get queued() { return queued; }, get state() { return state; }, get freed() { return freed; }, get lastFreed() { return lastFreed; }, get locks() { return locks; },
      height: () => { for (let y = 0; y < ROWS; y++) if (grid[y].some(v => v)) return ROWS - y; return 0; },
    };
  };
  (typeof window !== 'undefined' ? window : global).HEAP_SHAPES = { SHAPES, turned, COLS, ROWS };
})();
