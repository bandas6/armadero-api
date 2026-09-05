import type { NextFunction, Request, Response } from 'express';
import {
  adminCategoryCreateSchema,
  adminCategoryUpdateSchema,
  categoryActiveSchema,
  categoryIdParam,
  categoryReorderSchema,
} from '../schemas/admin-category.schema.js';
import * as service from '../services/admin-category.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const listHandler = wrap(async (_req, res) => {
  res.json(await service.listAdminCategories());
});

export const createHandler = wrap(async (req, res) => {
  const input = adminCategoryCreateSchema.parse(req.body);
  res.status(201).json(await service.createCategory(input));
});

export const updateHandler = wrap(async (req, res) => {
  const { id } = categoryIdParam.parse(req.params);
  const patch = adminCategoryUpdateSchema.parse(req.body);
  res.json(await service.updateCategory(id, patch));
});

export const setActiveHandler = wrap(async (req, res) => {
  const { id } = categoryIdParam.parse(req.params);
  const { active } = categoryActiveSchema.parse(req.body);
  res.json(await service.setCategoryActive(id, active));
});

export const reorderHandler = wrap(async (req, res) => {
  const { orderedIds } = categoryReorderSchema.parse(req.body);
  await service.reorderCategories(orderedIds);
  res.status(204).end();
});
