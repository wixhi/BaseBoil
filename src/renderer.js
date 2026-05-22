import {
  CANVAS_WIDTH, CANVAS_HEIGHT, VIEWPORT_HEIGHT, HUD_HEIGHT,
  TILE, MAP_COLS, MAP_ROWS, TILE_TYPE, TEAM, UNIT, BLDG, COLORS
} from './constants.js';
import { UNIT_DEF, BLDG_DEF } from './defs.js';
import { Building, Unit } from './entity.js';
import { drawRoundedRect } from './utils.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
  }

  render(game) {
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, VIEWPORT_HEIGHT);
    ctx.clip();

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    this._drawTiles(ctx, cam, game.map);
    this._drawBuildings(ctx, game);
    this._drawUnits(ctx, game);
    this._drawProjectiles(ctx, game);
    this._drawParticles(ctx, game);
    this._drawSelectionBox(ctx, game);
    this._drawFloatingNumbers(ctx, game);

    ctx.restore();
    ctx.restore();

    this._drawHUD(ctx, game);
    this._drawOverlay(ctx, game);
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  _drawTiles(ctx, cam, map) {
    const startCol = Math.max(0, Math.floor(cam.x / TILE));
    const endCol = Math.min(MAP_COLS, Math.ceil((cam.x + CANVAS_WIDTH) / TILE) + 1);
    const startRow = Math.max(0, Math.floor(cam.y / TILE));
    const endRow = Math.min(MAP_ROWS, Math.ceil((cam.y + VIEWPORT_HEIGHT) / TILE) + 1);

    for (let r = startRow; r < endRow; r++)
      for (let c = startCol; c < endCol; c++)
        this._drawTile(ctx, map.getTile(c, r), c * TILE, r * TILE);
  }

  _drawTile(ctx, tile, wx, wy) {
    switch (tile) {
      case TILE_TYPE.GRASS:
        ctx.fillStyle = COLORS.GRASS;
        ctx.fillRect(wx, wy, TILE, TILE);
        ctx.strokeStyle = COLORS.GRASS_GRID;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(wx + 0.5, wy + 0.5, TILE - 1, TILE - 1);
        break;
      case TILE_TYPE.DIRT:
        ctx.fillStyle = COLORS.DIRT;
        ctx.fillRect(wx, wy, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(wx + 4, wy + 8, 3, 3);
        ctx.fillRect(wx + 18, wy + 4, 2, 2);
        ctx.fillRect(wx + 24, wy + 20, 3, 2);
        break;
      case TILE_TYPE.OBSTACLE:
        ctx.fillStyle = COLORS.OBSTACLE;
        ctx.fillRect(wx, wy, TILE, TILE);
        ctx.strokeStyle = COLORS.OBSTACLE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(wx + 0.5, wy + 0.5, TILE - 1, TILE - 1);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(wx + 4, wy + 8); ctx.lineTo(wx + 14, wy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx + 20, wy + 5); ctx.lineTo(wx + 28, wy + 15); ctx.stroke();
        break;
      case TILE_TYPE.RESOURCE: {
        ctx.fillStyle = COLORS.RESOURCE_BASE;
        ctx.fillRect(wx, wy, TILE, TILE);
        const dots = [
          { x: wx + 8, y: wy + 8 }, { x: wx + 22, y: wy + 8 },
          { x: wx + 8, y: wy + 22 }, { x: wx + 22, y: wy + 22 },
          { x: wx + 15, y: wy + 15 }
        ];
        for (const d of dots) {
          ctx.fillStyle = COLORS.RESOURCE_DOT;
          ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0.2, 1.2); ctx.stroke();
        }
        break;
      }
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────

  _drawBuildings(ctx, game) {
    for (const e of game.entities) {
      if (!(e instanceof Building) || !e.alive) continue;
      this._drawBuilding(ctx, e, game);
    }
    if (game.player.buildMode && game.player.ghostTile) this._drawGhost(ctx, game);
  }

  _drawBuilding(ctx, bldg, game) {
    const def = BLDG_DEF[bldg.type];
    const x = bldg.tileX * TILE;
    const y = bldg.tileY * TILE;
    const w = bldg.tileW * TILE;
    const h = bldg.tileH * TILE;
    const isPlayer = bldg.team === TEAM.PLAYER;
    const strokeColor = isPlayer ? COLORS.PLAYER_BLDG_STROKE : COLORS.ENEMY_BLDG_STROKE;

    if (!bldg.complete) {
      // Under construction
      ctx.save();
      ctx.beginPath(); drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.clip();
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = isPlayer ? 'rgba(77,166,255,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.lineWidth = 4;
      for (let i = -h; i < w + h; i += 12) {
        ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i - h, y + h); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#0a0a0f'; ctx.fillRect(x + 4, y + h - 10, w - 8, 6);
      ctx.fillStyle = COLORS.ORANGE; ctx.fillRect(x + 4, y + h - 10, (w - 8) * bldg.constructProgress, 6);
      ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke(); ctx.setLineDash([]);
    } else if (bldg.type === BLDG.DUGOUT) {
      this._drawDugout(ctx, bldg, isPlayer, x, y, w, h, game);
    } else {
      const fillColor = isPlayer ? COLORS.PLAYER_BLDG_FILL : COLORS.ENEMY_BLDG_FILL;
      ctx.shadowColor = strokeColor; ctx.shadowBlur = 8;
      ctx.fillStyle = fillColor;
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = strokeColor; ctx.lineWidth = 2;
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke();
      ctx.strokeStyle = isPlayer ? 'rgba(79,195,247,0.18)' : 'rgba(239,83,80,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + w - 6, y + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 6, y + h - 6); ctx.lineTo(x + w - 6, y + h - 6); ctx.stroke();
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.25)}px "Courier New"`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.label, x + w / 2, y + h / 2);
    }

    // Steam effect when HP < 40%
    if (bldg.complete && bldg.hp / bldg.maxHp < 0.4) {
      this._drawBuildingSteam(ctx, bldg, game.time);
    }

    // Production progress bar
    if (bldg.complete && bldg.productionQueue.length > 0) {
      const uDef = UNIT_DEF[bldg.productionQueue[0]];
      const prog = bldg.trainTimer / uDef.trainTime;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 2, y + h + 2, w - 4, 5);
      ctx.fillStyle = isPlayer ? COLORS.CYAN : COLORS.RED;
      ctx.fillRect(x + 2, y + h + 2, (w - 4) * prog, 5);
    }

    // HP bar
    const hpRatio = bldg.hp / bldg.maxHp;
    const hpColor = hpRatio > 0.6 ? COLORS.HP_HIGH : hpRatio > 0.3 ? COLORS.HP_MID : COLORS.HP_LOW;
    ctx.fillStyle = COLORS.HP_BG; ctx.fillRect(x + 2, y - 7, w - 4, 4);
    ctx.fillStyle = hpColor; ctx.fillRect(x + 2, y - 7, (w - 4) * hpRatio, 4);

    // Selection indicator
    if (game.player.selectedIds.has(bldg.id)) {
      ctx.strokeStyle = COLORS.CYAN; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      drawRoundedRect(ctx, x, y, w, h, 6); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  _drawDugout(ctx, bldg, isPlayer, x, y, w, h, game) {
    const roofColor = isPlayer ? '#0a2744' : '#2a0a0a';
    const wallColor = isPlayer ? '#1a3a5c' : '#3c1010';
    const pitColor  = isPlayer ? '#0d1f33' : '#200a0a';
    const benchColor = '#6b4226';
    const stroke = isPlayer ? COLORS.PLAYER_BLDG_STROKE : COLORS.ENEMY_BLDG_STROKE;

    // Wall background
    ctx.shadowColor = stroke; ctx.shadowBlur = 8;
    ctx.fillStyle = wallColor;
    drawRoundedRect(ctx, x + 1, y + 1, w - 2, h - 2, 3); ctx.fill();
    ctx.shadowBlur = 0;

    // Roof / awning
    ctx.fillStyle = roofColor;
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.28);

    // Awning edge (stripe)
    ctx.fillStyle = isPlayer ? '#1565c0' : '#7f0000';
    ctx.fillRect(x + 1, y + h * 0.26, w - 2, h * 0.04);

    // Dugout pit (recessed)
    ctx.fillStyle = pitColor;
    ctx.fillRect(x + 5, y + h * 0.32, w - 10, h * 0.52);

    // Bench
    ctx.strokeStyle = benchColor; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 7, y + h * 0.65); ctx.lineTo(x + w - 7, y + h * 0.65);
    ctx.stroke();
    // Bench legs
    ctx.lineWidth = 2;
    const legXs = [x + 12, x + w / 2, x + w - 12];
    for (const lx of legXs) {
      ctx.beginPath();
      ctx.moveTo(lx, y + h * 0.65); ctx.lineTo(lx, y + h * 0.8);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Steps at bottom of pit
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const stepH = h * 0.07;
    ctx.fillRect(x + 5,            y + h * 0.84,          w - 10,            stepH);
    ctx.fillRect(x + 5 + stepH,    y + h * 0.84 + stepH,  w - 10 - stepH * 2, stepH);

    // Border
    ctx.strokeStyle = stroke; ctx.lineWidth = 2;
    drawRoundedRect(ctx, x + 1, y + 1, w - 2, h - 2, 3); ctx.stroke();

    // Team label in awning
    ctx.fillStyle = COLORS.WHITE;
    const teamLabel = isPlayer ? 'HOME' : 'AWAY';
    ctx.font = `bold ${Math.floor(w * 0.13)}px "Courier New"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(teamLabel, x + w / 2, y + h * 0.15);
  }

  _drawBuildingSteam(ctx, bldg, t) {
    const x = bldg.tileX * TILE;
    const y = bldg.tileY * TILE;
    const w = bldg.tileW * TILE;

    ctx.save();
    for (let i = 0; i < 5; i++) {
      const phase = ((t * 1.2 + i * 0.55) % 1.0);
      const wx = x + w * (0.15 + i * 0.18);
      const wy = y - 4 - phase * 28;
      const alpha = phase < 0.4 ? phase / 0.4 * 0.55 : (1 - phase) / 0.6 * 0.55;
      const size = 3 + phase * 9;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = '#c8e6f5';
      ctx.beginPath();
      ctx.ellipse(wx, wy, size * 0.55, size, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawGhost(ctx, game) {
    const def = BLDG_DEF[game.player.buildMode];
    const { tx, ty } = game.player.ghostTile;
    const x = tx * TILE, y = ty * TILE, w = def.tileW * TILE, h = def.tileH * TILE;
    const valid = game.player.ghostValid;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = valid ? 'rgba(76,175,80,0.35)' : 'rgba(244,67,54,0.35)';
    drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.fill();
    ctx.strokeStyle = valid ? '#4caf50' : '#f44336'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.25)}px "Courier New"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.label, x + w / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  _drawUnits(ctx, game) {
    for (const e of game.entities) {
      if (!(e instanceof Unit) || !e.alive) continue;
      this._drawUnit(ctx, e, game);
    }
  }

  _drawUnit(ctx, unit, game) {
    const r = unit.radius;
    const selected = game.player.selectedIds.has(unit.id);

    // Selection ring
    if (selected) {
      ctx.strokeStyle = COLORS.CYAN; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(unit.x, unit.y, r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Dispatch to unit-specific skin
    switch (unit.type) {
      case UNIT.GROUNDSKEEPER: this._drawBallBoy(ctx, unit); break;
      case UNIT.BATTER:        this._drawBatter(ctx, unit); break;
      case UNIT.PITCHER:       this._drawPitcher(ctx, unit); break;
      case UNIT.CATCHER:       this._drawCatcher(ctx, unit); break;
      case UNIT.SLUGGER:       this._drawSlugger(ctx, unit); break;
    }

    // HP bar
    const hpRatio = unit.hp / unit.maxHp;
    const hpColor = hpRatio > 0.6 ? COLORS.HP_HIGH : hpRatio > 0.3 ? COLORS.HP_MID : COLORS.HP_LOW;
    const barW = r * 2 + 4, barX = unit.x - barW / 2, barY = unit.y - r - 9;
    ctx.fillStyle = COLORS.HP_BG; ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = hpColor; ctx.fillRect(barX, barY, barW * hpRatio, 3);

    // Worker carry indicator
    if (unit.isWorker && unit.carryAmt > 0) {
      ctx.fillStyle = COLORS.GOLD; ctx.font = '8px "Courier New"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${unit.carryAmt}`, unit.x, unit.y - r - 15);
    }
  }

  // Ball Boy (worker): baseball cap, overalls vibe
  _drawBallBoy(ctx, unit) {
    const { x, y, radius: r } = unit;
    const isPlayer = unit.team === TEAM.PLAYER;
    const bodyColor = isPlayer ? '#90caf9' : '#ef9a9a';
    const capColor  = isPlayer ? '#0d47a1' : '#7f0000';
    const stroke    = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;

    // Body
    ctx.shadowColor = stroke; ctx.shadowBlur = 4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(x, y + 1, r - 1, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y + 1, r - 1, 0, Math.PI * 2); ctx.stroke();

    // Cap dome
    ctx.fillStyle = capColor;
    ctx.beginPath(); ctx.arc(x, y - r * 0.25, r * 0.62, Math.PI, 0); ctx.fill();
    // Cap bill (extends right)
    ctx.fillRect(x, y - r * 0.32, r * 0.55, r * 0.18);

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.05, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.22, y - r * 0.05, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Batter: batting helmet + angled bat
  _drawBatter(ctx, unit) {
    const { x, y, radius: r } = unit;
    const isPlayer = unit.team === TEAM.PLAYER;
    const bodyColor   = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
    const helmetColor = isPlayer ? '#1565c0' : '#b71c1c';
    const stroke      = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;

    // Bat (behind body so it doesn't overlap face)
    ctx.strokeStyle = '#6d3b0e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.25, y + r * 0.55);
    ctx.lineTo(x + r * 1.35, y - r * 0.75);
    ctx.stroke();
    // Barrel knob
    ctx.fillStyle = '#a0522d';
    ctx.beginPath(); ctx.arc(x + r * 1.35, y - r * 0.75, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';

    // Body
    ctx.shadowColor = stroke; ctx.shadowBlur = 4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

    // Batting helmet (D-shape, right side)
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.75, -Math.PI * 0.92, Math.PI * 0.08);
    ctx.fill();
    // Ear flap
    ctx.fillRect(x + r * 0.35, y - r * 0.25, r * 0.42, r * 0.5);

    // Shine on helmet
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.15, y - r * 0.5, r * 0.18, r * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  // Pitcher: cap + extended arm with baseball in hand
  _drawPitcher(ctx, unit) {
    const { x, y, radius: r } = unit;
    const isPlayer = unit.team === TEAM.PLAYER;
    const bodyColor = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
    const capColor  = isPlayer ? '#0d47a1' : '#7f0000';
    const stroke    = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;
    const bx = x + r * 1.25, by = y - r * 0.55; // baseball position

    // Throwing arm
    ctx.strokeStyle = isPlayer ? '#4fc3f7' : '#ef9a9a'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, y - r * 0.1); ctx.lineTo(bx, by);
    ctx.stroke();

    // Baseball in hand
    ctx.shadowColor = COLORS.BASEBALL_GLOW; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(bx, by, r * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.25, 0.3, 1.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, r * 0.25, 3.4, 4.7); ctx.stroke();

    // Body
    ctx.shadowColor = stroke; ctx.shadowBlur = 4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

    // Cap
    ctx.fillStyle = capColor;
    ctx.beginPath(); ctx.arc(x, y - r * 0.28, r * 0.65, Math.PI, 0); ctx.fill();
    // Bill
    ctx.fillRect(x, y - r * 0.36, r * 0.52, r * 0.18);
  }

  // Catcher: chest protector + catcher's mask
  _drawCatcher(ctx, unit) {
    const { x, y, radius: r } = unit;
    const isPlayer = unit.team === TEAM.PLAYER;
    const bodyColor  = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
    const gearColor  = isPlayer ? '#1a237e' : '#4a0000';
    const maskColor  = '#2a2a2a';
    const stroke     = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;

    // Body (slightly stockier)
    ctx.shadowColor = stroke; ctx.shadowBlur = 4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2); ctx.stroke();

    // Chest protector (overlaid rectangle)
    ctx.fillStyle = gearColor;
    drawRoundedRect(ctx, x - r * 0.65, y - r * 0.35, r * 1.3, r * 0.9, 2); ctx.fill();
    // Rib lines on protector
    ctx.strokeStyle = isPlayer ? '#3f51b5' : '#7f1f1f'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y - r * 0.2 + i * r * 0.25);
      ctx.lineTo(x + r * 0.55, y - r * 0.2 + i * r * 0.25);
      ctx.stroke();
    }

    // Catcher's mask (dark box over face)
    ctx.fillStyle = maskColor;
    ctx.fillRect(x - r * 0.6, y - r * 1.05, r * 1.2, r * 0.82);
    // Mask bars
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.98 + i * r * 0.2);
      ctx.lineTo(x + r * 0.6, y - r * 0.98 + i * r * 0.2);
      ctx.stroke();
    }
    // Mask border
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.strokeRect(x - r * 0.6, y - r * 1.05, r * 1.2, r * 0.82);
  }

  // Slugger: knight helmet + baseball on top + heavy bat
  _drawSlugger(ctx, unit) {
    const { x, y, radius: r } = unit;
    const isPlayer = unit.team === TEAM.PLAYER;
    const bodyColor   = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
    const helmetColor = isPlayer ? '#37474f' : '#4e342e'; // steel / dark
    const helmetTrim  = isPlayer ? '#78909c' : '#a1887f';
    const stroke      = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;

    // Heavy bat (behind body)
    ctx.strokeStyle = '#3e1f00'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, y + r * 0.65);
    ctx.lineTo(x + r * 1.55, y - r * 0.6);
    ctx.stroke();
    // Barrel (thicker part)
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + r * 1.0, y + r * 0.0);
    ctx.lineTo(x + r * 1.55, y - r * 0.6);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Body
    ctx.shadowColor = stroke; ctx.shadowBlur = 6;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

    // Knight helmet dome
    ctx.fillStyle = helmetColor;
    ctx.beginPath(); ctx.arc(x, y - r * 0.18, r * 0.82, Math.PI, 0); ctx.fill();
    // Helmet face plate
    ctx.fillRect(x - r * 0.82, y - r * 0.18, r * 1.64, r * 0.62);
    // Trim lines on helmet
    ctx.strokeStyle = helmetTrim; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.82, y - r * 0.18);
    ctx.lineTo(x + r * 0.82, y - r * 0.18);
    ctx.stroke();
    // Visor slit (narrow)
    ctx.fillStyle = '#000';
    ctx.fillRect(x - r * 0.5, y - r * 0.08, r, r * 0.18);
    // Chin guards
    ctx.fillStyle = helmetColor;
    ctx.fillRect(x - r * 0.82, y + r * 0.28, r * 0.3, r * 0.28);
    ctx.fillRect(x + r * 0.52, y + r * 0.28, r * 0.3, r * 0.28);
    // Helmet rim glow
    ctx.strokeStyle = helmetTrim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y - r * 0.18, r * 0.82, Math.PI, 0); ctx.stroke();

    // Baseball ON TOP of helmet
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = COLORS.ORANGE; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(x, y - r * 1.0, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(x, y - r * 1.0, r * 0.27, 0.3, 1.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - r * 1.0, r * 0.27, 3.4, 4.7); ctx.stroke();
  }

  // ── Projectiles ───────────────────────────────────────────────────────────

  _drawProjectiles(ctx, game) {
    for (const proj of game.projectiles) {
      if (!proj.alive) continue;
      switch (proj.projType) {
        case 'hotdog':  this._drawHotdog(ctx, proj); break;
        case 'beercan': this._drawBeerCan(ctx, proj); break;
        default:        this._drawBaseball(ctx, proj); break;
      }
    }
  }

  _drawBaseball(ctx, proj) {
    // Fire trail
    for (let i = 0; i < proj.trail.length; i++) {
      const t = proj.trail[i];
      const alpha = (1 - i / proj.trail.length) * 0.6;
      ctx.fillStyle = `rgba(255,107,53,${alpha})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(0.5, 3 - i * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowColor = COLORS.BASEBALL_GLOW; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(proj.x, proj.y, 2.5, 0.3, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(proj.x, proj.y, 2.5, 3.4, 4.8); ctx.stroke();
  }

  _drawHotdog(ctx, proj) {
    ctx.save();
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y); ctx.rotate(angle);
    // Bun
    ctx.fillStyle = '#c8924a';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // Frank
    ctx.fillStyle = '#a0270a';
    ctx.fillRect(-7, -2.5, 14, 5);
    // Mustard zigzag
    ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -1); ctx.lineTo(-2, 1); ctx.lineTo(1, -1); ctx.lineTo(4, 1); ctx.lineTo(7, -1);
    ctx.stroke();
    ctx.restore();
  }

  _drawBeerCan(ctx, proj) {
    ctx.save();
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y); ctx.rotate(angle);
    // Can body
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(-5, -5, 10, 10);
    // Label stripe
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-5, -2, 10, 4);
    // Top/bottom rims (gold)
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-5, -5, 10, 2);
    ctx.fillRect(-5, 3, 10, 2);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-4, -4, 2, 8);
    ctx.restore();
  }

  // ── Particles (beer explosion) ────────────────────────────────────────────

  _drawParticles(ctx, game) {
    ctx.save();
    for (const p of game.particles) {
      if (p.life <= 0) continue;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.5));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Selection box & floating numbers ─────────────────────────────────────

  _drawSelectionBox(ctx, game) {
    const drag = game.input.getDragRect();
    if (!drag) return;
    const cam = game.camera;
    const wx = drag.x + cam.x, wy = drag.y + cam.y;
    ctx.fillStyle = COLORS.SELECTION_FILL; ctx.fillRect(wx, wy, drag.w, drag.h);
    ctx.strokeStyle = COLORS.SELECTION_STROKE; ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, drag.w, drag.h);
  }

  _drawFloatingNumbers(ctx, game) {
    for (const fn of game.floatingNumbers) {
      const alpha = Math.max(0, fn.timer / 0.8);
      ctx.fillStyle = `rgba(255,80,80,${alpha})`;
      ctx.font = 'bold 13px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`-${Math.ceil(fn.value)}`, fn.x, fn.y);
    }
  }

  // ── HUD & Overlays ────────────────────────────────────────────────────────

  _drawHUD(ctx, game) { game.ui.draw(ctx, game); }

  _drawOverlay(ctx, game) {
    if (game.gameState === 'playing') return;
    ctx.fillStyle = COLORS.OVERLAY_BG; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (game.gameState === 'start') this._drawStartScreen(ctx);
    else if (game.gameState === 'won')  this._drawEndScreen(ctx, 'VICTORY!', COLORS.VICTORY, 'The enemy Dugout has been destroyed!');
    else if (game.gameState === 'lost') this._drawEndScreen(ctx, 'DEFEAT!', COLORS.DEFEAT, 'Your Dugout has been destroyed...');
  }

  _drawStartScreen(ctx) {
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2 - 40;
    const grad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 220);
    grad.addColorStop(0, 'rgba(255,152,0,0.22)'); grad.addColorStop(1, 'rgba(255,152,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(cx - 220, cy - 120, 440, 200);
    ctx.font = 'bold 80px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff6b35'; ctx.shadowBlur = 35;
    ctx.fillStyle = COLORS.TITLE_FIRE; ctx.fillText('BASEBOIL', cx, cy - 30);
    ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 16;
    ctx.fillStyle = COLORS.TITLE_ORANGE; ctx.fillText('BASEBOIL', cx, cy - 30);
    ctx.shadowBlur = 0;
    ctx.font = '22px "Courier New"'; ctx.fillStyle = '#bbbbbb';
    ctx.fillText('A Baseball RTS', cx, cy + 42);
    ctx.font = '14px "Courier New"'; ctx.fillStyle = '#666';
    ctx.fillText('Build your Dugout. Train your squad. Destroy the enemy.', cx, cy + 76);
    this._drawDecorativeBall(ctx, cx - 170, cy - 38, 18);
    this._drawDecorativeBall(ctx, cx + 170, cy - 38, 18);
    ctx.font = '12px "Courier New"'; ctx.fillStyle = '#555';
    ctx.fillText('WASD/Arrows: scroll  |  Left click: select  |  Right click: move/attack  |  ESC: cancel', cx, cy + 108);
    const btnW = 160, btnH = 50, btnX = cx - 80, btnY = cy + 130;
    ctx.fillStyle = '#1f2937'; ctx.strokeStyle = COLORS.ORANGE; ctx.lineWidth = 2;
    drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.ORANGE; ctx.font = 'bold 24px "Courier New"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('[ PLAY ]', cx, btnY + btnH / 2);
  }

  _drawDecorativeBall(ctx, x, y, r) {
    ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.65, 0.2, 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.65, 3.3, 4.5); ctx.stroke();
  }

  _drawEndScreen(ctx, title, titleColor, subtitle) {
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2 - 30;
    ctx.shadowColor = titleColor; ctx.shadowBlur = 32;
    ctx.font = 'bold 72px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = titleColor; ctx.fillText(title, cx, cy - 20);
    ctx.shadowBlur = 0;
    ctx.font = '22px "Courier New"'; ctx.fillStyle = '#aaaaaa'; ctx.fillText(subtitle, cx, cy + 46);
    ctx.font = '16px "Courier New"'; ctx.fillStyle = '#666'; ctx.fillText('Click anywhere to restart', cx, cy + 90);
  }
}
