/**
 * Quadtree.js
 * A spatial index for efficient viewport-based detection culling.
 *
 * Recursively subdivides 2D space into four quadrants. Supports:
 * - insert(item): Add an item with a bounds property [minX, minY, maxX, maxY]
 * - query(bounds): Find all items whose AABB overlaps the given bounds
 *
 * Design constraints (Web Worker portability):
 * - No React imports, no DOM access
 * - Pure data in (bounds arrays), pure data out (item arrays)
 * - Same [minX, minY, maxX, maxY] format as detection.bounds and viewport.js
 */

import { QUADTREE_MAX_OBJECTS, QUADTREE_MAX_LEVELS } from '../constants.js';

/**
 * Check if two AABBs overlap (both in [minX, minY, maxX, maxY] format).
 */
function boundsOverlap(a, b) {
    return a[2] >= b[0] && a[0] <= b[2] && a[3] >= b[1] && a[1] <= b[3];
}

export default class Quadtree {
    /**
     * @param {number[]} bounds - [minX, minY, maxX, maxY] for this node's region
     * @param {number} [maxObjects] - Max items per node before splitting
     * @param {number} [maxLevels] - Max depth of the tree
     * @param {number} [level] - Current depth (internal use)
     */
    constructor(bounds, maxObjects = QUADTREE_MAX_OBJECTS, maxLevels = QUADTREE_MAX_LEVELS, level = 0) {
        this.bounds = bounds;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;

        /** @type {Object[]} Items stored in this node */
        this.objects = [];

        /** @type {Quadtree[]|null} Four child nodes (NW, NE, SW, SE), null until split */
        this.children = null;
    }

    /**
     * Split this node into 4 children (quadrants).
     */
    _split() {
        const [minX, minY, maxX, maxY] = this.bounds;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const nextLevel = this.level + 1;

        this.children = [
            new Quadtree([minX, minY, midX, midY], this.maxObjects, this.maxLevels, nextLevel), // SW (bottom-left)
            new Quadtree([midX, minY, maxX, midY], this.maxObjects, this.maxLevels, nextLevel), // SE (bottom-right)
            new Quadtree([minX, midY, midX, maxY], this.maxObjects, this.maxLevels, nextLevel), // NW (top-left)
            new Quadtree([midX, midY, maxX, maxY], this.maxObjects, this.maxLevels, nextLevel), // NE (top-right)
        ];
    }

    /**
     * Determine which child quadrant(s) an item overlaps.
     * Returns indices into this.children.
     * Items straddling a boundary will match multiple quadrants.
     *
     * @param {number[]} itemBounds - [minX, minY, maxX, maxY]
     * @returns {number[]} Array of child indices (0–3)
     */
    _getChildIndices(itemBounds) {
        const [minX, minY, maxX, maxY] = this.bounds;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const indices = [];

        const inLeft = itemBounds[0] < midX;
        const inRight = itemBounds[2] >= midX;
        const inBottom = itemBounds[1] < midY;
        const inTop = itemBounds[3] >= midY;

        if (inLeft && inBottom) indices.push(0);  // SW
        if (inRight && inBottom) indices.push(1);  // SE
        if (inLeft && inTop) indices.push(2);      // NW
        if (inRight && inTop) indices.push(3);     // NE

        return indices;
    }

    /**
     * Insert an item into the quadtree.
     * Item must have a `bounds` property: [minX, minY, maxX, maxY].
     *
     * @param {Object} item - Detection object with .bounds
     */
    insert(item) {
        // If we have children, try to insert into them
        if (this.children) {
            const indices = this._getChildIndices(item.bounds);
            for (const idx of indices) {
                this.children[idx].insert(item);
            }
            return;
        }

        // Store in this node
        this.objects.push(item);

        // Split if we've exceeded capacity and haven't hit max depth
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            this._split();

            // Re-insert all existing objects into children
            const existing = this.objects;
            this.objects = [];

            for (const obj of existing) {
                const indices = this._getChildIndices(obj.bounds);
                for (const idx of indices) {
                    this.children[idx].insert(obj);
                }
            }
        }
    }

    /**
     * Query the quadtree for all items overlapping the given bounds.
     * Uses a Set to deduplicate items that span multiple quadrants.
     *
     * @param {number[]} queryBounds - [minX, minY, maxX, maxY]
     * @returns {Object[]} Array of matching items (deduplicated)
     */
    query(queryBounds) {
        const resultSet = new Set();
        this._query(queryBounds, resultSet);
        return Array.from(resultSet);
    }

    /**
     * Internal recursive query. Collects items into a Set for deduplication.
     *
     * @param {number[]} queryBounds
     * @param {Set} resultSet
     */
    _query(queryBounds, resultSet) {
        // Prune: if query doesn't overlap this node's region, skip entirely
        if (!boundsOverlap(this.bounds, queryBounds)) return;

        // Check items stored directly in this node
        for (const obj of this.objects) {
            if (boundsOverlap(obj.bounds, queryBounds)) {
                resultSet.add(obj);
            }
        }

        // Recurse into children
        if (this.children) {
            for (const child of this.children) {
                child._query(queryBounds, resultSet);
            }
        }
    }

    /**
     * Clear the quadtree (for re-initialization).
     */
    clear() {
        this.objects = [];
        this.children = null;
    }

    /**
     * Static factory: build a quadtree from an array of detections.
     * Convenience wrapper for use in App.jsx and (later) Worker.
     *
     * @param {Object[]} detections - Array of items with .bounds property
     * @param {number[]} worldBounds - [minX, minY, maxX, maxY]
     * @param {number} [maxObjects]
     * @param {number} [maxLevels]
     * @returns {Quadtree}
     */
    static fromDetections(detections, worldBounds, maxObjects, maxLevels) {
        const qt = new Quadtree(worldBounds, maxObjects, maxLevels);
        for (const d of detections) {
            qt.insert(d);
        }
        return qt;
    }
}
