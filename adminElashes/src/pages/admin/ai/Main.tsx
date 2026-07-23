import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, MessageSquare, Save, Send, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import Layout from "../../../components/common/layout";
import { Button, InputField } from "../../../components/common/ui";
import useAuth from "../../../core/hooks/useAuth";
import { BranchService } from "../../../core/services/branch/branch.service";
import {
  AdminAiService,
  type AdminAiContext,
  type AdminAiSettings,
} from "../../../core/services/admin-ai/admin-ai.service";
import { getApiErrorMessage } from "../../../core/utils/apiError";

type ChatMessage = { role: "user" | "assistant"; text: string };

const SUGGESTED_QUESTIONS = [
  "¿Cuántas citas hay hoy y en qué estado están?",
  "Resume las ventas POS de los últimos 30 días.",
  "¿Cuántas clientas y sucursales tenemos?",
  "¿Qué sucursal tiene más citas pendientes hoy?",
];

export default function AdminAiPage() {
  const { isAdmin, hasAnyPermissionByName } = useAuth();
  const canUseAi =
    isAdmin() || hasAnyPermissionByName(["ai:view", "ai:manage"]);

  const [settings, setSettings] = useState<AdminAiSettings | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [context, setContext] = useState<AdminAiContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await AdminAiService.getSettings();
      setSettings(data);
      setApiUrl(data.ai_api_url ?? "");
      setAiModel(data.ai_model || "gpt-4o-mini");
      setAiEnabled(data.ai_enabled);
      setHasToken(data.ai_has_token);
      setApiToken("");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo cargar la configuración de IA."));
    }
  }, []);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const data = await AdminAiService.getContext(branchFilter === "" ? null : branchFilter);
      setContext(data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo cargar el resumen de datos."));
    } finally {
      setLoadingContext(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    if (!canUseAi) return;
    void loadSettings();
    void BranchService.list({ limit: 300 }).then((list) =>
      setBranches(list.map((b) => ({ id: b.id, name: b.name })))
    );
  }, [canUseAi, loadSettings]);

  useEffect(() => {
    if (!canUseAi) return;
    void loadContext();
  }, [canUseAi, loadContext]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload: {
        ai_enabled: boolean;
        ai_api_url: string | null;
        ai_model: string;
        ai_api_token?: string;
      } = {
        ai_enabled: aiEnabled,
        ai_api_url: apiUrl.trim() || null,
        ai_model: aiModel.trim() || "gpt-4o-mini",
      };
      if (apiToken.trim()) payload.ai_api_token = apiToken.trim();

      const updated = await AdminAiService.updateSettings(payload);
      setSettings(updated);
      setHasToken(updated.ai_has_token);
      setApiToken("");
      toast.success("Configuración de IA guardada.");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar la configuración."));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    if (!aiEnabled || (!hasToken && !apiToken.trim())) {
      toast.warning("Activa la IA y configura URL + token antes de consultar.");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setSending(true);
    try {
      const result = await AdminAiService.chat(
        question,
        branchFilter === "" ? null : branchFilter
      );
      setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo obtener respuesta de la IA."));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "No pude procesar la consulta. Revisa la URL de la API (formato OpenAI) y el token.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const contextCards = useMemo(() => {
    if (!context) return [];
    const a30 = context.last_30_days.appointments;
    const today = context.today.appointments;
    return [
      { label: "Sucursales", value: String(context.totals.branches_count) },
      { label: "Clientas", value: String(context.totals.clients_total) },
      { label: "Citas (30 días)", value: String(a30.total ?? 0) },
      { label: "Ventas POS (30 días)", value: `Bs. ${context.last_30_days.pos_sales_total.toFixed(2)}` },
      { label: "Citas hoy", value: String(today.total ?? 0) },
      { label: "Pendientes hoy", value: String(today.pending ?? 0) },
    ];
  }, [context]);

  if (!canUseAi) {
    return (
      <Layout title="Asistente IA" subtitle="Acceso restringido">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          No tienes permiso para usar el asistente IA. Solicita el permiso{" "}
          <strong>ai:view</strong> a un administrador.
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Asistente IA"
      subtitle="Configura la API y consulta todos los datos del negocio en lenguaje natural."
      variant="cards"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-700" />
              <h2 className="text-sm font-bold text-slate-800">API de IA (global)</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Compatible con OpenAI y proveedores similares (URL base + token). Ejemplo URL:{" "}
              <code className="text-[10px]">https://api.openai.com/v1</code>
            </p>

            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              Activar asistente IA
            </label>

            <div className="space-y-3">
              <InputField
                label="URL API"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <InputField
                label="Modelo"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
              <InputField
                label="Token API"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={hasToken ? "•••••• (vacío = no cambiar)" : "sk-..."}
              />
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-4 w-full"
              disabled={savingSettings}
              onClick={() => void handleSaveSettings()}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              {savingSettings ? "Guardando…" : "Guardar configuración"}
            </Button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Alcance de datos</h3>
            <select
              className="mt-2 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </section>
        </aside>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#0078d4]" />
              <h2 className="text-sm font-bold text-slate-800">Resumen que ve la IA</h2>
            </div>
            {loadingContext ? (
              <p className="text-xs text-slate-400">Cargando datos…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {contextCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-lg border border-[#deecf9] bg-[#f3f9fd] px-2 py-2 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase text-[#605e5c]">{card.label}</p>
                    <p className="text-sm font-bold text-[#004578]">{card.value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex min-h-[420px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MessageSquare className="h-4 w-4 text-violet-700" />
              <h2 className="text-sm font-bold text-slate-800">Consultar con IA</h2>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Pregunta sobre citas, ventas, clientas o sucursales. La IA usa los datos reales del
                    sistema.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void handleSend(q)}
                        className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs text-violet-900 hover:bg-violet-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={`${idx}-${msg.role}`}
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-auto bg-[#0078d4] text-white"
                        : "mr-auto border border-slate-200 bg-slate-50 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
              {sending ? (
                <p className="text-xs text-slate-400">La IA está analizando los datos…</p>
              ) : null}
            </div>

            <div className="border-t border-slate-100 p-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ej. ¿Cuántas citas confirmadas hay hoy en todas las sucursales?"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="shrink-0"
                  disabled={sending || !input.trim()}
                  leftIcon={<Send className="h-3.5 w-3.5" />}
                >
                  Enviar
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
