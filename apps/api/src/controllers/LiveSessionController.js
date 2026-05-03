import { BaseController } from '../core/BaseController.js';
import { LiveSessionService } from '../services/LiveSessionService.js';

export class LiveSessionController extends BaseController {
  constructor() {
    super();
    this.liveSessionService = new LiveSessionService();
    
  }

  setupRoutes() {
    this.rolePost('/courses/:courseId/live-sessions', (req, res) => this.createSession(req, res), ['TEACHER']);
    this.authGet('/courses/:courseId/live-sessions', (req, res) => this.getSessions(req, res));
    this.authGet('/classes/:classId/live-sessions', (req, res) => this.getClassSessions(req, res));
    this.authGet('/live-sessions/upcoming', (req, res) => this.getUpcomingSessions(req, res));
    this.authGet('/live-sessions/:sessionId', (req, res) => this.getSession(req, res));
    this.authGet('/live-sessions/:sessionId/attendance', (req, res) => this.getAttendance(req, res));
    this.rolePatch('/live-sessions/:sessionId', (req, res) => this.updateSession(req, res), ['TEACHER']);
    this.roleDelete('/live-sessions/:sessionId', (req, res) => this.deleteSession(req, res), ['TEACHER']);
    this.authPost('/live-sessions/:sessionId/jaas-token', (req, res) => this.generateJaaSToken(req, res));
    this.rolePost('/live-sessions/:sessionId/attendance', (req, res) => this.recordAttendance(req, res), ['STUDENT']);
    this.rolePost('/live-sessions/:sessionId/join', (req, res) => this.joinSession(req, res), ['STUDENT']);
    this.rolePost('/live-sessions/:sessionId/leave', (req, res) => this.leaveSession(req, res), ['STUDENT']);
    this.rolePost('/live-sessions/:sessionId/end', (req, res) => this.endSession(req, res), ['TEACHER']);
    this.rolePost('/live-sessions/:sessionId/face-alert', (req, res) => this.reportFaceAlert(req, res), ['STUDENT']);
  }

  async createSession(req, res) {
    const session = await this.liveSessionService.createSession(req.user, req.params.courseId, req.body);
    res.status(201).json(session);
  }

  async getSessions(req, res) {
    const sessions = await this.liveSessionService.getSessions(req.params.courseId, req.query.classId);
    res.json(sessions);
  }

  async getClassSessions(req, res) {
    const sessions = await this.liveSessionService.getClassSessions(req.params.classId, req.user);
    res.json(sessions);
  }

  async getUpcomingSessions(req, res) {
    const sessions = await this.liveSessionService.getUpcomingSessions(req.user);
    res.json(sessions);
  }

  async getAttendance(req, res) {
    const result = await this.liveSessionService.getAttendance(req.params.sessionId, req.user);
    res.json(result);
  }

  async getSession(req, res) {
    const session = await this.liveSessionService.getSession(req.params.sessionId);
    res.json(session);
  }

  async updateSession(req, res) {
    const session = await this.liveSessionService.updateSession(req.params.sessionId, req.user, req.body);
    res.json(session);
  }

  async deleteSession(req, res) {
    await this.liveSessionService.deleteSession(req.params.sessionId, req.user);
    res.json({ success: true });
  }

  async generateJaaSToken(req, res) {
    const result = await this.liveSessionService.generateJaaSToken(req.params.sessionId, req.user);
    res.json(result);
  }

  async recordAttendance(req, res) {
    const result = await this.liveSessionService.recordAttendance(req.params.sessionId, req.user, req.body);
    res.json(result);
  }

  async joinSession(req, res) {
    const result = await this.liveSessionService.recordAttendance(req.params.sessionId, req.user, { action: 'join' });
    res.json(result);
  }

  async leaveSession(req, res) {
    const result = await this.liveSessionService.recordAttendance(req.params.sessionId, req.user, { action: 'leave' });
    res.json(result);
  }

  async endSession(req, res) {
    const result = await this.liveSessionService.endSession(req.params.sessionId, req.user);
    res.json(result);
  }

  async reportFaceAlert(req, res) {
    const result = await this.liveSessionService.reportFaceAlert(req.params.sessionId, req.user);
    res.json(result);
  }
}
