import { Router } from 'express';
import { authRequired, requireRole } from '../middleware.js';
import { AppError } from './AppError.js';

export class BaseController {
  constructor() {
    this.router = Router();
  }

  registerRoutes(app, prefix = '/api') {
    if (typeof this.setupRoutes === 'function') {
      this.setupRoutes();
    }
    app.use(prefix, this.router);
  }

  // Helper to wrap async handlers and catch AppError / unknown errors
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(err => {
        if (err instanceof AppError) {
          return res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          });
        }
        // Handle Zod validation errors
        if (err.name === 'ZodError' && Array.isArray(err.errors)) {
          return res.status(400).json({ error: 'validation_error', message: err.errors.map(e => e.message).join(', '), details: err.errors });
        }
        console.error('Unhandled error:', err);
        const message = err instanceof Error ? err.message : 'internal_error';
        res.status(500).json({ error: 'internal_error', message });
      });
    };
  }

  // Convenience route registration methods with auth
  get(path, handler, ...middleware) {
    this.router.get(path, ...middleware, this.asyncHandler(handler));
  }

  post(path, handler, ...middleware) {
    this.router.post(path, ...middleware, this.asyncHandler(handler));
  }

  put(path, handler, ...middleware) {
    this.router.put(path, ...middleware, this.asyncHandler(handler));
  }

  patch(path, handler, ...middleware) {
    this.router.patch(path, ...middleware, this.asyncHandler(handler));
  }

  delete(path, handler, ...middleware) {
    this.router.delete(path, ...middleware, this.asyncHandler(handler));
  }

  // Authenticated route helpers
  authGet(path, handler) {
    this.get(path, handler, authRequired);
  }

  authPost(path, handler, ...extraMiddleware) {
    this.post(path, handler, authRequired, ...extraMiddleware);
  }

  authPut(path, handler, ...extraMiddleware) {
    this.put(path, handler, authRequired, ...extraMiddleware);
  }

  authPatch(path, handler, ...extraMiddleware) {
    this.patch(path, handler, authRequired, ...extraMiddleware);
  }

  authDelete(path, handler, ...extraMiddleware) {
    this.delete(path, handler, authRequired, ...extraMiddleware);
  }

  // Role-restricted helpers
  roleGet(path, handler, roles) {
    this.get(path, handler, authRequired, requireRole(roles));
  }

  rolePost(path, handler, roles) {
    this.post(path, handler, authRequired, requireRole(roles));
  }

  rolePut(path, handler, roles) {
    this.put(path, handler, authRequired, requireRole(roles));
  }

  rolePatch(path, handler, roles) {
    this.patch(path, handler, authRequired, requireRole(roles));
  }

  roleDelete(path, handler, roles) {
    this.delete(path, handler, authRequired, requireRole(roles));
  }
}
