import type { Request, Response, NextFunction, Router } from 'express';
import { AppError } from './errorHandler.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verilen parametre adı UUID formatında değilse 400 döner */
export function validateUUID(paramName = 'id') {
  return (req: Request, _res: Response, next: NextFunction, value: string) => {
    if (!UUID_RE.test(value)) {
      return next(new AppError(`Gecersiz ${paramName} formatı`, 400));
    }
    next();
  };
}

/** Router'a :id param validasyonu ekler */
export function applyUUIDValidation(router: Router, paramName = 'id') {
  router.param(paramName, validateUUID(paramName));
}
