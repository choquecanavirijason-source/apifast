import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const variantClassMap: Record<ButtonVariant, string> = {
  /** Primario #094732 — acción principal */
  primary: "bg-brand text-white hover:bg-brand-hover",
  /** Secundario #9F8351 — acciones con tonalidad cálida */
  secondary: "bg-brand-secondary text-white hover:bg-brand-secondary-hover",
  /** Terciario #000000 — alto contraste */
  tertiary: "bg-brand-tertiary text-white hover:bg-brand-tertiary-muted",
  ghost: "text-brand-tertiary hover:bg-black/5",
  outline: "border border-brand-secondary bg-white text-brand-secondary hover:bg-brand-secondary/10",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClass} ${variantClassMap[variant]} ${sizeClassMap[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...rest}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  );
}