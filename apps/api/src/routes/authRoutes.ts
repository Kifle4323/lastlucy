// @ts-nocheck
import type { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { signAccessToken, signRefreshToken } from '../auth';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';
import { createAuditLog } from '../auditLog';

// Password validation: at least 1 uppercase, 1 lowercase, 1 number, min 6 chars
const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export function registerAuthRoutes(router: Router) {
  // Public registration - only STUDENT and TEACHER allowed
  router.post('/auth/register', async (req: Request, res: Response) => {
    const body = z
      .object({
        email: z.string().min(3).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
        password: passwordSchema,
        fullName: z.string().min(2),
        role: z.enum(['STUDENT', 'TEACHER']).optional(),
      })
      .parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      res.status(400).json({ error: 'email_exists', message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        fullName: body.fullName,
        role: body.role ?? 'STUDENT',
        isApproved: false, // Requires admin approval
      },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true, createdAt: true },
    });

    createAuditLog({ userId: user.id, userRole: user.role, action: 'REGISTER', category: 'AUTH', targetId: user.id, targetType: 'User', description: `New ${user.role} registered: ${user.fullName} (${user.email})`, ipAddress: req.ip });
    res.json({ ...user, message: 'Account created successfully. Please wait for admin approval.' });
  });

  // Admin creates user - auto-approved
  router.post('/admin/users', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z
      .object({
        email: z.string().min(3).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
        password: passwordSchema,
        fullName: z.string().min(2),
        role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
      })
      .parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      res.status(400).json({ error: 'email_exists', message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        fullName: body.fullName,
        role: body.role,
        isProfileComplete: true, // Admin created, so profile is complete
        isApproved: true, // Admin created, so auto-approved
      },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true, createdAt: true },
    });

    createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'CREATE', category: 'USER', targetId: user.id, targetType: 'User', description: `Admin created ${user.role} user: ${user.fullName} (${user.email})`, ipAddress: req.ip });
    res.json(user);
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const body = z.object({ email: z.string().min(3).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'), password: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      createAuditLog({ action: 'LOGIN_FAILED', category: 'AUTH', targetId: user.id, targetType: 'User', description: `Failed login attempt for ${user.email}`, ipAddress: req.ip });
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    // Check if account is approved (admins are always approved)
    if (user.role !== 'ADMIN' && !user.isApproved) {
      res.status(403).json({ error: 'account_pending', message: 'Your account is pending admin approval. Please try again later.' });
      return;
    }

    const payload = { sub: user.id, role: user.role } as const;
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    createAuditLog({ userId: user.id, userRole: user.role, action: 'LOGIN', category: 'AUTH', targetId: user.id, targetType: 'User', description: `${user.role} logged in: ${user.fullName} (${user.email})`, ipAddress: req.ip });
    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isProfileComplete: user.isProfileComplete, profileImage: user.profileImage },
    });
  });

  // Admin: Get pending users
  router.get('/admin/pending-users', authRequired, requireRole(['ADMIN']), async (_req: AuthedRequest, res: Response) => {
    const users = await prisma.user.findMany({
      where: { isApproved: false },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  });

  // Admin: Approve user
  router.post('/admin/users/:userId/approve', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ userId: z.string() }).parse(req.params);

    const user = await prisma.user.update({
      where: { id: params.userId },
      data: { isApproved: true },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true },
    });

    createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'APPROVE', category: 'USER', targetId: user.id, targetType: 'User', description: `Admin approved user: ${user.fullName} (${user.email})`, ipAddress: req.ip });
    res.json(user);
  });

  // Admin: Reject/Delete user
  router.delete('/admin/users/:userId', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ userId: z.string() }).parse(req.params);

    const targetUser = await prisma.user.findUnique({ where: { id: params.userId }, select: { fullName: true, email: true, role: true } });
    await prisma.user.delete({
      where: { id: params.userId },
    });
    createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'DELETE', category: 'USER', targetId: params.userId, targetType: 'User', description: `Admin deleted user: ${targetUser?.fullName || params.userId} (${targetUser?.email || ''})`, ipAddress: req.ip });
    res.json({ success: true });
  });

  router.get('/me', authRequired, async (req: AuthedRequest, res: Response) => {
    const id = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, isProfileComplete: true, profileImage: true, isApproved: true, createdAt: true },
    });
    res.json(user);
  });

  // Change password
  router.post('/me/change-password', authRequired, async (req: AuthedRequest, res: Response) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    // Verify current password
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'invalid_password', message: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  });
}
