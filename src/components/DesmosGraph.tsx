import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { LineChart, Plus } from 'lucide-react';
import { Button } from './ui/button';

interface DesmosGraphProps {
    expressions: string[];
    title?: string;
    width?: number;
    height?: number;
    isMini?: boolean;
    onScreenshot?: (dataUrl: string) => void;
}

declare global {
    interface Window {
        Desmos?: {
            GraphingCalculator: (element: HTMLElement, options?: object) => DesmosCalculator;
        };
    }
}

interface DesmosCalculator {
    setExpression: (expr: { id: string; latex: string; color?: string }) => void;
    removeExpression: (expr: { id: string }) => void;
    destroy: () => void;
    resize: () => void;
    setViewport?: (view: object) => void;
    setMathBounds: (bounds: { left: number; right: number; bottom: number; top: number }) => void;
    graphpaperBounds: {
        mathCoordinates: {
            left: number;
            right: number;
            bottom: number;
            top: number;
        }
    };
    screenshot: (options?: { width?: number; height?: number; targetviewonly?: boolean }) => string;
}

const COLORS = [
    '#c74440', // red
    '#2d70b3', // blue
    '#388c46', // green
    '#fa7e19', // orange
    '#6042a6', // purple
];

const DesmosGraph: React.FC<DesmosGraphProps> = ({
    expressions,
    title = "Graph",
    width = 500,
    height = 350,
    isMini = false,
    onScreenshot,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const calculatorRef = useRef<DesmosCalculator | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load Desmos API script
    useEffect(() => {
        if (window.Desmos) {
            setIsLoading(false);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
        script.async = true;
        script.onload = () => {
            setIsLoading(false);
        };
        script.onerror = () => {
            setError('Failed to load Desmos API');
            setIsLoading(false);
        };
        document.head.appendChild(script);
    }, []);

    // Initialize calculator - only once when script is loaded
    useEffect(() => {
        if (isLoading || error || !containerRef.current || !window.Desmos) return;

        // Clean up previous calculator
        if (calculatorRef.current) {
            calculatorRef.current.destroy();
        }

        // Create new calculator with options based on isMini
        const calculator = window.Desmos.GraphingCalculator(containerRef.current, {
            expressions: false,
            settingsMenu: false,
            zoomButtons: false,
            expressionsTopbar: false,
            border: false,
            lockViewport: false,
            keypad: false,
            pointsOfInterest: true,
            trace: true,
            graphpaper: true,
        });

        calculatorRef.current = calculator;

        return () => {
            if (calculatorRef.current) {
                calculatorRef.current.destroy();
                calculatorRef.current = null;
            }
        };
    }, [isLoading, error]);

    // Update expressions separately
    useEffect(() => {
        if (!calculatorRef.current) return;

        // Add expressions with different colors
        expressions.forEach((expr, index) => {
            const latex = convertToLatex(expr);
            calculatorRef.current?.setExpression({
                id: `expr-${index}`,
                latex,
                color: COLORS[index % COLORS.length],
            });
        });

        // Capture screenshot if callback provided
        if (onScreenshot) {
            setTimeout(() => {
                if (calculatorRef.current) {
                    try {
                        const dataUrl = calculatorRef.current.screenshot({
                            width: 800,
                            height: 600,
                            targetviewonly: true
                        });
                        onScreenshot(dataUrl);
                    } catch (e) {
                        console.error("Screenshot failed", e);
                    }
                }
            }, 1000);
        }
    }, [expressions, onScreenshot]);

    // Handle resize
    useEffect(() => {
        if (calculatorRef.current) {
            calculatorRef.current.resize();
        }
    }, [width, height]);

    // Convert simple math notation to Desmos-compatible LaTeX
    const convertToLatex = (expr: string): string => {
        let result = expr.trim();

        // If it already looks like LaTeX (starts with \ or contains typical LaTeX commands), 
        // we should be careful about replacements
        const isLatex = result.includes('\\') || result.includes('{') || result.includes('}');

        if (!isLatex) {
            result = result
                .replace(/\*\*/g, '^')           // ** to ^
                .replace(/(\d)([a-z])/gi, '$1*$2') // 2x to 2*x, 2y to 2*y
                .replace(/([a-z])(\d)/gi, '$1^$2') // x2 to x^2
                .replace(/sqrt\(/gi, '\\sqrt{')  // sqrt( to \sqrt{
                .replace(/sin\(/gi, '\\sin(')    // sin
                .replace(/cos\(/gi, '\\cos(')    // cos
                .replace(/tan\(/gi, '\\tan(')    // tan
                .replace(/log\(/gi, '\\log(')    // log
                .replace(/ln\(/gi, '\\ln(')      // ln
                .replace(/pi/gi, '\\pi')         // pi
                .replace(/e\^/gi, 'e^')          // e^
                // Fix sqrt closing - replace ) with } for sqrt
                .replace(/\\sqrt\{([^}]+)\)/g, '\\sqrt{$1}');
        } else {
            // AI sometimes uses \cdot which Desmos LaTeX can be picky about
            result = result.replace(/\\cdot/g, '*');
        }

        // Check if we need to add y=, x=, or leave as is
        const hasEquals = result.includes('=') || result.includes('<') || result.includes('>');
        const containsX = result.includes('x');
        const containsY = result.includes('y');

        if (!hasEquals) {
            // If it's x^2 + y^2, it's an implicit relation, don't add y=
            if (containsX && containsY) {
                // Keep as is - Desmos handles implicit relations fine
            } else if (containsX) {
                result = `y=${result}`;
            } else if (containsY) {
                result = `x=${result}`;
            }
        }

        return result;
    };

    if (isLoading) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center bg-[#1a1a2e]/50 backdrop-blur-sm rounded-xl border border-white/10",
                    isMini ? "my-2" : "my-4"
                )}
                style={{ width: isMini ? '100%' : width, height: isMini ? 250 : height }}
            >
                <div className="flex items-center gap-2 text-white/60">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                    <span className="text-xs">Loading engine...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="flex items-center justify-center bg-red-500/10 rounded-xl border border-red-500/30"
                style={{ width: isMini ? '100%' : width, height: isMini ? 250 : height }}
            >
                <span className="text-red-400 text-xs">{error}</span>
            </div>
        );
    }

    return (
        <div className={cn("relative group", isMini ? "my-2 w-full" : "my-4")}>
            {title && !isMini && (
                <div className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    {title}
                </div>
            )}
            <div className="relative">
                <div
                    ref={containerRef}
                    className={cn(
                        "rounded-xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 bg-black/20",
                        isMini ? "hover:border-white/30" : "hover:border-blue-500/30"
                    )}
                    style={{ width: isMini ? '100%' : width, height: isMini ? 250 : height }}
                />

                {/* Custom Controls - Positioned to cover Desmos branding */}
                <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (calculatorRef.current) {
                                calculatorRef.current.setMathBounds({
                                    left: -10,
                                    right: 10,
                                    bottom: -10,
                                    top: 10
                                });
                            }
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                        title="Home View"
                    >
                        <LineChart className="w-4 h-4" />
                    </Button>
                    <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
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
                        className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                        title="Zoom In"
                    >
                        <Plus className="w-4 h-4" />
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
                        className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                        title="Zoom Out"
                    >
                        <div className="w-3 h-0.5 bg-current rounded-full" />
                    </Button>
                </div>
            </div>
            {expressions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {expressions.map((expr, idx) => (
                        <div
                            key={idx}
                            className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 flex items-center gap-1.5 backdrop-blur-md"
                        >
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            {expr}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DesmosGraph;
