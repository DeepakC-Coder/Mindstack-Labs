import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/pages/circuit-lab/Layout/MainLayout';
import { ControlPanel } from '@/pages/circuit-lab/Controls/ControlPanel';
import { ResultsPanel } from '@/pages/circuit-lab/Controls/ResultsPanel';
import { CircuitCanvas } from '@/pages/circuit-lab/Circuit/CircuitCanvas';
import { ComponentTray } from '@/pages/circuit-lab/Builder/ComponentTray';
import { CircuitBuilderCanvas } from '@/pages/circuit-lab/Builder/CircuitBuilderCanvas';
import { BuilderResultsPanel } from '@/pages/circuit-lab/Builder/BuilderResultsPanel';
import { generateTwoMeshCircuit } from '@/pages/circuit-lab/engine/generator';
import { solveCircuit } from '@/pages/circuit-lab/engine/solver';
import { parseCircuit } from '@/pages/circuit-lab/engine/circuit-parser';
import type { CircuitState, AppMode, PlaceableComponent, CircuitNode, Component, Wire, CircuitReport, AnalysisResult } from '@/pages/circuit-lab/engine/types';
import './circuit-lab/circuit-styles.css';

const Circuit = () => {
    const [mode, setMode] = useState<AppMode>('mesh');
    const [circuit, setCircuit] = useState<CircuitState | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Builder mode state
    const [selectedComponent, setSelectedComponent] = useState<PlaceableComponent | null>(null);
    const [builderNodes, setBuilderNodes] = useState<CircuitNode[]>([]);
    const [builderComponents, setBuilderComponents] = useState<Component[]>([]);
    const [builderWires, setBuilderWires] = useState<Wire[]>([]);
    const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
    const [isWireMode, setIsWireMode] = useState(false);
    const [circuitReport, setCircuitReport] = useState<CircuitReport | null>(null);
    const [analysisResultState, setAnalysisResultState] = useState<AnalysisResult | null>(null);

    useEffect(() => {
        handleNewCircuit();
    }, []);

    // Set wire mode when Wire component is selected
    useEffect(() => {
        if (selectedComponent?.type === 'WIRE') {
            setIsWireMode(true);
        }
    }, [selectedComponent]);

    const handleNewCircuit = () => {
        const newCircuit = generateTwoMeshCircuit();
        setCircuit(newCircuit);
        setSelectedId(null);
    };

    const handleUpdateValue = (id: string, value: number) => {
        if (!circuit) return;

        const newComponents = circuit.components.map(c => {
            if (c.id === id) return { ...c, value };
            return c;
        });

        setCircuit({ ...circuit, components: newComponents });
    };

    // Builder mode handlers
    const handlePlaceComponent = useCallback((node: CircuitNode, component: PlaceableComponent) => {
        const GRID_SIZE = 40;

        // Components start horizontal (0 deg)
        // Terminal 1 (Left)
        const t1 = { x: node.x - GRID_SIZE, y: node.y };
        const t1Id = `node-${t1.x}-${t1.y}`;
        const node1: CircuitNode = { id: t1Id, x: t1.x, y: t1.y };

        // Terminal 2 (Right)
        const t2 = { x: node.x + GRID_SIZE, y: node.y };
        const t2Id = `node-${t2.x}-${t2.y}`;
        const node2: CircuitNode = { id: t2Id, x: t2.x, y: t2.y };

        // Add nodes
        setBuilderNodes(prev => {
            const next = [...prev];
            if (!next.find(n => n.id === node1.id)) next.push(node1);
            if (!next.find(n => n.id === node2.id)) next.push(node2);
            if (!next.find(n => n.id === node.id)) next.push(node);
            return next;
        });

        const newComponent: Component = {
            id: `comp-${Date.now()}`,
            type: component.type,
            value: component.defaultValue,
            node1Id: node1.id,
            node2Id: node2.id,
            name: `${component.name.charAt(0)}${builderComponents.filter(c => c.type === component.type).length + 1}`,
            center: { x: node.x, y: node.y },
            orientation: 0 as 0 | 90 | 180 | 270
        };

        setBuilderComponents(prev => [...prev, newComponent]);
        setSelectedComponent(null);
        setSelectedBuilderId(newComponent.id);
    }, [builderComponents]);

    const handleAddWire = useCallback((startNode: CircuitNode, endNode: CircuitNode) => {
        const newWire: Wire = {
            id: `wire-${Date.now()}`,
            startNode,
            endNode
        };

        // Add nodes if not exist
        if (!builderNodes.find(n => n.id === startNode.id)) {
            setBuilderNodes(prev => [...prev, startNode]);
        }
        if (!builderNodes.find(n => n.id === endNode.id)) {
            setBuilderNodes(prev => [...prev, endNode]);
        }

        setBuilderWires(prev => [...prev, newWire]);
        setCircuitReport(null); // Clear report when circuit changes
    }, [builderNodes]);

    const handleCancelWireMode = useCallback(() => {
        setIsWireMode(false);
        setSelectedComponent(null);
    }, []);

    const handleUpdateBuilderValue = useCallback((id: string, value: number) => {
        setBuilderComponents(prev => prev.map(c =>
            c.id === id ? { ...c, value } : c
        ));
    }, []);

    const handleDeleteComponent = useCallback((id: string) => {
        setBuilderComponents(prev => prev.filter(c => c.id !== id));
        if (selectedBuilderId === id) setSelectedBuilderId(null);
        setCircuitReport(null);
    }, [selectedBuilderId]);

    const handleRotateComponent = useCallback((id: string) => {
        setBuilderComponents(prev => {
            const comp = prev.find(c => c.id === id);
            if (!comp || !comp.center) return prev;

            const currentOrient = comp.orientation || 0;
            const nextOrient = ((currentOrient + 90) % 360) as 0 | 90 | 180 | 270;

            const GRID_SIZE = 40;
            let t1, t2;

            switch (nextOrient) {
                case 0:
                    t1 = { x: comp.center.x - GRID_SIZE, y: comp.center.y };
                    t2 = { x: comp.center.x + GRID_SIZE, y: comp.center.y };
                    break;
                case 90:
                    t1 = { x: comp.center.x, y: comp.center.y - GRID_SIZE };
                    t2 = { x: comp.center.x, y: comp.center.y + GRID_SIZE };
                    break;
                case 180:
                    t1 = { x: comp.center.x + GRID_SIZE, y: comp.center.y };
                    t2 = { x: comp.center.x - GRID_SIZE, y: comp.center.y };
                    break;
                case 270:
                    t1 = { x: comp.center.x, y: comp.center.y + GRID_SIZE };
                    t2 = { x: comp.center.x, y: comp.center.y - GRID_SIZE };
                    break;
                default:
                    t1 = { x: comp.center.x - GRID_SIZE, y: comp.center.y };
                    t2 = { x: comp.center.x + GRID_SIZE, y: comp.center.y };
            }

            const t1Id = `node-${t1.x}-${t1.y}`;
            const t2Id = `node-${t2.x}-${t2.y}`;

            setBuilderNodes(currentNodes => {
                const next = [...currentNodes];
                if (!next.find(n => n.id === t1Id)) next.push({ id: t1Id, x: t1.x, y: t1.y });
                if (!next.find(n => n.id === t2Id)) next.push({ id: t2Id, x: t2.x, y: t2.y });
                return next;
            });

            return prev.map(c =>
                c.id === id ? { ...c, node1Id: t1Id, node2Id: t2Id, orientation: nextOrient } : c
            );
        });
    }, []);

    // Check circuit and generate report
    const handleCheckCircuit = useCallback(() => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for voltage source
        const hasVoltageSource = builderComponents.some(c =>
            c.type === 'DC_BATTERY' || c.type === 'AC_SOURCE' || c.type === 'VOLTAGE_SOURCE'
        );
        if (!hasVoltageSource) {
            issues.push('No voltage source found');
            suggestions.push('Add a DC Battery or AC Source to power the circuit');
        }

        // Check for components
        if (builderComponents.length === 0) {
            issues.push('No components placed');
            suggestions.push('Add resistors, batteries, or other components');
        }

        // Check for wires
        if (builderWires.length === 0) {
            issues.push('No wire connections');
            suggestions.push('Connect components using wires');
        }

        // Check for potential closed loop (simplified check)
        const hasEnoughConnections = builderWires.length >= builderComponents.length;
        const hasClosedLoop = hasEnoughConnections && hasVoltageSource;

        if (!hasClosedLoop && builderComponents.length > 0) {
            issues.push('Circuit may not form a closed loop');
            suggestions.push('Ensure all components are connected in a complete path');
        }

        // Check for load (resistor)
        const hasResistor = builderComponents.some(c => c.type === 'RESISTOR');
        const hasAmmeter = builderComponents.some(c => c.type === 'AMMETER');

        if (hasVoltageSource && !hasResistor && !hasAmmeter) {
            issues.push('No load resistor or ammeter');
            suggestions.push('Add a resistor to prevent short circuit');
        }

        const isValid = issues.length === 0;

        let analysisResults: AnalysisResult | null = null;
        const computedReport: CircuitReport = {
            isValid,
            hasVoltageSource,
            hasClosedLoop,
            componentCount: builderComponents.length,
            wireCount: builderWires.length,
            issues,
            suggestions
        };

        if (isValid && hasClosedLoop) {
            try {
                const circuitState = parseCircuit(builderComponents, builderWires);

                if (circuitState.loops.length === 0 && builderComponents.length > 0) {
                    computedReport.issues.push('No complete loops detected');
                    computedReport.suggestions.push('Ensure wires explicitly connect to component endpoints');
                    computedReport.isValid = false;
                } else {
                    const results = solveCircuit(circuitState);
                    if (results.isSolvable) {
                        analysisResults = results;
                    } else {
                        computedReport.issues.push('Circuit is unsolvable');
                        computedReport.isValid = false;
                    }
                }
            } catch (e) {
                console.error('Analysis failed', e);
                computedReport.issues.push('Analysis error occurred');
                computedReport.isValid = false;
            }
        }

        setCircuitReport(computedReport);
        setAnalysisResultState(analysisResults);
    }, [builderComponents, builderWires]);

    // Auto-check circuit on change
    useEffect(() => {
        if (mode === 'builder') {
            handleCheckCircuit();
        }
    }, [builderComponents, builderWires, mode, handleCheckCircuit]);

    // Clear circuit
    const handleClearCircuit = useCallback(() => {
        setBuilderComponents([]);
        setBuilderWires([]);
        setBuilderNodes([]);
        setCircuitReport(null);
        setSelectedBuilderId(null);
    }, []);

    const analysis = useMemo(() => {
        if (!circuit) return null;
        return solveCircuit(circuit);
    }, [circuit]);

    if (!circuit || !analysis) {
        return (
            <div className="lab-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center animate-pulse">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Initializing Lab</h2>
                    <p className="text-sm text-slate-500">Setting up circuit simulation...</p>
                </div>
            </div>
        );
    }

    return (
        <MainLayout
            mode={mode}
            onModeChange={setMode}
            leftPanel={
                mode === 'mesh' ? (
                    <ControlPanel
                        components={circuit.components}
                        selectedId={selectedId}
                        onUpdateValue={handleUpdateValue}
                        onSelect={setSelectedId}
                        onGenerateNew={handleNewCircuit}
                    />
                ) : (
                    <ComponentTray
                        selectedComponent={selectedComponent}
                        onSelectComponent={setSelectedComponent}
                        onCheckCircuit={handleCheckCircuit}
                        onClearCircuit={handleClearCircuit}
                        componentCount={builderComponents.length}
                        wireCount={builderWires.length}
                    />
                )
            }
            centerPanel={
                mode === 'mesh' ? (
                    <CircuitCanvas
                        circuit={circuit}
                        analysis={analysis}
                        selectedComponentId={selectedId}
                        onSelectComponent={setSelectedId}
                    />
                ) : (
                    <CircuitBuilderCanvas
                        selectedComponent={selectedComponent}
                        placedComponents={builderComponents.map(c => ({
                            ...c,
                            current: analysisResultState?.branchCurrents[c.id]
                        }))}
                        nodes={builderNodes}
                        wires={builderWires}
                        onPlaceComponent={handlePlaceComponent}
                        onAddWire={handleAddWire}
                        onSelectPlacedComponent={setSelectedBuilderId}
                        selectedPlacedId={selectedBuilderId}
                        isWireMode={isWireMode}
                        onCancelWireMode={handleCancelWireMode}
                        onDelete={handleDeleteComponent}
                        onRotate={handleRotateComponent}
                        analysis={analysisResultState}
                    />
                )
            }
            rightPanel={
                mode === 'mesh' ? (
                    <ResultsPanel
                        analysis={analysis}
                        loops={circuit.loops}
                        components={circuit.components}
                    />
                ) : (
                    <BuilderResultsPanel
                        placedComponents={builderComponents}
                        analysis={analysisResultState}
                        selectedComponentId={selectedBuilderId}
                        onUpdateValue={handleUpdateBuilderValue}
                        circuitReport={circuitReport}
                    />
                )
            }
        />
    );
}

export default Circuit;
