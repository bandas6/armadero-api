import type { NextFunction, Request, Response } from 'express';
import { buildSitemap } from '../services/sitemap.service.js';

export async function sitemapHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const xml = await buildSitemap();
    res.type('application/xml').send(xml);
  } catch (err) {
    next(err);
  }
}
