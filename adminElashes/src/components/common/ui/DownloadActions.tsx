import type { ReactNode } from "react";
import { Button } from "./index";
import { Download } from "lucide-react";

interface DownloadActionsProps {
  onExcel: () => void;
  onPdf: () => void;
  disabled?: boolean;
}

export default function DownloadActions({ onExcel, onPdf, disabled }: DownloadActionsProps) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={onExcel} disabled={disabled}>
        Excel
      </Button>
      <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={onPdf} disabled={disabled}>
        PDF
      </Button>
    </div>
  );
}
