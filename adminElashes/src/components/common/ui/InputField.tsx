import type { InputHTMLAttributes, ReactNode } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  containerClassName?: string;
}

export default function InputField({
  label,
  hint,
  error,
  leftIcon,
  rightElement,
  containerClassName = "",
  className = "",
  id,
  ...rest
}: InputFieldProps) {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </span>
        ) : null}

        <input
          id={id}
          className={`w-full rounded-xl border bg-white py-2 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:ring-2 ${
            error
              ? "border-rose-300 pr-3 pl-3 focus:border-rose-500 focus:ring-rose-500/20"
              : "border-slate-300 pr-3 pl-3 focus:border-[#094732] focus:ring-[#094732]/20"
          } ${leftIcon ? "pl-10" : ""} ${rightElement ? "pr-10" : ""} ${className}`}
          {...rest}
        />

        {rightElement ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{rightElement}</span>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
