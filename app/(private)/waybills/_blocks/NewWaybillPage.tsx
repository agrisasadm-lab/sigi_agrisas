"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "../../../_components/atoms/Button/Button";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useCreateWaybillForm } from "../_logic/hooks/useCreateWaybillForm";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { BranchPairSelector } from "./BranchPairSelector";
import { SimpleTransferFields } from "./SimpleTransferFields";
import { WaybillItemsForm } from "./WaybillItemsForm";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import {
  BranchAddressIncompleteError,
  InvalidBranchPairError,
  ProductNotFoundForTransferError,
} from "../_logic/errors";

export function NewWaybillPage() {
  const { can } = useCurrentUser();
  const canWrite = can("waybills:write");
  const { options: branchOptions } = useBranchesOptions();

  const {
    transferDate,
    setTransferDate,
    notes,
    setNotes,
    originBranchId,
    setOriginBranchId,
    destinationBranchId,
    setDestinationBranchId,
    lines,
    addLine,
    updateLine,
    removeLine,
    isSubmitting,
    error,
    clearError,
    submit,
  } = useCreateWaybillForm();

  if (canWrite === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canWrite === false) {
    return <EmptyState icon="block" title="Sin acceso" description="No tienes permiso para crear traspasos." />;
  }

  function renderError() {
    if (!error) return null;

    let content: ReactNode;
    if (error instanceof BranchAddressIncompleteError) {
      content = (
        <span>
          El domicilio fiscal de la sucursal está incompleto (faltan: {error.missingFields.join(", ")}).{" "}
          <Link href="/catalogs/branches" className="underline font-medium">
            Completar en Catálogos → Sucursales
          </Link>
        </span>
      );
    } else if (error instanceof InvalidBranchPairError) {
      content = "Verifica que origen y destino sean sucursales activas y distintas.";
    } else if (error instanceof ProductNotFoundForTransferError) {
      content = "Uno de los productos seleccionados no existe en el catálogo.";
    } else {
      content = error.message;
    }

    return (
      <div className="rounded bg-error-container/30 border border-error/30 px-4 py-3 text-body-sm text-error flex items-start justify-between gap-2">
        <span>{content}</span>
        <IconButton
          icon="close"
          iconSize={16}
          ariaLabel="Cerrar"
          onClick={clearError}
          className="flex-shrink-0 hover:bg-transparent hover:opacity-70"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-headline-sm font-semibold text-on-surface mb-1">Nuevo traspaso</h1>
        <p className="text-body-md text-on-surface-variant">
          Movimiento interno de mercancía entre sucursales, sin CFDI ni Carta Porte.
        </p>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-6 space-y-6">
        <BranchPairSelector
          originBranchId={originBranchId}
          onOriginChange={setOriginBranchId}
          destinationBranchId={destinationBranchId}
          onDestinationChange={setDestinationBranchId}
          branches={branchOptions}
        />

        <WaybillItemsForm type="simple" lines={lines} addLine={addLine} updateLine={updateLine} removeLine={removeLine} />

        <SimpleTransferFields
          transferDate={transferDate}
          onTransferDateChange={setTransferDate}
          notes={notes}
          onNotesChange={setNotes}
        />

        {renderError()}

        <div className="border-t border-outline-variant pt-4 flex justify-end">
          <Button
            type="button"
            variant="filled"
            onClick={() => submit()}
            loading={isSubmitting}
            className="px-6 py-2.5 text-label-lg bg-secondary text-on-secondary hover:bg-secondary/90"
          >
            Crear traspaso
          </Button>
        </div>
      </div>
    </div>
  );
}
