import { BaseController } from '../core/BaseController.js';
import { AnalyticsService } from '../services/AnalyticsService.js';

export class AnalyticsController extends BaseController {
  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    
  }

  setupRoutes() {
    this.roleGet('/analytics/admin', (req, res) => this.getAdminOverview(req, res), ['ADMIN']);
    this.roleGet('/analytics/teacher', (req, res) => this.getTeacherOverview(req, res), ['TEACHER']);
    this.roleGet('/analytics/teacher/at-risk', (req, res) => this.getTeacherAtRiskStudents(req, res), ['TEACHER']);
    this.roleGet('/analytics/student', (req, res) => this.getStudentOverview(req, res), ['STUDENT']);
    this.get('/analytics/public', (req, res) => this.getPublicOverview(req, res));
  }

  async getAdminOverview(req, res) {
    const data = await this.analyticsService.getAdminOverview();
    res.json(data);
  }

  async getTeacherOverview(req, res) {
    const data = await this.analyticsService.getTeacherOverview(req.user.id);
    res.json(data);
  }

  async getStudentOverview(req, res) {
    const data = await this.analyticsService.getStudentOverview(req.user.id);
    res.json(data);
  }

  async getTeacherAtRiskStudents(req, res) {
    const data = await this.analyticsService.getTeacherAtRiskStudents(req.user.id);
    res.json(data);
  }

  async getPublicOverview(req, res) {
    const data = await this.analyticsService.getPublicOverview();
    res.json(data);
  }
}
