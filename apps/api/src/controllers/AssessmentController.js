import { BaseController } from '../core/BaseController.js';
import { AssessmentService } from '../services/AssessmentService.js';

export class AssessmentController extends BaseController {
  constructor() {
    super();
    this.assessmentService = new AssessmentService();
    
  }

  setupRoutes() {
    // Assessment CRUD
    this.rolePost('/assessments', (req, res) => this.createAssessment(req, res), ['TEACHER']);
    this.rolePost('/courses/:courseId/assessments', (req, res) => this.createAssessment(req, res), ['TEACHER']);
    this.authGet('/courses/:courseId/assessments', (req, res) => this.getAssessments(req, res));
    this.authGet('/assessments/:assessmentId', (req, res) => this.getAssessment(req, res));
    this.rolePatch('/assessments/:assessmentId', (req, res) => this.updateAssessment(req, res), ['TEACHER']);
    this.rolePut('/assessments/:assessmentId', (req, res) => this.updateAssessment(req, res), ['TEACHER']);
    this.rolePatch('/assessments/:assessmentId/open', (req, res) => this.toggleOpen(req, res), ['TEACHER']);
    this.roleDelete('/assessments/:assessmentId', (req, res) => this.deleteAssessment(req, res), ['TEACHER']);

    // Manual grades
    this.authGet('/assessments/:assessmentId/manual-grades', (req, res) => this.getManualGrades(req, res));
    this.rolePut('/assessments/:assessmentId/manual-grades/:studentId', (req, res) => this.setManualGrade(req, res), ['TEACHER']);
    this.roleDelete('/assessments/:assessmentId/manual-grades/:studentId', (req, res) => this.deleteManualGrade(req, res), ['TEACHER']);

    // Attempt viewing
    this.authGet('/assessments/:assessmentId/attempts-for-grading', (req, res) => this.getAttemptsForGrading(req, res));
    this.authGet('/attempts/:attemptId', (req, res) => this.getAttempt(req, res));
    this.rolePatch('/attempts/:attemptId/answers', (req, res) => this.saveAnswer(req, res), ['STUDENT']);
    this.authGet('/courses/:courseId/my-attempts', (req, res) => this.getMyAttempts(req, res));

    // Questions
    this.rolePost('/assessments/:assessmentId/questions', (req, res) => this.createQuestion(req, res), ['TEACHER']);
    this.authGet('/assessments/:assessmentId/questions', (req, res) => this.getQuestions(req, res));
    this.authGet('/questions/:questionId', (req, res) => this.getQuestion(req, res));
    this.rolePatch('/questions/:questionId', (req, res) => this.updateQuestion(req, res), ['TEACHER']);
    this.rolePut('/questions/:questionId', (req, res) => this.updateQuestion(req, res), ['TEACHER']);
    this.roleDelete('/questions/:questionId', (req, res) => this.deleteQuestion(req, res), ['TEACHER']);

    // Attempts
    this.rolePost('/assessments/:assessmentId/attempts', (req, res) => this.startAttempt(req, res), ['STUDENT']);
    this.rolePost('/attempts/:attemptId/submit', (req, res) => this.submitAttempt(req, res), ['STUDENT']);
    this.rolePost('/attempts/:attemptId/pause', (req, res) => this.pauseAttempt(req, res), ['STUDENT']);
    this.rolePost('/attempts/:attemptId/auto-save', (req, res) => this.autoSaveAnswers(req, res), ['STUDENT']);
    this.rolePost('/attempts/:attemptId/grade', (req, res) => this.gradeAttempt(req, res), ['TEACHER']);
  }

  async createAssessment(req, res) {
    const body = { ...req.body, courseId: req.params.courseId || req.body.courseId };
    const assessment = await this.assessmentService.createAssessment(req.user, body);
    res.status(201).json(assessment);
  }

  async getAssessments(req, res) {
    const assessments = await this.assessmentService.getAssessments(req.params.courseId);
    res.json(assessments);
  }

  async getAssessment(req, res) {
    const assessment = await this.assessmentService.getAssessment(req.params.assessmentId, req.user);
    res.json(assessment);
  }

  async updateAssessment(req, res) {
    const assessment = await this.assessmentService.updateAssessment(req.params.assessmentId, req.user, req.body);
    res.json(assessment);
  }

  async deleteAssessment(req, res) {
    await this.assessmentService.deleteAssessment(req.params.assessmentId, req.user);
    res.json({ success: true });
  }

  async createQuestion(req, res) {
    const question = await this.assessmentService.createQuestion(req.params.assessmentId, req.user, req.body);
    res.status(201).json(question);
  }

  async getQuestions(req, res) {
    const questions = await this.assessmentService.getQuestions(req.params.assessmentId);
    res.json(questions);
  }

  async getQuestion(req, res) {
    const question = await this.assessmentService.getQuestion(req.params.questionId, req.user);
    res.json(question);
  }

  async updateQuestion(req, res) {
    const question = await this.assessmentService.updateQuestion(req.params.questionId, req.user, req.body);
    res.json(question);
  }

  async deleteQuestion(req, res) {
    await this.assessmentService.deleteQuestion(req.params.questionId, req.user);
    res.json({ success: true });
  }

  async startAttempt(req, res) {
    const attempt = await this.assessmentService.startAttempt(req.params.assessmentId, req.user);
    res.status(201).json(attempt);
  }

  async submitAttempt(req, res) {
    const result = await this.assessmentService.submitAttempt(req.params.attemptId, req.user, req.body);
    res.json(result);
  }

  async gradeAttempt(req, res) {
    const result = await this.assessmentService.gradeAttempt(req.params.attemptId, req.user, req.body);
    res.json(result);
  }

  async toggleOpen(req, res) {
    const result = await this.assessmentService.toggleOpen(req.params.assessmentId, req.user, req.body);
    res.json(result);
  }

  async getManualGrades(req, res) {
    const grades = await this.assessmentService.getManualGrades(req.params.assessmentId, req.user);
    res.json(grades);
  }

  async setManualGrade(req, res) {
    const result = await this.assessmentService.setManualGrade(req.params.assessmentId, req.params.studentId, req.user, req.body);
    res.json(result);
  }

  async deleteManualGrade(req, res) {
    await this.assessmentService.deleteManualGrade(req.params.assessmentId, req.params.studentId, req.user);
    res.json({ success: true });
  }

  async getAttemptsForGrading(req, res) {
    const attempts = await this.assessmentService.getAttemptsForGrading(req.params.assessmentId, req.user);
    res.json(attempts);
  }

  async getAttempt(req, res) {
    const attempt = await this.assessmentService.getAttempt(req.params.attemptId, req.user);
    res.json(attempt);
  }

  async saveAnswer(req, res) {
    const result = await this.assessmentService.saveAnswer(req.params.attemptId, req.user, req.body);
    res.json(result);
  }

  async pauseAttempt(req, res) {
    const result = await this.assessmentService.pauseAttempt(req.params.attemptId, req.user, req.body);
    res.json(result);
  }

  async autoSaveAnswers(req, res) {
    const result = await this.assessmentService.autoSaveAnswers(req.params.attemptId, req.user, req.body);
    res.json(result);
  }

  async getMyAttempts(req, res) {
    const attempts = await this.assessmentService.getMyAttempts(req.params.courseId, req.user);
    res.json(attempts);
  }
}
