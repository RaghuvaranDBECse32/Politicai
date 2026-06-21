import { jsPDF } from "jspdf";
import { Conversation } from "../types";

/**
 * Generates the professional jsPDF document for a conversation.
 * It is structured into dynamic line wrapping, page counts, title pages, and footers.
 */
export function generateConversationPDF(conversation: Conversation): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // A4 is 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // A4 is 297mm
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // --- CHAPTER 1: DESIGN TITLE PAGE (Ink-friendly Elegant layout) ---
  // Dark slate top banner block
  doc.setFillColor(15, 23, 42); // slate-900 background
  doc.rect(0, 0, pageWidth, 55, "F");

  // Accent vertical block
  doc.setFillColor(16, 185, 129); // emerald green accent line
  doc.rect(margin, 18, 4, 22, "F");

  // App & Platform Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("ELECTOR Feed", margin + 8, 26);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("CIVIC SAFETY RESEARCH & MVP AGENT DISPATCH", margin + 8, 33);
  
  doc.setFont("helvetica", "bold");
  doc.text("hacrew Research Lab", margin + 8, 39);

  // Corporate design subtitle banner
  let currentY = 75;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("HACKATHON REPORT & SYSTEM LOG SUMMARY", margin, currentY);
  currentY += 8;

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // Meta Values array block
  const metadata = [
    { label: "Document Classification", value: "Verified Safety Record & Dispatch logs" },
    { label: "Active Evaluation Category", value: conversation.title },
    { label: "Alignment Strategy Profile", value: "Retrieval-Augmented Grounding + Proactive Refusal Matrices" },
    { label: "GCP Target Sandbox Model", value: conversation.model },
    { label: "Model Temperature Limit", value: String(conversation.temperature) },
    { label: "Research Syndicate", value: "hacrew (A Halonex Company)" },
    { label: "Generated Timestamp", value: new Date().toLocaleString() },
  ];

  doc.setFontSize(10);
  metadata.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`${item.label}:`, margin, currentY);

    // Dynamic right margin wrap for values
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42); // slate-900
    const valLines = doc.splitTextToSize(item.value, contentWidth - 50);
    doc.text(valLines, margin + 50, currentY);

    currentY += 7 + (valLines.length - 1) * 4;
  });

  currentY += 8;

  // Core System Guardrail Instruction visual box
  doc.setFillColor(248, 250, 252); // slate-100/50
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, currentY, contentWidth, 54, "FD");

  // Left frame strip
  doc.setFillColor(37, 99, 235); // brand blue
  doc.rect(margin, currentY, 2, 54, "F");

  // Box title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("CORE SYSTEM DIRECTIVES (GUARDRAIL)", margin + 6, currentY + 6);

  // Box helper description
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const sysText = conversation.systemInstruction || "Standard instructions configured with refusal first guidelines.";
  const sysLines = doc.splitTextToSize(sysText, contentWidth - 12);
  doc.text(sysLines.slice(0, 11), margin + 6, currentY + 12);

  // Cover footer page numbering
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("CONFIDENTIAL RESEARCH COMPLIANCE • HACKATHON ASIA TRACK SECURITY WORKSPACE", margin, pageHeight - 15);
  doc.text("Page 1", pageWidth - margin - 15, pageHeight - 15);

  // --- CHAPTER 2: CONVERSATION HISTORY & MESSAGES LOG ---
  doc.addPage();
  currentY = 25;

  // Running page headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`CONVERSATION REVIEW: ${conversation.title}`, margin, 15);
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, 17, pageWidth - margin, 17);

  const messages = conversation.messages;

  if (messages.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No transcripts logged inside this dispatch window.", margin, currentY);
  } else {
    messages.forEach((msg) => {
      // Dynamic page check before starting any message header
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 25;
        // Draw page header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`CONVERSATION REVIEW: ${conversation.title}`, margin, 15);
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, 17, pageWidth - margin, 17);
      }

      const isModel = msg.role === "model";
      const badgeTitle = isModel ? "VERIFIED CIVIC AI RESPONSE" : "USER ENQUIRY AUDIT";

      // Draw outer indicator badge box for clean structure
      doc.setFillColor(isModel ? 239 : 248, isModel ? 246 : 250, isModel ? 255 : 252);
      doc.setDrawColor(isModel ? 191 : 226, isModel ? 219 : 232, isModel ? 254 : 240);
      doc.rect(margin, currentY, contentWidth, 8, "FD");

      // Left bar strip
      doc.setFillColor(isModel ? 16 : 71, isModel ? 185 : 85, isModel ? 129 : 105);
      doc.rect(margin, currentY, 1.5, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(isModel ? 6 : 71, isModel ? 95 : 85, isModel ? 70 : 105);
      doc.text(`${badgeTitle}  •  ${msg.timestamp}`, margin + 4, currentY + 5.5);

      currentY += 12;

      // Text wrapping block
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // Slate-900

      // Formatted parser for cleaner PDF delivery
      const cleanContent = msg.content
        .replace(/###\s+/g, "")
        .replace(/\*\*/g, "")
        .replace(/-\s+/g, "  • ")
        .replace(/`([^`]+)`/g, "$1");

      const lines = doc.splitTextToSize(cleanContent, contentWidth - 4);

      lines.forEach((line: string) => {
        // Continuous page check inside the multi-line paragraphs
        if (currentY > pageHeight - margin) {
          doc.addPage();
          currentY = 25;
          // Top page title helper
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`CONVERSATION REVIEW: ${conversation.title}`, margin, 15);
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, 17, pageWidth - margin, 17);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
        }
        doc.text(line, margin + 2, currentY);
        currentY += 5.2;
      });

      currentY += 8; // Padding separator between dialogue blocks
    });
  }

  // Set running footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("CONFIDENTIAL RESEARCH COMPLIANCE • HACKATHON ASIA TRACK SECURITY WORKSPACE", margin, pageHeight - 15);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 15);
  }

  return doc;
}

/**
 * Exports conversation history to browser download.
 */
export function exportConversationToPDF(conversation: Conversation) {
  const doc = generateConversationPDF(conversation);
  const fileCleanName = conversation.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  doc.save(`${fileCleanName}_elector_analysis.pdf`);
}
