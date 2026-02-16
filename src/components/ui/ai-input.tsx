 "use client";
 
 import { CornerRightUp, Mic } from "lucide-react";
 import { useState } from "react";
 import { cn } from "@/lib/utils";
 import { Textarea } from "@/components/ui/textarea";
 import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
 
 interface AIInputProps {
   id?: string;
   placeholder?: string;
   minHeight?: number;
   maxHeight?: number;
   onSubmit?: (value: string) => void;
   className?: string;
 }
 
 export function AIInput({
   id = "ai-input",
   placeholder = "Type your message...",
   minHeight = 52,
   maxHeight = 200,
   onSubmit,
   className,
 }: AIInputProps) {
   const { textareaRef, adjustHeight } = useAutoResizeTextarea({
     minHeight,
     maxHeight,
   });
   const [inputValue, setInputValue] = useState("");
 
   const handleReset = () => {
     if (!inputValue.trim()) return;
     onSubmit?.(inputValue);
     setInputValue("");
     adjustHeight(true);
   };
 
   return (
     <div className={cn("w-full", className)}>
       <div className="relative">
         <Textarea
           ref={textareaRef}
           id={id}
           placeholder={placeholder}
           className={cn(
             "w-full rounded-xl px-4 py-3 pr-20",
             "bg-black/5 dark:bg-white/5",
             "border-none",
             "text-foreground",
             "resize-none",
             "focus-visible:ring-0 focus-visible:ring-offset-0",
             "placeholder:text-muted-foreground/60",
             "min-h-[52px]"
           )}
           value={inputValue}
           onChange={(e) => {
             setInputValue(e.target.value);
             adjustHeight();
           }}
           onKeyDown={(e) => {
             if (e.key === "Enter" && !e.shiftKey) {
               e.preventDefault();
               handleReset();
             }
           }}
         />
 
         <div
           className={cn(
             "absolute top-1/2 -translate-y-1/2 rounded-xl bg-black/5 dark:bg-white/5 py-1 px-1 transition-all duration-200",
             inputValue ? "right-10" : "right-3"
           )}
         >
           <Mic className="w-4 h-4 text-black/70 dark:text-white/70" />
         </div>
         <button
           onClick={handleReset}
           type="button"
           className={cn(
             "absolute top-1/2 -translate-y-1/2 right-3",
             "rounded-xl bg-black/5 dark:bg-white/5 py-1 px-1",
             "transition-all duration-200",
             inputValue
               ? "opacity-100 scale-100"
               : "opacity-0 scale-95 pointer-events-none"
           )}
         >
           <CornerRightUp className="w-4 h-4 text-black/70 dark:text-white/70" />
         </button>
       </div>
     </div>
   );
 }