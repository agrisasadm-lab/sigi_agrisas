"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../../../_components/atoms/Button/Button";
import { useSaleTicketEmail } from "../../../_logic/hooks/useSaleTicketEmail";
import { SaleNoEmailError, SaleEmailSendFailedError } from "../../../_logic/errors";

interface SendTicketEmailModalProps {
  saleId: string;
  open: boolean;
  onClose: () => void;
}

export function SendTicketEmailModal({ saleId, open, onClose }: SendTicketEmailModalProps) {
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSendingEmail, sendEmail } = useSaleTicketEmail();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else { dialog.close(); setEmail(""); setLocalError(null); setSuccess(null); }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  async function handleSubmit() {
    setLocalError(null);
    setSuccess(null);
    try {
      const result = await sendEmail(saleId, email.trim() || undefined);
      setSuccess(`Correo enviado a ${result.sentTo}`);
    } catch (err) {
      if (err instanceof SaleNoEmailError) {
        setLocalError("El cliente no tiene correo registrado. Escribe uno para enviar el ticket.");
      } else if (err instanceof SaleEmailSendFailedError) {
        setLocalError("No se pudo enviar el correo. Verifica la configuración SMTP e intenta de nuevo.");
      } else {
        setLocalError("Error inesperado al enviar el correo");
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="send-ticket-email-modal-title"
      className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
    >
      <h2 id="send-ticket-email-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
        Enviar ticket por correo
      </h2>
      <p className="text-body-md text-on-surface-variant mb-4">
        Se enviará un resumen del ticket al correo del cliente, o al que indiques abajo.
      </p>

      {localError && (
        <div className="mb-4 rounded bg-error-container/30 px-3 py-2 text-body-sm text-error">
          {localError}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded bg-tertiary-container/30 px-3 py-2 text-body-sm text-on-tertiary-container">
          {success}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="send-ticket-email-override" className="block text-label-md text-on-surface mb-1">
          Correo (opcional — vacío usa el del cliente)
        </label>
        <input
          id="send-ticket-email-override"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@ejemplo.com"
          className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="text"
          onClick={onClose}
          disabled={isSendingEmail}
          className="rounded px-4 py-2 text-on-surface hover:bg-surface-container-highest"
        >
          Cerrar
        </Button>
        <Button type="button" variant="filled" onClick={handleSubmit} loading={isSendingEmail}>
          Enviar
        </Button>
      </div>
    </dialog>
  );
}
