import React from 'react';
import {
  FileIcon, FolderOpen, Save, Printer, Download, Undo2, Redo2,
  MousePointer2, Minus, Square, Circle, Triangle, Hexagon, Spline,
  Move, Copy, RotateCw, Maximize2, FlipHorizontal, Scissors, ArrowRightFromLine,
  Eraser, Type, Hash, Layers, Palette, ZoomIn, ZoomOut, Maximize,
  Hand, Grid3X3, Box, Link, CircleDot,
  ChevronDown, Settings, MoreHorizontal, CornerUpRight, Ruler,
  Egg, ArrowRight, MoveHorizontal, SplitSquareVertical, Bomb, Grid2X2,
  RefreshCw, Route, AlignCenter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CADStateAPI } from '../types/cad.types';
import { FileOperationsAPI } from '../hooks/useFileOperations';
import { Tool } from '../types/cad.types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RibbonToolbarProps {
  cadState: CADStateAPI;
  fileOps: FileOperationsAPI;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onOpenLayerPanel: () => void;
  onOpenPropertiesPanel: () => void;
  onOpenToolOptions?: () => void;
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  cadState,
  fileOps,
  canvasRef,
  onOpenLayerPanel,
  onOpenPropertiesPanel
}) => {
  const ToolButton: React.FC<{
    tool: Tool;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
  }> = ({ tool, icon, label, shortcut }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => cadState.setActiveTool(tool)}
          className={cn(
            "flex flex-col items-center justify-center p-1.5 rounded-lg transition-all min-w-[44px]",
            "border border-transparent",
            cadState.activeTool === tool
              ? "bg-white/20 text-white shadow-md border-white/30"
              : "hover:bg-white/10 hover:shadow-sm hover:border-white/20 text-white"
          )}
        >
          <div className="w-4 h-4 drop-shadow-sm">{icon}</div>
          <span className="text-[9px] mt-0.5 whitespace-nowrap">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label} {shortcut && <span className="text-muted-foreground ml-1">({shortcut})</span>}
      </TooltipContent>
    </Tooltip>
  );

  const ActionButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
  }> = ({ onClick, icon, label, disabled }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center justify-center p-1.5 rounded-lg transition-all min-w-[44px]",
            "border border-transparent",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-white/10 hover:shadow-sm hover:border-white/20 text-white"
          )}
        >
          <div className="w-4 h-4 drop-shadow-sm">{icon}</div>
          <span className="text-[9px] mt-0.5 whitespace-nowrap">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  const ToolSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="flex flex-col border-r border-white/10 pr-2 mr-2 last:border-r-0 last:pr-0 last:mr-0">
      <span className="text-[8px] text-white/50 uppercase tracking-wider mb-1 text-center">{title}</span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );

  return (
    <div className="flex flex-col bg-app-dark-gradient border-b border-white/10 text-white">
      {/* Single unified toolbar - File dropdown + all tools */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10">
        {/* File dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-white hover:bg-white/10">
              <FileIcon className="w-4 h-4" />
              File
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={fileOps.newDrawing}>
              <FileIcon className="w-4 h-4 mr-2" />
              New Drawing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={fileOps.openDrawing}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Open Drawing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileOps.saveDrawing()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileOps.saveDrawing('drawing.vcad')}>
              <Save className="w-4 h-4 mr-2" />
              Save As...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileOps.exportToPNG(canvasRef.current)}>
              <Download className="w-4 h-4 mr-2" />
              Export PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileOps.exportToSVG()}>
              <Download className="w-4 h-4 mr-2" />
              Export SVG
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileOps.printDrawing(canvasRef.current)}>
              <Printer className="w-4 h-4 mr-2" />
              Print / Plot
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Right side quick actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10"
                onClick={cadState.undo}
                disabled={!cadState.canUndo}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10"
                onClick={cadState.redo}
                disabled={!cadState.canRedo}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* All tools in one row (wrapping; no horizontal scrollbar) */}
      <div className="flex flex-wrap items-start p-2 min-h-[60px] overflow-x-hidden">
        {/* Select */}
        <ToolSection title="Select">
          <ToolButton tool="select" icon={<MousePointer2 className="w-full h-full" />} label="Select" shortcut="Esc" />
        </ToolSection>

        {/* Draw */}
        <ToolSection title="Draw">
          <ToolButton tool="line" icon={<Minus className="w-full h-full" />} label="Line" shortcut="L" />
          <ToolButton tool="polyline" icon={<Spline className="w-full h-full" />} label="Polyline" />
          <ToolButton tool="rectangle" icon={<Square className="w-full h-full" />} label="Rect" />
          <ToolButton tool="circle" icon={<Circle className="w-full h-full" />} label="Circle" />
          <ToolButton tool="arc" icon={<CircleDot className="w-full h-full" />} label="Arc" />
          <ToolButton tool="ellipse" icon={<Egg className="w-full h-full" />} label="Ellipse" />
          <ToolButton tool="polygon" icon={<Hexagon className="w-full h-full" />} label="Polygon" />
          <ToolButton tool="spline" icon={<Spline className="w-full h-full" />} label="Spline" />
          <ToolButton tool="xline" icon={<MoveHorizontal className="w-full h-full" />} label="XLine" />
          <ToolButton tool="ray" icon={<ArrowRight className="w-full h-full" />} label="Ray" />
        </ToolSection>

        {/* Modify */}
        <ToolSection title="Modify">
          <ToolButton tool="move" icon={<Move className="w-full h-full" />} label="Move" />
          <ToolButton tool="copy" icon={<Copy className="w-full h-full" />} label="Copy" />
          <ToolButton tool="rotate" icon={<RotateCw className="w-full h-full" />} label="Rotate" />
          <ToolButton tool="scale" icon={<Maximize2 className="w-full h-full" />} label="Scale" />
          <ToolButton tool="mirror" icon={<FlipHorizontal className="w-full h-full" />} label="Mirror" />
          <ToolButton tool="offset" icon={<Copy className="w-full h-full" />} label="Offset" />
          <ToolButton tool="trim" icon={<Scissors className="w-full h-full" />} label="Trim" />
          <ToolButton tool="extend" icon={<CornerUpRight className="w-full h-full" />} label="Extend" />
          <ToolButton tool="fillet" icon={<CornerUpRight className="w-full h-full" />} label="Fillet" />
          <ToolButton tool="chamfer" icon={<Triangle className="w-full h-full" />} label="Chamfer" />
          <ToolButton tool="stretch" icon={<Maximize2 className="w-full h-full" />} label="Stretch" />
          <ToolButton tool="break" icon={<SplitSquareVertical className="w-full h-full" />} label="Break" />
          <ToolButton tool="explode" icon={<Bomb className="w-full h-full" />} label="Explode" />
          <ToolButton tool="join" icon={<Link className="w-full h-full" />} label="Join" />
          <ToolButton tool="erase" icon={<Eraser className="w-full h-full" />} label="Erase" />
        </ToolSection>

        {/* Array */}
        <ToolSection title="Array">
          <ToolButton tool="array-rect" icon={<Grid2X2 className="w-full h-full" />} label="RectArr" />
          <ToolButton tool="array-polar" icon={<RefreshCw className="w-full h-full" />} label="PolarArr" />
          <ToolButton tool="array-path" icon={<Route className="w-full h-full" />} label="PathArr" />
          <ToolButton tool="align" icon={<AlignCenter className="w-full h-full" />} label="Align" />
        </ToolSection>

        {/* Annotate */}
        <ToolSection title="Annotate">
          <ToolButton tool="text" icon={<Type className="w-full h-full" />} label="Text" />
          <ToolButton tool="dimension" icon={<Ruler className="w-full h-full" />} label="Dimension" />
          <ToolButton tool="leader" icon={<ArrowRightFromLine className="w-full h-full" />} label="Leader" />
          <ToolButton tool="hatch" icon={<Grid3X3 className="w-full h-full" />} label="Hatch" />
        </ToolSection>

        {/* View */}
        <ToolSection title="View">
          <ToolButton tool="pan" icon={<Hand className="w-full h-full" />} label="Pan" />
          <ToolButton tool="zoom" icon={<ZoomIn className="w-full h-full" />} label="Zoom" />
          <ActionButton onClick={cadState.zoomExtents} icon={<Maximize className="w-full h-full" />} label="Extents" />
          <ActionButton
            onClick={() => cadState.setGridSettings({ ...cadState.gridSettings, visible: !cadState.gridSettings.visible })}
            icon={<Grid3X3 className="w-full h-full" />}
            label="Grid"
          />
        </ToolSection>

        {/* Panels */}
        <ToolSection title="Panels">
          <ActionButton onClick={onOpenLayerPanel} icon={<Layers className="w-full h-full" />} label="Layers" />
          <ActionButton onClick={onOpenPropertiesPanel} icon={<Palette className="w-full h-full" />} label="Props" />
        </ToolSection>
      </div>
    </div>
  );
};

export default RibbonToolbar;