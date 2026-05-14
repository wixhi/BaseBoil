import {
  CANVAS_WIDTH, CANVAS_HEIGHT, VIEWPORT_HEIGHT, HUD_HEIGHT,
  TILE, MAP_COLS, MAP_ROWS, TILE_TYPE, TEAM, UNIT, COLORS
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

    // Clear full canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Clip to viewport (excludes HUD area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, VIEWPORT_HEIGHT);
    ctx.clip();

    // Apply world transform
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    this._drawTiles(ctx, cam, game.map);
    this._drawBuildings(ctx, game);
    this._drawUnits(ctx, game);
    this._drawProjectiles(ctx, game);
    this._drawSelectionBox(ctx, game);
    this._drawFloatingNumbers(ctx, game);

    ctx.restore(); // world transform
    ctx.restore(); // viewport clip

    // HUD (drawn in screen space, below viewport)
    this._drawHUD(ctx, game);

    // Overlay (start / won / lost)
    this._drawOverlay(ctx, game);
  }

  _drawTiles(ctx, cam, map) {
    const startCol = Math.max(0, Math.floor(cam.x / TILE));
    const endCol = Math.min(MAP_COLS, Math.ceil((cam.x + CANVAS_WIDTH) / TILE) + 1);
    const startRow = Math.max(0, Math.floor(cam.y / TILE));
    const endRow = Math.min(MAP_ROWS, Math.ceil((cam.y + VIEWPORT_HEIGHT) / TILE) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = map.getTile(c, r);
        const wx = c * TILE;
        const wy = r * TILE;
        this._drawTile(ctx, tile, wx, wy);
      }
    }
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
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + 8);
        ctx.lineTo(wx + 14, wy + 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(wx + 20, wy + 5);
        ctx.lineTo(wx + 28, wy + 15);
        ctx.stroke();
        break;

      case TILE_TYPE.RESOURCE: {
        ctx.fillStyle = COLORS.RESOURCE_BASE;
        ctx.fillRect(wx, wy, TILE, TILE);
        const dots = [
          { x: wx + 8, y: wy + 8 },
          { x: wx + 22, y: wy + 8 },
          { x: wx + 8, y: wy + 22 },
          { x: wx + 22, y: wy + 22 },
          { x: wx + 15, y: wy + 15 }
        ];
        for (const d of dots) {
          ctx.fillStyle = COLORS.RESOURCE_DOT;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#cc0000';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2.5, 0.2, 1.2);
          ctx.stroke();
        }
        break;
      }
    }
  }

  _drawBuildings(ctx, game) {
    for (const e of game.entities) {
      if (!(e instanceof Building) || !e.alive) continue;
      this._drawBuilding(ctx, e, game);
    }

    // Ghost building in build mode
    if (game.player.buildMode && game.player.ghostTile) {
      this._drawGhost(ctx, game);
    }
  }

  _drawBuilding(ctx, bldg, game) {
    const def = BLDG_DEF[bldg.type];
    const x = bldg.tileX * TILE;
    const y = bldg.tileY * TILE;
    const w = bldg.tileW * TILE;
    const h = bldg.tileH * TILE;
    const isPlayer = bldg.team === TEAM.PLAYER;
    const fillColor = isPlayer ? COLORS.PLAYER_BLDG_FILL : COLORS.ENEMY_BLDG_FILL;
    const strokeColor = isPlayer ? COLORS.PLAYER_BLDG_STROKE : COLORS.ENEMY_BLDG_STROKE;

    if (!bldg.complete) {
      // Under construction — striped
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
      ctx.clip();

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = isPlayer ? 'rgba(77,166,255,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.lineWidth = 4;
      for (let i = -h; i < w + h; i += 12) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i - h, y + h);
        ctx.stroke();
      }
      ctx.restore();

      // Construction progress bar
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(x + 4, y + h - 10, w - 8, 6);
      ctx.fillStyle = COLORS.ORANGE;
      ctx.fillRect(x + 4, y + h - 10, (w - 8) * bldg.constructProgress, 6);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Complete
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = fillColor;
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
      ctx.stroke();

      // Interior detail
      ctx.strokeStyle = isPlayer ? 'rgba(79,195,247,0.18)' : 'rgba(239,83,80,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + w - 6, y + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 6, y + h - 6);
      ctx.lineTo(x + w - 6, y + h - 6);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = COLORS.WHITE;
    const fontSize = Math.floor(Math.min(w, h) * 0.25);
    ctx.font = `bold ${fontSize}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, x + w / 2, y + h / 2);

    // Production queue progress bar
    if (bldg.complete && bldg.productionQueue.length > 0) {
      const uDef = UNIT_DEF[bldg.productionQueue[0]];
      const prog = bldg.trainTimer / uDef.trainTime;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x + 2, y + h + 2, w - 4, 5);
      ctx.fillStyle = isPlayer ? COLORS.CYAN : COLORS.RED;
      ctx.fillRect(x + 2, y + h + 2, (w - 4) * prog, 5);
    }

    // HP bar
    const hpRatio = bldg.hp / bldg.maxHp;
    const hpColor = hpRatio > 0.6 ? COLORS.HP_HIGH : hpRatio > 0.3 ? COLORS.HP_MID : COLORS.HP_LOW;
    ctx.fillStyle = COLORS.HP_BG;
    ctx.fillRect(x + 2, y - 7, w - 4, 4);
    ctx.fillStyle = hpColor;
    ctx.fillRect(x + 2, y - 7, (w - 4) * hpRatio, 4);

    // Selection indicator
    if (game.player.selectedIds.has(bldg.id)) {
      ctx.strokeStyle = COLORS.CYAN;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      drawRoundedRect(ctx, x, y, w, h, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawGhost(ctx, game) {
    const type = game.player.buildMode;
    const def = BLDG_DEF[type];
    const { tx, ty } = game.player.ghostTile;
    const x = tx * TILE;
    const y = ty * TILE;
    const w = def.tileW * TILE;
    const h = def.tileH * TILE;
    const valid = game.player.ghostValid;

    ctx.globalAlpha = 0.65;
    ctx.fillStyle = valid ? 'rgba(76,175,80,0.35)' : 'rgba(244,67,54,0.35)';
    drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
    ctx.fill();

    ctx.strokeStyle = valid ? '#4caf50' : '#f44336';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    drawRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.WHITE;
    const fontSize = Math.floor(Math.min(w, h) * 0.25);
    ctx.font = `bold ${fontSize}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, x + w / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }

  _drawUnits(ctx, game) {
    for (const e of game.entities) {
      if (!(e instanceof Unit) || !e.alive) continue;
      this._drawUnit(ctx, e, game);
    }
  }

  _drawUnit(ctx, unit, game) {
    const isPlayer = unit.team === TEAM.PLAYER;
    const def = UNIT_DEF[unit.type];
    const r = unit.radius;
    const selected = game.player.selectedIds.has(unit.id);

    // Selection ring
    if (selected) {
      ctx.strokeStyle = COLORS.CYAN;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Body glow
    const strokeColor = isPlayer ? COLORS.PLAYER_STROKE : COLORS.ENEMY_STROKE;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 5;

    const bodyColor = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Helmet (top semicircle in unit's team color accent)
    const helmetColor = isPlayer ? def.playerColor : def.enemyColor;
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y - 2, r - 2, Math.PI, 0);
    ctx.fill();

    // Bat for batter / slugger
    if (unit.type === UNIT.BATTER || unit.type === UNIT.SLUGGER) {
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(unit.x + r - 2, unit.y);
      ctx.lineTo(unit.x + r + 8, unit.y - 8);
      ctx.stroke();
      ctx.fillStyle = '#D2691E';
      ctx.beginPath();
      ctx.arc(unit.x + r + 8, unit.y - 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Unit label
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = `bold ${r}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, unit.x, unit.y + 2);

    // HP bar
    const hpRatio = unit.hp / unit.maxHp;
    const hpColor = hpRatio > 0.6 ? COLORS.HP_HIGH : hpRatio > 0.3 ? COLORS.HP_MID : COLORS.HP_LOW;
    const barW = r * 2 + 4;
    const barX = unit.x - barW / 2;
    const barY = unit.y - r - 8;
    ctx.fillStyle = COLORS.HP_BG;
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, 3);

    // Worker carry indicator
    if (unit.isWorker && unit.carryAmt > 0) {
      ctx.fillStyle = COLORS.GOLD;
      ctx.font = `8px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${unit.carryAmt}`, unit.x, unit.y - r - 13);
    }
  }

  _drawProjectiles(ctx, game) {
    for (const proj of game.projectiles) {
      if (!proj.alive) continue;
      this._drawProjectile(ctx, proj);
    }
  }

  _drawProjectile(ctx, proj) {
    // Fire trail
    for (let i = 0; i < proj.trail.length; i++) {
      const t = proj.trail[i];
      const alpha = (1 - i / proj.trail.length) * 0.6;
      const r = Math.max(0.5, 3 - i * 0.5);
      ctx.fillStyle = `rgba(255,107,53,${alpha})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glow
    ctx.shadowColor = COLORS.BASEBALL_GLOW;
    ctx.shadowBlur = 10;

    // Baseball
    ctx.fillStyle = COLORS.BASEBALL_FILL;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Seams
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 2.5, 0.3, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 2.5, 3.4, 4.8);
    ctx.stroke();
  }

  _drawSelectionBox(ctx, game) {
    const drag = game.input.getDragRect();
    if (!drag) return;
    // drag is in canvas coordinates; we are in world space (camera transform applied)
    // so add camera offset to convert to world coords
    const cam = game.camera;
    const wx = drag.x + cam.x;
    const wy = drag.y + cam.y;

    ctx.fillStyle = COLORS.SELECTION_FILL;
    ctx.fillRect(wx, wy, drag.w, drag.h);
    ctx.strokeStyle = COLORS.SELECTION_STROKE;
    ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, drag.w, drag.h);
  }

  _drawFloatingNumbers(ctx, game) {
    for (const fn of game.floatingNumbers) {
      const alpha = Math.max(0, fn.timer / 0.8);
      ctx.fillStyle = `rgba(255,80,80,${alpha})`;
      ctx.font = `bold 13px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`-${Math.ceil(fn.value)}`, fn.x, fn.y);
    }
  }

  _drawHUD(ctx, game) {
    game.ui.draw(ctx, game);
  }

  _drawOverlay(ctx, game) {
    if (game.gameState === 'playing') return;

    ctx.fillStyle = COLORS.OVERLAY_BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (game.gameState === 'start') {
      this._drawStartScreen(ctx);
    } else if (game.gameState === 'won') {
      this._drawEndScreen(ctx, 'VICTORY!', COLORS.VICTORY, 'The enemy Dugout has been destroyed!');
    } else if (game.gameState === 'lost') {
      this._drawEndScreen(ctx, 'DEFEAT!', COLORS.DEFEAT, 'Your Dugout has been destroyed...');
    }
  }

  _drawStartScreen(ctx) {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2 - 40;

    // Radial glow behind title
    const grad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 220);
    grad.addColorStop(0, 'rgba(255,152,0,0.22)');
    grad.addColorStop(1, 'rgba(255,152,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 220, cy - 120, 440, 200);

    // Title with fire glow
    ctx.font = 'bold 80px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ff6b35';
    ctx.shadowBlur = 35;
    ctx.fillStyle = COLORS.TITLE_FIRE;
    ctx.fillText('BASEBOIL', cx, cy - 30);

    ctx.shadowColor = '#ff9800';
    ctx.shadowBlur = 16;
    ctx.fillStyle = COLORS.TITLE_ORANGE;
    ctx.fillText('BASEBOIL', cx, cy - 30);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '22px "Courier New"';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText('A Baseball RTS', cx, cy + 42);

    ctx.font = '14px "Courier New"';
    ctx.fillStyle = '#666666';
    ctx.fillText('Build your Dugout. Train your squad. Destroy the enemy.', cx, cy + 76);

    // Decorative baseballs
    this._drawDecorativeBall(ctx, cx - 170, cy - 38, 18);
    this._drawDecorativeBall(ctx, cx + 170, cy - 38, 18);

    // Controls hint
    ctx.font = '12px "Courier New"';
    ctx.fillStyle = '#555';
    ctx.fillText('WASD / Arrows: scroll  |  Left click: select  |  Right click: move/attack  |  ESC: cancel', cx, cy + 108);

    // Play button
    const btnW = 160, btnH = 50;
    const btnX = cx - btnW / 2;
    const btnY = cy + 130;

    ctx.fillStyle = '#1f2937';
    ctx.strokeStyle = COLORS.ORANGE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.ORANGE;
    ctx.font = 'bold 24px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[ PLAY ]', cx, btnY + btnH / 2);
  }

  _drawDecorativeBall(ctx, x, y, r) {
    ctx.shadowColor = '#ff9800';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 0.2, 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 3.3, 4.5);
    ctx.stroke();
  }

  _drawEndScreen(ctx, title, titleColor, subtitle) {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2 - 30;

    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 32;
    ctx.font = 'bold 72px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = titleColor;
    ctx.fillText(title, cx, cy - 20);
    ctx.shadowBlur = 0;

    ctx.font = '22px "Courier New"';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(subtitle, cx, cy + 46);

    ctx.font = '16px "Courier New"';
    ctx.fillStyle = '#666';
    ctx.fillText('Click anywhere to restart', cx, cy + 90);
  }
}
