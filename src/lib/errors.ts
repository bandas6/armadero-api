/** Errores de dominio con codigo HTTP, para que el error-handler central los mapee. */

export class AuthError extends Error {
  status = 401;
  constructor(message = 'No autorizado.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = 'No encontrado.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Regla de negocio incumplible (p. ej. tope de destacados). */
export class UnprocessableError extends Error {
  status = 422;
  constructor(message: string) {
    super(message);
    this.name = 'UnprocessableError';
  }
}
