 import React, { useState, useEffect, useCallback, useRef } from 'react';
 import { Point } from '../types/cad.types';
 import { distance } from '../utils/geometry';
 import { cn } from '@/lib/utils';
 
 interface DynamicInputHUDProps {
   visible: boolean;
   position: { screenX: number; screenY: number };
   currentPoint: Point | null;
   startPoint: Point | null;
   onSubmitValue: (type: 'x' | 'y' | 'distance' | 'angle' | 'radius', value: number) => void;
   activeTool: string;
   snapLabel?: string;
 }
 
 export const DynamicInputHUD: React.FC<DynamicInputHUDProps> = ({
   visible,
   position,
   currentPoint,
   startPoint,
   onSubmitValue,
   activeTool,
   snapLabel
 }) => {
   const [inputMode, setInputMode] = useState<'x' | 'y' | 'distance' | 'angle' | 'radius' | null>(null);
   const [inputValue, setInputValue] = useState('');
   const inputRef = useRef<HTMLInputElement>(null);
 
   const dist = startPoint && currentPoint 
     ? distance(startPoint, currentPoint) 
     : 0;
   
   const angle = startPoint && currentPoint
     ? Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x) * 180 / Math.PI
     : 0;
 
   const showRadius = ['circle', 'arc', 'polygon'].includes(activeTool);
   const showDistance = ['line', 'polyline', 'rectangle', 'move', 'copy'].includes(activeTool);
 
   useEffect(() => {
     if (inputMode && inputRef.current) {
       inputRef.current.focus();
       inputRef.current.select();
     }
   }, [inputMode]);
 
   const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
     if (e.key === 'Enter' && inputMode && inputValue) {
       const val = parseFloat(inputValue);
       if (!isNaN(val)) {
         onSubmitValue(inputMode, val);
       }
       setInputMode(null);
       setInputValue('');
       e.stopPropagation();
     } else if (e.key === 'Escape') {
       setInputMode(null);
       setInputValue('');
     } else if (e.key === 'Tab') {
       e.preventDefault();
       // Cycle through input modes
       const modes: Array<'x' | 'y' | 'distance' | 'radius'> = showRadius 
         ? ['x', 'y', 'radius'] 
         : ['x', 'y', 'distance'];
       const idx = inputMode ? modes.indexOf(inputMode as any) : -1;
       const nextIdx = (idx + 1) % modes.length;
       setInputMode(modes[nextIdx]);
       setInputValue('');
     }
   }, [inputMode, inputValue, onSubmitValue, showRadius]);
 
   if (!visible || !currentPoint) return null;
 
   return (
     <div
       className="fixed pointer-events-auto z-50"
       style={{
         left: position.screenX + 20,
         top: position.screenY - 60,
       }}
     >
       <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 text-xs font-mono space-y-1 min-w-[140px]">
         {/* Snap indicator */}
         {snapLabel && (
          <div className="flex items-center gap-1 font-semibold mb-1" style={{ color: 'hsl(50 100% 50%)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(50 100% 50%)' }} />
             {snapLabel}
           </div>
         )}
         
         {/* X coordinate */}
         <div 
           className={cn(
             "flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-1 rounded",
             inputMode === 'x' && "bg-primary/20"
           )}
           onClick={() => { setInputMode('x'); setInputValue(currentPoint.x.toFixed(2)); }}
         >
           <span className="text-muted-foreground w-8">X:</span>
           {inputMode === 'x' ? (
             <input
               ref={inputMode === 'x' ? inputRef : undefined}
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={handleKeyDown}
               className="w-16 bg-transparent border-b border-primary outline-none text-foreground"
               onClick={(e) => e.stopPropagation()}
             />
           ) : (
             <span className="text-foreground">{currentPoint.x.toFixed(2)}</span>
           )}
         </div>
         
         {/* Y coordinate */}
         <div 
           className={cn(
             "flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-1 rounded",
             inputMode === 'y' && "bg-primary/20"
           )}
           onClick={() => { setInputMode('y'); setInputValue(currentPoint.y.toFixed(2)); }}
         >
           <span className="text-muted-foreground w-8">Y:</span>
           {inputMode === 'y' ? (
             <input
               ref={inputMode === 'y' ? inputRef : undefined}
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={handleKeyDown}
               className="w-16 bg-transparent border-b border-primary outline-none text-foreground"
               onClick={(e) => e.stopPropagation()}
             />
           ) : (
             <span className="text-foreground">{currentPoint.y.toFixed(2)}</span>
           )}
         </div>
         
         {/* Distance or Radius */}
         {(showDistance || showRadius) && startPoint && (
           <div 
             className={cn(
               "flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-1 rounded",
               (inputMode === 'distance' || inputMode === 'radius') && "bg-primary/20"
             )}
             onClick={() => { 
               setInputMode(showRadius ? 'radius' : 'distance'); 
               setInputValue(dist.toFixed(2)); 
             }}
           >
             <span className="text-muted-foreground w-8">{showRadius ? 'R:' : 'D:'}</span>
             {(inputMode === 'distance' || inputMode === 'radius') ? (
               <input
                 ref={(inputMode === 'distance' || inputMode === 'radius') ? inputRef : undefined}
                 type="text"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={handleKeyDown}
                 className="w-16 bg-transparent border-b border-primary outline-none text-foreground"
                 onClick={(e) => e.stopPropagation()}
               />
             ) : (
               <span className="text-foreground">{dist.toFixed(2)}</span>
             )}
           </div>
         )}
         
         {/* Angle (read-only for now) */}
         {showDistance && startPoint && (
           <div className="flex items-center gap-2 px-1 text-muted-foreground">
             <span className="w-8">∠:</span>
             <span>{angle.toFixed(1)}°</span>
           </div>
         )}
       </div>
     </div>
   );
 };
 
 export default DynamicInputHUD;