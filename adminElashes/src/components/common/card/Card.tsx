import React from "react";

export interface CardProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Card: Contenedor visual reutilizable con borde, sombra y padding.
 * Puedes extenderlo con props adicionales según necesidad.
 */
export const Card: React.FC<CardProps> = ({ className = "", children }) => (
  <div
    className={
      `bg-white rounded-2xl p-4 border border-slate-200 shadow-sm transition-all duration-300 ${className}`
    }
  >
    {children}
  </div>
);

export default Card;
