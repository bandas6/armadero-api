import type { NextFunction, Request, Response } from 'express';
import {
  quoteIdParam,
  quoteListQuerySchema,
  quoteUpdateSchema,
} from '../schemas/admin-quote.schema.js';
import * as service from '../services/admin-quote.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const listHandler = wrap(async (req, res) => {
  res.json(await service.listQuotes(quoteListQuerySchema.parse(req.query)));
});

export const statsHandler = wrap(async (_req, res) => {
  res.json(await service.getQuoteStats());
});

export const getHandler = wrap(async (req, res) => {
  const { id } = quoteIdParam.parse(req.params);
  res.json(await service.getQuote(id));
});

export const updateHandler = wrap(async (req, res) => {
  const { id } = quoteIdParam.parse(req.params);
  const patch = quoteUpdateSchema.parse(req.body);
  res.json(await service.updateQuote(id, patch));
});
