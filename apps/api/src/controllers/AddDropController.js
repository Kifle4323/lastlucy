import { BaseController } from '../core/BaseController.js';
import { AddDropService } from '../services/AddDropService.js';

export class AddDropController extends BaseController {
  constructor() {
    super();
    this.addDropService = new AddDropService();
    
  }

  setupRoutes() {
    this.roleGet('/add-drop/eligibility', (req, res) => this.getEligibility(req, res), ['STUDENT']);
    this.rolePost('/add-drop/add', (req, res) => this.createAddRequest(req, res), ['STUDENT']);
    this.rolePost('/add-drop/drop', (req, res) => this.createDropRequest(req, res), ['STUDENT']);
    this.rolePost('/add-drop/requests', (req, res) => this.createRequest(req, res), ['STUDENT']);
    this.authDelete('/add-drop/:requestId', (req, res) => this.cancelRequest(req, res));
    this.roleGet('/admin/add-drop-requests', (req, res) => this.getRequests(req, res), ['ADMIN']);
    this.rolePost('/admin/add-drop-requests/:requestId/approve', (req, res) => this.approveRequest(req, res), ['ADMIN']);
    this.rolePost('/admin/add-drop-requests/:requestId/reject', (req, res) => this.rejectRequest(req, res), ['ADMIN']);
    this.roleGet('/admin/semesters/add-drop', (req, res) => this.getSemestersAddDrop(req, res), ['ADMIN']);
    this.rolePatch('/admin/semesters/:semesterId/add-drop', (req, res) => this.updateSemesterAddDrop(req, res), ['ADMIN']);
  }

  async getEligibility(req, res) {
    const result = await this.addDropService.getEligibility(req.user);
    res.json(result);
  }

  async createAddRequest(req, res) {
    const request = await this.addDropService.createAddRequest(req.user, req.body);
    res.status(201).json(request);
  }

  async createDropRequest(req, res) {
    const request = await this.addDropService.createDropRequest(req.user, req.body);
    res.status(201).json(request);
  }

  async createRequest(req, res) {
    const request = await this.addDropService.createRequest(req.user, req.body);
    res.status(201).json(request);
  }

  async cancelRequest(req, res) {
    await this.addDropService.cancelRequest(req.user, req.params.requestId);
    res.json({ success: true });
  }

  async getRequests(req, res) {
    const requests = await this.addDropService.getRequests(req.query);
    res.json(requests);
  }

  async approveRequest(req, res) {
    const request = await this.addDropService.approveRequest(req.user, req.params.requestId, req.body.adminNotes);
    res.json(request);
  }

  async rejectRequest(req, res) {
    const request = await this.addDropService.rejectRequest(req.user, req.params.requestId, req.body.adminNotes);
    res.json(request);
  }

  async getSemestersAddDrop(req, res) {
    const semesters = await this.addDropService.getSemestersAddDrop();
    res.json(semesters);
  }

  async updateSemesterAddDrop(req, res) {
    const result = await this.addDropService.updateSemesterAddDrop(req.params.semesterId, req.body);
    res.json(result);
  }
}
