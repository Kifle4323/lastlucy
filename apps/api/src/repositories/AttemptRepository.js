import { BaseRepository } from '../core/BaseRepository.js';

export class AttemptRepository extends BaseRepository {
  constructor() { super('attempt'); }

  findWithAnswersAndQuestions(attemptId) {
    return this.model.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        assessment: {
          include: {
            questions: true,
            course: {
              include: {
                courseSections: {
                  include: { examSchedules: true }
                }
              }
            }
          }
        },
        faceVerification: true,
      },
    });
  }

  findWithAnswers(attemptId) {
    return this.model.findUnique({
      where: { id: attemptId },
      include: { assessment: { include: { questions: true } }, answers: true },
    });
  }

  findExisting(assessmentId, studentId) {
    return this.model.findFirst({ where: { assessmentId, studentId } });
  }

  findForGrading(attemptId) {
    return this.model.findUnique({
      where: { id: attemptId },
      include: {
        assessment: { include: { course: { include: { courseSections: true } } } },
      },
    });
  }

  findForGradingByAssessment(assessmentId) {
    return this.model.findMany({
      where: { assessmentId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        answers: { include: { question: true } },
        faceVerification: true,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  deleteAssessmentCascade(assessmentId) {
    return this.prisma.$transaction(async (tx) => {
      const attempts = await tx.attempt.findMany({ where: { assessmentId }, select: { id: true } });
      const attemptIds = attempts.map(a => a.id);
      if (attemptIds.length > 0) {
        await tx.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
        await tx.faceVerification.deleteMany({ where: { attemptId: { in: attemptIds } } });
      }
      await tx.attempt.deleteMany({ where: { assessmentId } });
      await tx.manualGrade.deleteMany({ where: { assessmentId } });
      await tx.question.deleteMany({ where: { assessmentId } });
      await tx.assessment.delete({ where: { id: assessmentId } });
    });
  }
}
