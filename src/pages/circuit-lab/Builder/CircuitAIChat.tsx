import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Zap } from 'lucide-react';
import type { Component, AnalysisResult, CircuitReport } from '@/pages/circuit-lab/engine/types';
import { supabase } from '@/integrations/supabase/client';

interface CircuitAIChatProps {
    placedComponents: Component[];
    analysis: AnalysisResult | null;
    circuitReport: CircuitReport | null;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export const CircuitAIChat: React.FC<CircuitAIChatProps> = ({
    placedComponents,
    analysis,
    circuitReport
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'initial',
            role: 'assistant',
            content: "Hi! I'm your Circuit Lab Assistant. Ask me about your circuit design, calculations, or troubleshooting tips!"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const buildCircuitContext = () => {
        let context = "Current Circuit State:\n";
        
        if (placedComponents.length === 0) {
            context += "- No components placed yet\n";
        } else {
            context += `- Components (${placedComponents.length}):\n`;
            placedComponents.forEach(comp => {
                const unit = getUnit(comp.type);
                context += `  • ${comp.name}: ${comp.type} = ${comp.value}${unit}\n`;
            });
        }

        if (circuitReport) {
            context += `\nCircuit Status: ${circuitReport.isValid ? 'Valid' : 'Issues Found'}\n`;
            if (circuitReport.issues.length > 0) {
                context += `Issues: ${circuitReport.issues.join(', ')}\n`;
            }
        }

        if (analysis?.isSolvable) {
            context += "\nAnalysis Results:\n";
            Object.entries(analysis.branchCurrents).forEach(([id, current]) => {
                const comp = placedComponents.find(c => c.id === id);
                if (comp) {
                    context += `  • ${comp.name} current: ${current.toFixed(4)} A\n`;
                }
            });
            
            // Calculate power for resistors
            const resistors = placedComponents.filter(c => c.type === 'RESISTOR');
            if (resistors.length > 0) {
                context += "\nPower Dissipation:\n";
                resistors.forEach(comp => {
                    const current = analysis.branchCurrents[comp.id] || 0;
                    const power = current * current * comp.value;
                    context += `  • ${comp.name}: ${power.toFixed(4)} W\n`;
                });
            }
        }

        return context;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const circuitContext = buildCircuitContext();
            const systemPrompt = `You are a helpful Circuit Lab AI Assistant. You help users understand their circuit designs, provide calculations, and offer troubleshooting tips.

${circuitContext}

Guidelines:
- Be concise but informative
- Use proper electrical engineering terminology
- Provide practical advice for circuit design
- If asked about calculations, show your work briefly
- Reference the actual components and values in the user's circuit when relevant`;

            const { data, error } = await supabase.functions.invoke('ai-chat', {
                body: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.filter(m => m.id !== 'initial').map(m => ({
                            role: m.role,
                            content: m.content
                        })),
                        { role: 'user', content: userMessage.content }
                    ]
                }
            });

            if (error) throw error;

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data?.message || data?.content || "I couldn't process that request. Please try again."
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[280px] rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-yellow-500/20 via-blue-500/20 to-orange-500/20">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 via-blue-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white">Circuit AI Assistant</h3>
                    <p className="text-[10px] text-slate-400">Real-time circuit analysis</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'user'
                                ? 'bg-gradient-to-br from-blue-500 via-orange-500 to-yellow-400'
                                : 'bg-gradient-to-br from-yellow-400 via-blue-500 to-orange-500'
                        }`}>
                            {msg.role === 'user' ? (
                                <User className="w-3.5 h-3.5 text-white" />
                            ) : (
                                <Bot className="w-3.5 h-3.5 text-white" />
                            )}
                        </div>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                            msg.role === 'user'
                                ? 'bg-gradient-to-r from-orange-500 via-yellow-400 to-blue-500 text-white'
                                : 'bg-white/10 backdrop-blur-md text-slate-200'
                        }`}>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 via-blue-500 to-orange-500 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-2">
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 bg-black/20">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your circuit..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 via-blue-500 to-orange-500 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

function getUnit(type: string): string {
    switch (type) {
        case 'RESISTOR': return 'Ω';
        case 'DC_BATTERY':
        case 'VOLTAGE_SOURCE':
        case 'AC_SOURCE': return 'V';
        case 'CAPACITOR': return 'µF';
        case 'DIODE': return 'V';
        case 'AMMETER': return 'A';
        default: return '';
    }
}
