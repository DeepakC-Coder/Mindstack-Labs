import React from 'react';
import type { Component } from '@/pages/circuit-lab/engine/types';
import { Zap, CircuitBoard } from 'lucide-react';

interface ControlPanelProps {
    components: Component[];
    onUpdateValue: (id: string, value: number) => void;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onGenerateNew: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    components,
    onUpdateValue,
    selectedId,
    onSelect,
    onGenerateNew
}) => {
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                        <CircuitBoard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Circuit Builder</h2>
                        <p className="text-xs text-slate-500">Configure component values</p>
                    </div>
                </div>

                <button
                    onClick={onGenerateNew}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-white
            bg-gradient-to-r from-purple-600 to-cyan-600 
            hover:from-purple-500 hover:to-cyan-500
            transform hover:scale-[1.02] active:scale-[0.98]
            transition-all duration-200 ease-out
            shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
            flex items-center justify-center gap-2"
                >
                    <Zap className="w-4 h-4" />
                    Generate New Circuit
                </button>
            </div>

            {/* Components List */}
            <div className="flex-1 overflow-auto">
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Components</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                </div>

                <div className="space-y-3">
                    {components.map(comp => {
                        const isSelected = selectedId === comp.id;
                        const isVoltage = comp.type === 'VOLTAGE_SOURCE';

                        return (
                            <div
                                key={comp.id}
                                onClick={() => onSelect(comp.id)}
                                className={`
                  relative p-4 rounded-xl cursor-pointer transition-all duration-200
                  ${isSelected
                                        ? 'bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/10'
                                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80'}
                  border
                `}
                            >
                                {/* LED indicator */}
                                <div className={`absolute top-3 right-3 led-indicator ${isSelected ? 'led-green' : ''}`}
                                    style={{ background: isSelected ? '#22c55e' : '#334155' }}
                                />

                                {/* Component info */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                    ${isVoltage
                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}
                                    >
                                        {comp.name}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-200">
                                            {isVoltage ? 'Voltage Source' : 'Resistor'}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {isVoltage ? 'DC Power Supply' : 'Carbon Film'}
                                        </div>
                                    </div>
                                </div>

                                {/* Value control */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Value</span>
                                        <div className="meter-display px-3 py-1">
                                            <span className={`text-sm font-mono font-bold ${isVoltage ? 'text-yellow-400' : 'text-orange-400'}`}>
                                                {comp.value}{isVoltage ? 'V' : 'Ω'}
                                            </span>
                                        </div>
                                    </div>

                                    <input
                                        type="range"
                                        min={isVoltage ? 5 : 10}
                                        max={isVoltage ? 50 : 100}
                                        step={isVoltage ? 5 : 10}
                                        value={comp.value}
                                        onChange={(e) => onUpdateValue(comp.id, parseInt(e.target.value))}
                                        className="w-full h-2"
                                        onClick={(e) => e.stopPropagation()}
                                    />

                                    <div className="flex justify-between text-[10px] text-slate-600">
                                        <span>{isVoltage ? '5V' : '10Ω'}</span>
                                        <span>{isVoltage ? '50V' : '100Ω'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer info */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Total Components</span>
                    <span className="font-mono text-slate-400">{components.length}</span>
                </div>
            </div>
        </div>
    );
};
