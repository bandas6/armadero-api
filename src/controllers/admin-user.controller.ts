import type { NextFunction, Request, Response } from 'express';
import {
  adminUserCreateSchema,
  adminUserIdParam,
  adminUserUpdateSchema,
} from '../schemas/admin-user.schema.js';
import { changePasswordSchema } from '../schemas/auth.schema.js';
import * as service from '../services/admin-user.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const listHandler = wrap(async (_req, res) => {
  res.json(await service.listAdminUsers());
});

export const createHandler = wrap(async (req, res) => {
  const input = adminUserCreateSchema.parse(req.body);
  res.status(201).json(await service.createAdminUser(input));
});

export const updateHandler = wrap(async (req, res) => {
  const { id } = adminUserIdParam.parse(req.params);
  const patch = adminUserUpdateSchema.parse(req.body);
  res.json(await service.updateAdminUser(id, patch, req.admin!.id));
});

/** POST /auth/password: la propia contraseña, con la actual como comprobacion. */
export const changePasswordHandler = wrap(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await service.changeOwnPassword(req.admin!.id, currentPassword, newPassword);
  res.status(204).end();
});
