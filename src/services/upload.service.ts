import type { UploadApiResponse } from 'cloudinary';
import { cloudinary, assertCloudinary } from '../lib/cloudinary.js';

const FOLDER = 'artemadero/products';

export type UploadedImage = { url: string; publicId: string };

/**
 * Sube el buffer de una foto de producto a Cloudinary. La transformacion de entrega la
 * decide el frontend con `NgOptimizedImage` + el CDN; aca solo se acota el maximo para
 * no guardar originales de 12 MP.
 */
export async function uploadProductImage(buffer: Buffer): Promise<UploadedImage> {
  assertCloudinary();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: 'image',
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
      },
      (error, res) => {
        if (error || !res) return reject(error ?? new Error('Cloudinary no devolvio respuesta.'));
        resolve(res);
      },
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteImage(publicId: string): Promise<void> {
  assertCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
}

/** Alias historico usado por admin-product.service.ts. */
export const deleteProductImage = deleteImage;
