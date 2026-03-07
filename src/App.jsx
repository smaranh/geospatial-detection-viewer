/**
 * App.jsx
 * Main entry point for the Geospatial Detection Viewer.
 */

import { useState, useMemo } from 'react';
import './App.css';

import { generateDetections, getDetectionStats } from './data/generateDetections.js';
import GeoSpatialViewer from './components/GeoSpatialViewer.jsx';

export default function App() {
  const [layerMode, setLayerMode] = useState('map');
  const [tileServer, setTileServer] = useState('cartoDark');

  // --- Generate detection data (once per mode) ---
  const detections = useMemo(() => {
    console.time('generateDetections');
    const data = generateDetections(layerMode);
    console.timeEnd('generateDetections');
    return data;
  }, [layerMode]);

  const detectionStats = useMemo(() => getDetectionStats(detections), [detections]);

  return (
    <div className="app-container">
      <GeoSpatialViewer
        detections={detections}
        detectionStats={detectionStats}
        layerMode={layerMode}
        tileServer={tileServer}
        onModeChange={setLayerMode}
        onTileServerChange={setTileServer}
      />
    </div>
  );
}
