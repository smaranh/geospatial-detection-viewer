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
  const [detectionCount, setDetectionCount] = useState(10000);

  // --- Generate detection data (once per mode/count) ---
  const detections = useMemo(() => {
    console.time('generateDetections');
    const data = generateDetections(layerMode, detectionCount);
    console.timeEnd('generateDetections');
    return data;
  }, [layerMode, detectionCount]);

  const detectionStats = useMemo(() => getDetectionStats(detections), [detections]);

  return (
    <div className="app-container">
      <GeoSpatialViewer
        detections={detections}
        detectionStats={detectionStats}
        layerMode={layerMode}
        tileServer={tileServer}
        detectionCount={detectionCount}
        onModeChange={setLayerMode}
        onTileServerChange={setTileServer}
        onDetectionCountChange={setDetectionCount}
      />
    </div>
  );
}
