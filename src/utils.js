import { TILE, MAP_COLS, MAP_ROWS } from './constants.js';

let _idCounter = 0;
export function genId() {
  return ++_idCounter;
}

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function norm(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function tileToWorld(tx, ty) {
  return {
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2
  };
}

export function worldToTile(wx, wy) {
  return {
    tx: Math.floor(wx / TILE),
    ty: Math.floor(wy / TILE)
  };
}

// A* pathfinding
export function astar(start, goal, isBlocked) {
  const key = (t) => `${t.tx},${t.ty}`;

  // If start == goal
  if (start.tx === goal.tx && start.ty === goal.ty) return [goal];

  // Check if goal is blocked - find nearest non-blocked tile
  if (isBlocked(goal.tx, goal.ty)) {
    // Try adjacent tiles
    const adj = [
      { tx: goal.tx - 1, ty: goal.ty },
      { tx: goal.tx + 1, ty: goal.ty },
      { tx: goal.tx, ty: goal.ty - 1 },
      { tx: goal.tx, ty: goal.ty + 1 },
      { tx: goal.tx - 1, ty: goal.ty - 1 },
      { tx: goal.tx + 1, ty: goal.ty - 1 },
      { tx: goal.tx - 1, ty: goal.ty + 1 },
      { tx: goal.tx + 1, ty: goal.ty + 1 }
    ];
    let found = null;
    for (const a of adj) {
      if (a.tx >= 0 && a.tx < MAP_COLS && a.ty >= 0 && a.ty < MAP_ROWS && !isBlocked(a.tx, a.ty)) {
        found = a;
        break;
      }
    }
    if (!found) return [goal]; // Fallback
    goal = found;
  }

  const heuristic = (t) => Math.abs(t.tx - goal.tx) + Math.abs(t.ty - goal.ty);

  // Open set as sorted array (simple priority queue)
  const openSet = [];
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  const startKey = key(start);
  gScore[startKey] = 0;
  fScore[startKey] = heuristic(start);
  openSet.push({ tile: start, f: fScore[startKey] });

  const closedSet = new Set();

  const neighbors = (t) => {
    const result = [];
    const dirs = [
      { tx: t.tx - 1, ty: t.ty },
      { tx: t.tx + 1, ty: t.ty },
      { tx: t.tx, ty: t.ty - 1 },
      { tx: t.tx, ty: t.ty + 1 },
      { tx: t.tx - 1, ty: t.ty - 1 },
      { tx: t.tx + 1, ty: t.ty - 1 },
      { tx: t.tx - 1, ty: t.ty + 1 },
      { tx: t.tx + 1, ty: t.ty + 1 }
    ];
    for (const d of dirs) {
      if (d.tx < 0 || d.tx >= MAP_COLS || d.ty < 0 || d.ty >= MAP_ROWS) continue;
      if (isBlocked(d.tx, d.ty)) continue;
      // For diagonals, check that neither cardinal is blocked
      if (d.tx !== t.tx && d.ty !== t.ty) {
        if (isBlocked(d.tx, t.ty) || isBlocked(t.tx, d.ty)) continue;
      }
      result.push(d);
    }
    return result;
  };

  let iterations = 0;
  const MAX_ITER = 2000;

  while (openSet.length > 0 && iterations < MAX_ITER) {
    iterations++;
    // Find lowest f in open set
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift().tile;
    const currentKey = key(current);

    if (current.tx === goal.tx && current.ty === goal.ty) {
      // Reconstruct path
      const path = [];
      let cur = currentKey;
      while (cur) {
        const [tx, ty] = cur.split(',').map(Number);
        path.unshift({ tx, ty });
        cur = cameFrom[cur];
      }
      return path;
    }

    closedSet.add(currentKey);

    for (const neighbor of neighbors(current)) {
      const neighborKey = key(neighbor);
      if (closedSet.has(neighborKey)) continue;

      const isDiag = neighbor.tx !== current.tx && neighbor.ty !== current.ty;
      const moveCost = isDiag ? 1.414 : 1;
      const tentativeG = (gScore[currentKey] || 0) + moveCost;

      if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentativeG;
        fScore[neighborKey] = tentativeG + heuristic(neighbor);

        const existingIdx = openSet.findIndex(o => key(o.tile) === neighborKey);
        if (existingIdx >= 0) {
          openSet[existingIdx].f = fScore[neighborKey];
        } else {
          openSet.push({ tile: neighbor, f: fScore[neighborKey] });
        }
      }
    }
  }

  // No path found - return direct path with goal
  return [goal];
}

export function rectOverlap(r1, r2) {
  return r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
