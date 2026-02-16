 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
 const E2B_API_URL = "https://api.e2b.dev";
 
 // Store active sandboxes (in production, use a proper store)
 const activeSandboxes = new Map<string, { id: string; createdAt: number }>();
 
// Helper to list ALL sandboxes on the E2B account via their REST API
async function listAllSandboxes(): Promise<{ sandboxId: string; startedAt: string }[]> {
  try {
    const res = await fetch(`${E2B_API_URL}/sandboxes`, {
      method: "GET",
      headers: { "X-API-Key": E2B_API_KEY! },
    });
    if (!res.ok) {
      console.warn("Failed to list sandboxes:", res.status);
      return [];
    }
    const data = await res.json();
    // The API returns an array of sandbox info objects
    return Array.isArray(data) ? data : data?.sandboxes || [];
  } catch (e) {
    console.warn("Failed to list sandboxes:", e);
    return [];
  }
}

// Helper to kill sandbox by id (best-effort, logs but does not throw)
async function killSandbox(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${E2B_API_URL}/sandboxes/${id}`, {
      method: "DELETE",
      headers: { "X-API-Key": E2B_API_KEY! },
    });
    if (!res.ok) {
      console.warn("Failed to kill sandbox", id, res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Failed to kill sandbox", id, e);
    return false;
  }
}

 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     if (!E2B_API_KEY) {
       console.error("E2B_API_KEY is not configured");
       return new Response(
         JSON.stringify({ error: "E2B service not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const { action, sandboxId, file, code, command, path, content, name, isDirectory } = await req.json();
     console.log(`E2B Sandbox action: ${action}`);
 
     switch (action) {
       case "create": {
          // --------------- Create a new sandbox ---------------
          // Proactively cull oldest sandboxes if nearing the concurrent limit (20 for hobby)
          const MAX_CONCURRENT = 18; // leave headroom before hard cap of 20
          const allSandboxes = await listAllSandboxes();
          console.log("Existing sandboxes count:", allSandboxes.length);

          if (allSandboxes.length >= MAX_CONCURRENT) {
            // Sort oldest first and kill enough to be under the limit
            const sorted = allSandboxes.sort(
              (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
            );
            const toKill = sorted.slice(0, allSandboxes.length - MAX_CONCURRENT + 2);
            console.log(`Killing ${toKill.length} oldest sandboxes...`);
            for (const sbx of toKill) {
              await killSandbox(sbx.sandboxId);
            }
          }

          // Actually create
          const createRes = await fetch(`${E2B_API_URL}/sandboxes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": E2B_API_KEY,
            },
            body: JSON.stringify({
              templateID: "base",
              timeout: 3600, // 1 hour timeout
            }),
          });

          if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error("E2B create error:", errorText);
            throw new Error("Failed to create sandbox");
          }

          const sandbox = await createRes.json();
         activeSandboxes.set(sandbox.sandboxId, { id: sandbox.sandboxId, createdAt: Date.now() });
 
        // Initialize with a proper project structure
        const starterFiles: Array<{ name: string; path: string; type: "file" | "directory"; children?: any[] }> = [
          { 
            name: "src", 
            path: "src", 
            type: "directory",
            children: [
              { name: "index.js", path: "src/index.js", type: "file" },
              { name: "utils.js", path: "src/utils.js", type: "file" },
            ]
          },
          { name: "main.py", path: "main.py", type: "file" },
          { name: "index.js", path: "index.js", type: "file" },
          { name: "package.json", path: "package.json", type: "file" },
          { name: "README.md", path: "README.md", type: "file" },
         ];
 
        // Create directories and write files
        const flatFiles = flattenFiles(starterFiles);
        for (const f of flatFiles) {
          if (f.type === "directory") {
            await fetch(`${E2B_API_URL}/sandboxes/${sandbox.sandboxId}/filesystem`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": E2B_API_KEY,
              },
              body: JSON.stringify({ path: `/home/user/${f.path}`, isDir: true }),
            });
          } else {
            const fileContent = getStarterContent(f.path);
            await fetch(`${E2B_API_URL}/sandboxes/${sandbox.sandboxId}/filesystem`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": E2B_API_KEY,
              },
              body: JSON.stringify({ path: `/home/user/${f.path}`, content: fileContent }),
            });
          }
         }
 
         return new Response(
           JSON.stringify({ sandboxId: sandbox.sandboxId, files: starterFiles }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
      case "listFiles": {
        if (!sandboxId) {
          throw new Error("Missing sandboxId");
        }
        
        const targetPath = path || "";
        const response = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem?path=/home/user/${targetPath}`, {
          method: "GET",
          headers: { "X-API-Key": E2B_API_KEY },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ files: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ files: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "createFile": {
        if (!sandboxId || !path) {
          throw new Error("Missing sandboxId or path");
        }

        const response = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": E2B_API_KEY,
          },
          body: JSON.stringify({ 
            path: `/home/user/${path}`, 
            content: content || "",
            isDir: isDirectory || false
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("E2B createFile error:", error);
          throw new Error("Failed to create file");
        }

        return new Response(
          JSON.stringify({ success: true, path }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "writeFile": {
        if (!sandboxId || !path) {
          throw new Error("Missing sandboxId or path");
        }

        const response = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": E2B_API_KEY,
          },
          body: JSON.stringify({ path: `/home/user/${path}`, content: content || "" }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("E2B writeFile error:", error);
          throw new Error("Failed to write file");
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deleteFile": {
        if (!sandboxId || !path) {
          throw new Error("Missing sandboxId or path");
        }

        const response = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem?path=/home/user/${path}`, {
          method: "DELETE",
          headers: { "X-API-Key": E2B_API_KEY },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("E2B deleteFile error:", error);
          throw new Error("Failed to delete file");
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "rename": {
        if (!sandboxId || !path || !name) {
          throw new Error("Missing sandboxId, path, or name");
        }

        // E2B doesn't have a native rename, so we copy and delete
        const parentPath = path.split("/").slice(0, -1).join("/");
        const newPath = parentPath ? `${parentPath}/${name}` : name;

        // Read the file
        const readResponse = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem?path=/home/user/${path}`, {
          method: "GET",
          headers: { "X-API-Key": E2B_API_KEY },
        });
        
        const fileContent = await readResponse.text();

        // Write to new location
        await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": E2B_API_KEY,
          },
          body: JSON.stringify({ path: `/home/user/${newPath}`, content: fileContent }),
        });

        // Delete old file
        await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem?path=/home/user/${path}`, {
          method: "DELETE",
          headers: { "X-API-Key": E2B_API_KEY },
        });

        return new Response(
          JSON.stringify({ success: true, newPath }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

       case "run": {
         if (!sandboxId || !file) {
           throw new Error("Missing sandboxId or file");
         }
 
         // Write the file first
         await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "X-API-Key": E2B_API_KEY,
           },
           body: JSON.stringify({ path: `/home/user/${file}`, content: code || "" }),
         });
 
         // Determine run command based on file type
         let runCmd = "";
         if (file.endsWith(".py")) {
           runCmd = `python3 /home/user/${file}`;
         } else if (file.endsWith(".js")) {
           runCmd = `node /home/user/${file}`;
         } else if (file.endsWith(".ts")) {
           runCmd = `npx ts-node /home/user/${file}`;
         } else if (file.endsWith(".sh")) {
           runCmd = `bash /home/user/${file}`;
         } else {
           runCmd = `cat /home/user/${file}`;
         }
 
         const execResponse = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/process`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "X-API-Key": E2B_API_KEY,
           },
           body: JSON.stringify({ cmd: runCmd }),
         });
 
         if (!execResponse.ok) {
           const error = await execResponse.text();
           console.error("E2B run error:", error);
           return new Response(
             JSON.stringify({ output: `Error running ${file}: ${error}` }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }
 
         const result = await execResponse.json();
         return new Response(
           JSON.stringify({ output: result.stdout || result.stderr || "No output" }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       case "exec": {
         if (!sandboxId || !command) {
           throw new Error("Missing sandboxId or command");
         }
 
         const execResponse = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/process`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "X-API-Key": E2B_API_KEY,
           },
           body: JSON.stringify({ cmd: command, cwd: "/home/user" }),
         });
 
         if (!execResponse.ok) {
           const error = await execResponse.text();
           return new Response(
             JSON.stringify({ output: `Error: ${error}` }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }
 
         const result = await execResponse.json();
         return new Response(
           JSON.stringify({ output: result.stdout || result.stderr || "" }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       case "readFile": {
         if (!sandboxId || !path) {
           throw new Error("Missing sandboxId or path");
         }
 
         const response = await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}/filesystem?path=/home/user/${path}`, {
           method: "GET",
           headers: {
             "X-API-Key": E2B_API_KEY,
           },
         });
 
         if (!response.ok) {
           return new Response(
             JSON.stringify({ content: "// File not found or empty" }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }
 
         const content = await response.text();
         return new Response(
           JSON.stringify({ content }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       case "close": {
         if (sandboxId) {
           await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}`, {
             method: "DELETE",
             headers: { "X-API-Key": E2B_API_KEY },
           });
           activeSandboxes.delete(sandboxId);
         }
         return new Response(
           JSON.stringify({ success: true }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       default:
         return new Response(
           JSON.stringify({ error: "Unknown action" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
     }
   } catch (error) {
     console.error("E2B sandbox error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });
 
function flattenFiles(files: any[]): any[] {
  const result: any[] = [];
  for (const file of files) {
    result.push(file);
    if (file.children) {
      result.push(...flattenFiles(file.children));
    }
  }
  return result;
}

 function getStarterContent(filename: string): string {
   switch (filename) {
     case "main.py":
       return `# Welcome to Codex Sandbox!
 # This is a Python file. Try running it!
 
 def main():
     print("Hello from Codex! 🚀")
     
     # Try some calculations
     numbers = [1, 2, 3, 4, 5]
     print(f"Sum: {sum(numbers)}")
     print(f"Average: {sum(numbers) / len(numbers)}")
 
 if __name__ == "__main__":
     main()
 `;
     case "index.js":
    case "src/index.js":
       return `// Welcome to Codex Sandbox!
 // This is a JavaScript file. Try running it!
 
 function main() {
     console.log("Hello from Codex! 🚀");
     
     // Try some calculations
     const numbers = [1, 2, 3, 4, 5];
     const sum = numbers.reduce((a, b) => a + b, 0);
     console.log(\`Sum: \${sum}\`);
     console.log(\`Average: \${sum / numbers.length}\`);
 }
 
 main();
`;
    case "src/utils.js":
      return `// Utility functions

export function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
`;
    case "package.json":
      return `{
  "name": "codex-sandbox",
  "version": "1.0.0",
  "description": "Codex coding environment",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  }
}
 `;
     case "README.md":
       return `# Codex Sandbox
 
 Welcome to your coding environment! 
 
 ## Available Files
 - \`main.py\` - Python starter file
 - \`index.js\` - JavaScript starter file
- \`src/\` - Source folder for your project
 
 ## How to Use
 1. Select a file from the file tree
 2. Edit the code in the editor
 3. Click "Run" to execute
 4. View output in the terminal
 
## Terminal Commands
You can run any terminal command:
- \`ls\` - List files
- \`node filename.js\` - Run JavaScript
- \`python3 filename.py\` - Run Python
- \`npm install package\` - Install packages

 ## Ask the AI
 The AI assistant can see your code and terminal output.
 Ask questions like:
 - "What's wrong with my code?"
 - "How can I optimize this?"
 - "Explain this function"
 
 Happy coding! 🎉
 `;
     default:
       return "";
   }
 }