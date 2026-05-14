import { VIEWPORT_HEIGHT, TILE } from './constants.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 0;          // Canvas coords
    this.mouseY = 0;
    this.worldX = 0;          // World coords
    this.worldY = 0;
    this.buttons = {};         // mouse buttons
    this.keys = {};            // keyboard keys
    this.dragStart = null;     // {x, y} canvas coords when drag began
    this.dragCurrent = null;   // current drag position
    this.isDragging = false;
    this.DRAG_THRESHOLD = 5;

    this.pendingActions = [];  // Queue of action objects

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this._onKeyDown(e));
    window.addEventListener('keyup', e => this._onKeyUp(e));
  }

  _canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  _toWorld(cx, cy, camera) {
    return {
      x: cx + camera.x,
      y: cy + camera.y
    };
  }

  updateWorldCoords(camera) {
    const w = this._toWorld(this.mouseX, this.mouseY, camera);
    this.worldX = w.x;
    this.worldY = w.y;
  }

  _onMouseDown(e) {
    const { x, y } = this._canvasCoords(e);
    this.mouseX = x;
    this.mouseY = y;
    this.buttons[e.button] = true;

    if (e.button === 0) {
      this.dragStart = { x, y };
      this.isDragging = false;
      this.pendingActions.push({ type: 'mousedown_left', cx: x, cy: y });
    } else if (e.button === 2) {
      this.pendingActions.push({ type: 'mousedown_right', cx: x, cy: y });
    }
  }

  _onMouseMove(e) {
    const { x, y } = this._canvasCoords(e);
    this.mouseX = x;
    this.mouseY = y;

    if (this.dragStart && this.buttons[0]) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > this.DRAG_THRESHOLD) {
        this.isDragging = true;
      }
      if (this.isDragging) {
        this.dragCurrent = { x, y };
      }
    }
  }

  _onMouseUp(e) {
    const { x, y } = this._canvasCoords(e);

    if (e.button === 0) {
      if (this.isDragging && this.dragStart) {
        this.pendingActions.push({
          type: 'box_select',
          x1: Math.min(this.dragStart.x, x),
          y1: Math.min(this.dragStart.y, y),
          x2: Math.max(this.dragStart.x, x),
          y2: Math.max(this.dragStart.y, y)
        });
      } else {
        this.pendingActions.push({ type: 'click_left', cx: x, cy: y });
      }
      this.dragStart = null;
      this.isDragging = false;
      this.dragCurrent = null;
    }
    this.buttons[e.button] = false;
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    this.keys[e.key] = true;
    if (e.code === 'Escape') {
      this.pendingActions.push({ type: 'escape' });
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    this.keys[e.key] = false;
  }

  getActions() {
    const actions = this.pendingActions;
    this.pendingActions = [];
    return actions;
  }

  getDragRect() {
    if (!this.isDragging || !this.dragStart || !this.dragCurrent) return null;
    return {
      x: Math.min(this.dragStart.x, this.dragCurrent.x),
      y: Math.min(this.dragStart.y, this.dragCurrent.y),
      w: Math.abs(this.dragCurrent.x - this.dragStart.x),
      h: Math.abs(this.dragCurrent.y - this.dragStart.y)
    };
  }

  isKeyDown(code) {
    return !!this.keys[code];
  }
}
