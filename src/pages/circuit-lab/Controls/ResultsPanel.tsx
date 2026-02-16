import React, { useState, useEffect } from 'react';
import type { AnalysisResult, Loop, Component } from '@/pages/circuit-lab/engine/types';
import { Award, BookOpen, GraduationCap, CheckCircle, XCircle, ArrowRight, Sparkles } from 'lucide-react';
import { CircuitAIChat } from './CircuitAIChat';

interface ResultsPanelProps {
    analysis: AnalysisResult;
    loops: Loop[];
    components: Component[];
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
    analysis,
    loops,
    components
}) => {
    const [mode, setMode] = useState<'LEARN' | 'QUIZ' | 'AI'>('LEARN');
    const [userInputs, setUserInputs] = useState<Record<string, string>>({});
    const [gradeResult, setGradeResult] = useState<{ score: number, feedback: Record<string, boolean> } | null>(null);

    useEffect(() => {
        setUserInputs({});
        setGradeResult(null);
    }, [loops]);

    const handleInputChange = (loopId: string, val: string) => {
        setUserInputs(prev => ({ ...prev, [loopId]: val }));
    };

    const handleSubmit = () => {
        let correctCount = 0;
        const feedback: Record<string, boolean> = {};

        loops.forEach(loop => {
            const actual = analysis.loopCurrents[loop.id];
            const userVal = parseFloat(userInputs[loop.id]);

            if (!isNaN(userVal)) {
                const diff = Math.abs(actual - userVal);
                const tolerance = Math.max(0.1, Math.abs(actual * 0.05));
                const isCorrect = diff <= tolerance;

                feedback[loop.id] = isCorrect;
                if (isCorrect) correctCount++;
            } else {
                feedback[loop.id] = false;
            }
        });

        setGradeResult({
            score: (correctCount / loops.length) * 100,
            feedback
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Mode Toggle */}
            <div className="mb-6">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <button
                        onClick={() => { setMode('LEARN'); setGradeResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
              ${mode === 'LEARN'
                                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'}`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Learn
                    </button>
                    <button
                        onClick={() => { setMode('QUIZ'); setGradeResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
              ${mode === 'QUIZ'
                                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'}`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Quiz
                    </button>
                    <button
                        onClick={() => { setMode('AI'); setGradeResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
              ${mode === 'AI'
                                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Assistance
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={mode === 'AI' ? "flex-1 flex flex-col overflow-hidden" : "flex-1 overflow-auto"}>
                {mode === 'LEARN' ? (
                    <div className="space-y-6">
                        {/* Mesh Currents */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <ArrowRight className="w-4 h-4 text-purple-400" />
                                </div>
                                <h3 className="text-sm font-semibold text-white">Mesh Currents</h3>
                            </div>

                            <div className="space-y-2">
                                {loops.map((loop, idx) => (
                                    <div key={loop.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center
                        text-purple-400 text-sm font-bold border border-purple-500/30">
                                                I{idx + 1}
                                            </div>
                                            <span className="text-sm text-slate-400">Loop {idx + 1}</span>
                                        </div>
                                        <div className="meter-display px-4 py-2">
                                            <span className="text-lg font-mono font-bold text-cyan-400">
                                                {analysis.loopCurrents[loop.id]?.toFixed(4) ?? '---'}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-1">A</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                    <Award className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-1">Pro Tip</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        The mesh current in a shared branch is the algebraic sum of the loop currents
                                        flowing through it. Use KVL equations to solve for each mesh current.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : mode === 'QUIZ' ? (
                    <div className="space-y-6">
                        {/* Instructions */}
                        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <p className="text-sm text-slate-300">
                                <span className="font-semibold text-cyan-400">Challenge: </span>
                                Calculate the mesh currents using KVL and enter your answers below.
                                Tolerance: ±5% or 0.1A
                            </p>
                        </div>

                        {/* Input Fields */}
                        <div className="space-y-4">
                            {loops.map((loop, idx) => {
                                const status = gradeResult ? (gradeResult.feedback[loop.id] ? 'correct' : 'incorrect') : 'neutral';

                                return (
                                    <div key={loop.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                                <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center
                          text-cyan-400 text-xs font-bold border border-cyan-500/30">
                                                    I{idx + 1}
                                                </span>
                                                Mesh Current {idx + 1}
                                            </label>
                                            {status === 'correct' && (
                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Correct
                                                </span>
                                            )}
                                            {status === 'incorrect' && (
                                                <span className="flex items-center gap-1 text-xs text-red-400">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Ans: {analysis.loopCurrents[loop.id]?.toFixed(4)}A
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={userInputs[loop.id] || ''}
                                                onChange={(e) => handleInputChange(loop.id, e.target.value)}
                                                placeholder="0.0000"
                                                className={`w-full px-4 py-3 rounded-lg font-mono text-white
                          premium-input focus:outline-none
                          ${status === 'correct' ? 'border-green-500/50 bg-green-500/10' : ''}
                          ${status === 'incorrect' ? 'border-red-500/50 bg-red-500/10' : ''}
                        `}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                                Amperes
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            className="w-full py-3.5 px-4 rounded-lg font-semibold text-white
                bg-gradient-to-r from-cyan-600 to-blue-600 
                hover:from-cyan-500 hover:to-blue-500
                transform hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-200 ease-out
                shadow-lg shadow-cyan-500/20"
                        >
                            Submit Answers
                        </button>

                        {/* Grade Result */}
                        {gradeResult && (
                            <div className={`p-6 rounded-xl text-center border
                ${gradeResult.score === 100
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-slate-800/50 border-slate-700/30'}`}
                            >
                                <div className={`text-5xl font-bold mb-2
                   ${gradeResult.score === 100 ? 'text-green-400' : 'text-white'}`}
                                >
                                    {gradeResult.score.toFixed(0)}%
                                </div>
                                <p className={`text-sm ${gradeResult.score === 100 ? 'text-green-300' : 'text-slate-400'}`}>
                                    {gradeResult.score === 100
                                        ? '🎉 Excellent! Perfect calculation!'
                                        : 'Review the formulas and try again.'}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <CircuitAIChat components={components} analysis={analysis} />
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Analysis Status</span>
                    <span className={`flex items-center gap-1.5 ${analysis.isSolvable ? 'text-green-400' : 'text-red-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${analysis.isSolvable ? 'bg-green-400' : 'bg-red-400'}`} />
                        {analysis.isSolvable ? 'Solvable' : 'Unsolvable'}
                    </span>
                </div>
            </div>
        </div>
    );
};
