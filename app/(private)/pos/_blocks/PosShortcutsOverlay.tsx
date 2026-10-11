"use client";

import { useEffect, useRef } from "react";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";

interface PosShortcutsOverlayProps {
  canToggleMode: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "F"], desc: "Enfocar buscador de productos (sustituye búsqueda del navegador)" },
  { keys: ["↑", "↓"], desc: "Navegar filas del catálogo o líneas del carrito" },
  { keys: ["Enter"], desc: "Añadir producto al carrito / Cambiar precio de línea" },
  { keys: ["+", "="], desc: "Aumentar cantidad de la línea enfocada" },
  { keys: ["-"], desc: "Disminuir cantidad de la línea enfocada" },
  { keys: ["Del"], desc: "Quitar la línea del carrito" },
  { keys: ["Ctrl", "→"], desc: "Mover foco al carrito" },
  { keys: ["Ctrl", "←"], desc: "Mover foco al catálogo / buscador" },
  { keys: ["Ctrl", "Enter"], desc: "Confirmar venta o cotización" },
  { keys: ["Ctrl", "Shift", "⌫"], desc: "Vaciar carrito (pide confirmación)" },
  { keys: ["Esc"], desc: "Cerrar modal activo" },
  { keys: ["?"], desc: "Mostrar / cerrar esta pantalla" },
];

const toggleShortcuts = [
  { keys: ["Alt", "V"], desc: "Cambiar a modo Venta" },
  { keys: ["Alt", "C"], desc: "Cambiar a modo Cotización" },
];

export function PosShortcutsOverlay({ canToggleMode, onClose }: PosShortcutsOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const allShortcuts = canToggleMode ? [...shortcuts, ...toggleShortcuts] : shortcuts;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl backdrop:bg-black/40 max-h-[80vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-title-md font-semibold text-on-surface">Atajos de teclado</h2>
        <IconButton icon="close" iconSize={18} ariaLabel="Cerrar" onClick={onClose} />
      </div>

      <table className="w-full text-left text-body-sm">
        <tbody>
          {allShortcuts.map((s) => (
            <tr key={s.desc} className="border-b border-outline-variant last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap">
                <span className="flex items-center gap-1 flex-wrap">
                  {s.keys.map((k, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <kbd className="inline-flex items-center px-2 py-0.5 rounded-sm bg-surface-container-high text-label-sm font-mono border border-outline-variant">
                        {k}
                      </kbd>
                      {i < s.keys.length - 1 && <span className="text-on-surface-variant">+</span>}
                    </span>
                  ))}
                </span>
              </td>
              <td className="py-2 text-on-surface-variant">{s.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-label-sm text-on-surface-variant">
        Presiona <kbd className="px-1 py-0.5 rounded-sm bg-surface-container-high text-label-sm font-mono border border-outline-variant">Esc</kbd> para cerrar.
      </p>
    </dialog>
  );
}
