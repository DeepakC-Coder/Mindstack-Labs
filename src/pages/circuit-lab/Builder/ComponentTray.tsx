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
        <div className="h-full flex flex-col font-sans">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-xl">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Workbench</h2>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Toolkit System</p>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="mb-6 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 shadow-inner">
                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-widest font-black">
                    <div className="flex flex-col gap-1">
                        <span className="text-white/30">Elements</span>
                        <span className="text-white text-lg font-mono tracking-normal">{componentCount}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-white/30">Connections</span>
                        <span className="text-white text-lg font-mono tracking-normal">{wireCount}</span>
                    </div>
                </div>
            </div>

            {/* Component Grid */}
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3 pb-6">
                    {AVAILABLE_COMPONENTS.map((comp) => {
                        const isSelected = selectedComponent?.type === comp.type;
                        const isWire = comp.type === 'WIRE';
                        return (
                            <button
                                key={comp.type}
                                onClick={() => onSelectComponent(comp)}
                                className={`relative p-5 rounded-2xl transition-all duration-500 border group flex flex-col items-center text-center
                                    ${isSelected
                                        ? 'bg-white text-black border-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] scale-105 z-10'
                                        : 'bg-black/20 border-white/5 text-white hover:bg-white/5 hover:border-white/20'
                                    }
                                `}
                            >
                                {/* Icon */}
                                <div
                                    className={`w-14 h-14 mb-4 rounded-xl flex items-center justify-center transition-all duration-500
                                        ${isSelected ? 'bg-black/5' : 'bg-white/5 border border-white/10'}
                                    `}
                                >
                                    <ComponentIcon
                                        type={comp.icon}
                                        className="w-7 h-7"
                                        style={{ color: isSelected ? 'black' : comp.color } as React.CSSProperties}
                                    />
                                </div>

                                {/* Name */}
                                <div className={`text-xs font-black uppercase tracking-tight mb-1 ${isSelected ? 'text-black' : 'text-white'}`}>
                                    {comp.name}
                                </div>

                                {/* Description */}
                                <div className={`text-[9px] uppercase tracking-tighter font-bold transition-colors ${isSelected ? 'text-black/60' : 'text-white/30'}`}>
                                    {comp.description}
                                </div>

                                {/* Selected indicator */}
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-lg animate-bounce" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
                <button
                    onClick={onCheckCircuit}
                    disabled={componentCount === 0}
                    className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl
                        ${componentCount > 0
                            ? 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-white/10'
                            : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed uppercase'
                        }
                    `}
                >
                    <CheckCircle className="w-5 h-5" />
                    Verify System
                </button>

                <button
                    onClick={onClearCircuit}
                    disabled={componentCount === 0 && wireCount === 0}
                    className={`w-full py-3 px-6 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all duration-500 flex items-center justify-center gap-3
                        ${componentCount > 0 || wireCount > 0
                            ? 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white'
                            : 'hidden'
                        }
                    `}
                >
                    <Trash2 className="w-4 h-4" />
                    Reset Workspace
                </button>
            </div>
        </div>
    );
};

