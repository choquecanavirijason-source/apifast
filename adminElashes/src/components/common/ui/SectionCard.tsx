import type { ReactNode } from "react";

export type SectionCardVariant = "default" | "business";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Sobrescribe el estilo del header (ej. para quitar el acento dorado del variant "business" en una pantalla puntual). */
  headerClassName?: string;
  /** "business" = estilo tipo Dynamics/Business Central (paneles lisos, cabecera gris suave). */
  variant?: SectionCardVariant;
}

const shellClass: Record<SectionCardVariant, string> = {
  default: "rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm",
  business:
    "rounded-sm border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
};

const headerClass: Record<SectionCardVariant, string> = {
  default: "flex items-center justify-between gap-3 border-b border-[var(--ui-border)] px-3 py-2.5",
  business:
    "flex items-start justify-between gap-3 border-b border-brand-secondary/25 border-t-2 border-t-brand-secondary bg-[var(--ui-surface-muted)] px-4 py-3",
};

const titleClass: Record<SectionCardVariant, string> = {
  default: "text-sm font-semibold text-[var(--ui-text)]",
  business: "text-sm font-semibold text-[var(--ui-text)]",
};

const subtitleClass: Record<SectionCardVariant, string> = {
  default: "mt-0.5 text-xs text-[var(--ui-text-muted)]",
  business: "mt-0.5 text-xs text-[var(--ui-text-muted)]",
};

const bodyPad: Record<SectionCardVariant, string> = {
  default: "p-3",
  business: "p-4",
};

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
  headerClassName,
  variant = "default",
}: SectionCardProps) {
  const v = variant;
  return (
    <section className={`${shellClass[v]} ${className}`}>
      {(title || subtitle || actions) && (
        <header className={headerClassName ?? headerClass[v]}>
          <div>
            {title ? <h3 className={titleClass[v]}>{title}</h3> : null}
            {subtitle ? <p className={subtitleClass[v]}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={`${bodyPad[v]} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
