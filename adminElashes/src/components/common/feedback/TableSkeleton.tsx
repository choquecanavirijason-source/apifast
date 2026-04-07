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
        <tr key={`skeleton-row-${rowIndex}`} className="animate-pulse">
          {Array.from({ length: totalColumns }).map((__, colIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-6 py-4">
              <div className="h-4 w-full rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
