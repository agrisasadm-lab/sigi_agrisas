import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { cn } from "../../../_lib/cn";
import { getRoleNameLabel } from "../../../_lib/rbacLabels";
import type { Role } from "../_logic/types/domain";

interface RolesListProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function RolesList({ roles, selectedRoleId, onSelect, isLoading }: RolesListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={60} className="w-full" />
        ))}
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <EmptyState icon="shield_person" title="Sin roles" description="No hay roles configurados" />
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-2" aria-label="Lista de roles">
      {roles.map((role) => {
        const isActive = role.id === selectedRoleId;
        return (
          <li key={role.id}>
            <button
              aria-current={isActive ? "true" : undefined}
              type="button"
              onClick={() => onSelect(role.id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-md transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "hover:bg-surface-container-high text-on-surface"
              )}
            >
              <p className="text-label-lg font-medium">{getRoleNameLabel(role.name)}</p>
              {role.description && (
                <p className={cn("text-body-md truncate", isActive ? "text-on-primary-container/70" : "text-on-surface-variant")}>
                  {role.description}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
