import { BaseController } from '../core/BaseController.js';
import { PaymentService } from '../services/PaymentService.js';

export class PaymentController extends BaseController {
  constructor() {
    super();
    this.paymentService = new PaymentService();
    
  }

  setupRoutes() {
    this.rolePost('/payments/initialize', (req, res) => this.initializePayment(req, res), ['STUDENT']);
    this.authGet('/payments/verify/:txRef', (req, res) => this.verifyPayment(req, res));
    this.roleGet('/payments/my', (req, res) => this.getStudentPayments(req, res), ['STUDENT']);
    this.roleGet('/payments/semester/:semesterId/status', (req, res) => this.getSemesterPaymentStatus(req, res), ['STUDENT']);
    this.get('/payments/callback', (req, res) => this.paymentCallback(req, res));
    this.roleGet('/admin/payments/semester/:semesterId', (req, res) => this.getSemesterPayments(req, res), ['ADMIN']);
    this.rolePatch('/admin/semesters/:semesterId/fee', (req, res) => this.setRegistrationFee(req, res), ['ADMIN']);
  }

  async initializePayment(req, res) {
    const result = await this.paymentService.initializePayment(req.user, req.body);
    res.json(result);
  }

  async verifyPayment(req, res) {
    const result = await this.paymentService.verifyPayment(req.params.txRef);
    res.json(result);
  }

  async getSemesterPaymentStatus(req, res) {
    const result = await this.paymentService.getSemesterPaymentStatus(req.user.id, req.params.semesterId);
    res.json(result);
  }

  async paymentCallback(req, res) {
    try {
      const result = await this.paymentService.handleCallback(req.query);
      // Redirect to frontend with txRef and status
      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
      res.json(result);
    } catch (err) {
      console.error('Callback error:', err);
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${FRONTEND_URL}/payment-return?status=error`);
    }
  }

  async getSemesterPayments(req, res) {
    const payments = await this.paymentService.getSemesterPayments(req.params.semesterId);
    res.json(payments);
  }

  async setRegistrationFee(req, res) {
    const result = await this.paymentService.setRegistrationFee(req.params.semesterId, req.body.registrationFee);
    res.json(result);
  }
}
