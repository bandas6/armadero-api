import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { AdminUser } from '../models/catalog.model.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { env } from '../lib/env.js';
import { AuthError } from '../lib/errors.js';

export type AccessClaims = { sub: string; role: string; email: string };
export type SessionUser = { id: string; email: string; name: string; role: string };

const REFRESH_BYTES = 48;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(user: { id: string; role: string; email: string }): string {
  const payload: AccessClaims = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  } catch {
    throw new AuthError('Sesión inválida o vencida.');
  }
}

/** ms de duracion del refresh a partir de "7d" / "24h" / "3600s" / numero en segundos. */
function refreshMs(): number {
  const raw = env.JWT_REFRESH_EXPIRES.trim();
  const m = raw.match(/^(\d+)\s*([smhd])?$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2] ?? 's';
  const factor = { s: 1e3, m: 60e3, h: 3600e3, d: 86_400e3 }[unit]!;
  return n * factor;
}

export const REFRESH_MAX_AGE_MS = refreshMs();

async function issueRefreshToken(userId: string, userAgent?: string) {
  const raw = crypto.randomBytes(REFRESH_BYTES).toString('base64url');
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    userAgent,
  });
  return raw;
}

function toSessionUser(u: {
  _id: unknown;
  email: string;
  name: string;
  role: string;
}): SessionUser {
  return { id: String(u._id), email: u.email, name: u.name, role: u.role };
}

export async function login(email: string, password: string, userAgent?: string) {
  const user = await AdminUser.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user || !user.active) throw new AuthError('Correo o contraseña incorrectos.');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError('Correo o contraseña incorrectos.');

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ id: String(user._id), role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(String(user._id), userAgent);

  return { accessToken, refreshToken, user: toSessionUser(user) };
}

export async function refreshSession(rawToken: string, userAgent?: string) {
  const record = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!record) throw new AuthError('Sesión no encontrada. Inicia sesión de nuevo.');

  if (record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    // Reuso de un token ya rotado: alguien tiene una copia vieja. Corta todo.
    await RefreshToken.updateMany(
      { user: record.user, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new AuthError('Sesión vencida. Inicia sesión de nuevo.');
  }

  const user = await AdminUser.findById(record.user);
  if (!user || !user.active) throw new AuthError('Usuario no disponible.');

  const newRaw = await issueRefreshToken(String(user._id), userAgent);
  record.revokedAt = new Date();
  record.replacedByHash = hashToken(newRaw);
  await record.save();

  const accessToken = signAccessToken({ id: String(user._id), role: user.role, email: user.email });
  return { accessToken, refreshToken: newRaw, user: toSessionUser(user) };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { revokedAt: new Date() },
  );
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await AdminUser.findById(userId);
  if (!user || !user.active) throw new AuthError('Usuario no disponible.');
  return toSessionUser(user);
}
