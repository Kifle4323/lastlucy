import { JwtService } from './JwtService.js';

export class AuthMiddleware {
  static authRequired(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'missing_token' });
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = JwtService.verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      res.status(401).json({ error: 'invalid_token' });
    }
  }

  static requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'missing_token' });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      next();
    };
  }
}

// Re-export as functions for backward compatibility with existing middleware imports
export const authRequired = AuthMiddleware.authRequired;
export const requireRole = AuthMiddleware.requireRole;
