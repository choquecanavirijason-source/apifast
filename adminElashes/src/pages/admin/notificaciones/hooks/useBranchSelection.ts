import { useEffect, useState } from "react";
import { BranchService } from "@/core/services/branch/branch.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "@/core/utils/branch";

export interface BranchOption {
  id: number;
  name: string;
}

export interface BranchSelection {
  branchId: number | null;
  setBranchId: (value: number | null) => void;
  branches: BranchOption[];
}

/** Misma sucursal que el selector global de la cabecera, en ambos sentidos.
 *  La lista de sucursales solo se pide si el rol puede elegir. */
export function useBranchSelection(canChoose: boolean): BranchSelection {
  const [branchId, setBranchIdState] = useState<number | null>(() => getSelectedBranchId());
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const setBranchId = (value: number | null) => {
    setSelectedBranchId(value);
    setBranchIdState(value);
  };

  useEffect(() => {
    const handleChange = () => setBranchIdState(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) handleChange();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!canChoose) return;
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, [canChoose]);

  return { branchId, setBranchId, branches };
}
