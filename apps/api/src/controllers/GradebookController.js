import { BaseController } from '../core/BaseController.js';
import { GradebookService } from '../services/GradebookService.js';

export class GradebookController extends BaseController {
  constructor() {
    super();
    this.gradebookService = new GradebookService();
    
  }

  setupRoutes() {
    // Grade components
    this.authGet('/courses/:courseId/grade-components', (req, res) => this.getComponents(req, res));
    this.rolePost('/courses/:courseId/grade-components', (req, res) => this.addComponent(req, res), ['TEACHER']);
    this.rolePatch('/courses/:courseId/grade-components/:componentId', (req, res) => this.updateComponent(req, res), ['TEACHER']);
    this.roleDelete('/courses/:courseId/grade-components/:componentId', (req, res) => this.deleteComponent(req, res), ['TEACHER']);

    // Attendance
    this.roleGet('/courses/:courseId/attendance', (req, res) => this.getAttendance(req, res), ['TEACHER']);
    this.rolePut('/courses/:courseId/attendance/:studentId', (req, res) => this.setAttendance(req, res), ['TEACHER']);

    // Gradebook views
    this.roleGet('/courses/:courseId/gradebook', (req, res) => this.getGradebook(req, res), ['TEACHER']);
    this.roleGet('/courses/:courseId/my-grades', (req, res) => this.getMyGrades(req, res), ['STUDENT']);

    // Live attendance
    this.roleGet('/course-sections/:sectionId/live-attendance', (req, res) => this.getLiveAttendance(req, res), ['TEACHER']);
    this.rolePost('/course-sections/:sectionId/sync-attendance', (req, res) => this.syncAttendance(req, res), ['TEACHER']);
    this.rolePost('/course-sections/:sectionId/manual-attendance', (req, res) => this.createManualAttendance(req, res), ['TEACHER']);
    this.roleGet('/course-sections/:sectionId/manual-attendance', (req, res) => this.getManualAttendanceSessions(req, res), ['TEACHER']);
    this.roleDelete('/manual-attendance/:sessionId', (req, res) => this.deleteManualAttendanceSession(req, res), ['TEACHER']);
  }

  async getComponents(req, res) {
    const components = await this.gradebookService.getComponents(req.params.courseId);
    res.json(components);
  }

  async addComponent(req, res) {
    const component = await this.gradebookService.addComponent(req.params.courseId, req.user.id, req.body);
    res.status(201).json(component);
  }

  async updateComponent(req, res) {
    const component = await this.gradebookService.updateComponent(req.params.courseId, req.params.componentId, req.user.id, req.body);
    res.json(component);
  }

  async deleteComponent(req, res) {
    await this.gradebookService.deleteComponent(req.params.courseId, req.params.componentId, req.user.id);
    res.json({ success: true });
  }

  async getAttendance(req, res) {
    const attendance = await this.gradebookService.getAttendance(req.params.courseId, req.user.id);
    res.json(attendance);
  }

  async setAttendance(req, res) {
    const result = await this.gradebookService.setAttendance(req.params.courseId, req.params.studentId, req.user.id, req.body);
    res.json(result);
  }

  async getGradebook(req, res) {
    const gradebook = await this.gradebookService.getGradebook(req.params.courseId, req.user.id);
    res.json(gradebook);
  }

  async getMyGrades(req, res) {
    const grades = await this.gradebookService.getMyGrades(req.params.courseId, req.user.id);
    res.json(grades);
  }

  async getLiveAttendance(req, res) {
    const result = await this.gradebookService.getLiveAttendance(req.params.sectionId, req.user.id);
    res.json(result);
  }

  async syncAttendance(req, res) {
    const result = await this.gradebookService.syncAttendance(req.params.sectionId, req.user.id);
    res.json(result);
  }

  async createManualAttendance(req, res) {
    const result = await this.gradebookService.createManualAttendance(req.params.sectionId, req.user.id, req.body);
    res.json(result);
  }

  async getManualAttendanceSessions(req, res) {
    const result = await this.gradebookService.getManualAttendanceSessions(req.params.sectionId, req.user.id);
    res.json(result);
  }

  async deleteManualAttendanceSession(req, res) {
    await this.gradebookService.deleteManualAttendanceSession(req.params.sessionId, req.user.id);
    res.json({ success: true });
  }
}
