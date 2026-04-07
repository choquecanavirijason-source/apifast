const STORAGE_KEY = "selected_branch_id";

export const getSelectedBranchId = (): number | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const setSelectedBranchId = (value: number | null) => {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("branchchange"));
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event("branchchange"));
};

export const BRANCH_STORAGE_KEY = STORAGE_KEY;
