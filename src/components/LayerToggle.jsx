/**
 * LayerToggle.jsx
 * Floating control to switch between base layer modes and tile servers.
 * Positioned in the top-right corner.
 */

import { useState } from 'react';
import { TILE_SERVER_OPTIONS } from '../layers/createMapTileLayer.js';

function LayersIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export default function LayerToggle({ mode, tileServer, onModeChange, onTileServerChange }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div id="layer-toggle" className="layer-toggle theme-light animate-fade-in">
            {/* Toggle button */}
            <button
                className="layer-toggle__btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Base layer settings"
                aria-label="Toggle base layer settings"
            >
                <LayersIcon />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="layer-toggle__panel">
                    <div className="layer-toggle__section">
                        <div className="layer-toggle__section-title">Base Layer</div>

                        {/* Mode: Procedural */}
                        <button
                            className={`layer-toggle__option ${mode === 'procedural' ? 'layer-toggle__option--active' : ''}`}
                            onClick={() => onModeChange('procedural')}
                        >
                            <span className="layer-toggle__option-dot" style={{ background: 'var(--color-accent-violet)' }} />
                            <span className="layer-toggle__option-label">Procedural Grid</span>
                            {mode === 'procedural' && <span className="layer-toggle__check"><CheckIcon /></span>}
                        </button>

                        {/* Mode: Map tiles */}
                        <button
                            className={`layer-toggle__option ${mode === 'map' ? 'layer-toggle__option--active' : ''}`}
                            onClick={() => onModeChange('map')}
                        >
                            <span className="layer-toggle__option-dot" style={{ background: 'var(--color-accent-cyan)' }} />
                            <span className="layer-toggle__option-label">Map Tiles</span>
                            {mode === 'map' && <span className="layer-toggle__check"><CheckIcon /></span>}
                        </button>
                    </div>

                    {/* Tile server selector (only shown in map mode) */}
                    {mode === 'map' && (
                        <div className="layer-toggle__section">
                            <div className="layer-toggle__section-title">Tile Server</div>
                            {TILE_SERVER_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    className={`layer-toggle__option ${tileServer === option.id ? 'layer-toggle__option--active' : ''}`}
                                    onClick={() => onTileServerChange(option.id)}
                                >
                                    <span className="layer-toggle__option-label">{option.label}</span>
                                    <span className="layer-toggle__option-desc">{option.description}</span>
                                    {tileServer === option.id && <span className="layer-toggle__check"><CheckIcon /></span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
