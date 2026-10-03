"use client";

import { useState, useEffect } from "react";
import { ImageUploadField } from "../../../_components/molecules/ImageUploadField/ImageUploadField";
import { SatCatalogCombobox } from "../../../_components/molecules/SatCatalogCombobox/SatCatalogCombobox";
import { uploadTicketLogo } from "../_logic/services/uploadTicketLogo";
import { deleteTicketLogo } from "../_logic/services/deleteTicketLogo";
import { useTicketSettingsMutations } from "../_logic/hooks/useTicketSettingsMutations";
import type { TicketSettingsDto, PaperWidthDto } from "../_logic/types/api";

interface TicketSettingsFormProps {
  settings: TicketSettingsDto;
  canWrite: boolean;
  onChange: (updated: TicketSettingsDto) => void;
}

export function TicketSettingsForm({ settings, canWrite, onChange }: TicketSettingsFormProps) {
  const [footerText, setFooterText] = useState(settings.footerText ?? "");
  const [paperWidth, setPaperWidth] = useState<PaperWidthDto>(settings.paperWidth);
  const [businessName, setBusinessName] = useState(settings.businessName ?? "");
  const [businessRfc, setBusinessRfc] = useState(settings.businessRfc ?? "");
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress ?? "");
  const [businessPhone, setBusinessPhone] = useState(settings.businessPhone ?? "");
  const [businessEmail, setBusinessEmail] = useState(settings.businessEmail ?? "");
  const [businessTaxRegime, setBusinessTaxRegime] = useState(settings.businessTaxRegime ?? "");
  const [businessZipCode, setBusinessZipCode] = useState(settings.businessZipCode ?? "");
  const [legendText, setLegendText] = useState(settings.legendText ?? "");

  const businessZipCodeInvalid = businessZipCode.length > 0 && !/^\d{5}$/.test(businessZipCode);
  const businessEmailInvalid = businessEmail.length > 0 && !/^\S+@\S+\.\S+$/.test(businessEmail);

  const { isSaving, mutationError, clearError, update } = useTicketSettingsMutations(onChange);

  useEffect(() => {
    setFooterText(settings.footerText ?? "");
    setPaperWidth(settings.paperWidth);
    setBusinessName(settings.businessName ?? "");
    setBusinessRfc(settings.businessRfc ?? "");
    setBusinessAddress(settings.businessAddress ?? "");
    setBusinessPhone(settings.businessPhone ?? "");
    setBusinessEmail(settings.businessEmail ?? "");
    setBusinessTaxRegime(settings.businessTaxRegime ?? "");
    setBusinessZipCode(settings.businessZipCode ?? "");
    setLegendText(settings.legendText ?? "");
  }, [settings]);

  async function handleSave() {
    if (businessZipCodeInvalid || businessEmailInvalid) return;
    await update({
      footerText: footerText.trim() || null,
      paperWidth,
      businessName: businessName.trim() || null,
      businessRfc: businessRfc.trim() || null,
      businessAddress: businessAddress.trim() || null,
      businessPhone: businessPhone.trim() || null,
      businessEmail: businessEmail.trim() || null,
      businessTaxRegime: businessTaxRegime.trim() || null,
      businessZipCode: businessZipCode.trim() || null,
      legendText: legendText.trim() || null,
    });
  }

  const inputCls =
    "w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="text-label-md text-on-surface mb-2">Logo del ticket</p>
        <ImageUploadField
          currentUrl={settings.logoUrl}
          entityId="ticket-logo"
          canWrite={canWrite}
          onUploaded={(logoUrl) => onChange({ ...settings, logoUrl })}
          onDeleted={() => onChange({ ...settings, logoUrl: null })}
          uploadFn={uploadTicketLogo}
          deleteFn={deleteTicketLogo}
        />
      </div>

      <div className="space-y-4 border-t border-outline-variant pt-4">
        <p className="text-label-md text-on-surface font-semibold">Información del negocio</p>

        <div>
          <label htmlFor="business-name" className="block text-label-md text-on-surface mb-1">
            Razón social
          </label>
          <input
            id="business-name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value.slice(0, 200))}
            disabled={!canWrite}
            placeholder="Agrisas"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="business-rfc" className="block text-label-md text-on-surface mb-1">
            RFC
          </label>
          <input
            id="business-rfc"
            type="text"
            value={businessRfc}
            onChange={(e) => setBusinessRfc(e.target.value.slice(0, 13))}
            disabled={!canWrite}
            placeholder="AGR010101AB1"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="business-address" className="block text-label-md text-on-surface mb-1">
            Dirección
          </label>
          <input
            id="business-address"
            type="text"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value.slice(0, 300))}
            disabled={!canWrite}
            placeholder="Dirección, ciudad, CP"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="business-zip-code" className="block text-label-md text-on-surface mb-1">
            Código postal
          </label>
          <input
            id="business-zip-code"
            type="text"
            inputMode="numeric"
            value={businessZipCode}
            onChange={(e) => setBusinessZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
            disabled={!canWrite}
            placeholder="83000"
            className={inputCls}
          />
          {businessZipCodeInvalid && (
            <p className="mt-1 text-body-sm text-error">El código postal debe tener 5 dígitos.</p>
          )}
        </div>

        <div>
          <label htmlFor="business-phone" className="block text-label-md text-on-surface mb-1">
            Teléfono
          </label>
          <input
            id="business-phone"
            type="text"
            value={businessPhone}
            onChange={(e) => setBusinessPhone(e.target.value.slice(0, 30))}
            disabled={!canWrite}
            placeholder="Teléfono"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="business-email" className="block text-label-md text-on-surface mb-1">
            Correo de contacto
          </label>
          <input
            id="business-email"
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value.slice(0, 200))}
            disabled={!canWrite}
            placeholder="contacto@agrisas.mx"
            className={inputCls}
          />
          {businessEmailInvalid && (
            <p className="mt-1 text-body-sm text-error">Correo inválido.</p>
          )}
        </div>

        <div>
          <label htmlFor="business-tax-regime" className="block text-label-md text-on-surface mb-1">
            Régimen Fiscal
          </label>
          <SatCatalogCombobox
            catalog="regimen-fiscal"
            id="business-tax-regime"
            value={businessTaxRegime}
            onChange={(code, description) =>
              setBusinessTaxRegime(description ? `${code} — ${description}`.slice(0, 120) : code.slice(0, 120))
            }
            disabled={!canWrite}
            placeholder="612 — Personas Físicas con Actividad Empresarial"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-outline-variant pt-4">
        <p className="text-label-md text-on-surface font-semibold">Texto del ticket</p>

        <div>
          <label htmlFor="footer-text" className="block text-label-md text-on-surface mb-1">
            Texto de pie
          </label>
          <textarea
            id="footer-text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value.slice(0, 500))}
            disabled={!canWrite}
            rows={2}
            placeholder="Gracias por su compra"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="legend-text" className="block text-label-md text-on-surface mb-1">
            Leyenda del ticket
          </label>
          <textarea
            id="legend-text"
            value={legendText}
            onChange={(e) => setLegendText(e.target.value.slice(0, 500))}
            disabled={!canWrite}
            rows={3}
            placeholder="Favor de revisar su mercancía. No se hacen cambios ni devoluciones. Gracias por su compra."
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <p className="block text-label-md text-on-surface mb-1">Ancho de papel</p>
        <div className="flex gap-3">
          {(["58mm", "80mm"] as const).map((width) => (
            <label key={width} className="flex items-center gap-2 text-body-sm text-on-surface">
              <input
                type="radio"
                name="paperWidth"
                value={width}
                checked={paperWidth === width}
                onChange={() => setPaperWidth(width)}
                disabled={!canWrite}
              />
              {width}
            </label>
          ))}
        </div>
      </div>

      {mutationError && (
        <div className="rounded bg-error-container/30 px-3 py-2 text-body-sm text-error flex items-center justify-between gap-2">
          {mutationError.message}
          <button type="button" onClick={clearError} className="text-error hover:underline flex-shrink-0">Cerrar</button>
        </div>
      )}

      {canWrite && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || businessZipCodeInvalid || businessEmailInvalid}
          className="px-4 py-2 rounded text-label-lg bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>
      )}
    </div>
  );
}
