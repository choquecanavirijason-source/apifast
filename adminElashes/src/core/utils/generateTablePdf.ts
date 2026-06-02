import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoBase64 } from "../hooks/useLogo";

export interface PdfColumn {
  header: string;
  key: string;
}

export interface GenerateTablePdfOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  meta?: { label: string; value: string }[];
  orientation?: "portrait" | "landscape";
}

export async function generateTablePdf({
  title,
  subtitle,
  filename,
  columns,
  rows,
  meta = [],
  orientation = "landscape",
}: GenerateTablePdfOptions): Promise<void> {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 12;

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoDataUrl = getLogoBase64();
  if (logoDataUrl) {
    try {
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = logoDataUrl;
      });

      let pdfData = logoDataUrl;
      if (img.naturalWidth && img.naturalHeight) {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          pdfData = canvas.toDataURL("image/png");
        }
      }

      const logoMaxW = 60;
      const logoMaxH = 26;
      let logoW = logoMaxW;
      let logoH = logoMaxH;
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio > logoMaxW / logoMaxH) {
          logoW = logoMaxW; logoH = logoMaxW / ratio;
        } else {
          logoH = logoMaxH; logoW = logoMaxH * ratio;
        }
      }

      doc.addImage(pdfData, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 4;
    } catch { /* sin logo */ }
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(22, 45, 38);
  doc.text(title, margin, y);
  y += 6;

  // Subtitle
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, y);
    y += 5;
  }

  // Meta row
  if (meta.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(meta.map((m) => `${m.label}: ${m.value}`).join("   ·   "), margin, y);
    y += 5;
  }

  // Generated date (right-aligned)
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generado: ${new Date().toLocaleString("es-BO")}`, pageW - margin, 16, { align: "right" });

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  // Table
  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((c) => {
        const val = row[c.key];
        return val === null || val === undefined ? "—" : String(val);
      })
    ),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [22, 45, 38], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [247, 250, 247] },
    margin: { left: margin, right: margin },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  });

  // Footer with page numbers
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    doc.text("New Elashes — Reporte generado automáticamente", margin, doc.internal.pageSize.getHeight() - 6);
  }

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
