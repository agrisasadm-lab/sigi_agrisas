import { serialize } from "cookie";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RegisterUseCase } from "@/modules/auth/application/use-cases/RegisterUseCase";
import { LoginUseCase } from "@/modules/auth/application/use-cases/LoginUseCase";
import { RefreshTokenUseCase } from "@/modules/auth/application/use-cases/RefreshTokenUseCase";
import { LogoutUseCase } from "@/modules/auth/application/use-cases/LogoutUseCase";
import { CompletePasswordSetupUseCase } from "@/modules/auth/application/use-cases/CompletePasswordSetupUseCase";
import { SendSetPasswordEmailUseCase } from "@/modules/auth/application/use-cases/SendSetPasswordEmailUseCase";
import { EmailAlreadyInUseError } from "@/modules/auth/domain/errors/EmailAlreadyInUseError";
import { InvalidCredentialsError } from "@/modules/auth/domain/errors/InvalidCredentialsError";
import { PasswordNotSetError } from "@/modules/auth/domain/errors/PasswordNotSetError";
import { PasswordSetupTokenInvalidError } from "@/modules/auth/domain/errors/PasswordSetupTokenInvalidError";
import { PasswordSetupTokenExpiredError } from "@/modules/auth/domain/errors/PasswordSetupTokenExpiredError";
import { UserNotFoundError } from "@/modules/auth/domain/errors/UserNotFoundError";
import { SetPasswordEmailSendFailedError } from "@/modules/auth/domain/errors/SetPasswordEmailSendFailedError";
import { GetUserUseCase } from "@/modules/users/application/use-cases/GetUserUseCase";
import { UpdateOwnProfileUseCase } from "@/modules/users/application/use-cases/UpdateOwnProfileUseCase";
import { checkRateLimit } from "@/shared/infrastructure/http/rateLimit";
import {
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
  clearCookieOptions,
} from "./cookieOptions";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const updateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.name !== undefined || d.email !== undefined, {
    message: "At least one field (name, email) must be provided",
  });

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly completePasswordSetupUseCase: CompletePasswordSetupUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateOwnProfileUseCase: UpdateOwnProfileUseCase,
    private readonly sendSetPasswordEmailUseCase: SendSetPasswordEmailUseCase
  ) {}

  async register(req: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    try {
      const result = await this.registerUseCase.execute(parsed.data);
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      console.error("[AuthController.register] unexpected error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  async login(req: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    try {
      const { refreshToken, ...publicResult } = await this.loginUseCase.execute(
        parsed.data
      );
      const res = NextResponse.json(publicResult, { status: 200 });
      res.headers.set(
        "Set-Cookie",
        serialize(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions)
      );
      return res;
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      if (err instanceof PasswordNotSetError) {
        return NextResponse.json({ error: "PasswordNotSet" }, { status: 403 });
      }
      console.error("[AuthController.login] unexpected error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  async completeSetPassword(req: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    try {
      const { refreshToken, ...publicResult } = await this.completePasswordSetupUseCase.execute(
        parsed.data
      );
      const res = NextResponse.json(publicResult, { status: 200 });
      res.headers.set(
        "Set-Cookie",
        serialize(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions)
      );
      return res;
    } catch (err) {
      if (err instanceof PasswordSetupTokenExpiredError) {
        return NextResponse.json({ error: "PasswordSetupTokenExpired" }, { status: 400 });
      }
      if (err instanceof PasswordSetupTokenInvalidError) {
        return NextResponse.json({ error: "PasswordSetupTokenInvalid" }, { status: 400 });
      }
      console.error("[AuthController.completeSetPassword] unexpected error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  async refresh(req: NextRequest): Promise<NextResponse> {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k.trim(), v.join("=")];
      })
    );
    const refreshToken = cookies[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
    }

    try {
      const { accessToken, newRefreshToken } = this.refreshTokenUseCase.execute(refreshToken);
      const res = NextResponse.json({ accessToken }, { status: 200 });
      res.headers.set(
        "Set-Cookie",
        serialize(REFRESH_TOKEN_COOKIE, newRefreshToken, refreshCookieOptions)
      );
      return res;
    } catch (err) {
      const isExpired = err instanceof jwt.TokenExpiredError;
      return NextResponse.json(
        { error: isExpired ? "Refresh token expired" : "Invalid refresh token" },
        { status: 401 }
      );
    }
  }

  logout(_req: NextRequest): NextResponse {
    this.logoutUseCase.execute();
    const res = NextResponse.json({ message: "Logged out" }, { status: 200 });
    res.headers.set(
      "Set-Cookie",
      serialize(REFRESH_TOKEN_COOKIE, "", clearCookieOptions)
    );
    return res;
  }

  async me(req: NextRequest): Promise<NextResponse> {
    const userId = req.headers.get("x-user-id") ?? "";
    try {
      const user = await this.getUserUseCase.execute(userId);
      return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  }

  async updateMe(req: NextRequest): Promise<NextResponse> {
    const userId = req.headers.get("x-user-id") ?? "";
    const body = await req.json().catch(() => ({}));
    const parsed = updateMeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const user = await this.updateOwnProfileUseCase.execute({
        id: userId,
        name: parsed.data.name,
        email: parsed.data.email,
      });
      return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err instanceof UserNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  }

  async sendMyPasswordLink(req: NextRequest): Promise<NextResponse> {
    const userId = req.headers.get("x-user-id") ?? "";
    const rateLimit = checkRateLimit(`send-password-link:${userId}`, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "TooManyRequests", retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429 }
      );
    }
    try {
      const { sentTo } = await this.sendSetPasswordEmailUseCase.execute(userId);
      return NextResponse.json({ sentTo }, { status: 200 });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      if (err instanceof SetPasswordEmailSendFailedError) {
        return NextResponse.json({ error: "EmailDeliveryFailed" }, { status: 502 });
      }
      throw err;
    }
  }
}
