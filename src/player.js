import { START_BASEBALLS } from './constants.js';

export class Player {
  constructor() {
    this.baseballs = START_BASEBALLS;
    this.selectedIds = new Set();
    this.buildMode = null;      // null | BLDG type string
    this.ghostTile = null;      // {tx, ty} | null
    this.ghostValid = false;
  }

  select(entity) {
    this.selectedIds.clear();
    if (entity) this.selectedIds.add(entity.id);
  }

  addToSelection(entity) {
    if (entity) this.selectedIds.add(entity.id);
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  canAfford(cost) {
    return this.baseballs >= cost;
  }

  spend(cost) {
    this.baseballs = Math.max(0, this.baseballs - cost);
  }

  earn(amount) {
    this.baseballs += amount;
  }

  setBuildMode(type) {
    this.buildMode = type;
    this.ghostTile = null;
    this.ghostValid = false;
  }

  cancelBuildMode() {
    this.buildMode = null;
    this.ghostTile = null;
    this.ghostValid = false;
  }
}
