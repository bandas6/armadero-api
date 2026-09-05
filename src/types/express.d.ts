import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Lo pone `requireAuth` a partir del access token. */
      admin?: { id: string; role: string; email: string };
    }
  }
}
