import { prisma } from '../db.js';

export class AuditLogger {
  static async log(params) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          userRole: params.userRole || null,
          action: params.action,
          category: params.category,
          targetId: params.targetId || null,
          targetType: params.targetType || null,
          description: params.description,
          ipAddress: params.ipAddress || null,
          metadata: params.metadata || undefined,
        },
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  }
}
