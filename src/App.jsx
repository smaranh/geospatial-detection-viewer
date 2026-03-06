/**
 * App.jsx
 * Main application component for the Geospatial Detection Viewer.
 * 
 * Implements:
 * - Req 1: Cursor-centered pan/zoom (10%–800% clamp in procedural mode)
 * - Req 2: Base layer (procedural tiles OR real map tiles)
 * - Req 3: 10,000 detection bounding box overlay
 * - Req 4: Zoom-scaled boxes/labels with screen-space clamps
 * - Req 5: Priority-based label visibility
 * - Req 6: Perfect alignment via shared viewState
 * - Adv 1: Viewport-based rendering (only visible detections sent to GPU)
 * - Adv 2+3: Web Worker — quadtree build + query offloaded to dedicated thread
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { DeckGL } from '@deck.gl/react';
import { OrthographicView, MapView } from '@deck.gl/core';
import './App.css';

import { useViewState } from './hooks/useViewState.js';
import { createBaseLayers } from './layers/createBaseLayers.js';
import { createMapTileLayer } from './layers/createMapTileLayer.js';
import { createDetectionLayers } from './layers/createDetectionLayers.js';
import { generateDetections, getDetectionStats } from './data/generateDetections.js';
import { getViewportBounds, addViewportPadding } from './utils/viewport.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';
import ZoomIndicator from './components/ZoomIndicator.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import Minimap from './components/Minimap.jsx';
import LayerToggle from './components/LayerToggle.jsx';
import DetectionTooltip from './components/DetectionTooltip.jsx';

// Zoom step for button clicks
const ZOOM_STEP_PROCEDURAL = 0.5;
const ZOOM_STEP_MAP = 1;

export default function App() {
  const [layerMode, setLayerMode] = useState('map');
  const [tileServer, setTileServer] = useState('cartoDark');

  const {
    viewState,
    onViewStateChange,
    zoomBy,
    resetView,
  } = useViewState(layerMode);

  const [cursorWorld, setCursorWorld] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  // --- Adv Req 3: Web Worker state ---
  const workerRef = useRef(null);
  const queryIdRef = useRef(0);         // Monotonic counter for stale response detection
  const [workerReady, setWorkerReady] = useState(false);
  const [visibleIds, setVisibleIds] = useState([]);

  const zoomStep = layerMode === 'map' ? ZOOM_STEP_MAP : ZOOM_STEP_PROCEDURAL;

  // Clear cursor when mode changes
  const handleModeChange = useCallback((newMode) => {
    setCursorWorld(null);
    setHoverInfo(null);
    setLayerMode(newMode);
  }, []);

  // --- Generate detection data (once per mode) ---
  const detections = useMemo(() => {
    console.time('generateDetections');
    const data = generateDetections(layerMode);
    console.timeEnd('generateDetections');
    return data;
  }, [layerMode]);

  const detectionStats = useMemo(() => getDetectionStats(detections), [detections]);

  // --- Adv Req 3: Detection lookup map for O(1) ID → detection ---
  const detectionMap = useMemo(
    () => new Map(detections.map(d => [d.id, d])),
    [detections],
  );

  // --- Compute world bounds for Quadtree (extracted from old quadtree useMemo) ---
  const worldBounds = useMemo(() => {
    if (layerMode === 'map') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const d of detections) {
        if (d.bounds[0] < minX) minX = d.bounds[0];
        if (d.bounds[1] < minY) minY = d.bounds[1];
        if (d.bounds[2] > maxX) maxX = d.bounds[2];
        if (d.bounds[3] > maxY) maxY = d.bounds[3];
      }
      const margin = 0.01;
      return [minX - margin, minY - margin, maxX + margin, maxY + margin];
    }
    return [0, 0, WORLD_WIDTH, WORLD_HEIGHT];
  }, [detections, layerMode]);

  // --- Adv Req 3: Web Worker lifecycle (init / cleanup) ---
  useEffect(() => {
    // Create worker and send detections for quadtree construction
    const worker = new Worker(
      new URL('./workers/spatialWorker.js', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    setWorkerReady(false);
    setVisibleIds([]);
    queryIdRef.current = 0;

    worker.onmessage = (e) => {
      const { type } = e.data;
      if (type === 'READY') {
        setWorkerReady(true);
      } else if (type === 'RESULT') {
        const { ids, queryId } = e.data;
        // Discard stale responses
        if (queryId >= queryIdRef.current) {
          setVisibleIds(ids);
        }
      }
    };

    worker.postMessage({ type: 'INIT', detections, worldBounds });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [detections, worldBounds]);

  // --- Adv Req 3: Send QUERY to worker on viewport change ---
  useEffect(() => {
    if (!workerReady || !workerRef.current) return;
    const vpBounds = getViewportBounds(
      viewState, layerMode,
      containerSize.width, containerSize.height,
    );
    if (!vpBounds) return;
    const paddedBounds = addViewportPadding(vpBounds, 1);
    const qId = ++queryIdRef.current;
    workerRef.current.postMessage({ type: 'QUERY', bounds: paddedBounds, queryId: qId });
  }, [workerReady, viewState, layerMode, containerSize.width, containerSize.height]);

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case '=':
        case '+':
          e.preventDefault();
          zoomBy(zoomStep);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomBy(-zoomStep);
          break;
        case '0':
          e.preventDefault();
          resetView();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomBy, resetView, zoomStep]);

  // Track cursor world coordinates
  const onHover = useCallback((info) => {
    if (info.coordinate) {
      setCursorWorld(info.coordinate);
    }
  }, []);

  // Detection hover handler
  const onDetectionHover = useCallback((info) => {
    if (info.object) {
      setHoverInfo(info);
    } else {
      setHoverInfo(null);
    }
  }, []);

  // --- Adv Req 3: Visible detections from Worker results ---
  // Maps worker-returned IDs through detectionMap for O(1) lookups.
  // Falls back to all detections until the worker delivers its first result.
  const visibleDetections = useMemo(() => {
    if (!workerReady || !visibleIds.length) return detections;
    return visibleIds.map(id => detectionMap.get(id)).filter(Boolean);
  }, [workerReady, visibleIds, detectionMap, detections]);

  // --- Build layer stack ---
  const layers = useMemo(() => {
    // Base layers
    const base = layerMode === 'map'
      ? [createMapTileLayer({ server: tileServer })]
      : createBaseLayers();

    // Detection layers — only visible subset (viewport-culled)
    const detectionLayers = createDetectionLayers({
      detections: visibleDetections,
      currentZoom: viewState.zoom,
      mode: layerMode,
      onHover: onDetectionHover,
    });

    return [...base, ...detectionLayers];
  }, [layerMode, tileServer, visibleDetections, viewState.zoom, onDetectionHover]);

  // View configuration
  const views = useMemo(() => {
    if (layerMode === 'map') {
      return new MapView({
        id: 'main',
        controller: {
          scrollZoom: { speed: 0.1, smooth: true },
          dragPan: true,
          dragRotate: false,
          keyboard: true,
          inertia: 300,
        },
      });
    }
    return new OrthographicView({
      id: 'main',
      controller: {
        scrollZoom: { speed: 0.1, smooth: true },
        dragPan: true,
        dragRotate: false,
        keyboard: true,
        inertia: 300,
      },
    });
  }, [layerMode]);

  return (
    <div className="app-container" ref={containerRef}>
      {/* deck.gl viewport — key forces remount on mode switch */}
      <DeckGL
        key={layerMode}
        views={views}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        layers={layers}
        onHover={onHover}
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
        }
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Detection hover tooltip */}
      <DetectionTooltip hoverInfo={hoverInfo} />

      {/* HUD: Info panel (top-left) */}
      <InfoPanel
        viewState={viewState}
        cursorWorld={cursorWorld}
        mode={layerMode}
        detectionStats={detectionStats}
        visibleCount={visibleDetections.length}
      />

      {/* HUD: Layer toggle (top-right) */}
      <LayerToggle
        mode={layerMode}
        tileServer={tileServer}
        onModeChange={handleModeChange}
        onTileServerChange={setTileServer}
      />

      {/* HUD: Zoom controls (bottom-right) */}
      <ZoomIndicator
        viewState={viewState}
        onZoomIn={() => zoomBy(zoomStep)}
        onZoomOut={() => zoomBy(-zoomStep)}
        onReset={resetView}
        mode={layerMode}
      />

      {/* HUD: Minimap (bottom-left) — only in procedural mode */}
      {layerMode === 'procedural' && (
        <Minimap
          viewState={viewState}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      )}
    </div>
  );
}
