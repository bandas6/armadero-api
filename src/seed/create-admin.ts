import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../lib/db.js';
import { AdminUser } from '../models/catalog.model.js';
import { env } from '../lib/env.js';

/**
 * Crea (o actualiza la contraseña de) el primer administrador del panel.
 *
 *   npm run create-admin --prefix api
 *
 * Toma los datos de ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME del .env, o de argv:
 *   tsx src/seed/create-admin.ts correo@dominio.com "clave-larga" "Nombre"
 *
 * Ninguna credencial se guarda en el repo.
 */
async function run() {
  const [, , argEmail, argPassword, argName] = process.argv;
  const email = (argEmail ?? env.ADMIN_EMAIL)?.toLowerCase().trim();
  const password = argPassword ?? env.ADMIN_PASSWORD;
  const name = argName ?? env.ADMIN_NAME ?? 'Administración';

  if (!email || !password) {
    console.error(
      '[create-admin] Falta el correo o la contraseña. Define ADMIN_EMAIL y ADMIN_PASSWORD ' +
        'en api/.env, o pásalos como argumentos.',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('[create-admin] La contraseña necesita al menos 8 caracteres.');
    process.exit(1);
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await AdminUser.findOne({ email }).select('+passwordHash');
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = name;
    existing.active = true;
    existing.role = 'ADMIN';
    await existing.save();
    console.log(`[create-admin] Contraseña actualizada para ${email} (rol ADMIN).`);
  } else {
    await AdminUser.create({ email, passwordHash, name, role: 'ADMIN', active: true });
    console.log(`[create-admin] Administrador creado: ${email}`);
  }

  await disconnectDb();
}

run().catch((err) => {
  console.error('[create-admin] Fallo:', err);
  process.exit(1);
});
