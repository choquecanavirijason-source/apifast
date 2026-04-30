import type { ReactNode } from "react";

export type SectionCardVariant = "default" | "business";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** "business" = estilo tipo Dynamics/Business Central (paneles lisos, cabecera gris suave). */
  variant?: SectionCardVariant;
}

const shellClass: Record<SectionCardVariant, string> = {
  default: "rounded-2xl border border-slate-200 bg-white shadow-sm",
  business:
    "rounded-sm border border-[#edebe9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
};

const headerClass: Record<SectionCardVariant, string> = {
  default: "flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4",
  business:
    "flex items-start justify-between gap-3 border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3",
};

const titleClass: Record<SectionCardVariant, string> = {
  default: "text-base font-bold text-slate-800",
  business: "text-sm font-semibold text-[#323130]",
};

const subtitleClass: Record<SectionCardVariant, string> = {
  default: "mt-1 text-sm text-slate-500",
  business: "mt-0.5 text-xs text-[#605e5c]",
};

const bodyPad: Record<SectionCardVariant, string> = {
  default: "p-1",
  business: "p-4",
};

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
  variant = "default",
}: SectionCardProps) {
  const v = variant;
  return (
    <section className={`${shellClass[v]} ${className}`}>
      {(title || subtitle || actions) && (
        <header className={headerClass[v]}>
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
