-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "discount_amount" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "discount_amount" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "return_items" ADD COLUMN     "discount_amount" DECIMAL(5,2) NOT NULL DEFAULT 0;
