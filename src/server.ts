import { env } from './lib/env.js';
import { connectDb } from './lib/db.js';
import { createApp } from './app.js';
import { resolveWhatsappNumber } from './lib/whatsapp.js';

async function main() {
  await connectDb();

  // En produccion, sin numero de WhatsApp (ni en env ni en el panel) no hay embudo de
  // ventas. No corta el arranque -el admin lo puede poner en vivo desde Ajustes- pero
  // avisa fuerte.
  if (env.NODE_ENV === 'production' && !(await resolveWhatsappNumber())) {
    console.warn(
      '[api] ATENCION: no hay numero de WhatsApp configurado ni en el .env ni en el panel. ' +
        'El boton de cotizar esta deshabilitado hasta que se configure en Ajustes.',
    );
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[api] Artemadero API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Apagado ordenado: libera el puerto antes de salir. Importante para que nodemon
  // reinicie sin chocar con "EADDRINUSE" en Windows, y para SIGTERM en Docker.
  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} recibido, cerrando...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] No se pudo arrancar:', err);
  process.exit(1);
});
