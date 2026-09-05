import type { NextFunction, Request, Response } from 'express';
import { getPublicSettings } from '../services/settings.service.js';

export async function getSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getPublicSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
}
