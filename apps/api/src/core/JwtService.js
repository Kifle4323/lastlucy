import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const JWTPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
});

export class JwtService {
  static signAccessToken(input) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
    return jwt.sign(input, secret, { expiresIn: '15m' });
  }

  static signRefreshToken(input) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
    return jwt.sign(input, secret, { expiresIn: '30d' });
  }

  static verifyAccessToken(token) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
    const decoded = jwt.verify(token, secret);
    return JWTPayloadSchema.parse(decoded);
  }

  static verifyRefreshToken(token) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
    const decoded = jwt.verify(token, secret);
    return JWTPayloadSchema.parse(decoded);
  }
}
