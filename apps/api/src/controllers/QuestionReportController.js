import { BaseController } from '../core/BaseController.js';
import { QuestionReportService } from '../services/QuestionReportService.js';

export class QuestionReportController extends BaseController {
  constructor() {
    super();
    this.questionReportService = new QuestionReportService();
    
  }

  setupRoutes() {
    this.rolePost('/questions/:questionId/report', (req, res) => this.reportQuestion(req, res), ['STUDENT']);
    this.roleGet('/my/question-reports', (req, res) => this.getStudentReports(req, res), ['STUDENT']);
    this.roleDelete('/my/question-reports/:reportId', (req, res) => this.deleteReport(req, res), ['STUDENT']);
    this.roleGet('/teacher/question-reports', (req, res) => this.getTeacherReports(req, res), ['TEACHER']);
    this.rolePatch('/teacher/question-reports/:reportId', (req, res) => this.updateReport(req, res), ['TEACHER']);
    this.roleGet('/teacher/question-reports/count', (req, res) => this.getTeacherReportCount(req, res), ['TEACHER']);
  }

  async reportQuestion(req, res) {
    const report = await this.questionReportService.reportQuestion(req.user, req.params.questionId, req.body);
    res.json(report);
  }

  async getStudentReports(req, res) {
    const reports = await this.questionReportService.getStudentReports(req.user.id);
    res.json(reports);
  }

  async deleteReport(req, res) {
    await this.questionReportService.deleteReport(req.user, req.params.reportId);
    res.json({ success: true });
  }

  async getTeacherReports(req, res) {
    const reports = await this.questionReportService.getTeacherReports(req.user, req.query.status);
    res.json(reports);
  }

  async updateReport(req, res) {
    const report = await this.questionReportService.updateReport(req.user, req.params.reportId, req.body);
    res.json(report);
  }

  async getTeacherReportCount(req, res) {
    const result = await this.questionReportService.getTeacherReportCount(req.user);
    res.json(result);
  }
}
