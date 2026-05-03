import { BaseRepository } from '../core/BaseRepository.js';

export class FaceVerificationRepository extends BaseRepository {
  constructor() { super('faceVerification'); }

  findPending() {
    return this.model.findMany({
      where: { matchResult: false, adminReviewed: false },
      include: {
        student: { select: { id: true, fullName: true, email: true, profileImage: true } },
        attempt: { include: { assessment: { select: { id: true, title: true, examType: true, course: { select: { title: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll(query) {
    const where = {};
    if (query === 'pending') { where.matchResult = false; where.adminReviewed = false; }
    else if (query === 'approved') { where.matchResult = false; where.adminReviewed = true; where.adminApproved = true; }
    else if (query === 'rejected') { where.matchResult = false; where.adminReviewed = true; where.adminApproved = false; }
    else if (query === 'matched') { where.matchResult = true; }

    return this.model.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, email: true, profileImage: true } },
        attempt: { include: { assessment: { select: { id: true, title: true, examType: true, course: { select: { title: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByAttempt(attemptId) {
    return this.model.findUnique({ where: { attemptId } });
  }

  upsertVerification(attemptId, studentId, capturedImage, matchedImage, matchResult) {
    return this.model.upsert({
      where: { attemptId },
      create: { attempt: { connect: { id: attemptId } }, student: { connect: { id: studentId } }, capturedImage, matchedImage, matchResult },
      update: { capturedImage, matchResult },
    });
  }

  reviewVerification(id, approved, adminId) {
    return this.prisma.$transaction([
      this.model.update({
        where: { id },
        data: { adminReviewed: true, adminApproved: approved, adminId, reviewedAt: new Date() },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          attempt: { include: { assessment: { select: { title: true } } } },
        },
      }),
    ]);
  }

  findAttemptsForGrading(assessmentId) {
    return this.prisma.attempt.findMany({
      where: { assessmentId, status: { in: ['SUBMITTED', 'GRADED', 'REJECTED'] } },
      include: {
        student: { select: { id: true, fullName: true, email: true, profileImage: true } },
        faceVerification: true,
        answers: { include: { question: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
