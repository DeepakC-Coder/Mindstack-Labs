import React, { useEffect, useRef, useState } from "react";
import functionPlot from "function-plot";
import { motion } from "framer-motion";

interface MathGraphProps {
  expressions: string[];
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

// Parse mathematical expression from text - more robust extraction
export function extractMathExpressions(text: string): string[] {
  const expressions: string[] = [];

  // Patterns to look for math in diversas formats
  const patterns = [
    /y\s*=\s*([^\n$`,:;]+)/gi,
    /f\s*\(\s*x\s*\)\s*=\s*([^\n$`,:;]+)/gi,
    /([^\n$`,:;]+=[^\n$`,:;]+)/g, // Generic equations with =
    /\$\$(.*?)\$\$/g, // LaTeX blocks
    /\$(.*?)\$/g,     // Inline LaTeX
    /\\\[(.*?)\\\]/g, // LaTeX display
    /\\\((.*?)\\\)/g, // LaTeX inline
    /`([^`]*?x[^`]*?)`/g, // Code blocks with x or y
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const rawExpr = match[1].trim();
        // Remove LaTeX artifacts (\text{}, \quad, etc.)
        let clean = rawExpr
          .replace(/\\text\{.*?\}/g, '')
          .replace(/\\[a-z]+/g, (m) => (['\\sin', '\\cos', '\\tan', '\\log', '\\ln', '\\sqrt', '\\pi', '\\frac', '\\cdot', '\\theta', '\\sec', '\\csc', '\\cot', '\\abs'].includes(m) ? m : ''))
          .replace(/[{}]/g, (m) => (rawExpr.includes('\\sqrt') || rawExpr.includes('\\frac') ? m : ''));

        // If it starts with y= or f(x)=, strip it for better cleaning
        clean = clean.replace(/^(y|f\(x\))\s*=\s*/i, '');

        if (isValidExpression(clean)) {
          expressions.push(clean);
        }
      }
    }
  }

  return [...new Set(expressions)];
}

function cleanExpression(expr: string): string {
  return expr
    .trim()
    .replace(/\*\*/g, '^')      // ** to ^
    .replace(/×/g, '*')         // multiplication symbol
    .replace(/÷/g, '/')         // division symbol
    .replace(/−/g, '-')         // minus sign
    .replace(/\s+/g, '')        // remove spaces
    .replace(/[.,;:!?]+$/, '')  // remove trailing punctuation
    .toLowerCase();
}

function isValidExpression(expr: string): boolean {
  if (!expr || expr.length < 1) return false;
  if (/^[\d.]+$/.test(expr)) return false; // just a number
  // Allow expressions with x or y (for implicit relations like x^2 + y^2 = 25)
  if (!expr.includes('x') && !expr.includes('y')) return false;
  if (/[a-z]{3,}/i.test(expr)) {
    // Check if it's a known function or LaTeX command
    const knownFunctions = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'exp', 'pow', 'frac', 'pi', 'abs', 'theta', 'sec', 'csc', 'cot'];
    const words = expr.match(/[a-z]+/gi) || [];
    if (words.some(w => w.length > 2 && !knownFunctions.includes(w.toLowerCase()))) return false;
  }
  return true;
}

// Check if text contains mathematical content that should be graphed
export function shouldRenderGraph(text: string): boolean {
  const mathKeywords = [
    /\by\s*=\s*[^=]/i,
    /\bf\s*\(\s*x\s*\)/i,
    /\bplot\b/i,
    /\bgraph\b/i,
    /x\s*\^\s*\d/i,
    /\bsin\s*\(/i,
    /\bcos\s*\(/i,
    /\btan\s*\(/i,
    /\blog\s*\(/i,
    /\bln\s*\(/i,
    /\bsqrt\s*\(/i,
    /\bparabola\b/i,
    /\bquadratic\b/i,
    /\bexponential\b/i,
    /\blinear\b.*equation/i,
    // LaTeX patterns
    /\\frac\s*\{/i,
    /\\sqrt\s*[[{]/i,
    /\\int\b/i,
    /\\sum\b/i,
    // More graph-related keywords
    /\bcurve\b/i,
    /\bfunction\b.*graph/i,
    /graph.*\bfunction\b/i,
    /\bequation\b.*:/i,
    /\bformula\b.*:/i,
    /draw.*\b(graph|curve|function)\b/i,
    /visualize.*\b(equation|function)\b/i,
  ];

  return mathKeywords.some(pattern => pattern.test(text));
}

// Convert common math notation to function-plot compatible format
function normalizeExpression(expr: string): string {
  const normalized = expr
    .replace(/(\d)([a-z])/gi, '$1*$2')  // 2x -> 2*x
    .replace(/([a-z])(\d)/gi, '$1^$2')  // x2 -> x^2 (likely power)
    .replace(/\)(\()/g, ')*(')           // )( -> )*(
    .replace(/(\d)\(/g, '$1*(')          // 2( -> 2*(
    .replace(/\)(\d)/g, ')*$1')          // )2 -> )*2
    .replace(/\)(x)/gi, ')*$1')          // )x -> )*x
    .replace(/(x)\(/gi, '$1*(')          // x( -> x*(
    .replace(/e\^x/gi, 'exp(x)')         // e^x -> exp(x)
    .replace(/e\^(\([^)]+\))/gi, 'exp$1') // e^(...) -> exp(...)
    .replace(/(\d+)\^x/gi, 'pow($1,x)'); // 2^x -> pow(2,x)

  return normalized;
}

const MathGraph: React.FC<MathGraphProps> = ({
  expressions,
  title,
  width = 400,
  height = 300,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedExpressions, setRenderedExpressions] = useState<string[]>([]);

  useEffect(() => {
    if (!containerRef.current || expressions.length === 0) return;

    // Clear previous content
    containerRef.current.innerHTML = "";
    setError(null);

    const successfulExpressions: string[] = [];
    const data: object[] = [];
    const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"];

    // Try to normalize and validate each expression
    for (let i = 0; i < expressions.length; i++) {
      const expr = expressions[i];
      const normalized = normalizeExpression(expr);

      // Test if expression is valid by trying to evaluate at x=0
      try {
        // Simple validation - check if it looks parseable
        const testExpr = normalized.replace(/x/g, '0');
        // Skip if it has invalid characters
        if (/[a-wyz]/i.test(normalized.replace(/sin|cos|tan|log|ln|sqrt|exp|pow/gi, ''))) {
          continue;
        }

        data.push({
          fn: normalized,
          color: colors[i % colors.length],
          graphType: "polyline" as const,
        });
        successfulExpressions.push(expr);
      } catch (e) {
        console.warn(`Skipping invalid expression: ${expr}`, e);
      }
    }

    if (data.length === 0) {
      // Fallback: try to use original expressions directly
      for (let i = 0; i < expressions.length; i++) {
        data.push({
          fn: expressions[i],
          color: colors[i % colors.length],
          graphType: "polyline" as const,
        });
        successfulExpressions.push(expressions[i]);
      }
    }

    try {
      functionPlot({
        target: containerRef.current,
        width,
        height,
        yAxis: { domain: [-10, 10] },
        xAxis: { domain: [-10, 10] },
        grid: true,
        data,
        tip: {
          xLine: true,
          yLine: true,
        },
      });

      setRenderedExpressions(successfulExpressions);
      setError(null);
    } catch (e) {
      console.error("Graph rendering error:", e);

      // Try one more time with simplified expressions
      try {
        const simplifiedData = expressions.map((expr, index) => {
          // Very aggressive cleanup
          const simple = expr
            .replace(/\s/g, '')
            .replace(/(\d)x/g, '$1*x')
            .replace(/x(\d)/g, 'x^$1');
          return {
            fn: simple,
            color: colors[index % colors.length],
            graphType: "polyline" as const,
          };
        });

        containerRef.current.innerHTML = "";
        functionPlot({
          target: containerRef.current,
          width,
          height,
          yAxis: { domain: [-10, 10] },
          xAxis: { domain: [-10, 10] },
          grid: true,
          data: simplifiedData,
        });

        setRenderedExpressions(expressions);
        setError(null);
      } catch (e2) {
        setError(`Could not render: ${expressions.join(', ')}. Try formats like "x^2" or "sin(x)"`);
      }
    }
  }, [expressions, width, height]);

  if (expressions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 ${className}`}
    >
      {title && (
        <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
          <span>📊</span> {title}
        </h4>
      )}

      {error ? (
        <div className="text-amber-300 text-sm p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="font-medium mb-1">⚠️ Graph Error</p>
          <p>{error}</p>
          <p className="mt-2 text-white/60 text-xs">
            Expressions attempted: {expressions.join(', ')}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="rounded-lg overflow-hidden bg-white"
          style={{ minHeight: height }}
        />
      )}

      {renderedExpressions.length > 0 && !error && (
        <div className="mt-2 flex flex-wrap gap-2">
          {renderedExpressions.map((expr, index) => {
            const colorClasses = ["bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500"];
            return (
              <span
                key={index}
                className={`text-xs px-2 py-1 rounded-full ${colorClasses[index % colorClasses.length]}/20 text-white/80 border border-white/20`}
              >
                y = {expr}
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default MathGraph;
