/**
 * InfoPanel.jsx
 * Displays app title, current viewport stats, and cursor position.
 * Adapts display based on mode (procedural vs map).
 */

import { useMemo } from 'react';
import { zoomToPercent, WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

/**
 * Format lat/lng to degrees with direction (e.g., "37.7749° N, 122.4194° W")
 */
function formatLatLng(lat, lng) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export default function InfoPanel({
    viewState,
    cursorWorld,
    mode,
    detectionStats,
    visibleCount,
    detectionCount,
    onDetectionCountChange
}) {
    const isMap = mode === 'map';

    const counts = [10000, 100000];

    // Zoom display
    const zoomDisplay = useMemo(() => {
        if (isMap) {
            return `Z${viewState.zoom.toFixed(1)}`;
        }
        return `${zoomToPercent(viewState.zoom)}%`;
    }, [viewState.zoom, isMap]);

    // Scale display
    const scaleDisplay = useMemo(() => {
        if (isMap) {
            return `Z${viewState.zoom.toFixed(1)}`;
        }
        const scale = Math.pow(2, viewState.zoom);
        return `${scale.toFixed(2)}×`;
    }, [viewState.zoom, isMap]);

    // Center display
    const centerText = useMemo(() => {
        if (isMap) {
            if (viewState.latitude == null || viewState.longitude == null) return '—';
            return formatLatLng(viewState.latitude, viewState.longitude);
        }
        if (!viewState.target) return '—';
        const x = Math.round(viewState.target[0]);
        const y = Math.round(viewState.target[1]);
        return `${x}, ${y}`;
    }, [viewState, isMap]);

    // Cursor display
    const cursorText = useMemo(() => {
        if (!cursorWorld) return '—';
        if (isMap) {
            // cursorWorld is [lng, lat] in map mode
            return formatLatLng(cursorWorld[1], cursorWorld[0]);
        }
        const x = Math.round(cursorWorld[0]);
        const y = Math.round(cursorWorld[1]);
        if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return 'Out of bounds';
        return `${x}, ${y}`;
    }, [cursorWorld, isMap]);

    return (
        <div id="info-panel" className="info-panel animate-fade-in">
            {/* App title */}
            <div className="info-panel__title">
                <div className="info-panel__logo">G</div>
                <span className="info-panel__name">Geospatial Detection Viewer</span>
            </div>

            {/* Scale Selector */}
            <div className="info-panel__scale-selector">
                {counts.map((count) => (
                    <button
                        key={count}
                        className={`scale-btn ${detectionCount === count ? 'scale-btn--active' : ''}`}
                        onClick={() => onDetectionCountChange(count)}
                    >
                        {count / 1000}k
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="info-panel__stats">
                <div className="info-panel__stat">
                    <span className="info-panel__stat-label">Mode</span>
                    <span className="info-panel__stat-value">
                        {isMap ? 'Map' : 'Procedural'}
                    </span>
                </div>
                <div className="info-panel__stat">
                    <span className="info-panel__stat-label">Zoom</span>
                    <span className="info-panel__stat-value info-panel__stat-value--accent">
                        {zoomDisplay}
                    </span>
                </div>
                {!isMap && (
                    <div className="info-panel__stat">
                        <span className="info-panel__stat-label">Scale</span>
                        <span className="info-panel__stat-value">{scaleDisplay}</span>
                    </div>
                )}
                <div className="info-panel__stat">
                    <span className="info-panel__stat-label">Center</span>
                    <span className="info-panel__stat-value">{centerText}</span>
                </div>
                <div className="info-panel__stat">
                    <span className="info-panel__stat-label">Cursor</span>
                    <span className="info-panel__stat-value">{cursorText}</span>
                </div>
                {!isMap && (
                    <div className="info-panel__stat">
                        <span className="info-panel__stat-label">World</span>
                        <span className="info-panel__stat-value">{WORLD_WIDTH} × {WORLD_HEIGHT}</span>
                    </div>
                )}
                {detectionStats && (
                    <div className="info-panel__stat">
                        <span className="info-panel__stat-label">Detections</span>
                        <span className="info-panel__stat-value">
                            <span style={{ color: 'var(--color-accent-amber)' }}>
                                {visibleCount != null ? visibleCount.toLocaleString() : detectionStats.total.toLocaleString()}
                            </span>
                            {visibleCount != null && (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85em' }}>
                                    {' '}/ {detectionStats.total.toLocaleString()}
                                </span>
                            )}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
