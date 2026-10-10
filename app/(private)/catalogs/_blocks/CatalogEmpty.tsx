import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Button } from "../../../_components/atoms/Button/Button";

interface CatalogEmptyProps {
  canWrite?: boolean;
  onCreate?: () => void;
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function CatalogEmpty({ canWrite, onCreate, filtered, onClearFilters }: CatalogEmptyProps) {
  if (filtered) {
    return (
      <EmptyState
        icon="search"
        title="Ningún elemento coincide con los filtros"
        action={
          onClearFilters && (
            <Button
              type="button"
              variant="text"
              onClick={onClearFilters}
              className="underline underline-offset-2"
            >
              Limpiar filtros
            </Button>
          )
        }
      />
    );
  }
  return (
    <EmptyState
      icon="category"
      title="No hay elementos en este catálogo"
      description="Comienza agregando el primer elemento."
      action={
        canWrite && onCreate ? (
          <Button type="button" variant="filled" onClick={onCreate}>
            Crear el primero
          </Button>
        ) : undefined
      }
    />
  );
}
