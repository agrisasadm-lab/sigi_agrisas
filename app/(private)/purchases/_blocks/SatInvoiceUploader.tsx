"use client";

import { useRef, useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { parseSatInvoice, SatXmlParseError, ParsedSatInvoice } from "../_logic/lib/satXmlParser";

interface SatInvoiceUploaderProps {
  onParsed: (parsed: ParsedSatInvoice, fileName: string) => void;
  disabled?: boolean;
}

export function SatInvoiceUploader({ onParsed, disabled }: SatInvoiceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setError("Selecciona un archivo con extensión .xml");
      return;
    }
    setIsReading(true);
    try {
      const text = await file.text();
      const parsed = parseSatInvoice(text);
      onParsed(parsed, file.name);
    } catch (err) {
      if (err instanceof SatXmlParseError) setError(err.message);
      else setError("No se pudo leer el archivo XML.");
    } finally {
      setIsReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border border-dashed border-outline bg-surface-container-low p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        disabled={disabled || isReading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="text"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isReading}
        className="flex w-full flex-col gap-1 rounded py-3 text-center hover:bg-surface-container-high"
      >
        {isReading ? (
          <Spinner size="sm" />
        ) : (
          <Icon name="upload_file" className="text-on-surface-variant" />
        )}
        <span className="text-body-sm font-medium text-on-surface">
          {isReading ? "Leyendo factura..." : "Cargar XML de factura (CFDI)"}
        </span>
        <span className="text-label-sm text-on-surface-variant">
          Prellena proveedor, productos, impuestos y UUID automáticamente
        </span>
      </Button>
      {error && <p className="mt-2 text-center text-label-sm text-error">{error}</p>}
    </div>
  );
}
