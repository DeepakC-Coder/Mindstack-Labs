import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  FolderTree,
  Play,
  FileCode,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Loader2,
  X,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

interface SandboxState {
  id: string | null;
  files: FileNode[];
  currentFile: string | null;
  fileContents: { [path: string]: string };
  terminalOutput: string[];
  isRunning: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

interface CodexSandboxPanelProps {
  sandbox: SandboxState;
  setSandbox: React.Dispatch<React.SetStateAction<SandboxState>>;
  highlights: { file: string; lines: number[]; type: 'error' | 'warning' | 'success' }[];
  onRunCode: () => void;
  onExecuteCommand: (command: string) => void;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onRefresh: () => void;
  errorMessage?: string | null;
}

const SANDBOX_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/e2b-sandbox`;

export const CodexSandboxPanel: React.FC<CodexSandboxPanelProps> = ({
  sandbox,
  setSandbox,
  highlights,
  onRunCode,
  onExecuteCommand,
  onSelectFile,
  onUpdateFileContent,
  onRefresh,
  errorMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'terminal'>('code');
  const [terminalInput, setTerminalInput] = useState('');
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [sandbox.terminalOutput]);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    onExecuteCommand(terminalInput.trim());
    setTerminalInput('');
  };

  const createFile = async (path: string, isDirectory: boolean, parentPath: string = '') => {
    // Create the node locally first for immediate UI feedback
    const newNode: FileNode = {
      name: path.split('/').pop() || path,
      path,
      type: isDirectory ? 'directory' : 'file',
      children: isDirectory ? [] : undefined,
      expanded: false,
    };

    // Add to file tree immediately for instant feedback
    setSandbox((prev) => ({
      ...prev,
      files: addNodeToTree(prev.files, newNode, parentPath),
      // If it's a file, set it as current and add empty content
      ...(isDirectory ? {} : {
        currentFile: path,
        fileContents: { ...prev.fileContents, [path]: '' },
      }),
    }));

    // If sandbox is not connected, just keep it local
    if (!sandbox.id) {
      console.log('File created locally (sandbox not connected):', path);
      setSandbox((prev) => ({
        ...prev,
        terminalOutput: [...prev.terminalOutput, `📁 Created ${isDirectory ? 'folder' : 'file'}: ${path} (local)`],
      }));
      return;
    }

    try {
      console.log('Creating file/folder:', { sandboxId: sandbox.id, path, isDirectory });
      const response = await fetch(SANDBOX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'createFile',
          sandboxId: sandbox.id,
          path,
          isDirectory,
          content: isDirectory ? undefined : '',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('File synced to sandbox:', result);
        // Node already added locally, just confirm sync
        setSandbox((prev) => ({
          ...prev,
          terminalOutput: [...prev.terminalOutput, `✓ Synced: ${path}`],
        }));
      } else {
        const errorText = await response.text();
        console.error('Failed to sync file - server error:', errorText);
        setSandbox((prev) => ({
          ...prev,
          terminalOutput: [...prev.terminalOutput, `⚠️ Failed to sync ${path}: ${errorText}`],
        }));
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      setSandbox((prev) => ({
        ...prev,
        terminalOutput: [...prev.terminalOutput, `⚠️ Error creating ${path}: ${error}`],
      }));
    }
  };

  const deleteFile = async (path: string) => {
    if (!sandbox.id) return;

    try {
      await fetch(SANDBOX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'deleteFile',
          sandboxId: sandbox.id,
          path,
        }),
      });

      // Remove from file tree
      setSandbox(prev => ({
        ...prev,
        files: removeNodeFromTree(prev.files, path),
        currentFile: prev.currentFile === path ? null : prev.currentFile,
      }));
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const saveFile = async () => {
    if (!sandbox.id || !sandbox.currentFile) return;
    setIsSaving(true);

    try {
      await fetch(SANDBOX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'writeFile',
          sandboxId: sandbox.id,
          path: sandbox.currentFile,
          content: sandbox.fileContents[sandbox.currentFile] || '',
        }),
      });
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Capture values before any state changes
    const trimmedName = newItemName.trim();
    const creatingState = isCreating;

    if (!trimmedName || !creatingState) return;
    if (!sandbox.id) {
      console.error('Cannot create file: No sandbox ID');
      return;
    }

    const parentPath = creatingState.parentPath;
    const fullPath = parentPath ? `${parentPath}/${trimmedName}` : trimmedName;
    const isFolder = creatingState.type === 'folder';

    // Clear state first to prevent double submission
    setNewItemName('');
    setIsCreating(null);

    // Pass parentPath to createFile to avoid race condition
    createFile(fullPath, isFolder, parentPath);
  };

  const toggleFileExpansion = (path: string) => {
    const toggleNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.path === path) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children) {
          return { ...node, children: toggleNode(node.children) };
        }
        return node;
      });
    };
    setSandbox((prev) => ({ ...prev, files: toggleNode(prev.files) }));
  };

  const getLineHighlight = (lineNum: number) => {
    for (const h of highlights) {
      if (h.file === sandbox.currentFile && h.lines.includes(lineNum)) {
        return h.type;
      }
    }
    return null;
  };

  const renderFileTree = (nodes: FileNode[], depth = 0, parentPath = '') => {
    return nodes.map((node) => (
      <div key={node.path}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-colors group',
                sandbox.currentFile === node.path && 'bg-white/20'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() =>
                node.type === 'directory' ? toggleFileExpansion(node.path) : onSelectFile(node.path)
              }
            >
              {node.type === 'directory' ? (
                <>
                  {node.expanded ? (
                    <ChevronDown className="w-3 h-3 text-white/60 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-white/60 shrink-0" />
                  )}
                  <FolderTree className="w-4 h-4 text-yellow-400 shrink-0" />
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" />
                  <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                </>
              )}
              <span className="text-white/80 truncate flex-1">{node.name}</span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {node.type === 'directory' && (
              <>
                <ContextMenuItem onClick={() => {
                  // Expand the folder first, then show the input
                  if (!node.expanded) {
                    toggleFileExpansion(node.path);
                  }
                  setIsCreating({ type: 'file', parentPath: node.path });
                }}>
                  <FilePlus className="w-4 h-4 mr-2" />
                  New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => {
                  // Expand the folder first, then show the input
                  if (!node.expanded) {
                    toggleFileExpansion(node.path);
                  }
                  setIsCreating({ type: 'folder', parentPath: node.path });
                }}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Folder
                </ContextMenuItem>
              </>
            )}
            <ContextMenuItem onClick={() => deleteFile(node.path)} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* New item input inline */}
        {isCreating && isCreating.parentPath === node.path && (
          <form onSubmit={handleNewItemSubmit} className="px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
            <div className="flex items-center gap-1">
              {isCreating.type === 'folder' ? (
                <FolderPlus className="w-4 h-4 text-yellow-400 shrink-0" />
              ) : (
                <FilePlus className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={isCreating.type === 'folder' ? 'folder name' : 'file name'}
                className="h-6 text-xs bg-white/10 border-white/20 text-white"
                autoFocus
                onBlur={() => {
                  // Delay to allow form submission to complete first
                  setTimeout(() => {
                    if (!newItemName.trim()) setIsCreating(null);
                  }, 100);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsCreating(null);
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNewItemSubmit(e as any);
                  }
                }}
              />
            </div>
          </form>
        )}

        {node.type === 'directory' && node.expanded && node.children && renderFileTree(node.children, depth + 1, node.path)}
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-[#0D1117]">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/10 bg-[#161B22] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onRunCode}
            disabled={sandbox.isRunning || !sandbox.currentFile}
            className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs transition-colors disabled:opacity-50"
          >
            {sandbox.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run
          </button>

          <button
            onClick={saveFile}
            disabled={!sandbox.currentFile || isSaving}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              activeTab === 'code' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            )}
          >
            <FileCode className="w-3 h-3" />
            Editor
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              activeTab === 'terminal' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            )}
          >
            <Terminal className="w-3 h-3" />
            Terminal
          </button>
        </div>

        <button onClick={onRefresh} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Refresh sandbox">
          <RefreshCw className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree */}
        <div className="w-56 border-r border-white/10 flex flex-col overflow-hidden bg-[#0D1117]">
          <div className="h-8 flex items-center justify-between px-2 border-b border-white/10 shrink-0">
            <span className="text-xs text-white/50 uppercase tracking-wider">Explorer</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCreating({ type: 'file', parentPath: '' })}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="New File"
              >
                <FilePlus className="w-3.5 h-3.5 text-white/50 hover:text-white" />
              </button>
              <button
                onClick={() => setIsCreating({ type: 'folder', parentPath: '' })}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5 text-white/50 hover:text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {/* Root level new item input */}
            {isCreating && isCreating.parentPath === '' && (
              <form onSubmit={handleNewItemSubmit} className="px-2 py-1">
                <div className="flex items-center gap-1">
                  {isCreating.type === 'folder' ? (
                    <FolderPlus className="w-4 h-4 text-yellow-400 shrink-0" />
                  ) : (
                    <FilePlus className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={isCreating.type === 'folder' ? 'folder name' : 'file name'}
                    className="h-6 text-xs bg-white/10 border-white/20 text-white"
                    autoFocus
                    onBlur={() => {
                      // Only cancel if empty after a delay (to allow form submit to complete)
                      setTimeout(() => {
                        if (!newItemName.trim()) setIsCreating(null);
                      }, 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsCreating(null);
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNewItemSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                  />
                </div>
              </form>
            )}

            {sandbox.files.length > 0 ? (
              renderFileTree(sandbox.files)
            ) : (
              <div className="p-4 text-white/40 text-sm text-center">
                {sandbox.status === 'connecting' ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                ) : sandbox.status === 'error' ? (
                  <div className="text-center">
                    <div className="text-amber-400 mb-2">
                      {errorMessage || 'Server under heavy load'}
                    </div>
                    <button onClick={onRefresh} className="text-blue-400 hover:underline text-xs">
                      Try Again
                    </button>
                  </div>
                ) : (
                  'No files'
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor / Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'code' ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Show connecting/error state in editor area */}
              {sandbox.status === 'connecting' ? (
                <div className="flex-1 bg-[#0D1117] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-white/60">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span>Connecting to sandbox...</span>
                  </div>
                </div>
              ) : sandbox.status === 'error' && !sandbox.currentFile ? (
                <div className="flex-1 bg-[#0D1117] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center p-4">
                    <div className="text-amber-400">{errorMessage || 'Sandbox connection failed'}</div>
                    <button onClick={onRefresh} className="text-blue-400 hover:underline text-sm">
                      Try Again
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Line numbers */}
                  <div className="w-12 bg-[#161B22] border-r border-white/10 text-right pr-3 pt-2 text-xs text-white/40 select-none overflow-hidden font-mono">
                    {(sandbox.fileContents[sandbox.currentFile || ''] || '')
                      .split('\n')
                      .map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-5 leading-5',
                            getLineHighlight(i + 1) === 'error' && 'bg-red-500/30',
                            getLineHighlight(i + 1) === 'warning' && 'bg-yellow-500/30',
                            getLineHighlight(i + 1) === 'success' && 'bg-green-500/30'
                          )}
                        >
                          {i + 1}
                        </div>
                      ))}
                  </div>

                  {/* Code editor */}
                  <textarea
                    value={sandbox.fileContents[sandbox.currentFile || ''] || '// Select a file from the file tree or create a new one'}
                    onChange={(e) => sandbox.currentFile && onUpdateFileContent(sandbox.currentFile, e.target.value)}
                    className="flex-1 bg-[#0D1117] text-white font-mono text-sm p-2 resize-none focus:outline-none leading-5"
                    spellCheck={false}
                    disabled={!sandbox.currentFile}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Terminal output */}
              <div
                ref={terminalRef}
                className="flex-1 bg-[#0D1117] p-3 font-mono text-sm overflow-y-auto"
                onClick={() => terminalInputRef.current?.focus()}
              >
                {sandbox.terminalOutput.map((line, i) => (
                  <div key={i} className="text-green-400 whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>

              {/* Terminal input */}
              <form onSubmit={handleTerminalSubmit} className="border-t border-white/10 bg-[#161B22]">
                <div className="flex items-center px-3 py-2">
                  <span className="text-green-400 font-mono text-sm mr-2">$</span>
                  <input
                    ref={terminalInputRef}
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    placeholder="Type a command..."
                    className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none placeholder:text-white/30"
                  />
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function addNodeToTree(nodes: FileNode[], newNode: FileNode, parentPath: string): FileNode[] {
  if (!parentPath) {
    return [...nodes, newNode].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return nodes.map((node) => {
    if (node.path === parentPath && node.type === 'directory') {
      const children = node.children || [];
      return {
        ...node,
        expanded: true,
        children: [...children, newNode].sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      };
    }
    if (node.children) {
      return { ...node, children: addNodeToTree(node.children, newNode, parentPath) };
    }
    return node;
  });
}

function removeNodeFromTree(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter((node) => node.path !== path)
    .map((node) => {
      if (node.children) {
        return { ...node, children: removeNodeFromTree(node.children, path) };
      }
      return node;
    });
}

export default CodexSandboxPanel;