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
  default: "rounded-xl border border-slate-200 bg-white shadow-sm",
  business:
    "rounded-sm border border-[#edebe9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
};

const headerClass: Record<SectionCardVariant, string> = {
  default: "flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5",
  business:
    "flex items-start justify-between gap-3 border-b border-brand-secondary/25 border-t-2 border-t-brand-secondary bg-[#faf9f8] px-4 py-3",
};

const titleClass: Record<SectionCardVariant, string> = {
  default: "text-sm font-semibold text-brand-tertiary",
  business: "text-sm font-semibold text-brand-tertiary",
};

const subtitleClass: Record<SectionCardVariant, string> = {
  default: "mt-0.5 text-xs text-brand-secondary",
  business: "mt-0.5 text-xs text-brand-secondary",
};

const bodyPad: Record<SectionCardVariant, string> = {
  default: "p-4",
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
