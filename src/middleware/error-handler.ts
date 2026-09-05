import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import mongoose from 'mongoose';
import { ProductNotFoundError } from '../services/product.service.js';
import { QuoteItemInvalidError, QuoteNotFoundError } from '../services/quote.service.js';
import { CloudinaryNotConfiguredError } from '../lib/cloudinary.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Errores de dominio de lib/errors.ts: llevan `status` numerico. */
function hasStatus(err: unknown): err is { status: number; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'No encontrado.', path: req.originalUrl });
}

/** Manejo centralizado de errores: una sola forma de respuesta para toda la API. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
  }

  // Un Error suelto lanzado por un hook pre('validate') de Mongoose (p. ej.
  // "Un producto no personalizable necesita precio en al menos una variante.").
  if (err instanceof mongoose.Error && err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE' ? 'La foto pesa más de 8 MB.' : 'No pudimos recibir el archivo.';
    return res.status(400).json({ error: msg });
  }

  if (err instanceof CloudinaryNotConfiguredError) {
    return res.status(503).json({ error: err.message });
  }

  if (err instanceof ProductNotFoundError || err instanceof QuoteNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  if (err instanceof QuoteItemInvalidError) {
    return res.status(422).json({ error: err.message });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (hasStatus(err)) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
