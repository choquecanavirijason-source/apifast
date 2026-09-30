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
  table: "bg-[var(--ui-surface)] border border-[var(--ui-border)]",
  cards: "bg-[var(--ui-surface)] border border-[var(--ui-border)]",
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
    

      <section className={`rounded-lg shadow-sm ${variantClass} ${containerClassName}`}>
        {topContent ? <div className="border-b border-[var(--ui-border)] px-3 py-2">{topContent}</div> : null}
        {toolbar ? <div className="border-b border-[var(--ui-border)] px-3 py-2">{toolbar}</div> : null}
        <div className={contentClassName ?? "p-2 md:p-3"}>{children}</div>
      </section>
    </div>
  );
}
