"use client";

import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Switch } from "../../../_components/atoms/Switch/Switch";
import { Select } from "../../../_components/atoms/Select/Select";
import { CreateButton } from "../../../_components/molecules/CreateButton/CreateButton";

interface BranchOption {
  id: string;
  name: string;
}

interface ExpensesToolbarProps {
  canWrite: boolean;
  onCreate: () => void;
  concept: string;
  onConceptChange: (v: string) => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  dateRangeError: string | null;
  includeInactive: boolean;
  onIncludeInactiveChange: (v: boolean) => void;
  branchId: string;
  onBranchIdChange: (v: string) => void;
  branches: BranchOption[];
  showBranchFilter: boolean;
}

const CONCEPT_MIN_LENGTH = 2;

export function ExpensesToolbar({
  canWrite,
  onCreate,
  concept,
  onConceptChange,
  from,
  onFromChange,
  to,
  onToChange,
  dateRangeError,
  includeInactive,
  onIncludeInactiveChange,
  branchId,
  onBranchIdChange,
  branches,
  showBranchFilter,
}: ExpensesToolbarProps) {
  const showMinLengthHint = concept.length > 0 && concept.length < CONCEPT_MIN_LENGTH;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Concepto</label>
          <div className="relative w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              value={concept}
              onChange={(e) => onConceptChange(e.target.value)}
              placeholder="Buscar por concepto..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-label-sm text-on-surface-variant">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <span className="text-on-surface-variant text-body-sm mb-2">—</span>
          <div className="flex flex-col gap-1">
            <label className="text-label-sm text-on-surface-variant">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {showBranchFilter && (
          <div className="flex flex-col gap-1">
            <label className="text-label-sm text-on-surface-variant">Sucursal</label>
            <Select value={branchId} onChange={(e) => onBranchIdChange(e.target.value)}>
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
          <Switch checked={includeInactive} onChange={onIncludeInactiveChange} aria-label="Mostrar inactivos" />
          <span className="text-label-lg text-on-surface-variant">Mostrar inactivos</span>
        </label>

        {canWrite && (
          <div className="ml-auto pb-0.5">
            <CreateButton label="Nuevo gasto" onClick={onCreate} />
          </div>
        )}
      </div>

      <div className="pl-1">
        {dateRangeError ? (
          <p className="text-label-sm text-error">{dateRangeError}</p>
        ) : showMinLengthHint ? (
          <p className="text-label-sm text-error">Mínimo {CONCEPT_MIN_LENGTH} caracteres</p>
        ) : (
          <p className="text-label-sm text-on-surface-variant">Búsqueda en servidor · {CONCEPT_MIN_LENGTH}+ caracteres</p>
        )}
      </div>
    </div>
  );
}
