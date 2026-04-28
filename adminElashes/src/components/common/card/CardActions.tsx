import React from "react";

export interface CardActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CardActions: Contenedor para botones/acciones en la parte inferior o superior de la Card.
 */
export const CardActions: React.FC<CardActionsProps> = ({ children, className = "" }) => (
  <div className={"flex gap-2 mt-auto "+className}>{children}</div>
);

export default CardActions;
