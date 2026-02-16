import { useState, useCallback, useRef } from 'react';
import { Point, CADObject, Tool, DrawTool, Color, LineType, LineData, CircleData, ArcData, PolylineData, RectangleData, PolygonData, SplineData, EllipseData, XLineData, RayData, ArrayObjectData, RectArrayParams, PolarArrayParams, PathArrayParams } from '../types/cad.types';
import { CADStateAPI } from '../types/cad.types';
import { distance, rotatePoint, scalePoint, mirrorPoint, offsetLine, offsetCircle, offsetArc, offsetPolyline, splitLineAtPoint, isPointInRect, pointOnPath, generatePolygonPoints } from '../utils/geometry';
import { findSnapPoint, snapToGrid, constrainToOrtho, constrainToPolar, SnapResult } from '../utils/snap';

// Array workflow steps
export type ArrayStep = 'idle' | 'select-objects' | 'set-center' | 'set-params' | 'preview';

export interface ArrayWorkflowParams {
  // Rectangular
  rows: number;
  columns: number;
  rowSpacing: number;
  columnSpacing: number;
  incrementalRotation: number;
  // Polar
  itemCount: number;
  fillAngle: number;
  rotateItems: boolean;
  clockwise: boolean;
  // Path
  tangentAlign: boolean;
  startOffset: number;
  endOffset: number;
  spacing: number;
  // Common
  associative: boolean;
  center: Point | null;
  pathPoints: Point[];
}

const DEFAULT_ARRAY_PARAMS: ArrayWorkflowParams = {
  rows: 3,
  columns: 3,
  rowSpacing: 30,
  columnSpacing: 30,
  incrementalRotation: 0,
  itemCount: 6,
  fillAngle: 360,
  rotateItems: true,
  clockwise: false,
  tangentAlign: true,
  startOffset: 0,
  endOffset: 0,
  spacing: 30,
  associative: true,
  center: null,
  pathPoints: []
};

interface DrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  points: Point[];
  previewObject: Partial<CADObject> | null;
  snapResult: SnapResult | null;
  inputValue: string;
  sides: number;
  textContent: string;
  arcStep: number;
  // Array workflow
  arrayStep: ArrayStep;
  arrayType: 'rectangular' | 'polar' | 'path' | null;
  arraySourceIds: string[];
  arrayParams: ArrayWorkflowParams;
  arrayPreviewObjects: CADObject[];
  arrayPrompt: string;
  // Shift constraint
  isShiftHeld: boolean;
  shiftConstrainedAngle: number | null;
}

export function useDrawingTools(cadState: CADStateAPI) {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    points: [],
    previewObject: null,
    snapResult: null,
    inputValue: '',
    sides: 6,
    textContent: '',
    arcStep: 0,
    arrayStep: 'idle',
    arrayType: null,
    arraySourceIds: [],
    arrayParams: { ...DEFAULT_ARRAY_PARAMS },
    arrayPreviewObjects: [],
    arrayPrompt: '',
    isShiftHeld: false,
    shiftConstrainedAngle: null
  });

  const modifyBasePoint = useRef<Point | null>(null);
  const modifyTargetIds = useRef<string[]>([]);

  const getProcessedPoint = useCallback((rawPoint: Point, startPoint?: Point, isShiftHeld?: boolean): Point => {
    let point = { ...rawPoint };

    // Apply snap
    if (cadState.snapSettings.enabled) {
      const snap = findSnapPoint(
        point,
        cadState.objects,
        cadState.snapSettings.modes,
        15,
        cadState.viewState.zoom
      );
      if (snap) {
        point = snap.point;
        setDrawingState(prev => ({ ...prev, snapResult: snap }));
      } else {
        setDrawingState(prev => ({ ...prev, snapResult: null }));
      }
    }

    // Apply grid snap
    if (cadState.snapSettings.gridSnap) {
      point = snapToGrid(point, cadState.gridSettings.spacing);
    }

    // Shift-key angular constraint: overrides ortho/polar
    if (isShiftHeld && startPoint) {
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        const rawAngle = Math.atan2(dy, dx);
        // Use polar angle increment if polar mode is active, otherwise 45°
        const increment = (cadState.snapSettings.polar && cadState.snapSettings.polarAngle > 0)
          ? (cadState.snapSettings.polarAngle * Math.PI / 180)
          : (Math.PI / 4); // 45 degrees
        const snappedAngle = Math.round(rawAngle / increment) * increment;
        point = {
          x: startPoint.x + dist * Math.cos(snappedAngle),
          y: startPoint.y + dist * Math.sin(snappedAngle)
        };
        setDrawingState(prev => ({ ...prev, shiftConstrainedAngle: snappedAngle * 180 / Math.PI }));
      }
      return point;
    } else {
      setDrawingState(prev => prev.shiftConstrainedAngle !== null ? { ...prev, shiftConstrainedAngle: null } : prev);
    }

    // Apply ortho constraint
    if (startPoint && cadState.snapSettings.ortho) {
      point = constrainToOrtho(startPoint, point);
    }

    // Apply polar constraint
    if (startPoint && cadState.snapSettings.polar && !cadState.snapSettings.ortho) {
      point = constrainToPolar(startPoint, point, cadState.snapSettings.polarAngle);
    }

    return point;
  }, [cadState.snapSettings, cadState.gridSettings, cadState.objects, cadState.viewState.zoom]);

  const startDrawing = useCallback((point: Point) => {
    const processedPoint = getProcessedPoint(point);

    setDrawingState(prev => ({
      ...prev,
      isDrawing: true,
      startPoint: processedPoint,
      currentPoint: processedPoint,
      points: [processedPoint]
    }));
  }, [getProcessedPoint]);

  const updateDrawing = useCallback((point: Point) => {
    if (!drawingState.isDrawing && cadState.activeTool !== 'select') {
      // Just update snap preview
      const processedPoint = getProcessedPoint(point, undefined, drawingState.isShiftHeld);
      setDrawingState(prev => ({ ...prev, currentPoint: processedPoint }));
      return;
    }

    const processedPoint = getProcessedPoint(point, drawingState.startPoint || undefined, drawingState.isShiftHeld);
    setDrawingState(prev => ({ ...prev, currentPoint: processedPoint }));
  }, [drawingState.isDrawing, drawingState.startPoint, drawingState.isShiftHeld, getProcessedPoint, cadState.activeTool]);

  const finishDrawing = useCallback((point?: Point) => {
    const endPoint = point ? getProcessedPoint(point, drawingState.startPoint || undefined, drawingState.isShiftHeld) : drawingState.currentPoint;

    if (!drawingState.startPoint || !endPoint) {
      setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null, points: [] }));
      return;
    }

    const tool = cadState.activeTool as DrawTool;
    const layer = cadState.currentLayer;

    const baseObject: Omit<CADObject, 'id' | 'type' | 'data'> = {
      layerId: layer.id,
      color: cadState.currentColor,
      lineType: cadState.currentLineType,
      lineWeight: cadState.currentLineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false
    };

    switch (tool) {
      case 'dimension':
        if (!drawingState.startPoint) return;

        // Step 1: User just clicked start point (handled by startDrawing)
        // Step 2: User clicked end point. Store it, but don't finish yet.
        if (drawingState.points.length === 0 && endPoint) {
          // If release is same as start, just store the start point and wait for second click
          // If release is different (Drag), we can store both.
          const isDrag = distance(drawingState.startPoint, endPoint) > 0.1;
          if (isDrag) {
            setDrawingState(prev => ({
              ...prev,
              points: [drawingState.startPoint!, endPoint]
            }));
          } else {
            setDrawingState(prev => ({
              ...prev,
              points: [drawingState.startPoint!]
            }));
          }
          return;
        }

        // Handling second click if we only had one point
        if (drawingState.points.length === 1 && endPoint) {
          if (distance(drawingState.points[0], endPoint) > 0.1) {
            setDrawingState(prev => ({
              ...prev,
              points: [drawingState.points[0], endPoint]
            }));
          }
          return;
        }

        // Step 3: User clicked placement point. Finish.
        if (drawingState.points.length === 2) {
          const p1 = drawingState.points[0];
          const p2 = drawingState.points[1];
          const placement = endPoint; // 3rd click is placement

          if (p1 && p2 && placement) {
            // Determine alignment based on cursor position relative to the segment
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const vx = placement.x - p1.x;
            const vy = placement.y - p1.y;

            let type: 'horizontal' | 'vertical' | 'aligned' = 'aligned';

            // Heuristic for alignment choice based on cursor:
            // Calculate distances to candidate lines
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            // Dist to horizontal dim line (y = mid.y + offset?) - simpler approach:
            // If movement from mid is mostly horizontal, we want vertical dim.
            // If movement from mid is mostly vertical, we want horizontal dim.
            const mdx = Math.abs(placement.x - mid.x);
            const mdy = Math.abs(placement.y - mid.y);

            if (mdx > mdy * 2) type = 'vertical';
            else if (mdy > mdx * 2) type = 'horizontal';
            else type = 'aligned';

            cadState.addObject({
              ...baseObject,
              type: 'dimension',
              data: {
                type: type,
                points: [p1, p2],
                textPosition: placement
              }
            });
          }

          // Reset state fully
          setDrawingState(prev => ({
            ...prev,
            isDrawing: false,
            startPoint: null,
            points: []
          }));
        }
        break;

      case 'line':
        if (distance(drawingState.startPoint, endPoint) > 1) {
          cadState.addObject({
            ...baseObject,
            type: 'line',
            data: { start: drawingState.startPoint, end: endPoint }
          });
        }
        break;

      case 'rectangle':
        if (distance(drawingState.startPoint, endPoint) > 1) {
          cadState.addObject({
            ...baseObject,
            type: 'rectangle',
            data: { corner1: drawingState.startPoint, corner2: endPoint }
          });
        }
        break;

      case 'circle':
        const radius = distance(drawingState.startPoint, endPoint);
        if (radius > 1) {
          cadState.addObject({
            ...baseObject,
            type: 'circle',
            data: { center: drawingState.startPoint, radius }
          });
        }
        break;

      case 'arc': {
        // 3-point arc: center -> start point -> end angle
        if (drawingState.arcStep === 0) {
          // First click sets center, wait for second click
          setDrawingState(prev => ({
            ...prev,
            arcStep: 1,
            points: [drawingState.startPoint!]
          }));
          return; // Don't finish yet
        } else if (drawingState.arcStep === 1) {
          // Second click sets start point (radius), wait for third
          setDrawingState(prev => ({
            ...prev,
            arcStep: 2,
            points: [...prev.points, endPoint]
          }));
          return; // Don't finish yet
        } else {
          // Third click sets end angle
          const center = drawingState.points[0];
          const startPointOnArc = drawingState.points[1];
          const arcRadius = distance(center, startPointOnArc);
          const startAngle = Math.atan2(startPointOnArc.y - center.y, startPointOnArc.x - center.x);
          const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);

          if (arcRadius > 1) {
            cadState.addObject({
              ...baseObject,
              type: 'arc',
              data: { center, radius: arcRadius, startAngle, endAngle }
            });
          }
        }
        break;
      }

      case 'polygon':
        const polyRadius = distance(drawingState.startPoint, endPoint);
        if (polyRadius > 1) {
          const rotation = Math.atan2(
            endPoint.y - drawingState.startPoint.y,
            endPoint.x - drawingState.startPoint.x
          ) + Math.PI / 2;
          cadState.addObject({
            ...baseObject,
            type: 'polygon',
            data: {
              center: drawingState.startPoint,
              radius: polyRadius,
              sides: drawingState.sides,
              rotation
            }
          });
        }
        break;

      case 'ellipse': {
        // Two-step: first click = center, drag = major axis endpoint, then minor radius
        if (drawingState.arcStep === 0) {
          // First interaction: center to major axis endpoint
          const majorR = distance(drawingState.startPoint, endPoint);
          if (majorR > 1) {
            const rot = Math.atan2(
              endPoint.y - drawingState.startPoint.y,
              endPoint.x - drawingState.startPoint.x
            );
            setDrawingState(prev => ({
              ...prev,
              arcStep: 1,
              points: [drawingState.startPoint!, endPoint]
            }));
            return; // Wait for minor radius
          }
        } else {
          // Second interaction: minor radius
          const center = drawingState.points[0];
          const majorEnd = drawingState.points[1];
          const majorR = distance(center, majorEnd);
          const rot = Math.atan2(majorEnd.y - center.y, majorEnd.x - center.x);
          // Minor radius = perpendicular distance from cursor to major axis
          const dx = endPoint.x - center.x;
          const dy = endPoint.y - center.y;
          const minorR = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
          if (minorR > 0.5) {
            cadState.addObject({
              ...baseObject,
              type: 'ellipse',
              data: { center, majorRadius: majorR, minorRadius: Math.min(minorR, majorR), rotation: rot } as EllipseData
            });
          }
        }
        break;
      }

      case 'xline': {
        // Construction line through two points
        if (distance(drawingState.startPoint, endPoint) > 0.5) {
          const dx = endPoint.x - drawingState.startPoint.x;
          const dy = endPoint.y - drawingState.startPoint.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          cadState.addObject({
            ...baseObject,
            type: 'xline',
            data: { point: drawingState.startPoint, direction: { x: dx / len, y: dy / len } } as XLineData
          });
        }
        break;
      }

      case 'ray': {
        // Semi-infinite line from point in direction
        if (distance(drawingState.startPoint, endPoint) > 0.5) {
          const dx = endPoint.x - drawingState.startPoint.x;
          const dy = endPoint.y - drawingState.startPoint.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          cadState.addObject({
            ...baseObject,
            type: 'ray',
            data: { point: drawingState.startPoint, direction: { x: dx / len, y: dy / len } } as RayData
          });
        }
        break;
      }
    }

    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      points: [],
      previewObject: null,
      arcStep: 0
    }));
  }, [drawingState, cadState, getProcessedPoint]);

  const addPolylinePoint = useCallback((point: Point) => {
    const processedPoint = getProcessedPoint(point, drawingState.points[drawingState.points.length - 1]);

    if (!drawingState.isDrawing) {
      setDrawingState(prev => ({
        ...prev,
        isDrawing: true,
        startPoint: processedPoint,
        points: [processedPoint]
      }));
    } else {
      setDrawingState(prev => ({
        ...prev,
        points: [...prev.points, processedPoint]
      }));
    }
  }, [drawingState, getProcessedPoint]);

  const finishPolyline = useCallback((closed: boolean = false) => {
    if (drawingState.points.length < 2) {
      setDrawingState(prev => ({ ...prev, isDrawing: false, points: [] }));
      return;
    }

    const layer = cadState.currentLayer;
    cadState.addObject({
      type: 'polyline',
      layerId: layer.id,
      color: cadState.currentColor,
      lineType: cadState.currentLineType,
      lineWeight: cadState.currentLineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: { points: drawingState.points, closed }
    });

    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      startPoint: null,
      points: [],
      previewObject: null
    }));
  }, [drawingState.points, cadState]);

  const addSplinePoint = useCallback((point: Point) => {
    const processedPoint = getProcessedPoint(point);

    if (!drawingState.isDrawing) {
      setDrawingState(prev => ({
        ...prev,
        isDrawing: true,
        startPoint: processedPoint,
        points: [processedPoint]
      }));
    } else {
      setDrawingState(prev => ({
        ...prev,
        points: [...prev.points, processedPoint]
      }));
    }
  }, [drawingState, getProcessedPoint]);

  const finishSpline = useCallback(() => {
    if (drawingState.points.length < 2) {
      setDrawingState(prev => ({ ...prev, isDrawing: false, points: [] }));
      return;
    }

    const layer = cadState.currentLayer;
    cadState.addObject({
      type: 'spline',
      layerId: layer.id,
      color: cadState.currentColor,
      lineType: cadState.currentLineType,
      lineWeight: cadState.currentLineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: { controlPoints: drawingState.points, degree: 3 }
    });

    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      startPoint: null,
      points: [],
      previewObject: null
    }));
  }, [drawingState.points, cadState]);

  const placeText = useCallback((point: Point, content: string, height: number = 10) => {
    const processedPoint = getProcessedPoint(point);
    const layer = cadState.currentLayer;

    cadState.addObject({
      type: 'text',
      layerId: layer.id,
      color: cadState.currentColor,
      lineType: 'continuous',
      lineWeight: 0,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: {
        position: processedPoint,
        content,
        height,
        rotation: 0,
        style: 'Standard'
      }
    });
  }, [cadState, getProcessedPoint]);

  // Modify operations
  const startModifyOperation = useCallback((basePoint: Point, targetIds?: string[]) => {
    modifyBasePoint.current = basePoint;
    modifyTargetIds.current = targetIds || cadState.selectedIds;
    setDrawingState(prev => ({ ...prev, isDrawing: true, startPoint: basePoint }));
  }, [cadState.selectedIds]);

  const executeMove = useCallback((displacement: Point) => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const newData = offsetObjectData(obj.data, displacement);
      cadState.updateObject(id, { data: newData });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const executeCopy = useCallback((displacement: Point) => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const newData = offsetObjectData(obj.data, displacement);
      cadState.addObject({
        ...obj,
        data: newData,
        selected: false
      });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const executeRotate = useCallback((center: Point, angle: number) => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const newData = rotateObjectData(obj.data, center, angle);
      cadState.updateObject(id, { data: newData });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const executeScale = useCallback((center: Point, factor: number) => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const newData = scaleObjectData(obj.data, center, factor);
      cadState.updateObject(id, { data: newData });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const executeMirror = useCallback((lineStart: Point, lineEnd: Point) => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const newData = mirrorObjectData(obj.data, lineStart, lineEnd);
      cadState.addObject({
        ...obj,
        data: newData,
        selected: false
      });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const executeOffset = useCallback((offsetDist: number, side: 'left' | 'right') => {
    const ids = modifyTargetIds.current;
    if (ids.length === 0) return;

    const actualOffset = side === 'left' ? offsetDist : -offsetDist;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      switch (obj.type) {
        case 'line': {
          const data = obj.data as LineData;
          const newLine = offsetLine(data.start, data.end, actualOffset);
          cadState.addObject({ ...obj, data: newLine, selected: false });
          break;
        }
        case 'circle': {
          const data = obj.data as CircleData;
          const result = offsetCircle(data.center, data.radius, actualOffset);
          if (result.radius > 0) {
            cadState.addObject({ ...obj, data: result, selected: false });
          }
          break;
        }
        case 'arc': {
          const data = obj.data as ArcData;
          const result = offsetArc(data.center, data.radius, data.startAngle, data.endAngle, actualOffset);
          if (result.radius > 0) {
            cadState.addObject({ ...obj, data: result, selected: false });
          }
          break;
        }
        case 'polyline': {
          const data = obj.data as PolylineData;
          const newPts = offsetPolyline(data.points, actualOffset, data.closed);
          cadState.addObject({ ...obj, data: { points: newPts, closed: data.closed }, selected: false });
          break;
        }
        default:
          break;
      }
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  // Extend operation - extends a line to meet a boundary edge
  const executeExtend = useCallback((lineId: string, boundaryId: string) => {
    const lineObj = cadState.objects.find(o => o.id === lineId);
    const boundaryObj = cadState.objects.find(o => o.id === boundaryId);

    if (!lineObj || lineObj.type !== 'line' || !boundaryObj) return;

    const lineData = lineObj.data as { start: Point; end: Point };

    // Find intersection with boundary
    if (boundaryObj.type === 'line') {
      const boundaryData = boundaryObj.data as { start: Point; end: Point };

      // Extend the line direction
      const dx = lineData.end.x - lineData.start.x;
      const dy = lineData.end.y - lineData.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      // Project line far in both directions
      const extendedEnd = {
        x: lineData.end.x + (dx / len) * 10000,
        y: lineData.end.y + (dy / len) * 10000
      };

      // Find intersection
      const intersection = lineIntersectionFull(
        lineData.start, extendedEnd,
        boundaryData.start, boundaryData.end
      );

      if (intersection && isPointOnSegment(intersection, boundaryData.start, boundaryData.end)) {
        cadState.updateObject(lineId, {
          data: { start: lineData.start, end: intersection }
        });
      }
    }
  }, [cadState]);

  // Trim operation - trims a line at intersection with cutting edge
  const executeTrim = useCallback((lineId: string, cuttingEdgeId: string, clickPoint: Point) => {
    const lineObj = cadState.objects.find(o => o.id === lineId);
    const cuttingObj = cadState.objects.find(o => o.id === cuttingEdgeId);

    if (!lineObj || lineObj.type !== 'line' || !cuttingObj) return;

    const lineData = lineObj.data as { start: Point; end: Point };

    if (cuttingObj.type === 'line') {
      const cuttingData = cuttingObj.data as { start: Point; end: Point };

      const intersection = lineIntersectionFull(
        lineData.start, lineData.end,
        cuttingData.start, cuttingData.end
      );

      if (intersection && isPointOnSegment(intersection, lineData.start, lineData.end)) {
        // Determine which side of the intersection to keep based on click point
        const distToStart = distance(clickPoint, lineData.start);
        const distToEnd = distance(clickPoint, lineData.end);

        if (distToStart < distToEnd) {
          // Keep the end side, trim from start to intersection
          cadState.updateObject(lineId, {
            data: { start: intersection, end: lineData.end }
          });
        } else {
          // Keep the start side, trim from intersection to end
          cadState.updateObject(lineId, {
            data: { start: lineData.start, end: intersection }
          });
        }
      }
    }
  }, [cadState]);

  // Fillet operation - rounds a corner between two lines
  const executeFillet = useCallback((line1Id: string, line2Id: string, radius: number) => {
    const line1 = cadState.objects.find(o => o.id === line1Id);
    const line2 = cadState.objects.find(o => o.id === line2Id);

    if (!line1 || line1.type !== 'line' || !line2 || line2.type !== 'line') return;

    const data1 = line1.data as { start: Point; end: Point };
    const data2 = line2.data as { start: Point; end: Point };

    // Find intersection (corner point)
    const corner = lineIntersectionFull(data1.start, data1.end, data2.start, data2.end);
    if (!corner) return;

    // Determine which endpoints are the "outer" points (away from corner)
    const p1 = distance(data1.start, corner) > distance(data1.end, corner) ? data1.start : data1.end;
    const p2 = distance(data2.start, corner) > distance(data2.end, corner) ? data2.start : data2.end;

    // Calculate fillet geometry
    const v1 = { x: p1.x - corner.x, y: p1.y - corner.y };
    const v2 = { x: p2.x - corner.x, y: p2.y - corner.y };
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    // Calculate tangent points
    const dot = u1.x * u2.x + u1.y * u2.y;
    const halfAngle = Math.acos(Math.abs(dot)) / 2;
    const tangentDist = radius / Math.tan(halfAngle);

    if (tangentDist > len1 || tangentDist > len2) return; // Radius too large

    const trim1 = { x: corner.x + u1.x * tangentDist, y: corner.y + u1.y * tangentDist };
    const trim2 = { x: corner.x + u2.x * tangentDist, y: corner.y + u2.y * tangentDist };

    // Calculate arc center
    const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
    const bisUnit = { x: bisector.x / bisLen, y: bisector.y / bisLen };
    const centerDist = radius / Math.sin(halfAngle);
    const arcCenter = { x: corner.x + bisUnit.x * centerDist, y: corner.y + bisUnit.y * centerDist };

    const startAngle = Math.atan2(trim1.y - arcCenter.y, trim1.x - arcCenter.x);
    const endAngle = Math.atan2(trim2.y - arcCenter.y, trim2.x - arcCenter.x);

    // Update lines to trim at tangent points
    const newData1 = distance(data1.start, corner) < distance(data1.end, corner)
      ? { start: trim1, end: data1.end }
      : { start: data1.start, end: trim1 };
    const newData2 = distance(data2.start, corner) < distance(data2.end, corner)
      ? { start: trim2, end: data2.end }
      : { start: data2.start, end: trim2 };

    cadState.updateObject(line1Id, { data: newData1 });
    cadState.updateObject(line2Id, { data: newData2 });

    // Add fillet arc
    cadState.addObject({
      type: 'arc',
      layerId: line1.layerId,
      color: line1.color,
      lineType: line1.lineType,
      lineWeight: line1.lineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: { center: arcCenter, radius, startAngle, endAngle }
    });
  }, [cadState]);

  // Chamfer operation - creates a beveled corner between two lines
  const executeChamfer = useCallback((line1Id: string, line2Id: string, dist1: number, dist2: number) => {
    const line1 = cadState.objects.find(o => o.id === line1Id);
    const line2 = cadState.objects.find(o => o.id === line2Id);

    if (!line1 || line1.type !== 'line' || !line2 || line2.type !== 'line') return;

    const data1 = line1.data as { start: Point; end: Point };
    const data2 = line2.data as { start: Point; end: Point };

    const corner = lineIntersectionFull(data1.start, data1.end, data2.start, data2.end);
    if (!corner) return;

    const p1 = distance(data1.start, corner) > distance(data1.end, corner) ? data1.start : data1.end;
    const p2 = distance(data2.start, corner) > distance(data2.end, corner) ? data2.start : data2.end;

    const v1 = { x: p1.x - corner.x, y: p1.y - corner.y };
    const v2 = { x: p2.x - corner.x, y: p2.y - corner.y };
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (dist1 > len1 || dist2 > len2) return;

    const trim1 = { x: corner.x + (v1.x / len1) * dist1, y: corner.y + (v1.y / len1) * dist1 };
    const trim2 = { x: corner.x + (v2.x / len2) * dist2, y: corner.y + (v2.y / len2) * dist2 };

    const newData1 = distance(data1.start, corner) < distance(data1.end, corner)
      ? { start: trim1, end: data1.end }
      : { start: data1.start, end: trim1 };
    const newData2 = distance(data2.start, corner) < distance(data2.end, corner)
      ? { start: trim2, end: data2.end }
      : { start: data2.start, end: trim2 };

    cadState.updateObject(line1Id, { data: newData1 });
    cadState.updateObject(line2Id, { data: newData2 });

    // Add chamfer line
    cadState.addObject({
      type: 'line',
      layerId: line1.layerId,
      color: line1.color,
      lineType: line1.lineType,
      lineWeight: line1.lineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: { start: trim1, end: trim2 }
    });
  }, [cadState]);

  // Join operation - joins connected lines into a polyline
  const executeJoin = useCallback((objectIds: string[]) => {
    const lines = objectIds
      .map(id => cadState.objects.find(o => o.id === id))
      .filter((o): o is CADObject => o !== undefined && o.type === 'line');

    if (lines.length < 2) return;

    // Sort lines by connectivity
    const sortedPoints: Point[] = [];
    const usedIds = new Set<string>();

    // Start with first line
    const first = lines[0];
    const firstData = first.data as { start: Point; end: Point };
    sortedPoints.push(firstData.start, firstData.end);
    usedIds.add(first.id);

    // Find connected lines
    let changed = true;
    while (changed && usedIds.size < lines.length) {
      changed = false;
      for (const line of lines) {
        if (usedIds.has(line.id)) continue;

        const data = line.data as { start: Point; end: Point };
        const lastPoint = sortedPoints[sortedPoints.length - 1];
        const firstPoint = sortedPoints[0];

        const tolerance = 0.1;

        if (distance(data.start, lastPoint) < tolerance) {
          sortedPoints.push(data.end);
          usedIds.add(line.id);
          changed = true;
        } else if (distance(data.end, lastPoint) < tolerance) {
          sortedPoints.push(data.start);
          usedIds.add(line.id);
          changed = true;
        } else if (distance(data.end, firstPoint) < tolerance) {
          sortedPoints.unshift(data.start);
          usedIds.add(line.id);
          changed = true;
        } else if (distance(data.start, firstPoint) < tolerance) {
          sortedPoints.unshift(data.end);
          usedIds.add(line.id);
          changed = true;
        }
      }
    }

    if (usedIds.size < 2) return;

    // Check if closed
    const closed = distance(sortedPoints[0], sortedPoints[sortedPoints.length - 1]) < 0.1;
    if (closed) {
      sortedPoints.pop(); // Remove duplicate closing point
    }

    // Delete original lines
    cadState.deleteObjects(Array.from(usedIds));

    // Create polyline
    cadState.addObject({
      type: 'polyline',
      layerId: first.layerId,
      color: first.color,
      lineType: first.lineType,
      lineWeight: first.lineWeight,
      transparency: 0,
      locked: false,
      visible: true,
      selected: false,
      data: { points: sortedPoints, closed }
    });
  }, [cadState]);

  // Stretch: move selected vertices within crossing window
  const executeStretch = useCallback((selectionCorner1: Point, selectionCorner2: Point, displacement: Point) => {
    const ids = modifyTargetIds.current.length > 0 ? modifyTargetIds.current : cadState.selectedIds;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      switch (obj.type) {
        case 'line': {
          const data = obj.data as LineData;
          const newStart = isPointInRect(data.start, selectionCorner1, selectionCorner2)
            ? { x: data.start.x + displacement.x, y: data.start.y + displacement.y }
            : { ...data.start };
          const newEnd = isPointInRect(data.end, selectionCorner1, selectionCorner2)
            ? { x: data.end.x + displacement.x, y: data.end.y + displacement.y }
            : { ...data.end };
          cadState.updateObject(id, { data: { start: newStart, end: newEnd } });
          break;
        }
        case 'polyline': {
          const data = obj.data as PolylineData;
          const newPts = data.points.map(p =>
            isPointInRect(p, selectionCorner1, selectionCorner2)
              ? { x: p.x + displacement.x, y: p.y + displacement.y }
              : { ...p }
          );
          cadState.updateObject(id, { data: { points: newPts, closed: data.closed } });
          break;
        }
        case 'rectangle': {
          const data = obj.data as RectangleData;
          const newC1 = isPointInRect(data.corner1, selectionCorner1, selectionCorner2)
            ? { x: data.corner1.x + displacement.x, y: data.corner1.y + displacement.y }
            : { ...data.corner1 };
          const newC2 = isPointInRect(data.corner2, selectionCorner1, selectionCorner2)
            ? { x: data.corner2.x + displacement.x, y: data.corner2.y + displacement.y }
            : { ...data.corner2 };
          cadState.updateObject(id, { data: { corner1: newC1, corner2: newC2 } });
          break;
        }
        default: {
          // For objects that can't be stretched vertex-by-vertex, just move the whole thing
          const newData = offsetObjectData(obj.data, displacement);
          cadState.updateObject(id, { data: newData });
          break;
        }
      }
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  // Break: split entity at a point or remove segment between two points
  const executeBreak = useCallback((objectId: string, breakPoint: Point, secondBreakPoint?: Point) => {
    const obj = cadState.objects.find(o => o.id === objectId);
    if (!obj) return;

    const baseObj = {
      layerId: obj.layerId,
      color: obj.color,
      lineType: obj.lineType,
      lineWeight: obj.lineWeight,
      transparency: obj.transparency,
      locked: false,
      visible: true,
      selected: false
    };

    if (obj.type === 'line') {
      const data = obj.data as LineData;
      if (secondBreakPoint) {
        // Break between two points: remove segment
        const [seg1] = splitLineAtPoint(data.start, data.end, breakPoint);
        const [, seg2] = splitLineAtPoint(data.start, data.end, secondBreakPoint);
        cadState.deleteObjects([objectId]);
        if (distance(seg1.start, seg1.end) > 0.1) {
          cadState.addObject({ ...baseObj, type: 'line', data: seg1 });
        }
        if (distance(seg2.start, seg2.end) > 0.1) {
          cadState.addObject({ ...baseObj, type: 'line', data: seg2 });
        }
      } else {
        // Break at single point: split into two
        const [seg1, seg2] = splitLineAtPoint(data.start, data.end, breakPoint);
        cadState.deleteObjects([objectId]);
        if (distance(seg1.start, seg1.end) > 0.1) {
          cadState.addObject({ ...baseObj, type: 'line', data: seg1 });
        }
        if (distance(seg2.start, seg2.end) > 0.1) {
          cadState.addObject({ ...baseObj, type: 'line', data: seg2 });
        }
      }
    }

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  // Explode: decompose compound objects into primitives
  const executeExplode = useCallback((objectIds?: string[]) => {
    const ids = objectIds || cadState.selectedIds;
    if (ids.length === 0) return;

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;

      const baseObj = {
        layerId: obj.layerId,
        color: obj.color,
        lineType: obj.lineType,
        lineWeight: obj.lineWeight,
        transparency: obj.transparency,
        locked: false,
        visible: true,
        selected: false
      };

      switch (obj.type) {
        case 'rectangle': {
          const data = obj.data as RectangleData;
          const corners = [
            data.corner1,
            { x: data.corner2.x, y: data.corner1.y },
            data.corner2,
            { x: data.corner1.x, y: data.corner2.y }
          ];
          for (let i = 0; i < 4; i++) {
            cadState.addObject({
              ...baseObj,
              type: 'line',
              data: { start: corners[i], end: corners[(i + 1) % 4] }
            });
          }
          cadState.deleteObjects([id]);
          break;
        }
        case 'polygon': {
          const data = obj.data as PolygonData;
          const verts = generatePolygonPoints(data.center, data.radius, data.sides, data.rotation);
          for (let i = 0; i < verts.length; i++) {
            cadState.addObject({
              ...baseObj,
              type: 'line',
              data: { start: verts[i], end: verts[(i + 1) % verts.length] }
            });
          }
          cadState.deleteObjects([id]);
          break;
        }
        case 'polyline': {
          const data = obj.data as PolylineData;
          for (let i = 0; i < data.points.length - 1; i++) {
            cadState.addObject({
              ...baseObj,
              type: 'line',
              data: { start: data.points[i], end: data.points[i + 1] }
            });
          }
          if (data.closed && data.points.length > 2) {
            cadState.addObject({
              ...baseObj,
              type: 'line',
              data: { start: data.points[data.points.length - 1], end: data.points[0] }
            });
          }
          cadState.deleteObjects([id]);
          break;
        }
        case 'block': {
          const blockData = obj.data as any;
          if (blockData.objects) {
            blockData.objects.forEach((childObj: CADObject) => {
              cadState.addObject({
                ...childObj,
                selected: false
              });
            });
          }
          cadState.deleteObjects([id]);
          break;
        }
        default:
          break;
      }
    });
  }, [cadState]);

  // Rectangular Array
  const createRectangularArray = useCallback((sourceIds: string[], params: RectArrayParams, associative: boolean = false) => {
    const sourceObjs = sourceIds.map(id => cadState.objects.find(o => o.id === id)).filter((o): o is CADObject => !!o);
    if (sourceObjs.length === 0) return;

    if (associative) {
      // Create single array object
      cadState.addObject({
        type: 'array',
        layerId: sourceObjs[0].layerId,
        color: sourceObjs[0].color,
        lineType: sourceObjs[0].lineType,
        lineWeight: sourceObjs[0].lineWeight,
        transparency: 0,
        locked: false,
        visible: true,
        selected: false,
        data: {
          arrayType: 'rectangular',
          sourceObjects: sourceObjs.map(o => ({ ...o })),
          associative: true,
          rectParams: params
        } as ArrayObjectData
      });
    } else {
      // Create independent copies
      for (let r = 0; r < params.rows; r++) {
        for (let c = 0; c < params.columns; c++) {
          if (r === 0 && c === 0) continue; // Skip original position
          const offset: Point = {
            x: c * params.columnSpacing,
            y: r * params.rowSpacing
          };
          const rot = (r * params.columns + c) * params.incrementalRotation * (Math.PI / 180);
          sourceObjs.forEach(obj => {
            let newData = offsetObjectData(obj.data, offset);
            if (rot !== 0) {
              const center = { x: offset.x, y: offset.y };
              newData = rotateObjectData(newData, center, rot);
            }
            cadState.addObject({
              ...obj,
              data: newData,
              selected: false
            });
          });
        }
      }
    }
  }, [cadState]);

  // Polar Array
  const createPolarArray = useCallback((sourceIds: string[], params: PolarArrayParams, associative: boolean = false) => {
    const sourceObjs = sourceIds.map(id => cadState.objects.find(o => o.id === id)).filter((o): o is CADObject => !!o);
    if (sourceObjs.length === 0) return;

    if (associative) {
      cadState.addObject({
        type: 'array',
        layerId: sourceObjs[0].layerId,
        color: sourceObjs[0].color,
        lineType: sourceObjs[0].lineType,
        lineWeight: sourceObjs[0].lineWeight,
        transparency: 0,
        locked: false,
        visible: true,
        selected: false,
        data: {
          arrayType: 'polar',
          sourceObjects: sourceObjs.map(o => ({ ...o })),
          associative: true,
          polarParams: params
        } as ArrayObjectData
      });
    } else {
      const angleStep = (params.fillAngle * (Math.PI / 180)) / params.itemCount;
      const dir = params.clockwise ? -1 : 1;

      for (let i = 1; i < params.itemCount; i++) {
        const angle = i * angleStep * dir;
        sourceObjs.forEach(obj => {
          let newData = rotateObjectData(obj.data, params.center, angle);
          cadState.addObject({
            ...obj,
            data: newData,
            selected: false
          });
        });
      }
    }
  }, [cadState]);

  // Path Array
  const createPathArray = useCallback((sourceIds: string[], params: PathArrayParams, associative: boolean = false) => {
    const sourceObjs = sourceIds.map(id => cadState.objects.find(o => o.id === id)).filter((o): o is CADObject => !!o);
    if (sourceObjs.length === 0 || params.pathPoints.length < 2) return;

    if (associative) {
      cadState.addObject({
        type: 'array',
        layerId: sourceObjs[0].layerId,
        color: sourceObjs[0].color,
        lineType: sourceObjs[0].lineType,
        lineWeight: sourceObjs[0].lineWeight,
        transparency: 0,
        locked: false,
        visible: true,
        selected: false,
        data: {
          arrayType: 'path',
          sourceObjects: sourceObjs.map(o => ({ ...o })),
          associative: true,
          pathParams: params
        } as ArrayObjectData
      });
    } else {
      for (let i = 1; i < params.itemCount; i++) {
        const frac = i / (params.itemCount - 1);
        const { point: pathPt, angle } = pointOnPath(params.pathPoints, frac);
        sourceObjs.forEach(obj => {
          let newData = offsetObjectData(obj.data, pathPt);
          if (params.tangentAlign) {
            newData = rotateObjectData(newData, pathPt, angle);
          }
          cadState.addObject({
            ...obj,
            data: newData,
            selected: false
          });
        });
      }
    }
  }, [cadState]);

  // Align: match reference points
  const executeAlign = useCallback((sourceIds: string[], sourcePoints: Point[], destPoints: Point[]) => {
    if (sourcePoints.length < 1 || destPoints.length < 1) return;
    const ids = sourceIds.length > 0 ? sourceIds : cadState.selectedIds;
    if (ids.length === 0) return;

    // Calculate translation
    const dx = destPoints[0].x - sourcePoints[0].x;
    const dy = destPoints[0].y - sourcePoints[0].y;
    const displacement = { x: dx, y: dy };

    // If two points: translate + rotate
    let angle = 0;
    let scaleFactor = 1;
    if (sourcePoints.length >= 2 && destPoints.length >= 2) {
      const srcAngle = Math.atan2(sourcePoints[1].y - sourcePoints[0].y, sourcePoints[1].x - sourcePoints[0].x);
      const dstAngle = Math.atan2(destPoints[1].y - destPoints[0].y, destPoints[1].x - destPoints[0].x);
      angle = dstAngle - srcAngle;

      if (sourcePoints.length >= 3 && destPoints.length >= 3) {
        const srcDist = distance(sourcePoints[0], sourcePoints[1]);
        const dstDist = distance(destPoints[0], destPoints[1]);
        scaleFactor = srcDist > 0 ? dstDist / srcDist : 1;
      }
    }

    ids.forEach(id => {
      const obj = cadState.objects.find(o => o.id === id);
      if (!obj) return;
      let newData = offsetObjectData(obj.data, displacement);
      if (angle !== 0) {
        newData = rotateObjectData(newData, destPoints[0], angle);
      }
      if (scaleFactor !== 1) {
        newData = scaleObjectData(newData, destPoints[0], scaleFactor);
      }
      cadState.updateObject(id, { data: newData });
    });

    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState(prev => ({ ...prev, isDrawing: false, startPoint: null }));
  }, [cadState]);

  const cancelDrawing = useCallback(() => {
    modifyBasePoint.current = null;
    modifyTargetIds.current = [];
    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      points: [],
      previewObject: null,
      snapResult: null,
      inputValue: '',
      sides: 6,
      textContent: '',
      arcStep: 0,
      arrayStep: 'idle',
      arrayType: null,
      arraySourceIds: [],
      arrayParams: { ...DEFAULT_ARRAY_PARAMS },
      arrayPreviewObjects: [],
      arrayPrompt: '',
      isShiftHeld: false,
      shiftConstrainedAngle: null
    });
  }, []);

  const setPolygonSides = useCallback((sides: number) => {
    setDrawingState(prev => ({ ...prev, sides: Math.max(3, Math.min(sides, 100)) }));
  }, []);

  const setInputValue = useCallback((value: string) => {
    setDrawingState(prev => ({ ...prev, inputValue: value }));
  }, []);

  const setTextContent = useCallback((content: string) => {
    setDrawingState(prev => ({ ...prev, textContent: content }));
  }, []);

  // Shift-key tracking
  const setShiftHeld = useCallback((held: boolean) => {
    setDrawingState(prev => ({ ...prev, isShiftHeld: held }));
  }, []);

  // ========== Array Interactive Workflow ==========

  // Generate preview objects for the current array params
  const generateArrayPreviewObjects = useCallback((sourceIds: string[], params: ArrayWorkflowParams, arrayType: 'rectangular' | 'polar' | 'path'): CADObject[] => {
    const sourceObjs = sourceIds.map(id => cadState.objects.find(o => o.id === id)).filter((o): o is CADObject => !!o);
    if (sourceObjs.length === 0) return [];

    const previews: CADObject[] = [];

    if (arrayType === 'rectangular') {
      for (let r = 0; r < params.rows; r++) {
        for (let c = 0; c < params.columns; c++) {
          if (r === 0 && c === 0) continue;
          const offset: Point = {
            x: c * params.columnSpacing,
            y: r * params.rowSpacing
          };
          const rot = (r * params.columns + c) * params.incrementalRotation * (Math.PI / 180);
          sourceObjs.forEach(obj => {
            let newData = offsetObjectData(obj.data, offset);
            if (rot !== 0) {
              newData = rotateObjectData(newData, offset, rot);
            }
            previews.push({
              ...obj,
              id: `array-preview-${r}-${c}-${obj.id}`,
              data: newData,
              selected: false,
              transparency: 0.6
            });
          });
        }
      }
    } else if (arrayType === 'polar' && params.center) {
      const angleStep = (params.fillAngle * (Math.PI / 180)) / params.itemCount;
      const dir = params.clockwise ? -1 : 1;
      for (let i = 1; i < params.itemCount; i++) {
        const angle = i * angleStep * dir;
        sourceObjs.forEach(obj => {
          let newData = rotateObjectData(obj.data, params.center!, angle);
          previews.push({
            ...obj,
            id: `array-preview-polar-${i}-${obj.id}`,
            data: newData,
            selected: false,
            transparency: 0.6
          });
        });
      }
    } else if (arrayType === 'path' && params.pathPoints.length >= 2) {
      for (let i = 1; i < params.itemCount; i++) {
        const frac = i / (params.itemCount - 1);
        const { point: pathPt, angle } = pointOnPath(params.pathPoints, frac);
        sourceObjs.forEach(obj => {
          let newData = offsetObjectData(obj.data, pathPt);
          if (params.tangentAlign) {
            newData = rotateObjectData(newData, pathPt, angle);
          }
          previews.push({
            ...obj,
            id: `array-preview-path-${i}-${obj.id}`,
            data: newData,
            selected: false,
            transparency: 0.6
          });
        });
      }
    }

    return previews;
  }, [cadState.objects]);

  // Start array workflow when user clicks array tool
  const startArrayWorkflow = useCallback((arrayType: 'rectangular' | 'polar' | 'path') => {
    const selectedIds = cadState.selectedIds;
    if (selectedIds.length > 0) {
      // Objects already selected — skip to next step
      if (arrayType === 'polar') {
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'set-center',
          arrayType,
          arraySourceIds: [...selectedIds],
          arrayParams: { ...DEFAULT_ARRAY_PARAMS },
          arrayPreviewObjects: [],
          arrayPrompt: 'Specify center point for polar array.'
        }));
      } else if (arrayType === 'path') {
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'set-params',
          arrayType,
          arraySourceIds: [...selectedIds],
          arrayParams: { ...DEFAULT_ARRAY_PARAMS, pathPoints: [] },
          arrayPreviewObjects: [],
          arrayPrompt: 'Click to define path points. Double-click or Enter to finish.'
        }));
      } else {
        // Rectangular: show preview immediately
        const params = { ...DEFAULT_ARRAY_PARAMS };
        const previews = generateArrayPreviewObjects(selectedIds, params, 'rectangular');
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'preview',
          arrayType,
          arraySourceIds: [...selectedIds],
          arrayParams: params,
          arrayPreviewObjects: previews,
          arrayPrompt: 'Adjust array parameters. Press Enter or click Confirm to apply.'
        }));
      }
    } else {
      // No selection: prompt
      setDrawingState(prev => ({
        ...prev,
        arrayStep: 'select-objects',
        arrayType,
        arraySourceIds: [],
        arrayParams: { ...DEFAULT_ARRAY_PARAMS },
        arrayPreviewObjects: [],
        arrayPrompt: `Select object(s) for ${arrayType} array. Press Enter when done.`
      }));
    }
  }, [cadState.selectedIds, generateArrayPreviewObjects]);

  // Handle canvas clicks during array workflow
  const handleArrayClick = useCallback((worldPoint: Point) => {
    const step = drawingState.arrayStep;
    const arrayType = drawingState.arrayType;
    if (!arrayType) return;

    if (step === 'select-objects') {
      // Find object at click point and add to selection
      // (Selection is handled by InfiniteCanvas — we just check if user confirms)
      return; // Selection is handled by canvas select logic
    }

    if (step === 'set-center' && arrayType === 'polar') {
      // Set center point and generate preview
      const params = { ...drawingState.arrayParams, center: worldPoint };
      const previews = generateArrayPreviewObjects(drawingState.arraySourceIds, params, 'polar');
      setDrawingState(prev => ({
        ...prev,
        arrayStep: 'preview',
        arrayParams: params,
        arrayPreviewObjects: previews,
        arrayPrompt: 'Adjust polar array parameters. Press Enter or click Confirm.'
      }));
      return;
    }

    if (step === 'set-params' && arrayType === 'path') {
      // Add path point
      const newPathPoints = [...drawingState.arrayParams.pathPoints, worldPoint];
      const params = { ...drawingState.arrayParams, pathPoints: newPathPoints };
      if (newPathPoints.length >= 2) {
        const previews = generateArrayPreviewObjects(drawingState.arraySourceIds, params, 'path');
        setDrawingState(prev => ({
          ...prev,
          arrayParams: params,
          arrayPreviewObjects: previews,
          arrayPrompt: `Path: ${newPathPoints.length} points defined. Double-click or Enter to confirm path.`
        }));
      } else {
        setDrawingState(prev => ({
          ...prev,
          arrayParams: params,
          arrayPrompt: `Path: ${newPathPoints.length} point(s). Click more points.`
        }));
      }
      return;
    }
  }, [drawingState.arrayStep, drawingState.arrayType, drawingState.arrayParams, drawingState.arraySourceIds, generateArrayPreviewObjects]);

  // Confirm selection and advance to next step
  const confirmArraySelection = useCallback(() => {
    const step = drawingState.arrayStep;
    const arrayType = drawingState.arrayType;
    if (!arrayType) return;

    if (step === 'select-objects') {
      const selectedIds = cadState.selectedIds;
      if (selectedIds.length === 0) return;

      if (arrayType === 'polar') {
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'set-center',
          arraySourceIds: [...selectedIds],
          arrayPrompt: 'Specify center point for polar array.'
        }));
      } else if (arrayType === 'path') {
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'set-params',
          arraySourceIds: [...selectedIds],
          arrayPrompt: 'Click to define path points. Double-click or Enter to finish.'
        }));
      } else {
        // Rectangular
        const params = { ...drawingState.arrayParams };
        const previews = generateArrayPreviewObjects(selectedIds, params, 'rectangular');
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'preview',
          arraySourceIds: [...selectedIds],
          arrayParams: params,
          arrayPreviewObjects: previews,
          arrayPrompt: 'Adjust array parameters. Press Enter or click Confirm.'
        }));
      }
    } else if (step === 'set-params' && arrayType === 'path') {
      // Finish path definition
      if (drawingState.arrayParams.pathPoints.length >= 2) {
        const previews = generateArrayPreviewObjects(drawingState.arraySourceIds, drawingState.arrayParams, 'path');
        setDrawingState(prev => ({
          ...prev,
          arrayStep: 'preview',
          arrayPreviewObjects: previews,
          arrayPrompt: 'Adjust path array parameters. Press Enter or click Confirm.'
        }));
      }
    }
  }, [drawingState.arrayStep, drawingState.arrayType, drawingState.arrayParams, drawingState.arraySourceIds, cadState.selectedIds, generateArrayPreviewObjects]);

  // Update array params and regenerate preview
  const updateArrayParams = useCallback((updates: Partial<ArrayWorkflowParams>) => {
    setDrawingState(prev => {
      const newParams = { ...prev.arrayParams, ...updates };
      const previews = prev.arrayType ? generateArrayPreviewObjects(prev.arraySourceIds, newParams, prev.arrayType) : [];
      return {
        ...prev,
        arrayParams: newParams,
        arrayPreviewObjects: previews
      };
    });
  }, [generateArrayPreviewObjects]);

  // Confirm and commit the array
  const confirmArray = useCallback(() => {
    const { arrayType, arraySourceIds, arrayParams } = drawingState;
    if (!arrayType || arraySourceIds.length === 0) return;

    if (arrayType === 'rectangular') {
      createRectangularArray(arraySourceIds, {
        rows: arrayParams.rows,
        columns: arrayParams.columns,
        rowSpacing: arrayParams.rowSpacing,
        columnSpacing: arrayParams.columnSpacing,
        incrementalRotation: arrayParams.incrementalRotation,
        incrementalScale: 1,
        levels: 1,
        levelSpacing: 0
      }, arrayParams.associative);
    } else if (arrayType === 'polar' && arrayParams.center) {
      createPolarArray(arraySourceIds, {
        center: arrayParams.center,
        itemCount: arrayParams.itemCount,
        fillAngle: arrayParams.fillAngle,
        angularSpacing: arrayParams.fillAngle / arrayParams.itemCount,
        rotateItems: arrayParams.rotateItems,
        clockwise: arrayParams.clockwise
      }, arrayParams.associative);
    } else if (arrayType === 'path' && arrayParams.pathPoints.length >= 2) {
      createPathArray(arraySourceIds, {
        pathPoints: arrayParams.pathPoints,
        itemCount: arrayParams.itemCount,
        tangentAlign: arrayParams.tangentAlign,
        startOffset: arrayParams.startOffset,
        endOffset: arrayParams.endOffset,
        spacing: arrayParams.spacing
      }, arrayParams.associative);
    }

    // Reset
    setDrawingState(prev => ({
      ...prev,
      arrayStep: 'idle',
      arrayType: null,
      arraySourceIds: [],
      arrayParams: { ...DEFAULT_ARRAY_PARAMS },
      arrayPreviewObjects: [],
      arrayPrompt: ''
    }));
  }, [drawingState, createRectangularArray, createPolarArray, createPathArray]);

  return {
    drawingState,
    startDrawing,
    updateDrawing,
    finishDrawing,
    addPolylinePoint,
    finishPolyline,
    addSplinePoint,
    finishSpline,
    placeText,
    startModifyOperation,
    executeMove,
    executeCopy,
    executeRotate,
    executeScale,
    executeMirror,
    executeOffset,
    executeExtend,
    executeTrim,
    executeFillet,
    executeChamfer,
    executeJoin,
    executeStretch,
    executeBreak,
    executeExplode,
    executeAlign,
    createRectangularArray,
    createPolarArray,
    createPathArray,
    cancelDrawing,
    setPolygonSides,
    setInputValue,
    setTextContent,
    getProcessedPoint,
    // Array workflow
    startArrayWorkflow,
    handleArrayClick,
    confirmArraySelection,
    updateArrayParams,
    confirmArray,
    // Shift constraint
    setShiftHeld
  };
}

// Helper functions
function lineIntersectionFull(l1Start: Point, l1End: Point, l2Start: Point, l2End: Point): Point | null {
  const x1 = l1Start.x, y1 = l1Start.y, x2 = l1End.x, y2 = l1End.y;
  const x3 = l2Start.x, y3 = l2Start.y, x4 = l2End.x, y4 = l2End.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

function isPointOnSegment(point: Point, start: Point, end: Point, tolerance: number = 0.1): boolean {
  const d1 = distance(point, start);
  const d2 = distance(point, end);
  const lineLen = distance(start, end);
  return Math.abs(d1 + d2 - lineLen) < tolerance;
}

// Helper functions for object data transformation
function offsetObjectData(data: any, offset: Point): any {
  if (data.start && data.end) {
    return {
      ...data,
      start: { x: data.start.x + offset.x, y: data.start.y + offset.y },
      end: { x: data.end.x + offset.x, y: data.end.y + offset.y }
    };
  }
  if (data.center) {
    return {
      ...data,
      center: { x: data.center.x + offset.x, y: data.center.y + offset.y }
    };
  }
  if (data.corner1 && data.corner2) {
    return {
      ...data,
      corner1: { x: data.corner1.x + offset.x, y: data.corner1.y + offset.y },
      corner2: { x: data.corner2.x + offset.x, y: data.corner2.y + offset.y }
    };
  }
  if (data.points) {
    return {
      ...data,
      points: data.points.map((p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y }))
    };
  }
  if (data.controlPoints) {
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y }))
    };
  }
  if (data.position) {
    return {
      ...data,
      position: { x: data.position.x + offset.x, y: data.position.y + offset.y }
    };
  }
  return data;
}

function rotateObjectData(data: any, center: Point, angle: number): any {
  if (data.start && data.end) {
    return {
      ...data,
      start: rotatePoint(data.start, center, angle),
      end: rotatePoint(data.end, center, angle)
    };
  }
  if (data.center && !data.corner1) {
    return {
      ...data,
      center: rotatePoint(data.center, center, angle),
      rotation: (data.rotation || 0) + angle
    };
  }
  if (data.corner1 && data.corner2) {
    return {
      ...data,
      corner1: rotatePoint(data.corner1, center, angle),
      corner2: rotatePoint(data.corner2, center, angle)
    };
  }
  if (data.points) {
    return {
      ...data,
      points: data.points.map((p: Point) => rotatePoint(p, center, angle))
    };
  }
  if (data.controlPoints) {
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => rotatePoint(p, center, angle))
    };
  }
  if (data.position) {
    return {
      ...data,
      position: rotatePoint(data.position, center, angle),
      rotation: (data.rotation || 0) + angle
    };
  }
  return data;
}

function scaleObjectData(data: any, center: Point, factor: number): any {
  if (data.start && data.end) {
    return {
      ...data,
      start: scalePoint(data.start, center, factor),
      end: scalePoint(data.end, center, factor)
    };
  }
  if (data.center && data.radius !== undefined) {
    return {
      ...data,
      center: scalePoint(data.center, center, factor),
      radius: data.radius * factor
    };
  }
  if (data.corner1 && data.corner2) {
    return {
      ...data,
      corner1: scalePoint(data.corner1, center, factor),
      corner2: scalePoint(data.corner2, center, factor)
    };
  }
  if (data.points) {
    return {
      ...data,
      points: data.points.map((p: Point) => scalePoint(p, center, factor))
    };
  }
  if (data.controlPoints) {
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => scalePoint(p, center, factor))
    };
  }
  if (data.position) {
    return {
      ...data,
      position: scalePoint(data.position, center, factor),
      height: (data.height || 10) * factor
    };
  }
  return data;
}

function mirrorObjectData(data: any, lineStart: Point, lineEnd: Point): any {
  if (data.start && data.end) {
    return {
      ...data,
      start: mirrorPoint(data.start, lineStart, lineEnd),
      end: mirrorPoint(data.end, lineStart, lineEnd)
    };
  }
  if (data.center && !data.corner1) {
    return {
      ...data,
      center: mirrorPoint(data.center, lineStart, lineEnd)
    };
  }
  if (data.corner1 && data.corner2) {
    return {
      ...data,
      corner1: mirrorPoint(data.corner1, lineStart, lineEnd),
      corner2: mirrorPoint(data.corner2, lineStart, lineEnd)
    };
  }
  if (data.points) {
    return {
      ...data,
      points: data.points.map((p: Point) => mirrorPoint(p, lineStart, lineEnd))
    };
  }
  if (data.controlPoints) {
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => mirrorPoint(p, lineStart, lineEnd))
    };
  }
  if (data.position) {
    return {
      ...data,
      position: mirrorPoint(data.position, lineStart, lineEnd)
    };
  }
  return data;
}

export type DrawingToolsAPI = ReturnType<typeof useDrawingTools>;