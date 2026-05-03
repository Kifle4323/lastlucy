import { BaseRepository } from '../core/BaseRepository.js';

export class PaymentRepository extends BaseRepository {
  constructor() { super('semesterPayment'); }

  findCompletedPayment(studentId, semesterId) {
    return this.model.findFirst({ where: { studentId, semesterId, status: 'COMPLETED' } });
  }

  findPendingPayment(studentId, semesterId) {
    return this.model.findFirst({ where: { studentId, semesterId, status: 'PENDING' } });
  }

  createPayment(data) {
    return this.model.create({ data });
  }

  updatePayment(id, data) {
    return this.model.update({ where: { id }, data });
  }

  findByReference(txRef) {
    return this.model.findFirst({ where: { txRef } });
  }

  findStudentPayments(studentId) {
    return this.model.findMany({
      where: { studentId },
      include: { semester: { include: { academicYear: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
