import Layout from "@/components/common/layout";
import { SectionCard } from "@/components/common/ui";

export default function AccessDenied() {
  return (
    <Layout
      title="Usuarios y Roles"
      subtitle="Gestiona accesos y permisos del sistema."
      variant="table"
    >
      <SectionCard className="border border-slate-200">
        <span className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm">
          Acceso restringido
        </span>
        <h2 className="mt-5 text-2xl font-black text-slate-900">Solo SuperAdmin</h2>
        <p className="mt-3 text-base text-slate-500">
          Esta sección permite crear usuarios, roles y asignar permisos. Solicita acceso al SuperAdmin.
        </p>
      </SectionCard>
    </Layout>
  );
}
