import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCADState } from './hooks/useCADState';
import { useDrawingTools } from './hooks/useDrawingTools';
import { useFileOperations } from './hooks/useFileOperations';
import { useCADDesigns } from './hooks/useCADDesigns';
import { useAuth } from '@/hooks/useAuth';
import { InfiniteCanvas } from './canvas/InfiniteCanvas';
import { RibbonToolbar } from './toolbar/RibbonToolbar';
import { StatusBar } from './toolbar/StatusBar';
import { LayerPanel } from './panels/LayerPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { ToolOptionsPanel } from './panels/ToolOptionsPanel';
import { ModelViewPanel } from './panels/ModelViewPanel';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SlidersHorizontal, Save, FolderOpen, User, LogIn, Plus, Trash2, FileText, Home, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

const VirtualCAD: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const cadState = useCADState();
  const drawingTools = useDrawingTools(cadState);
  const fileOps = useFileOperations(cadState);
  const cadDesigns = useCADDesigns();

  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false);
  const [toolOptionsPanelOpen, setToolOptionsPanelOpen] = useState(false);
  const [toolOptionsDismissedForTool, setToolOptionsDismissedForTool] = useState<string | null>(null);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newDesignName, setNewDesignName] = useState('');
  // Left panel resize
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.55); // Model View gets 55% of left panel height
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const isToolRequiringOptions = cadState.activeTool !== 'select' && cadState.activeTool !== 'pan' && cadState.activeTool !== 'zoom';
  const shouldSuggestOpen = isToolRequiringOptions && toolOptionsDismissedForTool !== cadState.activeTool;

  // Auto-open tool options when tool changes to a drawing/modify tool OR when drawing starts.
  useEffect(() => {
    if (!isToolRequiringOptions) {
      setToolOptionsPanelOpen(false);
      setToolOptionsDismissedForTool(null);
      return;
    }
    // If user hasn't dismissed for this tool, open.
    if (toolOptionsDismissedForTool !== cadState.activeTool) {
      setToolOptionsPanelOpen(true);
    }
  }, [cadState.activeTool, isToolRequiringOptions, toolOptionsDismissedForTool]);

  // Auto-save every 30 seconds if authenticated and has a current design
  useEffect(() => {
    if (!cadDesigns.currentDesignId || !isAuthenticated) return;
    const interval = setInterval(() => {
      cadDesigns.autoSave(cadState.getState());
    }, 30000);
    return () => clearInterval(interval);
  }, [cadDesigns.currentDesignId, isAuthenticated, cadState.getState, cadDesigns.autoSave]);

  const handleSaveDesign = async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    if (cadDesigns.currentDesignId) {
      await cadDesigns.updateDesign(cadDesigns.currentDesignId, { state: cadState.getState() });
    } else {
      setSaveDialogOpen(true);
    }
  };

  const handleCreateDesign = async () => {
    if (!newDesignName.trim()) return;
    await cadDesigns.createDesign(newDesignName.trim(), cadState.getState());
    setNewDesignName('');
    setSaveDialogOpen(false);
  };

  const handleLoadDesign = (id: string) => {
    const design = cadDesigns.getDesign(id);
    if (design) {
      cadState.loadState(design.design_data);
      cadDesigns.setCurrentDesignId(id);
      setDesignsOpen(false);
    }
  };

  const handleNewDesign = () => {
    cadState.newDrawing();
    cadDesigns.setCurrentDesignId(null);
    setDesignsOpen(false);
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    if (!canvasRef.current) return;

    try {
      // Get the canvas data URL
      const dataUrl = canvasRef.current.toDataURL('image/png');

      // Create a simple PDF with the canvas image
      const { default: html2pdf } = await import('html2pdf.js');

      const container = document.createElement('div');
      container.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="color: #333; margin-bottom: 10px;">CAD Design Export</h1>
          <p style="color: #666; margin-bottom: 20px;">Exported on ${new Date().toLocaleDateString()}</p>
          <img src="${dataUrl}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 8px;" />
        </div>
      `;

      html2pdf()
        .set({
          margin: 10,
          filename: `cad-design-${Date.now()}.pdf`,
          image: { type: 'png', quality: 1 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        })
        .from(container)
        .save();
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-app-dark-gradient overflow-hidden">
        {/* Top bar (in-layout, not floating) */}
        <div className="h-12 shrink-0 flex items-center justify-between px-2 border-b border-white/10 bg-black/10 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-white hover:bg-white/10" />
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <img src={logo} alt="mindstacklabs" className="w-6 h-6" />
              <span className="text-white font-semibold text-sm hidden sm:inline">mindstacklabs</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Designs button */}
                <button
                  onClick={() => setDesignsOpen(!designsOpen)}
                  className="flex items-center gap-2 rounded-md px-3 h-9 bg-white/10 hover:bg-white/15 text-white border border-white/10"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline">My Designs</span>
                </button>

                {/* Save button */}
                <button
                  onClick={handleSaveDesign}
                  disabled={cadDesigns.saving}
                  className="flex items-center gap-2 rounded-md px-3 h-9 bg-white hover:bg-gray-100 text-gray-900 shadow-md disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline">{cadDesigns.saving ? 'Saving...' : 'Save'}</span>
                </button>

                {/* Export PDF button */}
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 rounded-md px-3 h-9 bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline">Export PDF</span>
                </button>

                {/* User avatar */}
                <div className="flex items-center gap-2 rounded-md px-2 h-9 bg-card/90 backdrop-blur shadow-md">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm text-white hidden sm:inline">
                    {profile?.display_name || user?.email?.split('@')[0]}
                  </span>
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="flex items-center gap-2 rounded-md px-3 h-9 bg-white hover:bg-gray-100 text-gray-900 shadow-md"
              >
                <LogIn className="h-4 w-4" />
                <span className="text-sm">Sign In to Save</span>
              </button>
            )}

            {/* Tool Options toggle (separate from main left nav sidebar) */}
            {shouldSuggestOpen && (
              <button
                type="button"
                onClick={() => setToolOptionsPanelOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-3 h-9 bg-white/10 hover:bg-white/15 text-white border border-white/10"
                aria-label="Toggle tool options"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">Tool Options</span>
              </button>
            )}
          </div>
        </div>

        {/* Designs Panel */}
        <AnimatePresence>
          {designsOpen && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="absolute top-14 right-2 z-40 w-80 max-h-[60vh] bg-black/60 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">My Designs</h3>
                  <button
                    onClick={handleNewDesign}
                    className="flex items-center gap-1 text-sm text-white/80 hover:text-white"
                  >
                    <Plus className="w-4 h-4" /> New
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(60vh-60px)] p-2 space-y-1">
                {cadDesigns.loading ? (
                  <p className="text-center text-white/60 py-4">Loading...</p>
                ) : cadDesigns.designs.length === 0 ? (
                  <p className="text-center text-white/60 py-4">No saved designs yet</p>
                ) : (
                  cadDesigns.designs.map((design) => (
                    <div
                      key={design.id}
                      className={cn(
                        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        cadDesigns.currentDesignId === design.id ? "bg-white/10" : "hover:bg-white/5"
                      )}
                      onClick={() => handleLoadDesign(design.id)}
                    >
                      <FileText className="w-5 h-5 text-white/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{design.name}</p>
                        <p className="text-xs text-white/50">
                          {new Date(design.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cadDesigns.deleteDesign(design.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Dialog */}
        <AnimatePresence>
          {saveDialogOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setSaveDialogOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">Save Design</h3>
                <input
                  type="text"
                  placeholder="Design name"
                  value={newDesignName}
                  onChange={(e) => setNewDesignName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateDesign()}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setSaveDialogOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDesign}
                    disabled={!newDesignName.trim() || cadDesigns.saving}
                    className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {cadDesigns.saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <RibbonToolbar
          cadState={cadState}
          fileOps={fileOps}
          canvasRef={canvasRef}
          onOpenLayerPanel={() => setLayerPanelOpen(true)}
          onOpenPropertiesPanel={() => setPropertiesPanelOpen(true)}
          onOpenToolOptions={() => setToolOptionsPanelOpen(true)}
        />

        <div className="flex-1 relative overflow-hidden flex flex-row">
          {/* Left docked panel (Model View only) */}
          <div
            ref={leftPanelRef}
            className="shrink-0 flex flex-col border-r border-white/10 overflow-hidden"
            style={{ width: leftPanelWidth }}
          >
            <ModelViewPanel cadState={cadState} />
          </div>

          {/* Left panel resize handle */}
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-orange-500/30 transition-colors flex items-center justify-center group"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingPanel(true);
              const startX = e.clientX;
              const startWidth = leftPanelWidth;
              const onMove = (ev: MouseEvent) => {
                const dx = ev.clientX - startX;
                setLeftPanelWidth(Math.max(180, Math.min(500, startWidth + dx)));
              };
              const onUp = () => {
                setIsResizingPanel(false);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <div className="w-0.5 h-8 rounded bg-border group-hover:bg-orange-400 transition-colors" />
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <InfiniteCanvas
              cadState={cadState}
              drawingTools={drawingTools}
              canvasRef={canvasRef}
            />

            {/* Right Properties panel (overlay) */}
            {cadState.selectedObjects.length > 0 && (
              <div
                className="absolute right-0 top-0 bottom-0 flex z-20 shadow-xl"
                style={{ width: `${splitRatio * 100}vw`, maxWidth: 800, minWidth: 200 }}
              >
                {/* Resize Handle */}
                <div
                  className="w-1 relative cursor-col-resize hover:bg-orange-500/50 transition-colors flex items-center justify-center group bg-border/50 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startRatio = splitRatio;
                    // Cache window width to avoid layout thrashing
                    const winWidth = window.innerWidth;
                    const onMove = (ev: MouseEvent) => {
                      const dx = startX - ev.clientX;
                      // Allow up to 50% width
                      setSplitRatio(Math.max(0.12, Math.min(0.5, startRatio + dx / winWidth)));
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  {/* Invisible wider hit area */}
                  <div className="absolute inset-y-0 -left-2 -right-2 z-30 cursor-col-resize" />
                  <div className="w-0.5 h-8 rounded bg-foreground/20 group-hover:bg-orange-400 transition-colors" />
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-hidden border-l border-white/10 h-full bg-card/95 backdrop-blur">
                  <PropertiesPanel
                    cadState={cadState}
                    isOpen={true}
                    onClose={() => { }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Layout Tabs */}
        <div className="h-8 shrink-0 flex items-center gap-1 px-2 bg-black/20 border-t border-white/10 overflow-x-auto">
          {cadState.layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => cadState.setActiveLayoutId(layout.id)}
              className={cn(
                "px-3 h-6 text-xs rounded-t-md transition-all border-t border-x border-transparent",
                cadState.activeLayoutId === layout.id
                  ? "bg-white/15 text-white border-white/20 font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              {layout.name}
            </button>
          ))}
          <button
            onClick={() => {
              const id = `layout-${Date.now()}`;
              cadState.loadState({
                ...cadState.getState(),
                layouts: [
                  ...cadState.layouts,
                  { id, name: `Layout ${cadState.layouts.length}`, type: 'paper', viewports: [] }
                ]
              });
              cadState.setActiveLayoutId(id);
            }}
            className="px-2 h-6 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 rounded transition-colors"
            title="Add Layout"
          >
            +
          </button>
        </div>

        <StatusBar cadState={cadState} drawingTools={drawingTools} />

        <LayerPanel
          cadState={cadState}
          isOpen={layerPanelOpen}
          onClose={() => setLayerPanelOpen(false)}
        />


        <ToolOptionsPanel
          cadState={cadState}
          drawingTools={drawingTools}
          isOpen={toolOptionsPanelOpen}
          onClose={() => {
            setToolOptionsPanelOpen(false);
            setToolOptionsDismissedForTool(cadState.activeTool);
          }}
        />
      </div>
    </TooltipProvider>
  );
};

export default VirtualCAD;