import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Maximize2, Minimize2, MousePointer2, Pause, Play, Printer, RotateCcw, X } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { SegmentedTabs } from "../../../../components/common/ui";
import type { ProfessionalForSelect, ServiceOption, TicketItem } from "../../../../core/services/agenda/agenda.service";
import type { Product } from "../../../../core/types/IProduct";
import type { CartLine, PosSaleClientOption, ProductCartLine } from "../pos.types";
import PosSaleDrawer from "./PosSaleDrawer";
import ServiceSelectorCard from "./ServiceSelectorCard";
import ProductSelectorCard from "./ProductSelectorCard";
import DroppableColumn from "../../control-de-servicios/components/DroppableColumn";
import DraggableTicketCard from "../../control-de-servicios/components/DraggableTicketCard";

/*
 * Video tutorial del POS.
 *
 * No es una maqueta dibujada: renderiza los MISMOS componentes que la venta real
 * (ServiceSelectorCard, ProductSelectorCard y PosSaleDrawer) con datos de prueba,
 * dentro de una pantalla virtual de 1280x720 escalada al tamaño del reproductor.
 * Así las opciones, textos y estilos son exactamente los de la caja. Nada se
 * guarda ni se cobra: todas las acciones son vacías y la maqueta no recibe clics.
 */

/* ───────────────────────── Datos de prueba ───────────────────────── */

const VW = 1152;
const VH = 648;

const SERVICES: ServiceOption[] = [
  { id: 1, name: "Extensiones Volumen 3D", description: "Volumen 3D con abanicos hechos a mano.", duration_minutes: 150, price: 350 },
  { id: 2, name: "Extensiones Clásicas", description: "Una extensión por pestaña natural.", duration_minutes: 120, price: 280 },
  { id: 3, name: "Lifting de pestañas", description: "Curvatura y tinte de pestañas naturales.", duration_minutes: 60, price: 220 },
  { id: 4, name: "Retoque", description: "Relleno de extensiones.", duration_minutes: 90, price: 150 },
  { id: 5, name: "Retiro de extensiones", description: "Retiro seguro del set anterior.", duration_minutes: 30, price: 80 },
  { id: 6, name: "Laminado de cejas", description: "Cejas definidas y peinadas.", duration_minutes: 60, price: 180 },
];

const PRODUCTS: Product[] = [
  { id: 1, name: "Shampoo espumoso para pestañas", sku: "SHA-001", category: "Cuidado", supplier: "", price: 90, cost: 40, stock: 14, minStock: 3, description: "", active: true, updatedAt: "" },
  { id: 2, name: "Serum para cejas", sku: "SER-002", category: "Cuidado", supplier: "", price: 150, cost: 70, stock: 9, minStock: 3, description: "", active: true, updatedAt: "" },
  { id: 3, name: "Cepillos descartables x10", sku: "CEP-003", category: "Accesorios", supplier: "", price: 40, cost: 15, stock: 30, minStock: 5, description: "", active: true, updatedAt: "" },
  { id: 4, name: "Primer limpiador", sku: "PRI-004", category: "Cuidado", supplier: "", price: 110, cost: 50, stock: 6, minStock: 3, description: "", active: true, updatedAt: "" },
  { id: 5, name: "Adhesivo Premium Negro", sku: "ADH-005", category: "Adhesivos", supplier: "", price: 130, cost: 60, stock: 12, minStock: 3, description: "", active: true, updatedAt: "" },
  { id: 6, name: "Kit de cuidado en casa", sku: "KIT-006", category: "Cuidado", supplier: "", price: 210, cost: 100, stock: 8, minStock: 2, description: "", active: true, updatedAt: "" },
];

const PROFESSIONALS: ProfessionalForSelect[] = ["ana", "claudia", "isabela", "luna", "mia"].map((username, i) => ({
  id: i + 1, username, email: "", branch_name: "Sucursal Principal", is_busy: false, active_count_today: 0,
}));

const CLIENTS: PosSaleClientOption[] = [
  { id: 101, nombre: "María", apellido: "López", phone: "70012345", age: 31 },
  { id: 102, nombre: "Mariana", apellido: "Rojas", phone: "71234567", age: 28 },
  { id: 103, nombre: "Lucía", apellido: "Pérez", phone: "76543210", age: 35 },
];

/* ───────────────────────── Modelo de la simulación ───────────────────────── */

type Tab = "servicios" | "cliente" | "pago";
type Done = null | "espera" | "atencion" | "cobrada";
type Field = "search" | "productSearch" | "clientQ" | "cash";
type Resolver = (root: HTMLElement) => HTMLElement | null;

type Sim = {
  view: "servicios" | "productos";
  search: string;
  productSearch: string;
  svc: number[];
  prod: { id: number; qty: number }[];
  cartOpen: boolean;
  tab: Tab;
  clientQ: string;
  clientMenu: boolean;
  client: number | null;
  seller: string;
  method: string;
  cash: string;
  done: Done;
};

type Step = {
  d: number;
  cap: string;
  target?: Resolver;
  click?: boolean;
  set?: Partial<Sim>;
  type?: { field: Field; text: string };
};

type Scenario = { key: string; label: string; title: string; initial: Partial<Sim>; steps: Step[] };

const INITIAL: Sim = {
  view: "servicios", search: "", productSearch: "", svc: [], prod: [], cartOpen: false, tab: "servicios",
  clientQ: "", clientMenu: false, client: null, seller: "", method: "", cash: "", done: null,
};

/* Buscadores de elementos reales dentro de la pantalla virtual. */
const sel = (css: string): Resolver => (r) => r.querySelector<HTMLElement>(css);
const btn = (text: string, within?: string): Resolver => (r) => {
  const scope = within ? r.querySelector<HTMLElement>(within) : r;
  const found = Array.from(scope?.querySelectorAll<HTMLElement>("button") ?? []).find((b) => (b.textContent ?? "").trim().includes(text));
  return found ?? null;
};
const serviceCard = (name: string): Resolver => (r) => {
  const p = Array.from(r.querySelectorAll<HTMLElement>("p")).find((x) => (x.textContent ?? "").trim() === name);
  return p?.closest<HTMLElement>(".group")?.querySelector<HTMLElement>("button") ?? null;
};
const T = {
  serviceSearch: sel('[data-tour="pos-search"] input'),
  productSearch: sel('input[aria-label="Buscar producto"]'),
  drawerHead: sel('[data-tour="pos-drawer-tabs"]'),
  nextClient: btn("Siguiente: Cliente"),
  nextPago: btn("Siguiente: Pago"),
  clientInput: sel('[data-tour="pos-drawer-client-search"] input'),
  clientResult: btn("María López", '[data-tour="pos-drawer-client-search"]'),
  clientHint: sel('[data-tour="pos-drawer-client-search"]'),
  operaria: sel('[data-tour="pos-drawer-operaria"] button'),
  method: (label: string): Resolver => btn(label, '[data-tour="pos-drawer-payment"]'),
  cash: sel("#pos-drawer-cash-received"),
  start: btn("Cobrar e iniciar atención"),
  wait: btn("Cobrar y poner en espera"),
  charge: btn("Cobrar venta"),
  kindTabs: sel('[data-sim="kind-tabs"]'),
  hubPos: sel('[data-sim="hub-pos"]'),
  simTicket: sel('[data-sim="ticket"]'),
};

const SCENARIOS: Scenario[] = [
  {
    key: "servicio-con-clienta",
    label: "Servicio con clienta",
    title: "Venta de un servicio con clienta registrada",
    initial: {},
    steps: [
      { d: 3.5, cap: "Venta de un servicio con clienta registrada. Vamos desde la búsqueda hasta el cobro." },
      { d: 3.5, cap: "Escribe en el buscador el servicio que pidió la clienta.", target: T.serviceSearch, click: true, type: { field: "search", text: "Volumen" } },
      { d: 3, cap: "Toca el servicio para agregarlo. El carrito se abre solo a la derecha.", target: serviceCard("Extensiones Volumen 3D"), click: true, set: { svc: [1], cartOpen: true } },
      { d: 3, cap: "Paso 1, Servicios: aquí ves lo que lleva la venta. Puedes cambiar el servicio o quitarlo.", target: T.drawerHead },
      { d: 2.5, cap: "Toca «Siguiente: Cliente».", target: T.nextClient, click: true, set: { tab: "cliente" } },
      { d: 3.5, cap: "Busca a la clienta por nombre, apellido o teléfono.", target: T.clientInput, click: true, type: { field: "clientQ", text: "Mar" }, set: { clientMenu: true } },
      { d: 3, cap: "Elígela de la lista. Al elegirla, el sistema pasa solo al paso Pago.", target: T.clientResult, click: true, set: { client: 101, clientMenu: false, tab: "pago" } },
      { d: 3, cap: "Asigna la operaria que atenderá a la clienta.", target: T.operaria, click: true, set: { seller: "1" } },
      { d: 3, cap: "Elige cómo paga la clienta: Efectivo, Tarjeta, Transferencia o QR.", target: T.method("Efectivo"), click: true, set: { method: "cash" } },
      { d: 3.5, cap: "Con Efectivo, escribe el monto recibido. El sistema calcula el vuelto.", target: T.cash, click: true, type: { field: "cash", text: "400" } },
      { d: 5.5, cap: "Abajo hay dos botones de cobro. «Cobrar y poner en espera» cobra y deja el ticket en la cola: úsalo si la clienta debe esperar o la operaria está ocupada.", target: T.wait },
      { d: 5.5, cap: "«Cobrar e iniciar atención» cobra y arranca el servicio ya mismo: antes pide confirmar las alergias y necesita una operaria libre.", target: T.start },
      { d: 4, cap: "Esta vez, «Cobrar e iniciar atención». Al cobrar, el sistema te lleva solo a Control de servicios.", target: T.start, click: true, set: { done: "atencion", cartOpen: false } },
      { d: 5, cap: "Ahí está el ticket en «En servicio», con su código y su operaria. Cuando termine el servicio, se usa «Finalizar».", target: T.simTicket },
      { d: 4, cap: "Para hacer otra venta, vuelve a la pestaña «Caja POS».", target: T.hubPos, click: true, set: { ...INITIAL } },
    ],
  },
  {
    key: "servicio-sin-clienta",
    label: "Servicio sin clienta",
    title: "Venta de un servicio sin clienta (Cliente Mostrador)",
    initial: {},
    steps: [
      { d: 3.5, cap: "Venta de un servicio sin clienta registrada: una visita rápida o alguien que no quiere dejar datos." },
      { d: 3.5, cap: "Busca el servicio en el buscador.", target: T.serviceSearch, click: true, type: { field: "search", text: "Clásicas" } },
      { d: 3, cap: "Toca el servicio para agregarlo al carrito.", target: serviceCard("Extensiones Clásicas"), click: true, set: { svc: [2], cartOpen: true } },
      { d: 2.5, cap: "Toca «Siguiente: Cliente».", target: T.nextClient, click: true, set: { tab: "cliente" } },
      { d: 4, cap: "No elijas a nadie: el sistema lo dice, la venta queda a nombre de «Cliente Mostrador».", target: T.clientHint },
      { d: 2.5, cap: "Sigue con «Siguiente: Pago».", target: T.nextPago, click: true, set: { tab: "pago" } },
      { d: 3, cap: "Asigna la operaria que hará el servicio.", target: T.operaria, click: true, set: { seller: "2" } },
      { d: 3, cap: "Elige el método de pago. Aquí, Tarjeta.", target: T.method("Tarjeta"), click: true, set: { method: "card" } },
      { d: 5, cap: "«Cobrar y poner en espera» cobra y deja el ticket en la cola de Control de servicios, hasta que la operaria esté libre.", target: T.wait },
      { d: 4.5, cap: "La otra opción, «Cobrar e iniciar atención», arranca el servicio al instante (la vimos en el escenario anterior).", target: T.start },
      { d: 4, cap: "Aquí, «Cobrar y poner en espera». Al cobrar, el sistema te lleva solo a Control de servicios.", target: T.wait, click: true, set: { done: "espera", cartOpen: false } },
      { d: 5, cap: "El ticket queda «En espera», con su código y a nombre de Cliente Mostrador. Cuando la operaria esté libre, se pulsa «Iniciar atención».", target: T.simTicket },
      { d: 4, cap: "Para hacer otra venta, vuelve a la pestaña «Caja POS».", target: T.hubPos, click: true, set: { ...INITIAL } },
    ],
  },
  {
    key: "producto",
    label: "Producto",
    title: "Venta de un producto",
    initial: { view: "productos" },
    steps: [
      { d: 3.5, cap: "Venta de un producto. Con la pestaña «Productos» ves el catálogo de inventario con su stock." },
      { d: 3.5, cap: "Busca por nombre, categoría o escaneando el SKU.", target: T.productSearch, click: true, type: { field: "productSearch", text: "Serum" } },
      { d: 3, cap: "Toca «Agregar». El carrito se abre solo.", target: btn("Agregar", "article"), click: true, set: { prod: [{ id: 2, qty: 1 }], cartOpen: true } },
      { d: 3, cap: "Aquí ves el producto, la cantidad y el subtotal. Puedes subir o bajar unidades.", target: T.drawerHead },
      { d: 2.5, cap: "Toca «Siguiente: Cliente».", target: T.nextClient, click: true, set: { tab: "cliente" } },
      { d: 3.5, cap: "La clienta es opcional: sin elegir, la venta queda a nombre de «Cliente Mostrador».", target: T.clientHint },
      { d: 2.5, cap: "Sigue con «Siguiente: Pago».", target: T.nextPago, click: true, set: { tab: "pago" } },
      { d: 3, cap: "Elige el método de pago. Aquí, Transferencia.", target: T.method("Transferencia"), click: true, set: { method: "transfer" } },
      { d: 4, cap: "«Cobrar venta» cobra directo: una venta solo de productos no genera turno en la agenda.", target: T.charge, click: true, set: { done: "cobrada", cartOpen: false } },
      { d: 5, cap: "Listo: venta cobrada y el stock baja solo. Como no hay ticket, no se va a Control de servicios: te quedas en Caja POS, lista para la siguiente venta." },
    ],
  },
];

/* ───────────────────────── Motor de tiempo ───────────────────────── */

const MOVE = 0.4; // fracción del paso para mover el cursor
const APPLY = 0.55; // fracción en la que se aplica el efecto del clic
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const stamp = (n: number) => `${Math.floor(n / 60)}:${Math.floor(n % 60).toString().padStart(2, "0")}`;

function compile(steps: Step[]) {
  let acc = 0;
  const starts = steps.map((s) => { const v = acc; acc += s.d; return v; });
  return { starts, total: acc };
}

function frameAt(scenario: Scenario, starts: number[], total: number, t: number) {
  const steps = scenario.steps;
  const time = Math.min(Math.max(t, 0), total - 0.001);
  let i = steps.length - 1;
  for (let k = 0; k < steps.length; k++) { if (time < starts[k] + steps[k].d) { i = k; break; } }
  const p = (time - starts[i]) / steps[i].d;

  const sim: Sim = { ...INITIAL, ...scenario.initial };
  for (let k = 0; k <= i; k++) {
    const s = steps[k];
    const current = k === i;
    const threshold = s.type ? MOVE : APPLY;
    if (s.set && (!current || p >= threshold)) Object.assign(sim, s.set);
    if (s.type) {
      if (!current) sim[s.type.field] = s.type.text;
      else {
        const q = Math.min(1, Math.max(0, (p - MOVE) / (1 - MOVE - 0.1)));
        sim[s.type.field] = s.type.text.slice(0, Math.ceil(q * s.type.text.length));
      }
    }
  }
  return { i, p, step: steps[i], sim };
}

/** Mantiene visible el elemento dentro del panel con scroll del carrito, sin mover la pantalla virtual. */
function ensureVisible(el: HTMLElement, root: HTMLElement) {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== root) {
    if (node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
      const nr = node.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const scale = nr.height / node.offsetHeight || 1;
      if (er.bottom > nr.bottom - 8 * scale) node.scrollTop += (er.bottom - nr.bottom + 24 * scale) / scale;
      else if (er.top < nr.top + 8 * scale) node.scrollTop -= (nr.top - er.top + 24 * scale) / scale;
    }
    node = node.parentElement;
  }
}

/* ───────────────────────── Pantalla virtual (POS real) ───────────────────────── */

const noop = () => {};

const HUB_H = 40;

/** Pestañas del hub de Caja y seguimiento (mismo estilo que la pantalla real). */
function HubBar({ active }: { active: "pos" | "queue" }) {
  const tab = (isActive: boolean) =>
    `relative flex shrink-0 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
      isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
    }`;
  return (
    <div style={{ height: HUB_H }} className="flex items-center gap-1 border-b border-slate-200/80 bg-[var(--ui-surface-muted)] px-3">
      <span data-sim="hub-pos" className={tab(active === "pos")}>Caja POS</span>
      <span data-sim="hub-queue" className={tab(active === "queue")}>Control de servicios</span>
      <span className={tab(false)}>Agenda del día</span>
    </div>
  );
}

const localIso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

/** Control de servicios con el ticket recién cobrado, hecho con las mismas columnas y tarjetas del tablero real. */
function QueueScreen({ sim }: { sim: Sim }) {
  const now = new Date();
  const services = sim.svc.map((id) => SERVICES.find((x) => x.id === id)!).filter(Boolean);
  const totalMin = services.reduce((n, x) => n + x.duration_minutes, 0) || 60;
  const professional = PROFESSIONALS.find((x) => String(x.id) === sim.seller) ?? PROFESSIONALS[0];
  const inService = sim.done === "atencion";

  const ticket: TicketItem = {
    id: 9001,
    ticket_code: "B1-20261126-0012",
    client_id: sim.client ?? 0,
    client_name: sim.client ? "María López" : "Cliente Mostrador",
    professional_id: professional.id,
    professional_name: professional.username,
    service_id: services[0]?.id ?? null,
    service_ids: services.map((x) => x.id),
    service_name: services[0]?.name ?? null,
    service_names: services.map((x) => x.name),
    service_price: services[0]?.price ?? null,
    service_prices: services.map((x) => x.price),
    start_time: localIso(now),
    end_time: localIso(new Date(now.getTime() + totalMin * 60_000)),
    status: inService ? "in_service" : "pending",
    sale_id: 1,
    sale_status: "paid",
    branch_id: 1,
  };

  const actions = inService ? (
    <div className="flex gap-1.5">
      <span className="rounded-lg bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white">Finalizar</span>
      <span className="flex items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-2 py-1.5 text-slate-600"><Printer className="h-3.5 w-3.5" /></span>
      <span className="rounded-lg border border-rose-200 bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">Cancelar</span>
    </div>
  ) : (
    <div className="flex gap-1.5">
      <span className="rounded-lg bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white">Iniciar atención</span>
      <span className="flex items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-2 py-1.5 text-slate-600"><Printer className="h-3.5 w-3.5" /></span>
      <span className="rounded-lg border border-rose-200 bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">Cancelar</span>
    </div>
  );

  const renderCard = (t: TicketItem) => (
    <div data-sim="ticket">
      <DraggableTicketCard
        ticket={t}
        compact={false}
        professionals={PROFESSIONALS}
        busyProfessionalIds={new Set()}
        onSaveEdits={noop}
        isSavingEdit={false}
        onDelete={noop}
        showRemaining
        statusColors={{}}
        getRemainingLabel={() => (inService ? `≈ ${totalMin} min` : "≈ 0 min espera")}
        actions={actions}
      />
    </div>
  );

  return (
    <DndContext>
      <div style={{ height: VH - HUB_H }} className="flex flex-col gap-3 bg-[var(--ui-surface-muted)] p-3">
        <div className="flex shrink-0 items-center gap-5 rounded-lg border border-[var(--ui-border)] bg-white px-4 py-2 text-center">
          {[
            ["Espera", inService ? 0 : 1],
            ["Servicio", inService ? 1 : 0],
            ["Finalizadas", 0],
          ].map(([label, n]) => (
            <div key={label as string}>
              <p className="text-base font-semibold leading-tight text-[var(--ui-text)]">{n}</p>
              <p className="text-[11px] text-[var(--ui-text-muted)]">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <DroppableColumn id="waiting" title="En espera" tickets={inService ? [] : [ticket]} isEmptyLabel="Sin clientas en espera." renderCard={renderCard} highlightTicket={() => !inService} />
          <DroppableColumn id="in_service" title="En servicio" tickets={inService ? [ticket] : []} isEmptyLabel="Sin servicios activos." renderCard={renderCard} highlightTicket={() => inService} />
          <DroppableColumn id="completed" title="Finalizadas" tickets={[]} isEmptyLabel="Sin finalizadas hoy." renderCard={renderCard} />
        </div>
      </div>
    </DndContext>
  );
}

function PosScreen({ sim }: { sim: Sim }) {
  const comboRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<HTMLDivElement | null>(null);

  const cartLines: CartLine[] = sim.svc.map((id, n) => {
    const s = SERVICES.find((x) => x.id === id)!;
    return {
      localId: `l${n}`, service_id: String(id), professional_id: "", date: "", time: "", without_time: false,
      status: "pending", duration_minutes: s.duration_minutes, price: s.price,
    };
  });
  const productLines: ProductCartLine[] = sim.prod.map((l, n) => {
    const p = PRODUCTS.find((x) => x.id === l.id)!;
    return { localId: `p${n}`, product_id: String(p.id), name: p.name, unit_price: p.price, quantity: l.qty, availableStock: p.stock };
  });
  const total = cartLines.reduce((a, l) => a + l.price, 0) + productLines.reduce((a, l) => a + l.unit_price * l.quantity, 0);
  const productOnly = cartLines.length === 0 && productLines.length > 0;
  const selectedClient = CLIENTS.find((c) => c.id === sim.client) ?? null;
  const q = sim.clientQ.trim().toLowerCase();
  const filteredClients = CLIENTS.filter((c) => !q || `${c.nombre} ${c.apellido}`.toLowerCase().includes(q));
  const countByService: Record<string, number> = {};
  sim.svc.forEach((id) => { countByService[String(id)] = (countByService[String(id)] ?? 0) + 1; });

  // Con el cobro de un servicio, el sistema lleva a Control de servicios (mismo comportamiento que la caja real).
  if (sim.done === "espera" || sim.done === "atencion") {
    return (
      <>
        <HubBar active="queue" />
        <QueueScreen sim={sim} />
      </>
    );
  }

  return (
    <>
      <HubBar active="pos" />
      {/* Barra superior de la caja, igual que la real */}
      <div className="flex items-center gap-2 border-b border-[var(--ui-border)] bg-white px-4 py-2">
        <SegmentedTabs
          tone="brand"
          options={[{ id: "sale", label: "Nueva venta" }, { id: "history", label: "Historial" }, { id: "lastticket", label: "Último ticket" }]}
          value="sale"
          onChange={noop}
        />
        <div data-sim="kind-tabs">
          <SegmentedTabs
            tone="brand"
            options={[
              { id: "servicios", label: "Servicios" },
              {
                id: "productos",
                label: (
                  <span className="flex items-center gap-1.5">
                    Productos
                    {productLines.length > 0 && (
                      <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${sim.view === "productos" ? "bg-white text-[#094732]" : "bg-brand text-white"}`}>
                        {productLines.length}
                      </span>
                    )}
                  </span>
                ),
              },
            ]}
            value={sim.view}
            onChange={noop}
          />
        </div>
      </div>

      <div style={{ height: VH - 53 - HUB_H }} className={`relative flex min-h-0 w-full flex-col gap-3 p-3 text-[var(--ui-text)] ${sim.cartOpen ? "pr-128" : ""}`}>
        <div className="min-h-0 w-full flex-1 overflow-hidden">
          {sim.view === "servicios" ? (
            <ServiceSelectorCard
              labelClass="mb-2 block text-sm font-semibold text-[var(--ui-text)]"
              fieldClass="h-9 w-full rounded-lg border border-[var(--ui-border-strong)] text-sm focus:border-[#094732] focus:ring-0"
              serviceSearch={sim.search}
              onServiceSearchChange={noop}
              onServiceInputFocus={noop}
              onToggleServiceMenu={noop}
              isServiceMenuOpen={false}
              serviceMenuPosition={null}
              filteredServices={[]}
              onServiceSelect={noop}
              selectedServiceCategoryId="all"
              onCategoryFilterChange={noop}
              serviceCategories={[{ id: 1, name: "Extensiones", is_mobile: false }, { id: 2, name: "Lifting", is_mobile: false }, { id: 3, name: "Cejas", is_mobile: false }]}
              onOpenCategoryModal={noop}
              quickServices={SERVICES}
              onAddServiceToCart={noop}
              onRemoveServiceFromCart={noop}
              serviceComboboxRef={comboRef}
              serviceMenuRef={menuRef}
              cartCountByServiceId={countByService}
            />
          ) : (
            <ProductSelectorCard
              products={PRODUCTS}
              canManageInventory={false}
              onCreateProduct={noop}
              productLines={productLines}
              onAddProductToCart={noop}
              onUpdateProductQuantity={noop}
              onRemoveProductLine={noop}
              onOpenCart={noop}
            />
          )}
        </div>

        <PosSaleDrawer
          isOpen={sim.cartOpen}
          onClose={noop}
          cartLines={cartLines}
          productLines={productLines}
          onUpdateProductQuantity={noop}
          onRemoveProductLine={noop}
          services={SERVICES}
          subtotal={total}
          total={total}
          onRemoveLine={noop}
          onChangeLineService={noop}
          clientComboboxRef={clientRef}
          clientSearch={selectedClient ? `${selectedClient.nombre} ${selectedClient.apellido}` : sim.clientQ}
          setClientSearch={noop}
          setClientId={noop}
          isClientMenuOpen={sim.clientMenu}
          setIsClientMenuOpen={noop}
          filteredClients={filteredClients}
          selectedClient={selectedClient}
          clientPhone={selectedClient?.phone ?? ""}
          clientAddress=""
          sellerId={sim.seller}
          setSellerId={noop}
          discountValue=""
          setDiscountValue={noop}
          discountType="amount"
          setDiscountType={noop}
          paymentMethod={sim.method}
          setPaymentMethod={noop}
          cashReceived={sim.cash}
          setCashReceived={noop}
          mixedPayments={[]}
          setMixedPayments={noop}
          notes=""
          setNotes={noop}
          onOpenRegisterClient={noop}
          professionals={PROFESSIONALS}
          primaryActionLabel={productOnly ? "Cobrar venta" : "Confirmar venta"}
          onPrimaryAction={noop}
          primaryActionDisabled={false}
          footerHint={productOnly ? "Venta de productos: se cobra directo, sin turno en agenda." : "Usa 'Crear turno ahora' para atención inmediata o 'Agendar reserva' para elegir horario."}
          onImmediateCheckout={productOnly ? undefined : noop}
          ticketMode="group"
          setTicketMode={noop}
          forceStep={sim.tab}
        />
      </div>

      {sim.done === "cobrada" && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#021a12]/55">
          <div className="flex w-[420px] flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-2xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dff6dd] text-[#107c10]">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <p className="text-xl font-bold text-[#094732]">Venta cobrada</p>
            <p className="text-sm text-[var(--ui-text-muted)]">
              {sim.done === "atencion"
                ? "La atención ya empezó. El ticket está en Control de servicios, columna «En servicio»."
                : sim.done === "espera"
                  ? "El ticket quedó en Control de servicios, columna «En espera»."
                  : "Se generó el comprobante y se descontó el stock."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── Reproductor ───────────────────────── */

export default function PosVideoTutorialDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const points = useRef<Record<number, [number, number]>>({});
  const [, bump] = useState(0);
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(0.7);
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const time = useRef(0);

  const scenario = SCENARIOS[idx];
  const compiled = useMemo(() => compile(scenario.steps), [scenario]);
  const frame = frameAt(scenario, compiled.starts, compiled.total, seconds);

  // Los puntos del cursor dependen del tamaño: se recalculan al cambiar de escenario o de escala.
  useEffect(() => { points.current = {}; }, [idx, scale]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / VW);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escribe en el buscador de productos real (maneja su propio estado interno).
  useEffect(() => {
    const root = inner.current;
    if (!root) return;
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Buscar producto"]');
    if (input && input.value !== frame.sim.productSearch) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, frame.sim.productSearch);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  // Ubica el elemento real al que apunta el paso actual (para mover el cursor ahí).
  useLayoutEffect(() => {
    const root = inner.current;
    const target = frame.step.target;
    if (!root || !target) return;
    if (points.current[frame.i] && frame.p >= APPLY) return;
    const el = target(root);
    if (!el) return;
    ensureVisible(el, root);
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    const pt: [number, number] = [(r.left + r.width / 2 - b.left) / scale, (r.top + r.height / 2 - b.top) / scale];
    const old = points.current[frame.i];
    points.current[frame.i] = pt;
    if (!old || Math.abs(old[0] - pt[0]) + Math.abs(old[1] - pt[1]) > 2) bump((n) => n + 1);
  });

  const pointOf = (i: number): [number, number] => {
    for (let k = i; k >= 0; k--) if (points.current[k]) return points.current[k];
    return [VW / 2, VH / 2];
  };
  const from = frame.i > 0 ? pointOf(frame.i - 1) : pointOf(0);
  const to = frame.step.target ? pointOf(frame.i) : from;
  const m = ease(Math.min(1, frame.p / MOVE));
  const cursor: [number, number] = [from[0] + (to[0] - from[0]) * m, from[1] + (to[1] - from[1]) * m];
  const clicking = !!frame.step.click && frame.p >= MOVE && frame.p < MOVE + 0.15;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let paint = last;
    const tick = (now: number) => {
      time.current = Math.min(compiled.total, time.current + Math.min((now - last) / 1000, 0.1));
      last = now;
      if (now - paint >= 1000 / 30 || time.current >= compiled.total) { setSeconds(time.current); paint = now; }
      if (time.current >= compiled.total) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, compiled.total]);

  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  const seek = (v: number) => { time.current = v; setSeconds(v); };
  const pick = (i: number) => { setIdx(i); time.current = 0; setSeconds(0); setPlaying(true); };
  const replay = () => { seek(0); setPlaying(true); };
  const playPause = () => {
    if (playing) setPlaying(false);
    else { if (time.current >= compiled.total - 0.05) seek(0); setPlaying(true); }
  };

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    if (e.key === "Tab") {
      const items = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input[type=range]");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // El alto manda: la pantalla ocupa todo el alto libre del diálogo (lo demás es el borde, los subtítulos y los controles).
  const stageWidth = `min(100%, calc((100dvh - ${expanded ? 175 : 195}px) * ${VW / VH}))`;
  const b = "rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]";

  return createPortal(
    <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 backdrop-blur-[2px] ${expanded ? "p-0" : "p-2"}`} onClick={onClose}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={keys} onClick={(e) => e.stopPropagation()} className={`flex w-full flex-col overflow-hidden border border-[#edebe9] bg-white shadow-lg ${expanded ? "h-dvh max-h-dvh max-w-none rounded-none" : "max-h-[98dvh] max-w-[1600px] rounded-sm"}`}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#9F8351] bg-[#094732] px-4 py-2 text-white">
          <div className="min-w-0 shrink">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">Video tutorial · Punto de venta · datos de prueba</p>
            <h2 id={id} className="truncate text-base font-semibold leading-tight">{scenario.title}</h2>
          </div>
          <div className="mx-auto hidden min-w-0 flex-wrap items-center justify-center gap-1.5 md:flex" role="tablist" aria-label="Escenarios">
            {SCENARIOS.map((sc, i) => (
              <button key={sc.key} type="button" role="tab" aria-selected={i === idx} onClick={() => pick(i)} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition ${i === idx ? "border-[#d8c7a4] bg-white text-[#094732]" : "border-white/25 text-white/85 hover:bg-white/10"}`}>
                {i + 1}. {sc.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label={expanded ? "Reducir video" : "Pantalla completa"} title={expanded ? "Reducir" : "Pantalla completa"} onClick={() => setExpanded((v) => !v)} className="rounded-sm p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button ref={closeBtn} type="button" aria-label="Cerrar video" onClick={onClose} className="rounded-sm p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-3 py-2">
          {/* En pantallas angostas las pestañas de escenario no caben en la cabecera: van aquí. */}
          <div className="mb-2 flex flex-wrap gap-1.5 md:hidden" role="tablist" aria-label="Escenarios">
            {SCENARIOS.map((sc, i) => (
              <button key={sc.key} type="button" role="tab" aria-selected={i === idx} onClick={() => pick(i)} className={`${b} !px-2.5 !py-1.5 text-xs ${i === idx ? "!border-[#094732] !bg-[#eaf4ef] font-semibold text-[#094732]" : ""}`}>
                {i + 1}. {sc.label}
              </button>
            ))}
          </div>

          <div ref={stage} className="relative mx-auto overflow-hidden rounded-sm border border-[#dce5df] bg-[#f3f2f1]" style={{ aspectRatio: `${VW} / ${VH}`, width: stageWidth }}>
            {/* Pantalla virtual: el transform hace que el carrito (position: fixed) quede dentro de ella. */}
            <div
              ref={inner}
              inert
              className="pos-sim pointer-events-none absolute left-0 top-0 origin-top-left select-none overflow-hidden bg-[var(--ui-surface-muted)]"
              style={{ width: VW, height: VH, transform: `scale(${scale})` }}
            >
              <style>{`
                .pos-sim [role="dialog"] { max-height: ${VH}px !important; max-width: 32rem !important; }
                .pos-sim [class*="100dvh"] { max-height: ${VH - 330}px !important; }
              `}</style>
              <PosScreen key={scenario.key} sim={frame.sim} />
              <div className="absolute z-[80]" style={{ left: cursor[0], top: cursor[1] }}>
                {clicking && <span className="absolute -left-4 -top-4 h-8 w-8 animate-ping rounded-full bg-[#9F8351]/70" />}
                <MousePointer2 className="relative -translate-x-0.5 -translate-y-0.5 fill-[#094732] text-white drop-shadow-lg" style={{ width: 30, height: 30 }} />
              </div>
            </div>

          </div>

          {/* Subtítulo fuera de la pantalla, para no tapar el carrito ni los botones de cobro. */}
          <div className="mx-auto mt-2 flex min-h-11 items-center gap-3 rounded-sm border border-[#dce5df] bg-[#f6f8f6] px-4 py-2" style={{ width: stageWidth }}>
            <span className="shrink-0 rounded-sm bg-[#094732] px-2 py-0.5 text-[11px] font-semibold text-white">
              {frame.i + 1}/{scenario.steps.length}
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold text-[#094732] sm:text-base" aria-live="polite">{frame.step.cap}</p>
          </div>

          <div className="mx-auto mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3" style={{ width: stageWidth }}>
            <button type="button" className={`${b} shrink-0 !px-2.5 !py-1.5`} aria-label={playing ? "Pausar video" : "Reproducir video"} onClick={playPause}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <button type="button" className={`${b} shrink-0 !px-2.5 !py-1.5`} aria-label="Repetir video" onClick={replay}><RotateCcw size={17} /></button>
            <input aria-label="Progreso del video" type="range" min={0} max={compiled.total} step={0.1} value={seconds} onChange={(e) => seek(Number(e.target.value))} className="min-w-0 flex-1 accent-[#094732]" />
            <output className="shrink-0 text-xs tabular-nums text-[#605e5c]">{stamp(seconds)} / {stamp(compiled.total)}</output>
            <div className="ml-1 flex shrink-0 items-center gap-1.5">
              {idx > 0 && <button type="button" className={`${b} inline-flex items-center gap-1 !px-2.5 !py-1.5 text-xs`} onClick={() => pick(idx - 1)}><ChevronLeft size={14} />Anterior</button>}
              {idx < SCENARIOS.length - 1 && <button type="button" className={`${b} inline-flex items-center gap-1 !px-2.5 !py-1.5 text-xs`} onClick={() => pick(idx + 1)}>Siguiente<ChevronRight size={14} /></button>}
              <button type="button" className="rounded-sm bg-[#094732] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d5b40]" onClick={onClose}>Entendido</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
