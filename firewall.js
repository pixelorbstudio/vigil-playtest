/* firewall.js — FIREWALL, the game (night 2's cartridge; its rules as decided: docs/proposals/cartridges-2026-10-11/FIREWALL.md
   and design.md section 5, "The last three cartridges, decided"; moved here from the proposal for build step 9, 2026-10-12).
   Pure: the page draws it (app.js runFirewall) and firewall-audit.js plays it at human speed.

   A unit probed from outside. The field is ROUTE's square grid, COLS x ROWS. The probes come down from the top (upstairs)
   in a block: they step sideways together every `march` ms, and at the field's edge they step down a row instead and turn.
   The fewer are left, the faster they step (the last one runs). You are the wall on the bottom row, three cells wide: left
   and right move it a cell, space sends one refusal straight up (one in flight at a time). A refusal that meets a probe
   takes it out. Refuse every probe and the unit is clean. Lose: a probe reaches the row above the wall (it got in), or the
   minute runs out.

   teach: the night's first game: two rows of probes, slow. */
(function () {
  const COLS = 20, ROWS = 11, WALL = ROWS - 1, SHOT_MS = 65;

  (typeof window !== 'undefined' ? window : global).createFirewall = function ({ rows = 4, per = 6, march = 600, top = 1, gap = 1, rand = Math.random } = {}) {
    // the block: `rows` rows of `per` probes, a cell apart, `gap` rows apart, its left edge random
    const width = per * 2 - 1, x0 = Math.floor(rand() * (COLS - width));
    let probes = [];
    for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) probes.push([x0 + i * 2, top + r * gap]);
    const total = probes.length;
    let wall = Math.floor(COLS / 2), shot = null, dir = rand() < .5 ? 1 : -1, sinceMarch = 0, sinceShot = 0, state = 'running', refused = 0;
    const pace = () => march * (.3 + .7 * probes.length / total);
    function hit() {
      if (!shot) return;
      const i = probes.findIndex(([x, y]) => x === shot[0] && y === shot[1]);
      if (i >= 0) { probes.splice(i, 1); shot = null; refused++; if (!probes.length) state = 'won'; }
    }
    function step() {
      const out = probes.some(([x]) => x + dir < 0 || x + dir >= COLS);
      if (out) { probes = probes.map(([x, y]) => [x, y + 1]); dir = -dir; } else probes = probes.map(([x, y]) => [x + dir, y]);
      hit();
      if (probes.some(([, y]) => y >= WALL - 1)) state = 'lost';
    }
    function move(dx) { if (state === 'running') wall = Math.max(1, Math.min(COLS - 2, wall + dx)); }
    function fire() { if (state !== 'running' || shot) return false; shot = [wall, WALL - 1]; sinceShot = 0; hit(); return true; }
    function tick(ms) {
      if (state !== 'running') return state;
      if (shot) { sinceShot += ms; while (shot && sinceShot >= SHOT_MS) { sinceShot -= SHOT_MS; shot = [shot[0], shot[1] - 1]; if (shot[1] < 0) shot = null; else hit(); } }
      sinceMarch += ms;
      while (state === 'running' && sinceMarch >= pace()) { sinceMarch -= pace(); step(); }
      return state;
    }
    return {
      COLS, ROWS, WALL, SHOT_MS, total, move, fire, tick, pace,
      get probes() { return probes; }, get wall() { return wall; }, get shot() { return shot; }, get dir() { return dir; },
      get state() { return state; }, get refused() { return refused; }, get sinceMarch() { return sinceMarch; },
    };
  };
})();
