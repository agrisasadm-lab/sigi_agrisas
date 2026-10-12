import { cn } from "../../../_lib/cn";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Button } from "../../../_components/atoms/Button/Button";
import { CreateButton } from "../../../_components/molecules/CreateButton/CreateButton";

interface UsersToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeRoles: string[];
  availableRoles: string[];
  onToggleRole: (role: string) => void;
  onClearFilters: () => void;
  canCreate?: boolean;
  onCreateClick?: () => void;
}

export function UsersToolbar({
  search,
  onSearchChange,
  activeRoles,
  availableRoles,
  onToggleRole,
  onClearFilters,
  canCreate = false,
  onCreateClick,
}: UsersToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
            <Icon name="search" size={18} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o email"
            className="w-full pl-10 pr-4 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {canCreate && <CreateButton label="Nuevo usuario" onClick={onCreateClick} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="text"
          onClick={onClearFilters}
          className={cn(
            "rounded-full px-3 py-1 text-label-lg",
            activeRoles.length === 0
              ? "bg-primary text-on-primary hover:bg-primary/90"
              : "bg-surface-container text-on-surface hover:bg-surface-container-high"
          )}
        >
          Todos
        </Button>
        {availableRoles.map((role) => (
          <Button
            key={role}
            type="button"
            variant="text"
            onClick={() => onToggleRole(role)}
            className={cn(
              "rounded-full px-3 py-1 text-label-lg",
              activeRoles.includes(role)
                ? "bg-primary text-on-primary hover:bg-primary/90"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            )}
          >
            {role}
          </Button>
        ))}
      </div>
    </div>
  );
}
