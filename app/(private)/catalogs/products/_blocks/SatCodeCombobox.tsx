"use client";

import { useState, useRef, useEffect } from "react";
import { useSatCodesSearch } from "../../../../_hooks/useSatCodesSearch";
import { Button } from "../../../../_components/atoms/Button/Button";

interface SatCodeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SatCodeCombobox({ value, onChange, disabled, className }: SatCodeComboboxProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { options } = useSatCodesSearch(query);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(raw: string) {
    setQuery(raw);
    onChange(raw);
    setIsOpen(true);
  }

  function handleSelect(code: string) {
    setQuery(code);
    onChange(code);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        disabled={disabled}
        placeholder="Buscar código o descripción SAT..."
        className={className}
      />
      {isOpen && options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded border border-outline-variant bg-surface shadow-lg">
          {options.map((opt) => (
            <li key={opt.code}>
              <Button
                type="button"
                variant="text"
                onClick={() => handleSelect(opt.code)}
                className="w-full rounded-none justify-start px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low"
              >
                <span className="font-mono">{opt.code}</span> — {opt.description}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
