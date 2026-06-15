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
  /** Override the default "p-2 md:p-3" on the children wrapper. Useful for pages
   *  that need the content to fill remaining height (e.g. POS uses "flex-1 min-h-0 overflow-hidden"). */
  contentClassName?: string;
}

const VARIANT_STYLES: Record<LayoutVariant, string> = {
  table: "bg-white border border-slate-200",
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
  contentClassName,
}: LayoutProps) {
  const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.table;

  return (
    <div className={`font-sans ${pageClassName}`}>
      {(title || subtitle) && (
        <div className="mb-2 flex min-w-0 items-baseline gap-2">
          {title && <h1 className="min-w-0 text-base font-semibold leading-tight text-slate-800">{title}</h1>}
          {title && subtitle ? <span className="text-slate-300">·</span> : null}
          {subtitle && (
            <p className="min-w-0 truncate text-xs leading-tight text-slate-400">{subtitle}</p>
          )}
        </div>
      )}

      <section className={`rounded-lg shadow-sm ${variantClass} ${containerClassName}`}>
        {topContent ? <div className="border-b border-slate-100 px-3 py-2">{topContent}</div> : null}
        {toolbar ? <div className="border-b border-slate-100 px-3 py-2">{toolbar}</div> : null}
        <div className={contentClassName ?? "p-2 md:p-3"}>{children}</div>
      </section>
    </div>
  );
}
