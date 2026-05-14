// Canvas dimensions
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 720;
export const VIEWPORT_HEIGHT = 600;
export const HUD_HEIGHT = 120;

// Tile system
export const TILE = 32;
export const MAP_COLS = 64;
export const MAP_ROWS = 48;

// Tile types
export const TILE_TYPE = {
  GRASS: 0,
  DIRT: 1,
  OBSTACLE: 2,
  RESOURCE: 3
};

// Teams
export const TEAM = {
  PLAYER: 0,
  ENEMY: 1
};

// Entity states
export const STATE = {
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  ATTACKING: 'ATTACKING',
  HARVESTING: 'HARVESTING',
  RETURNING: 'RETURNING',
  BUILDING: 'BUILDING',
  DEAD: 'DEAD'
};

// Unit type keys
export const UNIT = {
  GROUNDSKEEPER: 'GROUNDSKEEPER',
  BATTER: 'BATTER',
  PITCHER: 'PITCHER',
  CATCHER: 'CATCHER',
  SLUGGER: 'SLUGGER'
};

// Building type keys
export const BLDG = {
  DUGOUT: 'DUGOUT',
  BATTING_CAGE: 'BATTING_CAGE',
  BULLPEN: 'BULLPEN',
  BLEACHERS: 'BLEACHERS'
};

// Colors
export const COLORS = {
  // UI
  HUD_BG: '#111827',
  HUD_BORDER: '#1f2937',
  BUTTON_BG: '#1f2937',
  BUTTON_HOVER: '#374151',
  BUTTON_DISABLED: '#111827',
  BUTTON_BORDER: '#374151',

  // Tiles
  GRASS: '#2d5a27',
  GRASS_GRID: '#1e3d1a',
  DIRT: '#8B6914',
  OBSTACLE: '#3c3c3c',
  OBSTACLE_BORDER: '#222222',
  RESOURCE_BASE: '#2d5a27',
  RESOURCE_DOT: '#ffd700',

  // Player
  PLAYER_BODY: '#1565c0',
  PLAYER_STROKE: '#4fc3f7',
  PLAYER_GK: '#90caf9',

  // Enemy
  ENEMY_BODY: '#b71c1c',
  ENEMY_STROKE: '#ef5350',
  ENEMY_GK: '#ef9a9a',

  // Player buildings
  PLAYER_BLDG_FILL: '#0d47a1',
  PLAYER_BLDG_STROKE: '#4fc3f7',

  // Enemy buildings
  ENEMY_BLDG_FILL: '#7f0000',
  ENEMY_BLDG_STROKE: '#ef5350',

  // Accents
  ORANGE: '#ff9800',
  FIRE: '#ff6b35',
  CYAN: '#4fc3f7',
  GOLD: '#ffd700',
  WHITE: '#ffffff',
  RED: '#ef5350',
  GREEN: '#4caf50',
  YELLOW: '#ffeb3b',

  // Projectile
  BASEBALL_FILL: '#ffffff',
  BASEBALL_GLOW: '#ff9800',
  TRAIL: '#ff6b35',

  // Selection
  SELECTION_FILL: 'rgba(79, 195, 247, 0.15)',
  SELECTION_STROKE: '#4fc3f7',

  // HP bars
  HP_HIGH: '#4caf50',
  HP_MID: '#ffeb3b',
  HP_LOW: '#ef5350',
  HP_BG: '#1a1a1a',

  // Overlay
  OVERLAY_BG: 'rgba(10, 10, 15, 0.88)',
  VICTORY: '#ffd700',
  DEFEAT: '#ef5350',

  // Game start title
  TITLE_ORANGE: '#ff9800',
  TITLE_FIRE: '#ff6b35'
};

// Camera speed
export const CAM_SPEED = 400;

// Population cap
export const POP_CAP = 20;

// Starting resources
export const START_BASEBALLS = 200;

// Inning duration (seconds)
export const INNING_DURATION = 60;
export const MAX_INNINGS = 9;
