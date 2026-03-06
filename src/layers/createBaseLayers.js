/**
 * createBaseLayers.js
 * Creates the deck.gl layers for the base tile map.
 * 
 * Uses BitmapLayer to render each procedural tile at its world-space bounds.
 * Only tiles visible in the viewport are rendered (deck.gl handles culling).
 */

import { BitmapLayer } from '@deck.gl/layers';
import { GRID_COLS, GRID_ROWS } from '../constants.js';
import { generateTileData, getTileCanvas } from './tileRenderer.js';

// Pre-generate tile metadata (bounds only, not the images)
const tileData = generateTileData(GRID_COLS, GRID_ROWS);

/**
 * Creates a BitmapLayer for each tile in the grid.
 * deck.gl will automatically cull tiles outside the viewport.
 * 
 * @returns {BitmapLayer[]}
 */
export function createBaseLayers() {
    return tileData.map((tile) => {
        return new BitmapLayer({
            id: `tile-${tile.col}-${tile.row}`,
            image: getTileCanvas(tile.col, tile.row),
            bounds: [
                tile.bounds[0][0], // left   (x min)
                tile.bounds[0][1], // top    (y min)
                tile.bounds[2][0], // right  (x max)
                tile.bounds[2][1], // bottom (y max)
            ],
            pickable: false,
            // Texture parameters for sharp pixels at high zoom
            textureParameters: {
                minFilter: 'nearest',
                magFilter: 'nearest',
            },
        });
    });
}
