export type PosProfile = {
  id: number;
  role?: string | { name?: string } | null;
  branch_id?: number | null;
  effective_branch_id?: number | null;
};

export const isMultibranch = (profile: PosProfile) => {
  const role = typeof profile.role === "string" ? profile.role : profile.role?.name;
  return !!role && ["Admin", "SuperAdmin", "Secretaria"].includes(role);
};

export const posDraftKey = (userId: number, branchId: number | null) =>
  `pos-sale-draft-v2:${userId}:${branchId ?? "all"}`;

export function persistPosDraft(storage: Pick<Storage, "setItem" | "removeItem">, key: string,
  hydratedKey: string | null, draft: unknown, empty: boolean) {
  if (key !== hydratedKey) return;
  if (empty) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(draft));
}

/** POS-only state. A failed verification never changes the active draft scope. */
export class PosContext {
  state = { branchId: null as number | null, pendingBranchId: null as number | null,
    initialized: false, changed: false, verified: false, multibranch: false, busy: false, error: "" };
  private listeners = new Set<() => void>();
  private request: Promise<boolean> | null = null;
  private generation = 0;
  private locked = false;
  private refreshAfterWrite = false;
  private userId: number;
  private load: () => Promise<PosProfile>;
  private selected: () => number | null;
  constructor(userId: number, load: () => Promise<PosProfile>, selected: () => number | null) {
    this.userId = userId;
    this.load = load;
    this.selected = selected;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  invalidate() {
    this.generation++;
    this.request = null;
    this.update({ verified: false });
  }
  refresh = (duringWrite = false): Promise<boolean> => {
    if (this.locked && !duringWrite) { this.refreshAfterWrite = true; return Promise.resolve(false); }
    if (this.request) return this.request;
    const generation = this.generation;
    const request = Promise.resolve().then(this.load).then(profile => {
      if (generation !== this.generation) return false;
      if (profile.id !== this.userId) throw new Error("La sesión del usuario cambió.");
      const multibranch = isMultibranch(profile);
      const branchId = multibranch ? this.selected() : profile.effective_branch_id ?? null;
      if (!multibranch && !branchId) throw new Error("El usuario no tiene sucursal efectiva.");
      const changed = this.state.initialized && branchId !== this.state.branchId;
      this.update({ multibranch, verified: true, error: "", initialized: true,
        ...(this.state.initialized ? {} : { branchId }), changed, pendingBranchId: branchId });
      return true;
    }).catch(() => {
      if (generation === this.generation) this.update({ verified: false,
        error: "No se pudo verificar la sucursal. Reintenta antes de operar." });
      return false;
    }).finally(() => { if (this.request === request) this.request = null; });
    this.request = request;
    return request;
  };
  acceptChange = () => {
    if (this.locked || !this.state.verified || !this.state.changed) return;
    this.update({ branchId: this.state.pendingBranchId, changed: false });
  };
  runWrite = async <T>(operation: () => Promise<T>, expectedBranch = this.state.branchId): Promise<T | undefined> => {
    // Set before the first await: two clicks cannot both start verification.
    if (this.locked) return;
    this.locked = true;
    this.update({ busy: true });
    const generation = this.generation;
    try {
      if (!(await this.refresh(true)) || generation !== this.generation || this.state.changed ||
          this.state.branchId !== expectedBranch || !this.state.branchId) {
        throw new Error(this.state.error || "La sucursal cambió. Actualiza el contexto antes de continuar.");
      }
      return await operation();
    } finally {
      this.locked = false;
      this.update({ busy: false });
      if (this.refreshAfterWrite && generation === this.generation) {
        this.refreshAfterWrite = false;
        void this.refresh();
      }
    }
  };
}
