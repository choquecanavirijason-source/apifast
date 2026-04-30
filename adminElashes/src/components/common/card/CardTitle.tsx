import React from "react";

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CardTitle: Título destacado para usar dentro de Card.
 */
export const CardTitle: React.FC<CardTitleProps> = ({ children, className = "" }) => (
  <span className={"font-bold text-slate-700 text-lg "+className}>{children}</span>
);

export default CardTitle;
