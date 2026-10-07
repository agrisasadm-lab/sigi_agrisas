import { UserMapper, UserPrismaModel } from "@/modules/auth/application/mappers/UserMapper";

const raw: UserPrismaModel = {
  id: "uuid-1",
  name: "Alice",
  email: "test@example.com",
  passwordHash: "$2b$10$somehash",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
};

describe("UserMapper", () => {
  it("maps Prisma row to domain User", () => {
    const user = UserMapper.toDomain(raw);
    expect(user.id).toBe("uuid-1");
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("test@example.com");
    expect(user.passwordHash).toBe("$2b$10$somehash");
    expect(user.createdAt).toEqual(new Date("2026-01-01"));
  });

  it("maps Prisma row with null name to domain User with undefined name", () => {
    const user = UserMapper.toDomain({ ...raw, name: null });
    expect(user.name).toBeUndefined();
  });

});
