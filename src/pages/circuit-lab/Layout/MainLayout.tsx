import React from 'react';
import type { AppMode } from '@/pages/circuit-lab/engine/types';

interface MainLayoutProps {
    leftPanel: React.ReactNode;
    centerPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    leftPanel,
    centerPanel,
    rightPanel,
    mode,
    onModeChange
}) => {
    return (
        <div className="lab-container flex h-screen w-full overflow-hidden bg-black font-sans">
            {/* Left Sidebar - Landing Page Aesthetic */}
            <aside className="w-[300px] shrink-0 sidebar-merged p-6 overflow-y-auto border-r border-white/5 relative z-10 shadow-2xl">
                <div className="relative z-10">
                    {leftPanel}
                </div>
            </aside>

            {/* Center - Circuit View - Pure Black/Grey Tones */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#050505] relative">
                {/* Header Bar */}
                <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-20">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        </div>
                    </div>

                    {/* Mode Toggle Buttons */}
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-xl">
                        <button
                            onClick={() => onModeChange('mesh')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'mesh'
                                ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                                }`}
                        >
                            Mesh Analysis
                        </button>
                        <button
                            onClick={() => onModeChange('builder')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'builder'
                                ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                                }`}
                        >
                            Circuit Builder
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm font-black tracking-tighter text-white uppercase italic">
                            Circuit Lab
                        </span>
                        <div className="h-4 w-px bg-white/10" />
                        <span className="text-[10px] text-white/30 font-mono tracking-widest uppercase">system.v2</span>
                    </div>
                </header>

                {/* Circuit Canvas Area - Full size, no padding */}
                <div className="flex-1 flex items-stretch justify-stretch overflow-hidden relative group">
                    <div className="absolute inset-0 z-0">
                        {/* Static mesh pattern */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:40px_40px]" />
                    </div>

                    <div className="relative flex-1 flex items-center justify-center p-0">
                        {centerPanel}
                    </div>
                </div>

                {/* Status Bar */}
                <footer className="h-10 px-6 flex items-center justify-between border-t border-white/5 bg-black/60 text-[10px] text-white/40 uppercase tracking-[0.2em] font-medium backdrop-blur-md">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-white/40" />
                            <span>System Ready</span>
                        </div>
                        <span className="opacity-20">/</span>
                        <span>{mode === 'builder' ? 'Builder Mode' : 'Analytical Mode'}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>{mode === 'builder' ? 'I/O Active' : 'Solver Engine Loaded'}</span>
                        </div>
                        <span className="opacity-20">/</span>
                        <span className="flex items-center gap-2 text-white/60 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            Live Link
                        </span>
                    </div>
                </footer>
            </main>

            {/* Right Sidebar - Landing Page Aesthetic */}
            <aside className="w-[320px] shrink-0 sidebar-merged p-6 overflow-y-auto border-l border-white/5 relative z-10 shadow-2xl">
                <div className="relative z-10">
                    {rightPanel}
                </div>
            </aside>
        </div>
    );
};
