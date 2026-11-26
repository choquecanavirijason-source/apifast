import type { ServiceOption } from "../../../core/services/agenda/agenda.service";
import type { CartLine } from "./pos.types";

/**
 * Combos en el POS.
 *
 * Un combo se agrega al carrito expandido en sus servicios reales (cada uno con su operaria,
 * horario y comisión), marcados con el mismo `combo_group`. El precio del combo se aplica como
 * descuento: suma de los precios de sus servicios menos el precio del combo. El servidor vuelve a
 * calcularlo y valida que estén todos los servicios (ver `_compute_combo_discount`).
 */

const newGroupId = () => `combo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Líneas del carrito para un combo (una por servicio componente, en el orden del combo). */
export const expandComboToLines = (
  combo: ServiceOption,
  services: ServiceOption[],
  makeLine: (service: ServiceOption) => CartLine,
): CartLine[] => {
  const byId = new Map(services.map((s) => [s.id, s]));
  const group = newGroupId();
  const lines: CartLine[] = [];
  for (const id of combo.component_service_ids ?? []) {
    const component = byId.get(id);
    if (!component) return []; // componente borrado o no cargado: no se agrega un combo incompleto
    lines.push({ ...makeLine(component), combo_id: String(combo.id), combo_group: group, combo_name: combo.name });
  }
  return lines;
};

export type ComboGroup = {
  group: string;
  combo: ServiceOption;
  lines: CartLine[];
  /** Suma de los precios de sus servicios. */
  componentsTotal: number;
  /** Precio del combo (con su promo, si tiene). */
  comboPrice: number;
  /** Lo que ahorra la clienta (nunca negativo). */
  discount: number;
};

/** Combos del carrito que siguen completos (si se quitó un servicio, el combo ya no aplica). */
export const getComboGroups = (lines: CartLine[], services: ServiceOption[]): ComboGroup[] => {
  const byId = new Map(services.map((s) => [String(s.id), s]));
  const groups = new Map<string, CartLine[]>();
  for (const line of lines) {
    if (!line.combo_group) continue;
    groups.set(line.combo_group, [...(groups.get(line.combo_group) ?? []), line]);
  }
  const result: ComboGroup[] = [];
  for (const [group, groupLines] of groups) {
    const combo = byId.get(groupLines[0].combo_id ?? "");
    if (!combo?.is_combo) continue;
    const need = [...(combo.component_service_ids ?? [])].map(String).sort().join(",");
    const have = groupLines.map((l) => l.service_id).sort().join(",");
    if (need !== have) continue;
    const componentsTotal = groupLines.reduce((sum, l) => sum + l.price, 0);
    const comboPrice = Number(combo.effective_price ?? combo.price ?? 0);
    result.push({ group, combo, lines: groupLines, componentsTotal, comboPrice, discount: Math.max(0, componentsTotal - comboPrice) });
  }
  return result;
};

export const comboDiscountTotal = (lines: CartLine[], services: ServiceOption[]) =>
  getComboGroups(lines, services).reduce((sum, g) => sum + g.discount, 0);

/** Payload `combos` para el servidor: un renglón por combo con la cantidad de grupos completos. */
export const comboPayload = (lines: CartLine[], services: ServiceOption[]) => {
  const counts = new Map<number, number>();
  for (const g of getComboGroups(lines, services)) counts.set(g.combo.id, (counts.get(g.combo.id) ?? 0) + 1);
  return Array.from(counts, ([combo_id, quantity]) => ({ combo_id, quantity }));
};
