/**
 * Guardarraíl del sistema de diseño (ver designer.md y
 * openspec/specs/design-system/spec.md). Escanea app/ en busca de las
 * regresiones que originaron la estandarización: clases tipográficas fuera
 * de escala, hex crudo, gris genérico de Tailwind y radios fuera de escala.
 *
 * La escala tipográfica se lee de tailwind.config.ts en vez de duplicarse
 * aquí, para que añadir un token no requiera tocar este test.
 */
import * as fs from "fs";
import * as path from "path";
import tailwindConfig from "../../../../tailwind.config";

const APP_ROOT = path.resolve(__dirname, "../../../../app");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function rel(file: string): string {
  return path.relative(path.resolve(__dirname, "../../../.."), file).split(path.sep).join("/");
}

const ALL_TSX_FILES = walk(APP_ROOT);
const PRIVATE_AND_COMPONENTS_FILES = ALL_TSX_FILES.filter((f) => {
  const r = rel(f);
  return r.startsWith("app/(private)/") || r.startsWith("app/_components/");
});

// --- Regla: escala tipográfica cerrada ---------------------------------

const fontSizeConfig = (tailwindConfig as { theme: { extend: { fontSize: Record<string, unknown> } } })
  .theme.extend.fontSize;
const VALID_TYPOGRAPHY_TOKENS = new Set(Object.keys(fontSizeConfig));

const TYPOGRAPHY_CLASS_RE = /\btext-((?:display|headline|title|body|label)-[a-z0-9-]+)\b/g;

describe("design-system tokens — escala tipográfica", () => {
  it("toda clase text-<categoria>-<variante> pertenece a la escala de tailwind.config.ts", () => {
    const offenders: string[] = [];
    for (const file of ALL_TSX_FILES) {
      const content = fs.readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      TYPOGRAPHY_CLASS_RE.lastIndex = 0;
      while ((match = TYPOGRAPHY_CLASS_RE.exec(content))) {
        const token = match[1];
        if (!VALID_TYPOGRAPHY_TOKENS.has(token)) {
          offenders.push(`${rel(file)}: text-${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no hay tamaños de fuente arbitrarios (text-[Npx])", () => {
    const ARBITRARY_SIZE_RE = /\btext-\[\d+px\]/;
    const offenders = ALL_TSX_FILES
      .filter((f) => ARBITRARY_SIZE_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

// --- Regla: color exclusivamente por token semántico --------------------
// Ámbito: app/(private) y app/_components. app/(public)/auth/* está exento
// (paleta legacy agrisas-*), según frontend-scaffold.

const HEX_EXEMPT_FILES = new Set([
  // Impresión térmica: negro literal y fallback CSS var, fuera del tema M3
  // (sales-ticket-preview-ui / ticket-print-ui ya documentan esta excepción).
  "app/(private)/sales/_blocks/PrintableTicket.tsx",
  "app/(private)/sales/[id]/ticket/_blocks/TicketPreviewPage.tsx",
]);

describe("design-system tokens — color por token semántico", () => {
  it("sin hex crudo en app/(private) o app/_components", () => {
    const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
    const offenders = PRIVATE_AND_COMPONENTS_FILES
      .filter((f) => !HEX_EXEMPT_FILES.has(rel(f)))
      .filter((f) => HEX_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("sin valores arbitrarios de color (bg-[#...], text-[#...], border-[#...])", () => {
    const ARBITRARY_COLOR_RE = /\b(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/;
    const offenders = PRIVATE_AND_COMPONENTS_FILES
      .filter((f) => ARBITRARY_COLOR_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("sin paleta gris genérica de Tailwind (bg-gray-*, border-gray-*, text-gray-*)", () => {
    const GRAY_RE = /\b(?:bg|border|text)-gray-\d+\b/;
    const offenders = PRIVATE_AND_COMPONENTS_FILES
      .filter((f) => GRAY_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

// --- Regla: radios dentro de la escala Stitch ---------------------------

describe("design-system tokens — radios", () => {
  it("sin rounded-2xl ni rounded-3xl (fuera de la escala Stitch)", () => {
    const OUT_OF_SCALE_RADIUS_RE = /\brounded-(?:2xl|3xl)\b/;
    const offenders = ALL_TSX_FILES
      .filter((f) => OUT_OF_SCALE_RADIUS_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

// --- Regla: sin <button>/<table>/<select> crudos en _blocks/ nuevos -----
//
// Allowlist = deuda declarada (ver designer.md § Pendientes): formularios
// internos de modales y tablas de reportes aún no migrados a Button/DataTable/
// Select. La lista SHALL poder encoger pero no crecer sin justificación en el
// change correspondiente (openspec/specs/design-system/spec.md).

const RAW_ELEMENT_ALLOWLIST = new Set([
  "app/(private)/dashboard/_blocks/ActivityFeed.tsx",
  "app/(private)/dashboard/_blocks/LowStockAlerts.tsx",
  "app/(private)/pos/_blocks/PosShortcutsOverlay.tsx", // único <table> restante: lista estática de atajos de teclado (no es data grid de negocio), fuera de alcance de shrink-design-debt-allowlist-sales-flow
  "app/(private)/reports/_blocks/ExportXlsxButton.tsx",
  "app/(private)/reports/_blocks/LedgerTable.tsx", // tabla migrada a DataTable; queda sólo por el <button> nativo de "imprimir anticipo" (fuera de alcance de migrate-report-tables-datatable)
  "app/(private)/reports/_blocks/StatementToolbar.tsx",
  "app/(private)/reports/collections/_blocks/global/CashCutFilters.tsx",
  "app/(private)/reports/collections/_blocks/by-customer/CollectionsFilters.tsx",
  "app/(private)/reports/purchases/_blocks/PurchasesFilters.tsx",
  "app/(private)/reports/sales-by-product/_blocks/SalesByProductFilters.tsx",
  "app/(private)/reports/sales-cut/_blocks/CutFilters.tsx",
  "app/(private)/roles/_blocks/RolePermissionsEditor.tsx",
  "app/(private)/roles/_blocks/RolesList.tsx",
  "app/(private)/sales/_blocks/PrintableTicket.tsx", // único <table> de layout de impresión térmica del ticket (estilos inline, colSpan) — no es tabla de datos de negocio, fuera de alcance de shrink-design-debt-allowlist-sales-flow
  "app/(private)/settings/_blocks/PricingSettingsForm.tsx",
  "app/(private)/settings/_blocks/TicketSettingsForm.tsx",
]);

describe("design-system tokens — sin elementos crudos nuevos en _blocks/", () => {
  it("todo <button>/<table>/<select> crudo en _blocks/ está en la allowlist de deuda declarada", () => {
    const RAW_ELEMENT_RE = /<(?:button|table|select)[\s/>]/;
    const blockFiles = ALL_TSX_FILES.filter((f) => rel(f).includes("/_blocks/"));
    const offenders = blockFiles
      .filter((f) => RAW_ELEMENT_RE.test(fs.readFileSync(f, "utf8")))
      .map(rel)
      .filter((r) => !RAW_ELEMENT_ALLOWLIST.has(r));
    expect(offenders).toEqual([]);
  });

  it("la allowlist no contiene archivos que ya no existen (mantenerla al día)", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const missing = [...RAW_ELEMENT_ALLOWLIST].filter((r) => !fs.existsSync(path.join(repoRoot, r)));
    expect(missing).toEqual([]);
  });
});
