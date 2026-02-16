import React from 'react';
import { cn } from '@/lib/utils';
import { CADStateAPI } from '../types/cad.types';
import { Color, LineType, LineData, PolylineData, CircleData, ArcData, RectangleData, EllipseData, XLineData, RayData, DimensionData, BlockData, ArrayObjectData, UnitFormat } from '../types/cad.types';
import {
  Palette, Weight, Droplet, Layers, Ruler
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PropertiesPanelProps {
  cadState: CADStateAPI;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS: Color[] = [
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 255, b: 255 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 0, b: 255 },
  { r: 128, g: 128, b: 128 },
  { r: 255, g: 128, b: 0 },
  { r: 128, g: 0, b: 255 },
  { r: 255, g: 128, b: 128 },
  { r: 128, g: 255, b: 128 },
  { r: 128, g: 128, b: 255 },
  { r: 255, g: 255, b: 128 },
  { r: 64, g: 64, b: 64 },
];

const LINE_TYPES: { value: LineType; label: string }[] = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashdot', label: 'Dash Dot' },
  { value: 'center', label: 'Center' },
  { value: 'hidden', label: 'Hidden' },
];

const LINE_WEIGHTS = [0.13, 0.18, 0.25, 0.35, 0.50, 0.70, 1.00, 1.40, 2.00];

const UNIT_FORMATS: { value: UnitFormat; label: string }[] = [
  { value: 'mm', label: 'Millimeters' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'm', label: 'Meters' },
  { value: 'inches', label: 'Inches' },
  { value: 'feet', label: 'Feet' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'engineering', label: 'Engineering' },
];

// Helper component for numeric inputs
const PropertyInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = React.useState(value.toFixed(4));
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setLocalValue(value.toFixed(4));
    }
  }, [value, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseFloat(localValue);
    if (!isNaN(num) && num > 0) {
      onChange(num);
    } else {
      setLocalValue(value.toFixed(4));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      className={cn(
        "w-16 h-5 ml-auto px-1 bg-background border border-border rounded text-xs text-foreground focus:border-orange-500 outline-none",
        className
      )}
      value={localValue}
      onChange={(e) => {
        setIsEditing(true);
        setLocalValue(e.target.value);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ cadState, isOpen, onClose }) => {
  const { currentColor, currentLineType, currentLineWeight, selectedObjects } = cadState;

  const handleColorChange = (color: Color) => {
    cadState.setCurrentColor(color);
    selectedObjects.forEach(obj => {
      cadState.updateObject(obj.id, { color });
    });
  };

  const handleLineTypeChange = (lineType: LineType) => {
    cadState.setCurrentLineType(lineType);
    selectedObjects.forEach(obj => {
      cadState.updateObject(obj.id, { lineType });
    });
  };

  const handleLineWeightChange = (lineWeight: number) => {
    cadState.setCurrentLineWeight(lineWeight);
    selectedObjects.forEach(obj => {
      cadState.updateObject(obj.id, { lineWeight });
    });
  };

  const handleTransparencyChange = (transparency: number) => {
    selectedObjects.forEach(obj => {
      cadState.updateObject(obj.id, { transparency: transparency / 100 });
    });
  };

  const handleLengthChange = (newLength: number) => {
    selectedObjects.forEach(obj => {
      if (obj.type === 'line') {
        const d = obj.data as LineData;
        const dx = d.end.x - d.start.x;
        const dy = d.end.y - d.start.y;
        const currentAngle = Math.atan2(dy, dx);

        const newEnd = {
          x: d.start.x + Math.cos(currentAngle) * newLength,
          y: d.start.y + Math.sin(currentAngle) * newLength
        };

        cadState.updateObject(obj.id, {
          data: { ...d, end: newEnd }
        });
      }
    });
  };

  const handleRadiusChange = (newRadius: number) => {
    selectedObjects.forEach(obj => {
      if (obj.type === 'circle') {
        const d = obj.data as CircleData;
        cadState.updateObject(obj.id, {
          data: { ...d, radius: newRadius }
        });
      } else if (obj.type === 'arc') {
        const d = obj.data as ArcData;
        cadState.updateObject(obj.id, {
          data: { ...d, radius: newRadius }
        });
      }
    });
  };

  // Render object-specific properties
  const renderObjectProperties = () => {
    if (selectedObjects.length !== 1) return null;
    const obj = selectedObjects[0];

    switch (obj.type) {
      case 'line': {
        const d = obj.data as LineData;
        const currentLength = Math.sqrt((d.end.x - d.start.x) ** 2 + (d.end.y - d.start.y) ** 2);

        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="grid grid-cols-2 gap-1 mb-1">
              <p>Start X: {d.start.x.toFixed(2)}</p>
              <p>Start Y: {d.start.y.toFixed(2)}</p>
              <p>End X: {d.end.x.toFixed(2)}</p>
              <p>End Y: {d.end.y.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1">
              <span>Length:</span>
              <PropertyInput value={currentLength} onChange={handleLengthChange} />
            </div>
          </div>
        );
      }
      case 'polyline': {
        const d = obj.data as PolylineData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Points: {d.points.length}</p>
            <p>Closed: {d.closed ? 'Yes' : 'No'}</p>
          </div>
        );
      }
      case 'circle': {
        const d = obj.data as CircleData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="grid grid-cols-2 gap-1">
              <p>Center X: {d.center.x.toFixed(2)}</p>
              <p>Center Y: {d.center.y.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1">
              <span>Radius:</span>
              <PropertyInput value={d.radius} onChange={handleRadiusChange} />
            </div>
            <p>Circumference: {(2 * Math.PI * d.radius).toFixed(4)}</p>
          </div>
        );
      }
      case 'arc': {
        const d = obj.data as ArcData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="grid grid-cols-2 gap-1">
              <p>Center X: {d.center.x.toFixed(2)}</p>
              <p>Center Y: {d.center.y.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1">
              <span>Radius:</span>
              <PropertyInput value={d.radius} onChange={handleRadiusChange} />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <p>Start: {(d.startAngle * 180 / Math.PI).toFixed(1)}°</p>
              <p>End: {(d.endAngle * 180 / Math.PI).toFixed(1)}°</p>
            </div>
          </div>
        );
      }
      case 'rectangle': {
        const d = obj.data as RectangleData;
        const w = Math.abs(d.corner2.x - d.corner1.x);
        const h = Math.abs(d.corner2.y - d.corner1.y);
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="grid grid-cols-2 gap-1">
              <p>W: {w.toFixed(4)}</p>
              <p>H: {h.toFixed(4)}</p>
            </div>
            <p>Area: {(w * h).toFixed(4)}</p>
          </div>
        );
      }
      case 'ellipse': {
        const d = obj.data as EllipseData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="grid grid-cols-2 gap-1">
              <p>Center X: {d.center.x.toFixed(2)}</p>
              <p>Center Y: {d.center.y.toFixed(2)}</p>
              <p>Major R: {d.majorRadius.toFixed(4)}</p>
              <p>Minor R: {d.minorRadius.toFixed(4)}</p>
            </div>
            <p>Rotation: {(d.rotation * 180 / Math.PI).toFixed(1)}°</p>
          </div>
        );
      }
      case 'xline': {
        const d = obj.data as XLineData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Through: ({d.point.x.toFixed(2)}, {d.point.y.toFixed(2)})</p>
            <p>Dir: ({d.direction.x.toFixed(2)}, {d.direction.y.toFixed(2)})</p>
            <p>Angle: {(Math.atan2(d.direction.y, d.direction.x) * 180 / Math.PI).toFixed(1)}°</p>
          </div>
        );
      }
      case 'ray': {
        const d = obj.data as RayData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Origin: ({d.point.x.toFixed(2)}, {d.point.y.toFixed(2)})</p>
            <p>Dir: ({d.direction.x.toFixed(2)}, {d.direction.y.toFixed(2)})</p>
            <p>Angle: {(Math.atan2(d.direction.y, d.direction.x) * 180 / Math.PI).toFixed(1)}°</p>
          </div>
        );
      }
      case 'block': {
        const d = obj.data as BlockData;
        const blockName = cadState.blocks.find(b => b.id === d.blockId)?.name || d.blockId;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Block: {blockName}</p>
            <p>Insert: ({d.insertionPoint.x.toFixed(2)}, {d.insertionPoint.y.toFixed(2)})</p>
            <p>Scale: {d.scale.x.toFixed(2)}</p>
            <p>Rotation: {(d.rotation * 180 / Math.PI).toFixed(1)}°</p>
            {d.attributes && d.attributes.length > 0 && (
              <div className="mt-1 pt-1 border-t border-white/5">
                {d.attributes.map((attr, i) => (
                  <p key={i}>{attr.tag}: {attr.value}</p>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'dimension': {
        const d = obj.data as DimensionData;
        let dist = 0;
        if (d.points.length >= 2) {
          dist = Math.sqrt((d.points[1].x - d.points[0].x) ** 2 + (d.points[1].y - d.points[0].y) ** 2);
        }
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Type: <span className="capitalize">{d.type}</span></p>
            <p>Value: {dist.toFixed(4)}</p>
            <p>Text Pos: ({d.textPosition.x.toFixed(2)}, {d.textPosition.y.toFixed(2)})</p>
          </div>
        );
      }
      case 'array': {
        const d = obj.data as ArrayObjectData;
        return (
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p>Type: {d.arrayType}</p>
            <p>Items: {d.sourceObjects.length}</p>
            {d.arrayType === 'rectangular' && d.rectParams && (
              <div className="grid grid-cols-2 gap-1">
                <p>R: {d.rectParams.rows}</p>
                <p>C: {d.rectParams.columns}</p>
                <p>R-Gap: {d.rectParams.rowSpacing}</p>
                <p>C-Gap: {d.rectParams.columnSpacing}</p>
              </div>
            )}
            {d.arrayType === 'polar' && d.polarParams && (
              <>
                <p>Items: {d.polarParams.itemCount}</p>
                <p>Angle: {d.polarParams.fillAngle}°</p>
              </>
            )}
            {d.arrayType === 'path' && d.pathParams && (
              <>
                <p>Items: {d.pathParams.itemCount}</p>
                <p>Space: {d.pathParams.spacing.toFixed(2)}</p>
              </>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur border-l border-border overflow-hidden">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-2 shrink-0 bg-muted/20">
        <Palette className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-foreground">Properties</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
        {/* Color */}
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Palette className="w-3 h-3" />
            Color
          </Label>
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_COLORS.map((color, idx) => (
              <button
                key={idx}
                className={cn(
                  "w-6 h-6 rounded-sm border transition-transform hover:scale-110",
                  currentColor.r === color.r &&
                    currentColor.g === color.g &&
                    currentColor.b === color.b ? "border-white ring-1 ring-white/50" : "border-transparent"
                )}
                style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
                onClick={() => handleColorChange(color)}
              />
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Current: RGB({currentColor.r}, {currentColor.g}, {currentColor.b})
          </div>
        </div>

        {/* Line Type */}
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Weight className="w-3 h-3" />
            Line Type
          </Label>
          <Select
            value={currentLineType}
            onValueChange={(v) => handleLineTypeChange(v as LineType)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Line Weight */}
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Weight className="w-3 h-3" />
            Line Weight
          </Label>
          <Select
            value={currentLineWeight.toString()}
            onValueChange={(v) => handleLineWeightChange(parseFloat(v))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_WEIGHTS.map(lw => (
                <SelectItem key={lw} value={lw.toString()} className="text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 bg-current h-px" style={{ height: Math.max(1, lw) }} />
                    <span>{lw}mm</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transparency (for selected objects) */}
        {selectedObjects.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Droplet className="w-4 h-4" />
              Transparency
            </Label>
            <Slider
              defaultValue={[selectedObjects[0]?.transparency * 100 || 0]}
              max={100}
              step={5}
              onValueChange={([v]) => handleTransparencyChange(v)}
            />
            <div className="text-xs text-muted-foreground">
              {selectedObjects[0]?.transparency * 100 || 0}%
            </div>
          </div>
        )}

        {/* Unit Settings */}
        <div className="space-y-1 pt-2 border-t border-border">
          <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Ruler className="w-3 h-3" />
            Drawing Units
          </Label>
          <Select
            value={cadState.unitSettings.format}
            onValueChange={(v) => cadState.setUnitSettings({ ...cadState.unitSettings, format: v as UnitFormat })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_FORMATS.map(u => (
                <SelectItem key={u.value} value={u.value} className="text-xs">{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-muted-foreground">
            Precision: {cadState.unitSettings.precision} decimals
          </div>
        </div>

        {/* Selected Object Info */}
        {selectedObjects.length > 0 && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-1">Selection</h4>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>{selectedObjects.length} object(s) selected</p>
              {selectedObjects.length === 1 && (
                <>
                  <p>Type: <span className="capitalize font-medium text-foreground">{selectedObjects[0].type}</span></p>
                  <p>Layer: {cadState.layers.find(l => l.id === selectedObjects[0].layerId)?.name}</p>
                </>
              )}
            </div>
            {/* Object-specific properties */}
            <div className="mt-1.5 p-1.5 bg-muted/30 rounded border border-border/50">
              {renderObjectProperties()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default PropertiesPanel;