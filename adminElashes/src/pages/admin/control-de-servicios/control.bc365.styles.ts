/** Tokens y clases Tailwind — design system del proyecto (slate palette). */

export const BC = {
  pageBg: "#f0f0f3",
  surface: "#ffffff",
  neutralSecondary: "#f8fafc",
  headerBg: "#f1f5f9",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  borderInput: "#94a3b8",
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textDisabled: "#cbd5e1",
  primary: "#3b82f6",
  primaryHover: "#2563eb",
  primaryLight: "#eff6ff",
  warning: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
} as const;

export const BC_LABEL = "mb-1 block text-xs font-semibold text-slate-500";

export const BC_FIELD =
  "w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:bg-slate-50 disabled:text-slate-400";

export const BC_TEXTAREA =
  "w-full min-h-[88px] resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

export const BC_PAGE = "min-h-screen bg-[#f0f0f3] font-sans";

export const BC_CONTAINER =
  "rounded-xl border border-slate-200 bg-white shadow-sm";

export const BC_TITLE = "text-lg font-semibold text-slate-900";

export const BC_SUBTITLE = "text-sm text-slate-500";

export const BC_BTN_PRIMARY =
  "!rounded-lg !border !border-blue-500 !bg-blue-500 !px-3 !py-1.5 !text-xs !font-semibold !text-white hover:!bg-blue-600 hover:!border-blue-600 transition-colors";

export const BC_BTN_SECONDARY =
  "!rounded-lg !border !border-slate-300 !bg-white !px-3 !py-1.5 !text-xs !font-semibold !text-slate-700 hover:!bg-slate-50 transition-colors";

export const BC_INFO_BOX =
  "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-700";

export const BC_WARN_BOX =
  "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700";
