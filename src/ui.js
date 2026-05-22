import {
  CANVAS_WIDTH, VIEWPORT_HEIGHT, HUD_HEIGHT, COLORS,
  TEAM, BLDG, UNIT, POP_CAP, INNING_DURATION, MAX_INNINGS
} from './constants.js';
import { UNIT_DEF, BLDG_DEF } from './defs.js';
import { Building, Unit } from './entity.js';
import { drawRoundedRect, pointInRect } from './utils.js';

// HUD starts at VIEWPORT_HEIGHT in canvas coords
const HUD_Y = VIEWPORT_HEIGHT;

export class UI {
  constructor() {
    // Each button: { action, enabled, x, y, w, h } in CANVAS coords
    this.buttons = [];
    this.hoveredButtonIdx = -1;
  }

  // Returns list of button descriptors (not yet positioned)
  getCommandButtons(game) {
    const btns = [];
    const selected = [...game.player.selectedIds]
      .map(id => game.entities.find(e => e.id === id))
      .filter(Boolean);

    if (selected.length === 0) return btns;

    // Single player building selected → show train buttons
    if (
      selected.length === 1 &&
      selected[0] instanceof Building &&
      selected[0].team === TEAM.PLAYER
    ) {
      const bldg = selected[0];
      const bDef = BLDG_DEF[bldg.type];

      for (const unitType of bDef.trainable) {
        const uDef = UNIT_DEF[unitType];
        const popCount = game.entities.filter(
          e => e.alive && e instanceof Unit && e.team === TEAM.PLAYER
        ).length;
        const atCap = popCount >= POP_CAP;
        const canAfford = game.player.canAfford(uDef.cost);
        const isReady = bldg.complete;

        btns.push({
          label: uDef.label,
          name: uDef.name,
          cost: uDef.cost,
          icon: _unitIcon(unitType),
          enabled: canAfford && !atCap && isReady,
          tip: atCap ? 'Pop cap!' : !isReady ? 'Constructing' : !canAfford ? 'Need ⚾' : '',
          action: { type: 'train', unitType, buildingId: bldg.id }
        });
      }
    }

    // Any player Groundskeeper selected → show build buttons
    const hasGK = selected.some(
      e => e instanceof Unit && e.type === UNIT.GROUNDSKEEPER && e.team === TEAM.PLAYER
    );
    if (hasGK) {
      for (const bldgType of [BLDG.BATTING_CAGE, BLDG.BULLPEN, BLDG.BLEACHERS]) {
        const bDef = BLDG_DEF[bldgType];
        const canAfford = game.player.canAfford(bDef.cost);
        btns.push({
          label: bDef.label,
          name: bDef.name,
          cost: bDef.cost,
          icon: _bldgIcon(bldgType),
          enabled: canAfford,
          tip: canAfford ? `Build ${bDef.name}` : 'Need ⚾',
          action: { type: 'build', bldgType }
        });
      }
    }

    // Retire button for any single selected player unit
    if (selected.length === 1 && selected[0] instanceof Unit && selected[0].team === TEAM.PLAYER) {
      btns.push({
        label: 'RET',
        name: 'Retire',
        cost: 0,
        icon: '👋',
        enabled: true,
        tip: 'Remove unit, free pop slot',
        action: { type: 'retire', unitId: selected[0].id }
      });
    }

    return btns;
  }

  // cx, cy are full canvas coordinates
  handleClick(cx, cy, game) {
    if (cy < HUD_Y) return false;

    for (const btn of this.buttons) {
      if (pointInRect(cx, cy, btn.x, btn.y, btn.w, btn.h)) {
        if (btn.enabled) {
          this._executeAction(btn.action, game);
        }
        return true; // consumed
      }
    }
    return false;
  }

  _executeAction(action, game) {
    if (action.type === 'train') {
      const bldg = game.entities.find(e => e.id === action.buildingId);
      if (bldg) bldg.queueTrain(action.unitType, game);
    } else if (action.type === 'build') {
      game.player.setBuildMode(action.bldgType);
      document.getElementById('gameCanvas').classList.add('crosshair');
    } else if (action.type === 'retire') {
      game.retireUnit(action.unitId);
    }
  }

  // cx, cy are full canvas coordinates
  updateHover(cx, cy) {
    this.hoveredButtonIdx = -1;
    if (cy < HUD_Y) return;
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      if (pointInRect(cx, cy, btn.x, btn.y, btn.w, btn.h)) {
        this.hoveredButtonIdx = i;
        break;
      }
    }
  }

  draw(ctx, game) {
    // Background
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, HUD_Y, CANVAS_WIDTH, HUD_HEIGHT);

    // Top border (orange accent)
    ctx.strokeStyle = COLORS.ORANGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HUD_Y);
    ctx.lineTo(CANVAS_WIDTH, HUD_Y);
    ctx.stroke();

    // Panel dividers
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    [300, 900].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, HUD_Y);
      ctx.lineTo(x, HUD_Y + HUD_HEIGHT);
      ctx.stroke();
    });

    this._drawSelectionPanel(ctx, game);
    this._drawCommandPanel(ctx, game);
    this._drawStatsPanel(ctx, game);
  }

  // ---------- LEFT PANEL ----------
  _drawSelectionPanel(ctx, game) {
    const px = 5, py = HUD_Y + 5, pw = 290, ph = HUD_HEIGHT - 10;

    const selected = [...game.player.selectedIds]
      .map(id => game.entities.find(e => e.id === id))
      .filter(Boolean);

    if (selected.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No selection', px + pw / 2, py + ph / 2);
      return;
    }

    if (selected.length === 1) {
      this._drawSingleInfo(ctx, selected[0], px, py, pw, ph);
    } else {
      this._drawMultiInfo(ctx, selected, px, py, pw, ph);
    }
  }

  _drawSingleInfo(ctx, e, px, py, pw, ph) {
    const portSz = ph - 16;
    const portX = px + 5;
    const portY = py + 8;
    const isPlayer = e.team === TEAM.PLAYER;
    const accentColor = isPlayer ? COLORS.CYAN : COLORS.RED;

    // Portrait box
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, portX, portY, portSz, portSz, 4);
    ctx.fill();
    ctx.stroke();

    const cx = portX + portSz / 2;
    const cy = portY + portSz / 2;

    if (e instanceof Unit) {
      const def = UNIT_DEF[e.type];
      ctx.fillStyle = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
      ctx.beginPath();
      ctx.arc(cx, cy, portSz * 0.30, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = `bold ${Math.floor(portSz * 0.28)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, cx, cy);
    } else if (e instanceof Building) {
      const def = BLDG_DEF[e.type];
      ctx.fillStyle = isPlayer ? COLORS.PLAYER_BLDG_FILL : COLORS.ENEMY_BLDG_FILL;
      ctx.fillRect(portX + 6, portY + 6, portSz - 12, portSz - 12);
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = `bold ${Math.floor(portSz * 0.22)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, cx, cy);
    }

    // Text info
    const infoX = portX + portSz + 10;
    const infoW = pw - portSz - 22;

    let name = '', statusLine = '', extraLine = '';
    if (e instanceof Unit) {
      const def = UNIT_DEF[e.type];
      name = def.name;
      statusLine = e.state;
      if (e.isWorker && e.carryAmt > 0) extraLine = `Carry: ${e.carryAmt}/${e.carryMax} ⚾`;
    } else if (e instanceof Building) {
      const def = BLDG_DEF[e.type];
      name = def.name;
      if (!e.complete) {
        statusLine = `Building ${Math.floor(e.constructProgress * 100)}%`;
      } else if (e.productionQueue.length > 0) {
        const uDef = UNIT_DEF[e.productionQueue[0]];
        const pct = Math.floor((e.trainTimer / uDef.trainTime) * 100);
        statusLine = `Training ${uDef.label}... ${pct}%`;
        if (e.productionQueue.length > 1) extraLine = `Queue: +${e.productionQueue.length - 1}`;
      } else {
        statusLine = 'Idle';
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillText(name, infoX, py + 8);

    // HP bar
    const hpRatio = e.hp / e.maxHp;
    const hpColor = hpRatio > 0.6 ? COLORS.HP_HIGH : hpRatio > 0.3 ? COLORS.HP_MID : COLORS.HP_LOW;
    ctx.fillStyle = COLORS.HP_BG;
    ctx.fillRect(infoX, py + 26, infoW, 6);
    ctx.fillStyle = hpColor;
    ctx.fillRect(infoX, py + 26, infoW * hpRatio, 6);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px "Courier New"';
    ctx.fillText(`HP ${Math.ceil(e.hp)}/${e.maxHp}`, infoX, py + 37);

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px "Courier New"';
    ctx.fillText(statusLine, infoX, py + 52);
    if (extraLine) ctx.fillText(extraLine, infoX, py + 66);
  }

  _drawMultiInfo(ctx, selected, px, py, pw, ph) {
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = 'bold 12px "Courier New"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${selected.length} units selected`, px + 5, py + 4);

    const iconSz = 22, gap = 4;
    const cols = Math.floor(pw / (iconSz + gap));
    selected.slice(0, 12).forEach((e, i) => {
      if (!(e instanceof Unit)) return;
      const def = UNIT_DEF[e.type];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ix = px + 5 + col * (iconSz + gap);
      const iy = py + 22 + row * (iconSz + gap);

      const isPlayer = e.team === TEAM.PLAYER;
      ctx.fillStyle = isPlayer ? COLORS.PLAYER_BODY : COLORS.ENEMY_BODY;
      drawRoundedRect(ctx, ix, iy, iconSz, iconSz, 3);
      ctx.fill();
      ctx.strokeStyle = COLORS.CYAN;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = 'bold 9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, ix + iconSz / 2, iy + iconSz / 2);
    });
  }

  // ---------- CENTER PANEL ----------
  _drawCommandPanel(ctx, game) {
    const panelX = 305;
    const panelY = HUD_Y;
    const panelW = 590;

    const cmdBtns = this.getCommandButtons(game);

    const btnSz = 70;
    const gap = 8;
    const cols = 4;
    const totalBtnW = cols * btnSz + (cols - 1) * gap;
    const startX = panelX + Math.floor((panelW - totalBtnW) / 2);
    const startY = panelY + 8;

    // Build this.buttons list (canvas coords)
    this.buttons = [];

    cmdBtns.slice(0, 8).forEach((btn, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnSz + gap);
      const by = startY + row * (btnSz + gap);

      // Store in canvas coords for hit-testing
      const storedBtn = { ...btn, x: bx, y: by, w: btnSz, h: btnSz };
      this.buttons.push(storedBtn);

      const hovered = this.hoveredButtonIdx === i;

      // Button background
      ctx.fillStyle = !btn.enabled
        ? COLORS.BUTTON_DISABLED
        : hovered
          ? COLORS.BUTTON_HOVER
          : COLORS.BUTTON_BG;
      ctx.strokeStyle = !btn.enabled ? '#2d3748' : hovered ? COLORS.ORANGE : COLORS.BUTTON_BORDER;
      ctx.lineWidth = hovered ? 2 : 1.5;
      drawRoundedRect(ctx, bx, by, btnSz, btnSz, 5);
      ctx.fill();
      ctx.stroke();

      // Icon (emoji)
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(btn.icon, bx + btnSz / 2, by + 5);

      // Name label
      ctx.fillStyle = btn.enabled ? COLORS.WHITE : '#4b5563';
      ctx.font = 'bold 9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const shortName = btn.name.length > 10 ? btn.name.substring(0, 10) : btn.name;
      ctx.fillText(shortName, bx + btnSz / 2, by + 31);

      // Cost
      ctx.fillStyle = btn.enabled ? COLORS.GOLD : '#4b5563';
      ctx.font = '9px "Courier New"';
      ctx.fillText(`⚾${btn.cost}`, bx + btnSz / 2, by + 44);

      // Dimmed overlay when disabled
      if (!btn.enabled) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        drawRoundedRect(ctx, bx, by, btnSz, btnSz, 5);
        ctx.fill();
      }
    });

    // Build mode notification
    if (game.player.buildMode) {
      const bDef = BLDG_DEF[game.player.buildMode];
      ctx.fillStyle = COLORS.ORANGE;
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `BUILD MODE: ${bDef.name} — ESC to cancel`,
        panelX + panelW / 2,
        HUD_Y + HUD_HEIGHT - 4
      );
    }
  }

  // ---------- RIGHT PANEL ----------
  _drawStatsPanel(ctx, game) {
    const px = 908;
    const py = HUD_Y + 8;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Baseballs
    ctx.shadowColor = COLORS.GOLD;
    ctx.shadowBlur = 6;
    ctx.fillStyle = COLORS.GOLD;
    ctx.font = 'bold 16px "Courier New"';
    ctx.fillText(`⚾ ${game.player.baseballs}`, px, py);
    ctx.shadowBlur = 0;

    // Population
    const unitCount = game.entities.filter(
      e => e.alive && e instanceof Unit && e.team === TEAM.PLAYER
    ).length;
    ctx.fillStyle = unitCount >= POP_CAP ? COLORS.RED : COLORS.WHITE;
    ctx.font = '13px "Courier New"';
    ctx.fillText(`👥 ${unitCount} / ${POP_CAP}`, px, py + 22);

    // Inning
    const inning = Math.min(MAX_INNINGS, Math.floor(game.inningTimer / INNING_DURATION) + 1);
    ctx.fillStyle = COLORS.ORANGE;
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillText(`INNING ${inning} / ${MAX_INNINGS}`, px, py + 42);

    // Time until next inning
    const secLeft = Math.ceil(INNING_DURATION - (game.inningTimer % INNING_DURATION));
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px "Courier New"';
    ctx.fillText(`Next: ${secLeft}s`, px, py + 60);

    // Enemy info
    const enemyCount = game.entities.filter(
      e => e.alive && e instanceof Unit && e.team === TEAM.ENEMY
    ).length;
    ctx.fillStyle = '#ef5350';
    ctx.font = '11px "Courier New"';
    ctx.fillText(`ENEMY: ${enemyCount} units`, px, py + 76);

    // Harvest rate
    const harvesting = game.entities.filter(
      e => e.alive && e instanceof Unit && e.type === UNIT.GROUNDSKEEPER &&
           e.team === TEAM.PLAYER && e.state === 'HARVESTING'
    ).length;
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px "Courier New"';
    ctx.fillText(`Income: ~${harvesting * 10}/s`, px, py + 92);
  }
}

function _unitIcon(type) {
  const m = {
    GROUNDSKEEPER: '🔧',
    BATTER: '🏏',
    PITCHER: '⚾',
    CATCHER: '🛡',
    SLUGGER: '💥'
  };
  return m[type] || '?';
}

function _bldgIcon(type) {
  const m = {
    BATTING_CAGE: '🏟',
    BULLPEN: '⚡',
    BLEACHERS: '🗼'
  };
  return m[type] || '?';
}
