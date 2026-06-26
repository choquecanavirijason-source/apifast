/** Tokens y clases Tailwind — paleta de marca (primary #094732, secondary #9F8351). */

export const BC = {
  pageBg: "#f3f2f1",
  surface: "#ffffff",
  neutralSecondary: "#faf9f8",
  headerBg: "#f3f2f1",
  border: "#edebe9",
  borderStrong: "#c8c6c4",
  borderInput: "#8a8886",
  text: "#323130",
  textSecondary: "#605e5c",
  textMuted: "#8a8886",
  textDisabled: "#a19f9d",
  primary: "#094732",
  primaryHover: "#063324",
  primaryLight: "#d1e8df",
  warning: "#ca5010",
  success: "#107c10",
  danger: "#a4262c",
} as const;

export const BC_LABEL = "mb-1 block text-xs font-semibold text-[#605e5c]";

export const BC_FIELD =
  "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

export const BC_TEXTAREA =
  "w-full min-h-[88px] resize-y rounded-sm border border-[#8a8886] bg-white px-2.5 py-2 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35";

export const BC_PAGE = "min-h-screen bg-[#f3f2f1] font-sans";

export const BC_CONTAINER =
  "rounded-sm border border-[#c8c6c4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]";

export const BC_TITLE = "text-lg font-semibold text-[#201f1e]";

export const BC_SUBTITLE = "text-sm text-[#605e5c]";

export const BC_BTN_PRIMARY =
  "!rounded-sm !border !border-[#094732] !bg-[#094732] !px-3 !py-1.5 !text-xs !font-semibold !text-white hover:!bg-[#063324] hover:!border-[#063324]";

export const BC_BTN_SECONDARY =
  "!rounded-sm !border !border-[#8a8886] !bg-white !px-3 !py-1.5 !text-xs !font-semibold !text-[#323130] hover:!bg-[#f3f2f1]";

export const BC_INFO_BOX =
  "border border-[#9F8351]/40 bg-[#fdf8f0] px-3 py-2 text-sm text-[#323130]";

export const BC_WARN_BOX =
  "border border-[#f4b8a0] bg-[#fff4f0] px-3 py-2 text-xs text-[#bc4b09]";
