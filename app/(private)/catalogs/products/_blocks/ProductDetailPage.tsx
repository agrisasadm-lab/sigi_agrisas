"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { getProduct } from "../_logic/services/products";
import { useDepartmentsOptions } from "../../../../_hooks/useDepartmentsOptions";
import { ProductGeneralTab } from "./ProductGeneralTab";
import { ProductPricesTab } from "./ProductPricesTab";
import { ProductDosificationsTab } from "./ProductDosificationsTab";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { ProductImage } from "../../../../_components/atoms/ProductImage/ProductImage";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { ProductNotFoundError } from "../_logic/errors";
import type { Product } from "../_logic/types/domain";

type Tab = "general" | "prices" | "dosifications";
const VALID_TABS: readonly Tab[] = ["general", "prices", "dosifications"];

interface ProductDetailPageProps {
  productId: string;
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { can } = useCurrentUser();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = requestedTab && VALID_TABS.includes(requestedTab) ? requestedTab : "general";
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const { options: deptOptions } = useDepartmentsOptions();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    getProduct({ id: productId })
      .then((p) => { if (!cancelled) setProduct(p); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ProductNotFoundError) setNotFound(true);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  const canWrite = can("products:write");

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Icon name="inventory_2" size={48} className="text-on-surface-variant" />
        <h2 className="text-title-md text-on-surface">Producto no encontrado</h2>
        <Link
          href="/catalogs/products"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Icon name="arrow_back" size={16} />
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "general" as Tab, label: "General" },
    { id: "prices" as Tab, label: "Precios" },
    { id: "dosifications" as Tab, label: "Dosificaciones" },
  ];

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      <div className="flex items-start gap-3">
        <Link
          href="/catalogs/products"
          className="mt-1 p-1 rounded hover:bg-surface-container transition-colors"
          title="Volver"
        >
          <Icon name="arrow_back" size={20} />
        </Link>
        <ProductImage src={product.imageUrl ?? null} alt={product.name} size={96} />
        <div>
          <h1 className="text-headline-sm font-semibold text-on-surface">{product.name}</h1>
          <p className="text-label-lg font-mono text-on-surface-variant">{product.code}</p>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-body-md text-on-surface-variant">
              <span className="font-medium">Departamento:</span> {product.departmentName}
            </p>
            <p className="text-body-md text-on-surface-variant">
              <span className="font-medium">Proveedor:</span> {product.providerName ?? "Sin proveedor"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-outline-variant">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-label-lg font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <ProductGeneralTab
          product={product}
          canWrite={canWrite === true}
          deptOptions={deptOptions}
          onUpdated={setProduct}
        />
      )}
      {tab === "prices" && (
        <ProductPricesTab productId={product.id} canWrite={canWrite === true} />
      )}
      {tab === "dosifications" && (
        <ProductDosificationsTab productId={product.id} canWrite={canWrite === true} />
      )}
    </div>
  );
}
