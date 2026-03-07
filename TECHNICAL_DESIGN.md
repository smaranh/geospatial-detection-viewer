# Technical Design — Geospatial Detection Viewer

## 1. Coordinate Systems

The viewer supports **two coordinate modes** to demonstrate flexibility across production use cases (satellite imagery vs. web maps):

| | Procedural Mode | Map Mode |
|---|---|---|
| **View** | `OrthographicView` (pixel-space) | `MapView` (Web Mercator) |
| **World space** | 8192 × 8192 px | lat/lng centered on San Francisco |
| **Detection coords** | `[x, y]` pixels | `[lng, lat]` degrees |
| **Tile source** | Procedural 256×256 canvas tiles | CartoDB / OSM raster CDN (no API keys) |

Both modes share *one detection generation pipeline*. Cluster-based uniform disk sampling (`Math.sqrt(rand()) * radius`) distributes 10,000 detections across 7 weighted spatial clusters, preventing center-concentration artifacts that naive Gaussian sampling produces. The nullish coalescing pattern `cluster.lng ?? cluster.x` lets the same function emit either coordinate system.
→ [`generateDetections.js#sampleClusterPosition()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/data/generateDetections.js#L102-L118)

**Mode-switch trade-off:** Switching between `MapView` and `OrthographicView` corrupts deck.gl's internal WebGL context. We force a clean remount via `key={layerMode}` on `<DeckGL>`, which destroys and recreates the GPU context (~100ms). Acceptable because mode switching is a user-initiated action, not a per-frame operation.
→ [`App.jsx#L258-L259`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/App.jsx#L258-L259)

---

## 2. Zoom Logic

**Procedural mode** uses percentage-based zoom (10%–800%), converted to deck.gl's log2 scale: `MIN_ZOOM = -3.32` (log2(0.1)), `MAX_ZOOM = 3.0` (log2(8)).
→ [`constants.js#L18-L20`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/constants.js#L18-L20)

**Map mode** uses standard web map zoom levels (Z2–Z18). "Percentage zoom" is meaningless for geographic projection — there's no native resolution for Earth — so we use the industry-standard tile zoom convention instead. The underlying zoom mechanics (cursor-centered, clamped, smooth inertia) are identical across both modes.
→ [`useViewState.js#onViewStateChange()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/hooks/useViewState.js#L71-L88)

### Zoom-to-Scale Mapping

deck.gl uses a **log2 zoom** model internally: `scale = 2^zoom`. In procedural mode, zoom 0 means 1 world pixel = 1 screen pixel (100%). The conversion helpers `zoomToPercent()` / `percentToZoom()` translate between the two.
→ [`constants.js#zoomToPercent()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/constants.js#L22-L24)

| deck.gl zoom | Procedural Scale | Map Equivalent | What You See |
|---|---|---|---|
| -3.32 | 10% (min) | — | Entire 8192px world fits on screen |
| -1.0 | 50% | — | Half-resolution overview |
| 0.0 | 100% | Z12 (city) | 1:1 pixel mapping |
| 1.0 | 200% | Z13 | P1 labels appear |
| 2.0 | 400% | Z14 | P2 labels appear |
| 3.0 | 800% (max) | Z15 | P3 labels appear; max procedural zoom |
| — | — | Z17 | Street-level; P5 labels appear |
| — | — | Z18 (max) | Building-level detail |

In **map mode**, zoom levels map to real-world scale via the Web Mercator standard: each zoom increment halves the ground distance per pixel. At Z15 (default), ~1 meter/pixel; at Z18, ~0.15 meters/pixel. The `effectiveZoom = mapZoom - 12` offset in `filterLabelsForZoom()` bridges the two systems so the same `LABEL_ZOOM_THRESHOLDS` config works for both modes.

### Priority × Zoom Label Filtering

Labels are progressively revealed using a 5-tier priority system. Higher-priority detections (P1 = critical) appear at lower zoom levels; low-priority labels (P5) only appear at extreme zoom. This is a **scalability primitive** — at 100K detections, no more than ~1,000 labels render simultaneously, preventing label overdraw.

| Priority | Map Zoom | Procedural |
|---|---|---|
| P1 (Critical) | Z13+ | ≥200% |
| P2 (High) | Z14+ | ≥400% |
| P3 (Medium) | Z15+ | ≥800% |

→ [`createDetectionLayers.js#filterLabelsForZoom()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/layers/createDetectionLayers.js#L34-L52)

**Screen-space clamping trade-off:** `lineWidthMinPixels` / `sizeMinPixels` ensure boxes and labels never vanish at extreme zoom-out, but they lose strict geographic accuracy — a building box may appear larger than it "should" be. This is the right trade-off for a detection viewer where *visibility* matters more than cartographic precision.
→ [`createDetectionLayers.js#L87-L89`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/layers/createDetectionLayers.js#L87-L89)

---

## 3. Performance

Three layers of optimization form a cumulative pipeline:

### Layer 1: Viewport Culling (AABB)

Each detection receives a precomputed bounding box (`bounds: [minX, minY, maxX, maxY]`) at generation time. On every viewport change, an axis-aligned bounding box (AABB) overlap test discards off-screen detections with 10% padding to prevent visual pop-in during panning.
→ [`viewport.js#getViewportBounds()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/utils/viewport.js#L15-L55), [`isInViewport()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/utils/viewport.js#L57-L72)

### Layer 2: Quadtree Spatial Index

**Why Quadtree over Grid or R-Tree:** Detections are spatially clustered — a uniform grid would leave most cells empty with a few cells overloaded. Quadtree naturally adapts to non-uniform distributions. R-Tree offers better worst-case query performance but adds complexity; Quadtree is simpler and sufficient for 10K–100K items.

- **Build:** `Quadtree.fromDetections()` — ~5ms for 10K items, runs once per mode
- **Query:** `O(log n + k)` replaces `O(n)` linear scan — <1ms per frame
- **Deduplication:** Items straddling quadrant boundaries are inserted into multiple children; `Set`-based collection in `_query()` deduplicates results

→ [`Quadtree.js#fromDetections()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/utils/Quadtree.js#L171-L187), [`query()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/utils/Quadtree.js#L125-L136)

**Portability trade-off:** `Quadtree.js` is pure JS with zero React/DOM dependencies. This was deliberate — it imports cleanly into a Web Worker with zero refactoring, at the cost of not leveraging React's lifecycle directly.

### Layer 3: Web Worker Offloading

Quadtree build and query operations are offloaded to a dedicated thread via a 4-message protocol:

```
Main Thread                          Worker Thread
────────────                         ─────────────
postMessage({ INIT, detections }) →  builds Quadtree
                                  ←  postMessage({ READY })
postMessage({ QUERY, bounds })    →  quadtree.query()
                                  ←  postMessage({ RESULT, ids })
```

→ [`spatialWorker.js#onmessage()`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/workers/spatialWorker.js#L21-L43), [`App.jsx#L101-L145`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/App.jsx#L101-L145)

**Key trade-offs:**

| Decision | Trade-off |
|---|---|
| **IDs not objects** via `postMessage` | `postMessage` uses structured clone (deep copy). 10K integer IDs (~40KB) vs. full detection objects (~several MB) — 100× cheaper serialization |
| **Monotonic `queryId`** | 1–2 frame async gap where main thread uses stale visible set. Imperceptible at 60fps. `queryIdRef` discards outdated worker responses during rapid pan/zoom |
| **Graceful fallback** | Until the worker posts its first `RESULT`, all 10K detections render. Prevents blank screen during initialization |
| **GPU instancing** | 10K detections render in a single `PolygonLayer` draw call — the same code path that handles 100K+ features. No per-feature draw calls |

→ [`App.jsx#visibleDetections useMemo`](https://github.com/smaranh/geospatial-detection-viewer/tree/main/src/App.jsx#L206-L209)

---

## 4. Scaling Strategy

The current architecture (viewport culling → Quadtree → Web Worker) is the **foundation** that each scale tier builds upon, not replaces:

| Scale | Strategy | Trade-off |
|---|---|---|
| **10K** (current) | Client-side Quadtree + Worker + GPU instancing | Full dataset in memory; simple, no server dependency |
| **100K** | + Gzip/binary payload, + Web Worker parsing | Higher initial load time; still fully client-side |
| **100K–500K** | + Viewport-based API (`GET /detections?bbox=...`), + PostGIS spatial index, + debounced fetch | Requires server infrastructure; introduces network latency on pan/zoom |
| **500K–5M** | + Server-side clustering at low zoom, + Apache Arrow binary format, + detection vector tiles (MVT) | Significant backend complexity; lossy representation at overview zoom |
| **5M+** | + Distributed spatial DB, + pre-computed tile pyramids, + WebGPU compute shaders | Enterprise-scale infrastructure; diminishing returns on client-side optimization |

Each tier preserves the previous tier's optimizations while adding the next bottleneck's solution. The client-side Quadtree remains useful even at 500K+ for sub-frame viewport queries after data is fetched; the Worker thread remains useful for parsing and indexing server responses without blocking the UI.
