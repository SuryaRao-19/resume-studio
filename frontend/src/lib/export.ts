// Client-side resume export to PDF and DOCX. Runs entirely in the browser
// (no server, no cost). Produces clean, ATS-friendly text documents from the
// model's lightly-marked-up output.
//
// jspdf and docx are heavy, so they're loaded on demand (dynamic import) and
// kept out of the initial bundle — export only happens on a button click.

// A single logical line of the resume, classified for formatting.
interface Line {
  text: string;
  kind: "heading" | "bullet" | "body" | "blank";
}

// Strip markdown emphasis markers (**bold**, *italic*, `code`, leading #).
function stripMarks(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^#{1,6}\s*/, "")
    .trim();
}

function classify(raw: string): Line {
  const trimmed = raw.trim();
  if (!trimmed) return { text: "", kind: "blank" };

  const bullet = /^[-*•]\s+/.test(trimmed);
  if (bullet) {
    return { text: stripMarks(trimmed.replace(/^[-*•]\s+/, "")), kind: "bullet" };
  }

  const clean = stripMarks(trimmed);
  // Treat markdown headings, fully wrapped **HEADER**, or short ALL-CAPS lines
  // as section headings.
  const isHeading =
    /^#{1,6}\s/.test(trimmed) ||
    /^\*\*.+\*\*$/.test(trimmed) ||
    (clean.length <= 40 && clean === clean.toUpperCase() && /[A-Z]/.test(clean));

  return { text: clean, kind: isHeading ? "heading" : "body" };
}

function parse(text: string): Line[] {
  return text.replace(/\r\n/g, "\n").split("\n").map(classify);
}

function safeFilename(title: string): string {
  return (title.trim() || "resume").replace(/[^\w.-]+/g, "_").slice(0, 80);
}

export async function downloadPdf(title: string, text: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const nextPageIfNeeded = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const line of parse(text)) {
    if (line.kind === "blank") {
      y += 8;
      continue;
    }
    const isHeading = line.kind === "heading";
    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    doc.setFontSize(isHeading ? 12 : 10.5);
    const indent = line.kind === "bullet" ? 16 : 0;
    const prefix = line.kind === "bullet" ? "•  " : "";
    const wrapped = doc.splitTextToSize(prefix + line.text, maxWidth - indent);
    const lineHeight = isHeading ? 18 : 14;
    for (const w of wrapped) {
      nextPageIfNeeded(lineHeight);
      doc.text(w, margin + indent, y);
      y += lineHeight;
    }
    if (isHeading) y += 4;
  }

  doc.save(`${safeFilename(title)}.pdf`);
}

export async function downloadDocx(title: string, text: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const paragraphs = parse(text).map((line) => {
    if (line.kind === "blank") return new Paragraph({ text: "" });
    if (line.kind === "heading") {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.text, bold: true })],
      });
    }
    if (line.kind === "bullet") {
      return new Paragraph({ text: line.text, bullet: { level: 0 } });
    }
    return new Paragraph({ children: [new TextRun(line.text)] });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(title)}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
