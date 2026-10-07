import { User } from "@/modules/auth/domain/entities/User";

export interface UserPrismaModel {
  id: string;
  name?: string | null;
  email: string;
  passwordHash: string | null;
  branchId?: string | null;
  roles?: { role: { name: string } }[];
  createdAt: Date;
  updatedAt: Date;
}

export class UserMapper {
  static toDomain(raw: UserPrismaModel): User {
    return User.create(raw.id, {
      name: raw.name ?? undefined,
      email: raw.email,
      passwordHash: raw.passwordHash,
      roles: raw.roles?.map((r) => r.role.name) ?? [],
      branchId: raw.branchId ?? null,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }


}
