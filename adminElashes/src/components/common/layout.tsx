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
}: LayoutProps) {
  const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.table;

  return (
    <div className={`min-h-screen bg-slate-50 px-4 py-4 font-sans md:px-6 md:py-5 ${pageClassName}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex min-w-0 items-baseline gap-2.5">
          {title && <h1 className="min-w-0 text-lg font-semibold leading-tight text-slate-800">{title}</h1>}
          {title && subtitle ? <span className="text-slate-300">·</span> : null}
          {subtitle && (
            <p className="min-w-0 whitespace-nowrap text-sm leading-tight text-slate-400">{subtitle}</p>
          )}
        </div>
      )}

      <section className={`rounded-xl shadow-sm ${variantClass} ${containerClassName}`}>
        {topContent ? <div className="border-b border-slate-100 px-4 py-3">{topContent}</div> : null}
        {toolbar ? <div className="border-b border-slate-100 px-4 py-2.5">{toolbar}</div> : null}
        <div className="p-3 md:p-4">{children}</div>
      </section>
    </div>
  );
}
