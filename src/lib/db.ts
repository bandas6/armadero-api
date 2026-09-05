import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

if (env.DNS_SERVERS) {
  const servers = env.DNS_SERVERS.split(',').map((s) => s.trim());
  dns.setServers(servers);
  console.log(`[db] DNS_SERVERS configurado: ${servers.join(', ')} (workaround de entorno)`);
}

let connecting: Promise<typeof mongoose> | null = null;

/** Conexion unica a MongoDB. Reutiliza la promesa si ya hay una conexion en curso. */
export function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (connecting) return connecting;

  mongoose.connection.on('connected', () => {
    console.log(`[db] Conectado a MongoDB (${mongoose.connection.name})`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] Error de conexion:', err.message);
  });

  connecting = mongoose.connect(env.MONGODB_URI);
  return connecting;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  connecting = null;
}
