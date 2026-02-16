import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CADStateAPI } from '../types/cad.types';
import { Layer, Color } from '../types/cad.types';
import {
  Eye, EyeOff, Lock, Unlock, Snowflake, Sun, Plus, Trash2, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayerPanelProps {
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
];

export const LayerPanel: React.FC<LayerPanelProps> = ({ cadState, isOpen, onClose }) => {
  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddLayer = () => {
    if (!newLayerName.trim()) return;
    cadState.addLayer(newLayerName.trim());
    setNewLayerName('');
  };

  const handleRenameLayer = (layerId: string) => {
    if (!editName.trim()) {
      setEditingLayer(null);
      return;
    }
    cadState.updateLayer(layerId, { name: editName.trim() });
    setEditingLayer(null);
  };

  const handleColorChange = (layerId: string, color: Color) => {
    cadState.updateLayer(layerId, { color });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Layer Manager</DialogTitle>
        </DialogHeader>

        {/* Add new layer */}
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="New layer name..."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLayer()}
            className="flex-1"
          />
          <Button onClick={handleAddLayer} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Layer list */}
        <ScrollArea className="h-[300px] border rounded-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b">
              <tr className="text-left text-muted-foreground">
                <th className="p-2 w-8"></th>
                <th className="p-2">Name</th>
                <th className="p-2 w-10">On</th>
                <th className="p-2 w-10">Freeze</th>
                <th className="p-2 w-10">Lock</th>
                <th className="p-2 w-10">Color</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {cadState.layers.map((layer) => (
                <tr
                  key={layer.id}
                  className={cn(
                    "border-b hover:bg-accent/50 transition-colors",
                    layer.current && "bg-primary/10"
                  )}
                >
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cadState.setCurrentLayer(layer.id)}
                      disabled={layer.current}
                    >
                      {layer.current && <Check className="w-4 h-4 text-primary" />}
                    </Button>
                  </td>
                  <td className="p-2">
                    {editingLayer === layer.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameLayer(layer.id);
                            if (e.key === 'Escape') setEditingLayer(null);
                          }}
                          className="h-6 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRenameLayer(layer.id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingLayer(null)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onDoubleClick={() => {
                          setEditingLayer(layer.id);
                          setEditName(layer.name);
                        }}
                      >
                        {layer.name}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cadState.updateLayer(layer.id, { visible: !layer.visible })}
                    >
                      {layer.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cadState.updateLayer(layer.id, { frozen: !layer.frozen })}
                    >
                      {layer.frozen ? (
                        <Snowflake className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Sun className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cadState.updateLayer(layer.id, { locked: !layer.locked })}
                    >
                      {layer.locked ? (
                        <Lock className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <Unlock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </td>
                  <td className="p-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          className="w-6 h-6 rounded border border-border"
                          style={{
                            backgroundColor: `rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})`
                          }}
                        />
                      </DialogTrigger>
                      <DialogContent className="max-w-xs">
                        <DialogHeader>
                          <DialogTitle>Select Color</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-5 gap-2 p-2">
                          {PRESET_COLORS.map((color, idx) => (
                            <button
                              key={idx}
                              className={cn(
                                "w-8 h-8 rounded border-2 transition-transform hover:scale-110",
                                layer.color.r === color.r &&
                                  layer.color.g === color.g &&
                                  layer.color.b === color.b
                                  ? "border-primary"
                                  : "border-transparent"
                              )}
                              style={{
                                backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`
                              }}
                              onClick={() => handleColorChange(layer.id, color)}
                            />
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cadState.deleteLayer(layer.id)}
                      disabled={cadState.layers.length <= 1 || layer.current}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <div className="text-xs text-muted-foreground mt-2">
          Double-click layer name to rename. Click checkmark to set as current layer.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LayerPanel;