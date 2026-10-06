## MODIFIED Requirements

### Requirement: Folio sequence audit endpoint
The system SHALL expose `GET /api/v1/admin/folios/:id/audit` that returns the full sequence of documents issued under a given folio. The endpoint requires the `folios:read` permission. The folio MUST exist; otherwise the system returns HTTP 404. An optional `branchId` query parameter (UUID) selects which sequence to audit.

**`purchases` is now included** in the UNION alongside `sales`, `quotes`, `customer_payments` — the omission of purchase documents from folio audits (they were never counted or checked for gaps) is corrected as part of this capability, since folio `CP` is one of the folios that gains per-branch counters and an accurate audit of `CP` requires seeing every document type issued under it.

**Without `branchId`** (default, backward compatible): the response reflects the LEGACY global sequence only — `currentNumber` is `folios.current_number`, and `sequence`/`gaps`/`totalIssued` are computed only over documents whose `folioCode` matches the legacy format (no branch suffix). This preserves the exact pre-existing behavior for folios that were never branch-scoped (`RB`, `AB`, `DEV`, `PP`, `TS`), and shows the historical legacy series for `TK`/`TC`/`COT`/`CP`.

**With `branchId`** (resolved per standard branch scoping — a caller without `branches:access_all` MUST pass their own branch; mismatch → HTTP 403; non-existent branch → HTTP 404 `{"error": "Branch not found"}`): for folios in `{TK, TC, COT, CP}`, `currentNumber` becomes that branch's counter from `folio_branch_counters` (`0` if no row exists), and `sequence`/`gaps`/`totalIssued` are computed only over documents whose `folioCode` matches that branch's pattern (`<prefix><BRANCH_CODE>-%`) — this is what separates the new per-branch series from the legacy global one; without this filter, a legacy document's low folio number would incorrectly appear as filling a gap in the new branch sequence, or vice versa. For folios NOT in that set, `branchId` has no effect — the response is identical to the no-`branchId` case, since those folios have no per-branch counter.

The response SHALL be:
```json
{
  "folioId": "uuid",
  "code": "TK",
  "prefix": "TK-",
  "branchId": "uuid | null",
  "branchCode": "string | null",
  "currentNumber": 42,
  "totalIssued": 42,
  "gaps": [],
  "truncated": false,
  "sequence": [
    {
      "number": 1,
      "documentType": "sale",
      "documentId": "uuid",
      "status": "completed",
      "issuedAt": "ISO8601"
    }
  ]
}
```

- `branchId`/`branchCode`: `null` when the request omitted `branchId` (legacy/global audit); otherwise the resolved branch's id and `code`.
- `gaps`: array of integers representing folio numbers in `[1..currentNumber]` that appear in no document of the audited series (legacy or branch-specific). An empty array means the sequence is intact.
- `truncated`: `true` when total issued documents in the audited series exceed 10 000; in that case `sequence` is empty and `gaps` is `[]`. Gap detection requires the full sequence and is intentionally skipped when truncated to avoid reporting inaccurate results from partial data.
- `documentType`: `'sale' | 'quote' | 'payment' | 'purchase'`
- `status`: document-specific status string (e.g., `completed`, `cancelled`, `edited`, `draft`, `authorized`, `converted`).
- `issuedAt`: the document's `created_at` timestamp.
- `sequence` is ordered by `number` ascending.

The query MUST use a UNION over `sales`, `quotes`, `customer_payments`, `purchases` filtering by `folio_id = :id AND folio_number IS NOT NULL`, additionally filtered by `folio_code LIKE '<prefix><BRANCH_CODE>-%'` when `branchId` is present and the folio is branch-scoped.

#### Scenario: Folio with intact sequence
- **WHEN** an authenticated user with `folios:read` calls `GET /api/v1/admin/folios/:id/audit`
- **THEN** the system returns HTTP 200 with `gaps: []` and `sequence` containing one entry per issued document

#### Scenario: Folio with gap detected
- **WHEN** folio number 3 was never assigned (e.g., due to a DB inconsistency)
- **THEN** `gaps` includes `3` and `totalIssued` does not count it

#### Scenario: Cancelled document keeps its number
- **WHEN** a sale with `status='cancelled'` was issued under this folio
- **THEN** its entry appears in `sequence` with `status: 'cancelled'` and no gap is recorded for its number

#### Scenario: Folio not found
- **WHEN** the `:id` does not match any folio
- **THEN** the system returns HTTP 404 `{"error": "Folio not found"}`

#### Scenario: Unauthorized user
- **WHEN** user lacks `folios:read`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "folios:read"}`

#### Scenario: Large folio truncated
- **WHEN** total issued documents exceed 10 000
- **THEN** `truncated: true`, `sequence: []`, `gaps: []`, summary fields still populated

#### Scenario: Purchases now count toward CP's audit
- **WHEN** folio `CP` has 5 completed purchases and no other document type under it
- **THEN** `totalIssued: 5` and `sequence` includes all 5 with `documentType: "purchase"` — before this capability, purchases were invisible to this endpoint and `totalIssued` would have incorrectly been `0`

#### Scenario: Branch-scoped audit isolates that branch's sequence
- **WHEN** the request includes `?branchId=<ZARIOZ>` for folio `TK`, and ZARIOZ has issued `TK-ZARIOZ-000001`..`000005` with no gaps, while a legacy `TK-000038` also exists in the table (issued before per-branch counters existed)
- **THEN** the response's `currentNumber: 5`, `gaps: []`, and `sequence` includes only the 5 ZARIOZ-branded documents — the legacy `TK-000038` is excluded, neither counted as part of the sequence nor flagged as a gap

#### Scenario: Omitting branchId shows only the legacy series
- **WHEN** folio `TK` has both legacy documents (`TK-000001`..`TK-000038`) and new branch-scoped documents (`TK-ZARIOZ-000001`..) issued after this capability, and the request omits `branchId`
- **THEN** the response reflects only the legacy series (`currentNumber` from `folios.current_number`, `sequence` filtered to the legacy `folioCode` format) — the branch-scoped documents are not included, since they belong to a separate series with its own audit path

#### Scenario: Branch mismatch without bypass rejected
- **WHEN** an operator without `branches:access_all`, assigned to ZARIOZ, requests `?branchId=<PRADERA>`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

### Requirement: Folio audit UI modal
The system SHALL render a `FolioAuditModal` accessible via an "Auditar" action in `FoliosTable`. The modal SHALL:

- Display `totalIssued`, `currentNumber`, a badge "Secuencia íntegra" (green) when `gaps.length === 0`, or "X huecos detectados" (red) when gaps exist.
- Render a table of the sequence with columns: Número, Tipo, Estado, Fecha, with client-side pagination of 50 rows per page.
- When `truncated: true`, hide the table and show an informational banner "La secuencia supera 10,000 documentos. Solo se muestra el resumen."
- Show a loading state while fetching.
- Be accessible only to users with `folios:read`.
- For folios whose `code` is one of `{TK, TC, COT, CP}`, show a branch selector above the summary: "Global (histórico)" (default, no `branchId`) plus one option per branch the user is authorized to audit (their own branch, or every active branch when the user has `branches:access_all`). Selecting a branch re-fetches `?branchId=<id>` and updates the summary/table to that branch's series. For any other folio, the selector is not rendered (branchId has no effect for those).

#### Scenario: Modal opens with intact sequence
- **WHEN** user clicks "Auditar" on a folio
- **THEN** the modal opens, fetches `/api/v1/admin/folios/:id/audit`, and shows the green badge and sequence table

#### Scenario: Modal shows gaps
- **WHEN** the audit response contains `gaps: [3, 7]`
- **THEN** the modal shows a red badge "2 huecos detectados" and lists gap numbers

#### Scenario: Truncated response
- **WHEN** `truncated: true` in the response
- **THEN** the table is hidden and a banner is shown instead

#### Scenario: Branch selector shown for branch-scoped folios
- **WHEN** the audited folio's `code` is `TK`
- **THEN** the modal shows a branch selector defaulting to "Global (histórico)", with one option per branch the user may audit

#### Scenario: Selecting a branch re-fetches that branch's audit
- **WHEN** the user selects "ZARIOZ" from the branch selector
- **THEN** the modal re-fetches `/api/v1/admin/folios/:id/audit?branchId=<ZARIOZ>` and updates the summary/table to ZARIOZ's series

#### Scenario: Branch selector hidden for non-branch-scoped folios
- **WHEN** the audited folio's `code` is `RB`
- **THEN** no branch selector is rendered — the summary/table always shows the single global series
