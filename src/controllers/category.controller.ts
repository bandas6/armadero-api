import type { NextFunction, Request, Response } from 'express';
import { getCategoryTree } from '../services/category.service.js';

export async function getCategoryTreeHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const tree = await getCategoryTree();
    res.json(tree);
  } catch (err) {
    next(err);
  }
}
