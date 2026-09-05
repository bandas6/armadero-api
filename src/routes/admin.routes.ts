import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from '../controllers/auth.controller.js';
import * as products from '../controllers/admin-product.controller.js';
import * as categories from '../controllers/admin-category.controller.js';
import * as quotes from '../controllers/admin-quote.controller.js';
import * as settings from '../controllers/admin-settings.controller.js';
import { uploadHandler, uploadMiddleware } from '../controllers/admin-upload.controller.js';

export const adminRouter = Router();

// --- Auth ---
adminRouter.post('/auth/login', loginHandler);
adminRouter.post('/auth/refresh', refreshHandler);
adminRouter.post('/auth/logout', logoutHandler);
adminRouter.get('/auth/me', requireAuth, meHandler);

// --- Todo lo de abajo exige sesion ---
adminRouter.use(requireAuth);

// Reorder va antes de /products/:id para que "reorder" no se lea como un id.
adminRouter.patch('/products/reorder', products.reorderHandler);

adminRouter.get('/products', products.listHandler);
adminRouter.post('/products', products.createHandler);
adminRouter.get('/products/:id', products.getHandler);
adminRouter.patch('/products/:id', products.updateHandler);
adminRouter.post('/products/:id/active', products.setActiveHandler);
adminRouter.post('/products/:id/featured', products.setFeaturedHandler);

adminRouter.post('/uploads', uploadMiddleware, uploadHandler);
adminRouter.post('/products/:id/images', products.attachImageHandler);
adminRouter.patch('/products/:id/images/reorder', products.reorderImagesHandler);
adminRouter.post('/products/:id/images/:imageId/primary', products.setPrimaryImageHandler);
adminRouter.delete('/products/:id/images/:imageId', products.removeImageHandler);

// --- Categorias (Fase 4) ---
adminRouter.patch('/categories/reorder', categories.reorderHandler);
adminRouter.get('/categories', categories.listHandler);
adminRouter.post('/categories', categories.createHandler);
adminRouter.patch('/categories/:id', categories.updateHandler);
adminRouter.post('/categories/:id/active', categories.setActiveHandler);

// --- Cotizaciones (Fase 4) ---
adminRouter.get('/quotes/stats', quotes.statsHandler);
adminRouter.get('/quotes', quotes.listHandler);
adminRouter.get('/quotes/:id', quotes.getHandler);
adminRouter.patch('/quotes/:id', quotes.updateHandler);

// --- Ajustes del sitio (Fase 4) ---
adminRouter.get('/settings', settings.getHandler);
adminRouter.put('/settings', settings.updateHandler);
