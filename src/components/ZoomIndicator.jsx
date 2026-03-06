/**
 * ZoomIndicator.jsx
 * Displays the current zoom level and provides zoom in/out/reset controls.
 * Positioned in the bottom-right corner of the viewport.
 */

import { zoomToPercent, MIN_ZOOM, MAX_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from '../constants.js';

// SVG icon components (inline to avoid external deps)
function MagnifyIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function MinusIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function ResetIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </svg>
    );
}

export default function ZoomIndicator({ viewState, onZoomIn, onZoomOut, onReset, mode = 'procedural' }) {
    const isMap = mode === 'map';
    const minZ = isMap ? MAP_MIN_ZOOM : MIN_ZOOM;
    const maxZ = isMap ? MAP_MAX_ZOOM : MAX_ZOOM;
    const atMin = viewState.zoom <= minZ;
    const atMax = viewState.zoom >= maxZ;

    // Format zoom display based on mode
    const zoomDisplay = isMap
        ? `Z${viewState.zoom.toFixed(1)}`
        : `${zoomToPercent(viewState.zoom)}%`;

    return (
        <div id="zoom-indicator" className="zoom-indicator animate-fade-in">
            {/* Zoom badge */}
            <div className="zoom-badge" title={`Zoom: ${zoomDisplay} (scroll to zoom, drag to pan)`}>
                <span className="zoom-badge__icon">
                    <MagnifyIcon />
                </span>
                <span className="zoom-badge__value">{zoomDisplay}</span>
            </div>

            {/* Zoom controls */}
            <div className="zoom-controls">
                <button
                    id="zoom-in-btn"
                    className="zoom-controls__btn"
                    onClick={onZoomIn}
                    disabled={atMax}
                    title="Zoom in (+)"
                    aria-label="Zoom in"
                >
                    <PlusIcon />
                </button>
                <button
                    id="zoom-reset-btn"
                    className="zoom-controls__btn"
                    onClick={onReset}
                    title="Reset view"
                    aria-label="Reset view"
                >
                    <ResetIcon />
                </button>
                <button
                    id="zoom-out-btn"
                    className="zoom-controls__btn"
                    onClick={onZoomOut}
                    disabled={atMin}
                    title="Zoom out (−)"
                    aria-label="Zoom out"
                >
                    <MinusIcon />
                </button>
            </div>
        </div>
    );
}
