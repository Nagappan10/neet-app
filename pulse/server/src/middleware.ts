import type { NextFunction, Request, Response } from 'express';
import { ensureUser } from './db';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * Pulse is a single-user-per-device app, so identity is just a stable device
 * id supplied by the client. Swap this for real auth before exposing the API
 * on anything but a trusted network.
 */
export function identify(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('x-pulse-user');
  req.userId = header && header.trim().length > 0 ? header.trim() : 'local-user';
  ensureUser(req.userId);
  next();
}

export function asyncRoute<T extends (req: Request, res: Response) => unknown>(handler: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = handler(req, res);
      if (result instanceof Promise) result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  // eslint-disable-next-line no-console
  console.error('[pulse]', err);
  res.status(500).json({ error: message });
}
