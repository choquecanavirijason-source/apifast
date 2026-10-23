/** Borradores locales: todavía no son gastos registrados en la BD. */
export interface DraftExpense {
  id: string;
  expense_date: string;
  amount: number;
  description: string;
  photoDataUrl: string | null;
  photoName: string | null;
}

export const expenseDraftKey = (userId: number | string, branchId: number | null) =>
  `expense_draft_v1:${userId}:${branchId ?? "all"}`;

export function readExpenseDraft(key: string): DraftExpense[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || !rows.every((row) =>
    row && typeof row.id === "string" && typeof row.expense_date === "string" &&
    Number.isFinite(row.amount) && row.amount > 0 && typeof row.description === "string" &&
    (row.photoName === null || typeof row.photoName === "string") &&
    (row.photoDataUrl === null || (typeof row.photoDataUrl === "string" &&
      /^data:[^;,]*;base64,[A-Za-z0-9+/=]*$/.test(row.photoDataUrl)))
  )) throw new Error("Borrador local inválido");
  return rows;
}

export function writeExpenseDraft(key: string, rows: DraftExpense[]): void {
  if (rows.length) localStorage.setItem(key, JSON.stringify(rows));
  else localStorage.removeItem(key);
}

export function readExpensePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result) : reject(new Error("No se pudo leer la foto"));
    reader.onerror = () => reject(new Error("No se pudo leer la foto"));
    reader.readAsDataURL(file);
  });
}

export function restoreExpensePhoto(row: DraftExpense): File | null {
  if (!row.photoDataUrl) return null;
  const [header, data] = row.photoDataUrl.split(",");
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new File([bytes], row.photoName || "comprobante.jpg", {
    type: header.slice(5).split(";")[0] || "application/octet-stream",
  });
}
