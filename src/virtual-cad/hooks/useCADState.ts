import { useState, useCallback, useMemo } from 'react';
import {
  CADObject,
  Layer,
  Block,
  XRef,
  LayoutTab,
  Tool,
  ViewState,
  SnapSettings,
  GridSettings,
  Point,
  Color,
  LineType,
  VisualStyle,
  CADState,
  UnitSettings,
  ConstraintDef,
  AttributeDefinition,
  BlockData,
  CADStateAPI
} from '../types/cad.types';
import { offsetObjectData } from '../utils/geometry';

const DEFAULT_COLOR: Color = { r: 255, g: 255, b: 255 };
const DEFAULT_LAYER: Layer = {
  id: 'layer-0',
  name: '0',
  color: DEFAULT_COLOR,
  lineType: 'continuous',
  lineWeight: 0.25,
  visible: true,
  frozen: false,
  locked: false,
  current: true
};

const DEFAULT_LAYOUT: LayoutTab = {
  id: 'model',
  name: 'Model',
  type: 'model',
  viewports: []
};

const DEFAULT_VIEW_STATE: ViewState = {
  center: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  visualStyle: 'wireframe'
};

const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  modes: ['endpoint', 'midpoint', 'center', 'intersection', 'perpendicular', 'nearest', 'quadrant'],
  gridSnap: false,
  ortho: false,
  polar: false,
  polarAngle: 45,
  dynamicInput: true
};

const DEFAULT_GRID_SETTINGS: GridSettings = {
  visible: true,
  spacing: 10,
  majorLineEvery: 10
};

const DEFAULT_UNIT_SETTINGS: UnitSettings = {
  format: 'mm',
  precision: 4,
  scaleFactor: 1
};

export function useCADState() {
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [layers, setLayers] = useState<Layer[]>([DEFAULT_LAYER]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [xrefs, setXRefs] = useState<XRef[]>([]);
  const [layouts, setLayouts] = useState<LayoutTab[]>([DEFAULT_LAYOUT]);
  const [activeLayoutId, setActiveLayoutId] = useState('model');
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<CADObject[]>([]);
  const [undoStack, setUndoStack] = useState<CADObject[][]>([]);
  const [redoStack, setRedoStack] = useState<CADObject[][]>([]);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS);
  const [gridSettings, setGridSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS);
  const [unitSettings, setUnitSettings] = useState<UnitSettings>(DEFAULT_UNIT_SETTINGS);
  const [constraints, setConstraints] = useState<ConstraintDef[]>([]);
  const [blockEditorMode, setBlockEditorMode] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState<Color>(DEFAULT_COLOR);
  const [currentLineType, setCurrentLineType] = useState<LineType>('continuous');
  const [currentLineWeight, setCurrentLineWeight] = useState<number>(0.25);

  const currentLayer = useMemo(() =>
    layers.find(l => l.current) || layers[0],
    [layers]
  );

  const selectedObjects = useMemo(() =>
    objects.filter(obj => selectedIds.includes(obj.id)),
    [objects, selectedIds]
  );

  const isObjectInteractable = useCallback((obj: CADObject) => {
    if (!obj.visible || obj.locked) return false;
    const layer = layers.find(l => l.id === obj.layerId);
    if (!layer) return true;
    return layer.visible && !layer.frozen && !layer.locked;
  }, [layers]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-49), [...objects]]);
    setRedoStack([]);
  }, [objects]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, [...objects]]);
    setUndoStack(u => u.slice(0, -1));
    setObjects(prev);
    setSelectedIds([]);
  }, [undoStack, objects]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, [...objects]]);
    setRedoStack(r => r.slice(0, -1));
    setObjects(next);
    setSelectedIds([]);
  }, [redoStack, objects]);

  const addObject = useCallback((obj: Omit<CADObject, 'id'>) => {
    pushUndo();
    const newObj: CADObject = {
      ...obj,
      name: obj.name || `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}`,
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setObjects(prev => [...prev, newObj]);
    return newObj.id;
  }, [pushUndo]);

  const updateObject = useCallback((id: string, updates: Partial<CADObject>) => {
    pushUndo();
    setObjects(prev => prev.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  }, [pushUndo]);

  const deleteObjects = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    pushUndo();
    setObjects(prev => prev.filter(obj => !ids.includes(obj.id)));
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  }, [pushUndo]);

  const selectObject = useCallback((id: string, addToSelection: boolean = false) => {
    setSelectedIds(prev => {
      if (addToSelection) {
        return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      }
      return [id];
    });
    setObjects(prev => prev.map(obj => ({
      ...obj,
      selected: addToSelection
        ? (obj.id === id ? !obj.selected : obj.selected)
        : obj.id === id
    })));
  }, []);

  const selectAll = useCallback(() => {
    const visibleIds = objects.filter(isObjectInteractable).map(o => o.id);
    setSelectedIds(visibleIds);
    setObjects(prev => prev.map(obj => ({
      ...obj,
      selected: visibleIds.includes(obj.id)
    })));
  }, [objects, isObjectInteractable]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setObjects(prev => prev.map(obj => ({ ...obj, selected: false })));
  }, []);

  const selectInRect = useCallback((corner1: Point, corner2: Point) => {
    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);

    const inRect: string[] = [];
    objects.forEach(obj => {
      if (!isObjectInteractable(obj)) return;
      // Simple bounds check - can be made more precise per object type
      const bounds = getSimpleBounds(obj);
      if (bounds.minX >= minX && bounds.maxX <= maxX &&
        bounds.minY >= minY && bounds.maxY >= maxY) { // Changed from <= to >= for maxY
        inRect.push(obj.id);
      }
    });

    setSelectedIds(inRect);
    setObjects(prev => prev.map(obj => ({
      ...obj,
      selected: inRect.includes(obj.id)
    })));
  }, [objects, isObjectInteractable]);

  const copyToClipboard = useCallback(() => {
    setClipboard(selectedObjects.map(obj => ({ ...obj })));
  }, [selectedObjects]);

  const pasteFromClipboard = useCallback((offset: Point = { x: 20, y: 20 }) => {
    if (clipboard.length === 0) return;
    pushUndo();
    const newIds: string[] = [];
    const newObjects = clipboard.map(obj => {
      const newId = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newIds.push(newId);
      return {
        ...obj,
        id: newId,
        selected: true,
        data: offsetObjectData(obj.data, offset)
      };
    });
    setObjects(prev => [...prev.map(o => ({ ...o, selected: false })), ...newObjects]);
    setSelectedIds(newIds);
  }, [clipboard, pushUndo]);

  // Layer operations
  const addLayer = useCallback((name: string) => {
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name,
      color: DEFAULT_COLOR,
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
      current: false
    };
    setLayers(prev => [...prev, newLayer]);
    return newLayer.id;
  }, []);

  const setCurrentLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(layer => ({
      ...layer,
      current: layer.id === id
    })));
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, ...updates } : layer
    ));
  }, []);

  const deleteLayer = useCallback((id: string) => {
    if (layers.length <= 1) return;
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    // Move objects to layer 0
    setObjects(prev => prev.map(obj =>
      obj.layerId === id ? { ...obj, layerId: 'layer-0' } : obj
    ));
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== id);
      if (layer.current && filtered.length > 0) {
        filtered[0].current = true;
      }
      return filtered;
    });
  }, [layers]);

  const renameObject = useCallback((id: string, name: string) => {
    setObjects(prev => prev.map(obj =>
      obj.id === id ? { ...obj, name } : obj
    ));
  }, []);

  const renameLayer = useCallback((id: string, name: string) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, name } : layer
    ));
  }, []);

  const createBlockFromSelection = useCallback((name: string, origin: Point) => {
    const selected = objects.filter(obj => selectedIds.includes(obj.id));
    if (selected.length === 0) return;

    // Objects in block def should be relative to origin.
    const blockObjects = selected.map(obj => ({
      ...obj,
      data: offsetObjectData(obj.data, { x: -origin.x, y: -origin.y }),
      selected: false
    }));

    const blockId = `block-${Date.now()}`;
    const newBlock: Block = {
      id: blockId,
      name: name,
      basePoint: { x: 0, y: 0 },
      objects: blockObjects,
      attributes: []
    };

    // Update blocks state
    setBlocks(prev => [...prev, newBlock]);

    // Create Block Instance
    const blockRef: CADObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      type: 'block',
      layerId: selected[0].layerId,
      color: { r: 255, g: 255, b: 255 },
      lineType: 'continuous',
      lineWeight: 0.25,
      transparency: 0,
      locked: false,
      visible: true,
      selected: true,
      data: {
        blockId: blockId,
        insertionPoint: origin,
        scale: { x: 1, y: 1 },
        rotation: 0
      }
    };

    pushUndo();
    setObjects(prev => [
      ...prev.filter(obj => !selectedIds.includes(obj.id)),
      blockRef
    ]);
    setSelectedIds([blockRef.id]);
  }, [objects, selectedIds, pushUndo]);

  // Block operations
  const createBlock = useCallback((name: string, basePoint: Point, objectIds: string[], attributes?: AttributeDefinition[]) => {
    const blockObjects = objects.filter(o => objectIds.includes(o.id));
    if (blockObjects.length === 0) return '';
    pushUndo();
    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      basePoint,
      objects: blockObjects.map(o => ({ ...o })),
      attributes: attributes || []
    };
    setBlocks(prev => [...prev, newBlock]);
    // Remove source objects and insert a block reference
    setObjects(prev => {
      const remaining = prev.filter(o => !objectIds.includes(o.id));
      const blockRef: CADObject = {
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name, // Store name on CADObject
        type: 'block',
        layerId: currentLayer.id,
        color: currentColor,
        lineType: currentLineType,
        lineWeight: currentLineWeight,
        transparency: 0,
        locked: false,
        visible: true,
        selected: false,
        data: {
          blockId: newBlock.id,
          insertionPoint: basePoint,
          scale: { x: 1, y: 1 },
          rotation: 0,
          attributes: (attributes || []).map(a => ({
            tag: a.tag,
            value: a.defaultValue,
            position: a.position,
            height: a.height,
            rotation: a.rotation,
            visible: a.visible
          }))
        }
      };
      return [...remaining, blockRef];
    });
    return newBlock.id;
  }, [objects, pushUndo, currentLayer, currentColor, currentLineType, currentLineWeight]);

  const insertBlock = useCallback((
    blockId: string,
    insertPoint: Point,
    scaleOrVal: number | { x: number; y: number } = 1,
    rotation: number = 0,
    autoExplode: boolean = false
  ) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    pushUndo();
    const scaleX = typeof scaleOrVal === 'number' ? scaleOrVal : scaleOrVal.x;
    const scaleY = typeof scaleOrVal === 'number' ? scaleOrVal : scaleOrVal.y;
    const uniformScale = Math.max(scaleX, scaleY); // for transform

    if (autoExplode) {
      // Insert as individual exploded objects
      const newObjects = block.objects.map(obj => ({
        ...obj,
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: transformObjectData(obj.data, block.basePoint, insertPoint, uniformScale, rotation)
      }));
      setObjects(prev => [...prev, ...newObjects]);
    } else {
      // Insert as a block reference object
      const blockRef: CADObject = {
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: block.name,
        type: 'block',
        layerId: currentLayer.id,
        color: currentColor,
        lineType: currentLineType,
        lineWeight: currentLineWeight,
        transparency: 0,
        locked: false,
        visible: true,
        selected: false,
        data: {
          blockId: block.id,
          insertionPoint: insertPoint,
          scale: { x: scaleX, y: scaleY },
          rotation,
          attributes: (block.attributes || []).map(a => ({
            tag: a.tag,
            value: a.defaultValue,
            position: a.position,
            height: a.height,
            rotation: a.rotation,
            visible: a.visible
          }))
        }
      };
      setObjects(prev => [...prev, blockRef]);
    }
  }, [blocks, pushUndo, currentLayer, currentColor, currentLineType, currentLineWeight]);

  const updateBlockDefinition = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    pushUndo();
    // Propagate updated definition to all block reference instances
    setObjects(prev => prev.map(obj => {
      if (obj.type === 'block') {
        const blockData = obj.data as BlockData;
        if (blockData.blockId === block.id) {
          // No need to regenerate objects data here as Block Reference stores reference only.
          // The rendering logic handles the definition lookup.
          // BUT if we were storing exploded objects in data (old visual logic?), we'd need to update.
          // With new reference logic, we just keep the reference.
          // So actually, updateBlockDefinition might not need to do anything to instances 
          // unless attributes changed or insertion point geometry shifts relative to base point?
          // If the Block Definition changes, the instances automatically reflect it at render time.
          // So this function might be redundant for geometry updates!
          // We'll keep it simple for now.
          return obj;
        }
      }
      return obj;
    }));
  }, [blocks, pushUndo]);

  // View operations
  const zoomIn = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.25, 50) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.25, 0.01) }));
  }, []);

  const zoomExtents = useCallback(() => {
    if (objects.length === 0) {
      setViewState(prev => ({ ...prev, center: { x: 0, y: 0 }, zoom: 1 }));
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      const bounds = getSimpleBounds(obj);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;
    const zoom = Math.min(800 / (width + 100), 600 / (height + 100), 10);

    setViewState(prev => ({
      ...prev,
      center: { x: centerX, y: centerY },
      zoom: Math.max(zoom, 0.1)
    }));
  }, [objects]);
  const pan = useCallback((delta: Point) => {
    setViewState(prev => ({
      ...prev,
      center: {
        x: prev.center.x + delta.x / prev.zoom,
        y: prev.center.y + delta.y / prev.zoom
      }
    }));
  }, []);

  const setVisualStyle = useCallback((style: VisualStyle) => {
    setViewState(prev => ({ ...prev, visualStyle: style }));
  }, []);

  // Constraint operations
  const addConstraint = useCallback((constraint: Omit<ConstraintDef, 'id'>) => {
    const newConstraint: ConstraintDef = {
      ...constraint,
      id: `constraint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setConstraints(prev => [...prev, newConstraint]);
    return newConstraint.id;
  }, []);

  const removeConstraint = useCallback((id: string) => {
    setConstraints(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateConstraint = useCallback((id: string, updates: Partial<ConstraintDef>) => {
    setConstraints(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  }, []);

  // Block editor
  const enterBlockEditor = useCallback((blockId: string) => {
    setBlockEditorMode(true);
    setEditingBlockId(blockId);
  }, []);

  const exitBlockEditor = useCallback(() => {
    setBlockEditorMode(false);
    setEditingBlockId(null);
  }, []);

  // File operations
  const newDrawing = useCallback(() => {
    setObjects([]);
    setLayers([{ ...DEFAULT_LAYER }]);
    setBlocks([]);
    setXRefs([]);
    setLayouts([{ ...DEFAULT_LAYOUT }]);
    setActiveLayoutId('model');
    setSelectedIds([]);
    setClipboard([]);
    setUndoStack([]);
    setRedoStack([]);
    setViewState({ ...DEFAULT_VIEW_STATE });
    setUnitSettings({ ...DEFAULT_UNIT_SETTINGS });
    setConstraints([]);
    setBlockEditorMode(false);
    setEditingBlockId(null);
  }, []);
  const getState = useCallback((): CADState => ({
    objects,
    layers,
    blocks,
    xrefs,
    layouts,
    activeLayoutId,
    activeTool,
    selectedIds,
    clipboard,
    undoStack,
    redoStack,
    viewState,
    snapSettings,
    gridSettings,
    unitSettings,
    constraints,
    blockEditorMode,
    editingBlockId
  }), [objects, layers, blocks, xrefs, layouts, activeLayoutId, activeTool,
    selectedIds, clipboard, undoStack, redoStack, viewState, snapSettings, gridSettings,
    unitSettings, constraints, blockEditorMode, editingBlockId]);
  const loadState = useCallback((state: CADState) => {
    setObjects(state.objects);
    setLayers(state.layers);
    setBlocks(state.blocks);
    setXRefs(state.xrefs);
    setLayouts(state.layouts);
    setActiveLayoutId(state.activeLayoutId);
    setActiveTool(state.activeTool);
    setSelectedIds(state.selectedIds);
    setViewState(state.viewState);
    setSnapSettings(state.snapSettings);
    setGridSettings(state.gridSettings);
    if (state.unitSettings) setUnitSettings(state.unitSettings);
    if (state.constraints) setConstraints(state.constraints);
    setBlockEditorMode(state.blockEditorMode || false);
    setEditingBlockId(state.editingBlockId || null);
  }, []);
  return {
    // State
    objects,
    layers,
    blocks,
    xrefs,
    layouts,
    activeLayoutId,
    activeTool,
    selectedIds,
    selectedObjects,
    clipboard,
    viewState,
    snapSettings,
    gridSettings,
    unitSettings,
    constraints,
    blockEditorMode,
    editingBlockId,
    currentLayer,
    currentColor,
    currentLineType,
    currentLineWeight,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,

    // Setters
    setObjects,
    setLayers,
    setBlocks,
    setActiveTool,
    setActiveLayoutId,
    setSnapSettings,
    setGridSettings,
    setUnitSettings,
    setCurrentColor,
    setCurrentLineType,
    setCurrentLineWeight,
    setViewState,

    // Object operations
    addObject,
    updateObject,
    renameObject, // Added
    deleteObject: (id: string) => deleteObjects([id]),
    deleteObjects,
    selectObject,
    selectAll,
    clearSelection,
    selectInRect,
    copyToClipboard,
    pasteFromClipboard,
    undo,
    redo,

    // Layer operations
    addLayer,
    setCurrentLayer,
    updateLayer,
    renameLayer, // Added
    deleteLayer,

    // Block operations
    createBlock,
    createBlockFromSelection, // Added
    insertBlock,
    updateBlockDefinition,
    enterBlockEditor,
    exitBlockEditor,

    // Constraint operations
    addConstraint,
    removeConstraint,
    updateConstraint,

    // View operations
    zoomIn,
    zoomOut,
    zoomExtents,
    pan,
    setVisualStyle,

    // File operations
    newDrawing,
    getState,
    loadState
  };
}

// Helper functions
function getSimpleBounds(obj: CADObject): { minX: number; minY: number; maxX: number; maxY: number } {
  const data = obj.data as any;

  switch (obj.type) {
    case 'line':
      return {
        minX: Math.min(data.start.x, data.end.x),
        minY: Math.min(data.start.y, data.end.y),
        maxX: Math.max(data.start.x, data.end.x),
        maxY: Math.max(data.start.y, data.end.y)
      };
    case 'circle':
      return {
        minX: data.center.x - data.radius,
        minY: data.center.y - data.radius,
        maxX: data.center.x + data.radius,
        maxY: data.center.y + data.radius
      };
    case 'rectangle':
      return {
        minX: Math.min(data.corner1.x, data.corner2.x),
        minY: Math.min(data.corner1.y, data.corner2.y),
        maxX: Math.max(data.corner1.x, data.corner2.x),
        maxY: Math.max(data.corner1.y, data.corner2.y)
      };
    case 'polyline':
      const xs = data.points.map((p: Point) => p.x);
      const ys = data.points.map((p: Point) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      };
    case 'arc':
    case 'polygon':
      return {
        minX: data.center.x - data.radius,
        minY: data.center.y - data.radius,
        maxX: data.center.x + data.radius,
        maxY: data.center.y + data.radius
      };
    case 'text':
    case 'mtext':
      return {
        minX: data.position.x,
        minY: data.position.y - (data.height || 10),
        maxX: data.position.x + ((data.content?.length || 1) * (data.height || 10) * 0.6),
        maxY: data.position.y
      };
    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}



function transformObjectData(data: any, basePoint: Point, insertPoint: Point, scale: number, rotation: number): any {
  const offset = {
    x: insertPoint.x - basePoint.x * scale,
    y: insertPoint.y - basePoint.y * scale
  };

  const transform = (p: Point): Point => {
    const scaled = { x: p.x * scale, y: p.y * scale };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: scaled.x * cos - scaled.y * sin + offset.x,
      y: scaled.x * sin + scaled.y * cos + offset.y
    };
  };

  if (data.start && data.end) {
    return { ...data, start: transform(data.start), end: transform(data.end) };
  }
  if (data.center && data.radius !== undefined) {
    return { ...data, center: transform(data.center), radius: data.radius * scale };
  }
  if (data.corner1 && data.corner2) {
    return { ...data, corner1: transform(data.corner1), corner2: transform(data.corner2) };
  }
  if (data.points) {
    return { ...data, points: data.points.map(transform) };
  }
  if (data.position) {
    return { ...data, position: transform(data.position), height: (data.height || 10) * scale };
  }
  return data;
}
