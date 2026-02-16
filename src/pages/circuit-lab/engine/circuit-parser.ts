import type { CircuitState, Component, Loop, CircuitNode } from './types';

/**
 * Parses raw placed components and wires into a solvable CircuitState
 */
export function parseCircuit(
    components: Component[],
    wires: { id: string; startNode: CircuitNode; endNode: CircuitNode; }[]
): CircuitState {

    // 1. Identify "Electrical Nodes" (Clusters of connected wire points)
    const parent = new Map<string, string>();
    const coordKey = (n: { x: number, y: number }) => `${n.x},${n.y}`;

    const find = (key: string): string => {
        if (!parent.has(key)) parent.set(key, key);
        if (parent.get(key) !== key) parent.set(key, find(parent.get(key)!));
        return parent.get(key)!;
    };

    const union = (k1: string, k2: string) => {
        const root1 = find(k1);
        const root2 = find(k2);
        if (root1 !== root2) parent.set(root1, root2);
    };

    const pointMap = new Map<string, CircuitNode>();

    wires.forEach(w => {
        const k1 = coordKey(w.startNode);
        const k2 = coordKey(w.endNode);
        union(k1, k2);
        pointMap.set(k1, w.startNode);
        pointMap.set(k2, w.endNode);
    });

    components.forEach(c => {
        const GRID_SIZE = 40;
        const orient = c.orientation || 0;
        const cx = c.center?.x || 0;
        const cy = c.center?.y || 0;

        let p1, p2;
        if (orient === 0 || orient === 180) {
            p1 = { x: cx - GRID_SIZE, y: cy };
            p2 = { x: cx + GRID_SIZE, y: cy };
            if (orient === 180) [p1, p2] = [p2, p1];
        } else {
            p1 = { x: cx, y: cy - GRID_SIZE };
            p2 = { x: cx, y: cy + GRID_SIZE };
            if (orient === 270) [p1, p2] = [p2, p1];
        }

        const k1 = coordKey(p1);
        const k2 = coordKey(p2);
        find(k1);
        find(k2);

        // For DIODE: node1 is Anode (+), node2 is Cathode (-)
        pointMap.set(k1, { id: c.node1Id, x: p1.x, y: p1.y });
        pointMap.set(k2, { id: c.node2Id, x: p2.x, y: p2.y });
    });

    const groups = new Map<string, CircuitNode[]>();
    for (const key of parent.keys()) {
        const root = find(key);
        if (!groups.has(root)) groups.set(root, []);
        const node = pointMap.get(key);
        if (node) groups.get(root)!.push(node);
    }

    const electricalNodes: CircuitNode[] = [];
    const nodeMapping = new Map<string, string>();
    let nIdx = 0;

    groups.forEach((points) => {
        const id = `n${++nIdx}`;
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        electricalNodes.push({ id, x: avgX, y: avgY });
        points.forEach(p => nodeMapping.set(coordKey(p), id));
    });

    // 2. Build Adjacency Graph
    const mappedComponents = components.map(c => {
        const GRID_SIZE = 40;
        const orient = c.orientation || 0;
        const cx = c.center?.x || 0;
        const cy = c.center?.y || 0;

        let cp1, cp2;
        if (orient === 0 || orient === 180) {
            cp1 = { x: cx - GRID_SIZE, y: cy };
            cp2 = { x: cx + GRID_SIZE, y: cy };
            if (orient === 180) [cp1, cp2] = [cp2, cp1];
        } else {
            cp1 = { x: cx, y: cy - GRID_SIZE };
            cp2 = { x: cx, y: cy + GRID_SIZE };
            if (orient === 270) [cp1, cp2] = [cp2, cp1];
        }

        const k1 = coordKey(cp1);
        const k2 = coordKey(cp2);

        return {
            ...c,
            node1Id: nodeMapping.get(k1) || 'unknown',
            node2Id: nodeMapping.get(k2) || 'unknown'
        };
    }).filter(c => c.node1Id !== c.node2Id && c.node1Id !== 'unknown' && c.node2Id !== 'unknown');

    const adj = new Map<string, Array<{ compId: string, target: string, type: string }>>();
    electricalNodes.forEach(n => adj.set(n.id, []));

    mappedComponents.forEach(c => {
        adj.get(c.node1Id)?.push({ compId: c.id, target: c.node2Id, type: c.type });
        adj.get(c.node2Id)?.push({ compId: c.id, target: c.node1Id, type: c.type });
    });

    // 3. Find Loops
    const loops: Loop[] = [];
    if (electricalNodes.length > 0) {
        const startNode = electricalNodes[0].id;
        const parentMap = new Map<string, { parentId: string, compId: string }>();
        const visited = new Set<string>();
        const inTree = new Set<string>();

        const queue = [startNode];
        visited.add(startNode);

        while (queue.length > 0) {
            const curr = queue.shift()!;
            const neighbors = adj.get(curr) || [];
            neighbors.forEach(edge => {
                if (!visited.has(edge.target)) {
                    visited.add(edge.target);
                    parentMap.set(edge.target, { parentId: curr, compId: edge.compId });
                    inTree.add(edge.compId);
                    queue.push(edge.target);
                } else {
                    const p = parentMap.get(curr);
                    if (p && p.compId === edge.compId) return;

                    if (!inTree.has(edge.compId)) {
                        // Found a Back Edge closing a loop
                        const ancestors = new Set<string>();
                        let tempA: string | undefined = curr;
                        while (tempA) {
                            ancestors.add(tempA);
                            tempA = parentMap.get(tempA)?.parentId;
                        }

                        let lca: string | undefined;
                        let tempB: string | undefined = edge.target;
                        while (tempB) {
                            if (ancestors.has(tempB)) {
                                lca = tempB;
                                break;
                            }
                            tempB = parentMap.get(tempB)?.parentId;
                        }

                        if (lca) {
                            const loopHigh: string[] = [];
                            const loopLow: string[] = [];

                            let tH: string | undefined = curr;
                            while (tH && tH !== lca) {
                                const info = parentMap.get(tH)!;
                                loopHigh.push(info.compId);
                                tH = info.parentId;
                            }

                            let tL: string | undefined = edge.target;
                            while (tL && tL !== lca) {
                                const info = parentMap.get(tL)!;
                                loopLow.push(info.compId);
                                tL = info.parentId;
                            }

                            const sequence = [edge.compId, ...loopLow, ...loopHigh.reverse()];
                            const dirs: number[] = [];
                            const ids: string[] = [];
                            let tNode = curr;

                            for (const cid of sequence) {
                                const comp = mappedComponents.find(c => c.id === cid)!;
                                ids.push(cid);
                                dirs.push(comp.node1Id === tNode ? 1 : -1);
                                tNode = (comp.node1Id === tNode) ? comp.node2Id : comp.node1Id;
                            }

                            loops.push({
                                id: `L${loops.length + 1}`,
                                componentIds: ids,
                                direction: dirs
                            });
                            inTree.add(edge.compId);
                        }
                    }
                }
            });
        }
    }

    return {
        nodes: electricalNodes,
        components: mappedComponents,
        loops: loops
    };
}
