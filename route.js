/* route.js — the ROUTE cartridge's game: a rack dropping packets, played as Snake (design.md, ROUTE).

   The rack's network is a grid of square nodes, COLS x ROWS. You are a packet train that comes in at the rack's
   uplink on the left edge and keeps moving; the arrows steer it. The hops show one at a time: reach one and the next
   appears elsewhere, and each adds a car to the train (more traffic in flight). When the last hop is reached the core
   port opens on the right edge; deliver the train into it and the rack's traffic flows again.

   A crash (a dead link, a wall, your own train) drops a packet: the train comes back in at the uplink, as long as it
   was, keeping the hops it reached. The third drop loses the route. (The first build lost on the first crash, and a
   game was over in eight seconds; a cartridge game should have weight.) The page runs the clock and the pace.

   The night turns the dial: more hops, a faster train, more dead links. Dead links and hops are placed so every
   hop and the port can be reached from the uplink. Pure: the page draws it; route-audit.js plays it. */
(function () {
  const COLS = 20, ROWS = 11, DROPS = 3;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  window.createRoute = function ({ hops = 4, dead = 0, rand = Math.random } = {}) {
    const key = (x, y) => x + ',' + y;
    const midY = Math.floor(ROWS / 2);
    let train = [], dir, next, state = 'running', reached = 0, drops = 0;
    // the train enters from the uplink heading right, its cars trailing back off the board
    function enter(len) { train = Array.from({ length: len }, (_, i) => [2 - i, midY]); dir = next = DIRS.right; }
    enter(3);
    const port = [COLS - 1, 1 + Math.floor(rand() * (ROWS - 2))];
    // the lane in front of the uplink and the cells around the port stay clear
    const reserved = new Set();
    for (let x = 0; x <= 5; x++) reserved.add(key(x, midY));
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]) reserved.add(key(port[0] + dx, port[1] + dy));
    const deadSet = new Set();
    const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
    // can (x, y) be reached from the uplink around the dead links?
    function reachable(targets) {
      const seen = new Set([key(0, midY)]), queue = [[0, midY]];
      while (queue.length) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of Object.values(DIRS)) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (!inside(nx, ny) || seen.has(k) || deadSet.has(k)) continue;
          seen.add(k); queue.push([nx, ny]);
        }
      }
      return targets.every(t => seen.has(key(...t)));
    }
    const pick = (ok, margin = 2) => {
      for (let tries = 0; tries < 500; tries++) {
        const x = margin + Math.floor(rand() * (COLS - 2 * margin)), y = Math.floor(rand() * ROWS);
        if (ok(x, y)) return [x, y];
      }
      return null;
    };
    // dead links, one at a time, each kept only if the port stays reachable
    for (let i = 0; i < dead; i++) {
      const s = pick((x, y) => !reserved.has(key(x, y)) && !deadSet.has(key(x, y)));
      if (!s) continue;
      deadSet.add(key(...s));
      if (!reachable([port])) deadSet.delete(key(...s));
    }
    // the hop on the board now: somewhere free, reachable, not under the train, a little way from its head
    let hop = null;
    function nextHop() {
      if (reached >= hops) { hop = null; return; }
      const [hx, hy] = train[0];
      hop = pick((x, y) => !reserved.has(key(x, y)) && !deadSet.has(key(x, y)) && !train.some(([a, b]) => a === x && b === y)
        && Math.abs(x - hx) + Math.abs(y - hy) >= 5 && reachable([[x, y]]));
    }
    nextHop();

    // steer: never straight back into yourself
    function steer(name) {
      const d = DIRS[name]; if (!d || state !== 'running') return;
      if (d[0] === -dir[0] && d[1] === -dir[1]) return;
      next = d;
    }
    // one step of the train: 'running', 'dropped' (a crash, and it came back in), 'won' or 'lost'
    function step() {
      if (state !== 'running') return state;
      dir = next;
      const [hx, hy] = train[0], nx = hx + dir[0], ny = hy + dir[1], k = key(nx, ny);
      if (!hop && nx === port[0] && ny === port[1]) { train.unshift([nx, ny]); state = 'won'; return state; }
      const grows = hop && nx === hop[0] && ny === hop[1];
      const body = grows ? train : train.slice(0, -1);
      if (!inside(nx, ny) || deadSet.has(k) || body.some(([x, y]) => x === nx && y === ny)) {
        drops++;
        if (drops >= DROPS) { state = 'lost'; return state; }
        enter(train.length);
        return 'dropped';
      }
      train.unshift([nx, ny]);
      if (grows) { reached++; nextHop(); } else train.pop();
      return state;
    }
    return {
      COLS, ROWS, DROPS, steer, step, port,
      get state() { return state; }, get dir() { return dir; }, get train() { return train; },
      deadLinks: [...deadSet].map(k => k.split(',').map(Number)),
      hop: () => hop, reached: () => reached, total: hops, drops: () => drops,
      open: () => !hop,
      // for the audit's player: the grid as it stands
      blocked: (x, y) => !inside(x, y) || deadSet.has(key(x, y)) || train.some(([a, b]) => a === x && b === y),
    };
  };
})();
