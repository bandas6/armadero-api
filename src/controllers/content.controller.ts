import type { NextFunction, Request, Response } from 'express';
import { slugParam } from '../schemas/admin-content.schema.js';
import {
  getPublicCollection,
  listPublicBanners,
  listPublicCollections,
  listPublicShippingZones,
} from '../services/admin-content.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const listBannersHandler = wrap(async (_req, res) => res.json(await listPublicBanners()));

export const listCollectionsHandler = wrap(async (_req, res) =>
  res.json(await listPublicCollections()),
);

export const getCollectionHandler = wrap(async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  res.json(await getPublicCollection(slug));
});

export const listShippingZonesHandler = wrap(async (_req, res) =>
  res.json(await listPublicShippingZones()),
);
