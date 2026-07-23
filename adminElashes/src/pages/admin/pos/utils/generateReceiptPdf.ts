import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";
import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import { getLogoUrlForPdf } from "../../../../core/hooks/useLogo";

// En Tauri v2 el global interno es __TAURI_INTERNALS__
const isTauri =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function generateReceiptPdf(sale: PosSaleItem): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 18;

  // ── Logo (si existe) ──────────────────────────────────────────────────────
  const logoDataUrl = await getLogoUrlForPdf();
  if (logoDataUrl) {
    try {
      const logoMaxW = 70;
      const logoMaxH = 30;

      // Cargar imagen y convertir a PNG vía canvas (maneja SVG y todos los formatos)
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = logoDataUrl;
      });

      // Canvas → PNG: garantiza compatibilidad con jsPDF (SVG falla sin esto)
      let pdfData = logoDataUrl;
      if (img.naturalWidth && img.naturalHeight) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            pdfData = canvas.toDataURL("image/png");
          }
        } catch { /* usar original */ }
      }

      let logoW = logoMaxW;
      let logoH = logoMaxH;
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio > logoMaxW / logoMaxH) {
          logoW = logoMaxW;
          logoH = logoMaxW / ratio;
        } else {
          logoH = logoMaxH;
          logoW = logoMaxH * ratio;
        }
      }

      const logoX = (pageW - logoW) / 2;
      doc.addImage(pdfData, "PNG", logoX, y, logoW, logoH);
      y += logoH + 6;
    } catch {
      // Si falla cargar el logo, continuar sin él
    }
  }

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("COMPROBANTE DE PAGO", pageW / 2, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `${fmtDate(sale.created_at)}  ·  ${fmtTime(sale.created_at)}`,
    pageW / 2,
    y,
    { align: "center" }
  );
  y += 9;

  // ── Sale info ─────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 206);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const clientName = `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`.trim() || "Sin cliente";
  const paymentMethod = (sale.payment_method ?? "").toUpperCase();

  const infoRows: [string, string][] = [
    ["Código de venta", sale.sale_code],
    ["Cliente", clientName],
    ["Método de pago", paymentMethod],
  ];

  if (sale.discount_value && Number(sale.discount_value) > 0) {
    const discountLabel =
      sale.discount_type === "percent"
        ? `${sale.discount_value}%`
        : `Bs ${Number(sale.discount_value).toFixed(2)}`;
    infoRows.push(["Descuento", discountLabel]);
  }

  doc.setFontSize(10);
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + 48, y);
    y += 7;
  }

  y += 4;
  doc.setDrawColor(210, 208, 206);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // ── Tickets table ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(96, 94, 92);
  doc.text("SERVICIOS / TICKETS", margin, y);
  y += 4;

  const tableBody = sale.appointments.map((appt) => {
    const serviceName =
      (appt.services ?? []).length > 0
        ? (appt.services ?? []).map((s) => s.name).join(", ")
        : appt.service?.name ?? "Servicio";
    const professional = appt.professional?.username ?? "Sin asignar";
    const date = fmtDate(appt.start_time);
    const time = fmtTime(appt.start_time);
    const status = appt.status === "in_service" ? "En atención" : "En espera";
    return [appt.ticket_code ?? `#${appt.id}`, serviceName, professional, date, time, status];
  });

  autoTable(doc, {
    startY: y,
    head: [["Ticket", "Servicio", "Operaria", "Fecha", "Hora", "Estado"]],
    body: tableBody.length > 0 ? tableBody : [["Sin tickets", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3, textColor: [50, 49, 48] },
    headStyles: {
      fillColor: [50, 49, 48],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [250, 249, 248] },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 16 },
      5: { cellWidth: 26 },
    },
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 30) + 8;

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 206);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  if (sale.subtotal !== undefined && sale.discount_value && Number(sale.discount_value) > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Subtotal:", margin, y);
    doc.text(`Bs ${Number(sale.subtotal).toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL:", margin, y);
  doc.setFontSize(15);
  doc.setTextColor(0, 80, 160);
  doc.text(`Bs ${sale.total.toFixed(2)}`, pageW - margin, y, { align: "right" });
  y += 12;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (sale.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Nota: ${sale.notes.trim()}`, margin, y);
    y += 8;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text("¡Gracias por su compra!", pageW / 2, y, { align: "center" });

  const filename = `comprobante-${sale.sale_code}.pdf`;

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const pdfBytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
      const binary = Array.from(pdfBytes).map((b) => String.fromCharCode(b)).join("");
      const dataBase64 = btoa(binary);

      const savedPath = await invoke<string>("save_pdf", { filename, dataBase64 });

      toast.success(`PDF guardado en Descargas`, {
        autoClose: 4000,
      });
      console.info("[PDF] Guardado en:", savedPath);
    } catch (err) {
      toast.error(`No se pudo guardar el PDF: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  } else {
    doc.save(filename);
    toast.success(`PDF descargado: ${filename}`, { autoClose: 3000 });
  }
}
