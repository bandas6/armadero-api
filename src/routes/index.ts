import { Router } from 'express';
import {
  getProductBySlugHandler,
  listProductsHandler,
} from '../controllers/product.controller.js';
import { getCategoryTreeHandler } from '../controllers/category.controller.js';
import { createQuoteHandler, getQuoteByCodeHandler } from '../controllers/quote.controller.js';
import { getSettingsHandler } from '../controllers/settings.controller.js';
import { sitemapHandler } from '../controllers/sitemap.controller.js';

export const router = Router();

// Endpoints publicos. El panel (auth, CRUD, stats) es de fases siguientes y esta
// documentado en docs/modelo-datos.md.
router.get('/products', listProductsHandler);
router.get('/products/:slug', getProductBySlugHandler);
router.get('/categories', getCategoryTreeHandler);
router.get('/settings', getSettingsHandler);
router.post('/quotes', createQuoteHandler);
router.get('/quotes/:code', getQuoteByCodeHandler);
router.get('/sitemap.xml', sitemapHandler);
