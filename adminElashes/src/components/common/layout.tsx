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
  table: "bg-[#faf9f8] border border-[#d2d0ce]",
  cards: "bg-white border border-[#d2d0ce]",
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
    <div className={`min-h-screen bg-[#f3f2f1] px-2 py-1 font-sans md:px-3 md:py-2 ${pageClassName}`}>
      {(title || subtitle) && (
        <div className="mb-2 flex min-w-0 items-baseline gap-2 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
          {title && <h1 className="min-w-0 truncate text-base font-semibold leading-tight text-[#323130]">{title}</h1>}
          {title && subtitle ? <span className="text-xs text-[#a19f9d]">/</span> : null}
          {subtitle && (
            <p className="min-w-0 truncate whitespace-nowrap text-[11px] leading-tight text-[#605e5c]">{subtitle}</p>
          )}
        </div>
      )}

      <section className={`rounded-sm p-2 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${variantClass} ${containerClassName}`}>
        {topContent ? <div className="mb-2">{topContent}</div> : null}
        {toolbar ? <div className="mb-2">{toolbar}</div> : null}
        {children}
      </section>
    </div>
  );
}
