import React from 'react';
import type { CircuitState, AnalysisResult } from '@/pages/circuit-lab/engine/types';

interface CircuitCanvasProps {
    circuit: CircuitState;
    analysis: AnalysisResult | null;
    selectedComponentId: string | null;
    onSelectComponent: (id: string) => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
    circuit,
    analysis,
    selectedComponentId,
    onSelectComponent
}) => {
    const { nodes, components, loops } = circuit;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Scale and offset for positioning
    const scaleX = 4.5;
    const scaleY = 4.5;
    const offsetX = 80;
    const offsetY = 80;

    const getNodePos = (nodeId: string) => {
        const node = nodeMap.get(nodeId);
        if (!node) return { x: 0, y: 0 };
        return { x: node.x * scaleX + offsetX, y: node.y * scaleY + offsetY };
    };

    // Render a resistor symbol
    const renderResistor = (x1: number, y1: number, x2: number, y2: number, isSelected: boolean, value: number, name: string, current?: number) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const length = Math.sqrt(dx * dx + dy * dy);

        const zigzagWidth = 60;
        const zigzagHeight = 12;

        return (
            <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
                {/* Connection wires */}
                <line x1={-length / 2} y1={0} x2={-zigzagWidth / 2 - 5} y2={0}
                    stroke={isSelected ? '#8b5cf6' : '#64748b'} strokeWidth={3} strokeLinecap="round" />
                <line x1={zigzagWidth / 2 + 5} y1={0} x2={length / 2} y2={0}
                    stroke={isSelected ? '#8b5cf6' : '#64748b'} strokeWidth={3} strokeLinecap="round" />

                {/* Current flow animation */}
                {current && Math.abs(current) > 0.001 && (
                    <>
                        <line x1={-length / 2} y1={0} x2={length / 2} y2={0}
                            stroke="#22d3ee" strokeWidth={2} strokeOpacity={0.6}
                            className="current-animation" />
                    </>
                )}

                {/* Resistor body - Realistic 3D look */}
                <defs>
                    <linearGradient id={`resistorGrad-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="50%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                </defs>
                <rect x={-zigzagWidth / 2} y={-zigzagHeight} width={zigzagWidth} height={zigzagHeight * 2}
                    rx={3} ry={3}
                    fill={`url(#resistorGrad-${name})`}
                    stroke={isSelected ? '#8b5cf6' : '#78350f'}
                    strokeWidth={isSelected ? 2 : 1}
                    filter={isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))' : 'none'}
                />

                {/* Color bands */}
                <rect x={-zigzagWidth / 2 + 8} y={-zigzagHeight + 2} width={6} height={zigzagHeight * 2 - 4} fill="#7c3aed" rx={1} />
                <rect x={-zigzagWidth / 2 + 18} y={-zigzagHeight + 2} width={6} height={zigzagHeight * 2 - 4} fill="#1e293b" rx={1} />
                <rect x={zigzagWidth / 2 - 14} y={-zigzagHeight + 2} width={6} height={zigzagHeight * 2 - 4} fill="#dc2626" rx={1} />
                <rect x={zigzagWidth / 2 - 24} y={-zigzagHeight + 2} width={6} height={zigzagHeight * 2 - 4} fill="#eab308" rx={1} />

                {/* Value label */}
                <g transform={`rotate(${-angle})`}>
                    <rect x={-25} y={-35} width={50} height={20} rx={4}
                        fill="rgba(15, 23, 42, 0.9)" stroke="rgba(139, 92, 246, 0.3)" strokeWidth={1} />
                    <text x={0} y={-21} textAnchor="middle" fill="#f8fafc" fontSize={11} fontWeight={600} fontFamily="JetBrains Mono">
                        {value}Ω
                    </text>
                </g>
            </g>
        );
    };

    // Render a voltage source symbol
    const renderVoltageSource = (x1: number, y1: number, x2: number, y2: number, isSelected: boolean, value: number, name: string) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const length = Math.sqrt(dx * dx + dy * dy);
        const radius = 22;

        return (
            <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
                {/* Connection wires */}
                <line x1={-length / 2} y1={0} x2={-radius - 5} y2={0}
                    stroke={isSelected ? '#8b5cf6' : '#64748b'} strokeWidth={3} strokeLinecap="round" />
                <line x1={radius + 5} y1={0} x2={length / 2} y2={0}
                    stroke={isSelected ? '#8b5cf6' : '#64748b'} strokeWidth={3} strokeLinecap="round" />

                {/* Battery body */}
                <defs>
                    <radialGradient id={`batteryGrad-${name}`} cx="30%" cy="30%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#166534" />
                    </radialGradient>
                </defs>
                <circle r={radius} cx={0} cy={0}
                    fill={`url(#batteryGrad-${name})`}
                    stroke={isSelected ? '#8b5cf6' : '#14532d'}
                    strokeWidth={isSelected ? 3 : 2}
                    filter={isSelected ? 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.7))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'}
                />

                {/* + and - symbols */}
                <text x={-8} y={5} fill="#052e16" fontSize={16} fontWeight="bold" fontFamily="sans-serif">−</text>
                <text x={5} y={6} fill="#052e16" fontSize={14} fontWeight="bold" fontFamily="sans-serif">+</text>

                {/* Value label */}
                <g transform={`rotate(${-angle})`}>
                    <rect x={-25} y={-48} width={50} height={20} rx={4}
                        fill="rgba(15, 23, 42, 0.9)" stroke="rgba(250, 204, 21, 0.4)" strokeWidth={1} />
                    <text x={0} y={-34} textAnchor="middle" fill="#facc15" fontSize={11} fontWeight={600} fontFamily="JetBrains Mono">
                        {value}V
                    </text>
                </g>
            </g>
        );
    };

    return (
        <div className="circuit-board rounded-xl overflow-hidden relative">
            {/* Grid overlay for realism */}
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 70%)
          `
                }}
            />

            <svg width="600" height="400" viewBox="0 0 600 400" className="relative z-10">
                {/* Mesh loop indicators */}
                {loops.map((loop, idx) => {
                    // Get all unique nodes for this loop
                    const loopNodePositions: { x: number; y: number }[] = [];
                    loop.componentIds.forEach(cid => {
                        const comp = components.find(c => c.id === cid);
                        if (comp) {
                            const n1 = getNodePos(comp.node1Id);
                            const n2 = getNodePos(comp.node2Id);
                            loopNodePositions.push(n1, n2);
                        }
                    });

                    // Calculate bounding box center for better positioning
                    const minX = Math.min(...loopNodePositions.map(n => n.x));
                    const maxX = Math.max(...loopNodePositions.map(n => n.x));
                    const minY = Math.min(...loopNodePositions.map(n => n.y));
                    const maxY = Math.max(...loopNodePositions.map(n => n.y));

                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;

                    // Clockwise arrow arc (consistent for all loops)
                    const r = 28;

                    return (
                        <g key={loop.id}>
                            {/* Dashed circle indicating mesh boundary */}
                            <circle cx={centerX} cy={centerY} r={r}
                                fill="none" stroke="rgba(139, 92, 246, 0.15)" strokeWidth={2} strokeDasharray="6 4" />

                            {/* Clockwise arrow - arc centered around the loop center */}
                            <path
                                d={`M ${centerX} ${centerY - r} 
                                    A ${r} ${r} 0 1 1 ${centerX - r} ${centerY}`}
                                fill="none"
                                stroke="rgba(139, 92, 246, 0.5)"
                                strokeWidth={2}
                                markerEnd="url(#arrowhead)"
                            />

                            {/* Loop label - centered */}
                            <text x={centerX} y={centerY + 5} textAnchor="middle" fill="#8b5cf6" fontSize={14} fontWeight="bold">
                                I{idx + 1}
                            </text>

                            {/* Current value display (if available) */}
                            {analysis && analysis.loopCurrents[loop.id] !== undefined && (
                                <g>
                                    <rect x={centerX - 30} y={centerY + r + 8} width={60} height={18} rx={4}
                                        fill="rgba(15, 23, 42, 0.9)" stroke="rgba(34, 211, 238, 0.3)" strokeWidth={1} />
                                    <text x={centerX} y={centerY + r + 21} textAnchor="middle"
                                        fill="#22d3ee" fontSize={10} fontWeight={600} fontFamily="JetBrains Mono">
                                        {analysis.loopCurrents[loop.id].toFixed(3)}A
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* Arrow marker definition */}
                <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="rgba(139, 92, 246, 0.6)" />
                    </marker>
                </defs>

                {/* Render components */}
                {components.map(comp => {
                    const n1 = getNodePos(comp.node1Id);
                    const n2 = getNodePos(comp.node2Id);
                    const isSelected = selectedComponentId === comp.id;
                    const current = analysis?.branchCurrents[comp.id];

                    return (
                        <g key={comp.id} onClick={() => onSelectComponent(comp.id)} style={{ cursor: 'pointer' }}>
                            {comp.type === 'RESISTOR'
                                ? renderResistor(n1.x, n1.y, n2.x, n2.y, isSelected, comp.value, comp.name, current)
                                : renderVoltageSource(n1.x, n1.y, n2.x, n2.y, isSelected, comp.value, comp.name)
                            }
                        </g>
                    );
                })}

                {/* Render nodes (junction points) */}
                {nodes.map(node => {
                    const pos = getNodePos(node.id);
                    return (
                        <g key={node.id}>
                            <circle cx={pos.x} cy={pos.y} r={7}
                                fill="#0f172a" stroke="#64748b" strokeWidth={2} />
                            <circle cx={pos.x} cy={pos.y} r={4}
                                fill="#f8fafc" />
                        </g>
                    );
                })}
            </svg>

            {/* Floating label */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-md bg-slate-900/80 border border-slate-700 text-xs text-slate-400">
                <span className="text-slate-500">Circuit ID:</span> <span className="text-purple-400 font-mono">{Math.random().toString(36).substring(2, 8).toUpperCase()}</span>
            </div>
        </div>
    );
};
