/**
 * useViewState.js
 * Custom hook for managing pan/zoom state.
 * 
 * Supports two modes:
 * 1. "procedural" — OrthographicView with pixel-space coordinates
 * 2. "map" — MapView with geographic (lat/lng) coordinates
 * 
 * Both modes provide:
 * - Cursor-centered zoom (handled by deck.gl controllers)
 * - Clamped zoom range
 * - Programmatic zoom in/out/reset
 */

import { useState, useCallback, useRef } from 'react';
import {
    WORLD_WIDTH, WORLD_HEIGHT, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM,
    MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM,
} from '../constants.js';

/**
 * Creates the initial view state for the procedural (pixel-space) mode.
 */
function createProceduralViewState() {
    return {
        target: [WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0],
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
    };
}

/**
 * Creates the initial view state for the geographic map mode.
 */
function createMapViewState() {
    return {
        longitude: MAP_DEFAULT_CENTER.longitude,
        latitude: MAP_DEFAULT_CENTER.latitude,
        zoom: MAP_DEFAULT_ZOOM,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        pitch: 0,
        bearing: 0,
    };
}

/**
 * Hook that manages the deck.gl view state for both modes.
 * 
 * @param {'procedural'|'map'} mode - Which base layer mode is active
 * @returns View state, change handler, and control methods
 */
export function useViewState(mode) {
    const [proceduralState, setProceduralState] = useState(createProceduralViewState);
    const [mapState, setMapState] = useState(createMapViewState);
    const viewStateRef = useRef(mode === 'map' ? mapState : proceduralState);

    // Current view state depends on mode
    const viewState = mode === 'map' ? mapState : proceduralState;
    const setState = mode === 'map' ? setMapState : setProceduralState;
    const minZoom = mode === 'map' ? MAP_MIN_ZOOM : MIN_ZOOM;
    const maxZoom = mode === 'map' ? MAP_MAX_ZOOM : MAX_ZOOM;

    /**
     * Handle view state changes from deck.gl.
     */
    const onViewStateChange = useCallback(({ viewState: newViewState }) => {
        const currentMin = mode === 'map' ? MAP_MIN_ZOOM : MIN_ZOOM;
        const currentMax = mode === 'map' ? MAP_MAX_ZOOM : MAX_ZOOM;
        const clampedZoom = Math.max(currentMin, Math.min(currentMax, newViewState.zoom));

        const updated = {
            ...newViewState,
            zoom: clampedZoom,
            minZoom: currentMin,
            maxZoom: currentMax,
        };

        viewStateRef.current = updated;
        if (mode === 'map') {
            setMapState(updated);
        } else {
            setProceduralState(updated);
        }
    }, [mode]);

    /**
     * Zoom in/out by a step amount.
     */
    const zoomBy = useCallback((delta) => {
        setState((prev) => {
            const newZoom = Math.max(minZoom, Math.min(maxZoom, prev.zoom + delta));
            const updated = { ...prev, zoom: newZoom };
            viewStateRef.current = updated;
            return updated;
        });
    }, [setState, minZoom, maxZoom]);

    /**
     * Reset to default view for current mode.
     */
    const resetView = useCallback(() => {
        const initial = mode === 'map' ? createMapViewState() : createProceduralViewState();
        viewStateRef.current = initial;
        setState(initial);
    }, [mode, setState]);

    /**
     * Zoom to fit (minimum zoom level).
     */
    const zoomToFit = useCallback(() => {
        setState((prev) => {
            const updated = { ...prev, zoom: minZoom };
            viewStateRef.current = updated;
            return updated;
        });
    }, [setState, minZoom]);

    return {
        viewState,
        viewStateRef,
        onViewStateChange,
        zoomBy,
        resetView,
        zoomToFit,
    };
}
