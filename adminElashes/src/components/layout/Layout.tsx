import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import SidebarNavigation from "./SidebarNavigation";
import { LayoutProvider, useLayout } from "@/core/context/layout.context";

function AppShell() {
  const { layoutMode } = useLayout();

  // Modo sidebar: barra lateral a la izquierda y header + contenido a la derecha.
  // Modo top: header (con la navegación horizontal) arriba y contenido debajo.
  return (
    <div className={`app-layout ${layoutMode === "sidebar" ? "md:flex-row!" : ""}`}>
      <SidebarNavigation />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />

        <div className="app-shell-body">
          <main className="main" id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();

  const isPosTrackingFullscreen = location.pathname.startsWith(
    "/admin/pos-tracking",
  );

  if (isPosTrackingFullscreen) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <LayoutProvider>
      <AppShell />
    </LayoutProvider>
  );
}
