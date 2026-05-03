import { BaseService } from '../core/BaseService.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';

export class NotificationService extends BaseService {
  constructor() {
    super(new NotificationRepository());
  }

  async getAdminNotifications() {
    const [faceVerifications, studentProfiles, userApprovals, addDropRequests, questionReports] = await this.repository.getPendingCounts();
    return {
      faceVerifications,
      studentProfiles,
      pendingUsers: userApprovals,
      pendingAddDropRequests: addDropRequests,
      pendingQuestionReports: questionReports,
      total: faceVerifications + studentProfiles + userApprovals + addDropRequests + questionReports,
    };
  }

  async getAdminCounts() {
    const [faceVerifications, studentProfiles, userApprovals, addDropRequests, questionReports] = await this.repository.getPendingCounts();
    return { faceVerifications, studentProfiles, userApprovals, addDropRequests, questionReports };
  }

  async getStudentNotifications(userId) {
    const notifications = await this.repository.findForStudent(userId);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return { notifications, unreadCount };
  }

  async getTeacherNotifications(userId) {
    const notifications = await this.repository.findForTeacher(userId);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return { notifications, unreadCount };
  }

  async markAsRead(notificationId, userId) {
    return this.repository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId) {
    return this.repository.markAllAsRead(userId);
  }

  async createNotification(data) {
    return this.repository.createNotification(data);
  }
}
