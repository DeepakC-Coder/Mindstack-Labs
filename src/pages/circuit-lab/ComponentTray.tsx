import React from 'react';
import type { PlaceableComponent } from '@/pages/circuit-lab/engine/types';
import { Zap, Circle, Battery, Waves, Box, CheckCircle, Trash2, Gauge } from 'lucide-react';

interface ComponentTrayProps {
    onSelectComponent: (component: PlaceableComponent) => void;
    selectedComponent: PlaceableComponent | null;
    onCheckCircuit: () => void;
    onClearCircuit: () => void;
    componentCount: number;
    wireCount: number;
}

const AVAILABLE_COMPONENTS: PlaceableComponent[] = [
    {
        type: 'RESISTOR',
        name: 'Resistor',
        description: 'Variable resistance',
        icon: 'resistor',
        defaultValue: 100,
        unit: 'Ω',
        minValue: 10,
        maxValue: 100000,
        color: '#f97316'
    },
    {
        type: 'DC_BATTERY',
        name: 'DC Battery',
        description: 'DC voltage source',
        icon: 'battery',
        defaultValue: 12,
        unit: 'V',
        minValue: 1,
        maxValue: 50,
        color: '#22c55e'
    },
    {
        type: 'DIODE',
        name: 'Diode',
        description: 'One-way current flow',
        icon: 'diode',
        defaultValue: 0.7,
        unit: 'V',
        minValue: 0.3,
        maxValue: 1.0,
        color: '#ef4444'
    },
    {
        type: 'CAPACITOR',
        name: 'Capacitor',
        description: 'Energy storage',
        icon: 'capacitor',
        defaultValue: 100,
        unit: 'µF',
        minValue: 1,
        maxValue: 10000,
        color: '#3b82f6'
    },
    {
        type: 'AC_SOURCE',
        name: 'AC Source',
        description: 'Alternating current',
        icon: 'ac',
        defaultValue: 220,
        unit: 'V',
        minValue: 5,
        maxValue: 440,
        color: '#a855f7'
    },
    {
        type: 'AMMETER',
        name: 'Ammeter',
        description: 'Measures current',
        icon: 'ammeter',
        defaultValue: 0,
        unit: 'A',
        minValue: 0,
        maxValue: 10,
        color: '#eab308'
    },
    {
        type: 'WIRE',
        name: 'Wire',
        description: 'Connect components',
        icon: 'wire',
        defaultValue: 0,
        unit: '',
        minValue: 0,
        maxValue: 0,
        color: '#64748b'
    }
];

const ComponentIcon: React.FC<{ type: string; className?: string; style?: React.CSSProperties }> = ({ type, className, style }) => {
    switch (type) {
        case 'battery':
            return <Battery className={className} style={style} />;
        case 'ac':
            return <Waves className={className} style={style} />;
        case 'diode':
            return <Zap className={className} style={style} />;
        case 'capacitor':
            return <Box className={className} style={style} />;
        case 'ammeter':
            return <Gauge className={className} style={style} />;
        default:
            return <Circle className={className} style={style} />;
    }
};

export const ComponentTray: React.FC<ComponentTrayProps> = ({
    onSelectComponent,
    selectedComponent,
    onCheckCircuit,
    onClearCircuit,
    componentCount,
    wireCount
}) => {
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Component Tray</h2>
                        <p className="text-xs text-slate-500">Click to select, then place on canvas</p>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Components</span>
                        <span className="font-mono text-cyan-400">{componentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Wires</span>
                        <span className="font-mono text-emerald-400">{wireCount}</span>
                    </div>
                </div>
            </div>

            {/* Component Grid */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_COMPONENTS.map((comp) => {
                        const isSelected = selectedComponent?.type === comp.type;
                        const isWire = comp.type === 'WIRE';
                        return (
                            <button
                                key={comp.type}
                                onClick={() => onSelectComponent(comp)}
                                className={`relative p-4 rounded-xl transition-all duration-300 border group
                                    ${isSelected
                                        ? 'bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-105'
                                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/50 hover:scale-102'
                                    }
                                `}
                            >
                                {/* Glow effect on hover */}
                                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                                    style={{
                                        background: `radial-gradient(circle at center, ${comp.color}15 0%, transparent 70%)`
                                    }}
                                />

                                {/* Icon */}
                                <div
                                    className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center transition-all duration-300"
                                    style={{
                                        backgroundColor: `${comp.color}20`,
                                        borderColor: `${comp.color}40`,
                                        borderWidth: '1px',
                                        boxShadow: isSelected ? `0 0 20px ${comp.color}40` : 'none'
                                    }}
                                >
                                    <ComponentIcon type={comp.icon} className="w-6 h-6" style={{ color: comp.color } as React.CSSProperties} />
                                </div>

                                {/* Name */}
                                <div className="text-sm font-medium text-white mb-1">{comp.name}</div>

                                {/* Description */}
                                <div className="text-xs text-slate-500">{comp.description}</div>

                                {/* Value badge */}
                                {comp.defaultValue > 0 && (
                                    <div className="mt-2 px-2 py-1 rounded-md bg-slate-900/60 inline-block">
                                        <span className="text-xs font-mono" style={{ color: comp.color }}>
                                            {comp.defaultValue}{comp.unit}
                                        </span>
                                    </div>
                                )}

                                {/* Wire mode indicator */}
                                {isWire && isSelected && (
                                    <div className="mt-2 px-2 py-1 rounded-md bg-cyan-500/20 inline-block">
                                        <span className="text-xs text-cyan-400">Wire Mode</span>
                                    </div>
                                )}

                                {/* Selected indicator */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                {/* Check Circuit Button */}
                <button
                    onClick={onCheckCircuit}
                    disabled={componentCount === 0}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2
                        ${componentCount > 0
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-102'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }
                    `}
                >
                    <CheckCircle className="w-5 h-5" />
                    Check Circuit
                </button>

                {/* Clear Button */}
                <button
                    onClick={onClearCircuit}
                    disabled={componentCount === 0 && wireCount === 0}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2
                        ${componentCount > 0 || wireCount > 0
                            ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                            : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        }
                    `}
                >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                </button>

                {/* Instructions */}
                <div className="text-xs text-slate-600 text-center">
                    {selectedComponent ? (
                        selectedComponent.type === 'WIRE' ? (
                            <span className="text-cyan-400">
                                🔌 Click start point, then end point
                            </span>
                        ) : (
                            <span className="text-cyan-400">
                                ✓ {selectedComponent.name} selected - Click canvas to place
                            </span>
                        )
                    ) : (
                        <span>Select a component to begin building</span>
                    )}
                </div>
            </div>
        </div>
    );
};

