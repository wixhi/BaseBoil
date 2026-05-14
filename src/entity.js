import { STATE, TEAM, TILE, UNIT, BLDG } from './constants.js';
import { UNIT_DEF, BLDG_DEF } from './defs.js';
import { genId, dist, tileToWorld, worldToTile, astar, norm } from './utils.js';

export class Entity {
  constructor(x, y, team) {
    this.id = genId();
    this.x = x;
    this.y = y;
    this.team = team;
    this.hp = 1;
    this.maxHp = 1;
    this.alive = true;
  }

  takeDamage(amount, game) {
    if (!this.alive) return;
    this.hp -= amount;
    if (game) {
      game.floatingNumbers.push({
        x: this.x,
        y: this.y - 16,
        value: amount,
        timer: 0.8
      });
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  distTo(other) {
    return dist(this, other);
  }
}

export class Unit extends Entity {
  constructor(type, team, x, y) {
    super(x, y, team);
    this.type = type;
    const def = UNIT_DEF[type];
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.speed = def.speed;
    this.damage = def.damage;
    this.range = def.range;
    this.attackSpeed = def.attackSpeed;
    this.isWorker = def.isWorker;
    this.harvestRate = def.harvestRate || 0;
    this.carryMax = def.carryMax || 0;
    this.isRanged = def.isRanged;
    this.projectileSpeed = def.projectileSpeed || 0;
    this.radius = def.radius;

    this.state = STATE.IDLE;
    this.target = null;       // Entity to attack
    this.movePath = [];       // Array of {tx, ty}
    this.moveTarget = null;   // {x, y} final destination
    this.attackTimer = 0;
    this.carryAmt = 0;
    this.harvestTimer = 0;
    this.harvestTarget = null; // {tx, ty} resource tile
    this.depositTarget = null; // Building (Dugout)
    this.attackMoveTarget = null; // Entity for attack-move
    this.idleTimer = 0;
  }

  update(dt, game) {
    if (!this.alive) return;

    this.attackTimer = Math.max(0, this.attackTimer - dt);

    switch (this.state) {
      case STATE.IDLE:
        this._updateIdle(dt, game);
        break;
      case STATE.MOVING:
        this._updateMoving(dt, game);
        break;
      case STATE.ATTACKING:
        this._updateAttacking(dt, game);
        break;
      case STATE.HARVESTING:
        this._updateHarvesting(dt, game);
        break;
      case STATE.RETURNING:
        this._updateReturning(dt, game);
        break;
    }
  }

  _updateIdle(dt, game) {
    this.idleTimer -= dt;
    if (this.idleTimer > 0) return;
    this.idleTimer = 0.3; // Re-check every 0.3s

    // Workers: auto-harvest nearby resources
    if (this.isWorker && this.team === TEAM.PLAYER) {
      if (this.carryAmt < this.carryMax) {
        const res = game.map.nearestResource(this.x, this.y);
        if (res) {
          this.harvestTarget = res;
          this.state = STATE.HARVESTING;
          this._pathTo(res.tx * TILE + TILE / 2, res.ty * TILE + TILE / 2, game);
          return;
        }
      } else {
        // Find dugout to deposit
        const dugout = game.entities.find(e =>
          e.alive && e.team === TEAM.PLAYER && e instanceof Building && e.type === BLDG.DUGOUT
        );
        if (dugout) {
          this.depositTarget = dugout;
          this.state = STATE.RETURNING;
          this._pathTo(dugout.x, dugout.y, game);
          return;
        }
      }
    }

    // Enemy workers: auto-harvest
    if (this.isWorker && this.team === TEAM.ENEMY) {
      if (this.carryAmt < this.carryMax) {
        const res = game.map.nearestResource(this.x, this.y);
        if (res) {
          this.harvestTarget = res;
          this.state = STATE.HARVESTING;
          this._pathTo(res.tx * TILE + TILE / 2, res.ty * TILE + TILE / 2, game);
          return;
        }
      } else {
        const dugout = game.entities.find(e =>
          e.alive && e.team === TEAM.ENEMY && e instanceof Building && e.type === BLDG.DUGOUT
        );
        if (dugout) {
          this.depositTarget = dugout;
          this.state = STATE.RETURNING;
          this._pathTo(dugout.x, dugout.y, game);
          return;
        }
      }
    }

    // Auto-attack nearby enemies
    const detectionRange = this.range * 2;
    const enemy = game.getNearestEnemy(this, detectionRange);
    if (enemy) {
      this.target = enemy;
      this.state = STATE.ATTACKING;
    }
  }

  _updateMoving(dt, game) {
    // Check for enemies to attack while moving (attack-move)
    if (this.attackMoveTarget) {
      if (!this.attackMoveTarget.alive) {
        this.attackMoveTarget = null;
      } else {
        const d = this.distTo(this.attackMoveTarget);
        if (d <= this.range + this.attackMoveTarget.radius) {
          this.target = this.attackMoveTarget;
          this.state = STATE.ATTACKING;
          this.movePath = [];
          return;
        }
      }
    }

    if (this.movePath.length === 0) {
      this.state = STATE.IDLE;
      this.attackMoveTarget = null;
      return;
    }

    const nextTile = this.movePath[0];
    const wx = nextTile.tx * TILE + TILE / 2;
    const wy = nextTile.ty * TILE + TILE / 2;
    const dx = wx - this.x;
    const dy = wy - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 4) {
      this.movePath.shift();
      if (this.movePath.length === 0) {
        this.state = STATE.IDLE;
        this.attackMoveTarget = null;
      }
      return;
    }

    const spd = this.speed * dt;
    const nx = dx / d;
    const ny = dy / d;
    this.x += nx * spd;
    this.y += ny * spd;

    // Separate from other units (simple push)
    this._separate(game, 0.3);
  }

  _updateAttacking(dt, game) {
    if (!this.target || !this.target.alive) {
      this.target = null;
      this.state = STATE.IDLE;
      return;
    }

    const d = this.distTo(this.target);
    const r = this.target.radius || 12;

    if (d > this.range + r + 16) {
      // Move toward target
      this._pathTo(this.target.x, this.target.y, game);
      this.state = STATE.MOVING;
      return;
    }

    // In range: attack
    if (this.attackTimer <= 0) {
      this.attackTimer = 1 / this.attackSpeed;
      if (this.isRanged) {
        const n = norm(this.target.x - this.x, this.target.y - this.y);
        game.addProjectile({
          x: this.x,
          y: this.y,
          vx: n.x * this.projectileSpeed,
          vy: n.y * this.projectileSpeed,
          damage: this.damage,
          team: this.team,
          targetId: this.target.id,
          speed: this.projectileSpeed,
          trail: []
        });
      } else {
        this.target.takeDamage(this.damage, game);
      }
    }

    // Keep moving if target moved out of range
    if (d > this.range + r) {
      const spd = this.speed * dt;
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.x += (dx / len) * spd;
      this.y += (dy / len) * spd;
    }
  }

  _updateHarvesting(dt, game) {
    if (!this.harvestTarget) {
      this.state = STATE.IDLE;
      return;
    }

    const tx = this.harvestTarget.tx;
    const ty = this.harvestTarget.ty;

    // Check if resource tile still exists
    if (game.map.getTile(tx, ty) !== 3) { // TILE_TYPE.RESOURCE
      this.harvestTarget = null;
      this.state = STATE.IDLE;
      return;
    }

    const wx = tx * TILE + TILE / 2;
    const wy = ty * TILE + TILE / 2;
    const d = dist({ x: this.x, y: this.y }, { x: wx, y: wy });

    if (d > TILE * 1.5) {
      // Move to resource
      if (this.movePath.length === 0) {
        this._pathTo(wx, wy, game);
      }
      this._followPath(dt, game);
      return;
    }

    // Harvesting
    this.harvestTimer += dt;
    if (this.harvestTimer >= 1) {
      this.harvestTimer -= 1;
      const amount = Math.min(this.harvestRate, this.carryMax - this.carryAmt);
      this.carryAmt += amount;
    }

    if (this.carryAmt >= this.carryMax) {
      // Full: return to deposit
      const dugout = game.entities.find(e =>
        e.alive && e.team === this.team && e instanceof Building && e.type === BLDG.DUGOUT
      );
      if (dugout) {
        this.depositTarget = dugout;
        this.state = STATE.RETURNING;
        this._pathTo(dugout.x, dugout.y, game);
      } else {
        this.state = STATE.IDLE;
      }
    }
  }

  _updateReturning(dt, game) {
    if (!this.depositTarget || !this.depositTarget.alive) {
      this.depositTarget = null;
      this.state = STATE.IDLE;
      return;
    }

    const d = this.distTo(this.depositTarget);
    if (d < 48) {
      // Deposit
      if (this.team === TEAM.PLAYER) {
        game.player.earn(this.carryAmt);
      } else {
        game.ai.baseballs += this.carryAmt;
      }
      this.carryAmt = 0;
      this.harvestTarget = null;
      this.state = STATE.IDLE;
      return;
    }

    if (this.movePath.length === 0) {
      this._pathTo(this.depositTarget.x, this.depositTarget.y, game);
    }
    this._followPath(dt, game);
  }

  _followPath(dt, game) {
    if (this.movePath.length === 0) return;

    const nextTile = this.movePath[0];
    const wx = nextTile.tx * TILE + TILE / 2;
    const wy = nextTile.ty * TILE + TILE / 2;
    const dx = wx - this.x;
    const dy = wy - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 4) {
      this.movePath.shift();
      return;
    }

    const spd = this.speed * dt;
    this.x += (dx / d) * spd;
    this.y += (dy / d) * spd;
  }

  _pathTo(wx, wy, game) {
    const start = worldToTile(this.x, this.y);
    const goal = worldToTile(wx, wy);
    this.movePath = astar(start, goal, (tx, ty) => game.map.isBlocked(tx, ty));
    this.moveTarget = { x: wx, y: wy };
  }

  _separate(game, strength) {
    const minDist = this.radius * 2 + 2;
    for (const e of game.entities) {
      if (e === this || !e.alive || !(e instanceof Unit)) continue;
      const dx = this.x - e.x;
      const dy = this.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist && d > 0) {
        const push = (minDist - d) / minDist * strength;
        this.x += (dx / d) * push;
        this.y += (dy / d) * push;
      }
    }
  }

  moveTo(wx, wy, game) {
    this._pathTo(wx, wy, game);
    this.state = STATE.MOVING;
    this.target = null;
    this.attackMoveTarget = null;
  }

  attackTarget(entity) {
    this.target = entity;
    this.state = STATE.ATTACKING;
    this.movePath = [];
    this.attackMoveTarget = null;
  }

  attackMove(entity, game) {
    this.attackMoveTarget = entity;
    this._pathTo(entity.x, entity.y, game);
    this.state = STATE.MOVING;
    this.target = null;
  }
}

export class Building extends Entity {
  constructor(type, team, tx, ty) {
    const def = BLDG_DEF[type];
    const worldX = (tx + def.tileW / 2) * TILE;
    const worldY = (ty + def.tileH / 2) * TILE;
    super(worldX, worldY, team);
    this.type = type;
    this.tileX = tx;
    this.tileY = ty;
    this.tileW = def.tileW;
    this.tileH = def.tileH;
    this.hp = def.isMain ? def.hp : 1;
    this.maxHp = def.hp;
    this.complete = def.isMain || def.buildTime === 0;
    this.constructProgress = def.isMain ? 1 : 0;
    this.buildTime = def.buildTime;
    this.productionQueue = [];
    this.trainTimer = 0;
    this.isAttacker = def.isAttacker;
    this.attackDamage = def.attackDamage || 0;
    this.attackRange = def.attackRange || 0;
    this.attackSpeed = def.attackSpeed || 0;
    this.isRanged = def.isRanged || false;
    this.attackTimer = 0;
    this.radius = Math.min(def.tileW, def.tileH) * TILE / 2;
    this.exitX = worldX + def.tileW * TILE / 2;
    this.exitY = worldY + def.tileH * TILE / 2;
  }

  update(dt, game) {
    if (!this.alive) return;

    // Construction
    if (!this.complete) {
      this.constructProgress = Math.min(1, this.constructProgress + dt / this.buildTime);
      this.hp = Math.max(1, Math.floor(this.constructProgress * this.maxHp));
      if (this.constructProgress >= 1) {
        this.complete = true;
        this.hp = this.maxHp;
      }
      return;
    }

    // Production queue
    if (this.productionQueue.length > 0) {
      const def = UNIT_DEF[this.productionQueue[0]];
      this.trainTimer += dt;
      if (this.trainTimer >= def.trainTime) {
        this.trainTimer = 0;
        const unitType = this.productionQueue.shift();
        // Spawn unit at exit (below building)
        const ex = this.x + (Math.random() - 0.5) * TILE;
        const ey = (this.tileY + this.tileH) * TILE + TILE / 2;
        game.spawnUnit(unitType, this.team, ex, ey);
      }
    }

    // Tower attack
    if (this.isAttacker) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      if (this.attackTimer <= 0) {
        const enemy = game.getNearestEnemy(this, this.attackRange);
        if (enemy) {
          this.attackTimer = 1 / this.attackSpeed;
          const n = norm(enemy.x - this.x, enemy.y - this.y);
          game.addProjectile({
            x: this.x,
            y: this.y,
            vx: n.x * 280,
            vy: n.y * 280,
            damage: this.attackDamage,
            team: this.team,
            targetId: enemy.id,
            speed: 280,
            trail: []
          });
        }
      }
    }
  }

  queueTrain(unitType, game) {
    const def = UNIT_DEF[unitType];
    const bDef = BLDG_DEF[this.type];
    if (!bDef.trainable.includes(unitType)) return false;
    if (!this.complete) return false;

    // Check population
    const teamUnits = game.entities.filter(e =>
      e.alive && e instanceof Unit && e.team === this.team
    ).length;
    const { POP_CAP } = game.constants;
    if (teamUnits >= POP_CAP) return false;

    // Check resources
    const cost = def.cost;
    if (this.team === TEAM.PLAYER) {
      if (!game.player.canAfford(cost)) return false;
      game.player.spend(cost);
    } else {
      if (game.ai.baseballs < cost) return false;
      game.ai.baseballs -= cost;
    }

    this.productionQueue.push(unitType);
    return true;
  }
}

export class Projectile {
  constructor(data) {
    this.id = genId();
    this.x = data.x;
    this.y = data.y;
    this.vx = data.vx;
    this.vy = data.vy;
    this.damage = data.damage;
    this.team = data.team;
    this.targetId = data.targetId;
    this.speed = data.speed;
    this.trail = [];
    this.alive = true;
  }

  update(dt, game) {
    if (!this.alive) return;

    // Store trail position
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.pop();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Check map bounds
    const { MAP_COLS, MAP_ROWS, TILE: T } = game.constants;
    if (this.x < 0 || this.x > MAP_COLS * T || this.y < 0 || this.y > MAP_ROWS * T) {
      this.alive = false;
      return;
    }

    // Hit detection
    const opposingTeam = this.team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    for (const e of game.entities) {
      if (!e.alive) continue;
      if (e.team !== opposingTeam) continue;
      const r = (e instanceof Building) ? e.radius : (e.radius || 12);
      const dx = this.x - e.x;
      const dy = this.y - e.y;
      if (dx * dx + dy * dy < r * r) {
        e.takeDamage(this.damage, game);
        this.alive = false;
        return;
      }
    }
  }
}
