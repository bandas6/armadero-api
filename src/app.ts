import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { router } from './routes/index.js';
import { adminRouter } from './routes/admin.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Este archivo vive en src/ (o dist/ compilado); un nivel arriba es la carpeta del
// proyecto de la API, donde está assets/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
// Carpeta de las fotos livianas (hero del home, semilla). Se puede sobreescribir con
// FOTOS_DIR si se despliega con las fotos en otra ruta.
const FOTOS_DIR = process.env.FOTOS_DIR ?? path.join(API_ROOT, 'assets', 'fotos');

export function createApp() {
  const app = express();

  // credentials: true para que el navegador mande la cookie httpOnly del refresh token.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: env.NODE_ENV });
  });

  // Fotos decorativas del home (hero, taller) y de la semilla. Las fotos de producto
  // reales viven en Cloudinary; esto solo sirve el set liviano de assets/fotos.
  app.use('/fotos', express.static(FOTOS_DIR, { maxAge: '7d' }));

  app.use('/api/admin', adminRouter);
  app.use('/api', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
