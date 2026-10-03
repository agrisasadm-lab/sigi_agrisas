import { Prisma, PrismaClient } from "@prisma/client";
import {
  ExpenseRepository,
  FindAllExpensesOptions,
  CreateExpenseData,
  UpdateExpenseData,
  HistoryFilters,
  HistoryPagination,
  HistoryResult,
} from "@/modules/expenses/application/ports/ExpenseRepository";
import { Expense } from "@/modules/expenses/domain/entities/Expense";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";
import { isPrismaNotFoundError } from "@/shared/infrastructure/prisma/errors";

const INCLUDE_JOINS = {
  branch: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
} as const;

type PrismaExpense = {
  id: string;
  branchId: string;
  concept: string;
  amount: Prisma.Decimal;
  notes: string | null;
  photoUrl: string | null;
  expenseDate: Date;
  creatorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string } | null;
  creator: { id: string; name: string | null } | null;
};

function toDomain(row: PrismaExpense): Expense {
  return Expense.create(row.id, {
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    concept: row.concept,
    amount: row.amount.toString(),
    notes: row.notes,
    photoUrl: row.photoUrl,
    expenseDate: row.expenseDate,
    creatorId: row.creatorId,
    creatorName: row.creator?.name ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function buildWhere(opts: {
  includeInactive?: boolean;
  branchId?: string;
  concept?: string;
  from?: Date;
  to?: Date;
}): Prisma.ExpenseWhereInput {
  return {
    ...(opts.includeInactive ? {} : { isActive: true }),
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.concept ? { concept: { contains: opts.concept, mode: "insensitive" } } : {}),
    ...(opts.from || opts.to
      ? {
          expenseDate: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  };
}

export class PrismaExpenseRepository implements ExpenseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll({ page, pageSize, includeInactive, branchId, concept, from, to }: FindAllExpensesOptions): Promise<{ items: Expense[]; total: number }> {
    const where = buildWhere({ includeInactive, branchId, concept, from, to });
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.expense.findMany({ where, skip, take: pageSize, orderBy: { expenseDate: "desc" }, include: INCLUDE_JOINS }),
      this.prisma.expense.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Expense | null> {
    const row = await this.prisma.expense.findUnique({ where: { id }, include: INCLUDE_JOINS });
    return row ? toDomain(row) : null;
  }

  async create(data: CreateExpenseData): Promise<Expense> {
    const row = await this.prisma.expense.create({
      data: {
        branchId: data.branchId,
        concept: data.concept,
        amount: data.amount,
        notes: data.notes ?? null,
        expenseDate: data.expenseDate,
        creatorId: data.creatorId,
      },
      include: INCLUDE_JOINS,
    });
    return toDomain(row);
  }

  async update(id: string, data: UpdateExpenseData): Promise<Expense> {
    try {
      return toDomain(
        await this.prisma.expense.update({
          where: { id },
          data: {
            ...(data.concept !== undefined ? { concept: data.concept } : {}),
            ...(data.amount !== undefined ? { amount: data.amount } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(data.expenseDate !== undefined ? { expenseDate: data.expenseDate } : {}),
          },
          include: INCLUDE_JOINS,
        })
      );
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new ExpenseNotFoundError();
      throw err;
    }
  }

  async updatePhotoUrl(id: string, photoUrl: string | null): Promise<Expense> {
    try {
      return toDomain(
        await this.prisma.expense.update({ where: { id }, data: { photoUrl }, include: INCLUDE_JOINS })
      );
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new ExpenseNotFoundError();
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.expense.update({ where: { id }, data: { isActive: false } });
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new ExpenseNotFoundError();
      throw err;
    }
  }

  async findHistory(filters: HistoryFilters, pagination?: HistoryPagination): Promise<HistoryResult> {
    const where = buildWhere(filters);
    const [rows, total, aggregate] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        include: INCLUDE_JOINS,
        ...(pagination ? { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize } : {}),
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      items: rows.map(toDomain),
      total,
      totalAmount: (aggregate._sum.amount ?? new Prisma.Decimal(0)).toString(),
    };
  }
}
