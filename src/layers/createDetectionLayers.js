/**
 * createDetectionLayers.js
 * Creates deck.gl layers for rendering detection bounding boxes and labels.
 * 
 * Architecture:
 * 1. PolygonLayer — renders all detection boxes (GPU-instanced, single draw call)
 *    - Filled with transparent category color
 *    - Outlined with solid category color
 *    - lineWidthMinPixels/lineWidthMaxPixels for Req 4 (zoom-scaled with clamps)
 *    - Pickable for hover interactivity
 * 
 * 2. TextLayer — renders labels for visible, priority-eligible detections
 *    - sizeMinPixels/sizeMaxPixels for Req 4
 *    - Filtered by zoom + priority for Req 5
 *    - Positioned at top-left of each box
 */

import { PolygonLayer, TextLayer } from '@deck.gl/layers';
import {
    DETECTION_STROKE_MIN_PX,
    DETECTION_STROKE_MAX_PX,
    LABEL_FONT_MIN_PX,
    LABEL_FONT_MAX_PX,
    LABEL_ZOOM_THRESHOLDS,
} from '../constants.js';

// Fill opacity for detection boxes (transparent so base layer shows through)
const FILL_ALPHA = 40;
// Outline opacity
const LINE_ALPHA = 200;
// Label background
const LABEL_BG = [10, 14, 23, 180];

/**
 * Filter detections to only those whose priority allows label display at current zoom.
 * 
 * @param {Object[]} detections - All detections
 * @param {number} currentZoom - Current zoom level (log2 for procedural, map level for map)
 * @param {'map'|'procedural'} mode - Current mode
 * @returns {Object[]} Detections that should show labels
 */
function filterLabelsForZoom(detections, currentZoom, mode) {
    if (mode === 'map') {
        // Map mode: map zoom levels to threshold check
        // Convert map zoom to a comparable scale for label thresholds
        // Map zoom 12 ≈ procedural zoom 0 (100%), so offset by 12
        const effectiveZoom = currentZoom - 12;
        return detections.filter(d => effectiveZoom >= LABEL_ZOOM_THRESHOLDS[d.priority]);
    }
    // Procedural mode: direct comparison
    return detections.filter(d => currentZoom >= LABEL_ZOOM_THRESHOLDS[d.priority]);
}

/**
 * Creates the detection overlay layers.
 * 
 * @param {Object} options
 * @param {Object[]} options.detections - Detection data array
 * @param {number} options.currentZoom - Current zoom level
 * @param {'map'|'procedural'} options.mode - Current mode
 * @param {Function} [options.onHover] - Hover callback for tooltips
 * @returns {Array} Array of deck.gl layers [PolygonLayer, TextLayer]
 */
export function createDetectionLayers({
    detections,
    currentZoom,
    mode,
    onHover,
}) {
    if (!detections || detections.length === 0) return [];

    // --- Layer 1: Detection Boxes (PolygonLayer) ---
    const boxLayer = new PolygonLayer({
        id: 'detection-boxes',
        data: detections,

        // Geometry
        getPolygon: d => d.polygon,

        // Fill: category color with low alpha (transparent overlay)
        filled: true,
        getFillColor: d => [...d.color, FILL_ALPHA],

        // Outline: category color, solid
        stroked: true,
        getLineColor: d => [...d.color, LINE_ALPHA],
        getLineWidth: 2,

        // Req 4: Screen-space clamps for outline width
        lineWidthMinPixels: DETECTION_STROKE_MIN_PX,
        lineWidthMaxPixels: DETECTION_STROKE_MAX_PX,
        lineWidthUnits: 'pixels',

        // Interactivity
        pickable: true,
        onHover,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 50],

        // Performance
        updateTriggers: {
            getPolygon: [mode],
            getFillColor: [mode],
            getLineColor: [mode],
        },
    });

    // --- Layer 2: Detection Labels (TextLayer) ---
    // Req 5: Filter labels based on zoom + priority
    const labelData = filterLabelsForZoom(detections, currentZoom, mode);

    const labelLayer = new TextLayer({
        id: 'detection-labels',
        data: labelData,

        // Text content & position
        getText: d => d.displayText,
        getPosition: d => d.labelPosition,

        // Styling
        getColor: [241, 245, 249, 230],
        getSize: 12,

        // Req 4: Screen-space clamps for font size
        sizeMinPixels: LABEL_FONT_MIN_PX,
        sizeMaxPixels: LABEL_FONT_MAX_PX,
        sizeUnits: 'pixels',

        // Text layout
        getTextAnchor: 'start',
        getAlignmentBaseline: 'bottom',
        getPixelOffset: [4, -4],

        // Background
        background: true,
        getBackgroundColor: LABEL_BG,
        backgroundPadding: [4, 2, 4, 2],

        // Font
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 500,

        // Performance
        billboard: false,

        // Update when zoom changes (different filtered subset)
        updateTriggers: {
            getData: [currentZoom, mode],
        },
    });

    return [boxLayer, labelLayer];
}
