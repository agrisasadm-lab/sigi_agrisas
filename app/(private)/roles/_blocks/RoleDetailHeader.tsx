import { Icon } from "../../../_components/atoms/Icon/Icon";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { getRoleNameLabel } from "../../../_lib/rbacLabels";
import type { Role } from "../_logic/types/domain";

interface RoleDetailHeaderProps {
  role: Role | null;
}

export function RoleDetailHeader({ role }: RoleDetailHeaderProps) {
  if (!role) {
    return (
      <div className="px-6 py-8 border-b border-outline-variant">
        <EmptyState
          icon="shield_person"
          title="Selecciona un rol"
          description="Elige un rol de la lista para ver y gestionar sus permisos."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-5 border-b border-outline-variant">
      <div className="flex items-center justify-between">
        <p className="text-body-md text-on-surface-variant">
          Configurando:{" "}
          <span className="font-semibold text-on-surface">{getRoleNameLabel(role.name)}</span>
        </p>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-sm font-medium">
          <Icon name="verified_user" size={14} />
          Estado: Activo
        </span>
      </div>
      {role.description && (
        <p className="text-body-md text-on-surface-variant mt-1">{role.description}</p>
      )}
    </div>
  );
}
