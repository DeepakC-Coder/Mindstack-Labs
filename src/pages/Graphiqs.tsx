import React, { useEffect, useRef, useState, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Plus,
    Trash2,
    Settings2,
    LineChart,
    Maximize2,
    Minimize2,
    ChevronLeft,
    ChevronRight,
    Calculator,
    History,
    Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// DesmosCalculator type from DesmosGraph.tsx
type DesmosCalculator = ReturnType<NonNullable<typeof window.Desmos>['GraphingCalculator']>;

interface Expression {
    id: string;
    latex: string;
    color: string;
}

const COLORS = [
    "#2d70b3", // blue
    "#c74440", // red
    "#388c46", // green
    "#6042a6", // purple
    "#fa7e19", // orange
    "#000000", // black
];

const Graphiqs: React.FC = () => {
    const [expressions, setExpressions] = useState<Expression[]>([
        { id: "1", latex: "y = x^2", color: COLORS[0] },
        { id: "2", latex: "y = 2x + 1", color: COLORS[1] },
    ]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const calculatorRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load Desmos Script
    useEffect(() => {
        if (window.Desmos) {
            setIsLoaded(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
        script.async = true;
        script.onload = () => setIsLoaded(true);
        document.head.appendChild(script);
    }, []);

    // Initialize Calculator
    useEffect(() => {
        if (!isLoaded || !containerRef.current || !window.Desmos) return;

        if (!calculatorRef.current) {
            calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
                expressions: false,
                settingsMenu: false,
                zoomButtons: false,
                expressionsTopbar: false,
                border: false,
                keypad: true,
            });

            // Push initial expressions
            expressions.forEach((exp) => {
                calculatorRef.current.setExpression({
                    id: exp.id,
                    latex: exp.latex,
                    color: exp.color,
                });
            });
        }

        return () => {
            // We don't necessarily want to destroy on every rerender
        };
    }, [isLoaded]);

    const updateExpression = (id: string, latex: string) => {
        // Convert ** to ^ for standard power notation
        const formattedLatex = latex.replace(/\*\*/g, "^");

        setExpressions((prev) =>
            prev.map((exp) => (exp.id === id ? { ...exp, latex: formattedLatex } : exp))
        );
        if (calculatorRef.current) {
            calculatorRef.current.setExpression({ id, latex: formattedLatex });
        }
    };

    const addExpression = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        const newExp = {
            id: newId,
            latex: "",
            color: COLORS[expressions.length % COLORS.length],
        };
        setExpressions((prev) => [...prev, newExp]);
        if (calculatorRef.current) {
            calculatorRef.current.setExpression({ id: newId, latex: "", color: newExp.color });
        }
    };

    const removeExpression = (id: string) => {
        if (expressions.length === 1) return;
        setExpressions((prev) => prev.filter((exp) => exp.id !== id));
        if (calculatorRef.current) {
            calculatorRef.current.removeExpression({ id });
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#0D1117] overflow-hidden text-white font-sans">
            {/* Equation Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 350 : 0, opacity: isSidebarOpen ? 1 : 0 }}
                className="relative h-full flex flex-col border-r border-white/10 z-20 shrink-0 overflow-hidden bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]"
            >
                <div className="p-6 flex flex-col gap-4 border-b border-white/10 shrink-0 backdrop-blur-md bg-black/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-white" />
                            <span className="font-bold tracking-tight text-white text-lg">Expressions</span>
                        </div>
                        <div className="text-xs text-white/60 font-medium">
                            {expressions.length} Active
                        </div>
                    </div>
                    <Button
                        onClick={addExpression}
                        className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-md flex items-center gap-2 py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-semibold">Add Expression</span>
                    </Button>
                </div>

                <ScrollArea className="flex-1 px-4">
                    <div className="py-6 space-y-4">
                        {expressions.map((exp, index) => (
                            <motion.div
                                key={exp.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative"
                            >
                                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20 focus-within:border-white/50 transition-all shadow-xl backdrop-blur-md">
                                    <div
                                        className="w-4 h-4 rounded-full shrink-0 shadow-lg border border-white/20"
                                        style={{ backgroundColor: exp.color }}
                                    />
                                    <Input
                                        value={exp.latex}
                                        onChange={(e) => updateExpression(exp.id, e.target.value)}
                                        placeholder="f(x) = ..."
                                        className="bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-white/30 font-mono text-lg"
                                        autoFocus={exp.latex === ""}
                                    />
                                    <button
                                        onClick={() => removeExpression(exp.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-white/60 hover:text-white transition-all rounded-lg hover:bg-red-500/20"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-white/10 text-[10px] text-white/50 flex justify-between items-center bg-black/40 backdrop-blur-md">
                    <span className="font-medium tracking-wider uppercase opacity-70">Graphiqs Engine v1.0</span>
                    <div className="flex gap-3">
                        <History className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
                        <Settings2 className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
                        <Info className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
                    </div>
                </div>
            </motion.aside>



            {/* Main Canvas Area */}
            <main className="relative flex-1 h-full bg-[#0D1117] flex flex-col">
                {/* Top Navbar */}
                <header className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-[#161B22]/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <SidebarTrigger className="text-white/60 hover:text-white" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <LineChart className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-lg font-bold tracking-tight">Graphiqs <span className="text-blue-400 font-medium text-sm ml-1 px-1.5 py-0.5 bg-blue-500/10 rounded">v1.0</span></h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 text-xs text-white/60">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Realtime Canvas Active
                        </div>
                        <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10">
                            <Maximize2 className="w-5 h-5" />
                        </Button>
                    </div>
                </header>

                {/* Graph Container */}
                <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px]">
                    <div
                        ref={containerRef}
                        className="w-full h-full"
                        style={{ backgroundColor: "transparent" }}
                    />

                    {/* Custom Controls (Bottom Right) - Covers Desmos Logo */}
                    <div className="absolute bottom-6 right-6 z-30 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => calculatorRef.current?.setMathBounds({
                                left: -10,
                                right: 10,
                                bottom: -10,
                                top: 10
                            })}
                            className="w-10 h-10 rounded-xl hover:bg-white/10 text-white transition-all shadow-lg"
                            title="Home View"
                        >
                            <LineChart className="w-5 h-5" />
                        </Button>
                        <div className="w-[1px] h-6 bg-white/20 mx-1" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (calculatorRef.current) {
                                    const bounds = calculatorRef.current.graphpaperBounds.mathCoordinates;
                                    const centerX = (bounds.left + bounds.right) / 2;
                                    const centerY = (bounds.bottom + bounds.top) / 2;
                                    const width = (bounds.right - bounds.left) * 0.8;
                                    const height = (bounds.top - bounds.bottom) * 0.8;
                                    calculatorRef.current.setMathBounds({
                                        left: centerX - width / 2,
                                        right: centerX + width / 2,
                                        bottom: centerY - height / 2,
                                        top: centerY + height / 2
                                    });
                                }
                            }}
                            className="w-10 h-10 rounded-xl hover:bg-white/10 text-white transition-all shadow-lg"
                            title="Zoom In"
                        >
                            <Plus className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (calculatorRef.current) {
                                    const bounds = calculatorRef.current.graphpaperBounds.mathCoordinates;
                                    const centerX = (bounds.left + bounds.right) / 2;
                                    const centerY = (bounds.bottom + bounds.top) / 2;
                                    const width = (bounds.right - bounds.left) * 1.25;
                                    const height = (bounds.top - bounds.bottom) * 1.25;
                                    calculatorRef.current.setMathBounds({
                                        left: centerX - width / 2,
                                        right: centerX + width / 2,
                                        bottom: centerY - height / 2,
                                        top: centerY + height / 2
                                    });
                                }
                            }}
                            className="w-10 h-10 rounded-xl hover:bg-white/10 text-white transition-all shadow-lg"
                            title="Zoom Out"
                        >
                            <div className="w-4 h-0.5 bg-current rounded-full" />
                        </Button>
                    </div>

                    {!isLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1117] z-50">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mb-4"
                            />
                            <p className="text-white/40 font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Engine...</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Graphiqs;
