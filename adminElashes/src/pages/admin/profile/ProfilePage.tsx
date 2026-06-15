import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { User, Lock, ShieldCheck, Building2, KeyRound } from "lucide-react";
import Layout from "@/components/common/layout";
import type { RootState } from "@/store";
import api from "@/core/services/api";
import { getApiErrorMessage } from "@/core/utils/apiError";

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <span className="text-emerald-600">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400";

export default function ProfilePage() {
  const { user } = useSelector((state: RootState) => state.auth);

  // ── Datos personales ──────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Contraseña ────────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername((user as any).username ?? "");
    setEmail((user as any).email ?? "");
    setPhone((user as any).phone ?? "");
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const id = (user as any).id;
    if (!username.trim() || !email.trim()) {
      toast.warning("Usuario y correo son obligatorios.");
      return;
    }
    setSavingProfile(true);
    try {
      await api.put(`/admin/users/${id}`, {
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      toast.success("Perfil actualizado correctamente.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo actualizar el perfil."));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;
    if (newPassword.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning("Las contraseñas no coinciden.");
      return;
    }
    const id = (user as any).id;
    setSavingPassword(true);
    try {
      await api.put(`/admin/users/${id}`, { password: newPassword });
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada correctamente.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo actualizar la contraseña."));
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Info de cuenta (solo lectura) ─────────────────────────────────────────
  const roleName = (() => {
    const r = (user as any)?.role;
    if (!r) return "—";
    if (typeof r === "string") return r;
    return r.name ?? "—";
  })();

  const branchName = (() => {
    const b = (user as any)?.branch;
    if (!b) return "Sin sucursal";
    if (typeof b === "string") return b;
    return b.name ?? "Sin sucursal";
  })();

  const directPerms: string[] = (() => {
    const perms = (user as any)?.direct_permissions;
    if (!Array.isArray(perms)) return [];
    return perms.map((p: any) => (typeof p === "string" ? p : p?.name ?? "")).filter(Boolean);
  })();

  const rolePerms: string[] = (() => {
    const perms = (user as any)?.role?.permissions;
    if (!Array.isArray(perms)) return [];
    return perms.map((p: any) => (typeof p === "string" ? p : p?.name ?? "")).filter(Boolean);
  })();

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <div className="mb-1">
        <h1 className="text-base font-semibold text-slate-800">Mi perfil</h1>
        <p className="text-xs text-slate-400">Gestiona los datos de tu cuenta de administrador</p>
      </div>

      {/* Datos personales */}
      <SectionCard icon={<User size={16} />} title="Información personal">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre de usuario">
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: admin"
              disabled={savingProfile}
            />
          </Field>
          <Field label="Correo electrónico">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              disabled={savingProfile}
            />
          </Field>
          <Field label="Teléfono">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+59170000000"
              disabled={savingProfile}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </SectionCard>

      {/* Cambiar contraseña */}
      <SectionCard icon={<Lock size={16} />} title="Cambiar contraseña">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nueva contraseña">
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              disabled={savingPassword}
            />
          </Field>
          <Field label="Confirmar contraseña">
            <input
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              disabled={savingPassword}
            />
          </Field>
        </div>
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="mt-2 text-xs text-red-500">Las contraseñas no coinciden.</p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSavePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound size={14} />
            {savingPassword ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </div>
      </SectionCard>

      {/* Info de cuenta */}
      <SectionCard icon={<ShieldCheck size={16} />} title="Información de cuenta">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Rol</p>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">{roleName}</span>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Sucursal</p>
            <div className="flex items-center gap-2">
              <Building2 size={14} className="shrink-0 text-slate-400" />
              <span className="text-sm text-slate-700">{branchName}</span>
            </div>
          </div>
        </div>

        {rolePerms.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Permisos del rol</p>
            <div className="flex flex-wrap gap-1.5">
              {rolePerms.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {directPerms.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Permisos directos adicionales</p>
            <div className="flex flex-wrap gap-1.5">
              {directPerms.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {rolePerms.length === 0 && directPerms.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">No hay permisos registrados para esta cuenta.</p>
        )}
      </SectionCard>
    </div>
  );
}
