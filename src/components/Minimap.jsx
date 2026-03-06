/**
 * Minimap.jsx
 * Shows a small overview of the entire world with a viewport rectangle
 * indicating the current visible area.
 */

import { useMemo } from 'react';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;

export default function Minimap({ viewState, containerWidth, containerHeight }) {
    // Calculate the viewport rectangle in minimap space
    const viewportRect = useMemo(() => {
        if (!containerWidth || !containerHeight) return null;

        const scale = Math.pow(2, viewState.zoom);

        // World-space dimensions of the visible viewport
        const visibleW = containerWidth / scale;
        const visibleH = containerHeight / scale;

        // World-space top-left of visible viewport
        const worldLeft = viewState.target[0] - visibleW / 2;
        const worldTop = viewState.target[1] - visibleH / 2;

        // Scale factors from world to minimap
        const scaleX = MINIMAP_WIDTH / WORLD_WIDTH;
        const scaleY = MINIMAP_HEIGHT / WORLD_HEIGHT;

        return {
            left: Math.max(0, worldLeft * scaleX),
            top: Math.max(0, worldTop * scaleY),
            width: Math.min(MINIMAP_WIDTH, visibleW * scaleX),
            height: Math.min(MINIMAP_HEIGHT, visibleH * scaleY),
        };
    }, [viewState, containerWidth, containerHeight]);

    return (
        <div id="minimap" className="minimap animate-fade-in" title="Minimap — current viewport">
            {/* World background with subtle grid */}
            <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} style={{ display: 'block' }}>
                {/* Background */}
                <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="rgba(13, 17, 23, 0.8)" />
                {/* Grid pattern */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <line
                        key={`v${i}`}
                        x1={(i + 1) * (MINIMAP_WIDTH / 8)}
                        y1={0}
                        x2={(i + 1) * (MINIMAP_WIDTH / 8)}
                        y2={MINIMAP_HEIGHT}
                        stroke="rgba(148, 163, 184, 0.08)"
                        strokeWidth={0.5}
                    />
                ))}
                {Array.from({ length: 6 }).map((_, i) => (
                    <line
                        key={`h${i}`}
                        x1={0}
                        y1={(i + 1) * (MINIMAP_HEIGHT / 6)}
                        x2={MINIMAP_WIDTH}
                        y2={(i + 1) * (MINIMAP_HEIGHT / 6)}
                        stroke="rgba(148, 163, 184, 0.08)"
                        strokeWidth={0.5}
                    />
                ))}
            </svg>

            {/* Viewport indicator */}
            {viewportRect && (
                <div
                    className="minimap__viewport"
                    style={{
                        left: viewportRect.left,
                        top: viewportRect.top,
                        width: Math.max(4, viewportRect.width),
                        height: Math.max(4, viewportRect.height),
                    }}
                />
            )}
        </div>
    );
}
