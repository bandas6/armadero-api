import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { uploadProductImage } from '../services/upload.service.js';
import { HttpError } from '../middleware/error-handler.js';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new HttpError(400, 'El archivo debe ser una imagen.'));
  },
}).single('file');

export async function uploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new HttpError(400, 'No llegó ninguna foto (campo "file").');
    const image = await uploadProductImage(req.file.buffer);
    res.status(201).json(image);
  } catch (err) {
    next(err);
  }
}
