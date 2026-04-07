import { AlertTriangle, ArrowLeft, House } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("access_token") || localStorage.getItem("token"));

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(hasToken ? "/" : "/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Error 404</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-800">Pagina no encontrada</h1>
        <p className="mt-3 text-sm text-slate-500">
          Lo sentimos, la ruta que intentas abrir no existe o fue movida.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver atras
          </button>

          <button
            type="button"
            onClick={() => navigate(hasToken ? "/" : "/login", { replace: true })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#094732] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#063324]"
          >
            <House className="h-4 w-4" />
            Ir al inicio
          </button>
        </div>
      </section>
    </div>
  );
}