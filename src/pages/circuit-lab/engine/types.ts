export type ComponentType = 'RESISTOR' | 'VOLTAGE_SOURCE' | 'WIRE' | 'DIODE' | 'CAPACITOR' | 'DC_BATTERY' | 'AC_SOURCE' | 'AMMETER';

export type AppMode = 'mesh' | 'builder';

export interface PlaceableComponent {
    type: ComponentType;
    name: string;
    description: string;
    icon: string;
    defaultValue: number;
    unit: string;
    minValue: number;
    maxValue: number;
    color: string;
}

export interface Wire {
    id: string;
    startNode: CircuitNode;
    endNode: CircuitNode;
}

export interface CircuitReport {
    isValid: boolean;
    hasVoltageSource: boolean;
    hasClosedLoop: boolean;
    componentCount: number;
    wireCount: number;
    issues: string[];
    suggestions: string[];
}

export interface CircuitNode {
    id: string;
    x: number; // For planar graph visualization
    y: number;
}

export interface Component {
    id: string;
    type: ComponentType;
    value: number; // Resistance in Ohms or Voltage in Volts
    node1Id: string;
    node2Id: string;
    name: string; // e.g. "R1", "V1"
    center?: { x: number; y: number }; // Grid center position
    orientation?: 0 | 90 | 180 | 270; // Rotation in degrees
}

export interface Loop {
    id: string;
    componentIds: string[]; // Ordered list of components in the loop
    direction: number[]; // +1 or -1 matching traversal direction vs defined component direction
}

export interface CircuitState {
    nodes: CircuitNode[];
    components: Component[];
    loops: Loop[]; // Mesh loops identified for analysis
}

export interface AnalysisResult {
    loopCurrents: Record<string, number>; // Map loopId -> current (Amps)
    branchCurrents: Record<string, number>; // Map componentId -> current (Amps)
    nodeVoltages: Record<string, number>; // Map nodeId -> voltage (Volts) relative to ground
    isSolvable: boolean;
}
