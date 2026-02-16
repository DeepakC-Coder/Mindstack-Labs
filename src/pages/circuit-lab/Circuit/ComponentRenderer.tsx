import React from 'react';
import type { Component } from '@/pages/circuit-lab/engine/types';

interface ComponentRendererProps {
    component: Component;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isSelected?: boolean;
    onClick?: () => void;
    current?: number; // For animation speed/direction?
}

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({
    component,
    x1,
    y1,
    x2,
    y2,
    isSelected,
    onClick
}) => {
    // Calculate center and rotation
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

    // Constants for symbol drawing (relative to center 0,0 horizontal)
    // Assume length is usually ~ 200 units in SVG coords

    const strokeColor = isSelected ? 'var(--secondary)' : 'var(--circuit-line)';
    const strokeWidth = isSelected ? 3 : 2;

    // Render Logic
    let symbol = null;

    if (component.type === 'RESISTOR') {
        // Zigzag path
        // -20 to +20 range
        symbol = (
            <path
                d="M -30 0 L -20 0 L -15 -10 L -5 10 L 5 -10 L 15 10 L 20 0 L 30 0"
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        );
    } else if (component.type === 'VOLTAGE_SOURCE') {
        // Circle with +/-
        // Assumption: Source 'direction' from Node1 -> Node2 implies + at Node1? 
        // Or standard: Long bar / Short bar.
        // Let's use Circle for "Source" symbol.
        // If value > 0, we assume the 'push' is in direction node1->node2?
        // Actually in my generator I treated Loop direction vs Component direction.
        // Let's draw a standard circle with + / -
        // If we conform to standard: Long bar is +, Short is -.
        // Let's stick to circle V.
        symbol = (
            <g>
                <circle r="15" cx="0" cy="0" fill="var(--bg-panel)" stroke={strokeColor} strokeWidth={strokeWidth} />
                <text x="-5" y="5" fill={strokeColor} fontSize="14" fontWeight="bold">-</text>
                <text x="5" y="5" fill={strokeColor} fontSize="14" fontWeight="bold">+</text>
                {/* Adjust +/- position based on actual polarity logic later, simplified for Visual now */}
            </g>
        );
    }

    // Label
    const label = (
        <text
            x="0"
            y="-25"
            textAnchor="middle"
            fill="var(--text-main)"
            fontSize="12"
            transform={`rotate(${-rotation})`} // Counter-rotate text
        >
            {component.name}
        </text>
    );

    return (
        <g
            transform={`translate(${cx}, ${cy}) rotate(${rotation})`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
        >
            {/* Invisible clickable hit area */}
            <rect x={-length / 2} y={-20} width={length} height={40} fill="transparent" />

            {/* Connecting leads from ends of symbol to nodes */}
            {/* Symbol is ~60px wide. We draw lines from -Length/2 to -30 and 30 to Length/2 */}
            <line x1={-length / 2} y1={0} x2={-30} y2={0} stroke={strokeColor} strokeWidth={strokeWidth} />
            <line x1={30} y1={0} x2={length / 2} y2={0} stroke={strokeColor} strokeWidth={strokeWidth} />

            {symbol}
            {label}
        </g>
    );
};
