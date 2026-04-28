import React from "react";

export interface CardImageProps {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * CardImage: Imagen para usar dentro de Card, con fallback opcional.
 */
export const CardImage: React.FC<CardImageProps> = ({ src, alt = "", fallback, className = "" }) => {
  if (!src) {
    return fallback ? (
      <div className={"flex flex-col items-center gap-2 text-slate-300 "+className}>{fallback}</div>
    ) : null;
  }
  return (
    <img src={src} alt={alt} className={"w-full h-full object-cover "+className} />
  );
};

export default CardImage;
