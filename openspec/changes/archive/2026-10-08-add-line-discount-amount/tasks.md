## 1. Migración Prisma

- [x] 1.1 Agregar columna `discount_amount DECIMAL(5,2) NOT NULL DEFAULT 0` a `sale_items`, `quote_items`, `return_items` (migración escrita a mano + `prisma migrate deploy`, por drift preexistente en la DB dev que bloqueaba `migrate dev`/`migrate diff` contra la DB viva — ver nota en el chat).
- [x] 1.2 Reflejar los tres campos nuevos en `schema.prisma` (modelos `SaleItem`, `QuoteItem`, `ReturnItem`) y correr `npx prisma generate`.

## 2. Dominio compartido — cálculo de totales

- [x] 2.1 `src/shared/domain/services/LineTotalsCalculator.ts`: agregar `discountAmount?: number | null` a `LineTotalsInput`; validar `0 <= discountAmount <= 100`; validar exclusión mutua (`discountPct > 0 && discountAmount > 0` → throw); `lineGross = max(0, round(quantity * price * (1 - discountPct/100), 4) - discountAmount)`.
- [x] 2.2 `src/modules/pos/domain/services/SaleTotalsCalculator.ts`: pasar `discountAmount` al núcleo compartido en el `map`.
- [x] 2.3 `src/modules/quotes/domain/services/QuoteTotalsCalculator.ts`: idem.
- [x] 2.4 `src/modules/returns/domain/services/ReturnTotalsCalculator.ts`: idem.
- [x] 2.5 Confirmar que `src/modules/purchases/domain/services/PurchaseTotalsCalculator.ts` e `InvoiceTotalsCalculator` quedan sin tocar (no pasan `discountAmount`).

## 3. Backend — POS (ventas)

- [x] 3.1 `src/modules/pos/application/dto/CreateSaleRequest.ts` (`SaleItemInput`): agregar `discountPctOverride?: number | null`, `discountAmount?: number | null`.
- [x] 3.2 `src/modules/pos/application/dto/EditCompletedSaleRequest.ts`: confirmado — reusa `SaleItemInput`, sin cambios propios.
- [x] 3.3 `src/modules/pos/infrastructure/http/SalesController.ts` (`saleItemSchema`): agregado `discountPctOverride`/`discountAmount` `.min(0).max(100).nullable().optional()` + `.refine()` de exclusión mutua (reusado por `editSaleSchema`).
- [x] 3.4 `src/modules/pos/application/use-cases/CreateSaleUseCase.ts`: hecho.
- [x] 3.5 `src/modules/pos/application/use-cases/EditCompletedSaleUseCase.ts`: el use case DUPLICA la lógica de resolución (no reusa "Create sale" vía llamada compartida) — se aplicó el mismo cambio ahí directamente.
- [x] 3.6 Entidad `SaleItem` (`src/modules/pos/domain/entities/SaleItem.ts`): agregado `discountAmount`.
- [x] 3.7 `src/modules/pos/application/mappers/toSaleDto.ts`: hecho (+ `SaleItemDto` en `dto/SaleItemDto.ts`).
- [x] 3.8 `src/modules/pos/infrastructure/repositories/PrismaSaleRepository.ts`: hecho (`SnapshotLike`, `toSaleItemCreate`, `toSummary`, insert directo de `replaceItemsAndRecalculate`).
- [x] 3.9 `src/modules/pos/infrastructure/repositories/InMemorySaleRepository.ts`: hecho (`createCompleted` y `replaceItemsAndRecalculate`). También corregidos para compilar: `SaleRepository.ts` (`SnapshotItemInput`), y tests existentes que construyen `SaleItem.create(...)` directamente (`CreateSaleUseCase.test.ts`, `.branchScoping.test.ts`, `.customerBranch.test.ts`, `GetSaleUseCase.test.ts`, `SendSaleTicketEmailUseCase.test.ts`, `toSaleDto.test.ts`, `ReturnsController.test.ts`).

## 4. Backend — Cotizaciones

- [x] 4.1 `src/modules/quotes/application/dto/QuoteItemDto.ts` (`QuoteItemInput`): agregado `discountPctOverride?`, `discountAmount?`.
- [x] 4.2 `src/modules/quotes/infrastructure/http/QuotesController.ts` (`quoteItemSchema`): hecho (reusado por `createQuoteSchema`/`updateQuoteSchema`).
- [x] 4.3 `src/modules/quotes/application/use-cases/CreateQuoteUseCase.ts`: hecho.
- [x] 4.4 `src/modules/quotes/application/use-cases/UpdateQuoteUseCase.ts`: hecho (nota: el snapshot de edición ya usaba `ivaRate`/`iepsRate` sin el filtro `isTaxable` que sí tiene "Create quote" — inconsistencia preexistente, no tocada, fuera de alcance de este cambio).
- [x] 4.5 Entidad `QuoteItem`: hecho.
- [x] 4.6 Mapper `toQuoteDetailDto`/`toQuoteItemDto`: hecho.
- [x] 4.7 `PrismaQuoteRepository`: hecho (`toSummary`, `createWithItems`, `replaceItemsAndRecalculate`).
- [x] 4.8 `InMemoryQuoteRepository`: hecho (`createWithItems`, `replaceItemsAndRecalculate`).
- [x] 4.9 `ConvertQuoteToSaleUseCase.ts`: hecho — propaga `discountAmount` del `quote_item` al `sale_item` sin re-resolver catálogo. También corregidos para compilar: `tests/unit/modules/quotes/application/mappers/toQuoteDto.test.ts`, `tests/unit/modules/quotes/domain/entities/Quote.test.ts` (construcción directa de `QuoteItem`).

## 5. Backend — Devoluciones

- [x] 5.1 `src/modules/returns/domain/entities/ReturnItem.ts`: agregado `discountAmount: number` (no nullable, default 0 — espeja `SaleItem`).
- [x] 5.2 `src/modules/returns/application/use-cases/CreateReturnUseCase.ts`: hecho (snapshot + `ReturnTotalsCalculator.computeTotals`). También `ReturnRepository.ts` (`CreateReturnData.items[].discountAmount`).
- [x] 5.3 Mapper `toReturnItemDto`: hecho (+ `ReturnItemDto` en `dto/ReturnDto.ts`).
- [x] 5.4 `PrismaReturnRepository` (`createWithItems` y lectura `toReturnItem`): hecho.
- [x] 5.5 `InMemoryReturnRepository`: hecho. También corregido para compilar: `CreateReturnUseCase.test.ts`, `ReturnsController.test.ts` (construcción directa de `SaleItem`/`ReturnItem`).

## 6. Frontend — tipos y cálculo compartido

- [x] 6.1 `app/(private)/pos/_logic/types/domain.ts` (`CartLine`): hecho.
- [x] 6.2 `app/(private)/pos/_logic/lib/computeTotalsClient.ts`: hecho.
- [x] 6.3 `app/(private)/pos/_logic/hooks/useCart.ts`: hecho (`UPDATE_DISCOUNT_AMOUNT` + `updateDiscountAmount` expuesto; `UPDATE_DISCOUNT` también actualizado para resetear `discountAmount`/`discountType`).
- [x] 6.4 `app/(private)/pos/_logic/types/api.ts` (`SaleItemInputBody`, `SaleItemDto`) y `app/(private)/sales/_logic/types/api.ts` (`SaleItemDto`, `EditSaleBody`): hecho.
- [x] 6.5 `app/(private)/quotes/_logic/types/api.ts` (`QuoteItemDto`, `QuoteItemInputBody`): hecho.
- [x] 6.6 `useSaleSubmission.ts`, `useQuoteSubmission.ts`, `EditSalePage.tsx`, `QuoteEditPage.tsx`: hecho.

## 7. Frontend — UI

- [x] 7.1 `app/(private)/pos/_blocks/CartLine.tsx`: hecho — toggle %/$ + input único para líneas normales; líneas de dosificación conservan el input `Desc. %` plano de siempre (sin toggle, sin $), ver corrección en design.md Decisión 2.
- [x] 7.2 `app/(private)/pos/_blocks/CartLinesList.tsx`: hecho (`onUpdateDiscountAmount` separado).
- [x] 7.3 `app/(private)/pos/_blocks/CartPanel.tsx`: hecho. También propagado en los 4 callers reales: `PosPage.tsx`, `EditSalePage.tsx` (vía `CartPanel`), `QuoteEmitPanel.tsx` + `QuoteCreatePage.tsx`/`QuoteEditPage.tsx` (vía `CartLinesList` directo, no `CartPanel`).
- [x] 7.4 `app/(private)/sales/_blocks/SaleItemsTable.tsx`: hecho.
- [x] 7.5 `app/(private)/quotes/_blocks/QuoteItemsTable.tsx`: hecho.

## 8. Tests

- [x] 8.1 `LineTotalsCalculator.test.ts`: hecho.
- [x] 8.2 `SaleTotalsCalculator.test.ts`: hecho.
- [x] 8.3 `QuoteTotalsCalculator.test.ts`/`ReturnTotalsCalculator.test.ts`: hecho — con una desviación de diseño respecto a la tarea original: los vectores con `discountAmount` NO se agregaron a `totalsVectors` (fixture compartido con `PurchaseTotalsCalculator`, que no soporta el campo — mezclarlos rompería esa equivalencia legítimamente). Se creó `discountAmountVectors` separado en el mismo archivo, consumido por un bloque de equivalencia de 3 vías (Sale/Quote/Return) en `ReturnTotalsCalculator.test.ts`.
- [x] 8.4 `CreateSaleUseCase.test.ts` + `SalesController.test.ts`: hecho (persiste override, persiste amount, 400 por exclusión mutua y por rango, dosificación ignora ambos).
- [x] 8.5 `QuoteLifecycleUseCases.test.ts` (Create+Update) + `QuotesController.test.ts`: hecho.
- [x] 8.6 `CreateReturnUseCase.test.ts`: hecho.
- [x] 8.7 `computeTotalsClient.test.ts`: hecho.
- [x] 8.8 `useCart.test.ts`: hecho.
- [x] 8.9 `CartLine.test.tsx` (ya existía — se extendió, no se creó) + fix de compilación en `CartLinesList.keyboard.test.tsx`/`CartPanel.test.tsx` (prop nueva obligatoria).

## 9. Verificación

- [x] 9.1 `npm run build`: pasa limpio.
- [x] 9.2 `npm test` (backend + ui): re-verificado tras los fixes de 9.3 — 576/578 suites, 4325/4339 tests, 0 fallas (14 skipped preexistentes).
- [x] 9.3 Smoke manual (Playwright contra `npm run dev`): hecho. Flujo probado: login admin → `/pos` → agregar línea (precio $111) → toggle a `$` → descuento $20 → total carrito $91.00 (correcto en vivo) → venta creada → detalle `/sales/[id]` muestra "Desc.: $20.00" y total $91.00 (correcto) → devolución parcial de esa línea.
  - **Bug encontrado y corregido durante el smoke**: `computeReturnTotalsClient` (`app/(private)/returns/_logic/lib/computeReturnTotalsClient.ts`) — otro cálculo de totales duplicado en cliente (preview de "Registrar devolución"), no listado en el plan original, que ignoraba `discountAmount` (mostraba $111.00 en vez de $91.00 en el preview antes de confirmar). El backend ya calculaba bien (confirmado por `CreateReturnUseCase.test.ts`), así que no afectó dato persistido — sólo el preview visual pre-confirmación era incorrecto. Corregido + agregado a `CreateReturnPage.tsx` (pasa `discountAmount`) + tests nuevos en `computeReturnTotalsClient.test.ts` (equivalencia con `discountAmountVectors` + caso explícito).
  - **Segundo bug encontrado y corregido**: `ReturnItemsTable.tsx` (tabla "Artículos devueltos" en `/returns/[id]`, distinta de `SaleItemsTable`/`QuoteItemsTable`) no mostraba `discountAmount` en la columna "Desc." — confirmado en vivo que el reembolso persistido era correcto ($91.00) pero la tabla de detalle mostraba "0%" en vez de "$20.00". Corregido con el mismo patrón que las otras dos tablas. También se agregó `discountAmount` a los tipos `ReturnItem`/`ReturnItemDto` del frontend (`app/(private)/returns/_logic/types/{domain,api}.ts`), que habían quedado fuera del plan original (sólo se cubrieron los tipos de `sales`/`quotes`/`pos`).
  - `npm run build` re-verificado limpio después de estos fixes adicionales.
