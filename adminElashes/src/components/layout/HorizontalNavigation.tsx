import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { isRouteActive, useNavigationGroups } from "./navigation.config";

export default function HorizontalNavigation() {
  const location = useLocation();
  const navigationRef = useRef<HTMLElement | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groups = useNavigationGroups();

  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (
        navigationRef.current &&
        !navigationRef.current.contains(event.target as Node)
      ) {
        setOpenGroup(null);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return (
    <nav
      ref={navigationRef}
      aria-label="Navegación principal"
      className="relative z-[70] h-14 shrink-0 border-t border-white/8 border-b border-black/15 bg-[#094732] px-2 shadow-[0_7px_22px_rgba(3,38,26,0.2)] sm:px-4"
    >
      <div className="flex h-full items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] xl:overflow-visible [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const active = group.path
            ? isRouteActive(location.pathname, group.path, group.exact)
            : Boolean(
                group.children?.some((child) =>
                  isRouteActive(location.pathname, child.path, child.exact),
                ),
              );
          const open = openGroup === group.label;

          if (group.path) {
            return (
              <NavLink
                key={group.label}
                to={group.path}
                end={group.exact}
                className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/30 ${
                  active
                    ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    : "text-emerald-50/72 hover:bg-white/9 hover:text-white"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
                <span>{group.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-[#9F8351]" />
                )}
              </NavLink>
            );
          }

          return (
            <div key={group.label} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
                aria-expanded={open}
                aria-haspopup="menu"
                className={`relative inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/30 ${
                  active || open
                    ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    : "text-emerald-50/72 hover:bg-white/9 hover:text-white"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
                <span>{group.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
                {active && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-[#9F8351]" />
                )}
              </button>

              {open && group.children && (
                <div
                  role="menu"
                  aria-label={group.label}
                  className="fixed left-3 right-3 top-[6.75rem] z-[90] rounded-xl border border-[#094732]/12 bg-white/98 p-1.5 shadow-[0_18px_50px_rgba(9,40,29,0.18)] backdrop-blur-xl xl:absolute xl:left-0 xl:right-auto xl:top-[calc(100%+10px)] xl:w-80"
                >
                  <div className="mb-1 px-2.5 pb-1.5 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9F8351]">
                      {group.label}
                    </p>
                  </div>
                  {group.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isRouteActive(
                      location.pathname,
                      child.path,
                      child.exact,
                    );
                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end={child.exact}
                        role="menuitem"
                        onClick={() => setOpenGroup(null)}
                        className={`group/item relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/25 ${
                          childActive
                            ? "bg-[#edf6f1] text-[#094732]"
                            : "text-[#313833] hover:bg-[#094732]/5"
                        }`}
                      >
                        {childActive && (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#9F8351]" />
                        )}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            childActive
                              ? "border-[#094732]/15 bg-white text-[#094732]"
                              : "border-black/6 bg-[#f7f8f7] text-[#6b746e] group-hover/item:text-[#094732]"
                          }`}
                        >
                          <ChildIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold">
                            {child.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-medium text-[#7c857f]">
                            {child.description}
                          </span>
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
