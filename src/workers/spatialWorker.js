/**
 * spatialWorker.js
 * Web Worker for offloading Quadtree spatial queries from the main thread.
 *
 * Message protocol:
 *   INIT   (Main → Worker)  { detections, worldBounds }  → builds quadtree, replies READY
 *   QUERY  (Main → Worker)  { bounds, queryId }          → queries tree, replies RESULT with IDs
 *   READY  (Worker → Main)  { }                          → signals quadtree is built
 *   RESULT (Worker → Main)  { ids, queryId }             → matching detection IDs
 *
 * Design:
 *   - Returns only detection IDs (not full objects) to minimize structured-clone cost
 *   - queryId enables stale response detection on the main thread
 *   - Quadtree.js is pure JS with no DOM/React deps — imports cleanly here
 */

import Quadtree from '../utils/Quadtree.js';

let quadtree = null;

self.onmessage = function (e) {
    const { type } = e.data;

    switch (type) {
        case 'INIT': {
            const { detections, worldBounds } = e.data;
            console.time('worker:quadtree:build');
            quadtree = Quadtree.fromDetections(detections, worldBounds);
            console.timeEnd('worker:quadtree:build');
            self.postMessage({ type: 'READY' });
            break;
        }

        case 'QUERY': {
            if (!quadtree) return;
            const { bounds, queryId } = e.data;
            const results = quadtree.query(bounds);
            const ids = results.map(d => d.id);
            self.postMessage({ type: 'RESULT', ids, queryId });
            break;
        }
    }
};
