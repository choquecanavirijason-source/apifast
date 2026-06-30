import React from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import MarketplaceSidebar from "./MarketplaceSidebar";
import ModeSwitch from "@/components/layout/ModeSwitch";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

export default function MarketplaceLayout() {
  const [collapsed, setCollapsed] = React.useState(false);
  const user = useSelector((s: RootState) => s.auth.user as { name?: string; email?: string } | null);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <MarketplaceSidebar collapsed={collapsed} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header marketplace */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-blue-900/50 bg-[#0f1a2e] shadow-lg z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-2 rounded-lg text-blue-300 hover:bg-white/10 transition"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-white/80 hidden sm:block">
              Gestión Marketplace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ModeSwitch />

            {/* User avatar */}
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-blue-800/60">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-800">
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </div>
                <span className="text-xs text-blue-200 hidden md:block truncate max-w-[100px]">
                  {user.name ?? user.email}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
