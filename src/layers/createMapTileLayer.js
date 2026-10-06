/**
 * createMapTileLayer.js
 * Creates a deck.gl TileLayer that loads raster map tiles from a free tile server.
 * 
 * Uses CartoDB's dark basemap:
 * - Lightweight: tiles are ~10–30KB each (PNG)
 * - Dark theme: matches our UI aesthetic
 * - Free tier, but CARTO requires an API key (https://carto.com/basemaps/apikey)
 *   for non-localhost origins. Set VITE_CARTO_API_KEY at build time.
 * 
 * The TileLayer handles:
 * - Tile URL construction from {z}/{x}/{y} template
 * - Viewport-based tile loading (only visible tiles)
 * - Tile caching and lifecycle management
 * - Level-of-detail switching at different zoom levels
 */

import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

// CARTO basemap key, appended as ?key=... (public by design: it ships in the bundle)
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY;
const CARTO_KEY_PARAM = CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : '';

const TILE_SERVERS = {
    cartoDark: `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png${CARTO_KEY_PARAM}`,
    cartoLight: `https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${CARTO_KEY_PARAM}`,
    cartoVoyager: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${CARTO_KEY_PARAM}`,
    osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

/**
 * Creates a TileLayer configured for the specified tile server.
 * 
 * @param {Object} options
 * @param {'cartoDark'|'cartoLight'|'cartoVoyager'|'osm'} [options.server='cartoDark']
 * @param {number} [options.minZoom=0] - Minimum tile zoom level to load
 * @param {number} [options.maxZoom=19] - Maximum tile zoom level to load
 * @param {number} [options.opacity=1] - Layer opacity
 * @returns {TileLayer}
 */
export function createMapTileLayer({
    server = 'cartoDark',
    minZoom = 0,
    maxZoom = 19,
    opacity = 1,
} = {}) {
    const tileUrl = TILE_SERVERS[server] || TILE_SERVERS.cartoDark;

    return new TileLayer({
        id: 'map-tile-layer',
        data: tileUrl,

        // Tile loading bounds
        minZoom,
        maxZoom,

        // Tile size in pixels (256 is standard, 512 for retina @2x)
        tileSize: 256,

        // Render each tile as a BitmapLayer
        renderSubLayers: (props) => {
            const { boundingBox } = props.tile;

            return new BitmapLayer(props, {
                data: null,
                image: props.data,
                bounds: [
                    boundingBox[0][0], // west  (longitude min)
                    boundingBox[0][1], // south (latitude min)
                    boundingBox[1][0], // east  (longitude max)
                    boundingBox[1][1], // north (latitude max)
                ],
            });
        },

        opacity,

        // Performance: limit concurrent tile requests
        maxRequests: 6,

        // Handle tile load errors gracefully
        onTileError: (error) => {
            // Silently ignore 404s for tiles at edge of coverage
            if (error.status !== 404) {
                console.warn('Tile load error:', error);
            }
        },
    });
}

/**
 * Available tile server names for UI display.
 */
export const TILE_SERVER_OPTIONS = [
    { id: 'cartoDark', label: 'Dark', description: 'CartoDB Dark Matter' },
    { id: 'cartoVoyager', label: 'Voyager', description: 'CartoDB Voyager' },
    { id: 'cartoLight', label: 'Light', description: 'CartoDB Positron' },
    { id: 'osm', label: 'OSM', description: 'OpenStreetMap Standard' },
];
