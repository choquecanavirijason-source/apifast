import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DataTableAction } from "./DataTable";

interface Props<T> {
  actions: DataTableAction<T>[];
  item: T;
  anchorRect: DOMRect | null;
  onClose: () => void;
}

export function ActionDropdownMenu<T>({ actions, item, anchorRect, onClose }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 180,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !anchorRect) return;

    const menuRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offset = 8;

    let top = anchorRect.bottom + offset;
    let left = anchorRect.right - menuRect.width;

    if (top + menuRect.height > vh - offset) {
      top = anchorRect.top - menuRect.height - offset;
    }

    if (top < offset) {
      top = offset;
    }

    if (left + menuRect.width > vw - offset) {
      left = vw - menuRect.width - offset;
    }

    if (left < offset) {
      left = offset;
    }

    setPosition({ top, left, minWidth: Math.max(anchorRect.width, 180) });
  }, [actions.length, anchorRect]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    const handleViewportChange = () => onClose();
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[2147483647] max-h-72 overflow-y-auto rounded-md border border-slate-300/90 bg-white py-0.5 shadow-lg ring-1 ring-slate-200/50"
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
      }}
    >
      {actions.filter(a => !a.show || a.show(item)).map((action, idx) => (
        <button
          key={idx}
          onClick={() => { action.onClick(item); onClose(); }}
          className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-sky-50 ${
            action.variant === "danger" ? "text-red-600" : action.variant === "primary" ? "text-blue-600" : "text-slate-700"
          }`}
        >
          {action.icon} {action.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
