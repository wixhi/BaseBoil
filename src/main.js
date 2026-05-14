import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { Game } from './game.js';

// Setup canvas
const canvas = document.getElementById('gameCanvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Create game
const game = new Game(canvas);

// Don't auto-init; show start screen first
// The start screen is drawn even when gameState = 'start'
// We still need to draw the start screen
game.gameState = 'start';

// RAF loop
let lastTime = null;
const MAX_DT = 0.05; // Cap at 50ms

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const rawDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  const dt = Math.min(rawDt, MAX_DT);

  // Handle start screen click to begin
  if (game.gameState === 'start') {
    // Process any pending actions for start click
    const actions = game.input.getActions();
    for (const action of actions) {
      if (action.type === 'click_left' || action.type === 'mousedown_right') {
        game.init();
        break;
      }
      if (action.type === 'escape') {
        // ignore
      }
    }
  } else {
    game.update(dt);
  }

  game.render();

  requestAnimationFrame(loop);
}

// Initial render to show start screen
game.render();

requestAnimationFrame(loop);

// Handle window resize (maintain aspect ratio by CSS, canvas stays fixed)
window.addEventListener('resize', () => {
  // Canvas stays at 1200x720, CSS handles scaling
});
