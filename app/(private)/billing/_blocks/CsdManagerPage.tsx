"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useCsdManager } from "../_logic/hooks/useCsdManager";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Button } from "../../../_components/atoms/Button/Button";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";

export function CsdManagerPage() {
  const { can } = useCurrentUser();
  const canManage = can("billing:manage_csd");

  const { status, isLoading: statusLoading, statusError, isUploading, uploadError, uploadSuccess, clearUploadError, upload } = useCsdManager();

  const [rfc, setRfc] = useState("");
  const [password, setPassword] = useState("");
  const [legalName, setLegalName] = useState("");
  const [fiscalRegime, setFiscalRegime] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!status) return;
    setRfc((current) => current || status.rfc || "");
    setLegalName((current) => current || status.legalName || "");
    setFiscalRegime((current) => current || status.fiscalRegime || "");
    setZipCode((current) => current || status.zipCode || "");
    setAddress((current) => current || status.address || "");
  }, [status]);

  if (canManage === "loading") {
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (canManage === false) {
    return <EmptyState icon="block" title="Sin acceso" description="Solo administradores pueden gestionar el CSD." />;
  }

  async function handleSubmit() {
    clearUploadError();
    const cerFile = cerRef.current?.files?.[0];
    const keyFile = keyRef.current?.files?.[0];
    if (!rfc.trim() || !cerFile || !keyFile || !password) {
      return;
    }
    await upload({
      rfc: rfc.trim(),
      cerFile,
      keyFile,
      password,
      legalName: legalName.trim() || undefined,
      fiscalRegime: fiscalRegime.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
    });
    setPassword("");
    if (cerRef.current) cerRef.current.value = "";
    if (keyRef.current) keyRef.current.value = "";
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-headline-sm font-semibold text-on-surface mb-1">Certificado de Sello Digital (CSD)</h1>
        <p className="text-body-md text-on-surface-variant">Configura el CSD para habilitar el timbrado de CFDI 4.0 vía Facturama.</p>
      </div>

      {/* Estado actual */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
        <h2 className="text-title-sm font-semibold text-on-surface mb-3">Estado actual</h2>
        {statusLoading ? (
          <Spinner size="sm" />
        ) : statusError ? (
          <p className="text-body-sm text-on-surface-variant">{statusError.message}</p>
        ) : status ? (
          <dl className="grid grid-cols-2 gap-3 text-body-sm">
            {status.rfc && <div><dt className="text-label-sm text-on-surface-variant">RFC</dt><dd className="font-mono">{status.rfc}</dd></div>}
            {status.legalName && <div><dt className="text-label-sm text-on-surface-variant">Razón social</dt><dd>{status.legalName}</dd></div>}
            {status.fiscalRegime && <div><dt className="text-label-sm text-on-surface-variant">Régimen fiscal</dt><dd className="font-mono">{status.fiscalRegime}</dd></div>}
            {status.zipCode && <div><dt className="text-label-sm text-on-surface-variant">Código postal</dt><dd className="font-mono">{status.zipCode}</dd></div>}
            {status.address && <div><dt className="text-label-sm text-on-surface-variant">Dirección</dt><dd>{status.address}</dd></div>}
            {status.alias && <div><dt className="text-label-sm text-on-surface-variant">Alias</dt><dd>{status.alias}</dd></div>}
            {status.issuedAt && <div><dt className="text-label-sm text-on-surface-variant">Emitido</dt><dd>{status.issuedAt}</dd></div>}
            {status.expiresAt && <div><dt className="text-label-sm text-on-surface-variant">Vence</dt><dd>{status.expiresAt}</dd></div>}
            {status.status && <div><dt className="text-label-sm text-on-surface-variant">Estado</dt><dd>{String(status.status)}</dd></div>}
          </dl>
        ) : (
          <p className="text-body-sm text-on-surface-variant">Sin CSD configurado.</p>
        )}
      </div>

      {/* Formulario de carga */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
        <h2 className="text-title-sm font-semibold text-on-surface mb-4">Cargar / actualizar CSD</h2>

        {uploadSuccess && (
          <div className="mb-4 rounded bg-green-100 border border-green-300 px-4 py-3 text-body-sm text-green-800">
            CSD cargado correctamente en Facturama.
          </div>
        )}

        {uploadError && (
          <div className="mb-4 rounded bg-error-container/30 border border-error/30 px-4 py-3 text-body-sm text-error flex items-start justify-between gap-2">
            <span>{uploadError.message}</span>
            <IconButton icon="close" iconSize={16} ariaLabel="Cerrar" onClick={clearUploadError} className="flex-shrink-0 hover:bg-transparent hover:opacity-70" />
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="csd-rfc" className="block text-label-md text-on-surface mb-1">RFC del CSD <span className="text-error">*</span></label>
            <input
              id="csd-rfc"
              type="text"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              maxLength={13}
              placeholder="XAXX010101000"
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono uppercase"
            />
          </div>
          <div>
            <label htmlFor="csd-legal-name" className="block text-label-md text-on-surface mb-1">Razón social</label>
            <input
              id="csd-legal-name"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              maxLength={200}
              placeholder="Agrisas SA de CV"
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="csd-fiscal-regime" className="block text-label-md text-on-surface mb-1">Régimen fiscal</label>
              <input
                id="csd-fiscal-regime"
                type="text"
                value={fiscalRegime}
                onChange={(e) => setFiscalRegime(e.target.value.replace(/\D/g, ""))}
                maxLength={3}
                placeholder="601"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label htmlFor="csd-zip-code" className="block text-label-md text-on-surface mb-1">Código postal</label>
              <input
                id="csd-zip-code"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ""))}
                maxLength={5}
                placeholder="83000"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="csd-address" className="block text-label-md text-on-surface mb-1">Dirección</label>
            <textarea
              id="csd-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Calle, número, colonia, ciudad, estado"
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="csd-cer" className="block text-label-md text-on-surface mb-1">Certificado (.cer) <span className="text-error">*</span></label>
            <input
              id="csd-cer"
              ref={cerRef}
              type="file"
              accept=".cer"
              className="w-full text-body-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:px-3 file:py-1 file:text-label-sm file:bg-surface file:text-on-surface file:cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="csd-key" className="block text-label-md text-on-surface mb-1">Llave privada (.key) <span className="text-error">*</span></label>
            <input
              id="csd-key"
              ref={keyRef}
              type="file"
              accept=".key"
              className="w-full text-body-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:px-3 file:py-1 file:text-label-sm file:bg-surface file:text-on-surface file:cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="csd-password" className="block text-label-md text-on-surface mb-1">Contraseña de la llave <span className="text-error">*</span></label>
            <input
              id="csd-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-label-sm text-on-surface-variant">La contraseña se usa únicamente para esta carga y no se persiste.</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            type="button"
            variant="filled"
            onClick={handleSubmit}
            disabled={!rfc || !password}
            loading={isUploading}
            className="px-6 py-2.5 text-label-lg"
          >
            Cargar CSD
          </Button>
        </div>
      </div>
    </div>
  );
}
