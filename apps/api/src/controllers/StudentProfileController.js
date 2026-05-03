import { BaseController } from '../core/BaseController.js';
import { StudentProfileService } from '../services/StudentProfileService.js';

export class StudentProfileController extends BaseController {
  constructor() {
    super();
    this.studentProfileService = new StudentProfileService();
    
  }

  setupRoutes() {
    // Student routes
    this.roleGet('/student/profile', (req, res) => this.getProfile(req, res), ['STUDENT']);
    this.rolePatch('/student/profile', (req, res) => this.updateProfile(req, res), ['STUDENT']);
    this.rolePost('/student/profile/documents', (req, res) => this.uploadDocument(req, res), ['STUDENT']);
    this.roleDelete('/student/profile/documents/:documentId', (req, res) => this.deleteDocument(req, res), ['STUDENT']);

    // Admin routes
    this.roleGet('/admin/student-profiles/pending', (req, res) => this.getPendingProfiles(req, res), ['ADMIN']);
    this.roleGet('/admin/student-profiles', (req, res) => this.getAllProfiles(req, res), ['ADMIN']);
    this.roleGet('/admin/student-profiles/:profileId', (req, res) => this.getSingleProfile(req, res), ['ADMIN']);
    this.rolePost('/admin/student-profiles/:profileId/approve', (req, res) => this.approveProfile(req, res), ['ADMIN']);
    this.rolePost('/admin/student-profiles/:profileId/reject', (req, res) => this.rejectProfile(req, res), ['ADMIN']);
  }

  async getProfile(req, res) {
    const profile = await this.studentProfileService.getProfile(req.user.id);
    res.json(profile);
  }

  async updateProfile(req, res) {
    const profile = await this.studentProfileService.updateProfile(req.user.id, req.body);
    res.json(profile);
  }

  async uploadDocument(req, res) {
    const document = await this.studentProfileService.uploadDocument(req.user.id, req.body);
    res.json(document);
  }

  async deleteDocument(req, res) {
    await this.studentProfileService.deleteDocument(req.user.id, req.params.documentId);
    res.json({ success: true });
  }

  async getPendingProfiles(req, res) {
    const profiles = await this.studentProfileService.getPendingProfiles();
    res.json(profiles);
  }

  async getAllProfiles(req, res) {
    const profiles = await this.studentProfileService.getAllProfiles(req.query.status);
    res.json(profiles);
  }

  async getSingleProfile(req, res) {
    const profile = await this.studentProfileService.getSingleProfile(req.params.profileId);
    res.json(profile);
  }

  async approveProfile(req, res) {
    const profile = await this.studentProfileService.approveProfile(req.params.profileId, req.user.id);
    res.json(profile);
  }

  async rejectProfile(req, res) {
    const profile = await this.studentProfileService.rejectProfile(req.params.profileId, req.user.id, req.body.reason);
    res.json(profile);
  }
}
