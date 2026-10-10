import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Select } from "../../../_components/atoms/Select/Select";

interface CatalogPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  count: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function CatalogPagination({
  page,
  pageSize,
  total,
  count,
  onPageChange,
  onPageSizeChange,
}: CatalogPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-outline-variant">
      <span className="text-body-md text-on-surface-variant">
        Mostrando {from}–{to} de {total}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-label-lg text-on-surface-variant" htmlFor="catalog-page-size-select">
            Por página:
          </label>
          <Select
            id="catalog-page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="w-auto py-1"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon="chevron_left"
            iconSize={20}
            ariaLabel="Página anterior"
            variant="ghost"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            className="rounded p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          />
          <IconButton
            icon="chevron_right"
            iconSize={20}
            ariaLabel="Página siguiente"
            variant="ghost"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            className="rounded p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
