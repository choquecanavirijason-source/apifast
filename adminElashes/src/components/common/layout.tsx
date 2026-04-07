import type { ReactNode } from "react";

type LayoutVariant = "table" | "cards";

interface LayoutProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  toolbar?: ReactNode;
  topContent?: ReactNode;
  variant?: LayoutVariant;
  pageClassName?: string;
  containerClassName?: string;
}

const VARIANT_STYLES: Record<LayoutVariant, string> = {
  table: "bg-emerald-50/40 border border-emerald-100",
  cards: "bg-white border border-slate-200",
};

export default function Layout({
  title,
  subtitle,
  children,
  toolbar,
  topContent,
  variant = "table",
  pageClassName = "",
  containerClassName = "",
}: LayoutProps) {
  const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.table;

  return (
    <div className={`min-h-screen bg-slate-50/50 px-2 py-1 font-sans md:px-3 md:py-2 ${pageClassName}`}>
      {(title || subtitle) && (
        <div className="mb-2 flex min-w-0 items-baseline gap-2">
          {title && <h1 className="min-w-0 truncate text-base font-semibold leading-tight text-slate-800">{title}</h1>}
          {title && subtitle ? <span className="text-xs text-slate-400">/</span> : null}
          {subtitle && (
            <p className="min-w-0 truncate whitespace-nowrap text-[11px] leading-tight text-slate-500">{subtitle}</p>
          )}
        </div>
      )}

      <section className={`rounded-lg p-2 md:p-3 ${variantClass} ${containerClassName}`}>
        {topContent ? <div className="mb-2">{topContent}</div> : null}
        {toolbar ? <div className="mb-2">{toolbar}</div> : null}
        {children}
      </section>
    </div>
  );
}
