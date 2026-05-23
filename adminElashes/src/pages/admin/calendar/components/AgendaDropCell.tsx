import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

type AgendaDropCellProps = {
  id: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

export default function AgendaDropCell({ id, children, className = "", onClick, onKeyDown }: AgendaDropCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={`${className} ${
        isOver ? "bg-[#deecf9] ring-2 ring-inset ring-[#0078d4]/45" : ""
      }`}
    >
      {children}
    </div>
  );
}
