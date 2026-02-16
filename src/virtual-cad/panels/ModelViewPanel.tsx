import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CADStateAPI } from '../types/cad.types';
import { CADObject, BlockData, ArrayObjectData } from '../types/cad.types';
import { getObjectCenter } from '../utils/geometry';
import {
    Eye, EyeOff, ChevronRight, ChevronDown, Search,
    Box, Circle, Square, Triangle, Type, Grid3X3,
    Spline, Minus, ArrowRight, Layers, Hash,
    Trash2, Copy, Focus, EyeClosed, FolderPlus, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelViewPanelProps {
    cadState: CADStateAPI;
}

// Type icon mapping
const TYPE_ICONS: Record<string, React.ReactNode> = {
    'line': <Minus className="w-3.5 h-3.5 text-cyan-400" />,
    'polyline': <Spline className="w-3.5 h-3.5 text-cyan-300" />,
    'circle': <Circle className="w-3.5 h-3.5 text-green-400" />,
    'arc': <Circle className="w-3.5 h-3.5 text-green-300" />,
    'rectangle': <Square className="w-3.5 h-3.5 text-blue-400" />,
    'polygon': <Triangle className="w-3.5 h-3.5 text-blue-300" />,
    'spline': <Spline className="w-3.5 h-3.5 text-purple-400" />,
    'ellipse': <Circle className="w-3.5 h-3.5 text-pink-400" />,
    'xline': <ArrowRight className="w-3.5 h-3.5 text-yellow-400" />,
    'ray': <ArrowRight className="w-3.5 h-3.5 text-yellow-300" />,
    'text': <Type className="w-3.5 h-3.5 text-orange-400" />,
    'mtext': <Type className="w-3.5 h-3.5 text-orange-300" />,
    'dimension': <Hash className="w-3.5 h-3.5 text-red-400" />,
    'hatch': <Grid3X3 className="w-3.5 h-3.5 text-amber-400" />,
    'block': <Box className="w-3.5 h-3.5 text-violet-400" />,
    'array': <Grid3X3 className="w-3.5 h-3.5 text-orange-500" />,
    'leader': <ArrowRight className="w-3.5 h-3.5 text-red-300" />,
    'revision-cloud': <Circle className="w-3.5 h-3.5 text-red-400" />,
};

interface TreeNode {
    id: string;
    name: string;
    type: 'project' | 'category' | 'layer' | 'object' | 'subobject';
    icon?: React.ReactNode;
    children: TreeNode[];
    objectRef?: CADObject;
    visible: boolean;
    parentVisible: boolean;
    isVirtual?: boolean; // If true, select logic might differ
}

export const ModelViewPanel: React.FC<ModelViewPanelProps> = ({ cadState }) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['project', 'cat-body', 'cat-layers', 'cat-blocks', 'cat-arrays']));
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    // Build tree structure
    const tree = useMemo((): TreeNode => {
        const objects = cadState.objects;
        const layers = cadState.layers;
        const blocks = cadState.blocks || []; // Ensure blocks is available

        // Filter helpers
        const matchesSearch = (name: string, type: string) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return name.toLowerCase().includes(q) || type.toLowerCase().includes(q);
        };

        const makeObjectNode = (obj: CADObject, parentVis: boolean, isVirtual: boolean = false): TreeNode => {
            const name = obj.name || `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} [${obj.id.slice(-4)}]`;
            const node: TreeNode = {
                id: obj.id,
                name: name,
                type: isVirtual ? 'subobject' : 'object',
                icon: TYPE_ICONS[obj.type] || <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
                children: [],
                objectRef: obj,
                visible: obj.visible,
                parentVisible: parentVis,
                isVirtual
            };

            // Initial Filter Check (if leaf)
            // But if it has children, we might keep it?
            // For now simplified filtering: if obj name matches or type matches.

            // Handle Nesting
            if (obj.type === 'block') {
                const data = obj.data as BlockData;
                const blockDef = blocks.find(b => b.id === data.blockId);
                if (blockDef && blockDef.objects) {
                    node.children = blockDef.objects.map(child => ({
                        ...makeObjectNode(child, obj.visible && parentVis, true),
                        id: `${obj.id}-${child.id}` // Unique ID for tree
                    }));
                }
            } else if (obj.type === 'array') {
                const data = obj.data as ArrayObjectData;
                if (data.sourceObjects) {
                    node.children = data.sourceObjects.map(child => ({
                        ...makeObjectNode(child, obj.visible && parentVis, true),
                        id: `${obj.id}-${child.id}`
                    }));
                }
            }

            return node;
        };

        // Categorize
        const bodyNodes: TreeNode[] = [];
        const blockNodes: TreeNode[] = [];
        const arrayNodes: TreeNode[] = [];

        objects.forEach(obj => {
            if (!matchesSearch(obj.name || obj.type, obj.type)) return;

            // Determine if parent is visible implicitly?
            // Root categories are visible.
            if (obj.type === 'block') {
                blockNodes.push(makeObjectNode(obj, true));
            } else if (obj.type === 'array') {
                arrayNodes.push(makeObjectNode(obj, true));
            } else {
                bodyNodes.push(makeObjectNode(obj, true));
            }
        });

        // Layer Nodes
        const layerNodes: TreeNode[] = layers.map(layer => {
            const layerObjs = objects
                .filter(o => o.layerId === layer.id && matchesSearch(o.name || o.type, o.type))
                .map(o => makeObjectNode(o, layer.visible));

            // Only show layer if name matches or it has matching children?
            // Simple: show all layers, filter children.
            return {
                id: `layer-${layer.id}`,
                name: layer.name,
                type: 'layer',
                icon: <Layers className="w-3.5 h-3.5 text-sky-400" />,
                children: layerObjs,
                visible: layer.visible,
                parentVisible: true
            };
        });

        const projectNode: TreeNode = {
            id: 'project',
            name: 'Unnamed Project',
            type: 'project',
            children: [
                {
                    id: 'cat-body',
                    name: 'Body',
                    type: 'category',
                    icon: <Box className="w-3.5 h-3.5 text-emerald-400" />,
                    children: bodyNodes,
                    visible: true,
                    parentVisible: true
                },
                {
                    id: 'cat-blocks',
                    name: 'Blocks',
                    type: 'category',
                    icon: <Box className="w-3.5 h-3.5 text-violet-400" />,
                    children: blockNodes,
                    visible: true,
                    parentVisible: true
                },
                {
                    id: 'cat-arrays',
                    name: 'Arrays',
                    type: 'category',
                    icon: <Grid3X3 className="w-3.5 h-3.5 text-orange-500" />,
                    children: arrayNodes,
                    visible: true,
                    parentVisible: true
                },
                {
                    id: 'cat-layers',
                    name: 'Layers',
                    type: 'category',
                    icon: <Layers className="w-3.5 h-3.5 text-sky-400" />,
                    children: layerNodes,
                    visible: true,
                    parentVisible: true
                }
            ],
            visible: true,
            parentVisible: true
        };

        return projectNode;
    }, [cadState.objects, cadState.layers, cadState.blocks, searchQuery]);

    const toggleExpand = useCallback((nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const handleSelect = useCallback((node: TreeNode) => {
        if (node.isVirtual) return; // Cannot select virtual sub-objects directly yet
        if (node.objectRef) {
            cadState.selectObject(node.objectRef.id, false);
        }
    }, [cadState]);

    const handleToggleVisibility = useCallback((e: React.MouseEvent, node: TreeNode) => {
        e.stopPropagation();
        if (node.isVirtual) return; // Cannot toggle virtual visibility independently easily
        if (node.type === 'object' && node.objectRef) {
            cadState.updateObject(node.objectRef.id, { visible: !node.objectRef.visible });
        } else if (node.type === 'layer') {
            const layerId = node.id.replace('layer-', '');
            const layer = cadState.layers.find(l => l.id === layerId);
            if (layer) {
                cadState.updateLayer(layer.id, { visible: !layer.visible });
            }
        }
    }, [cadState]);

    const handleDoubleClick = useCallback((e: React.MouseEvent, node: TreeNode) => {
        e.stopPropagation();
        if (node.type === 'object' && !node.isVirtual) {
            setEditingId(node.id);
            setEditName(node.name);
            setTimeout(() => editInputRef.current?.select(), 50);
        }
    }, []);

    const handleRenameSubmit = useCallback(() => {
        if (editingId) {
            // Check if it's a layer
            if (editingId.startsWith('layer-')) {
                const layerId = editingId.replace('layer-', '');
                cadState.renameLayer(layerId, editName);
            } else {
                cadState.renameObject(editingId, editName);
            }
            setEditingId(null);
        }
    }, [editingId, editName, cadState]);

    const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
        e.preventDefault();
        e.stopPropagation();
        if (node.type === 'object' && !node.isVirtual && node.objectRef) {
            setContextMenu({ x: e.clientX, y: e.clientY, objectId: node.objectRef.id });
        }
    }, []);

    const handleContextAction = useCallback((action: string) => {
        if (!contextMenu) return;
        const objId = contextMenu.objectId;
        setContextMenu(null);

        switch (action) {
            case 'rename':
                const obj = cadState.objects.find(o => o.id === objId);
                if (obj) {
                    setEditingId(objId);
                    setEditName(obj.name || '');
                    setTimeout(() => editInputRef.current?.select(), 50);
                }
                break;
            case 'block':
                // Group selected items into a block
                // If only one item context clicked, maybe allow creating block from that one?
                // Or verify selection matches context item?
                // Standard: if I right click an item that is part of selection, apply to selection.
                // If I right click item NOT in selection, select it then apply?
                // For simplicity, if selection is empty, select this.
                let selIds = cadState.selectedIds;
                if (!selIds.includes(objId)) {
                    selIds = [objId];
                    cadState.selectObject(objId, false);
                }
                if (selIds.length > 0) {
                    // Calculate centroid for origin
                    // Simple average of centers
                    const centers = cadState.objects
                        .filter(o => selIds.includes(o.id))
                        .map(getObjectCenter);

                    if (centers.length > 0) {
                        const avgX = centers.reduce((s, p) => s + p.x, 0) / centers.length;
                        const avgY = centers.reduce((s, p) => s + p.y, 0) / centers.length;

                        // Create Block
                        cadState.createBlockFromSelection(`Block ${cadState.blocks.length + 1}`, { x: avgX, y: avgY });
                    }
                }
                break;
            case 'delete':
                cadState.deleteObjects([objId]);
                break;
            case 'duplicate':
                cadState.selectObject(objId, false);
                cadState.copyToClipboard();
                cadState.pasteFromClipboard();
                break;
            case 'hide':
                cadState.updateObject(objId, { visible: false });
                break;
            case 'isolate':
                cadState.objects.forEach(o => {
                    cadState.updateObject(o.id, { visible: o.id === objId });
                });
                break;
            case 'hide-others':
                cadState.objects.forEach(o => {
                    if (o.id !== objId) cadState.updateObject(o.id, { visible: false });
                });
                break;
        }
    }, [contextMenu, cadState]);

    // Recursive Renderer
    const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children.length > 0;
        const isSelected = node.objectRef ? cadState.selectedIds.includes(node.objectRef.id) : false; // Note: IDs might clash if virtual nodes use same ID as parent? No, used composite ID.
        // For virtual selected state: usually not selected.

        const effectiveVisible = node.visible && node.parentVisible;
        const isEditing = editingId === node.id;

        return (
            <div key={node.id}>
                <div
                    className={cn(
                        "flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer transition-colors group text-xs",
                        "hover:bg-white/8",
                        isSelected && !node.isVirtual ? "bg-orange-500/20 text-orange-300" : "text-foreground/80",
                        !effectiveVisible && "opacity-40"
                    )}
                    style={{ paddingLeft: `${depth * 14 + 4}px` }}
                    onClick={() => {
                        handleSelect(node);
                        if (hasChildren) toggleExpand(node.id);
                    }}
                    onDoubleClick={(e) => handleDoubleClick(e, node)}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                >
                    {/* Expand/Collapse */}
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {hasChildren ? (
                            isExpanded ?
                                <ChevronDown className="w-3 h-3 text-muted-foreground" /> :
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        ) : (
                            <span className="w-3" />
                        )}
                    </span>

                    {/* Icon */}
                    <span className="shrink-0">{node.icon}</span>

                    {/* Name */}
                    {isEditing ? (
                        <input
                            ref={editInputRef}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRenameSubmit();
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingId(null);
                                }
                            }}
                            className="flex-1 min-w-0 bg-background border border-orange-500/50 rounded px-1 text-xs text-foreground outline-none"
                            onClick={e => e.stopPropagation()}
                            autoFocus
                        />
                    ) : (
                        <span className={cn(
                            "flex-1 min-w-0 truncate select-none",
                            isSelected && !node.isVirtual ? "text-orange-300 font-medium" : ""
                        )}>
                            {node.name}
                            {node.type === 'category' && <span className="text-muted-foreground ml-1">({node.children.length})</span>}
                        </span>
                    )}

                    {/* Visibility */}
                    {(!node.isVirtual && (node.type === 'object' || node.type === 'layer')) && (
                        <button
                            onClick={(e) => handleToggleVisibility(e, node)}
                            className={cn(
                                "w-5 h-5 flex items-center justify-center rounded shrink-0 transition-all",
                                "opacity-0 group-hover:opacity-100",
                                effectiveVisible ? "hover:bg-white/10" : "opacity-100 hover:bg-white/10"
                            )}
                        >
                            {effectiveVisible ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-red-400" />}
                        </button>
                    )}
                </div>

                {/* Children */}
                {hasChildren && isExpanded && (
                    <div>
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={panelRef}
            className="h-full flex flex-col bg-card/95 backdrop-blur overflow-hidden outline-none"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (cadState.selectedIds.length > 0) cadState.deleteObjects(cadState.selectedIds);
                }
            }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
                <Box className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Model View</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{cadState.objects.length} obj</span>
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
                    />
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1 px-1">
                {renderNode(tree, 0)}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {[
                        { action: 'rename', icon: <Edit2 className="w-3.5 h-3.5" />, label: 'Rename' },
                        { action: 'block', icon: <Box className="w-3.5 h-3.5" />, label: 'Convert to Block' },
                        { action: 'duplicate', icon: <Copy className="w-3.5 h-3.5" />, label: 'Duplicate' },
                        { action: 'delete', icon: <Trash2 className="w-3.5 h-3.5" />, label: 'Delete', danger: true },
                        { type: 'separator' },
                        { action: 'hide', icon: <EyeOff className="w-3.5 h-3.5" />, label: 'Hide' },
                        { action: 'isolate', icon: <Focus className="w-3.5 h-3.5" />, label: 'Isolate' },
                        { action: 'hide-others', icon: <EyeClosed className="w-3.5 h-3.5" />, label: 'Hide Others' },
                    ].map((item, i) => (
                        item.type === 'separator' ? (
                            <div key={`sep-${i}`} className="h-px bg-border my-1" />
                        ) : (
                            <button
                                key={item.action}
                                onClick={() => handleContextAction(item.action!)}
                                className={cn(
                                    "flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors text-left",
                                    item.danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground/80 hover:bg-white/5"
                                )}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        )
                    ))}
                </div>
            )}
        </div>
    );
};
