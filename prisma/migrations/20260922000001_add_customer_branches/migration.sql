-- CreateTable
CREATE TABLE "customer_branches" (
    "customer_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_branches_pkey" PRIMARY KEY ("customer_id","branch_id")
);

-- CreateIndex
CREATE INDEX "customer_branches_branch_id_idx" ON "customer_branches"("branch_id");

-- AddForeignKey
ALTER TABLE "customer_branches" ADD CONSTRAINT "customer_branches_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_branches" ADD CONSTRAINT "customer_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap: clientes con historial de ventas/cotizaciones/facturas -> sus sucursales
INSERT INTO customer_branches (customer_id, branch_id)
SELECT DISTINCT customer_id, branch_id FROM sales    WHERE customer_id IS NOT NULL
UNION SELECT DISTINCT customer_id, branch_id FROM quotes   WHERE customer_id IS NOT NULL
UNION SELECT DISTINCT customer_id, branch_id FROM invoices WHERE customer_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Bootstrap: clientes sin historial -> sólo Matriz (is_headquarters); si no hay Matriz, todas las activas
INSERT INTO customer_branches (customer_id, branch_id)
SELECT c.id, b.id FROM customers c CROSS JOIN (
  SELECT id FROM branches WHERE is_headquarters = TRUE
  UNION ALL SELECT id FROM branches WHERE is_active = TRUE AND NOT EXISTS (SELECT 1 FROM branches WHERE is_headquarters = TRUE)
) b WHERE NOT EXISTS (SELECT 1 FROM customer_branches cb WHERE cb.customer_id = c.id)
ON CONFLICT DO NOTHING;
