 import React, { useState, useRef, useEffect, useCallback } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
 import { motion, AnimatePresence } from "framer-motion";
 import { ArrowLeft, Globe, BrainCog, Loader2, ExternalLink, Search, User, LogOut, MessageSquare, Plus, Trash2 } from "lucide-react";
 import ReactMarkdown from "react-markdown";
 import { PromptInputBox } from "@/components/ui/ai-prompt-box";
 import { cn } from "@/lib/utils";
 import { useAuth } from "@/hooks/useAuth";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 
 interface Message {
   id: string;
   dbId?: string;
   role: "user" | "assistant";
   content: string;
   searchResults?: SearchResult[];
   keywords?: string[];
   isWebSearch?: boolean;
 }
 
 interface SearchResult {
   title: string;
   url: string;
   snippet: string;
   source: string;
 }
 
 interface Conversation {
   id: string;
   title: string;
   mode: string;
   created_at: string;
   updated_at: string;
 }
 
 const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
 const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;
 
 const Workspace: React.FC = () => {
   const location = useLocation();
   const navigate = useNavigate();
   const { toast } = useToast();
   const { user, profile, loading: authLoading, isAuthenticated, signOut } = useAuth();
 
   const [messages, setMessages] = useState<Message[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [isWebSearchMode, setIsWebSearchMode] = useState(false);
   const [isThinkMode, setIsThinkMode] = useState(false);
   const [conversations, setConversations] = useState<Conversation[]>([]);
   const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
   const [showSidebar, setShowSidebar] = useState(true);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const initialQueryProcessed = useRef(false);
 
   // Redirect to auth if not authenticated
   useEffect(() => {
     if (!authLoading && !isAuthenticated) {
       navigate("/auth");
     }
   }, [authLoading, isAuthenticated, navigate]);
 
   // Load conversations
   const loadConversations = useCallback(async () => {
     if (!user) return;
     const { data, error } = await supabase
       .from("conversations")
       .select("*")
       .eq("user_id", user.id)
       .order("updated_at", { ascending: false });
     if (!error && data) {
       setConversations(data);
     }
   }, [user]);
 
   useEffect(() => {
     loadConversations();
   }, [loadConversations]);
 
   // Load messages for a conversation
   const loadMessages = useCallback(async (conversationId: string) => {
     const { data, error } = await supabase
       .from("messages")
       .select("*")
       .eq("conversation_id", conversationId)
       .order("created_at", { ascending: true });
     if (!error && data) {
       setMessages(
         data.map((m) => ({
           id: m.id,
           dbId: m.id,
           role: m.role as "user" | "assistant",
           content: m.content,
         searchResults: m.search_results as unknown as SearchResult[] | undefined,
           keywords: m.keywords || undefined,
         }))
       );
     }
   }, []);
 
   // Create a new conversation
   const createConversation = async (title: string, mode: string): Promise<string | null> => {
     if (!user) return null;
     const { data, error } = await supabase
       .from("conversations")
       .insert({ user_id: user.id, title: title.slice(0, 50), mode })
       .select()
       .single();
     if (error) return null;
     setConversations((prev) => [data, ...prev]);
     setCurrentConversationId(data.id);
     return data.id;
   };
 
   // Save a message
   const saveMessage = async (
     conversationId: string,
     role: "user" | "assistant",
     content: string,
     searchResults?: SearchResult[],
     keywords?: string[]
   ) => {
     if (!user) return;
     await supabase.from("messages").insert([{
       conversation_id: conversationId,
       user_id: user.id,
       role,
       content,
       search_results: searchResults ? JSON.parse(JSON.stringify(searchResults)) : null,
       keywords: keywords || null,
     }]);
     await supabase
       .from("conversations")
       .update({ updated_at: new Date().toISOString() })
       .eq("id", conversationId);
   };
 
   // Delete a conversation
   const deleteConversation = async (conversationId: string) => {
     const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
     if (!error) {
       setConversations((prev) => prev.filter((c) => c.id !== conversationId));
       if (currentConversationId === conversationId) {
         setCurrentConversationId(null);
         setMessages([]);
       }
       toast({ title: "Conversation deleted" });
     }
   };
 
   // Auto-scroll
   useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [messages]);
 
   // Get initial query from navigation
   useEffect(() => {
     if (location.state && !initialQueryProcessed.current && isAuthenticated) {
       const { query, webSearch, think } = location.state as { query?: string; webSearch?: boolean; think?: boolean };
       if (query) {
         initialQueryProcessed.current = true;
         setIsWebSearchMode(webSearch || false);
         setIsThinkMode(think || false);
         handleSendMessage(query, undefined, webSearch || false, think || false);
       }
     }
   }, [location.state, isAuthenticated]);
 
   const streamChat = async (
     userMessage: string,
     conversationHistory: Message[],
     isWebSearch: boolean,
     isThink: boolean,
     convId?: string
   ) => {
     const messageId = Date.now().toString();
     let conversationId = convId || currentConversationId;
     if (!conversationId && user) {
       conversationId = await createConversation(userMessage, isWebSearch ? "web_search" : "standard");
     }
 
     const userMsg: Message = { id: `user-${messageId}`, role: "user", content: userMessage, isWebSearch };
     setMessages((prev) => [...prev, userMsg]);
     setIsLoading(true);
 
     if (conversationId) saveMessage(conversationId, "user", userMessage);
 
     try {
       const url = isWebSearch ? SEARCH_URL : CHAT_URL;
       const body = isWebSearch
         ? { query: userMessage }
         : {
             messages: [...conversationHistory.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }],
             mode: isThink ? "think" : "standard",
           };
 
       const response = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
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
               keywords = parsed.keywords || [];
               continue;
             }
             const content = parsed.choices?.[0]?.delta?.content as string | undefined;
             if (content) {
               assistantContent += content;
               setMessages((prev) => {
                 const last = prev[prev.length - 1];
                 if (last?.role === "assistant" && assistantMsgCreated) {
                   return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent, searchResults, keywords } : m));
                 }
                 assistantMsgCreated = true;
                 return [...prev, { id: `assistant-${messageId}`, role: "assistant", content: assistantContent, searchResults, keywords, isWebSearch }];
               });
             }
           } catch {
             textBuffer = line + "\n" + textBuffer;
             break;
           }
         }
       }
 
       if (conversationId && assistantContent) {
         saveMessage(conversationId, "assistant", assistantContent, searchResults, keywords);
       }
     } catch (error) {
       setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: "assistant", content: `⚠️ ${error instanceof Error ? error.message : "An error occurred."}` }]);
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleSendMessage = (message: string, _files?: File[], webSearch?: boolean, think?: boolean) => {
     if (!message.trim() || isLoading) return;
     streamChat(message, messages, webSearch ?? isWebSearchMode, think ?? isThinkMode, currentConversationId || undefined);
   };
 
   const handleNewChat = () => {
     setMessages([]);
     setCurrentConversationId(null);
     initialQueryProcessed.current = false;
   };
 
   const handleSelectConversation = (conv: Conversation) => {
     setCurrentConversationId(conv.id);
     loadMessages(conv.id);
     setIsWebSearchMode(conv.mode === "web_search");
   };
 
   const handleSignOut = async () => {
     await signOut();
     navigate("/");
   };
 
   if (authLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]">
         <Loader2 className="w-8 h-8 text-white animate-spin" />
       </div>
     );
   }
 
   return (
     <div className="flex h-screen w-full">
       {/* Sidebar */}
       <AnimatePresence>
         {showSidebar && (
           <motion.aside
             initial={{ width: 0, opacity: 0 }}
             animate={{ width: 280, opacity: 1 }}
             exit={{ width: 0, opacity: 0 }}
             className="h-full bg-[#1F2023] border-r border-white/10 flex flex-col overflow-hidden"
           >
             <div className="p-4 border-b border-white/10">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                   {profile?.avatar_url ? (
                     <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                   ) : (
                     <User className="w-5 h-5 text-white" />
                   )}
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-white font-medium truncate">{profile?.display_name || user?.email?.split("@")[0]}</p>
                   <p className="text-white/50 text-xs truncate">{user?.email}</p>
                 </div>
                 <button onClick={handleSignOut} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Sign out">
                   <LogOut className="w-4 h-4 text-white/60" />
                 </button>
               </div>
             </div>
             <div className="p-3">
               <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                 <Plus className="w-4 h-4" /> New Chat
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-1">
               {conversations.map((conv) => (
                 <div
                   key={conv.id}
                   className={cn("group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors", currentConversationId === conv.id ? "bg-white/20" : "hover:bg-white/10")}
                   onClick={() => handleSelectConversation(conv)}
                 >
                   <MessageSquare className="w-4 h-4 text-white/60 shrink-0" />
                   <span className="flex-1 text-white/80 text-sm truncate">{conv.title}</span>
                   <button
                     onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                     className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                   >
                     <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                   </button>
                 </div>
               ))}
               {conversations.length === 0 && <p className="text-white/40 text-sm text-center py-4">No conversations yet</p>}
             </div>
           </motion.aside>
         )}
       </AnimatePresence>
 
       {/* Main Content */}
       <div className={cn("flex-1 flex flex-col h-screen transition-colors duration-500", isWebSearchMode ? "bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-600" : "bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]")}>
         <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur-sm bg-black/10">
           <div className="flex items-center gap-3">
             <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
               <MessageSquare className="w-5 h-5 text-white" />
             </button>
             <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/20 transition-colors">
               <ArrowLeft className="w-5 h-5 text-white" />
             </button>
             <h1 className="text-lg font-semibold text-white">AI Workspace</h1>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => setIsWebSearchMode(!isWebSearchMode)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all", isWebSearchMode ? "bg-blue-500/30 text-blue-200 border border-blue-400/50" : "bg-white/10 text-white/70 hover:bg-white/20")}>
               <Globe className="w-4 h-4" /> Web Search
             </button>
             <button onClick={() => setIsThinkMode(!isThinkMode)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all", isThinkMode ? "bg-purple-500/30 text-purple-200 border border-purple-400/50" : "bg-white/10 text-white/70 hover:bg-white/20")}>
               <BrainCog className="w-4 h-4" /> Think
             </button>
           </div>
         </header>
 
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center">
               <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                 <BrainCog className="w-8 h-8 text-white/60" />
               </div>
               <h2 className="text-xl font-semibold text-white mb-2">Welcome to AI Workspace</h2>
               <p className="text-white/60 max-w-md">Ask me anything! Enable Web Search for real-time information or Think mode for deeper analysis.</p>
             </div>
           )}
 
           <AnimatePresence mode="popLayout">
             {messages.map((message) => (
               <motion.div key={message.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className={cn("max-w-4xl mx-auto", message.role === "user" ? "flex justify-end" : "")}>
                 {message.role === "user" ? (
                   <div className="flex items-start gap-2 max-w-[80%]">
                     {message.isWebSearch && <div className="mt-2 p-1.5 rounded-full bg-blue-500/20"><Search className="w-4 h-4 text-blue-300" /></div>}
                     <div className="bg-white/20 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 text-white">{message.content}</div>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {message.searchResults && message.searchResults.length > 0 && (
                       <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-black/20 backdrop-blur-sm rounded-xl p-4 space-y-3">
                         <div className="flex items-center gap-2 text-white/70 text-sm">
                           <Globe className="w-4 h-4" />
                           <span>Sources ({message.searchResults.length})</span>
                           {message.keywords && message.keywords.length > 0 && <span className="text-xs text-white/50">• Keywords: {message.keywords.join(", ")}</span>}
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                           {message.searchResults.slice(0, 6).map((result, idx) => (
                             <a key={idx} href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
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
                     <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3">
                       <div className="prose prose-invert prose-sm max-w-none">
                         <ReactMarkdown
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
                               return isInline ? <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm text-amber-300">{children}</code> : <code className="block bg-black/30 p-3 rounded-lg text-sm text-green-300 overflow-x-auto">{children}</code>;
                             },
                             pre: ({ children }) => <pre className="bg-black/30 rounded-lg overflow-x-auto my-2">{children}</pre>,
                             blockquote: ({ children }) => <blockquote className="border-l-2 border-white/30 pl-3 italic text-white/70 my-2">{children}</blockquote>,
                             a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
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
                 <span className="text-white/70 text-sm">{isWebSearchMode ? "Searching and analyzing..." : "Thinking..."}</span>
               </div>
             </motion.div>
           )}
           <div ref={messagesEndRef} />
         </div>
 
         <div className="p-4 border-t border-white/10 backdrop-blur-sm bg-black/10">
           <div className="max-w-4xl mx-auto">
             <PromptInputBox onSend={(msg, files) => handleSendMessage(msg, files)} isLoading={isLoading} placeholder={isWebSearchMode ? "Search the web for educational content..." : "Ask me anything about learning..."} />
           </div>
         </div>
       </div>
     </div>
   );
 };
 
 export default Workspace;