import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioScope } from "@/shared/domain/types/FolioScope";
import { isBranchScopedFolioCode } from "@/shared/domain/folios/branchScopedFolioCodes";
import { formatBranchFolioCode } from "@/shared/domain/folios/formatBranchFolioCode";

export interface FolioDto {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  scope: FolioScope;
  currentNumber: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Consecutivo de la sucursal solicitada (`?branchId=`). `null` sin `branchId` o si el folio no es branch-scoped. */
  branchCurrentNumber: number | null;
  /** Siguiente `folioCode` que emitiría esa sucursal. `null` en los mismos casos que `branchCurrentNumber`. */
  nextFolioCode: string | null;
}

/** Contexto de sucursal opcional para poblar `branchCurrentNumber`/`nextFolioCode`. */
export interface FolioBranchContext {
  branchCode: string;
  currentNumber: number;
}

export function toFolioDto(f: Folio, branch?: FolioBranchContext): FolioDto {
  const isScoped = branch && isBranchScopedFolioCode(f.code);
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    prefix: f.prefix,
    scope: f.scope,
    currentNumber: f.currentNumber,
    isActive: f.isActive,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    branchCurrentNumber: isScoped ? branch!.currentNumber : null,
    nextFolioCode: isScoped
      ? formatBranchFolioCode(f.prefix, f.code, branch!.branchCode, branch!.currentNumber + 1)
      : null,
  };
}
