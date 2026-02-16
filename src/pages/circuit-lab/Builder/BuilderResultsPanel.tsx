import React from 'react';
import type { Component, AnalysisResult, CircuitReport } from '@/pages/circuit-lab/engine/types';
import { Activity, Zap, CircuitBoard, CheckCircle, AlertTriangle, XCircle, Lightbulb } from 'lucide-react';
import { CircuitAIChat } from './CircuitAIChat';

interface BuilderResultsPanelProps {
    placedComponents: Component[];
    analysis: AnalysisResult | null;
    selectedComponentId: string | null;
    onUpdateValue: (id: string, value: number) => void;
    circuitReport: CircuitReport | null;
}

export const BuilderResultsPanel: React.FC<BuilderResultsPanelProps> = ({
    placedComponents,
    analysis,
    selectedComponentId,
    onUpdateValue,
    circuitReport
}) => {
    const selectedComponent = placedComponents.find(c => c.id === selectedComponentId);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Circuit Analysis</h2>
                        <p className="text-xs text-slate-500">Real-time calculations</p>
                    </div>
                </div>
            </div>

            {/* Circuit Report */}
            {circuitReport && (
                <div className={`mb-6 p-4 rounded-xl border ${circuitReport.isValid
                    ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30'
                    : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30'
                    }`}>
                    <div className="flex items-center gap-2 mb-3">
                        {circuitReport.isValid ? (
                            <>
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                <span className="font-semibold text-emerald-400">Circuit Valid!</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                <span className="font-semibold text-amber-400">Issues Found</span>
                            </>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                            <span className="text-xs text-slate-500">Components</span>
                            <span className="text-sm font-mono text-cyan-400">{circuitReport.componentCount}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                            <span className="text-xs text-slate-500">Wires</span>
                            <span className="text-sm font-mono text-emerald-400">{circuitReport.wireCount}</span>
                        </div>
                    </div>

                    {/* Issues */}
                    {circuitReport.issues.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Issues
                            </div>
                            <div className="space-y-1">
                                {circuitReport.issues.map((issue, i) => (
                                    <div key={i} className="text-xs text-slate-400 pl-4 border-l-2 border-red-500/50">
                                        {issue}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {circuitReport.suggestions.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3" /> Suggestions
                            </div>
                            <div className="space-y-1">
                                {circuitReport.suggestions.map((suggestion, i) => (
                                    <div key={i} className="text-xs text-slate-400 pl-4 border-l-2 border-yellow-500/50">
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Selected Component Editor */}
            {selectedComponent && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/30">
                    <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                        <CircuitBoard className="w-4 h-4" />
                        Edit Component
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">{selectedComponent.name}</span>
                            <span className="text-xs text-slate-600">{selectedComponent.type}</span>
                        </div>

                        {selectedComponent.type === 'AMMETER' ? (
                            <div className="text-xs text-slate-500 italic">
                                Read-only component. Displays current flow.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Value</span>
                                    <div className="meter-display px-3 py-1">
                                        <span className="text-sm font-mono font-bold text-cyan-400">
                                            {selectedComponent.value}{getUnit(selectedComponent.type)}
                                        </span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={getMinValue(selectedComponent.type)}
                                    max={getMaxValue(selectedComponent.type)}
                                    step={getStep(selectedComponent.type)}
                                    value={selectedComponent.value}
                                    onChange={(e) => onUpdateValue(selectedComponent.id, parseFloat(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span>{getMinValue(selectedComponent.type)}{getUnit(selectedComponent.type)}</span>
                                    <span>{getMaxValue(selectedComponent.type)}{getUnit(selectedComponent.type)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Analysis Results - Compact scrollable area */}
            <div className="flex-1 overflow-auto min-h-0 max-h-[200px]">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Results</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                </div>

                {analysis && analysis.isSolvable ? (
                    <div className="space-y-4">
                        {/* Branch Currents */}
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Branch Currents
                            </h4>
                            <div className="space-y-2">
                                {Object.entries(analysis.branchCurrents).map(([id, current]) => {
                                    const comp = placedComponents.find(c => c.id === id);
                                    if (!comp) return null;
                                    return (
                                        <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                                            <span className="text-sm text-slate-400">{comp.name}</span>
                                            <span className="text-sm font-mono text-cyan-400">{current.toFixed(4)} A</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Power Consumption */}
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <h4 className="text-sm font-semibold text-yellow-400 mb-3">⚡ Power</h4>
                            {placedComponents.filter(c => c.type === 'RESISTOR').map(comp => {
                                const current = analysis.branchCurrents[comp.id] || 0;
                                const power = current * current * comp.value;
                                return (
                                    <div key={comp.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 mb-2">
                                        <span className="text-sm text-slate-400">{comp.name}</span>
                                        <span className="text-sm font-mono text-yellow-400">{power.toFixed(4)} W</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-800/50 flex items-center justify-center">
                            <CircuitBoard className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-500">
                            {placedComponents.length === 0
                                ? 'Place components to see analysis'
                                : 'Circuit is processing in real-time...'
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Component Summary */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">Total Components</span>
                        <span className="font-mono text-slate-400">{placedComponents.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">Status</span>
                        <span className={`font-mono ${circuitReport?.isValid ? 'text-green-400' : analysis?.isSolvable ? 'text-green-400' : 'text-yellow-400'}`}>
                            {circuitReport?.isValid ? 'Valid' : circuitReport ? 'Issues' : 'Pending'}
                        </span>
                    </div>
                </div>
            </div>

            {/* AI Chat Section */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <CircuitAIChat
                    placedComponents={placedComponents}
                    analysis={analysis}
                    circuitReport={circuitReport}
                />
            </div>
        </div>
    );
};

function getUnit(type: string): string {
    switch (type) {
        case 'RESISTOR': return 'Ω';
        case 'DC_BATTERY':
        case 'VOLTAGE_SOURCE':
        case 'AC_SOURCE': return 'V';
        case 'CAPACITOR': return 'µF';
        case 'DIODE': return 'V';
        default: return '';
    }
}

function getMinValue(type: string): number {
    switch (type) {
        case 'RESISTOR': return 0;
        case 'DC_BATTERY':
        case 'VOLTAGE_SOURCE': return 0;
        case 'AC_SOURCE': return 0;
        case 'CAPACITOR': return 1;
        case 'DIODE': return 0.3;
        default: return 0;
    }
}

function getMaxValue(type: string): number {
    switch (type) {
        case 'RESISTOR': return 2400;
        case 'DC_BATTERY':
        case 'VOLTAGE_SOURCE': return 2400;
        case 'AC_SOURCE': return 2400;
        case 'CAPACITOR': return 10000;
        case 'DIODE': return 1.0;
        default: return 100;
    }
}

function getStep(type: string): number {
    switch (type) {
        case 'RESISTOR': return 10;
        case 'DC_BATTERY':
        case 'VOLTAGE_SOURCE': return 1;
        case 'AC_SOURCE': return 5;
        case 'CAPACITOR': return 10;
        case 'DIODE': return 0.1;
        default: return 1;
    }
}

