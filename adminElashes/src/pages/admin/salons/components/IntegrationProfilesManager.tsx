import { useCallback, useEffect, useState } from "react";
import { Layers, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  BranchService,
  type BranchIntegrationProfile,
  type BranchIntegrationProfilePayload,
} from "../../../../core/services/branch/branch.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";
import type { Salon } from "../utils";
import { Button, InputField } from "../../../../components/common/ui";

type Props = {
  salons: Salon[];
  onProfilesChange?: () => void;
};

type ProfileForm = {
  name: string;
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_api_url: string;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
  branch_ids: number[];
};

const emptyProfileForm: ProfileForm = {
  name: "",
  whatsapp_enabled: false,
  whatsapp_provider: "webhook",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_phone_number_id: "",
  branch_ids: [],
};

export default function IntegrationProfilesManager({ salons, onProfilesChange }: Props) {
  const [profiles, setProfiles] = useState<BranchIntegrationProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm);
  const [hasWhatsappToken, setHasWhatsappToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await BranchService.listIntegrationProfiles();
      setProfiles(data.filter((p) => p.is_shared));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudieron cargar los perfiles API."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId("new");
    setForm(emptyProfileForm);
    setHasWhatsappToken(false);
  };

  const openEdit = (profile: BranchIntegrationProfile) => {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      whatsapp_enabled: profile.whatsapp_enabled,
      whatsapp_provider: profile.whatsapp_provider || "webhook",
      whatsapp_api_url: profile.whatsapp_api_url ?? "",
      whatsapp_api_token: "",
      whatsapp_phone_number_id: profile.whatsapp_phone_number_id ?? "",
      branch_ids: [...profile.branch_ids],
    });
    setHasWhatsappToken(profile.whatsapp_has_token);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyProfileForm);
  };

  const toggleBranch = (branchId: number) => {
    setForm((prev) => ({
      ...prev,
      branch_ids: prev.branch_ids.includes(branchId)
        ? prev.branch_ids.filter((id) => id !== branchId)
        : [...prev.branch_ids, branchId],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.warning("El nombre del perfil es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload: BranchIntegrationProfilePayload = {
        name: form.name.trim(),
        is_shared: true,
        whatsapp_enabled: form.whatsapp_enabled,
        whatsapp_provider: form.whatsapp_provider,
        whatsapp_api_url: form.whatsapp_api_url.trim() || null,
        whatsapp_phone_number_id: form.whatsapp_phone_number_id.trim() || null,
        branch_ids: form.branch_ids,
      };
      if (form.whatsapp_api_token.trim()) payload.whatsapp_api_token = form.whatsapp_api_token.trim();

      if (editingId === "new") {
        await BranchService.createIntegrationProfile(payload);
        toast.success("Perfil compartido creado.");
      } else if (typeof editingId === "number") {
        await BranchService.updateIntegrationProfile(editingId, payload);
        toast.success("Perfil compartido actualizado.");
      }

      cancelEdit();
      await load();
      onProfilesChange?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar el perfil."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profile: BranchIntegrationProfile) => {
    if (!window.confirm(`¿Eliminar el perfil "${profile.name}"? Las sucursales quedarán sin perfil asignado.`)) {
      return;
    }
    try {
      await BranchService.removeIntegrationProfile(profile.id);
      toast.success("Perfil eliminado.");
      if (editingId === profile.id) cancelEdit();
      await load();
      onProfilesChange?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el perfil."));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <Layers className="mt-0.5 h-5 w-5 text-[#0078d4]" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Perfiles API compartidos</h3>
            <p className="text-xs text-slate-500">
              Agrupa varias sucursales bajo la misma API de WhatsApp.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={openCreate}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Nuevo perfil
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Cargando perfiles…</p>
      ) : profiles.length === 0 && editingId === null ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
          No hay perfiles compartidos. Crea uno para usar la misma API en varias sucursales.
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
            >
              <span className="text-xs font-semibold text-slate-700">
                {profile.name} ({profile.branch_ids.length})
              </span>
              <button
                type="button"
                onClick={() => openEdit(profile)}
                className="rounded p-1 text-slate-500 hover:bg-white hover:text-[#0078d4]"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(profile)}
                className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-600"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editingId !== null ? (
        <div className="space-y-4 rounded-lg border border-[#deecf9] bg-[#f3f9fd] p-3">
          <InputField
            label="Nombre del perfil (ej. La Paz · WhatsApp)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Sucursales que usan este perfil</p>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {salons.map((salon) => {
                const checked = form.branch_ids.includes(salon.id);
                return (
                  <label
                    key={salon.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      checked
                        ? "border-[#0078d4] bg-white text-[#004578]"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBranch(salon.id)}
                      className="rounded border-slate-300"
                    />
                    {salon.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.whatsapp_enabled}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_enabled: e.target.checked }))}
              />
              WhatsApp API activa
            </label>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={form.whatsapp_provider}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_provider: e.target.value }))}
            >
              <option value="webhook">Webhook</option>
              <option value="meta">Meta</option>
              <option value="wa_me">wa.me manual</option>
            </select>
            {form.whatsapp_provider === "webhook" ? (
              <InputField
                label="URL WhatsApp"
                value={form.whatsapp_api_url}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_api_url: e.target.value }))}
              />
            ) : null}
            {form.whatsapp_provider === "meta" ? (
              <InputField
                label="Phone Number ID"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
              />
            ) : null}
            {form.whatsapp_provider !== "wa_me" ? (
              <InputField
                label="Token WhatsApp"
                type="password"
                value={form.whatsapp_api_token}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_api_token: e.target.value }))}
                placeholder={hasWhatsappToken ? "•••••• (vacío = no cambiar)" : "Token"}
              />
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void handleSave()}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              {saving ? "Guardando…" : "Guardar perfil"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
