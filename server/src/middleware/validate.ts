import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/**
 * Validates and coerces request parts. Parsed values are stored on `res.locals`
 * (`body`, `query`, `params`) because Express 5 makes `req.query` read-only.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    if (schemas.params) res.locals.params = schemas.params.parse(req.params);
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.body) res.locals.body = schemas.body.parse(req.body);
    next();
  };
