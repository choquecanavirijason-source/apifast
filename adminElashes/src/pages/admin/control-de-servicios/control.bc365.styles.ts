/** Tokens y clases Tailwind — paleta de marca (primary #094732, secondary #9F8351). */

export const BC = {
  pageBg: "var(--ui-canvas)",
  surface: "var(--ui-surface)",
  neutralSecondary: "var(--ui-surface-muted)",
  headerBg: "var(--ui-surface-muted)",
  border: "var(--ui-border)",
  borderStrong: "var(--ui-border-strong)",
  borderInput: "var(--ui-border-strong)",
  text: "var(--ui-text)",
  textSecondary: "var(--ui-text-muted)",
  textMuted: "var(--ui-text-muted)",
  textDisabled: "var(--ui-text-muted)",
  primary: "#094732",
  primaryHover: "#063324",
  primaryLight: "#d1e8df",
  warning: "#ca5010",
  success: "#107c10",
  danger: "#a4262c",
} as const;

export const BC_LABEL = "mb-1 block text-xs font-semibold text-[var(--ui-text-muted)]";

export const BC_FIELD =
  "w-full h-9 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 text-xs text-[var(--ui-text)] outline-none transition placeholder:text-[var(--ui-text-muted)] focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]";

export const BC_TEXTAREA =
  "w-full min-h-[88px] resize-y rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 py-2 text-xs text-[var(--ui-text)] outline-none transition placeholder:text-[var(--ui-text-muted)] focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";

export const BC_PAGE = "min-h-screen bg-[var(--ui-surface-muted)] font-sans";

export const BC_CONTAINER =
  "rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm";

export const BC_TITLE = "text-sm font-semibold text-[var(--ui-text)]";

export const BC_SUBTITLE = "text-xs text-[var(--ui-text-muted)]";

export const BC_BTN_PRIMARY =
  "!rounded-lg !border !border-[#094732] !bg-[#094732] !px-3 !py-1.5 !text-xs !font-semibold !text-white hover:!bg-[#063324] hover:!border-[#063324]";

export const BC_BTN_SECONDARY =
  "!rounded-lg !border !border-[var(--ui-border-strong)] !bg-[var(--ui-surface)] !px-3 !py-1.5 !text-xs !font-semibold !text-[var(--ui-text)] hover:!bg-[var(--ui-surface-hover)]";

export const BC_INFO_BOX =
  "rounded-lg border border-[#9F8351]/40 bg-[#9F8351]/8 px-3 py-2 text-sm text-[var(--ui-text)]";

export const BC_WARN_BOX =
  "rounded-lg border border-[#f4b8a0] bg-[#fff4f0] px-3 py-2 text-xs text-[#bc4b09]";
