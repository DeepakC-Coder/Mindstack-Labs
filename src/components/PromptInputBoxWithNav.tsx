 import React, { useState, useRef, useCallback } from "react";
 import { useNavigate } from "react-router-dom";
 import * as TooltipPrimitive from "@radix-ui/react-tooltip";
 import { ArrowUp, Paperclip, Mic, Globe, BrainCog, FolderCode, X, StopCircle } from "lucide-react";
 import { motion, AnimatePresence } from "framer-motion";
 
 const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");
 
 // Textarea Component
 interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
   className?: string;
 }
 const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
   <textarea
     className={cn(
       "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none",
       className
     )}
     ref={ref}
     rows={1}
     {...props}
   />
 ));
 Textarea.displayName = "Textarea";
 
 // Tooltip Components
 const TooltipProvider = TooltipPrimitive.Provider;
 const Tooltip = TooltipPrimitive.Root;
 const TooltipTrigger = TooltipPrimitive.Trigger;
 const TooltipContent = React.forwardRef<
   React.ElementRef<typeof TooltipPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
 >(({ className, sideOffset = 4, ...props }, ref) => (
   <TooltipPrimitive.Content
     ref={ref}
     sideOffset={sideOffset}
     className={cn(
       "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95",
       className
     )}
     {...props}
   />
 ));
 TooltipContent.displayName = TooltipPrimitive.Content.displayName;
 
 // Button Component
 interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: "default" | "outline" | "ghost";
   size?: "default" | "sm" | "lg" | "icon";
 }
 const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
   ({ className, variant = "default", size = "default", ...props }, ref) => {
     const variantClasses = {
       default: "bg-white hover:bg-white/80 text-black",
       outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
       ghost: "bg-transparent hover:bg-[#3A3A40]",
     };
     const sizeClasses = {
       default: "h-10 px-4 py-2",
       sm: "h-8 px-3 text-sm",
       lg: "h-12 px-6",
       icon: "h-8 w-8 rounded-full aspect-[1/1]",
     };
     return (
       <button
         className={cn(
           "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
           variantClasses[variant],
           sizeClasses[size],
           className
         )}
         ref={ref}
         {...props}
       />
     );
   }
 );
 Button.displayName = "Button";
 
 // Custom Divider Component
 const CustomDivider: React.FC = () => (
   <div className="relative h-6 w-[1.5px] mx-1">
     <div
       className="absolute inset-0 bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent rounded-full"
       style={{
         clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
       }}
     />
   </div>
 );
 
 export const PromptInputBoxWithNav: React.FC = () => {
   const navigate = useNavigate();
   const [input, setInput] = useState("");
   const [files, setFiles] = useState<File[]>([]);
   const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>({});
   const [isRecording, setIsRecording] = useState(false);
   const [showSearch, setShowSearch] = useState(false);
   const [showThink, setShowThink] = useState(false);
   const [showCanvas, setShowCanvas] = useState(false);
   const uploadInputRef = useRef<HTMLInputElement>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
 
   const handleToggleChange = (value: string) => {
     if (value === "search") {
       setShowSearch((prev) => !prev);
       setShowThink(false);
     } else if (value === "think") {
       setShowThink((prev) => !prev);
       setShowSearch(false);
     }
   };
 
   const handleCanvasToggle = () => setShowCanvas((prev) => !prev);
 
   const isImageFile = (file: File) => file.type.startsWith("image/");
 
   const processFile = (file: File) => {
     if (!isImageFile(file)) return;
     if (file.size > 10 * 1024 * 1024) return;
     setFiles([file]);
     const reader = new FileReader();
     reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
     reader.readAsDataURL(file);
   };
 
   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) processFile(file);
     e.target.value = "";
   };
 
   const handleSubmit = () => {
     if (!input.trim()) return;
     
     // Navigate to workspace with the query and mode settings
     navigate("/workspace", {
       state: {
         query: input.trim(),
         webSearch: showSearch,
         think: showThink,
         canvas: showCanvas,
       },
     });
   };
 
   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault();
       handleSubmit();
     }
   };
 
   const removeFile = () => {
     setFiles([]);
     setFilePreviews({});
   };
 
   // Auto-resize textarea
   React.useEffect(() => {
     if (textareaRef.current) {
       textareaRef.current.style.height = "auto";
       textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
     }
   }, [input]);
 
   return (
     <TooltipProvider>
       <div className="rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300">
         {/* File Preview */}
         <AnimatePresence>
           {files.length > 0 && (
             <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "auto" }}
               exit={{ opacity: 0, height: 0 }}
               className="px-2 pt-2 pb-1"
             >
               <div className="relative inline-block">
                 <img
                   src={filePreviews[files[0].name]}
                   alt="Preview"
                   className="h-16 w-16 rounded-lg object-cover border border-[#444444]"
                 />
                 <button
                   onClick={removeFile}
                   className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                 >
                   <X className="h-3 w-3 text-white" />
                 </button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
 
         {/* Recording UI */}
         <AnimatePresence>
           {isRecording && (
             <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "auto" }}
               exit={{ opacity: 0, height: 0 }}
               className="flex flex-col items-center justify-center py-3"
             >
               <div className="flex items-center gap-2 mb-3">
                 <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                 <span className="font-mono text-sm text-white/80">Recording...</span>
               </div>
               <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
                 {[...Array(32)].map((_, i) => (
                   <div
                     key={i}
                     className="w-0.5 rounded-full bg-white/50 animate-pulse"
                     style={{
                       height: `${Math.max(15, Math.random() * 100)}%`,
                       animationDelay: `${i * 0.05}s`,
                     }}
                   />
                 ))}
               </div>
             </motion.div>
           )}
         </AnimatePresence>
 
         {/* Textarea */}
         {!isRecording && (
           <Textarea
             ref={textareaRef}
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder="Ask anything about learning..."
             className="text-base"
           />
         )}
 
         {/* Actions Bar */}
         <div className="flex items-center justify-between pt-2">
           <div className="flex items-center gap-1">
             {/* Attachment */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => uploadInputRef.current?.click()}
                   className="text-gray-400 hover:text-white"
                 >
                   <Paperclip className="h-4 w-4" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Attach image</TooltipContent>
             </Tooltip>
 
             <CustomDivider />
 
             {/* Web Search Toggle */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => handleToggleChange("search")}
                   className={cn(
                     showSearch
                       ? "bg-blue-500/20 text-blue-400"
                       : "text-gray-400 hover:text-white"
                   )}
                 >
                   <Globe className="h-4 w-4" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>
                 {showSearch ? "Disable" : "Enable"} Web Search
               </TooltipContent>
             </Tooltip>
 
             {/* Think Toggle */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => handleToggleChange("think")}
                   className={cn(
                     showThink
                       ? "bg-purple-500/20 text-purple-400"
                       : "text-gray-400 hover:text-white"
                   )}
                 >
                   <BrainCog className="h-4 w-4" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>
                 {showThink ? "Disable" : "Enable"} Deep Thinking
               </TooltipContent>
             </Tooltip>
 
             {/* Canvas Toggle */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={handleCanvasToggle}
                   className={cn(
                     showCanvas
                       ? "bg-amber-500/20 text-amber-400"
                       : "text-gray-400 hover:text-white"
                   )}
                 >
                   <FolderCode className="h-4 w-4" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>
                 {showCanvas ? "Disable" : "Enable"} Canvas Mode
               </TooltipContent>
             </Tooltip>
 
             <CustomDivider />
 
             {/* Voice Recording */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => setIsRecording(!isRecording)}
                   className={cn(
                     isRecording
                       ? "bg-red-500/20 text-red-400"
                       : "text-gray-400 hover:text-white"
                   )}
                 >
                   {isRecording ? (
                     <StopCircle className="h-4 w-4" />
                   ) : (
                     <Mic className="h-4 w-4" />
                   )}
                 </Button>
               </TooltipTrigger>
               <TooltipContent>
                 {isRecording ? "Stop Recording" : "Voice Input"}
               </TooltipContent>
             </Tooltip>
           </div>
 
           {/* Submit Button */}
           <Button
             size="icon"
             onClick={handleSubmit}
             disabled={!input.trim()}
             className="rounded-full bg-white hover:bg-white/90 disabled:opacity-50"
           >
             <ArrowUp className="h-4 w-4 text-black" />
           </Button>
         </div>
 
         {/* Hidden file input */}
         <input
           ref={uploadInputRef}
           type="file"
           accept="image/*"
           onChange={handleFileSelect}
           className="hidden"
         />
 
         {/* Mode indicators */}
         <AnimatePresence>
           {(showSearch || showThink || showCanvas) && (
             <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "auto" }}
               exit={{ opacity: 0, height: 0 }}
               className="flex items-center gap-2 pt-2 px-1"
             >
               {showSearch && (
                 <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                   Web Search
                 </span>
               )}
               {showThink && (
                 <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                   Deep Think
                 </span>
               )}
               {showCanvas && (
                 <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                   Canvas
                 </span>
               )}
             </motion.div>
           )}
         </AnimatePresence>
       </div>
     </TooltipProvider>
   );
 };