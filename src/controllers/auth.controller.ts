import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { loginSchema } from '../schemas/auth.schema.js';
import {
  login,
  logout,
  refreshSession,
  getSessionUser,
  REFRESH_MAX_AGE_MS,
} from '../services/auth.service.js';
import { env } from '../lib/env.js';
import { AuthError } from '../lib/errors.js';

const REFRESH_COOKIE = 'rt';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/api/admin/auth',
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await login(email, password, req.header('user-agent') ?? undefined);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new AuthError('No hay sesión activa.');
    const result = await refreshSession(raw, req.header('user-agent') ?? undefined);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/admin/auth' });
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/admin/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req.admin!.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
