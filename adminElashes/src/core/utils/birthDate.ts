/** Fecha de nacimiento (YYYY-MM-DD, la que da <input type="date">): validación y edad. */

export const MAX_AGE_YEARS = 100;

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoy como YYYY-MM-DD en la zona del navegador (no usar toISOString: da el día en UTC). */
export const todayIso = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/**
 * Fecha más antigua aceptada: la de quien hoy tiene 100 años cumplidos y menos de 101, es
 * decir el día siguiente a hoy hace 101 años (igual que la regla del servidor: edad <= 100).
 */
export const oldestBirthDateIso = (now: Date = new Date()): string => {
  const d = new Date(now.getFullYear() - MAX_AGE_YEARS - 1, now.getMonth(), now.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parse = (iso: string): { y: number; m: number; d: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(y, m - 1, d);
  // 31 de febrero, mes 13, etc.: la fecha no existe.
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
};

/** Años cumplidos a `today`, o null si la fecha no es válida. */
export const ageFromBirthDate = (iso: string, today: string = todayIso()): number | null => {
  const birth = parse(iso);
  const now = parse(today);
  if (!birth || !now) return null;
  const years = now.y - birth.y - (now.m < birth.m || (now.m === birth.m && now.d < birth.d) ? 1 : 0);
  return Math.max(0, years);
};

/** Mensaje de error de una fecha de nacimiento, o "" si es válida o está vacía. */
export const validateBirthDate = (iso: string, today: string = todayIso()): string => {
  if (!iso) return "";
  if (!parse(iso)) return "La fecha de nacimiento no es válida.";
  if (iso > today) return "La fecha de nacimiento no puede ser futura.";
  const age = ageFromBirthDate(iso, today);
  if (age !== null && age > MAX_AGE_YEARS) return "La fecha de nacimiento no es válida (más de 100 años).";
  return "";
};
