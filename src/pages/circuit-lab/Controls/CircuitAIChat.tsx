import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, User, Bot, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AnalysisResult, Component } from '@/pages/circuit-lab/engine/types';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface CircuitAIChatProps {
    analysis: AnalysisResult;
    components: Component[];
    className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export const CircuitAIChat: React.FC<CircuitAIChatProps> = ({
    analysis,
    components,
    className
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your Circuit Analysis Assistant. I can help you understand the mesh currents and component values in your current circuit. What would you like to know?"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const autoScroll = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        autoScroll();
    }, [messages]);

    const buildCircuitContext = () => {
        const componentsInfo = components.map(c =>
            `${c.name}: ${c.value}${c.type === 'DC_BATTERY' ? 'V' : 'Ω'}`
        ).join(', ');

        const meshCurrents = Object.entries(analysis.loopCurrents)
            .map(([id, val], idx) => `Loop ${idx + 1}: ${val.toFixed(4)}A`)
            .join(', ');

        return `Current Circuit Context:
Components: ${componentsInfo}
Calculated Mesh Currents: ${meshCurrents}
Is Solvable: ${analysis.isSolvable}`;
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const context = buildCircuitContext();
            const response = await fetch(CHAT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
                },
                body: JSON.stringify({
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: `${context}\n\nUser Question: ${userMsg.content}` }
                    ],
                    mode: 'circuit'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            const assistantMsgId = `assistant-${Date.now()}`;

            if (!reader) throw new Error('No reader available');

            // Add placeholder assistant message
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '').trim();
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                assistantContent += content;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: assistantContent } : m
                                ));
                            }
                        } catch (e) {
                            console.error('Error parsing AI response chunk', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('AI Chat Error:', error);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: "⚠️ I'm sorry, I encountered an error while processing your request. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-black/20 rounded-xl border border-white/5 overflow-hidden", className)}>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((m) => (
                    <div key={m.id} className={cn(
                        "flex gap-3",
                        m.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                            m.role === 'user'
                                ? "bg-white/10 border-white/20"
                                : "bg-purple-500/10 border-purple-500/30"
                        )}>
                            {m.role === 'user' ? <User className="w-4 h-4 text-white/70" /> : <Bot className="w-4 h-4 text-purple-400" />}
                        </div>
                        <div className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                            m.role === 'user'
                                ? "bg-white/5 text-white border border-white/10 rounded-tr-none"
                                : "bg-purple-500/5 text-slate-300 border border-purple-500/10 rounded-tl-none"
                        )}>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                    components={{
                                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                        code: ({ children }) => <code className="bg-white/10 px-1 rounded text-purple-300">{children}</code>,
                                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>
                                    }}
                                >
                                    {m.content}
                                </ReactMarkdown>
                                {m.content === '' && isLoading && (
                                    <div className="flex items-center gap-2 py-1">
                                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                                        <span className="text-xs text-slate-500 italic">Analysing circuit...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-sm">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="relative"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your circuit..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
                <div className="mt-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-3 h-3 text-purple-400/50" />
                    <span className="text-[10px] text-white/20 uppercase tracking-widest font-medium">Circuit Intelligence V2</span>
                </div>
            </div>
        </div>
    );
};
