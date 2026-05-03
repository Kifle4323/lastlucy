import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { JwtService } from '../core/JwtService.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { UserRepository } from '../repositories/UserRepository.js';

export class AuthService extends BaseService {
  constructor() {
    super(new UserRepository());
  }

  async register(body) {
    const schema = z.object({
      email: z.string().min(1),
      password: z.string().min(6),
      fullName: z.string().min(2),
      phone: z.string().optional(),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).default('STUDENT'),
    });
    const data = schema.parse(body);

    // Name cannot contain numbers
    if (/\d/.test(data.fullName)) {
      throw AppError.badRequest('invalid_name', 'Name cannot contain numbers');
    }

    // Phone required and validated for students
    if (data.role === 'STUDENT') {
      if (!data.phone) {
        throw AppError.badRequest('phone_required', 'Phone number is required for student registration');
      }
      const phoneClean = data.phone.replace(/[\s\-()]/g, '');
      if (!/^9\d{8}$/.test(phoneClean)) {
        throw AppError.badRequest('invalid_phone', 'Please enter a valid phone number starting with 9 (e.g. 912345678)');
      }
      data.phone = `+251${phoneClean}`;
    }

    // Reject @ in email since domain is auto-appended
    let email = data.email.toLowerCase().trim();
    if (email.includes('@')) {
      throw AppError.badRequest('invalid_email', 'Do not include @ in the email. Only enter your username — @lucy.edu is added automatically.');
    }
    email = `${email}@lucy.edu`;

    const existing = await this.repository.findByEmail(email);
    this.throwIf(existing, 409, 'email_taken', 'Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repository.create({
      data: {
        email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone || null,
        role: data.role,
        isApproved: data.role !== 'STUDENT',
      },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true },
    });

    await AuditLogger.log({ action: 'REGISTER', category: 'AUTH', userId: user.id, description: `User registered: ${user.email}` });

    const accessToken = JwtService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = JwtService.signRefreshToken({ sub: user.id, role: user.role });

    return { user, accessToken, refreshToken };
  }

  async login(body) {
    const schema = z.object({ email: z.string().min(1), password: z.string() });
    const data = schema.parse(body);

    // Auto-append @lucy.edu — strip any @ if user typed it
    let email = data.email.toLowerCase().trim();
    email = email.split('@')[0];
    email = `${email}@lucy.edu`;

    const user = await this.repository.findByEmail(email);
    this.throwUnless(user, 401, 'invalid_credentials', 'Invalid email or password');

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    this.throwUnless(valid, 401, 'invalid_credentials', 'Invalid email or password');
    this.throwUnless(user.isApproved, 403, 'not_approved', 'Account pending approval');

    const accessToken = JwtService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = JwtService.signRefreshToken({ sub: user.id, role: user.role });

    await AuditLogger.log({ action: 'LOGIN', category: 'AUTH', userId: user.id, description: `User logged in: ${user.email}` });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isProfileComplete: user.isProfileComplete, profileImage: user.profileImage, isApproved: user.isApproved },
      accessToken,
      refreshToken,
    };
  }

  async adminCreateUser(adminUser, body) {
    const schema = z.object({
      email: z.string().min(3).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
      password: z.string().min(6),
      fullName: z.string().min(2),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
    });
    const data = schema.parse(body);

    const existing = await this.repository.findByEmail(data.email);
    this.throwIf(existing, 409, 'email_taken', 'Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repository.create({
      data: { email: data.email.toLowerCase(), passwordHash, fullName: data.fullName, role: data.role, isApproved: true },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true },
    });

    await AuditLogger.log({ action: 'CREATE', category: 'USER', userId: adminUser.id, targetId: user.id, description: `Admin created user: ${user.email}` });
    return user;
  }

  async getMe(userId) {
    const user = await this.repository.findMe(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');
    return user;
  }

  async getUsers(query = {}) {
    const where = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.repository.findMany(where, {
      select: { id: true, email: true, fullName: true, role: true, isApproved: true, isProfileComplete: true, profileImage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingUsers() {
    return this.repository.findPendingUsers();
  }

  async approveUser(adminUser, userId) {
    const user = await this.repository.findById(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');
    const result = await this.repository.approveUser(userId);
    await AuditLogger.log({ action: 'APPROVE', category: 'USER', userId: adminUser.id, targetId: userId, description: `Admin approved user: ${user.email}` });
    return result;
  }

  async deleteUser(adminUser, userId) {
    const user = await this.repository.findById(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');
    await this.repository.delete(userId);
    await AuditLogger.log({ action: 'DELETE', category: 'USER', userId: adminUser.id, targetId: userId, description: `Admin deleted user: ${user.email}` });
  }

  async changePassword(userId, body) {
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) });
    const data = schema.parse(body);

    const user = await this.repository.findById(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    this.throwUnless(valid, 400, 'wrong_password', 'Current password is incorrect');

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.updatePassword(userId, passwordHash);
  }

  async adminResetPassword(adminUser, userId, body) {
    const schema = z.object({ newPassword: z.string().min(6) });
    const data = schema.parse(body);

    const user = await this.repository.findById(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.updatePassword(userId, passwordHash);

    await AuditLogger.log({ action: 'ADMIN_RESET_PASSWORD', category: 'USER', userId: adminUser.id, targetId: userId, description: `Admin reset password for: ${user.email}` });

    return { success: true, message: 'Password reset successfully' };
  }

  async adminUpdateUser(adminUser, userId, body) {
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
      isApproved: z.boolean().optional(),
    });
    const data = schema.parse(body);

    const user = await this.repository.findById(userId);
    this.throwUnless(user, 404, 'not_found', 'User not found');

    // Check email uniqueness if changing email
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await this.repository.findByEmail(data.email);
      this.throwIf(existing, 409, 'email_taken', 'Email already registered');
    }

    const updateData = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isApproved !== undefined) updateData.isApproved = data.isApproved;

    if (Object.keys(updateData).length === 0) {
      throw AppError.badRequest('no_data', 'No fields to update');
    }

    const updated = await this.repository.update(userId, updateData);

    await AuditLogger.log({ action: 'ADMIN_UPDATE_USER', category: 'USER', userId: adminUser.id, targetId: userId, description: `Admin updated user: ${user.email}` });

    return updated;
  }
}
