/**
 * viewport.js
 * Utilities for computing viewport bounds and performing viewport-based culling.
 *
 * Supports both modes:
 * - "map": Uses deck.gl's WebMercatorViewport.getBounds() for lng/lat bounds
 * - "procedural": Manual orthographic math for pixel-space bounds
 *
 * All bounds use the format [minX, minY, maxX, maxY] to match
 * the precomputed detection.bounds format.
 */

import { WebMercatorViewport } from '@deck.gl/core';

/**
 * Compute the world-coordinate bounding box of the current viewport.
 *
 * @param {Object} viewState - deck.gl view state
 * @param {'map'|'procedural'} mode - Current mode
 * @param {number} width - Container width in CSS pixels
 * @param {number} height - Container height in CSS pixels
 * @returns {number[]} [minX, minY, maxX, maxY]
 */
export function getViewportBounds(viewState, mode, width, height) {
    if (!width || !height) return null;

    if (mode === 'map') {
        const vp = new WebMercatorViewport({
            width,
            height,
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            zoom: viewState.zoom,
            pitch: viewState.pitch || 0,
            bearing: viewState.bearing || 0,
        });
        // getBounds() returns [minLng, minLat, maxLng, maxLat]
        return vp.getBounds();
    }

    // Procedural mode: OrthographicView math
    // zoom is log2 scale, so scale = 2^zoom
    // At zoom 0, 1 world unit = 1 screen pixel
    const scale = Math.pow(2, viewState.zoom);
    const halfW = (width / 2) / scale;
    const halfH = (height / 2) / scale;
    const [cx, cy] = viewState.target;

    return [
        cx - halfW,  // minX
        cy - halfH,  // minY
        cx + halfW,  // maxX
        cy + halfH,  // maxY
    ];
}

/**
 * Test whether a detection's AABB overlaps the viewport AABB.
 * Both use the format [minX, minY, maxX, maxY].
 *
 * @param {number[]} detBounds - Detection bounds [minX, minY, maxX, maxY]
 * @param {number[]} vpBounds - Viewport bounds [minX, minY, maxX, maxY]
 * @returns {boolean}
 */
export function isInViewport(detBounds, vpBounds) {
    return (
        detBounds[2] >= vpBounds[0] &&   // det.maxX >= vp.minX
        detBounds[0] <= vpBounds[2] &&   // det.minX <= vp.maxX
        detBounds[3] >= vpBounds[1] &&   // det.maxY >= vp.minY
        detBounds[1] <= vpBounds[3]      // det.minY <= vp.maxY
    );
}

/**
 * Filter detections to only those visible in the current viewport.
 * Adds padding around the viewport to prevent pop-in at edges.
 *
 * @param {Object[]} detections - All detections (must have .bounds)
 * @param {number[]} vpBounds - Viewport bounds [minX, minY, maxX, maxY]
 * @param {number} [paddingFactor=0.1] - Padding as fraction of viewport size
 * @returns {Object[]} Visible detections
 */
export function filterDetectionsByViewport(detections, vpBounds, paddingFactor = 0.1) {
    if (!vpBounds || !detections?.length) return detections;

    // Add padding so detections don't pop in/out at edges during panning
    const padX = (vpBounds[2] - vpBounds[0]) * paddingFactor;
    const padY = (vpBounds[3] - vpBounds[1]) * paddingFactor;

    const paddedBounds = [
        vpBounds[0] - padX,
        vpBounds[1] - padY,
        vpBounds[2] + padX,
        vpBounds[3] + padY,
    ];

    return detections.filter(d => isInViewport(d.bounds, paddedBounds));
}

/**
 * Add padding to viewport bounds.
 * Extracted for reuse with Quadtree queries.
 *
 * @param {number[]} vpBounds - Viewport bounds [minX, minY, maxX, maxY]
 * @param {number} [paddingFactor=0.1] - Padding as fraction of viewport size
 * @returns {number[]} Padded bounds [minX, minY, maxX, maxY]
 */
export function addViewportPadding(vpBounds, paddingFactor = 0.1) {
    const padX = (vpBounds[2] - vpBounds[0]) * paddingFactor;
    const padY = (vpBounds[3] - vpBounds[1]) * paddingFactor;
    return [
        vpBounds[0] - padX,
        vpBounds[1] - padY,
        vpBounds[2] + padX,
        vpBounds[3] + padY,
    ];
}
