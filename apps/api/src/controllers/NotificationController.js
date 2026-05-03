import { BaseController } from '../core/BaseController.js';
import { NotificationService } from '../services/NotificationService.js';

export class NotificationController extends BaseController {
  constructor() {
    super();
    this.notificationService = new NotificationService();
    
  }

  setupRoutes() {
    this.roleGet('/admin/notifications', (req, res) => this.getAdminNotifications(req, res), ['ADMIN']);
    this.roleGet('/admin/notifications/counts', (req, res) => this.getAdminCounts(req, res), ['ADMIN']);
    this.roleGet('/student/notifications', (req, res) => this.getStudentNotifications(req, res), ['STUDENT']);
    this.roleGet('/teacher/notifications', (req, res) => this.getTeacherNotifications(req, res), ['TEACHER']);
    this.authGet('/notifications', (req, res) => this.getNotifications(req, res));
    this.authPatch('/notifications/:notificationId/read', (req, res) => this.markAsRead(req, res));
    this.authPost('/notifications/read-all', (req, res) => this.markAllAsRead(req, res));
  }

  async getAdminNotifications(req, res) {
    const notifications = await this.notificationService.getAdminNotifications();
    res.json(notifications);
  }

  async getNotifications(req, res) {
    let notifications;
    if (req.user.role === 'TEACHER') {
      notifications = await this.notificationService.getTeacherNotifications(req.user.id);
    } else {
      notifications = await this.notificationService.getStudentNotifications(req.user.id);
    }
    res.json(notifications);
  }

  async getTeacherNotifications(req, res) {
    const notifications = await this.notificationService.getTeacherNotifications(req.user.id);
    res.json(notifications);
  }

  async getAdminCounts(req, res) {
    const counts = await this.notificationService.getAdminCounts();
    res.json(counts);
  }

  async getStudentNotifications(req, res) {
    const notifications = await this.notificationService.getStudentNotifications(req.user.id);
    res.json(notifications);
  }

  async markAsRead(req, res) {
    await this.notificationService.markAsRead(req.params.notificationId, req.user.id);
    res.json({ success: true });
  }

  async markAllAsRead(req, res) {
    await this.notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  }
}
