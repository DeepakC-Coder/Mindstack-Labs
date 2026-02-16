import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ruler,
  Move,
  Circle,
  Square,
  Minus,
  Copy,
  RotateCw,
  Maximize2,
  FlipHorizontal,
  Scissors,
  CornerUpRight,
  Eraser,
  Type,
  Spline,
  Hexagon,
  CircleDot,
  Link,
  Grid3X3,
  Box,
  X,
} from 'lucide-react';
import { CADStateAPI } from '../types/cad.types';
import { DrawingToolsAPI } from '../hooks/useDrawingTools';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tool, CADObject, LineData, CircleData, RectangleData, PolylineData, ArcData, PolygonData } from '../types/cad.types';
import { distance } from '../utils/geometry';

interface ToolOptionsPanelProps {
  cadState: CADStateAPI;
  drawingTools: DrawingToolsAPI;
  isOpen: boolean;
  onClose: () => void;
}

const toolIcons: Partial<Record<Tool, React.ReactNode>> = {
  select: <Move className="w-4 h-4" />,
  line: <Minus className="w-4 h-4" />,
  polyline: <Spline className="w-4 h-4" />,
  rectangle: <Square className="w-4 h-4" />,
  circle: <Circle className="w-4 h-4" />,
  arc: <CircleDot className="w-4 h-4" />,
  polygon: <Hexagon className="w-4 h-4" />,
  move: <Move className="w-4 h-4" />,
  copy: <Copy className="w-4 h-4" />,
  rotate: <RotateCw className="w-4 h-4" />,
  scale: <Maximize2 className="w-4 h-4" />,
  mirror: <FlipHorizontal className="w-4 h-4" />,
  trim: <Scissors className="w-4 h-4" />,
  extend: <CornerUpRight className="w-4 h-4" />,
  fillet: <CornerUpRight className="w-4 h-4" />,
  chamfer: <Box className="w-4 h-4" />,
  erase: <Eraser className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
  hatch: <Grid3X3 className="w-4 h-4" />,
  join: <Link className="w-4 h-4" />,
  measure: <Ruler className="w-4 h-4" />,
};

export const ToolOptionsPanel: React.FC<ToolOptionsPanelProps> = ({
  cadState,
  drawingTools,
  isOpen,
  onClose
}) => {
  const [xValue, setXValue] = useState('');
  const [yValue, setYValue] = useState('');
  const [lengthValue, setLengthValue] = useState('');
  const [radiusValue, setRadiusValue] = useState('');
  const [angleValue, setAngleValue] = useState('');
  const [sidesValue, setSidesValue] = useState('6');

  const [editing, setEditing] = useState<null | 'x' | 'y' | 'length' | 'radius' | 'angle' | 'sides'>(null);
  const [measureMode, setMeasureMode] = useState<'draw' | 'object'>('draw');

  const { currentPoint, startPoint } = drawingTools.drawingState;

  // Update values when current point changes (but don't overwrite while user is typing)
  useEffect(() => {
    if (currentPoint) {
      if (editing !== 'x') setXValue(currentPoint.x.toFixed(4));
      if (editing !== 'y') setYValue(currentPoint.y.toFixed(4));

      if (startPoint) {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx) * (180 / Math.PI);
        if (editing !== 'length') setLengthValue(dist.toFixed(4));
        if (editing !== 'angle') setAngleValue(ang.toFixed(2));

        if (['circle', 'arc', 'polygon'].includes(cadState.activeTool)) {
          if (editing !== 'radius') setRadiusValue(dist.toFixed(4));
        }
      }
    }
  }, [currentPoint, startPoint, cadState.activeTool, editing]);

  const handleSubmit = useCallback((field: 'x' | 'y' | 'length' | 'radius' | 'angle' | 'sides') => {
    let value: number;
    const tool = cadState.activeTool;

    switch (field) {
      case 'x':
        value = parseFloat(xValue);
        if (!isNaN(value)) {
          if (!drawingTools.drawingState.isDrawing) {
            // Start drawing at origin if not already drawing
            drawingTools.startDrawing({ x: 0, y: 0 });
          }
          const newPoint = { x: value, y: parseFloat(yValue) || 0 };
          drawingTools.finishDrawing(newPoint);
        }
        break;
      case 'y':
        value = parseFloat(yValue);
        if (!isNaN(value)) {
          if (!drawingTools.drawingState.isDrawing) {
            drawingTools.startDrawing({ x: 0, y: 0 });
          }
          const newPoint = { x: parseFloat(xValue) || 0, y: value };
          drawingTools.finishDrawing(newPoint);
        }
        break;
      case 'length':
        value = parseFloat(lengthValue);
        if (!isNaN(value) && value > 0) {
          const angle = (parseFloat(angleValue) || 0) * (Math.PI / 180);
          const start = startPoint || { x: 0, y: 0 };
          if (!drawingTools.drawingState.isDrawing) {
            drawingTools.startDrawing(start);
          }
          const newPoint = {
            x: start.x + value * Math.cos(angle),
            y: start.y + value * Math.sin(angle)
          };
          drawingTools.finishDrawing(newPoint);
        }
        break;
      case 'radius':
        value = parseFloat(radiusValue);
        if (!isNaN(value) && value > 0) {
          const center = startPoint || { x: 0, y: 0 };
          if (!drawingTools.drawingState.isDrawing) {
            drawingTools.startDrawing(center);
          }
          // For circles/arcs, radius defines the end point
          const newPoint = {
            x: center.x + value,
            y: center.y
          };
          drawingTools.finishDrawing(newPoint);
        }
        break;
      case 'sides':
        const sides = parseInt(sidesValue);
        if (!isNaN(sides) && sides >= 3 && sides <= 32) {
          // Polygon sides would be set in state - for now just update the value
          setSidesValue(sides.toString());
        }
        break;
    }
  }, [xValue, yValue, lengthValue, radiusValue, angleValue, sidesValue, currentPoint, startPoint, drawingTools, cadState.activeTool]);

  const handleKeyDown = (e: React.KeyboardEvent, field: 'x' | 'y' | 'length' | 'radius' | 'angle' | 'sides') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(field);
      setEditing(null);
    }
  };

  const ToolButton: React.FC<{ tool: Tool; label: string }> = ({ tool, label }) => (
    <button
      onClick={() => cadState.setActiveTool(tool)}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg text-sm transition-all w-full",
        "border border-transparent",
        cadState.activeTool === tool
          ? "bg-orange-500 text-white shadow-md"
          : "text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20"
      )}
    >
      {toolIcons[tool]}
      <span>{label}</span>
    </button>
  );

  // Check if we should show radius input
  const showRadius = ['circle', 'arc', 'polygon'].includes(cadState.activeTool);
  const showSides = cadState.activeTool === 'polygon';
  const showLength = ['line', 'polyline', 'rectangle'].includes(cadState.activeTool);

  // Measure selected objects
  const selectedObjectMeasurements = useMemo(() => {
    if (cadState.selectedIds.length === 0) return null;

    const measurements: Array<{ label: string; value: string }> = [];

    cadState.selectedObjects.forEach((obj, idx) => {
      const prefix = cadState.selectedIds.length > 1 ? `Object ${idx + 1}: ` : '';

      switch (obj.type) {
        case 'line': {
          const data = obj.data as LineData;
          const len = distance(data.start, data.end);
          const dx = data.end.x - data.start.x;
          const dy = data.end.y - data.start.y;
          const ang = Math.atan2(dy, dx) * (180 / Math.PI);
          measurements.push({ label: `${prefix}Length`, value: len.toFixed(4) });
          measurements.push({ label: `${prefix}Angle`, value: `${ang.toFixed(2)}Â°` });
          measurements.push({ label: `${prefix}Î”X`, value: dx.toFixed(4) });
          measurements.push({ label: `${prefix}Î”Y`, value: dy.toFixed(4) });
          break;
        }
        case 'circle': {
          const data = obj.data as CircleData;
          measurements.push({ label: `${prefix}Radius`, value: data.radius.toFixed(4) });
          measurements.push({ label: `${prefix}Diameter`, value: (data.radius * 2).toFixed(4) });
          measurements.push({ label: `${prefix}Circumference`, value: (2 * Math.PI * data.radius).toFixed(4) });
          measurements.push({ label: `${prefix}Area`, value: (Math.PI * data.radius * data.radius).toFixed(4) });
          break;
        }
        case 'rectangle': {
          const data = obj.data as RectangleData;
          const width = Math.abs(data.corner2.x - data.corner1.x);
          const height = Math.abs(data.corner2.y - data.corner1.y);
          measurements.push({ label: `${prefix}Width`, value: width.toFixed(4) });
          measurements.push({ label: `${prefix}Height`, value: height.toFixed(4) });
          measurements.push({ label: `${prefix}Perimeter`, value: (2 * (width + height)).toFixed(4) });
          measurements.push({ label: `${prefix}Area`, value: (width * height).toFixed(4) });
          break;
        }
        case 'arc': {
          const data = obj.data as ArcData;
          const arcLength = Math.abs(data.endAngle - data.startAngle) * data.radius;
          measurements.push({ label: `${prefix}Radius`, value: data.radius.toFixed(4) });
          measurements.push({ label: `${prefix}Arc Length`, value: arcLength.toFixed(4) });
          measurements.push({ label: `${prefix}Start Angle`, value: `${(data.startAngle * 180 / Math.PI).toFixed(2)}Â°` });
          measurements.push({ label: `${prefix}End Angle`, value: `${(data.endAngle * 180 / Math.PI).toFixed(2)}Â°` });
          break;
        }
        case 'polyline': {
          const data = obj.data as PolylineData;
          let totalLength = 0;
          for (let i = 1; i < data.points.length; i++) {
            totalLength += distance(data.points[i - 1], data.points[i]);
          }
          if (data.closed && data.points.length > 2) {
            totalLength += distance(data.points[data.points.length - 1], data.points[0]);
          }
          measurements.push({ label: `${prefix}Total Length`, value: totalLength.toFixed(4) });
          measurements.push({ label: `${prefix}Segments`, value: String(data.points.length - 1) });
          measurements.push({ label: `${prefix}Closed`, value: data.closed ? 'Yes' : 'No' });
          break;
        }
        case 'polygon': {
          const data = obj.data as PolygonData;
          const sideLength = 2 * data.radius * Math.sin(Math.PI / data.sides);
          const perimeter = sideLength * data.sides;
          const area = (perimeter * data.radius * Math.cos(Math.PI / data.sides)) / 2;
          measurements.push({ label: `${prefix}Radius`, value: data.radius.toFixed(4) });
          measurements.push({ label: `${prefix}Sides`, value: String(data.sides) });
          measurements.push({ label: `${prefix}Side Length`, value: sideLength.toFixed(4) });
          measurements.push({ label: `${prefix}Perimeter`, value: perimeter.toFixed(4) });
          measurements.push({ label: `${prefix}Area`, value: area.toFixed(4) });
          break;
        }
      }
    });

    return measurements.length > 0 ? measurements : null;
  }, [cadState.selectedIds, cadState.selectedObjects]);

  // Point-to-point measurement (when drawing with measure tool)
  const pointMeasurement = useMemo(() => {
    if (cadState.activeTool !== 'measure') return null;
    if (!(startPoint && currentPoint)) return null;
    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;
    return {
      dx,
      dy,
      dist: Math.sqrt(dx * dx + dy * dy),
      angDeg: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  }, [startPoint, currentPoint, cadState.activeTool]);

  return (
    <aside
      aria-label="Tool options"
      className={cn(
        "fixed right-0 top-0 z-40 h-svh w-72",
        "border-l border-white/20",
        "shadow-2xl",
        !isOpen && "hidden",
      )}
      style={{ background: 'var(--sidebar-gradient)' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="text-white flex items-center gap-2 font-semibold">
          {toolIcons[cadState.activeTool]}
          Tool Options
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-white/90 hover:bg-white/15"
          aria-label="Close tool options"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="h-[calc(100svh-60px)]">
        <div className="p-4 space-y-4">
          {/* Current Tool Info */}
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Active Tool</p>
            <p className="text-white font-medium capitalize">{cadState.activeTool.replace('-', ' ')}</p>
          </div>

          <Separator className="bg-white/20" />

          {/* Dimension Inputs */}
          <div className="space-y-3">
            <p className="text-white/70 text-xs uppercase tracking-wide">Dimensions</p>

            {/* Only show X/Y for non-circle/arc tools */}
            {!showRadius && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-white/70 text-xs">X</Label>
                  <Input
                    type="number"
                    value={xValue}
                    onChange={(e) => setXValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'x')}
                    onFocus={() => setEditing('x')}
                    onBlur={() => setEditing(null)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                    placeholder="0.0000"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-xs">Y</Label>
                  <Input
                    type="number"
                    value={yValue}
                    onChange={(e) => setYValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'y')}
                    onFocus={() => setEditing('y')}
                    onBlur={() => setEditing(null)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                    placeholder="0.0000"
                  />
                </div>
              </div>
            )}

            {showLength && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-white/70 text-xs">Length</Label>
                  <Input
                    type="number"
                    value={lengthValue}
                    onChange={(e) => setLengthValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'length')}
                    onFocus={() => setEditing('length')}
                    onBlur={() => setEditing(null)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                    placeholder="0.0000"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-xs">Angle</Label>
                  <Input
                    type="number"
                    value={angleValue}
                    onChange={(e) => setAngleValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'angle')}
                    onFocus={() => setEditing('angle')}
                    onBlur={() => setEditing(null)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                    placeholder="0.00Â°"
                  />
                </div>
              </div>
            )}

            {showRadius && (
              <div>
                <Label className="text-white/70 text-xs">Radius</Label>
                <Input
                  type="number"
                  value={radiusValue}
                  onChange={(e) => setRadiusValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'radius')}
                  onFocus={() => setEditing('radius')}
                  onBlur={() => setEditing(null)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                  placeholder="0.0000"
                />
              </div>
            )}

            {showSides && (
              <div>
                <Label className="text-white/70 text-xs">Sides</Label>
                <Input
                  type="number"
                  min={3}
                  max={32}
                  value={sidesValue}
                  onChange={(e) => setSidesValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'sides')}
                  onFocus={() => setEditing('sides')}
                  onBlur={() => setEditing(null)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8"
                  placeholder="6"
                />
              </div>
            )}
          </div>

          <Separator className="bg-white/20" />

          {/* Quick Tools */}
          <div className="space-y-2">
            <p className="text-white/70 text-xs uppercase tracking-wide">Draw Tools</p>
            <div className="grid gap-1">
              <ToolButton tool="select" label="Select" />
              <ToolButton tool="line" label="Line" />
              <ToolButton tool="polyline" label="Polyline" />
              <ToolButton tool="rectangle" label="Rectangle" />
              <ToolButton tool="circle" label="Circle" />
              <ToolButton tool="arc" label="Arc" />
              <ToolButton tool="polygon" label="Polygon" />
            </div>
          </div>

          <Separator className="bg-white/20" />

          <div className="space-y-2">
            <p className="text-white/70 text-xs uppercase tracking-wide">Modify Tools</p>
            <div className="grid gap-1">
              <ToolButton tool="move" label="Move" />
              <ToolButton tool="copy" label="Copy" />
              <ToolButton tool="rotate" label="Rotate" />
              <ToolButton tool="mirror" label="Mirror" />
              <ToolButton tool="trim" label="Trim" />
              <ToolButton tool="extend" label="Extend" />
              <ToolButton tool="fillet" label="Fillet" />
              <ToolButton tool="chamfer" label="Chamfer" />
              <ToolButton tool="erase" label="Erase" />
            </div>
          </div>

          <Separator className="bg-white/20" />

          <div className="space-y-2">
            <p className="text-white/70 text-xs uppercase tracking-wide">Measure</p>
            <div className="grid gap-1">
              <ToolButton tool="measure" label="Measure Distance" />
            </div>
          </div>

          {/* Measurement Result */}
          {cadState.activeTool === 'measure' && pointMeasurement && (
            <div className="bg-white/10 rounded-lg p-3 space-y-2">
              <p className="text-white/70 text-xs uppercase tracking-wide">Point-to-Point</p>
              <div className="space-y-1 text-white text-sm font-mono">
                <p>Î”X: {pointMeasurement.dx.toFixed(4)}</p>
                <p>Î”Y: {pointMeasurement.dy.toFixed(4)}</p>
                <p className="text-primary-foreground font-bold">
                  Distance: {pointMeasurement.dist.toFixed(4)}
                </p>
                <p>Angle: {pointMeasurement.angDeg.toFixed(2)}Â°</p>
              </div>
            </div>
          )}

          {/* Selected Object Measurements */}
          {selectedObjectMeasurements && (
            <div className="bg-white/10 rounded-lg p-3 space-y-2">
              <p className="text-white/70 text-xs uppercase tracking-wide">Object Dimensions</p>
              <div className="space-y-1 text-white text-sm font-mono">
                {selectedObjectMeasurements.map((m, i) => (
                  <p key={i}>
                    <span className="text-white/60">{m.label}:</span> {m.value}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default ToolOptionsPanel;

