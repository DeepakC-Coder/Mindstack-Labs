import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, Presentation, FileType, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  graphExpressions?: string[];
  graphImage?: string;
}

interface ExportReportButtonProps {
  messages: Message[];
  className?: string;
}

const ExportReportButton: React.FC<ExportReportButtonProps> = ({ messages, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Strip LaTeX notation for plain text/PDF exports
  const stripLatex = (text: string): string => {
    return text
      // Display math blocks
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => cleanLatexContent(content))
      // Inline math
      .replace(/\$([^$]+)\$/g, (_, content) => cleanLatexContent(content))
      // Common LaTeX commands
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)')
      .replace(/\\sum/g, 'Σ')
      .replace(/\\int/g, '∫')
      .replace(/\\infty/g, '∞')
      .replace(/\\pi/g, 'π')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\theta/g, 'θ')
      .replace(/\\pm/g, '±')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\cdot/g, '·')
      .replace(/\\ldots/g, '...')
      .replace(/\\\\/g, '\n')
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // Other commands with args
      .replace(/\\[a-zA-Z]+/g, '') // Other commands without args
      .replace(/[{}]/g, ''); // Remove remaining braces
  };

  const cleanLatexContent = (content: string): string => {
    return content
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\^(\d+)/g, '^$1')
      .replace(/\^{([^}]+)}/g, '^($1)')
      .replace(/_(\d+)/g, '_$1')
      .replace(/_{([^}]+)}/g, '_($1)')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/[{}]/g, '')
      .trim();
  };

  const formatConversation = () => {
    return messages.map(msg => {
      const role = msg.role === "user" ? "You" : "AI";
      // Strip HTML, markdown, and LaTeX for plain text
      const plainContent = stripLatex(msg.content)
        .replace(/\*\*(.*?)\*\*/g, "$1") // bold
        .replace(/\*(.*?)\*/g, "$1") // italic
        .replace(/`([^`]+)`/g, "$1") // inline code
        .replace(/```[\s\S]*?```/g, "[code block]") // code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
        .replace(/#{1,6}\s/g, "") // headers
        .replace(/\n{3,}/g, "\n\n"); // multiple newlines
      return `${role}:\n${plainContent}`;
    }).join("\n\n---\n\n");
  };

  const exportAsTxt = async () => {
    setIsExporting(true);
    try {
      const content = formatConversation();
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversation-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("TXT export failed:", error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportAsPdf = async () => {
    setIsExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // Create a formatted HTML content
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 800px;">
          <h1 style="color: #f97316; margin-bottom: 20px; border-bottom: 2px solid #f97316; padding-bottom: 10px;">
            AI Conversation Export
          </h1>
          <p style="color: #666; margin-bottom: 30px;">
            Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </p>
          ${messages.map(msg => `
            <div style="margin-bottom: 20px; padding: 15px; border-radius: 10px; background: ${msg.role === "user" ? "#fff5f0" : "#f0f9ff"};">
              <div style="font-weight: bold; color: ${msg.role === "user" ? "#f97316" : "#3b82f6"}; margin-bottom: 8px;">
                ${msg.role === "user" ? "You" : "AI Assistant"}
              </div>
              <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">
                ${stripLatex(msg.content).replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
              ${msg.graphImage ? `
                <div style="margin-top: 15px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                  <img src="${msg.graphImage}" style="width: 100%; height: auto; display: block;" />
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      `;

      const container = document.createElement("div");
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      await html2pdf(container, {
        margin: 10,
        filename: `conversation-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      });

      document.body.removeChild(container);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportAsPpt = async () => {
    setIsExporting(true);
    try {
      const pptxgen = (await import("pptxgenjs")).default;
      const pres = new pptxgen();

      pres.title = "AI Conversation";
      pres.author = "AI Assistant";

      // Title slide
      const titleSlide = pres.addSlide();
      titleSlide.addText("AI Conversation Export", {
        x: 0.5,
        y: 2,
        w: 9,
        h: 1.5,
        fontSize: 36,
        bold: true,
        color: "F97316",
        align: "center",
      });
      titleSlide.addText(`Exported on ${new Date().toLocaleDateString()}`, {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.5,
        fontSize: 14,
        color: "666666",
        align: "center",
      });

      // Content slides - group messages into Q&A pairs
      for (let i = 0; i < messages.length; i += 2) {
        const userMsg = messages[i];
        const aiMsg = messages[i + 1];

        const slide = pres.addSlide();

        // Question
        if (userMsg) {
          slide.addText("Question:", {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.4,
            fontSize: 14,
            bold: true,
            color: "F97316",
          });
          slide.addText(userMsg.content.substring(0, 200) + (userMsg.content.length > 200 ? "..." : ""), {
            x: 0.5,
            y: 0.7,
            w: 9,
            h: 1,
            fontSize: 12,
            color: "333333",
            valign: "top",
          });
        }

        // Answer
        if (aiMsg) {
          const aiMsgY = userMsg ? 2 : 0.5;
          slide.addText("Answer:", {
            x: 0.5,
            y: aiMsgY,
            w: 9,
            h: 0.4,
            fontSize: 14,
            bold: true,
            color: "3B82F6",
          });

          const aiText = aiMsg.content
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1");

          slide.addText(
            aiText.substring(0, 800) + (aiText.length > 800 ? "..." : ""),
            {
              x: 0.5,
              y: aiMsgY + 0.4,
              w: aiMsg.graphImage ? 5 : 9,
              h: 3,
              fontSize: 11,
              color: "333333",
              valign: "top",
            }
          );

          if (aiMsg.graphImage) {
            slide.addImage({
              data: aiMsg.graphImage,
              x: 5.8,
              y: aiMsgY + 0.4,
              w: 3.5,
              h: 2.5
            });
          }
        }
      }

      await pres.writeFile({ fileName: `conversation-${new Date().toISOString().slice(0, 10)}.pptx` });
    } catch (error) {
      console.error("PPT export failed:", error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportOptions = [
    { id: "pdf", label: "Export as PDF", icon: FileText, action: exportAsPdf, color: "text-red-400" },
    { id: "ppt", label: "Export as PPT", icon: Presentation, action: exportAsPpt, color: "text-orange-400" },
    { id: "txt", label: "Export as TXT", icon: FileType, action: exportAsTxt, color: "text-blue-400" },
  ];

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors disabled:opacity-50"
      >
        {isExporting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Download className="w-4 h-4" />
          </motion.div>
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">Export</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-xl overflow-hidden z-50"
          >
            {exportOptions.map((option, index) => (
              <motion.button
                key={option.id}
                onClick={option.action}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/10 transition-colors"
              >
                <option.icon className={`w-4 h-4 ${option.color}`} />
                <span className="text-sm">{option.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExportReportButton;
