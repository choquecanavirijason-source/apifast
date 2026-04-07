import { KeyRound, Shield, Users as UsersIcon } from "lucide-react";

import { StatCard } from "@/components/common/ui";

interface UsersStatsProps {
  userCount: number;
  activeUsers: number;
  inactiveUsers: number;
  rolesCount: number;
  permissionsCount: number;
}

export default function UsersStats({
  userCount,
  activeUsers,
  inactiveUsers,
  rolesCount,
  permissionsCount,
}: UsersStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="Usuarios"
        value={userCount}
        helperText={`${activeUsers} activos / ${inactiveUsers} inactivos`}
        icon={<UsersIcon className="h-4 w-4" />}
        tone="blue"
      />
      <StatCard
        label="Roles"
        value={rolesCount}
        helperText="Perfiles de acceso disponibles"
        icon={<Shield className="h-4 w-4" />}
        tone="emerald"
      />
      <StatCard
        label="Permisos"
        value={permissionsCount}
        helperText="Acciones controladas por seguridad"
        icon={<KeyRound className="h-4 w-4" />}
        tone="amber"
      />
    </div>
  );
}
