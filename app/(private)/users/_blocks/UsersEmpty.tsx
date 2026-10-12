import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Button } from "../../../_components/atoms/Button/Button";

interface UsersEmptyProps {
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function UsersEmpty({ filtered, onClearFilters }: UsersEmptyProps) {
  if (filtered) {
    return (
      <EmptyState
        icon="search"
        title="Ningún usuario coincide con los filtros"
        action={
          <Button
            type="button"
            variant="text"
            onClick={onClearFilters}
            className="text-label-lg underline underline-offset-2"
          >
            Limpiar filtros
          </Button>
        }
      />
    );
  }
  return <EmptyState icon="group" title="No hay usuarios" description="Aún no se han registrado usuarios en el sistema." />;
}
