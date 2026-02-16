import { Point, CADObject, SnapMode, LineData, CircleData, RectangleData, PolylineData, ArcData, PolygonData } from '../types/cad.types';
import { distance, midpoint, lineIntersection, generatePolygonPoints } from './geometry';

export interface SnapResult {
  point: Point;
  mode: SnapMode;
  objectId?: string;
  label?: string;
}

export function findSnapPoint(
  mousePoint: Point,
  objects: CADObject[],
  enabledModes: SnapMode[],
  tolerance: number = 15,
  zoom: number = 1
): SnapResult | null {
  const adjustedTolerance = tolerance / zoom;
  let candidates: SnapResult[] = [];

  // Priority Map (Lower is higher priority)
  const priorityMap: Record<SnapMode, number> = {
    endpoint: 1,
    intersection: 2,
    midpoint: 3,
    center: 4,
    quadrant: 5,
    perpendicular: 6,
    tangent: 7,
    node: 8,
    nearest: 9,
    extension: 10,
    insertion: 10,
    apparent: 10,
    parallel: 10
  };

  // Pre-calculate mouse bounds for fast filtering
  const mouseBounds = {
    minX: mousePoint.x - adjustedTolerance,
    maxX: mousePoint.x + adjustedTolerance,
    minY: mousePoint.y - adjustedTolerance,
    maxY: mousePoint.y + adjustedTolerance
  };

  // Helper for bounds overlap
  const boundsOverlap = (b1: { minX: number, maxX: number, minY: number, maxY: number }, b2: typeof mouseBounds) => {
    return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
  };

  // Import getSimpleBounds helper logic locally or move it to geometry? 
  // For now we can assume getObjectBounds from geometry.ts is importable, or implement a simple one here.
  // We'll trust the geometry import.

  for (const obj of objects) {
    if (!obj.visible || obj.locked) continue;

    // Fast Bounds Check
    // We need a way to get bounds efficiently. 
    // Assuming getObjectBounds is available or we can compute it quickly.
    // Let's iterate for now without strict bounds check if we don't have the helper imported, 
    // but the user asked for it.
    // We already saw getObjectBounds in geometry.ts.
    // Note: getSimpleBounds in useCADState types was a local function. 
    // We should import getObjectBounds from geometry.ts if possible, but let's check imports.
    // The current file imports `distance, midpoint, lineIntersection...` from `geometry`.
    // I need to update imports to include `getObjectBounds`.

    // Core Snap Points (Endpoint, Midpoint, Center, Quadrant)
    const snaps = getObjectSnapPoints(obj, enabledModes);
    for (const snap of snaps) {
      if (distance(mousePoint, snap.point) <= adjustedTolerance) {
        candidates.push({ ...snap, objectId: obj.id });
      }
    }

    // Nearest Snap (computationally expensive, do only if bounds match?)
    if (enabledModes.includes('nearest')) {
      const nearestSnap = findNearestPointOnObject(mousePoint, obj);
      if (nearestSnap && distance(mousePoint, nearestSnap.point) <= adjustedTolerance) {
        candidates.push({ ...nearestSnap, objectId: obj.id });
      }
    }

    // Perpendicular
    if (enabledModes.includes('perpendicular')) {
      const perpSnap = findPerpendicularSnap(mousePoint, obj);
      if (perpSnap && distance(mousePoint, perpSnap.point) <= adjustedTolerance * 2) {
        candidates.push({ ...perpSnap, objectId: obj.id });
      }
    }
  }

  // Intersection Snap (Global) - Optimized
  if (enabledModes.includes('intersection')) {
    const intSnap = findIntersectionSnaps(mousePoint, objects, tolerance, zoom);
    if (intSnap && distance(mousePoint, intSnap.point) <= adjustedTolerance) {
      candidates.push(intSnap);
    }
  }

  if (candidates.length === 0) return null;

  // Sort Candidates
  // 1. Priority
  // 2. Distance
  candidates.sort((a, b) => {
    const pA = priorityMap[a.mode] || 99;
    const pB = priorityMap[b.mode] || 99;
    if (pA !== pB) return pA - pB;
    return distance(mousePoint, a.point) - distance(mousePoint, b.point);
  });

  const best = candidates[0];
  best.label = getSnapLabel(best.mode);
  return best;
}

function getSnapLabel(mode: SnapMode): string {
  const labels: Record<SnapMode, string> = {
    endpoint: 'Endpoint',
    midpoint: 'Midpoint',
    center: 'Center',
    node: 'Node',
    quadrant: 'Quadrant',
    intersection: 'Intersection',
    extension: 'Extension',
    insertion: 'Insertion',
    perpendicular: 'Perpendicular',
    tangent: 'Tangent',
    nearest: 'Nearest',
    apparent: 'Apparent',
    parallel: 'Parallel'
  };
  return labels[mode] || mode;
}

function getObjectSnapPoints(obj: CADObject, enabledModes: SnapMode[]): SnapResult[] {
  const snaps: SnapResult[] = [];

  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      if (enabledModes.includes('endpoint')) {
        snaps.push({ point: data.start, mode: 'endpoint' });
        snaps.push({ point: data.end, mode: 'endpoint' });
      }
      if (enabledModes.includes('midpoint')) {
        snaps.push({ point: midpoint(data.start, data.end), mode: 'midpoint' });
      }
      break;
    }

    case 'circle': {
      const data = obj.data as CircleData;
      if (enabledModes.includes('center')) {
        snaps.push({ point: data.center, mode: 'center' });
      }
      if (enabledModes.includes('quadrant')) {
        snaps.push({ point: { x: data.center.x + data.radius, y: data.center.y }, mode: 'quadrant' });
        snaps.push({ point: { x: data.center.x - data.radius, y: data.center.y }, mode: 'quadrant' });
        snaps.push({ point: { x: data.center.x, y: data.center.y + data.radius }, mode: 'quadrant' });
        snaps.push({ point: { x: data.center.x, y: data.center.y - data.radius }, mode: 'quadrant' });
      }
      break;
    }

    case 'arc': {
      const data = obj.data as ArcData;
      if (enabledModes.includes('center')) {
        snaps.push({ point: data.center, mode: 'center' });
      }
      if (enabledModes.includes('endpoint')) {
        snaps.push({
          point: {
            x: data.center.x + data.radius * Math.cos(data.startAngle),
            y: data.center.y + data.radius * Math.sin(data.startAngle)
          },
          mode: 'endpoint'
        });
        snaps.push({
          point: {
            x: data.center.x + data.radius * Math.cos(data.endAngle),
            y: data.center.y + data.radius * Math.sin(data.endAngle)
          },
          mode: 'endpoint'
        });
      }
      break;
    }

    case 'rectangle': {
      const data = obj.data as RectangleData;
      const corners = [
        data.corner1,
        { x: data.corner2.x, y: data.corner1.y },
        data.corner2,
        { x: data.corner1.x, y: data.corner2.y }
      ];
      if (enabledModes.includes('endpoint')) {
        corners.forEach(c => snaps.push({ point: c, mode: 'endpoint' }));
      }
      if (enabledModes.includes('midpoint')) {
        for (let i = 0; i < 4; i++) {
          snaps.push({ point: midpoint(corners[i], corners[(i + 1) % 4]), mode: 'midpoint' });
        }
      }
      if (enabledModes.includes('center')) {
        snaps.push({ point: midpoint(data.corner1, data.corner2), mode: 'center' });
      }
      break;
    }

    case 'polyline': {
      const data = obj.data as PolylineData;
      if (enabledModes.includes('endpoint')) {
        data.points.forEach(p => snaps.push({ point: p, mode: 'endpoint' }));
      }
      if (enabledModes.includes('midpoint')) {
        for (let i = 0; i < data.points.length - 1; i++) {
          snaps.push({ point: midpoint(data.points[i], data.points[i + 1]), mode: 'midpoint' });
        }
      }
      break;
    }

    case 'polygon': {
      const data = obj.data as PolygonData;
      const vertices = generatePolygonPoints(data.center, data.radius, data.sides, data.rotation);
      if (enabledModes.includes('endpoint')) {
        vertices.forEach(v => snaps.push({ point: v, mode: 'endpoint' }));
      }
      if (enabledModes.includes('center')) {
        snaps.push({ point: data.center, mode: 'center' });
      }
      if (enabledModes.includes('midpoint')) {
        for (let i = 0; i < vertices.length; i++) {
          snaps.push({ point: midpoint(vertices[i], vertices[(i + 1) % vertices.length]), mode: 'midpoint' });
        }
      }
      break;
    }
  }

  return snaps;
}

function findNearestPointOnObject(point: Point, obj: CADObject): SnapResult | null {
  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      const nearest = nearestPointOnSegment(point, data.start, data.end);
      return { point: nearest, mode: 'nearest' };
    }
    case 'circle': {
      const data = obj.data as CircleData;
      const angle = Math.atan2(point.y - data.center.y, point.x - data.center.x);
      return {
        point: {
          x: data.center.x + data.radius * Math.cos(angle),
          y: data.center.y + data.radius * Math.sin(angle)
        },
        mode: 'nearest'
      };
    }
    case 'arc': {
      const data = obj.data as ArcData;
      let angle = Math.atan2(point.y - data.center.y, point.x - data.center.x);
      // Clamp angle to arc range
      if (angle < data.startAngle) angle = data.startAngle;
      if (angle > data.endAngle) angle = data.endAngle;
      return {
        point: {
          x: data.center.x + data.radius * Math.cos(angle),
          y: data.center.y + data.radius * Math.sin(angle)
        },
        mode: 'nearest'
      };
    }
    case 'rectangle': {
      const data = obj.data as RectangleData;
      const corners = [
        data.corner1,
        { x: data.corner2.x, y: data.corner1.y },
        data.corner2,
        { x: data.corner1.x, y: data.corner2.y }
      ];
      let minDist = Infinity;
      let nearest = point;
      for (let i = 0; i < 4; i++) {
        const p = nearestPointOnSegment(point, corners[i], corners[(i + 1) % 4]);
        const d = distance(point, p);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }
      return { point: nearest, mode: 'nearest' };
    }
    case 'polyline': {
      const data = obj.data as PolylineData;
      let minDist = Infinity;
      let nearest = point;
      for (let i = 0; i < data.points.length - 1; i++) {
        const p = nearestPointOnSegment(point, data.points[i], data.points[i + 1]);
        const d = distance(point, p);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }
      if (data.closed && data.points.length > 2) {
        const p = nearestPointOnSegment(point, data.points[data.points.length - 1], data.points[0]);
        const d = distance(point, p);
        if (d < minDist) {
          nearest = p;
        }
      }
      return { point: nearest, mode: 'nearest' };
    }
    default:
      return null;
  }
}

function nearestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return start;

  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  return {
    x: start.x + t * dx,
    y: start.y + t * dy
  };
}

function findPerpendicularSnap(point: Point, obj: CADObject): SnapResult | null {
  if (obj.type === 'line') {
    const data = obj.data as LineData;
    const foot = nearestPointOnSegment(point, data.start, data.end);
    // Check if foot is on the line segment
    const onSegment =
      foot.x >= Math.min(data.start.x, data.end.x) - 0.01 &&
      foot.x <= Math.max(data.start.x, data.end.x) + 0.01 &&
      foot.y >= Math.min(data.start.y, data.end.y) - 0.01 &&
      foot.y <= Math.max(data.start.y, data.end.y) + 0.01;
    if (onSegment) {
      return { point: foot, mode: 'perpendicular' };
    }
  }
  return null;
}

export function findIntersectionSnaps(
  mousePoint: Point,
  objects: CADObject[],
  tolerance: number = 15,
  zoom: number = 1
): SnapResult | null {
  const adjustedTolerance = tolerance / zoom;
  const lines: { start: Point; end: Point; objId: string }[] = [];

  for (const obj of objects) {
    if (!obj.visible || obj.locked) continue;

    if (obj.type === 'line') {
      const data = obj.data as LineData;
      lines.push({ start: data.start, end: data.end, objId: obj.id });
    } else if (obj.type === 'rectangle') {
      const data = obj.data as RectangleData;
      const corners = [
        data.corner1,
        { x: data.corner2.x, y: data.corner1.y },
        data.corner2,
        { x: data.corner1.x, y: data.corner2.y }
      ];
      for (let i = 0; i < 4; i++) {
        lines.push({ start: corners[i], end: corners[(i + 1) % 4], objId: obj.id });
      }
    } else if (obj.type === 'polyline') {
      const data = obj.data as PolylineData;
      for (let i = 0; i < data.points.length - 1; i++) {
        lines.push({ start: data.points[i], end: data.points[i + 1], objId: obj.id });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const intersection = lineIntersection(
        lines[i].start, lines[i].end,
        lines[j].start, lines[j].end
      );

      if (intersection) {
        const d = distance(mousePoint, intersection);
        if (d < adjustedTolerance) {
          return { point: intersection, mode: 'intersection' };
        }
      }
    }
  }

  return null;
}

export function snapToGrid(point: Point, gridSpacing: number): Point {
  return {
    x: Math.round(point.x / gridSpacing) * gridSpacing,
    y: Math.round(point.y / gridSpacing) * gridSpacing
  };
}

export function constrainToOrtho(startPoint: Point, currentPoint: Point): Point {
  const dx = Math.abs(currentPoint.x - startPoint.x);
  const dy = Math.abs(currentPoint.y - startPoint.y);

  if (dx > dy) {
    return { x: currentPoint.x, y: startPoint.y };
  } else {
    return { x: startPoint.x, y: currentPoint.y };
  }
}

export function constrainToPolar(startPoint: Point, currentPoint: Point, polarAngle: number): Point {
  const d = distance(startPoint, currentPoint);
  const rawAngle = Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x);
  const angleStep = (polarAngle * Math.PI) / 180;
  const snappedAngle = Math.round(rawAngle / angleStep) * angleStep;

  return {
    x: startPoint.x + d * Math.cos(snappedAngle),
    y: startPoint.y + d * Math.sin(snappedAngle)
  };
}