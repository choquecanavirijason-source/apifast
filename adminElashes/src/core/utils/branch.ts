const STORAGE_KEY = "selected_branch_id";
const BRANCH_ALL_VALUE = "all";

export const getSelectedBranchId = (): number | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw || raw === BRANCH_ALL_VALUE) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const setSelectedBranchId = (value: number | null) => {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.setItem(STORAGE_KEY, BRANCH_ALL_VALUE);
    window.dispatchEvent(new Event("branchchange"));
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event("branchchange"));
};

export const BRANCH_STORAGE_KEY = STORAGE_KEY;
