// CAD Application Types

export type Point = {
  x: number;
  y: number;
};

export type Color = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export type LineType = 'continuous' | 'dashed' | 'dotted' | 'dashdot' | 'center' | 'hidden';

export type VisualStyle = 'wireframe' | 'hidden' | 'shaded';

export type SnapMode = 'endpoint' | 'midpoint' | 'center' | 'node' | 'quadrant' | 'intersection' | 'extension' | 'insertion' | 'perpendicular' | 'tangent' | 'nearest' | 'apparent' | 'parallel';

export type DrawTool =
  | 'select'
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'rectangle'
  | 'polygon'
  | 'spline'
  | 'ellipse'
  | 'revision-cloud'
  | 'xline'
  | 'ray'
  | 'text'
  | 'mtext'
  | 'dimension'
  | 'leader'
  | 'hatch'
  | 'measure';

export type ModifyTool =
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'mirror'
  | 'trim'
  | 'extend'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'explode'
  | 'join'
  | 'stretch'
  | 'break'
  | 'align'
  | 'erase'
  | 'array-rect'
  | 'array-polar'
  | 'array-path';

export type BlockTool =
  | 'block-create'
  | 'block-insert'
  | 'block-edit';

export type ConstraintTool =
  | 'constraint-parallel'
  | 'constraint-perpendicular'
  | 'constraint-concentric'
  | 'constraint-tangent'
  | 'constraint-equal'
  | 'constraint-coincident'
  | 'constraint-collinear'
  | 'constraint-symmetric'
  | 'constraint-distance'
  | 'constraint-angle'
  | 'constraint-radius'
  | 'constraint-diameter';

export type Tool = DrawTool | ModifyTool | BlockTool | ConstraintTool | 'pan' | 'zoom';

export interface CADObject {
  id: string;
  name?: string;
  type: CADObjectType;
  layerId: string;
  color: Color;
  lineType: LineType;
  lineWeight: number;
  transparency: number;
  locked: boolean;
  visible: boolean;
  selected: boolean;
  data: ObjectData;
}

export type CADObjectType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'rectangle'
  | 'polygon'
  | 'spline'
  | 'ellipse'
  | 'revision-cloud'
  | 'xline'
  | 'ray'
  | 'text'
  | 'mtext'
  | 'dimension'
  | 'leader'
  | 'hatch'
  | 'block'
  | 'array';

export type ObjectData =
  | LineData
  | PolylineData
  | CircleData
  | ArcData
  | RectangleData
  | PolygonData
  | SplineData
  | EllipseData
  | XLineData
  | RayData
  | TextData
  | DimensionData
  | HatchData
  | BlockData
  | ArrayObjectData;

export interface LineData {
  start: Point;
  end: Point;
}

export interface PolylineData {
  points: Point[];
  closed: boolean;
}

export interface CircleData {
  center: Point;
  radius: number;
}

export interface ArcData {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface RectangleData {
  corner1: Point;
  corner2: Point;
}

export interface PolygonData {
  center: Point;
  radius: number;
  sides: number;
  rotation: number;
}

export interface SplineData {
  controlPoints: Point[];
  degree: number;
}

export interface EllipseData {
  center: Point;
  majorRadius: number;
  minorRadius: number;
  rotation: number;
}

export interface XLineData {
  point: Point;
  direction: Point;
}

export interface RayData {
  point: Point;
  direction: Point;
}

export interface TextData {
  position: Point;
  content: string;
  height: number;
  rotation: number;
  style: string;
}

export interface DimensionData {
  type: 'linear' | 'aligned' | 'angular' | 'radius' | 'diameter' | 'horizontal' | 'vertical';
  points: Point[];
  textPosition: Point;
  value?: number;
  override?: string;
}

export interface HatchData {
  boundary: Point[];
  pattern: string;
  scale: number;
  angle: number;
}

export interface BlockData {
  blockId: string;
  insertionPoint: Point;
  scale: Point;
  rotation: number;
  attributes?: AttributeInstance[];
}

// Array system
export type ArrayType = 'rectangular' | 'polar' | 'path';

export interface RectArrayParams {
  rows: number;
  columns: number;
  rowSpacing: number;
  columnSpacing: number;
  incrementalRotation: number;
  incrementalScale: number;
  levels: number;
  levelSpacing: number;
}

export interface PolarArrayParams {
  center: Point;
  itemCount: number;
  fillAngle: number;
  angularSpacing: number;
  rotateItems: boolean;
  clockwise: boolean;
}

export interface PathArrayParams {
  pathPoints: Point[];
  itemCount: number;
  tangentAlign: boolean;
  startOffset: number;
  endOffset: number;
  spacing: number;
}

export interface ArrayObjectData {
  arrayType: ArrayType;
  sourceObjects: CADObject[];
  associative: boolean;
  rectParams?: RectArrayParams;
  polarParams?: PolarArrayParams;
  pathParams?: PathArrayParams;
}

// Block attributes
export interface AttributeDefinition {
  tag: string;
  prompt: string;
  defaultValue: string;
  position: Point;
  height: number;
  rotation: number;
  visible: boolean;
}

export interface AttributeInstance {
  tag: string;
  value: string;
  position: Point;
  height: number;
  rotation: number;
  visible: boolean;
}

// Constraint system
export type GeometricConstraintType =
  | 'parallel'
  | 'perpendicular'
  | 'concentric'
  | 'tangent'
  | 'equal'
  | 'coincident'
  | 'collinear'
  | 'symmetric';

export type DimensionalConstraintType =
  | 'distance'
  | 'angle'
  | 'radius'
  | 'diameter';

export type ConstraintType = GeometricConstraintType | DimensionalConstraintType;

export interface ConstraintDef {
  id: string;
  type: ConstraintType;
  objectIds: string[];
  value?: number;
  referencePoint?: Point;
  satisfied: boolean;
}

// Unit system
export type UnitFormat = 'mm' | 'cm' | 'm' | 'inches' | 'feet' | 'architectural' | 'engineering';

export interface UnitSettings {
  format: UnitFormat;
  precision: number;
  scaleFactor: number;
}

export interface Layer {
  id: string;
  name: string;
  color: Color;
  lineType: LineType;
  lineWeight: number;
  visible: boolean;
  frozen: boolean;
  locked: boolean;
  current: boolean;
}

export interface Viewport {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  scale: number;
  center: Point;
  locked: boolean;
}

export interface LayoutTab {
  id: string;
  name: string;
  type: 'model' | 'paper';
  viewports: Viewport[];
  titleBlockId?: string;
}

export interface Block {
  id: string;
  name: string;
  basePoint: Point;
  objects: CADObject[];
  attributes?: AttributeDefinition[];
}

export interface XRef {
  id: string;
  name: string;
  path: string;
  insertPoint: Point;
  scale: Point;
  rotation: number;
  loaded: boolean;
}

export interface CADState {
  objects: CADObject[];
  layers: Layer[];
  blocks: Block[];
  xrefs: XRef[];
  layouts: LayoutTab[];
  activeLayoutId: string;
  activeTool: Tool;
  selectedIds: string[];
  clipboard: CADObject[];
  undoStack: CADObject[][];
  redoStack: CADObject[][];
  viewState: ViewState;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  unitSettings: UnitSettings;
  constraints: ConstraintDef[];
  blockEditorMode: boolean;
  editingBlockId: string | null;
}

export interface ViewState {
  center: Point;
  zoom: number;
  rotation: number;
  visualStyle: VisualStyle;
}

export interface SnapSettings {
  enabled: boolean;
  modes: SnapMode[];
  gridSnap: boolean;
  ortho: boolean;
  polar: boolean;
  polarAngle: number;
  dynamicInput: boolean;
}

export interface GridSettings {
  visible: boolean;
  spacing: number;
  majorLineEvery: number;
}

export interface CADStateAPI {
  objects: CADObject[];
  layers: Layer[];
  blocks: Block[];
  xrefs: XRef[];
  layouts: LayoutTab[];
  activeLayoutId: string;
  activeTool: Tool;
  selectedIds: string[];
  clipboard: CADObject[];
  viewState: ViewState;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  unitSettings: UnitSettings;
  constraints: ConstraintDef[];
  blockEditorMode: boolean;
  editingBlockId: string | null;
  // Computed properties
  currentLayer: Layer;
  currentColor: Color;
  currentLineType: LineType;
  currentLineWeight: number;
  selectedObjects: CADObject[];
  canUndo: boolean;
  canRedo: boolean;

  // Methods
  setObjects: React.Dispatch<React.SetStateAction<CADObject[]>>;
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  setActiveTool: (tool: Tool) => void;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  setSnapSettings: React.Dispatch<React.SetStateAction<SnapSettings>>;
  setGridSettings: React.Dispatch<React.SetStateAction<GridSettings>>;
  setUnitSettings: React.Dispatch<React.SetStateAction<UnitSettings>>;

  // Object Ops
  addObject: (obj: Omit<CADObject, 'id'>) => string;
  updateObject: (id: string, updates: Partial<CADObject>) => void;
  deleteObject: (id: string) => void; // Deprecated in favor of deleteObjects? Or keep both? Keeping both for compat.
  deleteObjects: (ids: string[]) => void;
  selectObject: (id: string, multi: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectInRect: (p1: Point, p2: Point) => void;
  copyToClipboard: () => void;
  pasteFromClipboard: () => void;

  // Layer Ops
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  addLayer: (name: string) => void;
  deleteLayer: (id: string) => void;
  setCurrentLayer: (id: string) => void;
  renameObject: (id: string, name: string) => void;
  renameLayer: (id: string, name: string) => void;

  // Block Ops
  createBlockFromSelection: (name: string, origin: Point) => void;
  updateBlockDefinition: (blockId: string, updates: Partial<Block>) => void;
  createBlock: (name: string, basePoint: Point, objectIds: string[], attributes?: AttributeDefinition[]) => string;
  insertBlock: (blockId: string, insertPoint: Point, scale?: number | Point, rotation?: number) => void;
  enterBlockEditor: (blockId: string) => void;
  exitBlockEditor: () => void;

  // Other Ops
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomExtents: () => void;
  pan: (delta: Point) => void;
  setVisualStyle: (style: VisualStyle) => void;
  newDrawing: () => void;
  getState: () => CADState;
  loadState: (state: CADState) => void;
  setCurrentColor: React.Dispatch<React.SetStateAction<Color>>;
  setCurrentLineType: React.Dispatch<React.SetStateAction<LineType>>;
  setCurrentLineWeight: React.Dispatch<React.SetStateAction<number>>;

  // Constraints
  addConstraint: (def: ConstraintDef) => void;
  removeConstraint: (id: string) => void;
  updateConstraint: (id: string, updates: Partial<ConstraintDef>) => void;
}

export interface DrawingFile {
  name: string;
  version: string;
  created: string;
  modified: string;
  state: CADState;
}