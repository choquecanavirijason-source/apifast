import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  isRouteActive,
  useIsGroupActive,
  useNavigationGroups,
  type NavigationGroup,
} from "./navigation.config";

interface NavigationListProps {
  /** Se llama al elegir una página (el menú móvil lo usa para cerrarse). */
  onNavigate?: () => void;
  /** Modo barra lateral: los textos se ocultan cuando está colapsada. */
  rail?: boolean;
  /** Con `rail`: true = sidebar fijo (textos visibles); false = solo iconos hasta pasar el mouse. */
  railExpanded?: boolean;
}

// En modo colapsado los textos se ocultan y aparecen al pasar el mouse sobre el <aside> (group/rail).
// Las clases van completas para que Tailwind las detecte.
const RAIL_TEXT = {
  wide: {
    expanded: "max-w-40 opacity-100",
    collapsed: "max-w-0 opacity-0 transition-all duration-300 group-hover/rail:max-w-40 group-hover/rail:opacity-100",
  },
  narrow: {
    expanded: "max-w-36 opacity-100",
    collapsed: "max-w-0 opacity-0 transition-all duration-300 group-hover/rail:max-w-36 group-hover/rail:opacity-100",
  },
};

const railText = (rail: boolean, expanded: boolean, size: keyof typeof RAIL_TEXT) =>
  !rail ? "" : RAIL_TEXT[size][expanded ? "expanded" : "collapsed"];

const itemBase =
  "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30";
const itemIdle = "text-emerald-50/72 hover:bg-white/9 hover:text-white";
const itemActive = "bg-white/14 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]";

/** Lista de navegación vertical (barra lateral y menú móvil), con secciones y submenús desplegables. */
export default function NavigationList({ onNavigate, rail = false, railExpanded = false }: NavigationListProps) {
  const groups = useNavigationGroups();
  const sections = groups.reduce<{ name: string; groups: NavigationGroup[] }[]>((acc, group) => {
    const current = acc.find((section) => section.name === group.section);
    if (current) current.groups.push(group);
    else acc.push({ name: group.section, groups: [group] });
    return acc;
  }, []);

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.name} className="flex flex-col gap-1">
          <p
            className={`truncate px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#c4b08a]/80 ${
              rail && !railExpanded ? "opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100" : ""
            }`}
          >
            {section.name}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.groups.map((group) => (
              <NavigationItem
                key={group.label}
                group={group}
                onNavigate={onNavigate}
                rail={rail}
                railExpanded={railExpanded}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavigationItem({
  group,
  onNavigate,
  rail,
  railExpanded,
}: {
  group: NavigationGroup;
  onNavigate?: () => void;
  rail: boolean;
  railExpanded: boolean;
}) {
  const location = useLocation();
  const isGroupActive = useIsGroupActive();
  const active = isGroupActive(group);
  const [open, setOpen] = useState(active);
  const Icon = group.icon;

  if (group.path || !group.children?.length) {
    return (
      <NavLink
        to={group.path ?? "/"}
        end={group.exact}
        onClick={onNavigate}
        title={rail && !railExpanded ? group.label : undefined}
        className={`${itemBase} ${active ? itemActive : itemIdle}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className={`truncate ${railText(rail, railExpanded, "wide")}`}>{group.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={rail && !railExpanded ? group.label : undefined}
        className={`${itemBase} justify-between ${active ? "font-semibold text-white" : itemIdle}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0" />
          <span className={`truncate text-left ${railText(rail, railExpanded, "narrow")}`}>{group.label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-emerald-50/55 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"} ${
            rail && !railExpanded ? "opacity-0 group-hover/rail:opacity-100" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`ml-4 flex flex-col gap-0.5 border-l border-white/12 py-1 pl-2.5 ${
            rail && !railExpanded ? "hidden group-hover/rail:flex" : ""
          }`}
        >
          {group.children.map((child) => {
            const childActive = isRouteActive(location.pathname, child.path, child.exact);
            const ChildIcon = child.icon;
            return (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.exact}
                onClick={onNavigate}
                className={`relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  childActive
                    ? "bg-white/14 font-semibold text-white"
                    : "text-emerald-50/65 hover:bg-white/9 hover:text-white"
                }`}
              >
                {childActive && <span className="absolute inset-y-1.5 -left-[11px] w-0.5 rounded-full bg-[#9F8351]" />}
                <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span className="truncate">{child.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
