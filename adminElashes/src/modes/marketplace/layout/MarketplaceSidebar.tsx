import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  Settings,
  ChevronDown,
  PackageSearch,
  Download,
  ClipboardList,
  Warehouse,
  Megaphone,
  Clapperboard,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLogo } from "@/core/hooks/useLogo";

type SubItem = { name: string; path: string };
type MenuItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
};

const MENU: MenuItem[] = [
  {
    name: "Dashboard",
    icon: <LayoutDashboard size={20} />,
    path: "/marketplace",
  },
  {
    name: "Productos",
    icon: <ShoppingBag size={20} />,
    path: "/marketplace/products",
  },
  {
    name: "Categorías",
    icon: <Tag size={20} />,
    path: "/marketplace/categories",
  },
  {
    name: "Publicidad",
    icon: <Megaphone size={20} />,
    path: "/marketplace/ads",
  },
  {
    name: "Reels",
    icon: <Clapperboard size={20} />,
    path: "/marketplace/reels",
  },
  {
    name: "Pedidos",
    icon: <ClipboardList size={20} />,
    path: "/marketplace/orders",
  },
  {
    name: "Clientes",
    icon: <Users size={20} />,
    path: "/marketplace/customers",
  },
  {
    name: "Importar Inventario",
    icon: <Download size={20} />,
    path: "/marketplace/import-inventory",
  },
  {
    name: "Inventario General",
    icon: <Warehouse size={20} />,
    path: "/marketplace/inventory",
  },
  {
    name: "Catálogo",
    icon: <PackageSearch size={20} />,
    path: "/marketplace/catalog",
  },
  {
    name: "Configuración",
    icon: <Settings size={20} />,
    path: "/marketplace/settings",
  },
];

const navFocusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1a2e]";

export default function MarketplaceSidebar({ collapsed, pendingOrders = 0 }: { collapsed: boolean; pendingOrders?: number }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const location = useLocation();
  const { logoBase64 } = useLogo();

  useEffect(() => {
    const match = MENU.find((item) =>
      item.subItems?.some((sub) => location.pathname.startsWith(sub.path))
    );
    if (match) setOpenMenu(match.name);
  }, [location.pathname]);

  return (
    <aside
      className={`relative z-20 isolate h-screen flex flex-col transition-all duration-300 border-r border-blue-900/30 shrink-0 ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ background: "linear-gradient(180deg, #0f1a2e 0%, #060d1a 100%)" }}
    >
      {/* Logo + badge */}
      <div className="h-20 flex items-center justify-center px-4 border-b border-blue-800/30 shrink-0 relative">
        {logoBase64 ? (
          collapsed ? (
            <img src={logoBase64} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
          ) : (
            <img src={logoBase64} alt="Logo" className="h-16 max-w-48 object-contain" />
          )
        ) : (
          <>
            {!collapsed && <span className="text-2xl font-black text-white tracking-tight">Market-place</span>}
            {collapsed && <span className="mx-auto text-base font-black text-blue-400">M</span>}
          </>
        )}
        {!collapsed && (
          <span className="absolute top-3 right-3 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full leading-none">
            MARKET
          </span>
        )}
      </div>

      {/* Nav */}
      <nav
        aria-label="Menú marketplace"
        className={`flex-1 py-4 px-3 space-y-1 ${collapsed ? "overflow-visible" : "overflow-y-auto"}
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-blue-700/40
          [&::-webkit-scrollbar-thumb]:rounded-full
        `}
      >
        {MENU.map((item) => (
          <div key={item.name} className="relative">
            {item.subItems ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === item.name ? null : item.name)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${navFocusRing} ${
                    item.subItems.some((s) => location.pathname.startsWith(s.path))
                      ? "bg-blue-800/40 text-white"
                      : "text-blue-100/70 hover:bg-blue-900/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400">{item.icon}</span>
                    {!collapsed && <span className="text-sm font-semibold">{item.name}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${openMenu === item.name ? "rotate-180" : ""}`}
                    />
                  )}
                </button>

                {openMenu === item.name && !collapsed && (
                  <div className="ml-4 pl-4 border-l border-blue-800/50 space-y-1">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        end
                        className={({ isActive }) =>
                          `block px-3 py-2 text-xs rounded-lg outline-none ${navFocusRing} ${
                            isActive
                              ? "text-white bg-blue-700"
                              : "text-blue-100/80 hover:bg-blue-900/40 hover:text-white"
                          }`
                        }
                      >
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}

                {openMenu === item.name && collapsed && (
                  <div className="absolute left-full top-0 z-50 ml-2 w-56 overflow-hidden rounded-xl border border-blue-700/40 bg-[#0f1a2e] shadow-2xl">
                    <div className="border-b border-blue-800/40 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-blue-300/90">{item.name}</p>
                    </div>
                    <div className="p-2">
                      {item.subItems.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          end
                          onClick={() => setOpenMenu(null)}
                          className={({ isActive }) =>
                            `mb-1 block rounded-lg px-3 py-2 text-xs transition ${navFocusRing} ${
                              isActive
                                ? "bg-blue-700/70 text-white"
                                : "text-blue-100/80 hover:bg-blue-800/50 hover:text-white"
                            }`
                          }
                        >
                          {sub.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.path!}
                end={item.path === "/marketplace"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl outline-none transition-all ${navFocusRing} ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                      : "text-blue-100/70 hover:bg-blue-900/30 hover:text-white"
                  }`
                }
              >
                <span className="shrink-0 relative">
                  {item.icon}
                  {item.name === "Pedidos" && pendingOrders > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none">
                      {pendingOrders > 9 ? "9+" : pendingOrders}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <span className="flex flex-1 items-center justify-between text-sm font-medium">
                    {item.name}
                    {item.name === "Pedidos" && pendingOrders > 0 && (
                      <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                        {pendingOrders}
                      </span>
                    )}
                  </span>
                )}
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom label */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-blue-900/30">
          <p className="text-[10px] text-blue-400/50 font-medium uppercase tracking-widest">
            Marketplace Admin
          </p>
        </div>
      )}
    </aside>
  );
}
