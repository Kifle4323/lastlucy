import { BaseRepository } from '../core/BaseRepository.js';

export class NotificationRepository extends BaseRepository {
  constructor() { super('notification'); }

  findForStudent(userId) {
    return this.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findForTeacher(userId) {
    return this.model.findMany({
      where: {
        userId,
        type: { in: ['EXAM_ACTIVATION_DUE', 'EXAM_READY_TO_ACTIVATE', 'ASSESSMENT_OPENING_SOON', 'ASSESSMENT_AUTO_OPENED', 'ASSESSMENT_OPEN_BLOCKED', 'ASSESSMENT_CREATED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAsRead(notificationId, userId) {
    return this.model.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  markAllAsRead(userId) {
    return this.model.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  createNotification(data) {
    return this.model.create({ data });
  }

  getPendingCounts() {
    return Promise.all([
      this.prisma.faceVerification.count({ where: { matchResult: false, adminReviewed: false } }),
      this.prisma.studentProfile.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.user.count({ where: { isApproved: false } }),
      this.prisma.addDropRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.questionReport.count({ where: { status: 'PENDING' } }),
    ]);
  }

  getScheduleNotifications(userId) {
    return this.model.findMany({
      where: {
        userId,
        type: { in: ['REGISTRATION_OPENING_SOON', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'SEMESTER_STARTING_SOON', 'SEMESTER_STARTED'] },
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
