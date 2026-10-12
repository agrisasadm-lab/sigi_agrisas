"use client";

import { useState } from "react";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";

interface RebuildArticleButtonProps {
  disabled: boolean;
  isRebuilding: boolean;
  onRebuild: () => Promise<void>;
}

export function RebuildArticleButton({ disabled, isRebuilding, onRebuild }: RebuildArticleButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirm() {
    setConfirmOpen(false);
    await onRebuild();
  }

  return (
    <>
      <Button
        type="button"
        variant="outlined"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled}
        loading={isRebuilding}
        className="gap-1.5 rounded-md text-label-lg hover:bg-surface-container"
      >
        <Icon name="restore" size={18} />
        Reconstruir Artículo
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Reconstruir saldos del artículo?"
        description="Recalcula el saldo acumulado de este producto en la sucursal seleccionada a partir de su historial de movimientos. No es reversible salvo repitiendo el cálculo."
        confirmLabel="Reconstruir"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
