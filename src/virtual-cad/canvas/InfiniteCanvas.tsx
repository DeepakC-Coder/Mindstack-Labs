import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { CADStateAPI } from '../types/cad.types';
import { DrawingToolsAPI } from '../hooks/useDrawingTools';
import { Point, CADObject, LineData, CircleData, RectangleData, PolylineData, ArcData, PolygonData, SplineData, TextData, EllipseData, XLineData, RayData, ArrayObjectData, Block, BlockData, DimensionData } from '../types/cad.types';
import { distance, generatePolygonPoints, calculateSplinePoints, calculateEllipsePoints, offsetObjectData, rotateObjectData, pointOnPath } from '../utils/geometry';
import { Minus, Plus, Maximize } from 'lucide-react';

interface InfiniteCanvasProps {
  cadState: CADStateAPI;
  drawingTools: DrawingToolsAPI;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  cadState,
  drawingTools,
  canvasRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState<Point | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState({ x: 0, y: 0 });

  // Global keyboard listeners for Shift tracking and undo/redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Track Shift key
      if (e.key === 'Shift') {
        drawingTools.setShiftHeld(true);
      }
      // Global undo/redo (works even when canvas not focused)
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        cadState.undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        cadState.redo();
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        drawingTools.setShiftHeld(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [drawingTools, cadState]);

  // Filter objects by layer visibility/freeze (render-only)
  const visibleObjects = useMemo(() => {
    return cadState.objects.filter(obj => {
      const layer = cadState.layers.find(l => l.id === obj.layerId);
      if (!layer) return obj.visible;
      return obj.visible && layer.visible && !layer.frozen;
    });
  }, [cadState.objects, cadState.layers]);

  // Objects that can be interacted with (selection/modify) â€” respect layer visibility/freeze/lock.
  const interactableObjects = useMemo(() => {
    return cadState.objects.filter(obj => {
      if (!obj.visible || obj.locked) return false;
      const layer = cadState.layers.find(l => l.id === obj.layerId);
      if (!layer) return true;
      return layer.visible && !layer.frozen && !layer.locked;
    });
  }, [cadState.objects, cadState.layers]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
    const { center, zoom } = cadState.viewState;
    const { width, height } = dimensions;

    return {
      x: (screenX - width / 2) / zoom + center.x,
      y: (screenY - height / 2) / zoom + center.y
    };
  }, [cadState.viewState, dimensions]);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): Point => {
    const { center, zoom } = cadState.viewState;
    const { width, height } = dimensions;

    return {
      x: (worldX - center.x) * zoom + width / 2,
      y: (worldY - center.y) * zoom + height / 2
    };
  }, [cadState.viewState, dimensions]);

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width;
    canvas.height = height;

    const { center, zoom, visualStyle } = cadState.viewState;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Save context and apply transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-center.x, -center.y);

    // Draw grid
    if (cadState.gridSettings.visible) {
      drawGrid(ctx, center, zoom, width, height, cadState.gridSettings);
    }

    // Draw all visible objects (respecting layer visibility)
    visibleObjects.forEach(obj => {
      const layer = cadState.layers.find(l => l.id === obj.layerId);
      const isLocked = layer?.locked || obj.locked;
      drawObject(ctx, obj, zoom, visualStyle, cadState.blocks);
    });

    // Draw preview for current drawing operation
    if (drawingTools.drawingState.isDrawing) {
      drawPreview(ctx, cadState.activeTool, drawingTools.drawingState, cadState);
    }

    // Draw array preview ghost objects
    if (drawingTools.drawingState.arrayPreviewObjects.length > 0) {
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([6, 4]);
      drawingTools.drawingState.arrayPreviewObjects.forEach(obj => {
        drawObject(ctx, obj, zoom, visualStyle, cadState.blocks);
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Draw center point for polar arrays
      if (drawingTools.drawingState.arrayType === 'polar' && drawingTools.drawingState.arrayParams.center) {
        const c = drawingTools.drawingState.arrayParams.center;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b35';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
        // Cross hair at center
        ctx.beginPath();
        ctx.moveTo(c.x - 8 / zoom, c.y);
        ctx.lineTo(c.x + 8 / zoom, c.y);
        ctx.moveTo(c.x, c.y - 8 / zoom);
        ctx.lineTo(c.x, c.y + 8 / zoom);
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();
      }

      // Draw path line for path arrays
      if (drawingTools.drawingState.arrayType === 'path' && drawingTools.drawingState.arrayParams.pathPoints.length >= 2) {
        const pts = drawingTools.drawingState.arrayParams.pathPoints;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Draw path points
        pts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.fill();
        });
      }
    }

    ctx.restore();

    // Draw selection box (in screen coordinates)
    if (selectionBox) {
      ctx.strokeStyle = '#00a8ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      const startScreen = worldToScreen(selectionBox.start.x, selectionBox.start.y);
      const endScreen = worldToScreen(selectionBox.end.x, selectionBox.end.y);
      ctx.strokeRect(
        startScreen.x,
        startScreen.y,
        endScreen.x - startScreen.x,
        endScreen.y - startScreen.y
      );
      ctx.setLineDash([]);
    }

    // Draw snap indicator
    if (drawingTools.drawingState.snapResult) {
      const snap = drawingTools.drawingState.snapResult;
      const screenPos = worldToScreen(snap.point.x, snap.point.y);
      drawSnapIndicator(ctx, screenPos, snap.mode, snap.label);
    }

    // Draw coordinate display
    if (drawingTools.drawingState.currentPoint) {
      const pt = drawingTools.drawingState.currentPoint;
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`X: ${pt.x.toFixed(2)}  Y: ${pt.y.toFixed(2)}`, 10, height - 10);
    }

    // Draw Shift-constraint angle indicator
    if (drawingTools.drawingState.isShiftHeld && drawingTools.drawingState.shiftConstrainedAngle !== null && drawingTools.drawingState.currentPoint) {
      const pt = drawingTools.drawingState.currentPoint;
      const screenPt = worldToScreen(pt.x, pt.y);
      const angle = drawingTools.drawingState.shiftConstrainedAngle;

      // Small angle label near cursor
      ctx.save();
      ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${angle.toFixed(0)}°`, screenPt.x + 18, screenPt.y - 14);

      // Small arc to indicate constrained direction
      ctx.beginPath();
      ctx.arc(screenPt.x, screenPt.y, 12, 0, -angle * Math.PI / 180, angle < 0);
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Constraint icon (tiny diamond)
      ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.beginPath();
      ctx.moveTo(screenPt.x + 14, screenPt.y - 4);
      ctx.lineTo(screenPt.x + 18, screenPt.y);
      ctx.lineTo(screenPt.x + 14, screenPt.y + 4);
      ctx.lineTo(screenPt.x + 10, screenPt.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }, [cadState, drawingTools.drawingState, dimensions, selectionBox, worldToScreen, canvasRef, visibleObjects]);

  // Animation frame loop
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [render]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    let worldPoint = screenToWorld(screenX, screenY);

    // PRECISION FIX: Use snapped point if available
    if (drawingTools.drawingState.snapResult && cadState.snapSettings.enabled) {
      worldPoint = drawingTools.drawingState.snapResult.point;
    }

    // Middle mouse button for panning
    if (e.button === 1 || (e.button === 0 && cadState.activeTool === 'pan')) {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Left click
    if (e.button === 0) {
      const tool = cadState.activeTool;

      // Enforce layer lock/freeze for drawing tools.
      if (tool !== 'select') {
        const layer = cadState.currentLayer;
        if (layer.locked || layer.frozen) {
          return;
        }
      }

      if (tool === 'select') {
        // Check for object selection
        const hitObject = findObjectAtPoint(worldPoint, interactableObjects, cadState.viewState.zoom);

        if (hitObject) {
          cadState.selectObject(hitObject.id, e.shiftKey);
        } else {
          if (!e.shiftKey) {
            cadState.clearSelection();
          }
          // Start selection box
          setSelectionBox({ start: worldPoint, end: worldPoint });
        }
      } else if (['array-rect', 'array-polar', 'array-path'].includes(tool)) {
        // Array tool workflow
        const arrayStep = drawingTools.drawingState.arrayStep;
        if (arrayStep === 'idle') {
          // Activate array workflow
          const arrayType = tool === 'array-rect' ? 'rectangular' : tool === 'array-polar' ? 'polar' : 'path';
          drawingTools.startArrayWorkflow(arrayType as 'rectangular' | 'polar' | 'path');
        } else if (arrayStep === 'select-objects') {
          // In selection mode: select objects at click point
          const hitObject = findObjectAtPoint(worldPoint, interactableObjects, cadState.viewState.zoom);
          if (hitObject) {
            cadState.selectObject(hitObject.id, true); // Always add to selection
          }
        } else {
          // Forward to array click handler (set-center, set-params, etc.)
          drawingTools.handleArrayClick(worldPoint);
        }
      } else if (tool === 'arc' || tool === 'dimension') {
        // Arc and Dimension use 3-click mechanism
        if (drawingTools.drawingState.isDrawing) {
          drawingTools.finishDrawing(worldPoint);
        } else {
          drawingTools.startDrawing(worldPoint);
        }
      } else if (tool === 'polyline') {
        drawingTools.addPolylinePoint(worldPoint);
      } else if (tool === 'spline') {
        drawingTools.addSplinePoint(worldPoint);
      } else if (tool === 'text' || tool === 'mtext') {
        const content = prompt('Enter text:');
        if (content) {
          drawingTools.placeText(worldPoint, content, 12);
        }
      } else if (['move', 'copy', 'rotate', 'scale', 'mirror'].includes(tool)) {
        if (cadState.selectedIds.length > 0) {
          drawingTools.startModifyOperation(worldPoint);
        }
      } else {
        // Start drawing
        drawingTools.startDrawing(worldPoint);
      }
    }
  }, [cadState, drawingTools, screenToWorld, canvasRef, interactableObjects]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);

    // Track screen position for HUD
    setMouseScreenPos({ x: e.clientX, y: e.clientY });

    // Panning
    if (isPanning && lastPanPos) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      cadState.pan({ x: -dx, y: -dy });
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Update selection box
    if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, end: worldPoint } : null);
    }

    // Update drawing preview
    drawingTools.updateDrawing(worldPoint);
  }, [isPanning, lastPanPos, selectionBox, cadState, drawingTools, screenToWorld, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY);

    // End panning
    if (isPanning) {
      setIsPanning(false);
      setLastPanPos(null);
      return;
    }

    // Complete selection box
    if (selectionBox) {
      cadState.selectInRect(selectionBox.start, worldPoint);
      setSelectionBox(null);
      return;
    }

    const tool = cadState.activeTool;

    // Handle modify operations
    if (drawingTools.drawingState.isDrawing) {
      if (tool === 'move' && drawingTools.drawingState.startPoint) {
        const displacement = {
          x: worldPoint.x - drawingTools.drawingState.startPoint.x,
          y: worldPoint.y - drawingTools.drawingState.startPoint.y
        };
        drawingTools.executeMove(displacement);
      } else if (tool === 'copy' && drawingTools.drawingState.startPoint) {
        const displacement = {
          x: worldPoint.x - drawingTools.drawingState.startPoint.x,
          y: worldPoint.y - drawingTools.drawingState.startPoint.y
        };
        drawingTools.executeCopy(displacement);
      } else if (tool === 'rotate' && drawingTools.drawingState.startPoint) {
        const center = drawingTools.drawingState.startPoint;
        const angle = Math.atan2(
          worldPoint.y - center.y,
          worldPoint.x - center.x
        );
        drawingTools.executeRotate(center, angle);
      } else if (tool === 'scale' && drawingTools.drawingState.startPoint) {
        const center = drawingTools.drawingState.startPoint;
        const initialDist = 50;
        const currentDist = distance(center, worldPoint);
        const factor = currentDist / initialDist;
        drawingTools.executeScale(center, factor);
      } else if (tool === 'mirror' && drawingTools.drawingState.startPoint) {
        drawingTools.executeMirror(drawingTools.drawingState.startPoint, worldPoint);
      } else if (!['polyline', 'spline', 'arc', 'dimension', 'move', 'copy', 'rotate', 'scale', 'mirror'].includes(tool)) {
        drawingTools.finishDrawing(worldPoint);
      }
    }
  }, [isPanning, selectionBox, cadState, drawingTools, screenToWorld, canvasRef]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldBefore = screenToWorld(screenX, screenY);

    // Zoom
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.01, Math.min(50, cadState.viewState.zoom * zoomFactor));

    cadState.setViewState({
      ...cadState.viewState,
      zoom: newZoom
    });

    // Adjust center to zoom towards cursor
    const worldAfter = screenToWorld(screenX, screenY);
    cadState.setViewState(prev => ({
      ...prev,
      center: {
        x: prev.center.x + (worldBefore.x - worldAfter.x),
        y: prev.center.y + (worldBefore.y - worldAfter.y)
      }
    }));
  }, [cadState, screenToWorld, canvasRef]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const tool = cadState.activeTool;

    if (tool === 'polyline') {
      drawingTools.finishPolyline(e.shiftKey);
    } else if (tool === 'spline') {
      drawingTools.finishSpline();
    } else if (['array-rect', 'array-polar', 'array-path'].includes(tool)) {
      // Double-click to confirm path definition or to commit array
      if (drawingTools.drawingState.arrayStep === 'set-params') {
        drawingTools.confirmArraySelection();
      } else if (drawingTools.drawingState.arrayStep === 'preview') {
        drawingTools.confirmArray();
      }
    }
  }, [cadState.activeTool, drawingTools]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape to cancel
    if (e.key === 'Escape') {
      drawingTools.cancelDrawing();
      cadState.clearSelection();
    }

    // Delete selected objects
    if (e.key === 'Delete' || e.key === 'Backspace') {
      cadState.deleteObjects(cadState.selectedIds);
    }

    // Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      cadState.undo();
    }

    // Ctrl+Y for redo
    if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      cadState.redo();
    }

    // Ctrl+A for select all
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      cadState.selectAll();
    }

    // Ctrl+C for copy
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      cadState.copyToClipboard();
    }

    // Ctrl+V for paste
    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      cadState.pasteFromClipboard();
    }

    // Enter to finish polyline/spline or confirm array
    if (e.key === 'Enter') {
      const tool = cadState.activeTool;
      if (tool === 'polyline') {
        drawingTools.finishPolyline(false);
      } else if (tool === 'spline') {
        drawingTools.finishSpline();
      } else if (['array-rect', 'array-polar', 'array-path'].includes(tool)) {
        const arrayStep = drawingTools.drawingState.arrayStep;
        if (arrayStep === 'select-objects') {
          drawingTools.confirmArraySelection();
        } else if (arrayStep === 'set-params') {
          drawingTools.confirmArraySelection();
        } else if (arrayStep === 'preview') {
          drawingTools.confirmArray();
        }
      }
    }

    // C to close polyline
    if (e.key === 'c' || e.key === 'C') {
      if (cadState.activeTool === 'polyline' && drawingTools.drawingState.isDrawing) {
        drawingTools.finishPolyline(true);
      }
    }
  }, [cadState, drawingTools]);

  // Handle dynamic input submission
  const handleDynamicInputSubmit = useCallback((type: 'x' | 'y' | 'distance' | 'angle' | 'radius', value: number) => {
    const startPoint = drawingTools.drawingState.startPoint;
    const currentPoint = drawingTools.drawingState.currentPoint;

    if (!currentPoint) return;

    let newPoint: Point = { ...currentPoint };

    if (type === 'x') {
      newPoint.x = value;
    } else if (type === 'y') {
      newPoint.y = value;
    } else if (type === 'distance' && startPoint) {
      const angle = Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x);
      newPoint = {
        x: startPoint.x + value * Math.cos(angle),
        y: startPoint.y + value * Math.sin(angle)
      };
    } else if (type === 'radius' && startPoint) {
      const angle = Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x);
      newPoint = {
        x: startPoint.x + value * Math.cos(angle),
        y: startPoint.y + value * Math.sin(angle)
      };
    }

    // Update drawing and potentially finish
    drawingTools.updateDrawing(newPoint);

    // For certain tools, submit on Enter
    if (['line', 'circle', 'rectangle', 'arc', 'polygon'].includes(cadState.activeTool)) {
      drawingTools.finishDrawing(newPoint);
    }
  }, [drawingTools, cadState.activeTool]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden w-full h-full"
      style={{ backgroundColor: '#1a1a2e' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={dimensions.width}
        height={dimensions.height}
        style={{
          cursor: isPanning ? 'grabbing' :
            cadState.activeTool === 'pan' ? 'grab' :
              cadState.activeTool === 'select' ? 'default' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isPanning) {
            setIsPanning(false);
            setLastPanPos(null);
          }
        }}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Array workflow prompt bar */}
      {drawingTools.drawingState.arrayStep !== 'idle' && drawingTools.drawingState.arrayPrompt && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-orange-500/90 text-white text-sm font-medium shadow-lg backdrop-blur border border-orange-400/50 flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>{drawingTools.drawingState.arrayPrompt}</span>
          {drawingTools.drawingState.arrayStep === 'select-objects' && (
            <button
              onClick={() => drawingTools.confirmArraySelection()}
              className="ml-2 px-3 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition"
            >
              Done ↵
            </button>
          )}
          <button
            onClick={() => drawingTools.cancelDrawing()}
            className="ml-1 px-2 py-1 bg-white/10 rounded text-xs hover:bg-white/20 transition"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Array Parameters floating panel */}
      {drawingTools.drawingState.arrayStep === 'preview' && drawingTools.drawingState.arrayType && (
        <div className="absolute top-14 right-3 z-50 w-64 bg-card/95 backdrop-blur border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-orange-500/90 text-white text-sm font-semibold flex items-center gap-2">
            <span>
              {drawingTools.drawingState.arrayType === 'rectangular' ? '▦ Rectangular' :
                drawingTools.drawingState.arrayType === 'polar' ? '◎ Polar' : '⤳ Path'} Array
            </span>
          </div>
          <div className="p-3 space-y-2.5 text-xs">
            {/* Rectangular Array Params */}
            {drawingTools.drawingState.arrayType === 'rectangular' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Rows</label>
                  <input type="number" min={1} max={50} value={drawingTools.drawingState.arrayParams.rows}
                    onChange={e => drawingTools.updateArrayParams({ rows: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Columns</label>
                  <input type="number" min={1} max={50} value={drawingTools.drawingState.arrayParams.columns}
                    onChange={e => drawingTools.updateArrayParams({ columns: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Row Spacing</label>
                  <input type="number" step={5} value={drawingTools.drawingState.arrayParams.rowSpacing}
                    onChange={e => drawingTools.updateArrayParams({ rowSpacing: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Col Spacing</label>
                  <input type="number" step={5} value={drawingTools.drawingState.arrayParams.columnSpacing}
                    onChange={e => drawingTools.updateArrayParams({ columnSpacing: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Inc. Rotation°</label>
                  <input type="number" step={5} value={drawingTools.drawingState.arrayParams.incrementalRotation}
                    onChange={e => drawingTools.updateArrayParams({ incrementalRotation: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
              </>
            )}

            {/* Polar Array Params */}
            {drawingTools.drawingState.arrayType === 'polar' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Items</label>
                  <input type="number" min={2} max={100} value={drawingTools.drawingState.arrayParams.itemCount}
                    onChange={e => drawingTools.updateArrayParams({ itemCount: Math.max(2, parseInt(e.target.value) || 2) })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Fill Angle°</label>
                  <input type="number" step={15} value={drawingTools.drawingState.arrayParams.fillAngle}
                    onChange={e => drawingTools.updateArrayParams({ fillAngle: parseFloat(e.target.value) || 360 })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Angle Between</span>
                  <span className="text-foreground font-mono">
                    {(drawingTools.drawingState.arrayParams.fillAngle / drawingTools.drawingState.arrayParams.itemCount).toFixed(1)}°
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Rotate Items</label>
                  <input type="checkbox" checked={drawingTools.drawingState.arrayParams.rotateItems}
                    onChange={e => drawingTools.updateArrayParams({ rotateItems: e.target.checked })}
                    className="w-4 h-4 accent-orange-500 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Direction</label>
                  <select value={drawingTools.drawingState.arrayParams.clockwise ? 'cw' : 'ccw'}
                    onChange={e => drawingTools.updateArrayParams({ clockwise: e.target.value === 'cw' })}
                    className="px-2 py-1 rounded bg-background border border-border text-foreground text-xs cursor-pointer">
                    <option value="ccw">↺ CCW</option>
                    <option value="cw">↻ CW</option>
                  </select>
                </div>
              </>
            )}

            {/* Path Array Params */}
            {drawingTools.drawingState.arrayType === 'path' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Items</label>
                  <input type="number" min={2} max={100} value={drawingTools.drawingState.arrayParams.itemCount}
                    onChange={e => drawingTools.updateArrayParams({ itemCount: Math.max(2, parseInt(e.target.value) || 2) })}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-right text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground">Tangent Align</label>
                  <input type="checkbox" checked={drawingTools.drawingState.arrayParams.tangentAlign}
                    onChange={e => drawingTools.updateArrayParams({ tangentAlign: e.target.checked })}
                    className="w-4 h-4 accent-orange-500 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Path Points</span>
                  <span className="text-foreground font-mono">{drawingTools.drawingState.arrayParams.pathPoints.length}</span>
                </div>
              </>
            )}

            <hr className="border-border" />

            {/* Common: Associative toggle */}
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground">Associative</label>
              <input type="checkbox" checked={drawingTools.drawingState.arrayParams.associative}
                onChange={e => drawingTools.updateArrayParams({ associative: e.target.checked })}
                className="w-4 h-4 accent-orange-500 cursor-pointer" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => drawingTools.confirmArray()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition shadow"
              >
                ✓ Confirm
              </button>
              <button
                onClick={() => drawingTools.cancelDrawing()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-accent transition"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right zoom controls */}
      <div className="absolute bottom-3 right-3 z-40 flex flex-col gap-2">
        <button
          type="button"
          onClick={cadState.zoomIn}
          className="h-9 w-9 rounded-md bg-card/90 text-foreground shadow-md border border-border backdrop-blur hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-4 w-4 mx-auto" />
        </button>
        <button
          type="button"
          onClick={cadState.zoomOut}
          className="h-9 w-9 rounded-md bg-card/90 text-foreground shadow-md border border-border backdrop-blur hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-4 w-4 mx-auto" />
        </button>
        <button
          type="button"
          onClick={cadState.zoomExtents}
          className="h-9 w-9 rounded-md bg-card/90 text-foreground shadow-md border border-border backdrop-blur hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Zoom extents"
          title="Zoom extents"
        >
          <Maximize className="h-4 w-4 mx-auto" />
        </button>
      </div>
    </div>
  );
};

// Helper drawing functions
function drawGrid(
  ctx: CanvasRenderingContext2D,
  center: Point,
  zoom: number,
  width: number,
  height: number,
  settings: { spacing: number; majorLineEvery: number }
) {
  const { spacing, majorLineEvery } = settings;

  const viewWidth = width / zoom;
  const viewHeight = height / zoom;

  const startX = Math.floor((center.x - viewWidth / 2) / spacing) * spacing;
  const endX = Math.ceil((center.x + viewWidth / 2) / spacing) * spacing;
  const startY = Math.floor((center.y - viewHeight / 2) / spacing) * spacing;
  const endY = Math.ceil((center.y + viewHeight / 2) / spacing) * spacing;

  ctx.beginPath();

  for (let x = startX; x <= endX; x += spacing) {
    const isMajor = Math.abs(x) % (spacing * majorLineEvery) < 0.01;
    ctx.strokeStyle = isMajor ? '#3a3a5c' : '#2a2a4c';
    ctx.lineWidth = isMajor ? 0.5 / zoom : 0.25 / zoom;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += spacing) {
    const isMajor = Math.abs(y) % (spacing * majorLineEvery) < 0.01;
    ctx.strokeStyle = isMajor ? '#3a3a5c' : '#2a2a4c';
    ctx.lineWidth = isMajor ? 0.5 / zoom : 0.25 / zoom;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Draw origin
  ctx.strokeStyle = '#ff5555';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  ctx.moveTo(-15 / zoom, 0);
  ctx.lineTo(15 / zoom, 0);
  ctx.stroke();

  ctx.strokeStyle = '#55ff55';
  ctx.beginPath();
  ctx.moveTo(0, -15 / zoom);
  ctx.lineTo(0, 15 / zoom);
  ctx.stroke();
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: CADObject,
  zoom: number,
  visualStyle: string,
  blocks: Block[]
) {
  const { color, lineWeight, lineType, selected } = obj;

  ctx.strokeStyle = selected ? '#00ff00' : `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.lineWidth = Math.max(lineWeight, 0.5 / zoom);

  // Set line dash
  const dashScale = 1 / zoom;
  switch (lineType) {
    case 'dashed':
      ctx.setLineDash([10 * dashScale, 5 * dashScale]);
      break;
    case 'dotted':
      ctx.setLineDash([2 * dashScale, 3 * dashScale]);
      break;
    case 'dashdot':
      ctx.setLineDash([10 * dashScale, 3 * dashScale, 2 * dashScale, 3 * dashScale]);
      break;
    case 'center':
      ctx.setLineDash([15 * dashScale, 3 * dashScale, 5 * dashScale, 3 * dashScale]);
      break;
    default:
      ctx.setLineDash([]);
  }

  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      ctx.beginPath();
      ctx.moveTo(data.start.x, data.start.y);
      ctx.lineTo(data.end.x, data.end.y);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const data = obj.data as CircleData;
      ctx.beginPath();
      ctx.arc(data.center.x, data.center.y, data.radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      const data = obj.data as ArcData;
      ctx.beginPath();
      ctx.arc(data.center.x, data.center.y, data.radius, data.startAngle, data.endAngle);
      ctx.stroke();
      break;
    }

    case 'rectangle': {
      const data = obj.data as RectangleData;
      const x = Math.min(data.corner1.x, data.corner2.x);
      const y = Math.min(data.corner1.y, data.corner2.y);
      const w = Math.abs(data.corner2.x - data.corner1.x);
      const h = Math.abs(data.corner2.y - data.corner1.y);
      ctx.strokeRect(x, y, w, h);
      break;
    }

    case 'polyline': {
      const data = obj.data as PolylineData;
      if (data.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(data.points[0].x, data.points[0].y);
      for (let i = 1; i < data.points.length; i++) {
        ctx.lineTo(data.points[i].x, data.points[i].y);
      }
      if (data.closed) {
        ctx.closePath();
      }
      ctx.stroke();
      break;
    }

    case 'polygon': {
      const data = obj.data as PolygonData;
      const vertices = generatePolygonPoints(data.center, data.radius, data.sides, data.rotation);
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'spline': {
      const data = obj.data as SplineData;
      const points = calculateSplinePoints(data.controlPoints);
      if (points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      break;
    }

    case 'text':
    case 'mtext': {
      const data = obj.data as TextData;
      ctx.save();
      ctx.translate(data.position.x, data.position.y);
      ctx.rotate(data.rotation || 0);
      ctx.font = `${data.height}px Arial`;
      ctx.fillText(data.content, 0, 0);
      ctx.restore();
      break;
    }

    case 'ellipse': {
      const data = obj.data as EllipseData;
      const pts = calculateEllipsePoints(data.center, data.majorRadius, data.minorRadius, data.rotation);
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }

    case 'xline': {
      const data = obj.data as XLineData;
      // Draw construction line extending far in both directions
      const extent = 100000;
      ctx.save();
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(data.point.x - data.direction.x * extent, data.point.y - data.direction.y * extent);
      ctx.lineTo(data.point.x + data.direction.x * extent, data.point.y + data.direction.y * extent);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'ray': {
      const data = obj.data as RayData;
      // Draw semi-infinite line from point in direction
      const extent = 100000;
      ctx.save();
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(data.point.x, data.point.y);
      ctx.lineTo(data.point.x + data.direction.x * extent, data.point.y + data.direction.y * extent);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'block': {
      const data = obj.data as BlockData;
      const blockDef = blocks.find(b => b.id === data.blockId);
      if (!blockDef) break;

      ctx.save();

      // Apply block transform: Insertion + Rotation + Scale
      ctx.translate(data.insertionPoint.x, data.insertionPoint.y);
      ctx.rotate(data.rotation);

      // Handle scale (Point vs number)
      const scaleX = typeof data.scale === 'number' ? data.scale : data.scale.x;
      const scaleY = typeof data.scale === 'number' ? data.scale : data.scale.y;
      ctx.scale(scaleX, scaleY);

      // Adjust for block definition base point (origin of the block coordinates)
      // Objects in block are relative to (0,0). Block base point defines where (0,0) is relative to insertion point.
      // Actually standard CAD: Objects are defined in block space. BasePoint is the "handle" in block space.
      // When inserting, BasePoint maps to InsertionPoint.
      // So we must subtract BasePoint.
      ctx.translate(-blockDef.basePoint.x, -blockDef.basePoint.y);

      // Recursive draw
      blockDef.objects.forEach(child => {
        // Inherit selection? Or not? Usually blocks are selected as a unit.
        // Children are drawn "as is" but transformed.
        drawObject(ctx, child, zoom, visualStyle, blocks);
      });

      ctx.restore();
      break;
    }

    case 'array': {
      const data = obj.data as ArrayObjectData;
      // Render array by generating and drawing all instances
      if (data.sourceObjects && data.sourceObjects.length > 0) {
        const instances = generateArrayInstances(data);
        instances.forEach(inst => {
          drawObject(ctx, inst, zoom, visualStyle, blocks);
        });
      }
      break;
    }
    case 'dimension': {
      const data = obj.data as DimensionData;
      if (data.points.length >= 2) {
        // Use textPosition as placement point if available, else midpoint
        const placement = data.textPosition || {
          x: (data.points[0].x + data.points[1].x) / 2,
          y: (data.points[0].y + data.points[1].y) / 2
        };
        // Use explicit type or default aligned
        const type = (data.type === 'horizontal' || data.type === 'vertical') ? data.type : 'aligned';
        drawDimension(ctx, data.points[0], data.points[1], placement, type, zoom);
      }
      break;
    }
  }

  // Draw selection handles
  if (selected) {
    drawSelectionHandles(ctx, obj, zoom);
  }

  ctx.setLineDash([]);
}

function drawDimension(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, placement: Point, type: 'aligned' | 'horizontal' | 'vertical', zoom: number) {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let len = Math.sqrt(dx * dx + dy * dy);

  if (len > 0) {
    let ux, uy, nx, ny;

    if (type === 'horizontal') {
      len = Math.abs(dx);
      ux = Math.sign(dx) || 1;
      uy = 0;
      nx = 0;
      ny = 1;
    } else if (type === 'vertical') {
      len = Math.abs(dy);
      ux = 0;
      uy = Math.sign(dy) || 1;
      nx = -1;
      ny = 0;
    } else {
      ux = dx / len;
      uy = dy / len;
      nx = -uy;
      ny = ux;
    }

    const vx = placement.x - p1.x;
    const vy = placement.y - p1.y;
    const offsetDist = vx * nx + vy * ny;
    const worldOffset = offsetDist;

    // Minimalist Drafting Standards
    const gap = 4 / zoom;      // Offset from object
    const overshoot = 6 / zoom; // Extension past dimension line
    const maxExtLength = 30 / zoom; // Max visible length of extension line

    // Calculate start and end distances for extension lines relative to object (0)
    // extensionStart: distance along normal where line starts
    // extensionEnd: distance along normal where line ends

    const sign = Math.sign(worldOffset) || 1;
    const targetEnd = worldOffset + sign * overshoot;
    const targetStart = sign * gap;

    // Clamp length: if the offset is huge, don't draw a huge line.
    // The extension line should "grow" from the dimension line back towards the object.
    let extStartDist = targetStart;
    if (Math.abs(targetEnd - targetStart) > maxExtLength) {
      extStartDist = targetEnd - sign * maxExtLength;
    }

    const extStart1 = {
      x: p1.x + nx * extStartDist,
      y: p1.y + ny * extStartDist
    };
    const extEnd1 = {
      x: p1.x + nx * targetEnd,
      y: p1.y + ny * targetEnd
    };

    const extStart2 = {
      x: p2.x + nx * extStartDist,
      y: p2.y + ny * extStartDist
    };
    const extEnd2 = {
      x: p2.x + nx * targetEnd,
      y: p2.y + ny * targetEnd
    };

    const dim1 = {
      x: p1.x + nx * worldOffset,
      y: p1.y + ny * worldOffset
    };
    const dim2 = {
      x: p2.x + nx * worldOffset,
      y: p2.y + ny * worldOffset
    };

    ctx.save();

    // Extension Lines: Subtler color and thinner weight
    ctx.strokeStyle = '#00aaaa'; // Darker cyan for extension lines
    ctx.lineWidth = 0.75 / zoom;

    ctx.beginPath();
    ctx.moveTo(extStart1.x, extStart1.y);
    ctx.lineTo(extEnd1.x, extEnd1.y);
    ctx.moveTo(extStart2.x, extStart2.y);
    ctx.lineTo(extEnd2.x, extEnd2.y);
    ctx.stroke();

    // Main Dimension Line: Bright and clear
    ctx.strokeStyle = '#00ffff';
    ctx.fillStyle = '#00ffff';
    ctx.lineWidth = 1 / zoom;

    ctx.beginPath();
    ctx.moveTo(dim1.x, dim1.y);
    ctx.lineTo(dim2.x, dim2.y);
    ctx.stroke();

    const arrowSize = 10 / zoom;
    const ddx = dim2.x - dim1.x;
    const ddy = dim2.y - dim1.y;
    const dlen = Math.sqrt(ddx * ddx + ddy * ddy);
    const uax = (dlen > 0) ? ddx / dlen : ux;
    const uay = (dlen > 0) ? ddy / dlen : uy;

    ctx.beginPath();
    ctx.moveTo(dim1.x, dim1.y);
    ctx.lineTo(
      dim1.x + (uax * arrowSize) + (uay * arrowSize * 0.3),
      dim1.y + (uay * arrowSize) - (uax * arrowSize * 0.3)
    );
    ctx.lineTo(
      dim1.x + (uax * arrowSize) - (uay * arrowSize * 0.3),
      dim1.y + (uay * arrowSize) + (uax * arrowSize * 0.3)
    );
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(dim2.x, dim2.y);
    ctx.lineTo(
      dim2.x - (uax * arrowSize) + (uay * arrowSize * 0.3),
      dim2.y - (uay * arrowSize) - (uax * arrowSize * 0.3)
    );
    ctx.lineTo(
      dim2.x - (uax * arrowSize) - (uay * arrowSize * 0.3),
      dim2.y - (uay * arrowSize) + (uax * arrowSize * 0.3)
    );
    ctx.closePath();
    ctx.fill();

    const midX = (dim1.x + dim2.x) / 2;
    const midY = (dim1.y + dim2.y) / 2;
    let angle = Math.atan2(ddy, ddx);

    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }

    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const text = len.toFixed(4);
    const fontSize = 12 / zoom;
    ctx.font = `${fontSize}px monospace`;
    const textMetrics = ctx.measureText(text);
    const padding = 4 / zoom;
    const boxHeight = 20 / zoom;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(
      -textMetrics.width / 2 - padding,
      -boxHeight / 2 - padding,
      textMetrics.width + padding * 2,
      boxHeight
    );

    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, obj: CADObject, zoom: number) {
  const handleSize = 6 / zoom;
  ctx.fillStyle = '#00ff00';

  const drawHandle = (x: number, y: number) => {
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  };

  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      drawHandle(data.start.x, data.start.y);
      drawHandle(data.end.x, data.end.y);
      break;
    }
    case 'circle': {
      const data = obj.data as CircleData;
      drawHandle(data.center.x, data.center.y);
      drawHandle(data.center.x + data.radius, data.center.y);
      break;
    }
    case 'rectangle': {
      const data = obj.data as RectangleData;
      drawHandle(data.corner1.x, data.corner1.y);
      drawHandle(data.corner2.x, data.corner1.y);
      drawHandle(data.corner2.x, data.corner2.y);
      drawHandle(data.corner1.x, data.corner2.y);
      break;
    }
    case 'polyline': {
      const data = obj.data as PolylineData;
      data.points.forEach(p => drawHandle(p.x, p.y));
      break;
    }
  }
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  tool: string,
  state: { startPoint: Point | null; currentPoint: Point | null; points: Point[]; sides: number },
  cadState: CADStateAPI
) {
  if (!state.startPoint || !state.currentPoint) return;

  ctx.strokeStyle = '#00a8ff';
  ctx.lineWidth = 1 / cadState.viewState.zoom;
  ctx.setLineDash([5 / cadState.viewState.zoom, 5 / cadState.viewState.zoom]);

  switch (tool) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(state.startPoint.x, state.startPoint.y);
      ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
      ctx.stroke();
      break;

    case 'rectangle':
      const x = Math.min(state.startPoint.x, state.currentPoint.x);
      const y = Math.min(state.startPoint.y, state.currentPoint.y);
      const w = Math.abs(state.currentPoint.x - state.startPoint.x);
      const h = Math.abs(state.currentPoint.y - state.startPoint.y);
      ctx.strokeRect(x, y, w, h);
      break;

    case 'circle':
      const radius = distance(state.startPoint, state.currentPoint);
      ctx.beginPath();
      ctx.arc(state.startPoint.x, state.startPoint.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'arc': {
      // Arc preview based on drawing step
      if (state.points.length >= 2) {
        // Step 2: Drawing end angle with known center and start
        const center = state.points[0];
        const startPt = state.points[1];
        const arcRadius = distance(center, startPt);
        const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
        const endAngle = Math.atan2(state.currentPoint.y - center.y, state.currentPoint.x - center.x);
        ctx.beginPath();
        ctx.arc(center.x, center.y, arcRadius, startAngle, endAngle);
        ctx.stroke();
      } else if (state.points.length >= 1) {
        // Step 1: Drawing radius/start point from center
        const center = state.points[0];
        const arcRadius = distance(center, state.currentPoint);
        ctx.beginPath();
        ctx.arc(center.x, center.y, arcRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Draw line from center to current point
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
      } else {
        // Step 0: Just show circle preview from start point
        const arcRadius = distance(state.startPoint, state.currentPoint);
        ctx.beginPath();
        ctx.arc(state.startPoint.x, state.startPoint.y, arcRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'polygon': {
      const polyRadius = distance(state.startPoint, state.currentPoint);
      const rotation = Math.atan2(
        state.currentPoint.y - state.startPoint.y,
        state.currentPoint.x - state.startPoint.x
      ) + Math.PI / 2;
      const vertices = generatePolygonPoints(state.startPoint, polyRadius, state.sides, rotation);
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'ellipse': {
      if (state.points.length >= 2) {
        // Drawing minor radius
        const center = state.points[0];
        const majorEnd = state.points[1];
        const majorR = distance(center, majorEnd);
        const rot = Math.atan2(majorEnd.y - center.y, majorEnd.x - center.x);
        const dx = state.currentPoint.x - center.x;
        const dy = state.currentPoint.y - center.y;
        const minorR = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
        const pts = calculateEllipsePoints(center, majorR, Math.min(minorR, majorR), rot);
        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.stroke();
        }
      } else {
        // Drawing major axis
        const majorR = distance(state.startPoint, state.currentPoint);
        ctx.beginPath();
        ctx.arc(state.startPoint.x, state.startPoint.y, majorR, 0, Math.PI * 2);
        ctx.stroke();
        // Draw major axis line
        ctx.beginPath();
        ctx.moveTo(state.startPoint.x, state.startPoint.y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
      }
      break;
    }

    case 'xline': {
      const extent = 100000;
      const dx = state.currentPoint.x - state.startPoint.x;
      const dy = state.currentPoint.y - state.startPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const dirX = dx / len, dirY = dy / len;
        ctx.beginPath();
        ctx.moveTo(state.startPoint.x - dirX * extent, state.startPoint.y - dirY * extent);
        ctx.lineTo(state.startPoint.x + dirX * extent, state.startPoint.y + dirY * extent);
        ctx.stroke();
      }
      break;
    }

    case 'ray': {
      const extent = 100000;
      const dx = state.currentPoint.x - state.startPoint.x;
      const dy = state.currentPoint.y - state.startPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const dirX = dx / len, dirY = dy / len;
        ctx.beginPath();
        ctx.moveTo(state.startPoint.x, state.startPoint.y);
        ctx.lineTo(state.startPoint.x + dirX * extent, state.startPoint.y + dirY * extent);
        ctx.stroke();
      }
      break;
    }

    case 'dimension':
      // 3-Step Dimension Preview
      if (state.points.length === 2) {
        // Step 3: Placement phase
        const p1 = state.points[0], p2 = state.points[1];
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        // Dynamically calculate alignment based on mouse position
        let type: 'horizontal' | 'vertical' | 'aligned' = 'aligned';
        const mdx = Math.abs(state.currentPoint.x - mid.x);
        const mdy = Math.abs(state.currentPoint.y - mid.y);

        if (mdx > mdy * 2) type = 'vertical';
        else if (mdy > mdx * 2) type = 'horizontal';
        else type = 'aligned';

        drawDimension(ctx, p1, p2, state.currentPoint, type, cadState.viewState.zoom);
      } else if (state.points.length === 1) {
        // Step 2: Selecting second point of the segment
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.setLineDash([5 / cadState.viewState.zoom, 5 / cadState.viewState.zoom]);
        ctx.beginPath();
        ctx.moveTo(state.points[0].x, state.points[0].y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
        ctx.restore();
      } else if (state.startPoint) {
        // Step 1: Initial starting phase
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.setLineDash([5 / cadState.viewState.zoom, 5 / cadState.viewState.zoom]);
        ctx.beginPath();
        ctx.moveTo(state.startPoint.x, state.startPoint.y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
        ctx.restore();
      }
      break;


    case 'polyline':
      if (state.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(state.points[0].x, state.points[0].y);
        for (let i = 1; i < state.points.length; i++) {
          ctx.lineTo(state.points[i].x, state.points[i].y);
        }
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
      }
      break;

    case 'spline':
      if (state.points.length > 0) {
        const allPoints = [...state.points, state.currentPoint];
        const splinePoints = calculateSplinePoints(allPoints);
        if (splinePoints.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(splinePoints[0].x, splinePoints[0].y);
          for (let i = 1; i < splinePoints.length; i++) {
            ctx.lineTo(splinePoints[i].x, splinePoints[i].y);
          }
          ctx.stroke();
        }
      }
      break;

    case 'move':
    case 'copy':
      // Draw displacement vector
      ctx.beginPath();
      ctx.moveTo(state.startPoint.x, state.startPoint.y);
      ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
      ctx.stroke();
      break;

    case 'mirror':
      // Draw mirror line
      ctx.beginPath();
      ctx.moveTo(state.startPoint.x, state.startPoint.y);
      ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
      ctx.stroke();
      break;
  }

  ctx.setLineDash([]);
}

function drawSnapIndicator(ctx: CanvasRenderingContext2D, pos: Point, mode: string, label?: string) {
  const size = 10; // Slightly larger
  const color = '#00ffcc'; // Neon Cyan/Green

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5; // Glow effect

  switch (mode) {
    case 'endpoint':
      ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
      break;
    case 'midpoint':
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size / 2); // Top
      ctx.lineTo(pos.x + size / 2, pos.y + size / 2); // Right
      ctx.lineTo(pos.x - size / 2, pos.y + size / 2); // Left
      ctx.closePath();
      ctx.stroke();
      break;
    case 'center':
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'intersection':
      ctx.beginPath();
      ctx.moveTo(pos.x - size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y + size / 2);
      ctx.moveTo(pos.x + size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x - size / 2, pos.y + size / 2);
      ctx.stroke();
      break;
    case 'quadrant':
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size / 2);
      ctx.lineTo(pos.x, pos.y + size / 2);
      ctx.moveTo(pos.x - size / 2, pos.y);
      ctx.lineTo(pos.x + size / 2, pos.y);
      ctx.stroke();
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y);
      ctx.lineTo(pos.x, pos.y + size / 2);
      ctx.lineTo(pos.x - size / 2, pos.y);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'perpendicular':
      ctx.beginPath();
      ctx.moveTo(pos.x - size / 2, pos.y + size / 2);
      ctx.lineTo(pos.x - size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y - size / 2);
      ctx.stroke();
      // Little box in corner
      ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size / 3, size / 3);
      break;
    case 'nearest':
      // Hourglass? Or just crossed circle?
      ctx.beginPath();
      ctx.moveTo(pos.x - size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y + size / 2);
      ctx.moveTo(pos.x + size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x - size / 2, pos.y + size / 2);
      ctx.stroke();
      // Top/Bottom bars
      ctx.beginPath();
      ctx.moveTo(pos.x - size / 2, pos.y - size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y - size / 2);
      ctx.moveTo(pos.x - size / 2, pos.y + size / 2);
      ctx.lineTo(pos.x + size / 2, pos.y + size / 2);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore(); // Remove shadow/color affect on text

  // Draw label below the indicator
  if (label) {
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(label).width;
    const padding = 4;
    const boxX = pos.x + size + 5;
    const boxY = pos.y - size;

    // Background Box
    ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, textWidth + padding * 2, 20, 4);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.fillText(label, boxX + padding, boxY + 10);
    ctx.restore();
  }
}

function findObjectAtPoint(point: Point, objects: CADObject[], zoom: number): CADObject | null {
  const tolerance = 10 / zoom;

  // Search in reverse order (topmost first)
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (!obj.visible || obj.locked) continue;

    if (isPointNearObject(point, obj, tolerance)) {
      return obj;
    }
  }

  return null;
}

function isPointNearObject(point: Point, obj: CADObject, tolerance: number): boolean {
  switch (obj.type) {
    case 'line': {
      const data = obj.data as LineData;
      return isPointNearLine(point, data.start, data.end, tolerance);
    }
    case 'circle': {
      const data = obj.data as CircleData;
      const dist = distance(point, data.center);
      return Math.abs(dist - data.radius) < tolerance;
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
        if (isPointNearLine(point, corners[i], corners[(i + 1) % 4], tolerance)) {
          return true;
        }
      }
      return false;
    }
    case 'polyline': {
      const data = obj.data as PolylineData;
      for (let i = 0; i < data.points.length - 1; i++) {
        if (isPointNearLine(point, data.points[i], data.points[i + 1], tolerance)) {
          return true;
        }
      }
      if (data.closed && data.points.length > 2) {
        if (isPointNearLine(point, data.points[data.points.length - 1], data.points[0], tolerance)) {
          return true;
        }
      }
      return false;
    }
    case 'text':
    case 'mtext': {
      const data = obj.data as TextData;
      const textWidth = data.content.length * data.height * 0.6;
      const textHeight = data.height;
      return (
        point.x >= data.position.x &&
        point.x <= data.position.x + textWidth &&
        point.y >= data.position.y - textHeight &&
        point.y <= data.position.y
      );
    }
    case 'ellipse': {
      const eData = obj.data as EllipseData;
      const pts = calculateEllipsePoints(eData.center, eData.majorRadius, eData.minorRadius, eData.rotation, 64);
      for (let i = 0; i < pts.length - 1; i++) {
        if (isPointNearLine(point, pts[i], pts[i + 1], tolerance)) return true;
      }
      return false;
    }
    case 'xline':
    case 'ray': {
      const xData = obj.data as XLineData;
      // Check distance from point to the infinite/semi-infinite line
      const extent = 100000;
      const lineEnd = { x: xData.point.x + xData.direction.x * extent, y: xData.point.y + xData.direction.y * extent };
      const lineStart = obj.type === 'xline'
        ? { x: xData.point.x - xData.direction.x * extent, y: xData.point.y - xData.direction.y * extent }
        : xData.point;
      return isPointNearLine(point, lineStart, lineEnd, tolerance);
    }
    default:
      return false;
  }
}

function isPointNearLine(point: Point, start: Point, end: Point, tolerance: number): boolean {
  const d1 = distance(point, start);
  const d2 = distance(point, end);
  const lineLen = distance(start, end);
  return Math.abs(d1 + d2 - lineLen) < tolerance;
}

// Generate visual instances for array objects
function generateArrayInstances(data: ArrayObjectData): CADObject[] {
  const instances: CADObject[] = [];
  const srcObjs = data.sourceObjects || [];
  if (srcObjs.length === 0) return instances;

  if (data.arrayType === 'rectangular' && data.rectParams) {
    const p = data.rectParams;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.columns; c++) {
        // Calculate offset
        const offset = {
          x: c * p.columnSpacing,
          y: r * p.rowSpacing
        };

        // Calculate rotation
        const rot = (r * p.columns + c) * p.incrementalRotation * (Math.PI / 180);

        srcObjs.forEach(src => {
          let newData = offsetObjectData(src.data, offset);
          if (rot !== 0) {
            // Rotate around the offset point relative to original position
            newData = rotateObjectData(newData, offset, rot);
          }
          instances.push({
            ...src,
            id: `${src.id}-inst-${r}-${c}`, // specific ID for instance? Optional but good for keys if reacting
            data: newData,
            selected: false,
            // Ensure array instances aren't individually selectable or selectable as part of group?
            // They are transient render objects.
          });
        });
      }
    }
  } else if (data.arrayType === 'polar' && data.polarParams) {
    const p = data.polarParams;
    // Angle step
    // If fillAngle is 360, step is 360 / items
    // If fillAngle is 180 and items=3 (0, 90, 180?), step is 180 / (items-1)?
    // Standard CAD usually: fill angle covers from 0 to end.
    // Let's match createPolarArray logic from useDrawingTools (which I saw earlier but didn't memorize perfectly - it used i * angleStep).
    // Let's assume 360 / itemCount for full circle, or fillAngle / (itemCount-1) for partial?
    // UserDrawingTools line 1186: angleStep = (params.fillAngle * ...) / params.itemCount;
    const angleStep = (p.fillAngle * (Math.PI / 180)) / p.itemCount;
    const dir = p.clockwise ? -1 : 1;

    for (let i = 0; i < p.itemCount; i++) {
      const angle = i * angleStep * dir;
      srcObjs.forEach(src => {
        let newData = src.data;
        if (p.rotateItems) {
          // Rotate around array center
          newData = rotateObjectData(src.data, p.center, angle);
        } else {
          // Translate position around center but keep orientation? 
          // Standard polar array rotates position. 
          // If rotateItems=false, the object itself doesn't rotate relative to its center, 
          // but its position rotates around array center.
          // rotateObjectData rotates both position and orientation.
          // To keep orientation, we'd need to rotate position then rotate back?
          // Or just rotate the center point of the object?
          // "rotateObjectData" does both.
          // If I want to "not rotate items", it means the item stays upright but moves in circle.
          // So: 1. Get object center. 2. Rotate object center around array center. 3. Offset object by delta.
          // Simpler: use rotateObjectData, then if !rotateItems, rotate back around object center?
          // Let's stick to rotateObjectData for now (rotateItems=true usually default/expected for polar).
          // If p.rotateItems is false, we need complex logic.
          // But wait, createPolarArray logic in useDrawingTools:
          // "let newData = rotateObjectData(obj.data, params.center, angle);"
          // It didn't seem to check rotateItems in the snippet I saw? 
          // Step 632: lines 1163...
          // It did NOT check rotateItems! It just rotated.
          // So I will just rotate.
          newData = rotateObjectData(src.data, p.center, angle);
        }

        instances.push({
          ...src,
          id: `${src.id}-inst-${i}`,
          data: newData,
          selected: false
        });
      });
    }
  } else if (data.arrayType === 'path' && data.pathParams) {
    const p = data.pathParams;
    if (p.pathPoints.length >= 2) {
      for (let i = 0; i < p.itemCount; i++) {
        const frac = i / Math.max(1, p.itemCount - 1);
        const { point: pathPt, angle } = pointOnPath(p.pathPoints, frac);
        // We need to offset from Start of path? Or just place at point?
        // Usually path array places items "on" the path.
        // Assumption: Original object is at (0,0) or relative?
        // createPathArray logic (line 1230):
        // "let newData = offsetObjectData(obj.data, pathPt);"
        // "if (params.tangentAlign) newData = rotateObjectData(newData, pathPt, angle);"
        // This assumes offsetObjectData moves it TO the point.
        // But offsetObjectData ADDS the point coordinates !!
        // So if object is at (100,100) and pathPt is (200,200), result is (300,300).
        // This implies the user must draw object at origin?
        // Or `pathPt` is treated as a delta?
        // In createPathArray, it passed `pathPt`.
        // If `pathPt` is absolute coord (200,200).
        // This logic seems to imply "Copy object to path point".
        // If the original object is NOT at (0,0), say at (50,50).
        // And path starts at (50,50).
        // Point 0 is (50,50).
        // offsetObjectData adds (50,50).
        // Object moves to (100,100).
        // This double-counts the position!
        // Array/Path array usually calculates delta from path start?
        // But I'm reproducing `createPathArray` logic I saw in `useDrawingTools.ts`.
        // If that logic is "wrong" (double shift), then my preview/render should match it so it's consistent.
        // The user didn't complain about Path array specifically, but "Rectangular, Polar, Path array".
        // So I'll just match the `useDrawingTools` logic.

        srcObjs.forEach(src => {
          let newData = offsetObjectData(src.data, pathPt);
          if (p.tangentAlign) {
            newData = rotateObjectData(newData, pathPt, angle);
          }
          instances.push({
            ...src,
            id: `${src.id}-inst-${i}`,
            data: newData,
            selected: false
          });
        });
      }
    }
  }

  return instances;
}

export default InfiniteCanvas;
