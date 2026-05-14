import { TEAM, BLDG, UNIT, STATE, TILE } from './constants.js';
import { BLDG_DEF, UNIT_DEF } from './defs.js';
import { Building, Unit } from './entity.js';
import { worldToTile } from './utils.js';

export class AI {
  constructor() {
    this.baseballs = 200;
    this.state = 'building';    // 'building' | 'attacking'
    this.tickTimer = 0;
    this.tickInterval = 1.0;
    this.elapsedTime = 0;
    this.attackCooldown = 0;
    this.lastAttackSent = 0;
  }

  update(dt, game) {
    this.elapsedTime += dt;
    this.tickTimer += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (this.tickTimer >= this.tickInterval) {
      this.tickTimer = 0;
      this._tick(game);
    }
  }

  _tick(game) {
    const myUnits = game.entities.filter(e =>
      e.alive && e instanceof Unit && e.team === TEAM.ENEMY
    );
    const myBuildings = game.entities.filter(e =>
      e.alive && e instanceof Building && e.team === TEAM.ENEMY
    );

    const myWorkers = myUnits.filter(u => u.isWorker);
    const myFighters = myUnits.filter(u => !u.isWorker);

    const hasBattingCage = myBuildings.some(b => b.type === BLDG.BATTING_CAGE);
    const hasBullpen = myBuildings.some(b => b.type === BLDG.BULLPEN);
    const hasBleachers = myBuildings.some(b => b.type === BLDG.BLEACHERS);
    const dugout = myBuildings.find(b => b.type === BLDG.DUGOUT);

    // Determine phase
    const shouldAttack = myFighters.length >= 8 || this.elapsedTime >= 90;

    if (shouldAttack && myFighters.length >= 5) {
      this.state = 'attacking';
    } else {
      this.state = 'building';
    }

    // Build phase actions
    this._buildPhase(game, myWorkers, myBuildings, dugout, hasBattingCage, hasBullpen, hasBleachers);

    // Always train
    this._trainUnits(game, myBuildings, myFighters, myWorkers);

    // Attack
    if (this.state === 'attacking') {
      this._attackPhase(game, myFighters);
    }
  }

  _buildPhase(game, myWorkers, myBuildings, dugout, hasBattingCage, hasBullpen, hasBleachers) {
    if (!dugout || !dugout.alive) return;

    // Build workers up to 3
    if (myWorkers.length < 3) {
      const dugoutBuilding = myBuildings.find(b => b.type === BLDG.DUGOUT && b.complete);
      if (dugoutBuilding && this.baseballs >= UNIT_DEF[UNIT.GROUNDSKEEPER].cost) {
        if (dugoutBuilding.productionQueue.length < 2) {
          dugoutBuilding.queueTrain(UNIT.GROUNDSKEEPER, game);
        }
      }
    }

    // Build Batting Cage
    if (!hasBattingCage && this.baseballs >= BLDG_DEF[BLDG.BATTING_CAGE].cost) {
      this._placeBuilding(game, BLDG.BATTING_CAGE, dugout);
    }

    // Build Bullpen
    if (!hasBullpen && this.baseballs >= BLDG_DEF[BLDG.BULLPEN].cost) {
      this._placeBuilding(game, BLDG.BULLPEN, dugout);
    }

    // Build Bleachers for defense
    if (!hasBleachers && this.baseballs >= BLDG_DEF[BLDG.BLEACHERS].cost) {
      this._placeBuilding(game, BLDG.BLEACHERS, dugout);
    }
  }

  _placeBuilding(game, type, dugout) {
    const def = BLDG_DEF[type];
    const cost = def.cost;
    if (this.baseballs < cost) return;

    // Find a suitable tile near dugout
    const baseTx = dugout.tileX;
    const baseTy = dugout.tileY;

    // Search in expanding rings around dugout
    for (let radius = 4; radius <= 16; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tx = baseTx + dx;
          const ty = baseTy + dy;
          if (!game.map.isInBounds(tx, ty)) continue;
          if (!game.map.isInBounds(tx + def.tileW - 1, ty + def.tileH - 1)) continue;
          if (game.map.isAreaClear(tx, ty, def.tileW, def.tileH)) {
            // Double-check no entity in that area
            if (this._isEntityFree(game, tx, ty, def.tileW, def.tileH)) {
              this.baseballs -= cost;
              game.spawnBuilding(type, TEAM.ENEMY, tx, ty);
              return;
            }
          }
        }
      }
    }
  }

  _isEntityFree(game, tx, ty, tw, th) {
    const wx1 = tx * TILE;
    const wy1 = ty * TILE;
    const wx2 = (tx + tw) * TILE;
    const wy2 = (ty + th) * TILE;

    for (const e of game.entities) {
      if (!e.alive) continue;
      if (e instanceof Building) {
        const bx1 = e.tileX * TILE;
        const by1 = e.tileY * TILE;
        const bx2 = (e.tileX + e.tileW) * TILE;
        const by2 = (e.tileY + e.tileH) * TILE;
        if (wx1 < bx2 && wx2 > bx1 && wy1 < by2 && wy2 > by1) return false;
      }
    }
    return true;
  }

  _trainUnits(game, myBuildings, myFighters, myWorkers) {
    const totalEnemyUnits = game.entities.filter(e =>
      e.alive && e instanceof Unit && e.team === TEAM.ENEMY
    ).length;

    if (totalEnemyUnits >= 20) return; // Pop cap

    for (const bldg of myBuildings) {
      if (!bldg.complete) continue;
      if (bldg.productionQueue.length >= 3) continue;

      if (bldg.type === BLDG.DUGOUT) {
        // Train workers if less than 3
        if (myWorkers.length + bldg.productionQueue.length < 3) {
          bldg.queueTrain(UNIT.GROUNDSKEEPER, game);
        }
      } else if (bldg.type === BLDG.BATTING_CAGE) {
        // Alternate batter/catcher
        const trainType = myFighters.length % 3 === 0 ? UNIT.CATCHER : UNIT.BATTER;
        bldg.queueTrain(trainType, game);
      } else if (bldg.type === BLDG.BULLPEN) {
        const trainType = myFighters.length % 4 === 0 ? UNIT.SLUGGER : UNIT.PITCHER;
        bldg.queueTrain(trainType, game);
      }
    }
  }

  _attackPhase(game, myFighters) {
    if (this.attackCooldown > 0) return;

    // Find player dugout
    const playerDugout = game.entities.find(e =>
      e.alive && e instanceof Building && e.team === TEAM.PLAYER && e.type === BLDG.DUGOUT
    );
    if (!playerDugout) return;

    // Also find any player units to target
    const playerUnits = game.entities.filter(e =>
      e.alive && e instanceof Unit && e.team === TEAM.PLAYER
    );

    for (const fighter of myFighters) {
      if (fighter.state === STATE.IDLE || fighter.state === STATE.MOVING) {
        // Find nearest player entity
        let target = null;
        let minDist = Infinity;

        for (const pu of playerUnits) {
          const d = fighter.distTo(pu);
          if (d < minDist) {
            minDist = d;
            target = pu;
          }
        }

        if (target && minDist < fighter.range * 3) {
          fighter.attackTarget(target);
        } else {
          // March on dugout
          fighter.moveTo(
            playerDugout.x + (Math.random() - 0.5) * 48,
            playerDugout.y + (Math.random() - 0.5) * 48,
            game
          );
        }
      }
    }

    this.attackCooldown = 5; // Re-issue attack orders every 5 seconds
  }
}
