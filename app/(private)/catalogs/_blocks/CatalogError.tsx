import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Button } from "../../../_components/atoms/Button/Button";

interface CatalogErrorProps {
  onRetry: () => void;
}

export function CatalogError({ onRetry }: CatalogErrorProps) {
  return (
    <EmptyState
      icon="warning"
      title="Error al cargar"
      description="Ocurrió un error al obtener los datos."
      action={
        <Button type="button" variant="outlined" onClick={onRetry}>
          Reintentar
        </Button>
      }
    />
  );
}
