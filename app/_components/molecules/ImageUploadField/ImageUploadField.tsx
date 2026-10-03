"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog";
import { Icon } from "../../atoms/Icon/Icon";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

interface ImageUploadFieldProps {
  currentUrl: string | null;
  entityId: string;
  canWrite: boolean;
  onUploaded: (newUrl: string) => void;
  onDeleted: () => void;
  uploadFn: (entityId: string, file: File) => Promise<string>;
  deleteFn: (entityId: string) => Promise<void>;
  confirmDeleteDescription?: string;
}

export function ImageUploadField({
  currentUrl,
  entityId,
  canWrite,
  onUploaded,
  onDeleted,
  uploadFn,
  deleteFn,
  confirmDeleteDescription = "¿Confirmas eliminar la imagen del producto?",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return "Formato no permitido. Usa JPG, PNG o WebP.";
    if (file.size > MAX_BYTES) return "La imagen excede 2 MB.";
    return null;
  }

  async function handleFile(file: File) {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError(null);
    setIsUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    try {
      const url = await uploadFn(entityId, file);
      setPreview(url);
      URL.revokeObjectURL(objectUrl);
      onUploaded(url);
    } catch (e: unknown) {
      setPreview(currentUrl);
      setError(e instanceof Error ? e.message : "Error al subir imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setIsUploading(true);
    try {
      await deleteFn(entityId);
      setPreview(null);
      onDeleted();
    } catch {
      setError("Error al eliminar imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative border-2 border-dashed border-outline-variant rounded-md flex items-center justify-center bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors"
        style={{ width: 128, height: 128 }}
        onClick={() => canWrite && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!canWrite) return;
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Vista previa"
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-on-surface-variant text-center px-2">
            <Icon name="image_not_supported" className="text-3xl" />
            {canWrite && <span className="text-label-sm">Arrastra o haz click</span>}
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70 rounded-md">
            <Icon name="progress_activity" className="animate-spin" />
          </div>
        )}
      </div>

      {canWrite && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="text-label-sm text-primary hover:underline disabled:opacity-40"
          >
            {preview ? "Cambiar" : "Subir imagen"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isUploading}
              className="text-label-sm text-error hover:underline disabled:opacity-40"
            >
              Eliminar imagen
            </button>
          )}
        </div>
      )}

      {error && <p className="text-label-sm text-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar imagen"
        description={confirmDeleteDescription}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
