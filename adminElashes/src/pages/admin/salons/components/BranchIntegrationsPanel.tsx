import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Save } from "lucide-react";
import { toast } from "react-toastify";
import {
  BranchService,
  type BranchIntegrationProfile,
  type BranchIntegrations,
  type BranchIntegrationsPayload,
} from "../../../../core/services/branch/branch.service";
import { CatalogService, type QuestionnaireItem } from "../../../../core/services/catalog/catalog.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";
import { Button, InputField } from "../../../../components/common/ui";

type Props = {
  branchId: number | null;
  branchLabel: string;
  sharedProfiles: BranchIntegrationProfile[];
  onSaved?: () => void;
};

type FormState = {
  mode: "shared" | "own";
  integration_profile_id: number | "";
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_api_url: string;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
};

const emptyForm: FormState = {
  mode: "own",
  integration_profile_id: "",
  whatsapp_enabled: false,
  whatsapp_provider: "webhook",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_phone_number_id: "",
};

function mapToForm(data: BranchIntegrations): FormState {
  return {
    mode: data.use_shared_profile ? "shared" : "own",
    integration_profile_id: data.integration_profile_id ?? "",
    whatsapp_enabled: data.whatsapp_enabled,
    whatsapp_provider: data.whatsapp_provider || "webhook",
    whatsapp_api_url: data.whatsapp_api_url ?? "",
    whatsapp_api_token: "",
    whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? "",
  };
}

export default function BranchIntegrationsPanel({
  branchId,
  branchLabel,
  sharedProfiles,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [meta, setMeta] = useState<BranchIntegrations | null>(null);
  const [hasWhatsappToken, setHasWhatsappToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireItem | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = await BranchService.getIntegrations(branchId);
      setMeta(data);
      setForm(mapToForm(data));
      setHasWhatsappToken(data.whatsapp_has_token);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo cargar la configuración de la sucursal."));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setForm(emptyForm);
      setMeta(null);
      setHasWhatsappToken(false);
      return;
    }
    void load();
  }, [branchId, load]);

  useEffect(() => {
    CatalogService.listQuestionnaires({ limit: 1 })
      .then((list) => { if (list.length > 0) void CatalogService.getQuestionnaire(list[0].id).then(setQuestionnaire); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!branchId) return;
    setSaving(true);
    try {
      const payload: BranchIntegrationsPayload =
        form.mode === "shared"
          ? {
              mode: "shared",
              integration_profile_id:
                form.integration_profile_id === "" ? null : Number(form.integration_profile_id),
            }
          : {
              mode: "own",
              whatsapp_enabled: form.whatsapp_enabled,
              whatsapp_provider: form.whatsapp_provider,
              whatsapp_api_url: form.whatsapp_api_url.trim() || null,
              whatsapp_phone_number_id: form.whatsapp_phone_number_id.trim() || null,
            };

      if (form.mode === "own" && form.whatsapp_api_token.trim()) {
        payload.whatsapp_api_token = form.whatsapp_api_token.trim();
      }

      const updated = await BranchService.updateIntegrations(branchId, payload);
      setMeta(updated);
      setForm(mapToForm(updated));
      setHasWhatsappToken(updated.whatsapp_has_token);
      toast.success("Configuración guardada para esta sucursal.");
      onSaved?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  if (!branchId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Selecciona un <strong>salón</strong> de la lista para configurar WhatsApp e IA.
      </div>
    );
  }

  const sharedCount = meta?.shared_branch_ids.length ?? 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">API · {branchLabel}</h3>
          <p className="text-xs text-slate-500">
            WhatsApp por sucursal o perfil compartido. La IA global está en el menú Asistente IA.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={saving || loading}
          onClick={() => void handleSave()}
          leftIcon={<Save className="h-3.5 w-3.5" />}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, mode: "shared" }))}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            form.mode === "shared"
              ? "border-[#0078d4] bg-[#deecf9] text-[#004578]"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Perfil compartido
        </button>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, mode: "own" }))}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            form.mode === "own"
              ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Solo esta sucursal
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Cargando configuración…</p>
      ) : form.mode === "shared" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Perfil API compartido</label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              value={form.integration_profile_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  integration_profile_id: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            >
              <option value="">Selecciona un perfil…</option>
              {sharedProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.branch_ids.length} sucursal
                  {profile.branch_ids.length === 1 ? "" : "es"})
                </option>
              ))}
            </select>
          </div>
          {meta?.use_shared_profile && sharedCount > 1 ? (
            <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Este perfil lo usan <strong>{sharedCount} sucursales</strong>. Los cambios al perfil afectan a todas.
            </p>
          ) : null}
          {sharedProfiles.length === 0 ? (
            <p className="text-xs text-slate-500">Crea un perfil compartido en la sección de arriba.</p>
          ) : null}
        </div>
      ) : (
        <div className="max-w-xl">
          <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <MessageCircle className="h-4 w-4" />
              WhatsApp API
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.whatsapp_enabled}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_enabled: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Activar envío automático por API
            </label>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Proveedor</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                value={form.whatsapp_provider}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_provider: e.target.value }))}
              >
                <option value="webhook">Webhook (URL propia)</option>
                <option value="meta">Meta Cloud API</option>
                <option value="wa_me">Solo enlace wa.me (manual)</option>
              </select>
            </div>

            {form.whatsapp_provider === "webhook" ? (
              <InputField
                label="URL API WhatsApp"
                value={form.whatsapp_api_url}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_api_url: e.target.value }))}
                placeholder="https://tu-api.com/send"
              />
            ) : null}

            {form.whatsapp_provider === "meta" ? (
              <InputField
                label="Phone Number ID (Meta)"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
                placeholder="ID de número de WhatsApp Business"
              />
            ) : null}

            {form.whatsapp_provider !== "wa_me" ? (
              <InputField
                label="Token API WhatsApp"
                type="password"
                value={form.whatsapp_api_token}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_api_token: e.target.value }))}
                placeholder={hasWhatsappToken ? "•••••••• (dejar vacío para no cambiar)" : "Pega el token aquí"}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ── Preguntas que se enviarán por WhatsApp al reservar ─────────────── */}
      {questionnaire && (
        <div className="mt-4 rounded-xl border border-[#0078d4]/30 bg-[#f0f6ff]">
          <button
            type="button"
            onClick={() => setShowQuestions((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#0078d4]" />
              <div>
                <p className="text-xs font-bold text-[#004578]">
                  Preguntas que se enviarán al cliente por WhatsApp al agendar
                </p>
                <p className="text-[10px] text-[#605e5c]">
                  {questionnaire.questions?.length ?? 0} preguntas · {questionnaire.title}
                  {!form.whatsapp_enabled && " · (WhatsApp desactivado)"}
                </p>
              </div>
            </div>
            {showQuestions ? <ChevronUp className="h-4 w-4 text-[#0078d4]" /> : <ChevronDown className="h-4 w-4 text-[#0078d4]" />}
          </button>

          {showQuestions && questionnaire.questions && (
            <div className="border-t border-[#0078d4]/20 px-4 pb-4 pt-3">
              {!form.whatsapp_enabled && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Activa WhatsApp API arriba y guarda las llaves para enviar estas preguntas automáticamente.
                </div>
              )}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Vista previa del mensaje al cliente:
              </p>
              <div className="rounded-xl bg-white border border-[#edebe9] p-3 text-xs text-[#323130] space-y-1.5 font-mono shadow-sm">
                <p className="font-bold text-[#0078d4]">Hola! Para confirmar tu cita necesitamos saber:</p>
                {questionnaire.questions
                  .filter((q) => q.is_required)
                  .slice(0, 8)
                  .map((q, i) => (
                    <p key={q.id} className="text-slate-700">
                      {i + 1}. {q.text}{q.question_type === "bool" ? " (Sí / No)" : " (Respuesta libre)"}
                    </p>
                  ))}
                {(questionnaire.questions.filter((q) => q.is_required).length > 8) && (
                  <p className="text-slate-400">…y {questionnaire.questions.filter((q) => q.is_required).length - 8} preguntas más</p>
                )}
                <p className="pt-1 font-bold text-[#0078d4]">Responde y te confirmamos tu cita ✅</p>
              </div>
              <p className="mt-2 text-[10px] text-[#605e5c]">
                Solo se muestran las preguntas marcadas como obligatorias ({questionnaire.questions.filter((q) => q.is_required).length} de {questionnaire.questions.length}).
                Edita el cuestionario en <strong>Cuestionarios</strong>.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
