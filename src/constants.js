/**
 * constants.js
 * Central configuration for the geospatial detection viewer.
 * All magic numbers live here — no hardcoded values in components.
 */

// --- World Space ---
export const WORLD_WIDTH = 8192;
export const WORLD_HEIGHT = 8192;

// --- Tile Grid ---
export const TILE_SIZE = 256;
export const GRID_COLS = Math.ceil(WORLD_WIDTH / TILE_SIZE);   // 32
export const GRID_ROWS = Math.ceil(WORLD_HEIGHT / TILE_SIZE);  // 32

// --- Zoom Limits ---
// 10% = very zoomed out (see everything), 800% = extreme close-up
export const MIN_ZOOM = -3.32;  // log2(0.1) ≈ -3.32 → 10%
export const MAX_ZOOM = 3.0;    // log2(8)   = 3.0   → 800%
export const DEFAULT_ZOOM = -0.5; // ~71% — good starting overview

// Helper: deck.gl uses log2 zoom, we display as percentage
export const zoomToPercent = (zoom) => Math.round(Math.pow(2, zoom) * 100);
export const percentToZoom = (pct) => Math.log2(pct / 100);

// --- Map Mode (Geographic) ---
// Default center: San Francisco (visually interesting urban area)
export const MAP_DEFAULT_CENTER = { longitude: -122.4194, latitude: 37.7749 };
export const MAP_DEFAULT_ZOOM = 15;    // City-level overview
export const MAP_MIN_ZOOM = 2;         // Continental view
export const MAP_MAX_ZOOM = 18;        // Street level

// --- Detection Rendering ---
export const DETECTION_STROKE_BASE = 2;     // world-space stroke width
export const DETECTION_STROKE_MIN_PX = 0.5; // screen-space minimum
export const DETECTION_STROKE_MAX_PX = 4;   // screen-space maximum

export const LABEL_FONT_BASE = 12;
export const LABEL_FONT_MIN_PX = 8;
export const LABEL_FONT_MAX_PX = 24;

// --- Label Visibility Thresholds (effective zoom → minimum to show labels) ---
// In map mode, effective zoom = mapZoom - 12 (so Z12 → 0, Z15 → 3)
// In procedural mode, these are direct log2 zoom values
export const LABEL_ZOOM_THRESHOLDS = {
  1: 1.0,    // Priority 1 (critical): visible at Z13+ in map / ≥200% procedural
  2: 2.0,    // Priority 2 (high): visible at Z14+ / ≥400%
  3: 3.0,    // Priority 3 (medium): visible at Z15+ / ≥800%
  4: 4.0,    // Priority 4 (low): visible at Z16+
  5: 5.0,    // Priority 5 (minimal): visible at Z17+
};

// --- Detection Categories ---
export const CATEGORIES = {
  vehicle: { color: [59, 130, 246], label: 'Vehicle' },       // blue
  building: { color: [16, 185, 129], label: 'Building' },     // emerald
  person: { color: [245, 158, 11], label: 'Person' },         // amber
  aircraft: { color: [244, 63, 94], label: 'Aircraft' },      // rose
  vessel: { color: [139, 92, 246], label: 'Vessel' },         // violet
  equipment: { color: [6, 182, 212], label: 'Equipment' },    // cyan
};

// --- Tile Colors (procedural terrain simulation) ---
export const TILE_COLORS = {
  background: '#0d1117',
  gridLine: 'rgba(148, 163, 184, 0.06)',
  gridLineMajor: 'rgba(148, 163, 184, 0.12)',
  coordText: 'rgba(148, 163, 184, 0.25)',
  terrain: [
    [13, 17, 23],    // dark base
    [16, 22, 32],    // slight blue
    [19, 26, 36],    // medium
    [22, 30, 40],    // lighter
  ],
};

// --- Performance ---
export const QUADTREE_MAX_OBJECTS = 10;
export const QUADTREE_MAX_LEVELS = 8;
