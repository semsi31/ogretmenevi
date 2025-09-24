import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, config.auth.jwtSecret) as any;
    if (!payload || payload.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    (req as any).user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export function requireRoleAtLeast(minRole: 'viewer' | 'editor' | 'admin') {
  const order = { viewer: 1, editor: 2, admin: 3 } as const;
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Unauthorized' });
      const payload = jwt.verify(token, config.auth.jwtSecret) as any;
      const role = (payload?.role as 'viewer' | 'editor' | 'admin') || 'viewer';
      if (order[role] < order[minRole]) return res.status(403).json({ message: 'Forbidden' });
      (req as any).user = payload;
      (req as any).role = role;
      return next();
    } catch (e) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
}


