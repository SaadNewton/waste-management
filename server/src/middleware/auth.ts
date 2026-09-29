import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type AuthUser = { id: string; name: string; email: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized('Missing token');
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const user = /^[a-f\d]{24}$/i.test(String(payload.sub))
    ? await prisma.user.findUnique({ where: { id: String(payload.sub) } })
    : null;
  if (!user || !user.isActive) throw unauthorized('User is inactive or no longer exists');
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

export const adminOnly = requireRole('ADMIN');
