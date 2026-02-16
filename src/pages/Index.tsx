import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Loader2, ExternalLink, Search, User, LogIn, FlaskConical, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DesmosGraph from "@/components/DesmosGraph";
import { extractMathExpressions, shouldRenderGraph } from "@/components/MathGraph";
import ImageGallery, { SearchImage } from "@/components/ImageGallery";
import ExportReportButton from "@/components/ExportReportButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  searchResults?: SearchResult[];
  searchImages?: SearchImage[];
  keywords?: string[];
  isWebSearch?: boolean;
  isCanvasMode?: boolean;
  graphExpressions?: string[];
  graphImage?: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, isAuthenticated } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Handle scroll events to detect if user is at bottom
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // If user is within 100px of bottom, consider them at the bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);



  const streamChat = async (userMessage: string, isCanvasMode: boolean = false, isWebSearch: boolean = false) => {
    const messageId = Date.now().toString();
    const userMsg: Message = {
      id: `user-${messageId}`,
      role: "user",
      content: userMessage,
      isCanvasMode,
      isWebSearch,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Use web search URL if web search mode is enabled
      const url = isWebSearch ? SEARCH_URL : CHAT_URL;

      // Build the request body based on mode
      const systemInstruction = "You have integrated graphing capabilities. If you need to visualize a function, equation, parabola, hyperbola, or any mathematical expression, please provide it clearly in your response (e.g., 'y = x^2' or 'f(x) = sin(x)'). The system will automatically detect and render these using the Graphiqs engine in a minimized view within the chat.";

      const body = isWebSearch
        ? { query: userMessage, includeImages: true }
        : {
          messages: [
            { role: "system", content: systemInstruction },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage }
          ],
          mode: isCanvasMode ? "canvas" : "standard",
        };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let searchResults: SearchResult[] = [];
      let searchImages: SearchImage[] = [];
      let keywords: string[] = [];
      let assistantMsgCreated = false;

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
            if (parsed.type === "search_results") {
              searchResults = parsed.results || [];
              searchImages = parsed.images || [];
              keywords = parsed.keywords || [];
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;

              // Detect math expressions - always check, not just Canvas mode
              const graphExpressions = shouldRenderGraph(assistantContent)
                ? extractMathExpressions(assistantContent)
                : [];

              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && assistantMsgCreated) {
                  return prev.map((m, i) => (i === prev.length - 1 ? {
                    ...m,
                    content: assistantContent,
                    searchResults,
                    searchImages,
                    keywords,
                    graphExpressions,
                    isCanvasMode,
                    isWebSearch,
                  } : m));
                }
                assistantMsgCreated = true;
                return [...prev, {
                  id: `assistant-${messageId}`,
                  role: "assistant",
                  content: assistantContent,
                  searchResults,
                  searchImages,
                  keywords,
                  graphExpressions,
                  isCanvasMode,
                  isWebSearch,
                }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: "assistant", content: `⚠️ ${error instanceof Error ? error.message : "An error occurred."}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (message: string, _files?: File[]) => {
    if (!message.trim() || isLoading) return;

    // Parse message for mode prefixes
    const isCanvasMode = message.startsWith("[Canvas:");
    const isWebSearch = message.startsWith("[Search:");

    // Remove prefix for actual message
    let cleanMessage = message;
    if (isCanvasMode) {
      cleanMessage = message.replace(/^\[Canvas:\s*/, "").replace(/\]$/, "");
    } else if (isWebSearch) {
      cleanMessage = message.replace(/^\[Search:\s*/, "").replace(/\]$/, "");
    }

    streamChat(cleanMessage, isCanvasMode, isWebSearch);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="relative flex flex-col w-full h-screen transition-colors duration-500 bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]">


      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0">
        <div /> {/* Empty spacer for layout */}

        {/* Right side buttons */}
        <div className="flex items-center gap-3">
          {/* Export Button - show when there are messages */}
          {hasMessages && (
            <ExportReportButton messages={messages} />
          )}

          {/* Auth Button */}
          {!authLoading && (
            isAuthenticated ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium">{profile?.display_name || user?.email?.split("@")[0]}</span>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span className="text-sm font-medium">Sign In</span>
              </Link>
            )
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-500",
        hasMessages ? "justify-start" : "justify-center items-center"
      )}>
        {/* Messages Area */}
        {hasMessages && (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={cn("max-w-4xl mx-auto", message.role === "user" ? "flex justify-end" : "")}
                >
                  {message.role === "user" ? (
                    <div className="flex items-start gap-2 max-w-[80%]">
                      <div className="bg-white/20 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 text-white">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Search Results */}
                      {message.searchResults && message.searchResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="bg-black/20 backdrop-blur-sm rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center gap-2 text-white/70 text-sm">
                            <Globe className="w-4 h-4" />
                            <span>Sources ({message.searchResults.length})</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {message.searchResults.slice(0, 6).map((result, idx) => (
                              <a
                                key={idx}
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-white font-medium truncate group-hover:text-blue-300">{result.title}</div>
                                  <div className="text-xs text-white/50 truncate">{result.source}</div>
                                </div>
                                <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-blue-300 shrink-0 mt-1" />
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Search Images */}
                      {message.searchImages && message.searchImages.length > 0 && (
                        <ImageGallery images={message.searchImages} maxDisplay={6} />
                      )}

                      {/* Math Graph - renders automatically when math expressions detected */}
                      {message.graphExpressions && message.graphExpressions.length > 0 && (
                        <DesmosGraph
                          expressions={message.graphExpressions}
                          title="Graph Visualization"
                          width={Math.min(500, window.innerWidth - 64)}
                          height={250}
                          isMini={true}
                          onScreenshot={(dataUrl) => {
                            setMessages(prev => prev.map(m =>
                              m.id === message.id ? { ...m, graphImage: dataUrl } : m
                            ));
                          }}
                        />
                      )}
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-3 mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-medium text-white mt-2 mb-1">{children}</h3>,
                              p: ({ children }) => <p className="text-white/90 mb-2 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc list-inside text-white/90 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside text-white/90 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-white/90">{children}</li>,
                              code: ({ children, className }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm text-amber-300">{children}</code>
                                ) : (
                                  <code className="block bg-black/30 p-3 rounded-lg text-sm text-green-300 overflow-x-auto">{children}</code>
                                );
                              },
                              pre: ({ children }) => <pre className="bg-black/30 rounded-lg overflow-x-auto my-2">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-white/30 pl-3 italic text-white/70 my-2">{children}</blockquote>,
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                                  {children}
                                </a>
                              ),
                              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-white/80">{children}</em>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span className="text-white/70 text-sm">Thinking...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className={cn(
          "w-full transition-all duration-500",
          hasMessages
            ? "p-4 border-t border-white/10"
            : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40"
        )}>
          <div className={cn(
            "mx-auto transition-all duration-500 w-[600px] max-w-[90vw]"
          )}>
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6"
              >
                <h1 className="text-3xl font-bold text-white mb-2">Ask me anything</h1>
                <p className="text-white/60">Your AI learning companion</p>
              </motion.div>
            )}
            <PromptInputBox
              onSend={handleSendMessage}
              isLoading={isLoading}
              placeholder="Ask me anything..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
