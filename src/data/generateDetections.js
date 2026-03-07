/**
 * generateDetections.js
 * Generates synthetic detection bounding box data that mimics real CV model output.
 * 
 * Produces 10,000 detections (within the 5K–10K requirement) with:
 * - Realistic category distribution (vehicles most common, aircraft rare)
 * - Spatial clustering (dense clusters in some areas, sparse in others)
 * - Confidence scores following a realistic distribution (most 0.6–0.95)
 * - Priority levels (1–5) correlated somewhat with confidence
 * 
 * Supports two coordinate modes:
 * - "map": geographic coords around San Francisco
 * - "procedural": pixel coords within 8192×8192 world
 */

import { CATEGORIES, WORLD_WIDTH, WORLD_HEIGHT, MAP_DEFAULT_CENTER } from '../constants.js';

const DEFAULT_DETECTION_COUNT = 10000;

// --- Seeded PRNG for reproducible results ---
function createRNG(seed = 42) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 4294967296;
    };
}

// --- Category distribution ---
const CATEGORY_WEIGHTS = [
    { key: 'vehicle', weight: 0.30 },
    { key: 'building', weight: 0.25 },
    { key: 'person', weight: 0.20 },
    { key: 'aircraft', weight: 0.10 },
    { key: 'vessel', weight: 0.10 },
    { key: 'equipment', weight: 0.05 },
];

function pickCategory(rand) {
    let r = rand();
    for (const { key, weight } of CATEGORY_WEIGHTS) {
        r -= weight;
        if (r <= 0) return key;
    }
    return 'vehicle';
}

// --- Size ranges by category (in map degrees or world pixels) ---
const CATEGORY_SIZES = {
    vehicle: { minW: 0.00008, maxW: 0.00025, minH: 0.00005, maxH: 0.00015 },
    building: { minW: 0.00015, maxW: 0.00060, minH: 0.00012, maxH: 0.00050 },
    person: { minW: 0.00003, maxW: 0.00008, minH: 0.00004, maxH: 0.00010 },
    aircraft: { minW: 0.00020, maxW: 0.00080, minH: 0.00015, maxH: 0.00040 },
    vessel: { minW: 0.00015, maxW: 0.00050, minH: 0.00008, maxH: 0.00020 },
    equipment: { minW: 0.00005, maxW: 0.00015, minH: 0.00004, maxH: 0.00012 },
};

// Procedural mode sizes (in world pixels)
const CATEGORY_SIZES_PX = {
    vehicle: { minW: 20, maxW: 60, minH: 15, maxH: 40 },
    building: { minW: 40, maxW: 150, minH: 35, maxH: 120 },
    person: { minW: 8, maxW: 20, minH: 12, maxH: 28 },
    aircraft: { minW: 50, maxW: 180, minH: 40, maxH: 90 },
    vessel: { minW: 35, maxW: 120, minH: 20, maxH: 50 },
    equipment: { minW: 12, maxW: 35, minH: 10, maxH: 30 },
};

// --- Spatial clusters for map mode (around San Francisco) ---
const MAP_CLUSTERS = [
    // Downtown SF
    { lng: -122.4050, lat: 37.7900, radius: 0.020, weight: 0.20 },
    // SOMA / Mission Bay
    { lng: -122.3920, lat: 37.7720, radius: 0.018, weight: 0.18 },
    // Mission District
    { lng: -122.4200, lat: 37.7580, radius: 0.015, weight: 0.15 },
    // Marina / Presidio
    { lng: -122.4450, lat: 37.8000, radius: 0.020, weight: 0.12 },
    // Bayview / Hunters Point
    { lng: -122.3750, lat: 37.7350, radius: 0.018, weight: 0.10 },
    // Richmond / Sunset
    { lng: -122.4700, lat: 37.7750, radius: 0.022, weight: 0.10 },
    // Scattered across wider area
    { lng: MAP_DEFAULT_CENTER.longitude, lat: MAP_DEFAULT_CENTER.latitude, radius: 0.050, weight: 0.15 },
];

// --- Spatial clusters for procedural mode ---
const PROC_CLUSTERS = [
    { x: 4096, y: 4096, radius: 2000, weight: 0.20 },
    { x: 2000, y: 2000, radius: 1500, weight: 0.18 },
    { x: 6000, y: 3000, radius: 1400, weight: 0.15 },
    { x: 3000, y: 6000, radius: 1400, weight: 0.15 },
    { x: 7000, y: 7000, radius: 1200, weight: 0.12 },
    { x: 1500, y: 6500, radius: 1000, weight: 0.10 },
    { x: 4096, y: 4096, radius: 3800, weight: 0.10 },
];

/**
 * Pick a cluster based on weights, then sample a position within it.
 * Uses uniform disk distribution (sqrt(rand) * radius) instead of Gaussian
 * to prevent extreme concentration at cluster centers.
 */
function sampleClusterPosition(clusters, rand) {
    let r = rand();
    let cluster = clusters[clusters.length - 1];
    for (const c of clusters) {
        r -= c.weight;
        if (r <= 0) { cluster = c; break; }
    }

    // Uniform distribution within a disk
    const angle = 2 * Math.PI * rand();
    const dist = cluster.radius * Math.sqrt(rand());

    return {
        x: (cluster.lng ?? cluster.x) + dist * Math.cos(angle),
        y: (cluster.lat ?? cluster.y) + dist * Math.sin(angle),
    };
}

/**
 * Assign priority based on confidence + some randomness.
 * Higher confidence → higher priority (1 = critical).
 */
function assignPriority(confidence, rand) {
    const r = rand();
    if (confidence > 0.90 && r < 0.3) return 1;
    if (confidence > 0.80 && r < 0.4) return 2;
    if (confidence > 0.60) return 3;
    if (confidence > 0.40) return 4;
    return 5;
}

/**
 * Generate a confidence score with realistic distribution.
 * Most detections fall between 0.5–0.95 with a peak around 0.75.
 */
function generateConfidence(rand) {
    // Beta-like distribution skewed toward higher values
    const a = rand();
    const b = rand();
    const raw = 0.3 + 0.7 * (a * 0.6 + b * 0.4);
    return Math.min(0.99, Math.max(0.30, raw));
}

/**
 * Generate all detections for a given mode.
 * 
 * @param {'map'|'procedural'} mode
 * @param {number} [count=7500]
 * @returns {Object[]} Array of detection objects
 */
export function generateDetections(mode = 'map', count = DEFAULT_DETECTION_COUNT) {
    const rand = createRNG(12345);
    const clusters = mode === 'map' ? MAP_CLUSTERS : PROC_CLUSTERS;
    const sizes = mode === 'map' ? CATEGORY_SIZES : CATEGORY_SIZES_PX;
    const detections = [];

    for (let i = 0; i < count; i++) {
        const category = pickCategory(rand);
        const confidence = generateConfidence(rand);
        const priority = assignPriority(confidence, rand);
        const pos = sampleClusterPosition(clusters, rand);
        const sizeRange = sizes[category];

        // Random size within category range
        const w = sizeRange.minW + rand() * (sizeRange.maxW - sizeRange.minW);
        const h = sizeRange.minH + rand() * (sizeRange.maxH - sizeRange.minH);

        // Build polygon (4 corners of the bounding box)
        let polygon;
        let labelPosition;

        // Precomputed AABB for viewport culling: [minX, minY, maxX, maxY]
        let bounds;

        if (mode === 'map') {
            // [lng, lat] coordinates
            const lng = pos.x;
            const lat = pos.y;
            polygon = [
                [lng, lat],
                [lng + w, lat],
                [lng + w, lat + h],
                [lng, lat + h],
                [lng, lat], // close the polygon
            ];
            labelPosition = [lng, lat + h]; // top-left of box
            bounds = [lng, lat, lng + w, lat + h];
        } else {
            // [x, y] pixel coordinates — clamp to world bounds
            const x = Math.max(0, Math.min(WORLD_WIDTH - w, pos.x));
            const y = Math.max(0, Math.min(WORLD_HEIGHT - h, pos.y));
            polygon = [
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h],
                [x, y], // close the polygon
            ];
            labelPosition = [x, y]; // top-left of box
            bounds = [x, y, x + w, y + h];
        }

        const categoryInfo = CATEGORIES[category];

        detections.push({
            id: i,
            polygon,
            labelPosition,
            bounds,
            category,
            label: categoryInfo.label,
            confidence,
            priority,
            color: categoryInfo.color,
            // Pre-computed display text for TextLayer
            displayText: `${categoryInfo.label} ${Math.round(confidence * 100)}%`,
        });
    }

    return detections;
}

/**
 * Get detection stats for display.
 */
export function getDetectionStats(detections) {
    const byCategory = {};
    const byPriority = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const d of detections) {
        byCategory[d.category] = (byCategory[d.category] || 0) + 1;
        byPriority[d.priority]++;
    }

    return {
        total: detections.length,
        byCategory,
        byPriority,
        avgConfidence: detections.reduce((s, d) => s + d.confidence, 0) / detections.length,
    };
}
