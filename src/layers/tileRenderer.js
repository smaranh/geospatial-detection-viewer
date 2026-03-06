/**
 * tileRenderer.js
 * Generates procedural map tiles as offscreen canvases.
 * 
 * Each tile is a 256×256 canvas with:
 * - Terrain-like gradient background (Perlin-ish noise via simple hash)
 * - Grid lines (minor every 32px, major at tile boundaries)
 * - Coordinate labels at tile centers
 * 
 * Tiles are cached in a Map for reuse across renders.
 */

import { TILE_SIZE, TILE_COLORS } from '../constants.js';

// Tile image cache: "col-row" → HTMLCanvasElement
const tileCache = new Map();

/**
 * Simple deterministic hash for procedural variation.
 * Maps (col, row) → a value in [0, 1].
 */
function tileHash(col, row) {
    let h = (col * 374761393 + row * 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 15), 0x1b873593);
    h = h ^ (h >>> 13);
    return (h >>> 0) / 4294967296;
}

/**
 * Renders a single tile onto an offscreen canvas.
 */
function renderTile(col, row) {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d');

    // --- Background with terrain-like variation ---
    const hash = tileHash(col, row);
    const colorIdx = Math.floor(hash * TILE_COLORS.terrain.length);
    const baseColor = TILE_COLORS.terrain[colorIdx];

    // Slight gradient across the tile for depth
    const variation = (hash - 0.5) * 8;
    ctx.fillStyle = `rgb(${baseColor[0] + variation}, ${baseColor[1] + variation}, ${baseColor[2] + variation})`;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Add subtle noise pattern
    for (let i = 0; i < 20; i++) {
        const nx = tileHash(col * 100 + i, row * 100) * TILE_SIZE;
        const ny = tileHash(col * 100, row * 100 + i) * TILE_SIZE;
        const nr = tileHash(col + i, row + i) * 40 + 10;
        const alpha = tileHash(i, col + row) * 0.03;
        ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Grid lines ---
    ctx.strokeStyle = TILE_COLORS.gridLine;
    ctx.lineWidth = 0.5;

    // Minor grid lines every 32px
    for (let x = 0; x < TILE_SIZE; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, TILE_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y < TILE_SIZE; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(TILE_SIZE, y);
        ctx.stroke();
    }

    // Major grid lines at tile boundaries
    ctx.strokeStyle = TILE_COLORS.gridLineMajor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    // --- Coordinate label at center ---
    ctx.fillStyle = TILE_COLORS.coordText;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${col},${row}`, TILE_SIZE / 2, TILE_SIZE / 2);

    return canvas;
}

/**
 * Gets a tile canvas, using cache if available.
 * @param {number} col - Column index
 * @param {number} row - Row index
 * @returns {HTMLCanvasElement}
 */
export function getTileCanvas(col, row) {
    const key = `${col}-${row}`;
    if (!tileCache.has(key)) {
        tileCache.set(key, renderTile(col, row));
    }
    return tileCache.get(key);
}

/**
 * Generates all tile data for the BitmapLayer.
 * Returns an array of objects with { col, row, bounds, image }.
 * 
 * @param {number} totalCols
 * @param {number} totalRows
 * @returns {Array<{col: number, row: number, bounds: number[][]}>}
 */
export function generateTileData(totalCols, totalRows) {
    const tiles = [];
    for (let row = 0; row < totalRows; row++) {
        for (let col = 0; col < totalCols; col++) {
            tiles.push({
                col,
                row,
                bounds: [
                    [col * TILE_SIZE, row * TILE_SIZE],                           // top-left  [x, y]
                    [col * TILE_SIZE + TILE_SIZE, row * TILE_SIZE],               // top-right
                    [col * TILE_SIZE + TILE_SIZE, row * TILE_SIZE + TILE_SIZE],   // bottom-right
                    [col * TILE_SIZE, row * TILE_SIZE + TILE_SIZE],               // bottom-left
                ],
            });
        }
    }
    return tiles;
}

/**
 * Clears the tile cache. Call when theme or tile config changes.
 */
export function clearTileCache() {
    tileCache.clear();
}
