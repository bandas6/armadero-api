import type { NextFunction, Request, Response } from 'express';
import { adminSettingsUpdateSchema } from '../schemas/admin-settings.schema.js';
import { getAdminSettings, updateSettings } from '../services/admin-settings.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const getHandler = wrap(async (_req, res) => {
  res.json(await getAdminSettings());
});

export const updateHandler = wrap(async (req, res) => {
  const patch = adminSettingsUpdateSchema.parse(req.body);
  res.json(await updateSettings(patch));
});
