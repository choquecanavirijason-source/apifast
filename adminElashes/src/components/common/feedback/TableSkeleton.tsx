interface TableSkeletonProps {
  rows?: number;
  columns: number;
  showActions?: boolean;
}

export default function TableSkeleton({
  rows = 6,
  columns,
  showActions = false,
}: TableSkeletonProps) {
  const totalColumns = columns + (showActions ? 1 : 0);

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr
          key={`skeleton-row-${rowIndex}`}
          className={`animate-pulse ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}
        >
          {Array.from({ length: totalColumns }).map((__, colIndex) => (
            <td
              key={`skeleton-cell-${rowIndex}-${colIndex}`}
              className="border-b border-r border-slate-200/90 px-2.5 py-2 last:border-r-0"
            >
              <div className="h-3.5 w-full max-w-[12rem] rounded-sm bg-slate-200/80" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
