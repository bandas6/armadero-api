import type { NextFunction, Request, Response } from 'express';
import {
  activeSchema,
  bannerCreateSchema,
  bannerUpdateSchema,
  collectionCreateSchema,
  collectionUpdateSchema,
  idParam,
  reorderSchema,
  shippingZoneCreateSchema,
  shippingZoneUpdateSchema,
} from '../schemas/admin-content.schema.js';
import * as service from '../services/admin-content.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// --- Banners ---
export const banners = {
  list: wrap(async (_req, res) => res.json(await service.listBanners())),
  create: wrap(async (req, res) =>
    res.status(201).json(await service.createBanner(bannerCreateSchema.parse(req.body))),
  ),
  update: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.updateBanner(id, bannerUpdateSchema.parse(req.body)));
  }),
  setActive: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.setBannerActive(id, activeSchema.parse(req.body).active));
  }),
  reorder: wrap(async (req, res) => {
    await service.reorderBanners(reorderSchema.parse(req.body).orderedIds);
    res.status(204).end();
  }),
};

// --- Colecciones ---
export const collections = {
  list: wrap(async (_req, res) => res.json(await service.listCollections())),
  create: wrap(async (req, res) =>
    res
      .status(201)
      .json(await service.createCollection(collectionCreateSchema.parse(req.body))),
  ),
  update: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.updateCollection(id, collectionUpdateSchema.parse(req.body)));
  }),
  setActive: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.setCollectionActive(id, activeSchema.parse(req.body).active));
  }),
  reorder: wrap(async (req, res) => {
    await service.reorderCollections(reorderSchema.parse(req.body).orderedIds);
    res.status(204).end();
  }),
};

// --- Zonas de envio ---
export const shippingZones = {
  list: wrap(async (_req, res) => res.json(await service.listShippingZones())),
  create: wrap(async (req, res) =>
    res
      .status(201)
      .json(await service.createShippingZone(shippingZoneCreateSchema.parse(req.body))),
  ),
  update: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.updateShippingZone(id, shippingZoneUpdateSchema.parse(req.body)));
  }),
  setActive: wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.setShippingZoneActive(id, activeSchema.parse(req.body).active));
  }),
};
