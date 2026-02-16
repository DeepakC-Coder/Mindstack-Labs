import { useCallback } from 'react';
import { CADObject, ConstraintDef, ConstraintType, Point, LineData, CircleData, ArcData } from '../types/cad.types';
import { distance } from '../utils/geometry';

/**
 * Constraint system hook — provides geometric & dimensional constraint application
 * and an iterative solver that adjusts geometry to satisfy constraints.
 */

interface ConstraintAPI {
    applyConstraint: (type: ConstraintType, objectIds: string[], value?: number, refPoint?: Point) => ConstraintDef | null;
    solveConstraints: (objects: CADObject[], constraints: ConstraintDef[]) => CADObject[];
    checkConstraint: (constraint: ConstraintDef, objects: CADObject[]) => boolean;
    getConstraintIcon: (type: ConstraintType) => string;
    getConstraintLabel: (type: ConstraintType) => string;
}

export function useConstraints(): ConstraintAPI {

    // Create a new constraint definition
    const applyConstraint = useCallback((
        type: ConstraintType,
        objectIds: string[],
        value?: number,
        referencePoint?: Point
    ): ConstraintDef | null => {
        if (objectIds.length < 1) return null;

        return {
            id: `cst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            objectIds,
            value,
            referencePoint,
            satisfied: false
        };
    }, []);

    // Check if a specific constraint is satisfied
    const checkConstraint = useCallback((constraint: ConstraintDef, objects: CADObject[]): boolean => {
        const objs = constraint.objectIds.map(id => objects.find(o => o.id === id)).filter(Boolean) as CADObject[];
        if (objs.length < 1) return false;

        const tolerance = 0.01;

        switch (constraint.type) {
            // --- Geometric Constraints ---
            case 'coincident': {
                if (objs.length < 2) return false;
                const p1 = getEndpoint(objs[0]);
                const p2 = getStartpoint(objs[1]);
                if (!p1 || !p2) return false;
                return distance(p1, p2) < tolerance;
            }

            case 'parallel': {
                if (objs.length < 2) return false;
                const d1 = getDirection(objs[0]);
                const d2 = getDirection(objs[1]);
                if (!d1 || !d2) return false;
                const cross = d1.x * d2.y - d1.y * d2.x;
                return Math.abs(cross) < tolerance;
            }

            case 'perpendicular': {
                if (objs.length < 2) return false;
                const dir1 = getDirection(objs[0]);
                const dir2 = getDirection(objs[1]);
                if (!dir1 || !dir2) return false;
                const dot = dir1.x * dir2.x + dir1.y * dir2.y;
                return Math.abs(dot) < tolerance;
            }

            case 'concentric': {
                if (objs.length < 2) return false;
                const c1 = getCenter(objs[0]);
                const c2 = getCenter(objs[1]);
                if (!c1 || !c2) return false;
                return distance(c1, c2) < tolerance;
            }

            case 'equal': {
                if (objs.length < 2) return false;
                const len1 = getLength(objs[0]);
                const len2 = getLength(objs[1]);
                if (len1 === null || len2 === null) return false;
                return Math.abs(len1 - len2) < tolerance;
            }

            case 'tangent': {
                if (objs.length < 2) return false;
                // Simplified: check if a line endpoint touches a circle
                const lineObj = objs.find(o => o.type === 'line');
                const circleObj = objs.find(o => o.type === 'circle' || o.type === 'arc');
                if (!lineObj || !circleObj) return false;
                const lineData = lineObj.data as LineData;
                const center = getCenter(circleObj);
                const radius = getRadius(circleObj);
                if (!center || radius === null) return false;
                const d1t = distance(center, lineData.start);
                const d2t = distance(center, lineData.end);
                return Math.abs(Math.min(d1t, d2t) - radius) < tolerance;
            }

            case 'collinear': {
                if (objs.length < 2) return false;
                const l1 = objs[0].data as LineData;
                const l2 = objs[1].data as LineData;
                if (!l1.start || !l2.start) return false;
                // Check if all 4 points are collinear
                const cross1 = (l1.end.x - l1.start.x) * (l2.start.y - l1.start.y) -
                    (l1.end.y - l1.start.y) * (l2.start.x - l1.start.x);
                const cross2 = (l1.end.x - l1.start.x) * (l2.end.y - l1.start.y) -
                    (l1.end.y - l1.start.y) * (l2.end.x - l1.start.x);
                return Math.abs(cross1) < tolerance && Math.abs(cross2) < tolerance;
            }

            case 'symmetric': {
                if (objs.length < 2 || !constraint.referencePoint) return false;
                const pa = getCenter(objs[0]) || getStartpoint(objs[0]);
                const pb = getCenter(objs[1]) || getStartpoint(objs[1]);
                if (!pa || !pb) return false;
                const midpoint = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
                return distance(midpoint, constraint.referencePoint) < tolerance;
            }

            // --- Dimensional Constraints ---
            case 'distance': {
                if (constraint.value === undefined) return false;
                if (objs.length >= 2) {
                    const pa = getCenter(objs[0]) || getStartpoint(objs[0]);
                    const pb = getCenter(objs[1]) || getStartpoint(objs[1]);
                    if (!pa || !pb) return false;
                    return Math.abs(distance(pa, pb) - constraint.value) < tolerance;
                }
                // Single object: its length
                const len = getLength(objs[0]);
                if (len === null) return false;
                return Math.abs(len - constraint.value) < tolerance;
            }

            case 'angle': {
                if (objs.length < 2 || constraint.value === undefined) return false;
                const da = getDirection(objs[0]);
                const db = getDirection(objs[1]);
                if (!da || !db) return false;
                const angleBetween = Math.acos(
                    Math.max(-1, Math.min(1, (da.x * db.x + da.y * db.y)))
                ) * (180 / Math.PI);
                return Math.abs(angleBetween - constraint.value) < tolerance;
            }

            case 'radius': {
                if (constraint.value === undefined || objs.length < 1) return false;
                const r = getRadius(objs[0]);
                if (r === null) return false;
                return Math.abs(r - constraint.value) < tolerance;
            }

            case 'diameter': {
                if (constraint.value === undefined || objs.length < 1) return false;
                const rad = getRadius(objs[0]);
                if (rad === null) return false;
                return Math.abs(rad * 2 - constraint.value) < tolerance;
            }

            default:
                return false;
        }
    }, []);

    // Iterative solver: adjusts geometry to satisfy constraints (simplified)
    const solveConstraints = useCallback((objects: CADObject[], constraints: ConstraintDef[]): CADObject[] => {
        if (constraints.length === 0) return objects;

        let result = objects.map(o => ({ ...o, data: { ...o.data } }));
        const maxIterations = 10;

        for (let iter = 0; iter < maxIterations; iter++) {
            let allSatisfied = true;

            for (const constraint of constraints) {
                if (checkConstraint(constraint, result)) continue;
                allSatisfied = false;

                const objs = constraint.objectIds.map(id => result.find(o => o.id === id)).filter(Boolean) as CADObject[];
                if (objs.length < 1) continue;

                switch (constraint.type) {
                    case 'coincident': {
                        if (objs.length < 2) break;
                        const target = getEndpoint(objs[0]);
                        if (!target) break;
                        // Move second object's start to first object's end
                        const secondData = objs[1].data as LineData;
                        if (secondData.start) {
                            const dx = target.x - secondData.start.x;
                            const dy = target.y - secondData.start.y;
                            const idx = result.findIndex(o => o.id === objs[1].id);
                            if (idx >= 0) {
                                result[idx] = {
                                    ...result[idx],
                                    data: {
                                        ...secondData,
                                        start: target,
                                        end: { x: secondData.end.x + dx, y: secondData.end.y + dy }
                                    }
                                };
                            }
                        }
                        break;
                    }

                    case 'distance': {
                        if (constraint.value === undefined) break;
                        if (objs.length === 1 && objs[0].type === 'line') {
                            // Adjust line length to match value
                            const lineData = objs[0].data as LineData;
                            const currentLen = distance(lineData.start, lineData.end);
                            if (currentLen === 0) break;
                            const scale = constraint.value / currentLen;
                            const dx = lineData.end.x - lineData.start.x;
                            const dy = lineData.end.y - lineData.start.y;
                            const idx = result.findIndex(o => o.id === objs[0].id);
                            if (idx >= 0) {
                                result[idx] = {
                                    ...result[idx],
                                    data: {
                                        ...lineData,
                                        end: {
                                            x: lineData.start.x + dx * scale,
                                            y: lineData.start.y + dy * scale
                                        }
                                    }
                                };
                            }
                        }
                        break;
                    }

                    case 'radius': {
                        if (constraint.value === undefined || objs.length < 1) break;
                        if (objs[0].type === 'circle') {
                            const idx = result.findIndex(o => o.id === objs[0].id);
                            if (idx >= 0) {
                                result[idx] = {
                                    ...result[idx],
                                    data: { ...(objs[0].data as CircleData), radius: constraint.value }
                                };
                            }
                        }
                        break;
                    }

                    case 'concentric': {
                        if (objs.length < 2) break;
                        const centerA = getCenter(objs[0]);
                        if (!centerA) break;
                        const secondObj = objs[1];
                        if (secondObj.type === 'circle') {
                            const idx = result.findIndex(o => o.id === secondObj.id);
                            if (idx >= 0) {
                                result[idx] = {
                                    ...result[idx],
                                    data: { ...(secondObj.data as CircleData), center: { ...centerA } }
                                };
                            }
                        }
                        break;
                    }

                    // Other constraints: mark as not fully solvable in this simplified solver
                    default:
                        break;
                }
            }

            if (allSatisfied) break;
        }

        // Update satisfaction status
        return result;
    }, [checkConstraint]);

    // Icons for constraint display on canvas
    const getConstraintIcon = useCallback((type: ConstraintType): string => {
        const icons: Record<string, string> = {
            'parallel': '∥',
            'perpendicular': '⊥',
            'concentric': '⊙',
            'tangent': '⌒',
            'equal': '=',
            'coincident': '•',
            'collinear': '—',
            'symmetric': '⟷',
            'distance': '↔',
            'angle': '∠',
            'radius': 'R',
            'diameter': 'Ø'
        };
        return icons[type] || '?';
    }, []);

    const getConstraintLabel = useCallback((type: ConstraintType): string => {
        const labels: Record<string, string> = {
            'parallel': 'Parallel',
            'perpendicular': 'Perpendicular',
            'concentric': 'Concentric',
            'tangent': 'Tangent',
            'equal': 'Equal',
            'coincident': 'Coincident',
            'collinear': 'Collinear',
            'symmetric': 'Symmetric',
            'distance': 'Distance',
            'angle': 'Angle',
            'radius': 'Radius',
            'diameter': 'Diameter'
        };
        return labels[type] || type;
    }, []);

    return {
        applyConstraint,
        solveConstraints,
        checkConstraint,
        getConstraintIcon,
        getConstraintLabel
    };
}

// Helper functions to extract geometric properties from CAD objects
function getStartpoint(obj: CADObject): Point | null {
    if (obj.type === 'line') return (obj.data as LineData).start;
    return null;
}

function getEndpoint(obj: CADObject): Point | null {
    if (obj.type === 'line') return (obj.data as LineData).end;
    return null;
}

function getCenter(obj: CADObject): Point | null {
    if (obj.type === 'circle') return (obj.data as CircleData).center;
    if (obj.type === 'arc') return (obj.data as ArcData).center;
    return null;
}

function getRadius(obj: CADObject): number | null {
    if (obj.type === 'circle') return (obj.data as CircleData).radius;
    if (obj.type === 'arc') return (obj.data as ArcData).radius;
    return null;
}

function getDirection(obj: CADObject): Point | null {
    if (obj.type === 'line') {
        const data = obj.data as LineData;
        const len = distance(data.start, data.end);
        if (len === 0) return null;
        return {
            x: (data.end.x - data.start.x) / len,
            y: (data.end.y - data.start.y) / len
        };
    }
    return null;
}

function getLength(obj: CADObject): number | null {
    if (obj.type === 'line') {
        const data = obj.data as LineData;
        return distance(data.start, data.end);
    }
    if (obj.type === 'circle') {
        return (obj.data as CircleData).radius * 2 * Math.PI;
    }
    return null;
}

export type { ConstraintAPI };
