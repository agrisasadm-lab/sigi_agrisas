import { Button } from "../../../_components/atoms/Button/Button";

interface UsersErrorProps {
  onRetry: () => void;
}

export function UsersError({ onRetry }: UsersErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-body-md text-error">No se pudo cargar la lista de usuarios</p>
      <Button
        type="button"
        variant="text"
        onClick={onRetry}
        className="text-label-lg underline underline-offset-2"
      >
        Reintentar
      </Button>
    </div>
  );
}
