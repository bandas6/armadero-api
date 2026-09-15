import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
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
import * as users from '../controllers/admin-user.controller.js';
import { banners, collections, shippingZones } from '../controllers/admin-content.controller.js';

export const adminRouter = Router();

// --- Auth ---
adminRouter.post('/auth/login', loginHandler);
adminRouter.post('/auth/refresh', refreshHandler);
adminRouter.post('/auth/logout', logoutHandler);
adminRouter.get('/auth/me', requireAuth, meHandler);
adminRouter.post('/auth/password', requireAuth, users.changePasswordHandler);

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

// --- Colecciones / ambientes: contenido, lo edita tambien el EDITOR ---
adminRouter.patch('/collections/reorder', collections.reorder);
adminRouter.get('/collections', collections.list);
adminRouter.post('/collections', collections.create);
adminRouter.patch('/collections/:id', collections.update);
adminRouter.post('/collections/:id/active', collections.setActive);

// --- Solo ADMIN: ajustes, banners, zonas de envio y usuarios ---
// El EDITOR carga muebles, fotos, categorias y colecciones; no toca la configuracion.
const adminOnly = requireRole('ADMIN');

adminRouter.get('/settings', adminOnly, settings.getHandler);
adminRouter.put('/settings', adminOnly, settings.updateHandler);

adminRouter.patch('/banners/reorder', adminOnly, banners.reorder);
adminRouter.get('/banners', adminOnly, banners.list);
adminRouter.post('/banners', adminOnly, banners.create);
adminRouter.patch('/banners/:id', adminOnly, banners.update);
adminRouter.post('/banners/:id/active', adminOnly, banners.setActive);

adminRouter.get('/shipping-zones', adminOnly, shippingZones.list);
adminRouter.post('/shipping-zones', adminOnly, shippingZones.create);
adminRouter.patch('/shipping-zones/:id', adminOnly, shippingZones.update);
adminRouter.post('/shipping-zones/:id/active', adminOnly, shippingZones.setActive);

adminRouter.get('/users', adminOnly, users.listHandler);
adminRouter.post('/users', adminOnly, users.createHandler);
adminRouter.patch('/users/:id', adminOnly, users.updateHandler);
