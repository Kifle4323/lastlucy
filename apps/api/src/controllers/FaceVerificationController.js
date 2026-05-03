import { BaseController } from '../core/BaseController.js';
import { FaceVerificationService } from '../services/FaceVerificationService.js';

export class FaceVerificationController extends BaseController {
  constructor() {
    super();
    this.faceVerificationService = new FaceVerificationService();
    
  }

  setupRoutes() {
    // User profile
    this.authPatch('/users/me/profile', (req, res) => this.updateProfile(req, res));
    this.authGet('/users/me/profile-status', (req, res) => this.getProfileStatus(req, res));

    // Admin routes
    this.roleGet('/admin/students-profiles', (req, res) => this.getStudentsProfiles(req, res), ['ADMIN']);
    this.roleGet('/admin/face-verifications/pending', (req, res) => this.getPending(req, res), ['ADMIN']);
    this.roleGet('/admin/face-verifications', (req, res) => this.getAll(req, res), ['ADMIN']);
    this.rolePost('/admin/face-verifications/:id/review', (req, res) => this.reviewVerification(req, res), ['ADMIN']);

    // Teacher routes
    this.roleGet('/assessments/:assessmentId/attempts-for-grading', (req, res) => this.getAttemptsForGrading(req, res), ['TEACHER']);

    // Student routes
    this.authPost('/face-verifications', (req, res) => this.createVerification(req, res));
    this.authPost('/video-face-verifications', (req, res) => this.createVideoVerification(req, res));
  }

  async updateProfile(req, res) {
    const user = await this.faceVerificationService.updateProfile(req.user.id, req.body);
    res.json(user);
  }

  async getProfileStatus(req, res) {
    const status = await this.faceVerificationService.getProfileStatus(req.user.id);
    res.json(status);
  }

  async getStudentsProfiles(req, res) {
    const students = await this.faceVerificationService.getStudentsProfiles();
    res.json(students);
  }

  async getPending(req, res) {
    const verifications = await this.faceVerificationService.getPending();
    res.json(verifications);
  }

  async getAll(req, res) {
    const verifications = await this.faceVerificationService.getAll(req.query.status);
    res.json(verifications);
  }

  async reviewVerification(req, res) {
    const result = await this.faceVerificationService.reviewVerification(req.params.id, req.user, req.body);
    res.json(result);
  }

  async getAttemptsForGrading(req, res) {
    const attempts = await this.faceVerificationService.getAttemptsForGrading(req.params.assessmentId, req.user);
    res.json(attempts);
  }

  async createVerification(req, res) {
    const verification = await this.faceVerificationService.createVerification(req.user, req.body);
    res.json(verification);
  }

  async createVideoVerification(req, res) {
    const verification = await this.faceVerificationService.createVideoVerification(req.user, req.body);
    res.json(verification);
  }
}
