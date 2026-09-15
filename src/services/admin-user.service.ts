import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/catalog.model.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import type { AdminUserCreate, AdminUserUpdate } from '../schemas/admin-user.schema.js';

export type AdminUserRow = {
  _id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const BCRYPT_ROUNDS = 12;

function toRow(u: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}): AdminUserRow {
  return {
    _id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role as 'ADMIN' | 'EDITOR',
    active: u.active,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt ? u.createdAt.toISOString() : '',
  };
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await AdminUser.find().sort({ createdAt: 1 }).lean();
  return users.map(toRow);
}

export async function createAdminUser(input: AdminUserCreate): Promise<AdminUserRow> {
  const email = input.email.toLowerCase();
  const clash = await AdminUser.findOne({ email }).select('_id').lean();
  if (clash) throw new UnprocessableError('Ya hay un usuario con ese correo.');
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await AdminUser.create({ name: input.name, email, passwordHash, role: input.role });
  return toRow(user);
}

/** Cierra todas las sesiones abiertas de un usuario (cambio de clave, desactivacion). */
async function revokeSessions(userId: string) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

/** No se puede dejar el panel sin ningun ADMIN activo. */
async function assertAnotherActiveAdmin(exceptId: string) {
  const others = await AdminUser.countDocuments({
    _id: { $ne: exceptId },
    role: 'ADMIN',
    active: true,
  });
  if (others === 0) {
    throw new UnprocessableError('Tiene que quedar al menos otro administrador activo.');
  }
}

export async function updateAdminUser(
  id: string,
  patch: AdminUserUpdate,
  actorId: string,
): Promise<AdminUserRow> {
  const user = await AdminUser.findById(id).select('+passwordHash');
  if (!user) throw new NotFoundError('Usuario no encontrado.');

  // Uno no se quita a si mismo el rol ni se desactiva: se quedaria fuera del panel.
  if (id === actorId && (patch.active === false || (patch.role && patch.role !== 'ADMIN'))) {
    throw new UnprocessableError('No puedes quitarte el acceso a ti mismo.');
  }

  const losesAdmin =
    user.role === 'ADMIN' &&
    user.active &&
    ((patch.role !== undefined && patch.role !== 'ADMIN') || patch.active === false);
  if (losesAdmin) await assertAnotherActiveAdmin(id);

  if (patch.email !== undefined) {
    const email = patch.email.toLowerCase();
    const clash = await AdminUser.findOne({ email, _id: { $ne: id } }).select('_id').lean();
    if (clash) throw new UnprocessableError('Ya hay un usuario con ese correo.');
    user.email = email;
  }
  if (patch.name !== undefined) user.name = patch.name;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.active !== undefined) user.active = patch.active;

  let cutSessions = patch.active === false;
  if (patch.password !== undefined) {
    user.passwordHash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS);
    cutSessions = true;
  }

  await user.save();
  if (cutSessions) await revokeSessions(id);
  return toRow(user);
}

/** La propia contraseña: exige la actual y cierra las demas sesiones. */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await AdminUser.findById(userId).select('+passwordHash');
  if (!user || !user.active) throw new NotFoundError('Usuario no encontrado.');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new UnprocessableError('La contraseña actual no coincide.');
  if (currentPassword === newPassword) {
    throw new UnprocessableError('La contraseña nueva es igual a la actual.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
  await revokeSessions(userId);
}
