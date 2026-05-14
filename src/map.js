import { TILE, TILE_TYPE, MAP_COLS, MAP_ROWS } from './constants.js';

export class Map {
  constructor() {
    this.tiles = [];
    this.blocked = []; // separate blocked grid (includes buildings)
    this.resourceTiles = []; // list of {tx, ty} resource tile positions
    for (let r = 0; r < MAP_ROWS; r++) {
      this.tiles[r] = new Array(MAP_COLS).fill(TILE_TYPE.GRASS);
      this.blocked[r] = new Array(MAP_COLS).fill(false);
    }
  }

  isInBounds(tx, ty) {
    return tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS;
  }

  isBlocked(tx, ty) {
    if (!this.isInBounds(tx, ty)) return true;
    return this.blocked[ty][tx];
  }

  getTile(tx, ty) {
    if (!this.isInBounds(tx, ty)) return TILE_TYPE.OBSTACLE;
    return this.tiles[ty][tx];
  }

  setBlocked(tx, ty, val) {
    if (!this.isInBounds(tx, ty)) return;
    this.blocked[ty][tx] = val;
  }

  setTile(tx, ty, type) {
    if (!this.isInBounds(tx, ty)) return;
    this.tiles[ty][tx] = type;
    if (type === TILE_TYPE.OBSTACLE) {
      this.blocked[ty][tx] = true;
    }
  }

  generate(playerBase, enemyBase) {
    // Start with all grass
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        this.tiles[r][c] = TILE_TYPE.GRASS;
        this.blocked[r][c] = false;
      }
    }

    // Reserve area around bases (clear zone)
    const clearRadius = 6;
    const clearZones = [playerBase, enemyBase];

    // Helper to check if tile is near base
    const nearBase = (tx, ty) => {
      for (const base of clearZones) {
        const dx = tx - base.tx;
        const dy = ty - base.ty;
        if (Math.sqrt(dx * dx + dy * dy) < clearRadius) return true;
      }
      return false;
    };

    // Place obstacle clusters
    const numObstacleClusters = 18;
    let placed = 0;
    let attempts = 0;
    while (placed < numObstacleClusters && attempts < 500) {
      attempts++;
      const cx = 5 + Math.floor(Math.random() * (MAP_COLS - 10));
      const cy = 5 + Math.floor(Math.random() * (MAP_ROWS - 10));
      if (nearBase(cx, cy)) continue;

      const clusterSize = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < clusterSize; i++) {
        const tx = cx + Math.floor(Math.random() * 5) - 2;
        const ty = cy + Math.floor(Math.random() * 5) - 2;
        if (this.isInBounds(tx, ty) && !nearBase(tx, ty)) {
          this.setTile(tx, ty, TILE_TYPE.OBSTACLE);
        }
      }
      placed++;
    }

    // Place resource clusters (~12 clusters of 4-8 tiles)
    this.resourceTiles = [];
    const numResourceClusters = 12;
    placed = 0;
    attempts = 0;
    while (placed < numResourceClusters && attempts < 500) {
      attempts++;
      const cx = 4 + Math.floor(Math.random() * (MAP_COLS - 8));
      const cy = 4 + Math.floor(Math.random() * (MAP_ROWS - 8));
      if (nearBase(cx, cy)) continue;
      if (this.getTile(cx, cy) === TILE_TYPE.OBSTACLE) continue;

      const clusterSize = 4 + Math.floor(Math.random() * 5);
      let clusterPlaced = 0;
      for (let i = 0; i < clusterSize * 3 && clusterPlaced < clusterSize; i++) {
        const tx = cx + Math.floor(Math.random() * 5) - 2;
        const ty = cy + Math.floor(Math.random() * 5) - 2;
        if (this.isInBounds(tx, ty) && !nearBase(tx, ty) &&
          this.getTile(tx, ty) === TILE_TYPE.GRASS) {
          this.setTile(tx, ty, TILE_TYPE.RESOURCE);
          this.resourceTiles.push({ tx, ty });
          clusterPlaced++;
        }
      }
      if (clusterPlaced > 0) placed++;
    }

    // Add baseball diamond decoration in center (dirt paths)
    const cx = Math.floor(MAP_COLS / 2);
    const cy = Math.floor(MAP_ROWS / 2);
    // Diamond bases
    const diamondRadius = 5;
    const bases = [
      { tx: cx, ty: cy - diamondRadius },      // pitcher's mound top
      { tx: cx + diamondRadius, ty: cy },       // first base
      { tx: cx, ty: cy + diamondRadius },       // home plate
      { tx: cx - diamondRadius, ty: cy }        // third base
    ];
    // Draw dirt paths between bases
    for (let i = 0; i < bases.length; i++) {
      const a = bases[i];
      const b = bases[(i + 1) % bases.length];
      // Bresenham line
      let x0 = a.tx, y0 = a.ty;
      const x1 = b.tx, y1 = b.ty;
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      while (true) {
        if (this.isInBounds(x0, y0) && this.getTile(x0, y0) === TILE_TYPE.GRASS) {
          this.setTile(x0, y0, TILE_TYPE.DIRT);
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }
    // Center mound
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (this.isInBounds(tx, ty) && this.getTile(tx, ty) === TILE_TYPE.GRASS) {
          this.setTile(tx, ty, TILE_TYPE.DIRT);
        }
      }
    }
  }

  // Find nearest resource tile to world position
  nearestResource(wx, wy) {
    let best = null;
    let bestDist = Infinity;
    for (const rt of this.resourceTiles) {
      const dx = rt.tx * TILE + TILE / 2 - wx;
      const dy = rt.ty * TILE + TILE / 2 - wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = rt;
      }
    }
    return best;
  }

  // Check if area of w×h tiles starting at (tx, ty) is clear for building
  isAreaClear(tx, ty, tw, th) {
    for (let r = ty; r < ty + th; r++) {
      for (let c = tx; c < tx + tw; c++) {
        if (!this.isInBounds(c, r)) return false;
        if (this.blocked[r][c]) return false;
        if (this.tiles[r][c] === TILE_TYPE.OBSTACLE) return false;
      }
    }
    return true;
  }
}
