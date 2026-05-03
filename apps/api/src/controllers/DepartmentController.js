import { BaseController } from '../core/BaseController.js';
import { DepartmentService } from '../services/DepartmentService.js';

export class DepartmentController extends BaseController {
  constructor() {
    super();
    this.departmentService = new DepartmentService();
    
  }

  setupRoutes() {
    this.rolePost('/admin/departments', (req, res) => this.createDepartment(req, res), ['ADMIN']);
    this.authGet('/departments', (req, res) => this.getDepartments(req, res));
    this.authGet('/departments/:id', (req, res) => this.getDepartment(req, res));
    this.rolePatch('/admin/departments/:id', (req, res) => this.updateDepartment(req, res), ['ADMIN']);
    this.roleDelete('/admin/departments/:id', (req, res) => this.deleteDepartment(req, res), ['ADMIN']);
    this.roleGet('/student/registration-fee', (req, res) => this.getRegistrationFee(req, res), ['STUDENT']);
    this.roleGet('/student/graduation-status', (req, res) => this.getGraduationStatus(req, res), ['STUDENT']);
    this.roleGet('/student/certificates', (req, res) => this.getCertificates(req, res), ['STUDENT']);
    this.rolePost('/student/generate-certificate', (req, res) => this.studentGenerateCertificate(req, res), ['STUDENT']);

    // Certificate routes
    this.rolePost('/admin/certificates/generate', (req, res) => this.generateCertificate(req, res), ['ADMIN']);
    this.roleGet('/admin/certificates', (req, res) => this.getAdminCertificates(req, res), ['ADMIN']);
    this.authGet('/certificates/:id', (req, res) => this.getCertificateById(req, res));
  }

  async createDepartment(req, res) {
    const dept = await this.departmentService.createDepartment(req.body);
    res.status(201).json(dept);
  }

  async getDepartments(req, res) {
    const departments = await this.departmentService.getDepartments();
    res.json(departments);
  }

  async getDepartment(req, res) {
    const dept = await this.departmentService.getDepartment(req.params.id);
    res.json(dept);
  }

  async updateDepartment(req, res) {
    const dept = await this.departmentService.updateDepartment(req.params.id, req.body);
    res.json(dept);
  }

  async deleteDepartment(req, res) {
    await this.departmentService.deleteDepartment(req.params.id);
    res.json({ success: true });
  }

  async getRegistrationFee(req, res) {
    const fee = await this.departmentService.getRegistrationFee(req.user.id);
    res.json(fee);
  }

  async getGraduationStatus(req, res) {
    const status = await this.departmentService.getGraduationStatus(req.user.id);
    res.json(status);
  }

  async getCertificates(req, res) {
    const certs = await this.departmentService.getCertificates(req.user.id);
    res.json(certs);
  }

  async generateCertificate(req, res) {
    const cert = await this.departmentService.generateCertificate(req.body.studentId);
    res.json(cert);
  }

  async studentGenerateCertificate(req, res) {
    const cert = await this.departmentService.generateCertificate(req.user.id);
    res.json(cert);
  }

  async getAdminCertificates(req, res) {
    const certs = await this.departmentService.getAdminCertificates();
    res.json(certs);
  }

  async getCertificateById(req, res) {
    const cert = await this.departmentService.getCertificateById(req.params.id);
    res.json(cert);
  }
}
