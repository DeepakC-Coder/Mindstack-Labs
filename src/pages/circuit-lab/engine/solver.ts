import type { CircuitState, AnalysisResult } from './types';

/**
 * Solves a system of linear equations Ax = B using Gaussian Elimination
 */
function solveLinearSystem(A: number[][], B: number[]): number[] | null {
    const n = A.length;
    // Deep copy to avoid mutating inputs
    const Mat = A.map(row => [...row]);
    const Const = [...B];

    for (let i = 0; i < n; i++) {
        // Find pivot
        let pivot = i;
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(Mat[j][i]) > Math.abs(Mat[pivot][i])) {
                pivot = j;
            }
        }

        // Singular matrix check
        if (Math.abs(Mat[pivot][i]) < 1e-10) return null;

        // Swap rows
        [Mat[i], Mat[pivot]] = [Mat[pivot], Mat[i]];
        [Const[i], Const[pivot]] = [Const[pivot], Const[i]];

        // Eliminate
        for (let j = i + 1; j < n; j++) {
            const factor = Mat[j][i] / Mat[i][i];
            Const[j] -= factor * Const[i];
            for (let k = i; k < n; k++) {
                Mat[j][k] -= factor * Mat[i][k];
            }
        }
    }

    // Back substitution
    const X = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += Mat[i][j] * X[j];
        }
        X[i] = (Const[i] - sum) / Mat[i][i];
    }

    return X;
}

export function solveCircuit(circuit: CircuitState): AnalysisResult {
    const { loops, components } = circuit;
    const nLoops = loops.length;

    if (nLoops === 0) {
        return {
            loopCurrents: {},
            branchCurrents: {},
            nodeVoltages: {},
            isSolvable: true
        };
    }

    // Iterative State Solver for non-linear components (Diodes)
    const diodeStates = new Map<string, 'CONDUCTING' | 'BLOCKING'>();
    components.filter(c => c.type === 'DIODE').forEach(c => diodeStates.set(c.id, 'CONDUCTING'));

    let currents: number[] | null = null;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
        const RMatrix: number[][] = Array(nLoops).fill(0).map(() => Array(nLoops).fill(0));
        const VVector: number[] = Array(nLoops).fill(0);
        const compMap = new Map(components.map(c => [c.id, c]));

        loops.forEach((loopI, i) => {
            let selfResistance = 0;
            let loopVoltage = 0;

            loopI.componentIds.forEach((compId, idx) => {
                const comp = compMap.get(compId);
                if (!comp) return;
                const direction = loopI.direction[idx]; // +1 if traversal is node1->node2

                if (comp.type === 'RESISTOR') {
                    selfResistance += comp.value;
                } else if (comp.type === 'AMMETER') {
                    selfResistance += 0.001;
                } else if (comp.type === 'DIODE') {
                    const state = diodeStates.get(comp.id);
                    if (state === 'BLOCKING') {
                        selfResistance += 1e9; // Open circuit
                    } else {
                        selfResistance += 0.1; // Forward resistance
                        // 0.7V drop opposing the forward flow
                        // Forward direction is node1 -> node2. 
                        // If loop traverses forward (dir=1), drop is -0.7V (LHS) -> moves to RHS as -0.7?
                        // Actually: Sum V_sources = Sum I*R. 
                        // A drop is a negative source. 
                        // Traverse node1 -> node2: drop 0.7V. Term is -0.7 on voltage source side.
                        loopVoltage -= (direction * 0.7);
                    }
                } else if (comp.type === 'VOLTAGE_SOURCE' || comp.type === 'DC_BATTERY') {
                    loopVoltage += (direction * comp.value);
                }
            });
            RMatrix[i][i] = selfResistance;
            VVector[i] = loopVoltage;

            loops.forEach((loopJ, j) => {
                if (i === j) return;
                let mutualResistance = 0;
                const shared = loopI.componentIds.filter(id => loopJ.componentIds.includes(id));

                shared.forEach(compId => {
                    const comp = compMap.get(compId);
                    if (!comp) return;
                    if (comp.type === 'RESISTOR' || comp.type === 'AMMETER' || comp.type === 'DIODE') {
                        const idxI = loopI.componentIds.indexOf(compId);
                        const dirI = loopI.direction[idxI];
                        const idxJ = loopJ.componentIds.indexOf(compId);
                        const dirJ = loopJ.direction[idxJ];

                        let rVal = 0;
                        if (comp.type === 'DIODE') {
                            rVal = diodeStates.get(comp.id) === 'BLOCKING' ? 1e9 : 0.1;
                        } else {
                            rVal = comp.type === 'AMMETER' ? 0.001 : comp.value;
                        }

                        if (dirI === dirJ) mutualResistance += rVal;
                        else mutualResistance -= rVal;
                    }
                });
                RMatrix[i][j] = mutualResistance;
            });
        });

        currents = solveLinearSystem(RMatrix, VVector);
        if (!currents) break;

        // Check for state changes
        let changed = false;
        diodeStates.forEach((state, id) => {
            const comp = compMap.get(id)!;
            // Calculate branch current for this diode (Forward is node1 -> node2)
            let iBranch = 0;
            loops.forEach((loop, lIdx) => {
                const cIdx = loop.componentIds.indexOf(id);
                if (cIdx !== -1) {
                    iBranch += loop.direction[cIdx] * (currents![lIdx] || 0);
                }
            });

            if (state === 'CONDUCTING' && iBranch <= 0) {
                // If current tries to flow backwards or is zero, check if it's below knee
                // In mesh analysis, if it's CONDUCTING and iBranch <= 0, it means the bias is reversed.
                diodeStates.set(id, 'BLOCKING');
                changed = true;
            } else if (state === 'BLOCKING') {
                // Calculate voltage across open diode
                // In Mesh analysis, we can find V_oc by KVL around the blocked loop
                // For now, simple check: if we switch back to CONDUCTING, 
                // does the logic stabilize?
                // Alternatively, assume threshold logic check:
                // We'll temporarily treat it as conducting to check if it WOULD conduct > 0.7V
                // This is a common iterative simplification.

                // For this simulation, we check if external voltage > 0.7V
                // Simpler: Just try CONDUCTING next iteration and see if it sticks.
                // If it switches back and forth, we limit iterations.
                diodeStates.set(id, 'CONDUCTING');
                changed = true;
            }
        });

        if (!changed) break;
        iterations++;
    }

    if (!currents) {
        return {
            loopCurrents: {},
            branchCurrents: {},
            nodeVoltages: {},
            isSolvable: false
        };
    }

    const loopCurrentsMap: Record<string, number> = {};
    loops.forEach((l, i) => {
        loopCurrentsMap[l.id] = currents[i];
    });

    // Calculate Branch Currents
    // I_branch = Sum(Direction * I_loop) for all loops passing through
    const branchCurrentsMap: Record<string, number> = {};

    components.forEach(comp => {
        let iBranch = 0;
        loops.forEach((loop, idx) => {
            const compIdx = loop.componentIds.indexOf(comp.id);
            if (compIdx !== -1) {
                // If loop traverse +1 (node1->node2), then loop current adds to branch current (node1->node2)
                const loopDir = loop.direction[compIdx];
                const loopI = currents[idx];
                iBranch += loopDir * loopI;
            }
        });
        branchCurrentsMap[comp.id] = iBranch;
    });

    // Calculate Node Voltages (Simple traverse from Ground reference)
    // Assume Node[0] is Ground (0V)
    // Run BFS/DFS to set potentials.
    const nodeVoltages: Record<string, number> = {};
    // ... Implementation of Voltage solver to be added or simplified to just branch drops for now.
    // For Display, Branch Current is usually enough, but let's init empty.

    return {
        loopCurrents: loopCurrentsMap,
        branchCurrents: branchCurrentsMap,
        nodeVoltages, // TODO: Implement if needed for full view
        isSolvable: true
    };
}
