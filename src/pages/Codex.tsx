import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Loader2,
  Terminal,
  FolderTree,
  Play,
  Bug,
  Check,
  AlertCircle,
  FileCode,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Zap,
  Cloud,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import sdk from "@stackblitz/sdk";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { CodexSandboxPanel } from "./codex/CodexSandboxPanel";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  highlights?: { file: string; lines: number[]; type: "error" | "warning" | "success" }[];
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
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
  status: "disconnected" | "connecting" | "connected" | "error";
}

const SANDBOX_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/e2b-sandbox`;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/codex-ai`;

const Codex: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "terminal">("code");
  const [sandbox, setSandbox] = useState<SandboxState>({
    id: null,
    files: [],
    currentFile: null,
    fileContents: {},
    terminalOutput: [],
    isRunning: false,
    status: "disconnected",
  });
  const [highlights, setHighlights] = useState<{ file: string; lines: number[]; type: "error" | "warning" | "success" }[]>([]);
  const [isLiteMode, setIsLiteMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stackblitzContainerRef = useRef<HTMLDivElement>(null);
  const stackblitzVmRef = useRef<any>(null);
  const [stackblitzKey, setStackblitzKey] = useState(0);
  const [e2bPanelKey, setE2bPanelKey] = useState(0);
  const [stackblitzInitialized, setStackblitzInitialized] = useState(false);

  // Important: the cleanup effect below must always have access to the latest sandbox id,
  // otherwise we leak sandboxes (which triggers E2B 429 concurrent limit).
  const sandboxIdRef = useRef<string | null>(null);
  useEffect(() => {
    sandboxIdRef.current = sandbox.id;
  }, [sandbox.id]);

  // Close sandbox when page/tab is closed or refreshed
  useEffect(() => {
    const handleBeforeUnload = () => {
      const id = sandboxIdRef.current;
      if (id) {
        // Use sendBeacon for reliable cleanup on page unload
        const payload = JSON.stringify({ action: "close", sandboxId: id });
        navigator.sendBeacon(SANDBOX_URL, payload);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize sandbox on mount
  useEffect(() => {
    if (isAuthenticated) {
      initializeSandbox();
    }
    return () => {
      // Cleanup sandbox on unmount (must use ref to avoid stale closure)
      const id = sandboxIdRef.current;
      if (id) closeSandbox(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [sandboxErrorMessage, setSandboxErrorMessage] = useState<string | null>(null);

  const initializeSandbox = useCallback(async () => {
    setSandbox((prev) => ({ ...prev, status: "connecting" }));
    setSandboxErrorMessage(null);
    try {
      // Close any existing sandbox before creating a new one.
      if (sandboxIdRef.current) {
        await closeSandbox(sandboxIdRef.current);
        sandboxIdRef.current = null;
      }

      const response = await fetch(SANDBOX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "create" }),
      });

      if (!response.ok) {
        // Check for rate limit / concurrent sandbox limit
        if (response.status === 429 || response.status === 500) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData?.error || "";
          const isLimitError = errorMsg.toLowerCase().includes("limit") ||
            errorMsg.toLowerCase().includes("sandbox") ||
            errorMsg.toLowerCase().includes("concurrent") ||
            response.status === 429;
          if (isLimitError) {
            throw new Error("RATE_LIMIT");
          }
          // Check if E2B is not configured
          if (errorMsg.toLowerCase().includes("not configured") || errorMsg.toLowerCase().includes("api key")) {
            throw new Error("NOT_CONFIGURED");
          }
        }
        throw new Error("Failed to create sandbox");
      }

      const data = await response.json();
      setSandbox((prev) => ({
        ...prev,
        id: data.sandboxId,
        files: data.files || [],
        status: "connected",
        terminalOutput: ["Sandbox initialized. Ready to code!"],
      }));
      setE2bPanelKey((k) => k + 1); // force remount to avoid stale UI after mode switches
      setSandboxErrorMessage(null);
      // No toast - silent success
    } catch (error) {
      console.error("Sandbox error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isRateLimit = errorMessage === "RATE_LIMIT";
      const isNotConfigured = errorMessage === "NOT_CONFIGURED";

      setSandbox((prev) => ({ ...prev, status: "error" }));

      if (isNotConfigured) {
        setSandboxErrorMessage("E2B sandbox is not configured. Try Lite Mode instead!");
      } else if (isRateLimit) {
        setSandboxErrorMessage("Server under heavy load. Try Lite Mode or retry later.");
      } else {
        setSandboxErrorMessage("Failed to initialize coding environment. Try Lite Mode!");
      }
      // No toast - show inline message instead
    }
  }, []);

  const closeSandbox = async (sandboxId: string) => {
    try {
      await fetch(SANDBOX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "close", sandboxId }),
      });
    } catch (e) {
      console.error("Failed to close sandbox:", e);
    }
  };

  const runCode = async () => {
    if (!sandbox.id || !sandbox.currentFile) return;

    setSandbox((prev) => ({
      ...prev,
      isRunning: true,
      terminalOutput: [...prev.terminalOutput, `\n> Running ${sandbox.currentFile}...`],
    }));

    try {
      const response = await fetch(SANDBOX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "run",
          sandboxId: sandbox.id,
          file: sandbox.currentFile,
          code: sandbox.fileContents[sandbox.currentFile] || "",
        }),
      });

      const data = await response.json();
      setSandbox((prev) => ({
        ...prev,
        isRunning: false,
        terminalOutput: [...prev.terminalOutput, data.output || "No output"],
      }));
      setActiveTab("terminal");
    } catch (error) {
      setSandbox((prev) => ({
        ...prev,
        isRunning: false,
        terminalOutput: [...prev.terminalOutput, `Error: ${error instanceof Error ? error.message : "Unknown error"}`],
      }));
    }
  };

  const executeCommand = async (command: string) => {
    if (!sandbox.id) return;

    setSandbox((prev) => ({
      ...prev,
      terminalOutput: [...prev.terminalOutput, `$ ${command}`],
    }));

    try {
      const response = await fetch(SANDBOX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "exec",
          sandboxId: sandbox.id,
          command,
        }),
      });

      const data = await response.json();
      setSandbox((prev) => ({
        ...prev,
        terminalOutput: [...prev.terminalOutput, data.output || ""],
      }));
    } catch (error) {
      setSandbox((prev) => ({
        ...prev,
        terminalOutput: [...prev.terminalOutput, `Error: ${error instanceof Error ? error.message : "Unknown error"}`],
      }));
    }
  };

  const updateFileContent = (path: string, content: string) => {
    setSandbox((prev) => ({
      ...prev,
      fileContents: { ...prev.fileContents, [path]: content },
    }));
  };

  const selectFile = async (path: string) => {
    setSandbox((prev) => ({ ...prev, currentFile: path }));

    // Fetch file content if not already loaded
    if (!sandbox.fileContents[path] && sandbox.id) {
      try {
        const response = await fetch(SANDBOX_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "readFile",
            sandboxId: sandbox.id,
            path,
          }),
        });

        const data = await response.json();
        if (data.content !== undefined) {
          updateFileContent(path, data.content);
        }
      } catch (error) {
        console.error("Failed to read file:", error);
      }
    }
  };

  const buildAIContext = async () => {
    // E2B sandbox context
    if (!isLiteMode) {
      return {
        currentFile: sandbox.currentFile,
        fileContents: sandbox.fileContents,
        terminalOutput: sandbox.terminalOutput.slice(-50).join("\n"),
        files: sandbox.files,
        mode: "e2b",
      };
    }

    // Lite mode (StackBlitz WebContainer) context
    try {
      const vm = stackblitzVmRef.current;
      if (vm && typeof vm.getFsSnapshot === "function") {
        const fsSnapshot = await vm.getFsSnapshot();
        return {
          currentFile: null,
          fileContents: fsSnapshot || {},
          terminalOutput: "",
          files: Object.keys(fsSnapshot || {}),
          mode: "webcontainer",
        };
      }
      // VM not ready yet, return minimal context
      return {
        currentFile: null,
        fileContents: {},
        terminalOutput: "",
        files: [],
        mode: "webcontainer",
        note: "WebContainer is still initializing. Please ask your question and I'll help based on general coding knowledge.",
      };
    } catch (e) {
      console.warn("Failed to read StackBlitz FS snapshot:", e);
      return {
        currentFile: null,
        fileContents: {},
        terminalOutput: "",
        files: [],
        mode: "webcontainer",
        note: "Could not access WebContainer files. I'll help based on your question.",
      };
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const context = await buildAIContext();

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let assistantMsgCreated = false;
      let newHighlights: typeof highlights = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);

            // Handle highlights from AI
            if (parsed.type === "highlights") {
              newHighlights = parsed.highlights || [];
              setHighlights(newHighlights);
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && assistantMsgCreated) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent, highlights: newHighlights } : m
                  );
                }
                assistantMsgCreated = true;
                return [
                  ...prev,
                  { id: `assistant-${Date.now()}`, role: "assistant", content: assistantContent, highlights: newHighlights },
                ];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${error instanceof Error ? error.message : "An error occurred."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize StackBlitz when switching to Lite Mode (with key change for force remount)
  useEffect(() => {
    if (!isLiteMode) {
      // Cleanup when leaving lite mode
      stackblitzVmRef.current = null;
      setStackblitzInitialized(false);
      return;
    }

    // Wait for container to be ready in DOM
    const initTimer = setTimeout(() => {
      if (stackblitzContainerRef.current && !stackblitzInitialized) {
        initializeStackBlitz();
      }
    }, 200);

    return () => clearTimeout(initTimer);
  }, [isLiteMode, stackblitzKey]);

  const initializeStackBlitz = async () => {
    const container = stackblitzContainerRef.current;
    if (!container || !isLiteMode) {
      console.log("StackBlitz init skipped: container not ready or not in lite mode");
      return;
    }

    // Prevent duplicate initialization
    if (stackblitzInitialized) {
      console.log("StackBlitz already initialized, skipping");
      return;
    }

    console.log("Initializing StackBlitz WebContainer...");

    // Clear any previous content
    container.innerHTML = "";

    try {
      const vm = await sdk.embedProject(
        container,
        {
          title: "Codex Sandbox",
          description: "Lite coding environment",
          template: "node",
          files: {
            "index.js": `// Welcome to Codex Lite Mode!
// This runs in a StackBlitz WebContainer

console.log("Hello from Codex! 🚀");

// Try some calculations
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(\`Sum: \${sum}\`);
console.log(\`Average: \${sum / numbers.length}\`);
`,
            "package.json": JSON.stringify({
              name: "codex-sandbox",
              version: "1.0.0",
              main: "index.js",
              scripts: {
                start: "node index.js"
              }
            }, null, 2),
          },
        },
        {
          height: "100%",
          openFile: "index.js",
          terminalHeight: 40,
          hideNavigation: true,
          hideDevTools: false,
        }
      );

      stackblitzVmRef.current = vm;
      setStackblitzInitialized(true);
      console.log("StackBlitz WebContainer initialized successfully");
      // Silent success - no toast
    } catch (error) {
      console.error("StackBlitz error:", error);
      setStackblitzInitialized(false);
      // Silent failure - errors handled in context
    }
  };

  const toggleMode = async () => {
    // Prevent switching while already transitioning
    if (isTransitioning) return;

    setIsTransitioning(true);

    if (isLiteMode) {
      // Switching from Lite Mode (StackBlitz) to E2B
      try {
        // Clear StackBlitz reference first
        stackblitzVmRef.current = null;
        setStackblitzInitialized(false);

        // Clear the container immediately
        if (stackblitzContainerRef.current) {
          stackblitzContainerRef.current.innerHTML = "";
        }

        // Reset sandbox state for E2B BEFORE switching mode
        setSandbox({
          id: null,
          files: [],
          currentFile: null,
          fileContents: {},
          terminalOutput: ["Connecting to E2B sandbox..."],
          isRunning: false,
          status: "connecting",
        });

        // Switch mode
        setIsLiteMode(false);

        // Increment panel key to force fresh render
        setE2bPanelKey(k => k + 1);

        // End transitioning immediately so user sees the connecting state
        setIsTransitioning(false);

        // Wait a frame for React to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize E2B sandbox - this will update the sandbox state
        await initializeSandbox();

      } catch (error) {
        console.error("Error switching to E2B:", error);
        // Ensure we show error state instead of blank
        setSandbox(prev => ({
          ...prev,
          status: "error",
          terminalOutput: ["Failed to connect. Click refresh to retry."],
        }));
        setIsTransitioning(false);
      }
      return; // Don't run the finally block since we manually set isTransitioning
    } else {
      // Switching from E2B to Lite Mode (StackBlitz)
      try {
        // Close E2B sandbox first
        if (sandbox.id) {
          await closeSandbox(sandbox.id);
          sandboxIdRef.current = null;
        }

        // Reset sandbox state
        setSandbox({
          id: null,
          files: [],
          currentFile: null,
          fileContents: {},
          terminalOutput: [],
          isRunning: false,
          status: "disconnected",
        });

        // Increment key to force remount and switch mode
        setStackblitzKey(k => k + 1);
        setIsLiteMode(true);

        // Wait for React to mount the container
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.error("Error switching to Lite Mode:", error);
      } finally {
        setIsTransitioning(false);
      }
    }
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

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-colors",
            sandbox.currentFile === node.path && "bg-white/20",
            depth > 0 && "ml-4"
          )}
          onClick={() => (node.type === "directory" ? toggleFileExpansion(node.path) : selectFile(node.path))}
        >
          {node.type === "directory" ? (
            <>
              {node.expanded ? <ChevronDown className="w-3 h-3 text-white/60" /> : <ChevronRight className="w-3 h-3 text-white/60" />}
              <FolderTree className="w-4 h-4 text-yellow-400" />
            </>
          ) : (
            <>
              <span className="w-3" />
              <FileCode className="w-4 h-4 text-blue-400" />
            </>
          )}
          <span className="text-white/80 truncate">{node.name}</span>
        </div>
        {node.type === "directory" && node.expanded && node.children && renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };

  const getLineHighlight = (lineNum: number) => {
    for (const h of highlights) {
      if (h.file === sandbox.currentFile && h.lines.includes(lineNum)) {
        return h.type;
      }
    }
    return null;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Fullscreen sandbox mode
  if (isFullscreen) {
    return (
      <div className="h-screen w-full bg-[#0D1117] flex flex-col">
        <header className="h-12 flex items-center justify-between px-4 border-b border-white/10 bg-[#161B22]">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">Codex Sandbox</h1>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                sandbox.status === "connected" && "bg-green-500/20 text-green-400",
                sandbox.status === "connecting" && "bg-yellow-500/20 text-yellow-400",
                sandbox.status === "error" && "bg-red-500/20 text-red-400",
                sandbox.status === "disconnected" && "bg-gray-500/20 text-gray-400"
              )}
            >
              {sandbox.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runCode}
              disabled={sandbox.isRunning || !sandbox.currentFile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              {sandbox.isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree */}
          <div className="w-56 border-r border-white/10 bg-[#0D1117] overflow-y-auto">
            <div className="p-2 text-xs text-white/50 uppercase tracking-wider">Explorer</div>
            {renderFileTree(sandbox.files)}
          </div>
          {/* Editor + Terminal */}
          <div className="flex-1 flex flex-col">
            {/* Tabs */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-[#161B22]">
              <button
                onClick={() => setActiveTab("code")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t text-sm transition-colors",
                  activeTab === "code" ? "bg-[#0D1117] text-white" : "text-white/60 hover:text-white"
                )}
              >
                <FileCode className="w-4 h-4" />
                {sandbox.currentFile?.split("/").pop() || "Editor"}
              </button>
              <button
                onClick={() => setActiveTab("terminal")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t text-sm transition-colors",
                  activeTab === "terminal" ? "bg-[#0D1117] text-white" : "text-white/60 hover:text-white"
                )}
              >
                <Terminal className="w-4 h-4" />
                Terminal
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "code" ? (
                <div className="h-full flex">
                  <div className="w-10 bg-[#161B22] border-r border-white/10 text-right pr-2 pt-2 text-xs text-white/40 select-none">
                    {(sandbox.fileContents[sandbox.currentFile || ""] || "").split("\n").map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-5 leading-5",
                          getLineHighlight(i + 1) === "error" && "bg-red-500/30",
                          getLineHighlight(i + 1) === "warning" && "bg-yellow-500/30",
                          getLineHighlight(i + 1) === "success" && "bg-green-500/30"
                        )}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={sandbox.fileContents[sandbox.currentFile || ""] || "// Select a file to edit"}
                    onChange={(e) => sandbox.currentFile && updateFileContent(sandbox.currentFile, e.target.value)}
                    className="flex-1 bg-[#0D1117] text-white font-mono text-sm p-2 resize-none focus:outline-none leading-5"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="h-full bg-[#0D1117] p-2 font-mono text-sm overflow-y-auto">
                  {sandbox.terminalOutput.map((line, i) => (
                    <div key={i} className="text-green-400 whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0D1117] flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/10 bg-[#161B22] shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-white hover:bg-white/10" />
          <button onClick={() => navigate("/")} className="flex items-center hover:opacity-80 transition-opacity">
            <span className="text-white font-semibold hidden sm:inline">Codex</span>
          </button>
          {!isLiteMode && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                sandbox.status === "connected" && "bg-green-500/20 text-green-400",
                sandbox.status === "connecting" && "bg-yellow-500/20 text-yellow-400",
                sandbox.status === "error" && "bg-red-500/20 text-red-400",
                sandbox.status === "disconnected" && "bg-gray-500/20 text-gray-400"
              )}
            >
              {sandbox.status}
            </span>
          )}
          {isLiteMode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
              Lite Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            disabled={isTransitioning}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
              isLiteMode
                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20",
              isTransitioning && "opacity-50 cursor-not-allowed"
            )}
            title={isLiteMode ? "Switch to E2B (Full)" : "Switch to Lite Mode"}
          >
            {isTransitioning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Switching...
              </>
            ) : isLiteMode ? (
              <>
                <Cloud className="w-4 h-4" />
                E2B Mode
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Lite Mode
              </>
            )}
          </button>
          {!isLiteMode && (
            <button onClick={initializeSandbox} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Reconnect sandbox">
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - AI Chat */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="relative h-full flex flex-col bg-landing-gradient">
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              {/* Messages */}
              <ScrollArea className="relative flex-1 p-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                      <FileCode className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Codex AI Assistant</h2>
                    <p className="text-white/60 max-w-sm">
                      I can see your code, terminal, and file tree. Ask me anything about your code - I'll highlight issues and help you debug!
                    </p>
                  </div>
                )}

                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("mb-4", message.role === "user" ? "flex justify-end" : "")}
                    >
                      {message.role === "user" ? (
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 text-white max-w-[85%]">
                          {message.content}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {message.highlights && message.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {message.highlights.map((h, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    "text-xs px-2 py-1 rounded flex items-center gap-1",
                                    h.type === "error" && "bg-red-500/20 text-red-400",
                                    h.type === "warning" && "bg-yellow-500/20 text-yellow-400",
                                    h.type === "success" && "bg-green-500/20 text-green-400"
                                  )}
                                >
                                  {h.type === "error" && <AlertCircle className="w-3 h-3" />}
                                  {h.type === "warning" && <Bug className="w-3 h-3" />}
                                  {h.type === "success" && <Check className="w-3 h-3" />}
                                  {h.file}:{h.lines.join(", ")}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing your code...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="relative p-4 border-t border-white/10 bg-black/10 backdrop-blur-sm">
                <PromptInputBox
                  onSend={(message) => sendMessage(message)}
                  isLoading={isLoading}
                  placeholder="Ask about your code..."
                  features={{ webSearch: false, think: false, canvas: false }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Sandbox */}
          <ResizablePanel defaultSize={65} minSize={40}>
            {isTransitioning ? (
              <div className="h-full w-full bg-[#0D1117] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
                  <span className="text-white/60 text-sm">Switching modes...</span>
                </div>
              </div>
            ) : isLiteMode ? (
              <div
                key={stackblitzKey}
                ref={stackblitzContainerRef}
                className="h-full w-full bg-[#0D1117]"
              />
            ) : (
              <CodexSandboxPanel
                key={e2bPanelKey}
                sandbox={sandbox}
                setSandbox={setSandbox}
                highlights={highlights}
                onRunCode={runCode}
                onExecuteCommand={executeCommand}
                onSelectFile={selectFile}
                onUpdateFileContent={updateFileContent}
                onRefresh={initializeSandbox}
                errorMessage={sandboxErrorMessage}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Codex;