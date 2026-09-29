import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";

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
    <div className="app-layout">
      <Header />

      <div className="app-shell-body">
        <main className="main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
