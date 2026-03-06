/**
 * DetectionTooltip.jsx
 * Floating tooltip that shows detection details on hover.
 * Uses deck.gl's GPU picking — no JS hit-testing of 10K rects.
 */

import { CATEGORIES } from '../constants.js';

const PRIORITY_LABELS = {
    1: { text: 'Critical', color: '#f43f5e' },
    2: { text: 'High', color: '#f59e0b' },
    3: { text: 'Medium', color: '#3b82f6' },
    4: { text: 'Low', color: '#94a3b8' },
    5: { text: 'Minimal', color: '#64748b' },
};

export default function DetectionTooltip({ hoverInfo }) {
    if (!hoverInfo || !hoverInfo.object) return null;

    const d = hoverInfo.object;
    const priorityInfo = PRIORITY_LABELS[d.priority] || PRIORITY_LABELS[3];
    const confidencePercent = Math.round(d.confidence * 100);

    return (
        <div
            className="detection-tooltip"
            style={{
                left: hoverInfo.x + 12,
                top: hoverInfo.y - 12,
            }}
        >
            {/* Category + confidence header */}
            <div className="detection-tooltip__header">
                <span
                    className="detection-tooltip__category-dot"
                    style={{ background: `rgb(${d.color.join(',')})` }}
                />
                <span className="detection-tooltip__category">{d.label}</span>
                <span className="detection-tooltip__confidence">{confidencePercent}%</span>
            </div>

            {/* Details */}
            <div className="detection-tooltip__details">
                <div className="detection-tooltip__row">
                    <span className="detection-tooltip__label">Priority</span>
                    <span
                        className="detection-tooltip__value"
                        style={{ color: priorityInfo.color }}
                    >
                        {priorityInfo.text}
                    </span>
                </div>
                <div className="detection-tooltip__row">
                    <span className="detection-tooltip__label">ID</span>
                    <span className="detection-tooltip__value">#{d.id}</span>
                </div>
            </div>
        </div>
    );
}
