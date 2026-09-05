import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { AuthError, ForbiddenError } from '../lib/errors.js';

/** Exige un access token valido en `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AuthError('Falta el token de acceso.');
    }
    const claims = verifyAccessToken(token);
    req.admin = { id: claims.sub, role: claims.role, email: claims.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(new AuthError());
    if (!roles.includes(req.admin.role)) return next(new ForbiddenError());
    next();
  };
}
