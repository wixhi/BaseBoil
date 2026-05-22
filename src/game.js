import {
  CANVAS_WIDTH, CANVAS_HEIGHT, VIEWPORT_HEIGHT, HUD_HEIGHT,
  TILE, MAP_COLS, MAP_ROWS, TILE_TYPE, TEAM, STATE,
  BLDG, UNIT, POP_CAP, START_BASEBALLS, INNING_DURATION, MAX_INNINGS, CAM_SPEED, COLORS
} from './constants.js';
import { UNIT_DEF, BLDG_DEF } from './defs.js';
import { Map } from './map.js';
import { Unit, Building, Projectile } from './entity.js';
import { Player } from './player.js';
import { AI } from './ai.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import {
  dist, tileToWorld, worldToTile, astar, clamp, rectOverlap, pointInRect
} from './utils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.constants = {
      MAP_COLS, MAP_ROWS, TILE, POP_CAP, VIEWPORT_HEIGHT, HUD_HEIGHT
    };

    this.map = new Map();
    this.entities = [];
    this.projectiles = [];
    this.floatingNumbers = [];
    this.particles = [];
    this.time = 0;

    this.player = new Player();
    this.ai = new AI();
    this.input = new Input(canvas);

    this.camera = { x: 0, y: 0 };
    this.renderer = new Renderer(this.ctx, this.camera);
    this.ui = new UI();

    this.gameState = 'start'; // 'start' | 'playing' | 'won' | 'lost'
    this.inningTimer = 0;
  }

  init() {
    this.entities = [];
    this.projectiles = [];
    this.floatingNumbers = [];
    this.particles = [];
    this.time = 0;

    this.player = new Player();
    this.ai = new AI();

    const playerBase = { tx: 4, ty: 4 };
    const enemyBase = { tx: 57, ty: 41 };

    this.map = new Map();
    this.map.generate(playerBase, enemyBase);

    // Spawn player Dugout
    this.spawnBuilding(BLDG.DUGOUT, TEAM.PLAYER, playerBase.tx, playerBase.ty);

    // Spawn enemy Dugout
    this.spawnBuilding(BLDG.DUGOUT, TEAM.ENEMY, enemyBase.tx, enemyBase.ty);

    // Spawn initial player workers (2)
    const playerDugout = this.entities.find(e =>
      e instanceof Building && e.type === BLDG.DUGOUT && e.team === TEAM.PLAYER
    );
    if (playerDugout) {
      this.spawnUnit(UNIT.GROUNDSKEEPER, TEAM.PLAYER,
        playerDugout.x + 48, playerDugout.y + 16);
      this.spawnUnit(UNIT.GROUNDSKEEPER, TEAM.PLAYER,
        playerDugout.x + 16, playerDugout.y + 48);
    }

    // Spawn initial enemy workers
    const enemyDugout = this.entities.find(e =>
      e instanceof Building && e.type === BLDG.DUGOUT && e.team === TEAM.ENEMY
    );
    if (enemyDugout) {
      this.spawnUnit(UNIT.GROUNDSKEEPER, TEAM.ENEMY,
        enemyDugout.x - 48, enemyDugout.y - 16);
      this.spawnUnit(UNIT.GROUNDSKEEPER, TEAM.ENEMY,
        enemyDugout.x - 16, enemyDugout.y - 48);
    }

    // Center camera on player base
    const pWorld = tileToWorld(playerBase.tx, playerBase.ty);
    this.camera.x = clamp(pWorld.x - CANVAS_WIDTH / 2, 0, MAP_COLS * TILE - CANVAS_WIDTH);
    this.camera.y = clamp(pWorld.y - VIEWPORT_HEIGHT / 2, 0, MAP_ROWS * TILE - VIEWPORT_HEIGHT);

    this.inningTimer = 0;
    this.gameState = 'playing';
  }

  restart() {
    this.init();
  }

  spawnUnit(type, team, x, y) {
    // Population check
    const teamUnits = this.entities.filter(e =>
      e.alive && e instanceof Unit && e.team === team
    ).length;
    if (teamUnits >= POP_CAP) return null;

    // Clamp to world bounds
    x = clamp(x, TILE, MAP_COLS * TILE - TILE);
    y = clamp(y, TILE, MAP_ROWS * TILE - TILE);

    const unit = new Unit(type, team, x, y);
    this.entities.push(unit);
    return unit;
  }

  spawnBuilding(type, team, tx, ty) {
    const def = BLDG_DEF[type];
    const bldg = new Building(type, team, tx, ty);
    this.entities.push(bldg);

    // Mark tiles as blocked
    for (let r = ty; r < ty + def.tileH; r++) {
      for (let c = tx; c < tx + def.tileW; c++) {
        this.map.setBlocked(c, r, true);
      }
    }

    return bldg;
  }

  addProjectile(data) {
    const proj = new Projectile(data);
    this.projectiles.push(proj);
    return proj;
  }

  spawnBeerExplosion(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      const isFoam = Math.random() < 0.35;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2,
        color: isFoam ? '#fff8e1' : (Math.random() < 0.6 ? '#f59e0b' : '#d97706'),
        size: isFoam ? 4 + Math.random() * 5 : 3 + Math.random() * 6,
        type: 'beer'
      });
    }
  }

  retireUnit(unitId) {
    const unit = this.entities.find(e => e.id === unitId && e.alive);
    if (!unit) return;
    unit.alive = false;
    this.player.selectedIds.delete(unitId);
  }

  getEntitiesInRect(rect) {
    // rect is in world coords
    return this.entities.filter(e => {
      if (!e.alive) return false;
      if (e instanceof Building) {
        const ex = e.tileX * TILE;
        const ey = e.tileY * TILE;
        const ew = e.tileW * TILE;
        const eh = e.tileH * TILE;
        return rectOverlap(rect, { x: ex, y: ey, w: ew, h: eh });
      } else if (e instanceof Unit) {
        return e.x >= rect.x && e.x <= rect.x + rect.w &&
               e.y >= rect.y && e.y <= rect.y + rect.h;
      }
      return false;
    });
  }

  getNearestEnemy(entity, range) {
    const opposingTeam = entity.team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    let best = null;
    let bestDist = range;

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e.team !== opposingTeam) continue;
      const d = entity instanceof Unit ? entity.distTo(e) : dist(entity, e);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }

    return best;
  }

  update(dt) {
    if (this.gameState !== 'playing') return;

    this.time += dt;
    // Update inning timer
    this.inningTimer += dt;

    // Camera movement
    this._updateCamera(dt);

    // Update input world coords
    this.input.updateWorldCoords(this.camera);

    // Update ghost building
    this._updateGhostBuilding();

    // Process input actions
    this._processInputActions();

    // Update all entities
    for (const e of this.entities) {
      if (e.alive) e.update(dt, this);
    }

    // Update projectiles
    for (const p of this.projectiles) {
      if (p.alive) p.update(dt, this);
    }

    // Update floating numbers
    for (const fn of this.floatingNumbers) {
      fn.timer -= dt;
      fn.y -= 30 * dt;
    }

    // Update beer/steam particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt;
    }

    // Update AI
    this.ai.update(dt, this);

    // Update UI hover
    this.ui.updateHover(this.input.mouseX, this.input.mouseY);

    // Cleanup dead entities
    this.entities = this.entities.filter(e => {
      if (!e.alive) {
        if (e instanceof Building) {
          // Beer explosion when any building dies
          this.spawnBeerExplosion(e.x, e.y, e.type === BLDG.DUGOUT ? 40 : 18);
          const def = BLDG_DEF[e.type];
          for (let r = e.tileY; r < e.tileY + def.tileH; r++) {
            for (let c = e.tileX; c < e.tileX + def.tileW; c++) {
              this.map.setBlocked(c, r, false);
            }
          }
        }
        return false;
      }
      return true;
    });

    // Remove dead projectiles
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Remove expired floating numbers
    this.floatingNumbers = this.floatingNumbers.filter(fn => fn.timer > 0);

    // Remove expired particles
    this.particles = this.particles.filter(p => p.life > 0);

    // Check win/lose
    this._checkWinLose();
  }

  _updateCamera(dt) {
    const inp = this.input;
    const speed = CAM_SPEED;
    const maxX = MAP_COLS * TILE - CANVAS_WIDTH;
    const maxY = MAP_ROWS * TILE - VIEWPORT_HEIGHT;

    if (inp.isKeyDown('KeyW') || inp.isKeyDown('ArrowUp')) {
      this.camera.y = Math.max(0, this.camera.y - speed * dt);
    }
    if (inp.isKeyDown('KeyS') || inp.isKeyDown('ArrowDown')) {
      this.camera.y = Math.min(maxY, this.camera.y + speed * dt);
    }
    if (inp.isKeyDown('KeyA') || inp.isKeyDown('ArrowLeft')) {
      this.camera.x = Math.max(0, this.camera.x - speed * dt);
    }
    if (inp.isKeyDown('KeyD') || inp.isKeyDown('ArrowRight')) {
      this.camera.x = Math.min(maxX, this.camera.x + speed * dt);
    }
  }

  _updateGhostBuilding() {
    if (!this.player.buildMode) return;

    const def = BLDG_DEF[this.player.buildMode];
    const worldX = this.input.worldX;
    const worldY = this.input.worldY;

    // Only show ghost in viewport
    if (this.input.mouseY > VIEWPORT_HEIGHT) {
      this.player.ghostTile = null;
      return;
    }

    const tile = worldToTile(worldX, worldY);
    // Center the building on cursor
    const tx = tile.tx - Math.floor(def.tileW / 2);
    const ty = tile.ty - Math.floor(def.tileH / 2);

    this.player.ghostTile = { tx, ty };

    // Check validity
    const valid = this._isBuildingPlacementValid(this.player.buildMode, tx, ty);
    this.player.ghostValid = valid;
  }

  _isBuildingPlacementValid(type, tx, ty) {
    const def = BLDG_DEF[type];

    // Within bounds
    if (!this.map.isInBounds(tx, ty)) return false;
    if (!this.map.isInBounds(tx + def.tileW - 1, ty + def.tileH - 1)) return false;

    // No obstacles or buildings
    if (!this.map.isAreaClear(tx, ty, def.tileW, def.tileH)) return false;

    // No units in the way
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e instanceof Unit) {
        const t = worldToTile(e.x, e.y);
        if (t.tx >= tx && t.tx < tx + def.tileW && t.ty >= ty && t.ty < ty + def.tileH) {
          return false;
        }
      } else if (e instanceof Building) {
        const bx1 = e.tileX, by1 = e.tileY;
        const bx2 = e.tileX + e.tileW, by2 = e.tileY + e.tileH;
        const ox1 = tx, oy1 = ty;
        const ox2 = tx + def.tileW, oy2 = ty + def.tileH;
        if (ox1 < bx2 && ox2 > bx1 && oy1 < by2 && oy2 > by1) return false;
      }
    }

    return true;
  }

  _processInputActions() {
    const actions = this.input.getActions();

    for (const action of actions) {
      switch (action.type) {
        case 'escape':
          this._handleEscape();
          break;

        case 'click_left':
          this._handleLeftClick(action.cx, action.cy);
          break;

        case 'mousedown_right':
          this._handleRightClick(action.cx, action.cy);
          break;

        case 'box_select':
          this._handleBoxSelect(action.x1, action.y1, action.x2, action.y2);
          break;
      }
    }
  }

  _handleEscape() {
    if (this.player.buildMode) {
      this.player.cancelBuildMode();
      document.getElementById('gameCanvas').classList.remove('crosshair');
    } else {
      this.player.clearSelection();
    }
  }

  _handleLeftClick(cx, cy) {
    // Game start screen
    if (this.gameState === 'start') {
      this.init();
      return;
    }

    // End screens
    if (this.gameState === 'won' || this.gameState === 'lost') {
      this.restart();
      return;
    }

    // HUD click
    if (cy >= VIEWPORT_HEIGHT) {
      this.ui.handleClick(cx, cy, this);
      return;
    }

    // World click
    const wx = cx + this.camera.x;
    const wy = cy + this.camera.y;

    // Build mode placement
    if (this.player.buildMode) {
      if (this.player.ghostTile && this.player.ghostValid) {
        const { tx, ty } = this.player.ghostTile;
        const type = this.player.buildMode;
        const def = BLDG_DEF[type];

        if (this.player.canAfford(def.cost)) {
          this.player.spend(def.cost);
          this.spawnBuilding(type, TEAM.PLAYER, tx, ty);
          // Only cancel build mode if not holding shift (for simplicity, always cancel)
          this.player.cancelBuildMode();
          document.getElementById('gameCanvas').classList.remove('crosshair');
        }
      }
      return;
    }

    // Entity selection
    const clicked = this._getEntityAtWorld(wx, wy);
    if (clicked && clicked.team === TEAM.PLAYER) {
      this.player.select(clicked);
    } else {
      this.player.clearSelection();
    }
  }

  _handleRightClick(cx, cy) {
    if (this.gameState !== 'playing') return;
    if (cy >= VIEWPORT_HEIGHT) return;

    const wx = cx + this.camera.x;
    const wy = cy + this.camera.y;

    const selected = [...this.player.selectedIds]
      .map(id => this.entities.find(e => e.id === id))
      .filter(e => e && e.alive && e instanceof Unit && e.team === TEAM.PLAYER);

    if (selected.length === 0) return;

    // Check if clicking on enemy entity
    const target = this._getEntityAtWorld(wx, wy);

    if (target && target.team === TEAM.ENEMY) {
      // Attack target
      for (const unit of selected) {
        unit.attackTarget(target);
      }
    } else {
      // Move command — spread units
      const spreadRadius = Math.ceil(Math.sqrt(selected.length)) * (TILE / 2);
      selected.forEach((unit, i) => {
        const angle = (i / selected.length) * Math.PI * 2;
        const r = (i === 0) ? 0 : spreadRadius * (0.5 + Math.floor(i / 6) * 0.5);
        const tx = wx + Math.cos(angle) * r;
        const ty = wy + Math.sin(angle) * r;
        unit.moveTo(
          clamp(tx, TILE, MAP_COLS * TILE - TILE),
          clamp(ty, TILE, MAP_ROWS * TILE - TILE),
          this
        );
      });
    }
  }

  _handleBoxSelect(cx1, cy1, cx2, cy2) {
    if (this.gameState !== 'playing') return;

    // Only in viewport
    const vy = Math.min(cy1, cy2);
    if (vy >= VIEWPORT_HEIGHT) return;

    const wx1 = cx1 + this.camera.x;
    const wy1 = cy1 + this.camera.y;
    const wx2 = cx2 + this.camera.x;
    const wy2 = cy2 + this.camera.y;

    const rect = {
      x: Math.min(wx1, wx2),
      y: Math.min(wy1, wy2),
      w: Math.abs(wx2 - wx1),
      h: Math.abs(wy2 - wy1)
    };

    // Select player units in rect (not buildings)
    const inRect = this.entities.filter(e => {
      if (!e.alive) return false;
      if (e.team !== TEAM.PLAYER) return false;
      if (!(e instanceof Unit)) return false;
      return e.x >= rect.x && e.x <= rect.x + rect.w &&
             e.y >= rect.y && e.y <= rect.y + rect.h;
    });

    this.player.clearSelection();
    for (const e of inRect) {
      this.player.addToSelection(e);
    }
  }

  _getEntityAtWorld(wx, wy) {
    // Check buildings first (larger targets)
    for (const e of [...this.entities].reverse()) {
      if (!e.alive) continue;
      if (e instanceof Building) {
        const bx = e.tileX * TILE;
        const by = e.tileY * TILE;
        const bw = e.tileW * TILE;
        const bh = e.tileH * TILE;
        if (wx >= bx && wx <= bx + bw && wy >= by && wy <= by + bh) {
          return e;
        }
      }
    }

    // Then units
    for (const e of [...this.entities].reverse()) {
      if (!e.alive) continue;
      if (e instanceof Unit) {
        const d = Math.sqrt((wx - e.x) ** 2 + (wy - e.y) ** 2);
        if (d <= e.radius + 4) return e;
      }
    }

    return null;
  }

  _checkWinLose() {
    const playerDugout = this.entities.find(e =>
      e.alive && e instanceof Building && e.team === TEAM.PLAYER && e.type === BLDG.DUGOUT
    );
    const enemyDugout = this.entities.find(e =>
      e.alive && e instanceof Building && e.team === TEAM.ENEMY && e.type === BLDG.DUGOUT
    );

    if (!playerDugout) {
      this.gameState = 'lost';
    } else if (!enemyDugout) {
      this.gameState = 'won';
    }
  }

  render() {
    this.renderer.render(this);
  }
}
