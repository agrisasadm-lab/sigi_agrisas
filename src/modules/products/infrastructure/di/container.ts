import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaTaxRateRepository } from "@/modules/tax-rates/infrastructure/repositories/PrismaTaxRateRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaProductDosificationRepository } from "@/modules/products/infrastructure/repositories/PrismaProductDosificationRepository";
import { PrismaPricingSettingsRepository } from "@/modules/settings/infrastructure/repositories/PrismaPricingSettingsRepository";
import { PrismaBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository";
import { ListProductsUseCase } from "@/modules/products/application/use-cases/ListProductsUseCase";
import { GetProductUseCase } from "@/modules/products/application/use-cases/GetProductUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { UpdateProductUseCase } from "@/modules/products/application/use-cases/UpdateProductUseCase";
import { SoftDeleteProductUseCase } from "@/modules/products/application/use-cases/SoftDeleteProductUseCase";
import { UploadProductImageUseCase } from "@/modules/products/application/use-cases/UploadProductImageUseCase";
import { DeleteProductImageUseCase } from "@/modules/products/application/use-cases/DeleteProductImageUseCase";
import { SupabaseProductImageStorage } from "@/modules/products/infrastructure/services/SupabaseProductImageStorage";
import { ListProductPricesUseCase } from "@/modules/products/application/use-cases/ListProductPricesUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { UpdateProductPriceUseCase } from "@/modules/products/application/use-cases/UpdateProductPriceUseCase";
import { DeleteProductPriceUseCase } from "@/modules/products/application/use-cases/DeleteProductPriceUseCase";
import { ListProductDosificationsUseCase } from "@/modules/products/application/use-cases/ListProductDosificationsUseCase";
import { CreateProductDosificationUseCase } from "@/modules/products/application/use-cases/CreateProductDosificationUseCase";
import { UpdateProductDosificationUseCase } from "@/modules/products/application/use-cases/UpdateProductDosificationUseCase";
import { SoftDeleteProductDosificationUseCase } from "@/modules/products/application/use-cases/SoftDeleteProductDosificationUseCase";
import { ProductsController } from "@/modules/products/infrastructure/http/ProductsController";
import { ProductPricesController } from "@/modules/products/infrastructure/http/ProductPricesController";
import { ProductDosificationsController } from "@/modules/products/infrastructure/http/ProductDosificationsController";
import { branchRepo } from "@/modules/branches/infrastructure/di/container";

const departmentRepo = new PrismaDepartmentRepository(prisma);
const taxRateRepo = new PrismaTaxRateRepository(prisma);
const productRepo = new PrismaProductRepository(prisma);
const priceRepo = new PrismaProductPriceRepository(prisma);
const dosificationRepo = new PrismaProductDosificationRepository(prisma);
const pricingSettingsRepo = new PrismaPricingSettingsRepository(prisma);
const imageStorage = new SupabaseProductImageStorage();
const branchInventoryRepo = new PrismaBranchInventoryRepository(prisma);

export const productsController = new ProductsController(
  new ListProductsUseCase(productRepo),
  new GetProductUseCase(productRepo),
  new CreateProductUseCase(productRepo, departmentRepo, taxRateRepo, branchInventoryRepo),
  new UpdateProductUseCase(productRepo, departmentRepo, taxRateRepo),
  new SoftDeleteProductUseCase(productRepo),
  new UploadProductImageUseCase(productRepo, imageStorage),
  new DeleteProductImageUseCase(productRepo, imageStorage),
);

export const productPricesController = new ProductPricesController(
  new ListProductPricesUseCase(productRepo, priceRepo, branchRepo),
  new CreateProductPriceUseCase(productRepo, priceRepo, branchRepo),
  new UpdateProductPriceUseCase(priceRepo),
  new DeleteProductPriceUseCase(priceRepo)
);

export const productDosificationsController = new ProductDosificationsController(
  new ListProductDosificationsUseCase(productRepo, priceRepo, dosificationRepo, pricingSettingsRepo),
  new CreateProductDosificationUseCase(productRepo, priceRepo, dosificationRepo, pricingSettingsRepo),
  new UpdateProductDosificationUseCase(priceRepo, dosificationRepo, pricingSettingsRepo),
  new SoftDeleteProductDosificationUseCase(dosificationRepo)
);
