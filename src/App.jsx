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
import { getViewportBounds, filterDetectionsByViewport } from './utils/viewport.js';
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

  // --- Adv Req 1: Viewport-based detection culling ---
  // Compute visible detections based on current viewport bounds.
  // Only detections whose AABB overlaps the viewport (with 10% padding) are rendered.
  const visibleDetections = useMemo(() => {
    const vpBounds = getViewportBounds(
      viewState, layerMode,
      containerSize.width, containerSize.height,
    );
    if (!vpBounds) return detections;
    return filterDetectionsByViewport(detections, vpBounds);
  }, [detections, viewState, layerMode, containerSize.width, containerSize.height]);

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
