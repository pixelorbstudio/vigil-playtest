/* defrag.js — the DEFRAG cartridge's game: a stuck unit's disk, drawn on the tube as a grid of blocks.

   The disk is COLS x ROWS cells. A few files lie scattered across it in fragments; the rest is free. The player
   moves a cursor, picks a block up and puts it down somewhere else (swapping if the cell is taken). A file is
   whole when all its blocks sit side by side in one row; when every file is whole, the unit comes back. (The
   first build counted a run in reading order, wrapping from the end of one row to the start of the next. Nobody
   could guess that, so a file now has to sit in one row.)

   The opponent is the stuck unit itself: it keeps writing, and every few seconds it moves a block of one of its
   files into a free cell somewhere. A file you have made whole is safe: the unit only scatters files still in
   pieces, so progress sticks and the pressure is on what is left. The night turns its dial up: more files, and
   writes coming faster. headStart: the night's first game has one file a single block from whole, so the first
   move finishes a file and shows what whole looks like; the unit leaves that file alone so the lesson holds.
   Pure: the page draws it and runs its clock; defrag-audit.js checks it can be won. */
(function () {
  const COLS = 24, ROWS = 8, N = COLS * ROWS;

  window.createDefrag = function ({ files = 2, headStart = false, rand = Math.random } = {}) {
    const cells = new Array(N).fill(null);             // null: free; otherwise a file index
    const sizes = Array.from({ length: files }, () => 5 + Math.floor(rand() * 3));   // 5-7 blocks a file
    const col = i => i % COLS, row = i => Math.floor(i / COLS);
    // a stretch of len free cells inside one row, with a free cell (or the row's edge) either side
    function place(f, len) {
      for (let tries = 0; tries < 400; tries++) {
        const r = Math.floor(rand() * ROWS), c = Math.floor(rand() * (COLS - len + 1)), at = r * COLS + c;
        const lo = c > 0 ? at - 1 : at, hi = c + len < COLS ? at + len : at + len - 1;
        let ok = true;
        for (let i = lo; i <= hi; i++) if (cells[i] !== null) { ok = false; break; }
        if (ok) { for (let i = 0; i < len; i++) cells[at + i] = f; return at; }
      }
      return -1;
    }
    for (let f = 0; f < files; f++) {
      if (headStart && f === 0) {                        // all but one block together, the last one elsewhere
        place(f, sizes[f] - 1);
        let at; do at = Math.floor(rand() * N); while (cells[at] !== null || whole(f, at));
        cells[at] = f;
        continue;
      }
      // 2-3 fragments over random free stretches
      let left = sizes[f];
      const parts = 2 + Math.floor(rand() * 2);
      for (let p = 0; p < parts && left > 0; p++) {
        const len = p === parts - 1 ? left : Math.max(1, Math.round(left / (parts - p) + (rand() - .5) * 2));
        place(f, len);
        left -= len;
      }
    }
    const s = { cursor: 0, held: null, moves: 0 };   // held: the index a block was picked up from

    // the most of a file's blocks that sit side by side in one row
    function together(f) {
      let best = 0, run = 0;
      for (let i = 0; i < N; i++) {
        if (col(i) === 0) run = 0;                     // a run never carries over into the next row
        run = cells[i] === f ? run + 1 : 0;
        best = Math.max(best, run);
      }
      return best;
    }
    // whole: every block of the file in one unbroken run inside a row (extra: a cell about to become the file's)
    function whole(f, extra = -1) {
      const at = [];
      for (let i = 0; i < N; i++) if (cells[i] === f || i === extra) at.push(i);
      return at.length > 0 && row(at[0]) === row(at[at.length - 1]) && at[at.length - 1] - at[0] === at.length - 1;
    }
    const won = () => sizes.every((_, f) => whole(f));
    // how many pieces a file is in (runs inside rows), for the audit
    function runs(f) {
      let n = 0;
      for (let i = 0; i < N; i++) if (cells[i] === f && (col(i) === 0 || cells[i - 1] !== f)) n++;
      return n;
    }

    function move(dx, dy) {
      const x = (col(s.cursor) + dx + COLS) % COLS, y = (row(s.cursor) + dy + ROWS) % ROWS;
      s.cursor = y * COLS + x;
    }
    // space: pick up the block under the cursor, or put the held one down here (swapping if the cell is taken)
    function act() {
      if (s.held === null) { if (cells[s.cursor] !== null) s.held = s.cursor; return 'pick'; }
      if (s.held !== s.cursor) { [cells[s.held], cells[s.cursor]] = [cells[s.cursor], cells[s.held]]; s.moves++; }
      s.held = null;
      return 'drop';
    }
    // the unit writes: a block of a file still in pieces moves to a random free cell. Whole files are left alone,
    // and so is the block in your hand (and, in a first game, the file it is teaching with).
    function write() {
      const blocks = [], free = [];
      for (let i = 0; i < N; i++) { if (cells[i] === null) free.push(i); else if (i !== s.held && !whole(cells[i]) && !(headStart && cells[i] === 0)) blocks.push(i); }
      if (!blocks.length || !free.length) return null;
      const from = blocks[Math.floor(rand() * blocks.length)], to = free[Math.floor(rand() * free.length)];
      cells[to] = cells[from]; cells[from] = null;
      return { from, to };
    }
    return {
      COLS, ROWS, cells, sizes, move, act, write, won, whole, runs, together,
      get cursor() { return s.cursor; }, get held() { return s.held; }, get moves() { return s.moves; },
    };
  };
})();
