import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super(
      'La subida de fotos no esta disponible: falta configurar Cloudinary ' +
        '(CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET en el .env de la API).',
    );
    this.name = 'CloudinaryNotConfiguredError';
  }
}

export function assertCloudinary() {
  if (!cloudinaryConfigured) throw new CloudinaryNotConfiguredError();
}

export { cloudinary };
