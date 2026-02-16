import React from 'react';
import { cn } from '@/lib/utils';
import { CADStateAPI } from '../types/cad.types';
import { DrawingToolsAPI } from '../hooks/useDrawingTools';
import {
  Grid3X3, Magnet, Navigation, Target, Compass, Type, Layers, Weight
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusBarProps {
  cadState: CADStateAPI;
  drawingTools: DrawingToolsAPI;
}

export const StatusBar: React.FC<StatusBarProps> = ({ cadState, drawingTools }) => {
  const { snapSettings, gridSettings, viewState } = cadState;
  const currentPoint = drawingTools.drawingState.currentPoint;

  const toggleSnap = (key: keyof typeof snapSettings) => {
    if (typeof snapSettings[key] === 'boolean') {
      cadState.setSnapSettings({
        ...snapSettings,
        [key]: !snapSettings[key]
      });
    }
  };

  const StatusButton: React.FC<{
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    tooltip: string;
  }> = ({ active, onClick, icon, label, tooltip }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
            active ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/60"
          )}
        >
          <span className="w-4 h-4">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex items-center justify-between h-8 px-2 bg-app-dark-gradient border-t border-white/10 text-xs text-white">
      {/* Left: Coordinates */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-mono min-w-[200px]">
          <span className="text-muted-foreground">X:</span>
          <span className="text-foreground w-16">{currentPoint?.x.toFixed(4) || '0.0000'}</span>
          <span className="text-muted-foreground">Y:</span>
          <span className="text-foreground w-16">{currentPoint?.y.toFixed(4) || '0.0000'}</span>
        </div>

        {/* Model/Paper Space indicator */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="font-medium">
            {cadState.layouts.find(l => l.id === cadState.activeLayoutId)?.name || 'Model'}
          </span>
        </div>
      </div>

      {/* Center: Drawing Aids */}
      <div className="flex items-center gap-1">
        <StatusButton
          active={gridSettings.visible}
          onClick={() => cadState.setGridSettings({ ...gridSettings, visible: !gridSettings.visible })}
          icon={<Grid3X3 className="w-full h-full" />}
          label="GRID"
          tooltip="Toggle Grid Display (F7)"
        />

        <StatusButton
          active={gridSettings.visible}
          onClick={() => cadState.setGridSettings({ ...gridSettings, visible: !gridSettings.visible })}
          icon={<Grid3X3 className="w-full h-full" />}
          label="GRID"
          tooltip="Toggle Grid Display (F7)"
        />

        {/* Snap Control with Dropdown */}
        <div className="flex items-center">
          <StatusButton
            active={snapSettings.enabled}
            onClick={() => cadState.setSnapSettings({ ...snapSettings, enabled: !snapSettings.enabled })}
            icon={<Magnet className="w-full h-full" />}
            label="OSNAP"
            tooltip="Object Snap (F3)"
          />
          <div className="relative group">
            <button className="h-6 w-4 hover:bg-white/10 flex items-center justify-center text-white/60">
              <svg width="8" height="4" viewBox="0 0 8 4" fill="currentColor">
                <path d="M0 0L4 4L8 0H0Z" />
              </svg>
            </button>
            {/* Popover Menu */}
            <div className="absolute bottom-full left-0 mb-1 w-32 bg-[#2a2a4c] border border-white/10 rounded shadow-xl hidden group-hover:block z-50 p-1">
              {['endpoint', 'midpoint', 'center', 'intersection', 'nearest'].map(mode => (
                <div
                  key={mode}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-white/10 cursor-pointer rounded",
                    snapSettings.modes.includes(mode as any) ? "text-orange-400" : "text-white/70"
                  )}
                  onClick={() => {
                    const newModes = snapSettings.modes.includes(mode as any)
                      ? snapSettings.modes.filter(m => m !== mode)
                      : [...snapSettings.modes, mode as any];
                    cadState.setSnapSettings({ ...snapSettings, modes: newModes });
                  }}
                >
                  <span className={cn("w-2 h-2 rounded-full", snapSettings.modes.includes(mode as any) ? "bg-orange-400" : "bg-white/20")} />
                  <span className="capitalize">{mode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <StatusButton
          active={snapSettings.ortho}
          onClick={() => toggleSnap('ortho')}
          icon={<Navigation className="w-full h-full" />}
          label="ORTHO"
          tooltip="Orthographic Mode (F8)"
        />

        <StatusButton
          active={snapSettings.polar}
          onClick={() => toggleSnap('polar')}
          icon={<Compass className="w-full h-full" />}
          label="POLAR"
          tooltip="Polar Tracking (F10)"
        />

        <StatusButton
          active={snapSettings.enabled}
          onClick={() => toggleSnap('enabled')}
          icon={<Target className="w-full h-full" />}
          label="OSNAP"
          tooltip="Object Snap (F3)"
        />

        <StatusButton
          active={snapSettings.dynamicInput}
          onClick={() => toggleSnap('dynamicInput')}
          icon={<Type className="w-full h-full" />}
          label="DYN"
          tooltip="Dynamic Input (F12)"
        />
      </div>

      {/* Right: View info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Zoom:</span>
          <span className="font-mono">{(viewState.zoom * 100).toFixed(0)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium">{cadState.currentLayer.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Weight className="w-3 h-3 text-muted-foreground" />
          <span>{cadState.currentLineWeight}mm</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded border border-border"
            style={{
              backgroundColor: `rgb(${cadState.currentColor.r}, ${cadState.currentColor.g}, ${cadState.currentColor.b})`
            }}
          />
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="font-mono uppercase">{cadState.unitSettings.format}</span>
        </div>

        <div className="text-muted-foreground">
          {cadState.selectedIds.length > 0 && (
            <span>{cadState.selectedIds.length} selected</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;