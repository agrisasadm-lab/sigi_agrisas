"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Combobox } from "../../../_components/molecules/Combobox/Combobox";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useProviderSearch } from "../_logic/hooks/useProviderSearch";
import type { ProviderDto } from "../_logic/types/api";

interface ProviderPickerProps {
  value: string;
  onChange: (providerId: string, provider: ProviderDto | null) => void;
  onOpenQuickAdd: () => void;
}

export function ProviderPicker({ value, onChange, onOpenQuickAdd }: ProviderPickerProps) {
  const { can } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { items, isLoading } = useProviderSearch({ search: debouncedSearch });

  const canWrite = can("providers:write");

  const options = items.map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.rfc}`,
    provider: p,
  }));

  function renderOption(opt: { value: string; label: string; provider: ProviderDto }) {
    const p = opt.provider;
    return (
      <div>
        <p className="text-body-sm font-medium">{p.name}</p>
        <p className="text-label-sm text-on-surface-variant font-mono">{p.rfc}</p>
      </div>
    );
  }

  const footerSlot =
    canWrite === true ? (
      <Button
        type="button"
        variant="text"
        onMouseDown={(e) => { e.preventDefault(); onOpenQuickAdd(); }}
        className="w-full justify-start gap-2 rounded-none px-3 py-2 text-label-sm hover:bg-primary/5"
      >
        <Icon name="add" size={14} />
        Nuevo proveedor
      </Button>
    ) : null;

  function handleChange(id: string) {
    const found = items.find((p) => p.id === id) ?? null;
    onChange(id, found);
  }

  return (
    <div>
      <label className="text-label-sm text-on-surface-variant mb-1 block">Proveedor</label>
      <Combobox
        value={value}
        onChange={handleChange}
        onSearch={setSearchQuery}
        options={options}
        isLoading={isLoading}
        placeholder="Buscar por nombre o RFC..."
        renderOption={renderOption}
        footerSlot={footerSlot}
      />
    </div>
  );
}
