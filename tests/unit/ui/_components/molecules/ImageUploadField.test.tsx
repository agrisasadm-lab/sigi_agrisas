/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../../../../../app/_components/molecules/ConfirmDialog/ConfirmDialog", () => ({
  ConfirmDialog: ({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirmar</button>
        <button onClick={onCancel}>Cancelar</button>
      </div>
    ) : null,
}));

import { ImageUploadField } from "../../../../../app/_components/molecules/ImageUploadField/ImageUploadField";

global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

const PRODUCT_ID = "prod-1";
const makeFile = (name: string, type: string, size: number): File => {
  const f = new File(["x".repeat(size)], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("ImageUploadField", () => {
  it("shows placeholder when currentUrl is null", () => {
    render(
      <ImageUploadField
        currentUrl={null} entityId={PRODUCT_ID} canWrite={true}
        onUploaded={jest.fn()} onDeleted={jest.fn()}
        uploadFn={jest.fn()} deleteFn={jest.fn()}
      />
    );
    expect(screen.getByText(/Arrastra o haz click/i)).toBeInTheDocument();
  });

  it("shows image preview when currentUrl is set", () => {
    render(
      <ImageUploadField
        currentUrl="https://example.com/img.jpg" entityId={PRODUCT_ID} canWrite={true}
        onUploaded={jest.fn()} onDeleted={jest.fn()}
        uploadFn={jest.fn()} deleteFn={jest.fn()}
      />
    );
    expect(screen.getByAltText("Vista previa")).toHaveAttribute("src", "https://example.com/img.jpg");
  });

  it("shows error for invalid MIME type", async () => {
    render(
      <ImageUploadField
        currentUrl={null} entityId={PRODUCT_ID} canWrite={true}
        onUploaded={jest.fn()} onDeleted={jest.fn()}
        uploadFn={jest.fn()} deleteFn={jest.fn()}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = makeFile("doc.pdf", "application/pdf", 100);
    Object.defineProperty(input, "files", { value: [pdfFile] });
    fireEvent.change(input);
    expect(await screen.findByText(/Formato no permitido/i)).toBeInTheDocument();
  });

  it("shows error when file > 2 MB", async () => {
    render(
      <ImageUploadField
        currentUrl={null} entityId={PRODUCT_ID} canWrite={true}
        onUploaded={jest.fn()} onDeleted={jest.fn()}
        uploadFn={jest.fn()} deleteFn={jest.fn()}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = makeFile("big.jpg", "image/jpeg", 3 * 1024 * 1024);
    Object.defineProperty(input, "files", { value: [bigFile] });
    fireEvent.change(input);
    expect(await screen.findByText(/excede 2 MB/i)).toBeInTheDocument();
  });

  it("calls uploadFn with valid file and invokes onUploaded", async () => {
    const uploadFn = jest.fn().mockResolvedValue("https://storage.test/new.jpg");
    const onUploaded = jest.fn();
    render(
      <ImageUploadField
        currentUrl={null} entityId={PRODUCT_ID} canWrite={true}
        onUploaded={onUploaded} onDeleted={jest.fn()}
        uploadFn={uploadFn} deleteFn={jest.fn()}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = makeFile("photo.jpg", "image/jpeg", 500 * 1024);
    Object.defineProperty(input, "files", { value: [validFile] });
    fireEvent.change(input);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("https://storage.test/new.jpg"));
  });

  it("does not show upload controls when canWrite=false", () => {
    render(
      <ImageUploadField
        currentUrl="https://example.com/img.jpg" entityId={PRODUCT_ID} canWrite={false}
        onUploaded={jest.fn()} onDeleted={jest.fn()}
        uploadFn={jest.fn()} deleteFn={jest.fn()}
      />
    );
    expect(screen.queryByText(/Cambiar/i)).toBeNull();
    expect(screen.queryByText(/Eliminar imagen/i)).toBeNull();
  });
});
