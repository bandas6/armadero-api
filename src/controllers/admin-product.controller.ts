import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  adminProductCreateSchema,
  adminProductUpdateSchema,
  idParamSchema,
  imageAttachSchema,
  imageParamSchema,
  imageReorderSchema,
  listQuerySchema,
  reorderSchema,
} from '../schemas/admin-product.schema.js';
import * as service from '../services/admin-product.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const listHandler = wrap(async (req, res) => {
  res.json(await service.listAdminProducts(listQuerySchema.parse(req.query)));
});

export const getHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await service.getAdminProduct(id));
});

export const createHandler = wrap(async (req, res) => {
  const input = adminProductCreateSchema.parse(req.body);
  const product = await service.createProduct(input);
  res.status(201).json(product);
});

export const updateHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const patch = adminProductUpdateSchema.parse(req.body);
  res.json(await service.updateProduct(id, patch));
});

const activeBodySchema = z.object({ active: z.boolean() });
export const setActiveHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { active } = activeBodySchema.parse(req.body);
  res.json(await service.setActive(id, active));
});

const featuredBodySchema = z.object({ featured: z.boolean() });
export const setFeaturedHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { featured } = featuredBodySchema.parse(req.body);
  res.json(await service.setFeatured(id, featured));
});

export const reorderHandler = wrap(async (req, res) => {
  const { orderedIds } = reorderSchema.parse(req.body);
  await service.reorderProducts(orderedIds);
  res.status(204).end();
});

export const attachImageHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const image = imageAttachSchema.parse(req.body);
  res.status(201).json(await service.attachImage(id, image));
});

export const reorderImagesHandler = wrap(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { orderedIds } = imageReorderSchema.parse(req.body);
  res.json(await service.reorderImages(id, orderedIds));
});

export const setPrimaryImageHandler = wrap(async (req, res) => {
  const { id, imageId } = imageParamSchema.parse(req.params);
  res.json(await service.setPrimaryImage(id, imageId));
});

export const removeImageHandler = wrap(async (req, res) => {
  const { id, imageId } = imageParamSchema.parse(req.params);
  res.json(await service.removeImage(id, imageId));
});

// Las variantes ("opciones del mueble") se editan enviando el arreglo completo en
// PATCH /products/:id — el editor del panel siempre manda la lista entera.
