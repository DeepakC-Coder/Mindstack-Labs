 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
const CODEX_SYSTEM_PROMPT = `You are Codex, an expert coding assistant integrated with a live code sandbox. You have access to:

1. **File Contents**: The user's current code files
2. **Terminal Output**: Recent command outputs and errors
3. **File Tree**: The structure of the user's project

Your responsibilities:

## Code Analysis
- Identify bugs, errors, and potential issues
- Suggest optimizations and best practices
- Explain code logic when asked
- Help users write and debug code

## Response Format
When you find issues, you MUST include a JSON block with highlights:
\`\`\`json
{"type": "highlights", "highlights": [{"file": "main.py", "lines": [5, 6], "type": "error"}]}
\`\`\`

Types: "error" (bugs), "warning" (potential issues), "success" (good code)

## Communication Style
- Be encouraging and supportive
- When code is correct, congratulate the user! 🎉
- When there are issues, explain them clearly and provide solutions
- Use code blocks with syntax highlighting
- Be concise but thorough
- If no code context is available, still help the user with their coding questions based on your knowledge

## Examples

**User asks about an error:**
"I see there's an issue on line 5! The variable \`count\` is used before it's defined. Here's the fix:

\`\`\`python
count = 0  # Define before using
for i in range(10):
    count += i
\`\`\`

**User's code is correct:**
"Great job! 🎉 Your code looks clean and follows best practices. The function is well-structured and the logic is correct. Ready to run it?"

**No code context available (WebContainer initializing):**
"I'd be happy to help! While your coding environment is loading, I can still answer programming questions. What would you like to know?"

Always analyze the provided code context before responding. If no context is available, provide helpful coding assistance based on the user's question.`;
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { messages, context } = await req.json();
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     
     if (!LOVABLE_API_KEY) {
       console.error("LOVABLE_API_KEY is not configured");
       return new Response(
         JSON.stringify({ error: "AI service not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`Codex AI request - Messages: ${messages?.length || 0}`);
 
    // Build context message with code and terminal info
    let contextContent = "";
    
    if (context) {
      // Add mode information
      if (context.mode) {
        contextContent += `\n## Environment Mode: ${context.mode === "webcontainer" ? "WebContainer (Lite Mode)" : "E2B (Full Sandbox)"}\n`;
      }
      
      // Add any notes (e.g., when WebContainer is still initializing)
      if (context.note) {
        contextContent += `\n**Note:** ${context.note}\n`;
      }
      
      if (context.currentFile && context.fileContents?.[context.currentFile]) {
        contextContent += `\n## Current File: ${context.currentFile}\n\`\`\`\n${context.fileContents[context.currentFile]}\n\`\`\`\n`;
      }
      
      if (context.fileContents) {
        const otherFiles = Object.entries(context.fileContents)
          .filter(([path]) => path !== context.currentFile)
          .slice(0, 10) // Limit to 10 files to avoid token limits
          .map(([path, content]) => `### ${path}\n\`\`\`\n${String(content).slice(0, 2000)}\n\`\`\``);
        
        if (otherFiles.length > 0) {
          contextContent += `\n## Other Files:\n${otherFiles.join("\n\n")}\n`;
        }
      }
      
      if (context.terminalOutput) {
        contextContent += `\n## Recent Terminal Output:\n\`\`\`\n${context.terminalOutput}\n\`\`\`\n`;
      }
      
      if (context.files && context.files.length > 0) {
        const fileList = Array.isArray(context.files) 
          ? (typeof context.files[0] === "string" 
              ? context.files.slice(0, 20) 
              : JSON.stringify(context.files.slice(0, 20), null, 2))
          : JSON.stringify(context.files, null, 2);
        contextContent += `\n## File Tree:\n\`\`\`\n${fileList}\n\`\`\`\n`;
      }
    }
 
     // Add context to the conversation
     const messagesWithContext = [
       { role: "system", content: CODEX_SYSTEM_PROMPT },
       ...(contextContent ? [{ role: "user", content: `Here is the current state of my code environment:\n${contextContent}` }] : []),
       ...messages,
     ];
 
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-3-flash-preview",
         messages: messagesWithContext,
         stream: true,
       }),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error("AI gateway error:", response.status, errorText);
       
       if (response.status === 429) {
         return new Response(
           JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
           { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       if (response.status === 402) {
         return new Response(
           JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
           { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       
       return new Response(
         JSON.stringify({ error: "AI service temporarily unavailable" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Streaming Codex AI response...");
     return new Response(response.body, {
       headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
     });
   } catch (error) {
     console.error("Codex AI error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });