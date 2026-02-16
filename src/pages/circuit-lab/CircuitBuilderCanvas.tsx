import React, { useState, useCallback, useEffect } from 'react';
import type { PlaceableComponent, CircuitNode, Component, AnalysisResult } from '@/pages/circuit-lab/engine/types';
import { RefreshCw, X } from 'lucide-react';

interface Wire {
    id: string;
    startNode: CircuitNode;
    endNode: CircuitNode;
}

interface CircuitBuilderCanvasProps {
    selectedComponent: PlaceableComponent | null;
    placedComponents: Component[];
    nodes: CircuitNode[];
    wires: Wire[];
    onPlaceComponent: (node: CircuitNode, component: PlaceableComponent) => void;
    onAddWire: (startNode: CircuitNode, endNode: CircuitNode) => void;
    onSelectPlacedComponent: (id: string) => void;
    selectedPlacedId: string | null;
    isWireMode: boolean;
    onCancelWireMode: () => void;
    onDelete: (id: string) => void;
    onRotate: (id: string) => void;
    analysis: AnalysisResult | null;
}

const GRID_SIZE = 40;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

export const CircuitBuilderCanvas: React.FC<CircuitBuilderCanvasProps> = ({
    selectedComponent,
    placedComponents,
    nodes,
    wires,
    onPlaceComponent,
    onAddWire,
    onSelectPlacedComponent,
    selectedPlacedId,
    isWireMode,
    onCancelWireMode,
    onDelete,
    onRotate,
    analysis
}) => {
    const [hoveredNode, setHoveredNode] = useState<{ x: number; y: number } | null>(null);
    const [wireStartNode, setWireStartNode] = useState<CircuitNode | null>(null);

    // Generate grid points
    const gridPoints: { x: number; y: number }[] = [];
    for (let x = GRID_SIZE; x < CANVAS_WIDTH; x += GRID_SIZE) {
        for (let y = GRID_SIZE; y < CANVAS_HEIGHT; y += GRID_SIZE) {
            gridPoints.push({ x, y });
        }
    }

    // Handle escape key to cancel wire mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setWireStartNode(null);
                onCancelWireMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancelWireMode]);

    const handleGridClick = useCallback((x: number, y: number) => {
        const node: CircuitNode = {
            id: `node-${x}-${y}`,
            x,
            y
        };

        if (isWireMode) {
            if (!wireStartNode) {
                // First click - set start point
                setWireStartNode(node);
            } else {
                // Second click - set end point and create wire
                if (wireStartNode.x !== x || wireStartNode.y !== y) {
                    onAddWire(wireStartNode, node);
                }
                setWireStartNode(null);
            }
        } else if (selectedComponent && selectedComponent.type !== 'WIRE') {
            onPlaceComponent(node, selectedComponent);
        }
    }, [selectedComponent, isWireMode, wireStartNode, onPlaceComponent, onAddWire]);

    // Render component on canvas
    const renderPlacedComponent = (comp: Component) => {
        const node = comp.center || { x: 0, y: 0 };
        const orientation = comp.orientation || 0;
        const isSelected = selectedPlacedId === comp.id;
        const color = getComponentColor(comp.type);

        return (
            <g
                key={comp.id}
                onClick={(e) => { e.stopPropagation(); onSelectPlacedComponent(comp.id); }}
                transform={`translate(${node.x}, ${node.y}) rotate(${orientation})`}
                style={{ cursor: 'pointer' }}
            >
                {/* Hit area - Smaller to not block terminals */}
                <rect x={-35} y={-20} width={70} height={40} fill="transparent" />

                {comp.type === 'RESISTOR' && (
                    <>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />
                        <line x1={-40} y1={0} x2={-25} y2={0} stroke="#64748b" strokeWidth={2} />
                        <line x1={25} y1={0} x2={40} y2={0} stroke="#64748b" strokeWidth={2} />

                        <rect
                            x={-25}
                            y={-10}
                            width={50}
                            height={20}
                            rx={3}
                            fill={`url(#resistor-grad)`}
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeWidth={isSelected ? 3 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))' : undefined}
                        />
                        {/* Color bands */}
                        <rect x={-18} y={-8} width={4} height={16} fill="#7c3aed" rx={1} />
                        <rect x={-10} y={-8} width={4} height={16} fill="#1e293b" rx={1} />
                        <rect x={6} y={-8} width={4} height={16} fill="#dc2626" rx={1} />
                        <rect x={14} y={-8} width={4} height={16} fill="#eab308" rx={1} />
                    </>
                )}
                {comp.type === 'DC_BATTERY' && (
                    <g>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />
                        <line x1={-40} y1={0} x2={-18} y2={0} stroke="#64748b" strokeWidth={2} />
                        <line x1={18} y1={0} x2={40} y2={0} stroke="#64748b" strokeWidth={2} />

                        <circle
                            cx={0}
                            cy={0}
                            r={18}
                            fill="url(#battery-grad)"
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeWidth={isSelected ? 3 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))' : undefined}
                        />
                        <text x={-6} y={4} fill="#052e16" fontSize={12} fontWeight="bold">+</text>
                        <text x={2} y={4} fill="#052e16" fontSize={12} fontWeight="bold">-</text>
                    </g>
                )}
                {comp.type === 'DIODE' && (
                    <g>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />
                        <line x1={-40} y1={0} x2={-15} y2={0} stroke="#64748b" strokeWidth={2} />
                        <line x1={15} y1={0} x2={40} y2={0} stroke="#64748b" strokeWidth={2} />

                        <polygon
                            points={`-15,-12 15,0 -15,12`}
                            fill={`${color}40`}
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeWidth={isSelected ? 3 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))' : undefined}
                        />
                        <line x1={15} y1={-12} x2={15} y2={12}
                            stroke={isSelected ? '#22d3ee' : color} strokeWidth={3} />
                    </g>
                )}
                {comp.type === 'CAPACITOR' && (
                    <g>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />

                        <line x1={-4} y1={-15} x2={-4} y2={15}
                            stroke={isSelected ? '#22d3ee' : color} strokeWidth={4} />
                        <line x1={4} y1={-15} x2={4} y2={15}
                            stroke={isSelected ? '#22d3ee' : color} strokeWidth={4} />
                        <line x1={-40} y1={0} x2={-4} y2={0}
                            stroke="#64748b" strokeWidth={2} />
                        <line x1={4} y1={0} x2={40} y2={0}
                            stroke="#64748b" strokeWidth={2} />
                    </g>
                )}
                {comp.type === 'AC_SOURCE' && (
                    <g>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />
                        <line x1={-40} y1={0} x2={-18} y2={0} stroke="#64748b" strokeWidth={2} />
                        <line x1={18} y1={0} x2={40} y2={0} stroke="#64748b" strokeWidth={2} />

                        <circle
                            cx={0}
                            cy={0}
                            r={18}
                            fill="none"
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeWidth={isSelected ? 3 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))' : undefined}
                        />
                        <path
                            d={`M -10 0 Q -5 -8, 0 0 Q 5 8, 10 0`}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                        />
                    </g>
                )}
                {comp.type === 'AMMETER' && (
                    <g>
                        {/* Terminals */}
                        <circle cx={-40} cy={0} r={3} fill="#64748b" />
                        <circle cx={40} cy={0} r={3} fill="#64748b" />
                        <line x1={-40} y1={0} x2={-18} y2={0} stroke="#64748b" strokeWidth={2} />
                        <line x1={18} y1={0} x2={40} y2={0} stroke="#64748b" strokeWidth={2} />

                        <circle
                            cx={0}
                            cy={0}
                            r={18}
                            fill="#0f172a"
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeWidth={isSelected ? 3 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))' : undefined}
                        />
                        <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={14} fontWeight="bold" fontFamily="sans-serif">A</text>

                        {/* Current Display if available */}
                        {(comp as any).current !== undefined && (
                            <g transform={`rotate(${-orientation})`}>
                                <rect x={-24} y={-48} width={48} height={16} rx={4} fill="rgba(15, 23, 42, 0.9)" stroke={color} strokeWidth={1} />
                                <text x={0} y={-37} textAnchor="middle" fill="#22d3ee" fontSize={10} fontWeight="bold" fontFamily="JetBrains Mono">
                                    {(comp as any).current.toFixed(2)}A
                                </text>
                            </g>
                        )}
                    </g>
                )}
                {/* Value label */}
                <text
                    x={0}
                    y={35}
                    textAnchor="middle"
                    fill={color}
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="JetBrains Mono"
                    transform={`rotate(${-orientation})`}
                >
                    {comp.value}{getComponentUnit(comp.type)}
                </text>

                {/* Controls Overlay - Show when selected */}
                {isSelected && (
                    <foreignObject x={-30} y={-55} width={60} height={30} transform={`rotate(${-orientation})`}>
                        <div className="flex justify-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRotate(comp.id); }}
                                className="p-1 rounded-full bg-slate-800 text-cyan-400 hover:bg-slate-700 border border-slate-600 shadow-lg transition-transform hover:scale-110"
                                title="Rotate"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(comp.id); }}
                                className="p-1 rounded-full bg-slate-800 text-red-400 hover:bg-slate-700 border border-slate-600 shadow-lg transition-transform hover:scale-110"
                                title="Delete"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </foreignObject>
                )}
            </g>
        );
    };

    return (
        <div className="relative rounded-xl overflow-hidden" style={{
            background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)'
        }}>
            {/* Animated grid background */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `
                    linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
            }} />

            {/* Glow effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-cyan-500/5 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-1/2 h-1/3 bg-emerald-500/5 blur-3xl" />
            </div>

            {/* Wire mode indicator */}
            {(isWireMode || analysis) && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/50 text-cyan-400 text-sm font-semibold z-20 flex items-center gap-2">
                    {isWireMode ? (
                        <>🔌 Wire Mode: {wireStartNode ? 'Click end point' : 'Click start point'}</>
                    ) : (
                        <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Circuit Active</>
                    )}
                </div>
            )}

            <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-10">
                <defs>
                    <linearGradient id="resistor-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="50%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                    <linearGradient id="battery-grad" x1="30%" y1="30%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#166534" />
                    </linearGradient>
                </defs>

                {/* Render wires */}
                {wires.map((wire) => {
                    const isActive = analysis && analysis.isSolvable;
                    return (
                        <g key={wire.id}>
                            <line
                                x1={wire.startNode.x}
                                y1={wire.startNode.y}
                                x2={wire.endNode.x}
                                y2={wire.endNode.y}
                                stroke={isActive ? '#334155' : '#64748b'}
                                strokeWidth={3}
                                strokeLinecap="round"
                            />
                            {isActive && (
                                <line
                                    x1={wire.startNode.x}
                                    y1={wire.startNode.y}
                                    x2={wire.endNode.x}
                                    y2={wire.endNode.y}
                                    stroke="#22d3ee"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeDasharray="4 8"
                                    className="animate-pulse"
                                    opacity={0.4}
                                >
                                    <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
                                </line>
                            )}
                        </g>
                    );
                })}

                {/* Wire preview line */}
                {wireStartNode && hoveredNode && (
                    <line
                        x1={wireStartNode.x}
                        y1={wireStartNode.y}
                        x2={hoveredNode.x}
                        y2={hoveredNode.y}
                        stroke="#22d3ee"
                        strokeWidth={3}
                        strokeDasharray="8 4"
                        opacity={0.8}
                    />
                )}

                {/* Render placed components */}
                {placedComponents.map(renderPlacedComponent)}

                {/* Grid points - Render on top so they are clickable even over component terminals */}
                {gridPoints.map(({ x, y }) => {
                    const isHovered = hoveredNode?.x === x && hoveredNode?.y === y;
                    const hasNode = nodes.some(n => n.x === x && n.y === y);
                    const isWireStart = wireStartNode?.x === x && wireStartNode?.y === y;

                    return (
                        <g key={`${x}-${y}`}>
                            <circle
                                cx={x}
                                cy={y}
                                r={isWireStart ? 7 : isHovered ? 6 : 3}
                                fill={isWireStart ? '#22d3ee' : hasNode ? '#22d3ee' : isHovered ? 'rgba(34, 211, 238, 0.4)' : 'rgba(100, 116, 139, 0.15)'}
                                stroke={isWireStart ? '#fff' : isHovered ? '#22d3ee' : 'transparent'}
                                strokeWidth={2}
                                style={{ cursor: (selectedComponent || isWireMode) ? 'pointer' : 'default', transition: 'all 0.2s' }}
                                onMouseEnter={() => setHoveredNode({ x, y })}
                                onMouseLeave={() => setHoveredNode(null)}
                                onClick={() => handleGridClick(x, y)}
                            />
                            {isHovered && (selectedComponent || isWireMode) && !isWireStart && (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={15}
                                    fill="none"
                                    stroke="#22d3ee"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                    className="animate-spin"
                                    style={{ animationDuration: '8s' }}
                                />
                            )}
                            {isWireStart && (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={12}
                                    fill="none"
                                    stroke="#22d3ee"
                                    strokeWidth={2}
                                    className="animate-ping"
                                    style={{ animationDuration: '1.5s' }}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Floating hints */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-md bg-slate-900/80 border border-slate-700 text-xs text-slate-400">
                {isWireMode ? (
                    wireStartNode ? (
                        <span className="text-cyan-400">Click another point to complete wire • ESC to cancel</span>
                    ) : (
                        <span className="text-cyan-400">Click a grid point to start wire • ESC to cancel</span>
                    )
                ) : selectedComponent ? (
                    <span className="text-emerald-400">Click on grid to place {selectedComponent.name}</span>
                ) : (
                    <span>Select a component from the tray</span>
                )}
            </div>

            {/* Component count */}
            <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-md bg-slate-900/80 border border-slate-700 text-xs">
                <span className="text-slate-500">Components: </span>
                <span className="text-cyan-400 font-mono">{placedComponents.length}</span>
                <span className="text-slate-600 mx-2">|</span>
                <span className="text-slate-500">Wires: </span>
                <span className="text-emerald-400 font-mono">{wires.length}</span>
            </div>
        </div>
    );
};

function getComponentColor(type: string): string {
    switch (type) {
        case 'RESISTOR': return '#f97316';
        case 'DC_BATTERY': return '#22c55e';
        case 'DIODE': return '#ef4444';
        case 'CAPACITOR': return '#3b82f6';
        case 'AC_SOURCE': return '#a855f7';
        case 'AMMETER': return '#eab308';
        default: return '#64748b';
    }
}

function getComponentUnit(type: string): string {
    switch (type) {
        case 'RESISTOR': return 'Ω';
        case 'DC_BATTERY':
        case 'AC_SOURCE': return 'V';
        case 'CAPACITOR': return 'µF';
        default: return '';
    }
}

