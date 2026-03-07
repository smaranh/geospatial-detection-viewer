# 🌍 Zoom-Aware Geospatial Detection Viewer

### [🔗 Live Demo](https://smaranh.github.io/geospatial-detection-viewer)

---

## Quick Start

```bash
npm install
npm start
```

---

## Overview

A high-performance viewer that overlays **10,000 detection bounding boxes** on geospatial layers with zoom-aware label visibility, viewport culling, and interactive tooltips — built with **React 19**, **deck.gl 9**, and **Vite**.

## Key Architectural Decisions

- **deck.gl over ArcGIS** — GPU-instanced rendering via `PolygonLayer`, handles 100K+ features in a single draw call
- **Dual-Mode Base Layer** — `OrthographicView` (procedural pixel-space) + `MapView` (CartoDB/OSM tiles) — no API keys required
- **Viewport Culling** — Precomputed `AABB` per detection, filtered by viewport bounds each frame
- **Quadtree Spatial Index** — `O(log n + k)` query replaces linear `O(n)` scan; build ~5ms, query <1ms
- **Web Worker** — Quadtree build + query offloaded via `INIT`/`QUERY`/`RESULT` message protocol; returns IDs (not objects) to minimize `postMessage` cost
- **Priority × Zoom Filtering** — Labels progressively revealed by `priority` level at configurable zoom thresholds

> 📄 *See the companion **[Technical Deep Dive](https://github.com/smaranh/geospatial-detection-viewer/blob/main/TECHNICAL_DESIGN.md)** document for full architecture details, data flow diagrams, and scalability analysis.*
