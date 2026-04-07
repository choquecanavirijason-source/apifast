type StatusBadgeProps = {
  status: string;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, string> = {
    cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
    card: "bg-blue-50 text-blue-700 border-blue-200",
    transfer: "bg-violet-50 text-violet-700 border-violet-200",
    qr: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const cls = map[status?.toLowerCase()] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    qr: "QR",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {labels[status?.toLowerCase()] ?? status}
    </span>
  );
}
