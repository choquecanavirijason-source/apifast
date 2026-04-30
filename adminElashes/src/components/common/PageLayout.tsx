import React from "react";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode; // Cambiado de 'toolbar' para alinearse a BC
  className?: string;
}

/**
 * PageLayout: Estética inspirada en Dynamics 365 Business Central
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  icon,
  children,
  actions,
  className = "",
}) => (
  <div className={`flex flex-col min-h-screen bg-[#f3f2f1] font-sans ${className}`}>
    
    {/* Header / Banner de Título */}
    <header className="bg-white border-b border-slate-200 px-6 py-4 md:px-12">
      <div className="flex items-center gap-4 max-w-[1600px] mx-auto">
        {icon && (
          <div className="text-emerald-600">
            {icon}
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </header>

    {/* Barra de Acciones (Ribbon) */}
    {actions && (
      <nav className="bg-white border-b border-slate-200 px-6 py-2 md:px-12 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-2 max-w-[1600px] mx-auto">
          {actions}
        </div>
      </nav>
    )}

    {/* Área de Contenido */}
    <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm p-4 md:p-6">
        {children}
      </div>
    </main>

  </div>
);

export default PageLayout;