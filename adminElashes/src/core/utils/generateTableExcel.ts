import * as XLSX from "xlsx";
import { toast } from "react-toastify";

export interface ExcelColumn {
  header: string;
  key: string;
}

export interface GenerateTableExcelOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  meta?: { label: string; value: string }[];
  sheetName?: string;
}

const normalizeCellValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleString("es-BO");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

const safeSheetName = (value: string) =>
  value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Reporte";

export function generateTableExcel({
  title,
  subtitle,
  filename,
  columns,
  rows,
  meta = [],
  sheetName = "Reporte",
}: GenerateTableExcelOptions): void {
  const report: Array<Array<string | number | boolean>> = [[title]];

  if (subtitle) report.push([subtitle]);
  if (meta.length > 0) {
    report.push([]);
    meta.forEach((item) => report.push([item.label, item.value]));
  }

  report.push(["Generado", new Date().toLocaleString("es-BO")]);
  report.push([]);

  const headerRowNumber = report.length + 1;
  report.push(columns.map((column) => column.header));

  rows.forEach((row) => {
    report.push(columns.map((column) => normalizeCellValue(row[column.key])));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(report);
  worksheet["!cols"] = columns.map((column) => {
    const maxDataLength = rows.reduce((max, row) => {
      const value = normalizeCellValue(row[column.key]);
      return Math.max(max, String(value).length);
    }, column.header.length);
    return { wch: Math.min(Math.max(maxDataLength + 2, 12), 45) };
  });

  if (columns.length > 0 && rows.length > 0) {
    const lastColumn = XLSX.utils.encode_col(columns.length - 1);
    worksheet["!autofilter"] = {
      ref: `A${headerRowNumber}:${lastColumn}${headerRowNumber + rows.length}`,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));

  const excelFilename = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
  toast.success(`Excel descargado: ${excelFilename}`, { autoClose: 3000 });
}
