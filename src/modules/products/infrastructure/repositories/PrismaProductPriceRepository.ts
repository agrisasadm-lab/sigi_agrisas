import { PrismaClient, Prisma, ProductPrice as PrismaProductPrice } from "@prisma/client";
import {
  ProductPriceRepository,
  CreateProductPriceData,
  UpdateProductPriceData,
} from "../../application/ports/ProductPriceRepository";
import { ProductPrice } from "../../domain/entities/ProductPrice";
import { sortProductPricesForDisplay } from "../../domain/services/sortProductPricesForDisplay";
import { ProductPriceNotFoundError } from "../../domain/errors/ProductPriceNotFoundError";
import { DuplicatePriceNameError } from "../../domain/errors/DuplicatePriceNameError";
import { DuplicateDefaultPriceError } from "../../domain/errors/DuplicateDefaultPriceError";
import {
  isPrismaUniqueError as isUniqueError,
  isPrismaNotFoundError as isNotFoundError,
} from "@/shared/infrastructure/prisma/errors";

function toProductPrice(row: PrismaProductPrice): ProductPrice {
  return ProductPrice.create({
    id: row.id,
    productId: row.productId,
    branchId: row.branchId,
    name: row.name,
    price: row.price.toNumber(),
    minQuantity: row.minQuantity,
    discountPct: row.discountPct === null ? null : row.discountPct.toNumber(),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function mapWriteError(err: unknown, name: string): never {
  if (isUniqueError(err, "default")) throw new DuplicateDefaultPriceError();
  if (isUniqueError(err)) throw new DuplicatePriceNameError(name);
  throw err;
}

export class PrismaProductPriceRepository implements ProductPriceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProductAndBranch(productId: string, branchId: string): Promise<ProductPrice[]> {
    const rows = await this.prisma.productPrice.findMany({ where: { productId, branchId } });
    return sortProductPricesForDisplay(rows.map(toProductPrice));
  }

  async findById(id: string): Promise<ProductPrice | null> {
    const row = await this.prisma.productPrice.findUnique({ where: { id } });
    return row ? toProductPrice(row) : null;
  }

  async findDefaultByProductId(productId: string, branchId: string): Promise<ProductPrice | null> {
    const row = await this.prisma.productPrice.findFirst({
      where: { productId, branchId, isDefault: true },
    });
    return row ? toProductPrice(row) : null;
  }

  async create(data: CreateProductPriceData): Promise<ProductPrice> {
    try {
      const row = await this.prisma.productPrice.create({
        data: {
          productId: data.productId,
          branchId: data.branchId,
          name: data.name,
          price: data.price,
          minQuantity: data.minQuantity,
          discountPct: data.discountPct ?? null,
          isDefault: data.isDefault,
        },
      });
      return toProductPrice(row);
    } catch (err) {
      mapWriteError(err, data.name);
    }
  }

  async update(id: string, data: UpdateProductPriceData): Promise<ProductPrice> {
    try {
      const row = await this.prisma.productPrice.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.minQuantity !== undefined ? { minQuantity: data.minQuantity } : {}),
          ...("discountPct" in data ? { discountPct: data.discountPct ?? null } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
      return toProductPrice(row);
    } catch (err) {
      if (isNotFoundError(err)) throw new ProductPriceNotFoundError(id);
      mapWriteError(err, data.name ?? "");
    }
  }

  async unsetDefaultForProduct(productId: string, branchId: string, exceptId?: string): Promise<void> {
    await this.prisma.productPrice.updateMany({
      where: { productId, branchId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  }

  async unsetDefaultAndUpdate(
    productId: string,
    branchId: string,
    priceId: string,
    data: UpdateProductPriceData
  ): Promise<ProductPrice> {
    const [, row] = await this.prisma.$transaction([
      this.prisma.productPrice.updateMany({
        where: { productId, branchId, isDefault: true, id: { not: priceId } },
        data: { isDefault: false },
      }),
      this.prisma.productPrice.update({
        where: { id: priceId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.minQuantity !== undefined ? { minQuantity: data.minQuantity } : {}),
          ...("discountPct" in data ? { discountPct: data.discountPct ?? null } : {}),
          isDefault: true,
        },
      }),
    ]);
    return toProductPrice(row);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.productPrice.delete({ where: { id } });
    } catch (err) {
      if (isNotFoundError(err)) throw new ProductPriceNotFoundError(id);
      throw err;
    }
  }
}
