import { useMemo } from "react";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { getPermissionGroupLabel } from "../../../_lib/rbacLabels";
import type { Permission } from "../_logic/types/domain";

interface RolePermissionsEditorProps {
  catalog: Permission[];
  staged: Set<string>;
  onToggle: (permId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function RolePermissionsEditor({
  catalog,
  staged,
  onToggle,
  isLoading,
  disabled,
}: RolePermissionsEditorProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const perm of catalog) {
      const resource = perm.key.split(":")[0];
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(perm);
    }
    return Array.from(map.entries());
  }, [catalog]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pt-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton height={16} width="25%" />
            {Array.from({ length: 3 }).map((__, j) => (
              <Skeleton key={j} height={52} className="w-full" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-on-surface-variant">
        No hay permisos en el catálogo
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {groups.map(([resource, perms]) => (
        <div key={resource}>
          <h3 className="text-label-sm font-medium text-on-surface-variant uppercase tracking-widest mb-2 px-1">
            {getPermissionGroupLabel(resource)}
          </h3>
          <ul className="flex flex-col gap-1">
            {perms.map((perm) => {
              const isOn = staged.has(perm.id);
              return (
                <li
                  key={perm.id}
                  className="flex items-center justify-between px-4 py-3 rounded-md bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  <span className="text-body-md text-on-surface">
                    {perm.description ?? perm.key}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`${isOn ? "Revocar" : "Conceder"} ${perm.description ?? perm.key}`}
                    disabled={disabled}
                    onClick={() => onToggle(perm.id)}
                    className={[
                      "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent",
                      "transition-colors duration-200",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      isOn ? "bg-primary cursor-pointer" : "bg-surface-container-highest cursor-pointer",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm",
                        "transform transition-transform duration-200",
                        isOn ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
