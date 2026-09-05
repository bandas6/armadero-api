import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createQuoteSchema } from '../schemas/quote.schema.js';
import { createQuote, getQuoteByCode } from '../services/quote.service.js';

export async function createQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createQuoteSchema.parse(req.body);
    const result = await createQuote(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

const quoteCodeParamSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export async function getQuoteByCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = quoteCodeParamSchema.parse(req.params);
    const quote = await getQuoteByCode(code);
    res.json(quote);
  } catch (err) {
    next(err);
  }
}
