import { Schema, model, InferSchemaType } from 'mongoose';

/**
 * Refresh tokens del panel. Se guarda solo el HASH del token, nunca el valor plano.
 * Rotacion: al usar un refresh se revoca y se emite uno nuevo (`replacedByHash` apunta
 * al sucesor). Si llega un refresh ya revocado -> reuso: se revocan todos los del usuario.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String },
  },
  { timestamps: true },
);

// TTL: Mongo borra el documento solo un tiempo despues de expirar.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
