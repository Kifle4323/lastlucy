import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';

const CHAPA_API = 'https://api.chapa.co/v1/transaction';
const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class PaymentService extends BaseService {
  constructor() {
    super(new PaymentRepository());
  }

  async initializePayment(user, body) {
    const schema = z.object({ semesterId: z.string() });
    const data = schema.parse(body);

    // Fetch full user from DB (req.user only has id and role from JWT)
    const fullUser = await this.repository.prisma.user.findUnique({ where: { id: user.id } });
    this.throwUnless(fullUser, 404, 'not_found', 'User not found');

    const semester = await this.repository.prisma.semester.findUnique({ where: { id: data.semesterId } });
    this.throwUnless(semester, 404, 'not_found', 'Semester not found');

    let registrationFee = semester.registrationFee || 0;

    if (!registrationFee || registrationFee <= 0) {
      const classStudent = await this.repository.prisma.classStudent.findFirst({
        where: { studentId: user.id },
        include: { class: { include: { department: true } } },
      });

      if (classStudent?.class?.department) {
        const dept = classStudent.class.department;
        const studentProfile = await this.repository.prisma.studentProfile.findUnique({ where: { userId: user.id } });
        const courseSectionsWhere = { semesterId: data.semesterId, classId: classStudent.classId };
        if (studentProfile?.stream) {
          courseSectionsWhere.course = { OR: [{ stream: studentProfile.stream }, { stream: null }] };
        }
        const courseSections = await this.repository.prisma.courseSection.findMany({
          where: courseSectionsWhere, include: { course: true },
        });
        const semesterCreditHours = courseSections.reduce((sum, cs) => sum + (cs.course?.creditHours || 3), 0);
        registrationFee = semesterCreditHours * dept.pricePerCreditHour;
      }
    }

    this.throwUnless(registrationFee > 0, 400, 'no_fee', 'No registration fee available. Contact admin.');

    const existingPayment = await this.repository.findCompletedPayment(user.id, data.semesterId);
    this.throwIf(existingPayment, 400, 'already_paid', 'You have already paid for this semester');

    const pendingPayment = await this.repository.findPendingPayment(user.id, data.semesterId);
    if (pendingPayment) {
      return { message: 'You have a pending payment', payment: pendingPayment, checkoutUrl: pendingPayment.checkoutUrl };
    }

    const txRef = `lucy${Date.now()}${Math.random().toString(36).substring(2, 8)}`;

    // Get student profile for name/phone
    const studentProfile = await this.repository.prisma.studentProfile.findUnique({ where: { userId: user.id } });
    const firstName = studentProfile?.firstName || fullUser.fullName?.split(' ')[0] || 'Student';
    const lastName = studentProfile?.fatherName || fullUser.fullName?.split(' ').slice(1).join(' ') || 'User';

    // Validate email - Chapa requires valid email, .edu domains may be rejected
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const studentEmail = fullUser.email || studentProfile?.email || '';
    // Chapa rejects .edu domains - use fallback Gmail
    const isChapaCompatibleEmail = emailRegex.test(studentEmail) && !studentEmail.endsWith('.edu');
    const validEmail = isChapaCompatibleEmail ? studentEmail : `lucystudent${user.id.substring(0, 8)}@gmail.com`;

    const API_URL = process.env.API_URL || 'http://localhost:4000';
    console.log('Sending to Chapa - email:', validEmail, '| user.email:', fullUser.email, '| amount:', registrationFee);
    try {
      const response = await fetch(`${CHAPA_API}/initialize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CHAPA_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: registrationFee.toString(),
          currency: 'ETB',
          email: validEmail,
          first_name: firstName,
          last_name: lastName,
          phone_number: (studentProfile?.phone && /^(\+?251|0)?9\d{8}$/.test(studentProfile.phone.replace(/\s/g, ''))) ? studentProfile.phone : '+251911000000',
          tx_ref: txRef,
          callback_url: `${API_URL}/api/payments/callback`,
          return_url: `${FRONTEND_URL}/payment-return?txRef=${txRef}`,
          customization: { title: 'Lucy LMS Fee', description: `Registration fee for ${semester.name}` },
        }),
      });
      const result = await response.json();

      if (result.status === 'success') {
        const payment = await this.repository.prisma.semesterPayment.create({
          data: {
            studentId: user.id,
            semesterId: data.semesterId,
            amount: registrationFee,
            currency: 'ETB',
            txRef,
            checkoutUrl: result.data?.checkout_url,
            returnUrl: `${FRONTEND_URL}/payment-return?txRef=${txRef}`,
            status: 'PENDING',
          },
        });
        return { message: 'Payment initialized successfully', payment, checkoutUrl: result.data?.checkout_url };
      }

      const chapaMsg = typeof result.message === 'string' ? result.message
        : (typeof result.data?.message === 'string' ? result.data.message
        : JSON.stringify(result, null, 2));
      console.error('Chapa API error response:', JSON.stringify(result, null, 2));
      throw AppError.internal('Chapa payment failed: ' + chapaMsg);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal('Payment initialization failed: ' + err.message);
    }
  }

  async verifyPayment(txRef) {
    const payment = await this.repository.prisma.semesterPayment.findUnique({
      where: { txRef },
      include: { semester: true },
    });
    this.throwUnless(payment, 404, 'not_found', 'Payment not found');

    // If still pending, verify with Chapa
    if (payment.status === 'PENDING') {
      try {
        const response = await fetch(`${CHAPA_API}/verify/${txRef}`, {
          headers: { 'Authorization': `Bearer ${CHAPA_SECRET}` },
        });
        const result = await response.json();
        console.log('Chapa verify response:', JSON.stringify(result, null, 2));

        if (result.status === 'success' && result.data?.status === 'success') {
          await this.repository.prisma.semesterPayment.update({
            where: { txRef },
            data: { status: 'COMPLETED', chapaRefId: result.data.ref_id, paidAt: new Date() },
          });
          payment.status = 'COMPLETED';
          payment.paidAt = new Date();
        } else if (result.data?.status === 'failed' || result.data?.status === 'failed/cancelled') {
          await this.repository.prisma.semesterPayment.update({
            where: { txRef },
            data: { status: 'FAILED' },
          });
          payment.status = 'FAILED';
        } else {
          console.log('Payment not yet confirmed by Chapa. data.status:', result.data?.status);
        }
      } catch (err) {
        console.error('Chapa verify error:', err.message);
      }
    }

    return { payment };
  }

  async getStudentPayments(studentId) {
    return this.repository.findStudentPayments(studentId);
  }

  async getSemesterPaymentStatus(studentId, semesterId) {
    const payment = await this.repository.prisma.semesterPayment.findFirst({
      where: { studentId, semesterId, status: 'COMPLETED' },
    });
    const pendingPayment = await this.repository.prisma.semesterPayment.findFirst({
      where: { studentId, semesterId, status: 'PENDING' },
    });
    return {
      isPaid: !!payment,
      payment: payment || pendingPayment || null,
      status: payment ? 'COMPLETED' : pendingPayment ? 'PENDING' : 'NONE',
    };
  }

  async handleCallback(query) {
    const { trx_ref, ref_id, status } = query;
    console.log('Chapa callback received:', { trx_ref, ref_id, status });
    if (!trx_ref) return { success: false, message: 'Missing transaction reference' };

    const payment = await this.repository.prisma.semesterPayment.findUnique({ where: { txRef: trx_ref } });
    if (!payment) return { success: false, message: 'Payment not found' };

    if (status === 'success') {
      // Verify with Chapa before marking completed
      try {
        const verifyResponse = await fetch(`${CHAPA_API}/verify/${trx_ref}`, {
          headers: { 'Authorization': `Bearer ${CHAPA_SECRET}` },
        });
        const verifyData = await verifyResponse.json();

        if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
          await this.repository.prisma.semesterPayment.update({
            where: { txRef: trx_ref },
            data: { status: 'COMPLETED', chapaRefId: ref_id || verifyData.data.ref_id, paidAt: new Date() },
          });
          console.log(`Payment completed: ${trx_ref}`);
        } else {
          await this.repository.prisma.semesterPayment.update({
            where: { txRef: trx_ref },
            data: { status: 'FAILED', chapaRefId: ref_id || verifyData.data?.reference || null },
          });
        }
      } catch (err) {
        console.error('Callback verify error:', err.message);
      }
    } else {
      await this.repository.prisma.semesterPayment.update({
        where: { txRef: trx_ref },
        data: { status: 'FAILED', chapaRefId: ref_id || null },
      });
    }

    return { success: status === 'success', redirectUrl: `${FRONTEND_URL}/payment-return?txRef=${trx_ref}&status=${status}` };
  }

  async getSemesterPayments(semesterId) {
    return this.repository.prisma.semesterPayment.findMany({
      where: { semesterId },
      include: { student: { select: { id: true, fullName: true, email: true } }, semester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setRegistrationFee(semesterId, registrationFee) {
    return this.repository.prisma.semester.update({
      where: { id: semesterId },
      data: { registrationFee },
    });
  }
}
