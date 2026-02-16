 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface SearchImage {
  url: string;
  thumbnailUrl: string;
  alt: string;
  source: string;
  sourceUrl: string;
}
 
 // Extract keywords from query using AI
 async function extractKeywords(query: string, apiKey: string): Promise<string[]> {
   console.log("Extracting keywords from query:", query);
   
   try {
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${apiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-2.5-flash-lite",
         messages: [
           {
             role: "system",
             content: "You are a keyword extraction assistant. Extract 3-5 educational search keywords from the user's query. Focus on educational and academic terms. Return ONLY a JSON array of keywords, nothing else. Example: [\"photosynthesis\", \"plant biology\", \"chlorophyll\"]"
           },
           { role: "user", content: query }
         ],
         tools: [
           {
             type: "function",
             function: {
               name: "extract_keywords",
               description: "Extract search keywords from a query",
               parameters: {
                 type: "object",
                 properties: {
                   keywords: {
                     type: "array",
                     items: { type: "string" },
                     description: "Array of 3-5 educational search keywords"
                   }
                 },
                 required: ["keywords"],
                 additionalProperties: false
               }
             }
           }
         ],
         tool_choice: { type: "function", function: { name: "extract_keywords" } }
       }),
     });
 
     if (!response.ok) {
       console.error("Keyword extraction failed:", response.status);
       // Fallback: split query into words
       return query.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
     }
 
     const data = await response.json();
     const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
     
     if (toolCall?.function?.arguments) {
       const args = JSON.parse(toolCall.function.arguments);
       console.log("Extracted keywords:", args.keywords);
       return args.keywords || [query];
     }
     
     return [query];
   } catch (error) {
     console.error("Keyword extraction error:", error);
     return query.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
   }
 }
 
// Simulated web search (educational resources)
async function searchWeb(keyword: string, sourceId: number): Promise<SearchResult[]> {
  console.log(`Source ${sourceId}: Searching for "${keyword}"`);
  
  // Simulated educational search results based on keyword patterns
  const educationalSources = [
    { domain: "wikipedia.org", name: "Wikipedia" },
    { domain: "khanacademy.org", name: "Khan Academy" },
    { domain: "britannica.com", name: "Britannica" },
    { domain: "coursera.org", name: "Coursera" },
    { domain: "edx.org", name: "edX" },
  ];
  
  const source = educationalSources[sourceId % educationalSources.length];
  
  // Generate relevant educational content
  const results: SearchResult[] = [
    {
      title: `${keyword} - Educational Overview`,
      url: `https://${source.domain}/wiki/${encodeURIComponent(keyword.replace(/\s+/g, '_'))}`,
      snippet: `Comprehensive educational resource about ${keyword}. Learn the fundamentals, key concepts, and practical applications in this detailed guide.`,
      source: source.name,
    },
    {
      title: `Understanding ${keyword}: A Complete Guide`,
      url: `https://${source.domain}/learn/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'))}`,
      snippet: `Explore ${keyword} with interactive lessons, exercises, and real-world examples. Perfect for students and lifelong learners.`,
      source: source.name,
    },
  ];
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  return results;
}

// Simulated image search
async function searchImages(keyword: string): Promise<SearchImage[]> {
  console.log(`Searching images for "${keyword}"`);
  
  // Generate simulated educational image results
  const imageCategories = [
    { type: "diagram", suffix: "diagram" },
    { type: "illustration", suffix: "illustration" },
    { type: "photo", suffix: "photo" },
    { type: "chart", suffix: "chart" },
    { type: "infographic", suffix: "infographic" },
  ];
  
  const images: SearchImage[] = imageCategories.slice(0, 4).map((cat, idx) => ({
    url: `https://images.unsplash.com/photo-${1550000000000 + idx * 10000}?w=800&q=80`,
    thumbnailUrl: `https://images.unsplash.com/photo-${1550000000000 + idx * 10000}?w=200&q=60`,
    alt: `${keyword} ${cat.suffix}`,
    source: "Unsplash",
    sourceUrl: `https://unsplash.com/search/photos/${encodeURIComponent(keyword)}`,
  }));
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  
  return images;
}
 
 // Generate AI answer based on search results
 async function generateAnswer(
   query: string,
   searchResults: SearchResult[],
   apiKey: string
 ): Promise<ReadableStream> {
   console.log("Generating educational answer from", searchResults.length, "results");
   
   const context = searchResults
     .map((r, i) => `[${i + 1}] ${r.title} (${r.source}): ${r.snippet}`)
     .join("\n\n");
   
   const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
     method: "POST",
     headers: {
       Authorization: `Bearer ${apiKey}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       model: "google/gemini-2.5-flash",
       messages: [
         {
           role: "system",
           content: `You are an expert educational assistant providing personalized learning support. 
 
 Based on the search results provided, create a comprehensive, well-structured educational response.
 
 Guidelines:
 - Synthesize information from multiple sources
 - Explain concepts clearly with examples
 - Use markdown formatting (headers, bullet points, code blocks if relevant)
 - Include practical applications and exercises when appropriate
 - Cite sources using [1], [2], etc. format
 - End with suggestions for further learning
 
 Search Results:
 ${context}`
         },
         { role: "user", content: query }
       ],
       stream: true,
     }),
   });
 
   if (!response.ok) {
     throw new Error(`AI response generation failed: ${response.status}`);
   }
 
   return response.body!;
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
   }
 
    try {
      const { query, includeImages } = await req.json();
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        console.error("LOVABLE_API_KEY is not configured");
        return new Response(
          JSON.stringify({ error: "AI service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!query || typeof query !== "string") {
        return new Response(
          JSON.stringify({ error: "Query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Web search request:", query, "Include images:", includeImages);

      // Step 1: Extract keywords using AI
      const keywords = await extractKeywords(query, LOVABLE_API_KEY);
      console.log("Keywords for parallel search:", keywords);

      // Step 2: Perform parallel web searches (up to 5 sources) and image search
      const searchPromises = keywords.slice(0, 5).map((keyword, index) => 
        searchWeb(keyword, index)
      );
      
      // Also search for images if requested
      const imagePromise = includeImages 
        ? searchImages(keywords[0] || query) 
        : Promise.resolve([]);
      
      const [searchResultsArrays, images] = await Promise.all([
        Promise.all(searchPromises),
        imagePromise
      ]);
      
      const allResults = searchResultsArrays.flat();
      
      // Deduplicate by URL
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.url === result.url)
      );
      
      console.log(`Collected ${uniqueResults.length} unique search results and ${images.length} images`);

      // Step 3: Generate streaming answer based on search results
      const answerStream = await generateAnswer(query, uniqueResults.slice(0, 10), LOVABLE_API_KEY);

      // Create a TransformStream to inject search results at the beginning
      const encoder = new TextEncoder();
      const searchResultsEvent = `data: ${JSON.stringify({
        type: "search_results",
        results: uniqueResults.slice(0, 10),
        images: images.slice(0, 8),
        keywords: keywords
      })}\n\n`;
 
     const { readable, writable } = new TransformStream();
     const writer = writable.getWriter();
 
     // Write search results first, then pipe the AI stream
     (async () => {
       try {
         await writer.write(encoder.encode(searchResultsEvent));
         
         const reader = answerStream.getReader();
         while (true) {
           const { done, value } = await reader.read();
           if (done) break;
           await writer.write(value);
         }
       } catch (error) {
         console.error("Stream error:", error);
       } finally {
         await writer.close();
       }
     })();
 
     return new Response(readable, {
       headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
     });
   } catch (error) {
     console.error("Web search error:", error);
     
     if (error instanceof Error && error.message.includes("429")) {
       return new Response(
         JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
         { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });