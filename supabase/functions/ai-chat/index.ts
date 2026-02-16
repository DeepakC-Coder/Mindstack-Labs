import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDUCATION_SYSTEM_PROMPT = `You are an expert educational AI assistant focused on providing personalized, clear, and comprehensive learning support. Your responses should be:
 
 1. **Educational**: Focus on teaching concepts, explaining theories, and providing learning resources
 2. **Personalized**: Adapt your explanations to the apparent skill level of the user
 3. **Structured**: Use clear headings, bullet points, and step-by-step explanations
 4. **Engaging**: Include examples, analogies, and real-world applications
 5. **Accurate**: Provide factually correct information with proper context
 
 When answering:
 - Start with a brief, clear summary
 - Provide detailed explanations with examples
 - Include practical applications or exercises when relevant
 - Suggest related topics for further learning
 - Use markdown formatting for clarity
 
 You are helping students and learners understand complex topics in an accessible way.`;

const CHEMISTRY_SYSTEM_PROMPT = `You are an expert chemistry lab assistant specializing in EDTA titration and analytical chemistry. You help students perform and understand water hardness experiments.

**Your Capabilities:**

1. **Explain Procedures**: Step-by-step guidance for EDTA titration
   - Sample preparation with buffer (pH 10)
   - Indicator (EBT) addition and color changes
   - Titration technique and endpoint detection

2. **Calculate Formulas**: 
   - **Water Hardness**: Hardness (ppm) = (V_EDTA × M × 100000) / V_sample
   - **Molarity**: M = moles/L = (mass/molar mass)/volume(L)
   - **Dilution**: C₁V₁ = C₂V₂
   - **Normality to Molarity**: For EDTA, N = M (since EDTA is monoprotic in complexometry)

3. **Answer Questions About**:
   - EBT (Eriochrome Black T) indicator color changes (wine-red → blue)
   - Buffer solutions (NH₄Cl/NH₃ at pH 10)
   - EDTA chemistry and complexation with Ca²⁺/Mg²⁺
   - Endpoint detection and color transition

4. **Troubleshoot**: Common errors in titration experiments
   - Fading endpoints
   - Incorrect pH
   - Air bubbles in burette
   - Overshoot correction

**Response Style:**
- Keep responses concise but educational (2-4 sentences for simple questions)
- Use chemical notation: H₂O, Ca²⁺, Mg²⁺, EDTA⁴⁻, OH⁻
- When given numerical values, show step-by-step calculations
- Use markdown formatting for formulas and emphasis
- Be encouraging and supportive for student learning

**Example Calculation Format:**
Given: V_EDTA = 18.5 mL, M = 0.01 M, V_sample = 25 mL
Hardness = (18.5 × 0.01 × 100000) / 25 = **740 ppm as CaCO₃**`;

const CANVAS_MATH_SYSTEM_PROMPT = `You are an expert mathematics assistant with graphing capabilities. When users ask about mathematical functions, equations, or problems that can be visualized:

**Your Capabilities:**
1. **Explain Mathematical Concepts**: Step-by-step explanations of algebra, calculus, trigonometry, etc.
2. **Provide Equations in Graphable Format**: When explaining functions, always write them clearly as:
   - y = x^2 for parabolas
   - y = sin(x) for trigonometric functions
   - y = mx + b for linear functions
   - f(x) = expression format

3. **Visual Descriptions**: Describe what the graph looks like, key features (intercepts, asymptotes, maxima/minima)

4. **Examples for Graphing**:
   - Linear: y = 2x + 1
   - Quadratic: y = x^2 - 4x + 3
   - Cubic: y = x^3 - 3x
   - Trigonometric: y = sin(x), y = cos(x), y = tan(x)
   - Exponential: y = 2^x, y = e^x
   - Logarithmic: y = log(x), y = ln(x)
   - Square root: y = sqrt(x)

**Response Style:**
- Always include the equation in the format "y = ..." or "f(x) = ..." so it can be graphed
- Use markdown for clear formatting
- Explain step-by-step solutions
- Describe the graph's behavior and key points
- Use proper mathematical notation with ^ for exponents

**Example Response Format:**
For "graph y = x^2 - 4":
The equation y = x^2 - 4 represents a parabola...
- Vertex: (0, -4)
- X-intercepts: x = ±2
- Opens upward...`;

const CIRCUIT_ANALYSIS_SYSTEM_PROMPT = `You are an expert Electrical Engineering assistant specializing in Circuit Analysis and Mesh Analysis. You help students understand and solve circuit problems.

**Your Capabilities:**
1. **Explain Mesh Analysis**: Step-by-step guidance on identifying loops and writing KVL equations.
2. **Handle Circuit Data**: When provided with circuit components (resistors, voltage sources) and their connections, you can explain how the total resistance or currents are calculated.
3. **KVL Equations**: Formulate equations like: R1*I1 + R2*(I1 - I2) = V1.
4. **Solve Systems**: Explain how to solve simultaneous equations for mesh currents.

**Response Style:**
- Be technical yet accessible.
- Use subscripts for currents (I₁, I₂) and voltages (V₁, V₂).
- Use markdown for mathematical equations and bolding for final results.
- If current circuit data is provided in the message, refer to it specifically (e.g., "In your current 2-mesh circuit with the 10V source...").
- Keep explanations structured with numbered steps.

**Key Formulas:**
- KVL: ΣV = 0
- Ohm's Law: V = I * R
- Power: P = I² * R or P = V * I`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`AI Chat request - Mode: ${mode || 'standard'}, Messages: ${messages?.length || 0}`);

    // Build system prompt based on mode
    let systemPrompt = EDUCATION_SYSTEM_PROMPT;

    if (mode === "chemistry") {
      systemPrompt = CHEMISTRY_SYSTEM_PROMPT;
    } else if (mode === "canvas") {
      systemPrompt = CANVAS_MATH_SYSTEM_PROMPT;
    } else if (mode === "circuit") {
      systemPrompt = CIRCUIT_ANALYSIS_SYSTEM_PROMPT;
    } else if (mode === "think") {
      systemPrompt += `\n\nFor this response, engage in deeper reasoning:
      - Break down the problem step by step
      - Consider multiple perspectives or approaches
      - Explain your thought process clearly
      - Identify potential misconceptions and address them`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
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

    console.log("Streaming AI response...");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});