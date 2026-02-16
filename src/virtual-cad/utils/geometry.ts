import { Point, CADObject, LineData, CircleData, ArcData, RectangleData, PolygonData, PolylineData, SplineData } from '../types/cad.types';

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function rotatePoint(point: Point, center: Point, angleRad: number): Point {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

export function scalePoint(point: Point, center: Point, scale: number): Point {
  return {
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  };
}

export function mirrorPoint(point: Point, lineStart: Point, lineEnd: Point): Point {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = dx * dx + dy * dy;
  if (len === 0) return point;

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return {
    x: 2 * projX - point.x,
    y: 2 * projY - point.y
  };
}

export function offsetPoint(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

export function pointOnLine(point: Point, lineStart: Point, lineEnd: Point, tolerance: number = 5): boolean {
  const d1 = distance(point, lineStart);
  const d2 = distance(point, lineEnd);
  const lineLen = distance(lineStart, lineEnd);
  return Math.abs(d1 + d2 - lineLen) < tolerance;
}

export function pointInCircle(point: Point, center: Point, radius: number, tolerance: number = 5): boolean {
  const d = distance(point, center);
  return Math.abs(d - radius) < tolerance;
}

export function pointInRectangle(point: Point, corner1: Point, corner2: Point): boolean {
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxY = Math.max(corner1.y, corner2.y);
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function getObjectBounds(obj: CADObject): { min: Point; max: Point } {
  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      return {
        min: { x: Math.min(data.start.x, data.end.x), y: Math.min(data.start.y, data.end.y) },
        max: { x: Math.max(data.start.x, data.end.x), y: Math.max(data.start.y, data.end.y) }
      };
    }
    case 'circle': {
      const data = obj.data as CircleData;
      return {
        min: { x: data.center.x - data.radius, y: data.center.y - data.radius },
        max: { x: data.center.x + data.radius, y: data.center.y + data.radius }
      };
    }
    case 'rectangle': {
      const data = obj.data as RectangleData;
      return {
        min: { x: Math.min(data.corner1.x, data.corner2.x), y: Math.min(data.corner1.y, data.corner2.y) },
        max: { x: Math.max(data.corner1.x, data.corner2.x), y: Math.max(data.corner1.y, data.corner2.y) }
      };
    }
    case 'polyline': {
      const data = obj.data as PolylineData;
      const xs = data.points.map(p => p.x);
      const ys = data.points.map(p => p.y);
      return {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) }
      };
    }
    case 'polygon': {
      const data = obj.data as PolygonData;
      return {
        min: { x: data.center.x - data.radius, y: data.center.y - data.radius },
        max: { x: data.center.x + data.radius, y: data.center.y + data.radius }
      };
    }
    case 'arc': {
      const data = obj.data as ArcData;
      return {
        min: { x: data.center.x - data.radius, y: data.center.y - data.radius },
        max: { x: data.center.x + data.radius, y: data.center.y + data.radius }
      };
    }
    default:
      return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }
}

export function getObjectCenter(obj: CADObject): Point {
  const bounds = getObjectBounds(obj);
  return midpoint(bounds.min, bounds.max);
}

export function isPointNearObject(point: Point, obj: CADObject, tolerance: number = 10): boolean {
  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      return pointOnLine(point, data.start, data.end, tolerance);
    }
    case 'circle': {
      const data = obj.data as CircleData;
      return pointInCircle(point, data.center, data.radius, tolerance);
    }
    case 'rectangle': {
      const data = obj.data as RectangleData;
      const corners = [
        data.corner1,
        { x: data.corner2.x, y: data.corner1.y },
        data.corner2,
        { x: data.corner1.x, y: data.corner2.y }
      ];
      for (let i = 0; i < 4; i++) {
        if (pointOnLine(point, corners[i], corners[(i + 1) % 4], tolerance)) return true;
      }
      return false;
    }
    case 'polyline': {
      const data = obj.data as PolylineData;
      for (let i = 0; i < data.points.length - 1; i++) {
        if (pointOnLine(point, data.points[i], data.points[i + 1], tolerance)) return true;
      }
      if (data.closed && data.points.length > 2) {
        if (pointOnLine(point, data.points[data.points.length - 1], data.points[0], tolerance)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export function generatePolygonPoints(center: Point, radius: number, sides: number, rotation: number = 0): Point[] {
  const points: Point[] = [];
  const angleStep = (2 * Math.PI) / sides;
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * angleStep - Math.PI / 2;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  return points;
}

export function calculateSplinePoints(controlPoints: Point[], segments: number = 50): Point[] {
  if (controlPoints.length < 2) return controlPoints;
  if (controlPoints.length === 2) return controlPoints;

  const points: Point[] = [];
  for (let t = 0; t <= 1; t += 1 / segments) {
    points.push(getCatmullRomPoint(controlPoints, t));
  }
  return points;
}

function getCatmullRomPoint(controlPoints: Point[], t: number): Point {
  const n = controlPoints.length - 1;
  const segment = Math.min(Math.floor(t * n), n - 1);
  const localT = t * n - segment;

  const p0 = controlPoints[Math.max(0, segment - 1)];
  const p1 = controlPoints[segment];
  const p2 = controlPoints[Math.min(n, segment + 1)];
  const p3 = controlPoints[Math.min(n, segment + 2)];

  const t2 = localT * localT;
  const t3 = t2 * localT;

  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * localT + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * localT + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

export function offsetLine(start: Point, end: Point, offset: number): { start: Point; end: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  return {
    start: { x: start.x + nx * offset, y: start.y + ny * offset },
    end: { x: end.x + nx * offset, y: end.y + ny * offset }
  };
}

export function lineIntersection(l1Start: Point, l1End: Point, l2Start: Point, l2End: Point): Point | null {
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

export function filletCorner(p1: Point, corner: Point, p2: Point, radius: number): { arc: ArcData; trimPoints: [Point, Point] } {
  const v1 = { x: p1.x - corner.x, y: p1.y - corner.y };
  const v2 = { x: p2.x - corner.x, y: p2.y - corner.y };

  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  const u1 = { x: v1.x / len1, y: v1.y / len1 };
  const u2 = { x: v2.x / len2, y: v2.y / len2 };

  const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
  const bisLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
  const bisUnit = { x: bisector.x / bisLen, y: bisector.y / bisLen };

  const halfAngle = Math.acos((u1.x * u2.x + u1.y * u2.y) / 2 + 0.5);
  const centerDist = radius / Math.sin(halfAngle);

  const center = {
    x: corner.x + bisUnit.x * centerDist,
    y: corner.y + bisUnit.y * centerDist
  };

  const tangentDist = radius / Math.tan(halfAngle);
  const trim1 = { x: corner.x + u1.x * tangentDist, y: corner.y + u1.y * tangentDist };
  const trim2 = { x: corner.x + u2.x * tangentDist, y: corner.y + u2.y * tangentDist };

  const startAngle = Math.atan2(trim1.y - center.y, trim1.x - center.x);
  const endAngle = Math.atan2(trim2.y - center.y, trim2.x - center.x);

  return {
    arc: { center, radius, startAngle, endAngle },
    trimPoints: [trim1, trim2]
  };
}

export function chamferCorner(p1: Point, corner: Point, p2: Point, dist1: number, dist2: number): { line: LineData; trimPoints: [Point, Point] } {
  const v1 = { x: p1.x - corner.x, y: p1.y - corner.y };
  const v2 = { x: p2.x - corner.x, y: p2.y - corner.y };

  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  const trim1 = { x: corner.x + (v1.x / len1) * dist1, y: corner.y + (v1.y / len1) * dist1 };
  const trim2 = { x: corner.x + (v2.x / len2) * dist2, y: corner.y + (v2.y / len2) * dist2 };

  return {
    line: { start: trim1, end: trim2 },
    trimPoints: [trim1, trim2]
  };
}

// Ellipse points
export function calculateEllipsePoints(
  center: Point, majorRadius: number, minorRadius: number, rotation: number, segments: number = 64
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const x = majorRadius * Math.cos(t);
    const y = minorRadius * Math.sin(t);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    points.push({
      x: center.x + x * cosR - y * sinR,
      y: center.y + x * sinR + y * cosR
    });
  }
  return points;
}

// Offset operations for different object types
export function offsetCircle(center: Point, radius: number, offsetDist: number): { center: Point; radius: number } {
  const newR = radius + offsetDist;
  return { center: { ...center }, radius: Math.abs(newR) };
}

export function offsetArc(
  center: Point, radius: number, startAngle: number, endAngle: number, offsetDist: number
): { center: Point; radius: number; startAngle: number; endAngle: number } {
  return {
    center: { ...center },
    radius: Math.abs(radius + offsetDist),
    startAngle,
    endAngle
  };
}

export function offsetPolyline(points: Point[], offsetDist: number, closed: boolean): Point[] {
  if (points.length < 2) return points;
  const offsetPts: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = i > 0 ? points[i - 1] : (closed ? points[points.length - 1] : null);
    const curr = points[i];
    const next = i < points.length - 1 ? points[i + 1] : (closed ? points[0] : null);

    if (!prev && next) {
      // First point (open polyline)
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        offsetPts.push({
          x: curr.x + (-dy / len) * offsetDist,
          y: curr.y + (dx / len) * offsetDist
        });
      } else { offsetPts.push({ ...curr }); }
    } else if (prev && !next) {
      // Last point (open polyline)
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        offsetPts.push({
          x: curr.x + (-dy / len) * offsetDist,
          y: curr.y + (dx / len) * offsetDist
        });
      } else { offsetPts.push({ ...curr }); }
    } else if (prev && next) {
      // Middle point or any point in closed polyline
      const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (len1 > 0 && len2 > 0) {
        const n1 = { x: -dy1 / len1, y: dx1 / len1 };
        const n2 = { x: -dy2 / len2, y: dx2 / len2 };
        const bisector = { x: n1.x + n2.x, y: n1.y + n2.y };
        const bisLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
        if (bisLen > 0.0001) {
          const dot = n1.x * bisector.x / bisLen + n1.y * bisector.y / bisLen;
          const scale = dot > 0.0001 ? offsetDist / dot : offsetDist;
          offsetPts.push({
            x: curr.x + (bisector.x / bisLen) * scale,
            y: curr.y + (bisector.y / bisLen) * scale
          });
        } else { offsetPts.push({ x: curr.x + n1.x * offsetDist, y: curr.y + n1.y * offsetDist }); }
      } else { offsetPts.push({ ...curr }); }
    } else {
      offsetPts.push({ ...curr });
    }
  }
  return offsetPts;
}

// Split line at a point
export function splitLineAtPoint(start: Point, end: Point, splitPoint: Point): [
  { start: Point; end: Point },
  { start: Point; end: Point }
] {
  return [
    { start: { ...start }, end: { ...splitPoint } },
    { start: { ...splitPoint }, end: { ...end } }
  ];
}

// Split arc at a point (by angle)
export function splitArcAtAngle(
  center: Point, radius: number, startAngle: number, endAngle: number, splitAngle: number
): [
    { center: Point; radius: number; startAngle: number; endAngle: number },
    { center: Point; radius: number; startAngle: number; endAngle: number }
  ] {
  return [
    { center: { ...center }, radius, startAngle, endAngle: splitAngle },
    { center: { ...center }, radius, startAngle: splitAngle, endAngle }
  ];
}

// Point on path at a fractional distance
export function pointOnPath(points: Point[], fraction: number): { point: Point; angle: number } {
  if (points.length < 2) return { point: points[0] || { x: 0, y: 0 }, angle: 0 };

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    segLens.push(d);
    totalLen += d;
  }

  const targetLen = fraction * totalLen;
  let accumulated = 0;

  for (let i = 0; i < segLens.length; i++) {
    if (accumulated + segLens[i] >= targetLen || i === segLens.length - 1) {
      const segFrac = segLens[i] > 0 ? (targetLen - accumulated) / segLens[i] : 0;
      const p1 = points[i];
      const p2 = points[i + 1];
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      return {
        point: {
          x: p1.x + (p2.x - p1.x) * segFrac,
          y: p1.y + (p2.y - p1.y) * segFrac
        },
        angle: ang
      };
    }
    accumulated += segLens[i];
  }

  return { point: points[points.length - 1], angle: 0 };
}

// Check if point is inside a rectangle (for crossing-window stretch selection)
export function isPointInRect(point: Point, corner1: Point, corner2: Point): boolean {
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxY = Math.max(corner1.y, corner2.y);
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function offsetObjectData(data: any, offset: Point): any {
  if (data.start && data.end) {
    // Line
    return {
      ...data,
      start: { x: data.start.x + offset.x, y: data.start.y + offset.y },
      end: { x: data.end.x + offset.x, y: data.end.y + offset.y }
    };
  }
  if (data.center && data.radius !== undefined) {
    // Circle, Arc, Polygon
    const newData = {
      ...data,
      center: { x: data.center.x + offset.x, y: data.center.y + offset.y }
    };
    return newData;
  }
  if (data.corner1 && data.corner2) {
    // Rectangle
    return {
      ...data,
      corner1: { x: data.corner1.x + offset.x, y: data.corner1.y + offset.y },
      corner2: { x: data.corner2.x + offset.x, y: data.corner2.y + offset.y }
    };
  }
  if (data.points) {
    // Polyline
    return {
      ...data,
      points: data.points.map((p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y }))
    };
  }
  if (data.controlPoints) {
    // Spline
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y }))
    };
  }
  if (data.position) {
    // Text, MText
    return {
      ...data,
      position: { x: data.position.x + offset.x, y: data.position.y + offset.y }
    };
  }
  if (data.point && data.direction) {
    // XLine, Ray
    return {
      ...data,
      point: { x: data.point.x + offset.x, y: data.point.y + offset.y }
    };
  }
  if (data.sourceObjects) {
    // Array
    return {
      ...data,
      sourceObjects: data.sourceObjects.map((obj: CADObject) => ({
        ...obj,
        data: offsetObjectData(obj.data, offset)
      }))
    };
  }
  return data;
}

export function rotateObjectData(data: any, center: Point, angleRad: number): any {
  if (angleRad === 0) return data;

  if (data.start && data.end) {
    // Line
    return {
      ...data,
      start: rotatePoint(data.start, center, angleRad),
      end: rotatePoint(data.end, center, angleRad)
    };
  }
  if (data.center && data.radius !== undefined) {
    // Circle, Polygon
    let newData = {
      ...data,
      center: rotatePoint(data.center, center, angleRad)
    };
    if (data.rotation !== undefined) {
      newData.rotation += angleRad;
    }
    // Arc
    if (data.startAngle !== undefined && data.endAngle !== undefined) {
      newData.startAngle += angleRad;
      newData.endAngle += angleRad;
    }
    return newData;
  }
  if (data.points) {
    // Polyline
    return {
      ...data,
      points: data.points.map((p: Point) => rotatePoint(p, center, angleRad))
    };
  }
  if (data.controlPoints) {
    // Spline
    return {
      ...data,
      controlPoints: data.controlPoints.map((p: Point) => rotatePoint(p, center, angleRad))
    };
  }
  if (data.position) {
    // Text, MText
    const newPos = rotatePoint(data.position, center, angleRad);
    return {
      ...data,
      position: newPos,
      rotation: (data.rotation || 0) + angleRad
    };
  }
  if (data.point && data.direction) {
    // XLine, Ray
    const newPos = rotatePoint(data.point, center, angleRad);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const newDir = {
      x: data.direction.x * cos - data.direction.y * sin,
      y: data.direction.x * sin + data.direction.y * cos
    };
    return {
      ...data,
      point: newPos,
      direction: newDir
    };
  }
  if (data.sourceObjects) {
    // Array
    return {
      ...data,
      sourceObjects: data.sourceObjects.map((obj: CADObject) => ({
        ...obj,
        data: rotateObjectData(obj.data, center, angleRad)
      }))
    };
  }
  return data;
}