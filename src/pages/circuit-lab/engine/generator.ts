import type { CircuitState, Component, Loop, ComponentType } from './types';

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randValue(type: ComponentType): number {
    if (type === 'RESISTOR') {
        // 10 to 100 ohms, step 10
        return randInt(1, 10) * 10;
    }
    if (type === 'VOLTAGE_SOURCE') {
        // 5 to 50 volts, step 5
        return randInt(1, 10) * 5;
    }
    return 0;
}

/**
 * Generates a 2-Mesh Circuit (Shared branch in middle)
 * Topology:
 *   N1 -- B1 (Top L) -- N2 -- B2 (Top R) -- N3
 *   |                    |                   |
 *   B3 (Left)           B4 (Mid)            B5 (Right)
 *   |                    |                   |
 *   N4 -- B6 (Bot L) -- N5 -- B7 (Bot R) -- N6
 * 
 * Loops: 
 *   L1: N1-N2-N5-N4 (Clockwise)
 *   L2: N2-N3-N6-N5 (Clockwise)
 */
export function generateTwoMeshCircuit(): CircuitState {
    // Nodes
    // coords for visualization 0-100 scale?
    const nodes = [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 50, y: 0 },
        { id: 'n3', x: 100, y: 0 },
        { id: 'n4', x: 0, y: 50 },
        { id: 'n5', x: 50, y: 50 },
        { id: 'n6', x: 100, y: 50 },
    ];

    // Components placement
    // We want at least one voltage source in the circuit.
    // We generally put sources on outer vertical branches for classic textbook look.

    const compsRaw = [
        { id: 'c_left', pos: 'left', n1: 'n4', n2: 'n1' },      // B3: Left (Upward traversal for loop)
        { id: 'c_top_l', pos: 'top', n1: 'n1', n2: 'n2' },      // B1: Top Left
        { id: 'c_mid', pos: 'mid', n1: 'n2', n2: 'n5' },        // B4: Middle (Downward shared)
        { id: 'c_bot_l', pos: 'bot', n1: 'n5', n2: 'n4' },      // B6: Bot Left

        { id: 'c_top_r', pos: 'top', n1: 'n2', n2: 'n3' },      // B2: Top Right
        { id: 'c_right', pos: 'right', n1: 'n3', n2: 'n6' },    // B5: Right (Downward)
        { id: 'c_bot_r', pos: 'bot', n1: 'n6', n2: 'n5' },      // B7: Bot Right
    ];

    // Randomized types
    // Ensure we don't have current sources (per requirements, mesh usually V/R)
    // Ensure we don't have Loop of only Voltage sources (Ill-posed for Mesh sometimes if conflicting)
    // Safe bet: Resistors everywhere, replace 1 or 2 specific branches with Sources.

    const components: Component[] = compsRaw.map((c, idx) => {
        return {
            id: c.id,
            node1Id: c.n1,
            node2Id: c.n2,
            type: 'RESISTOR',
            value: randValue('RESISTOR'),
            name: `R${idx + 1}`
        };
    });

    // Pick 1 or 2 spots for Voltage Source
    // Usually ideal on 'left' or 'right' or 'top'
    const sourceIndices = [0]; // Just Left for sure
    if (Math.random() > 0.5) sourceIndices.push(5); // Maybe Right too

    let vCount = 1;
    sourceIndices.forEach(idx => {
        components[idx].type = 'VOLTAGE_SOURCE';
        components[idx].name = `V${vCount++}`;
        components[idx].value = randValue('VOLTAGE_SOURCE');
    });

    // Define Loops
    // Loop 1: Left (up), TopL (right), Mid (down), BotL (left) 
    // Wait, my coords:
    // Left: n4 -> n1 (Up)
    // TopL: n1 -> n2 (Right)
    // Mid:  n2 -> n5 (Down)
    // BotL: n5 -> n4 (Left)

    // Directions relative to Component definition:
    // c_left (n4->n1): Matches (+1)
    // c_top_l (n1->n2): Matches (+1)
    // c_mid (n2->n5): Matches (+1)
    // c_bot_l (n5->n4): Matches (+1)

    const loop1: Loop = {
        id: 'l1',
        componentIds: ['c_left', 'c_top_l', 'c_mid', 'c_bot_l'],
        direction: [1, 1, 1, 1]
    };

    // Loop 2: Mid(Up), TopR(Right), Right(Down), BotR(Left)
    // Shared Mid Branch: Loop 2 goes UP (n5 -> n2)
    // c_mid defined as n2->n5. So Loop 2 traverses defined direction *Opposite* (-1)

    // c_top_r (n2->n3): Matches (+1)
    // c_right (n3->n6): Matches (+1)
    // c_bot_r (n6->n5): Matches (+1)

    const loop2: Loop = {
        id: 'l2',
        componentIds: ['c_mid', 'c_top_r', 'c_right', 'c_bot_r'],
        direction: [-1, 1, 1, 1]
    };

    return {
        nodes,
        components,
        loops: [loop1, loop2]
    };
}

export function generateThreeMeshCircuit(): CircuitState {
    // TODO: Expansion for 3 meshes if requested, stick to 2 for reliable MVP first
    return generateTwoMeshCircuit();
}
