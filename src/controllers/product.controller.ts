import type { NextFunction, Request, Response } from 'express';
import { productSlugParamSchema } from '../schemas/quote.schema.js';
import { productListQuerySchema } from '../schemas/product-list.schema.js';
import { getProductBySlug, listProducts } from '../services/product.service.js';

export async function getProductBySlugHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = productSlugParamSchema.parse(req.params);
    const product = await getProductBySlug(slug);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = productListQuerySchema.parse(req.query);
    const result = await listProducts(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
