import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { FaceVerificationRepository } from '../repositories/FaceVerificationRepository.js';
import { TextSimilarity } from '../core/TextSimilarity.js';

export class FaceVerificationService extends BaseService {
  constructor() {
    super(new FaceVerificationRepository());
  }

  async updateProfile(userId, body) {
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      profileImage: z.string().optional(),
    });
    const data = schema.parse(body);

    return this.repository.prisma.user.update({
      where: { id: userId },
      data: { ...data, ...(data.profileImage ? { isProfileComplete: true } : {}) },
      select: { id: true, email: true, fullName: true, role: true, profileImage: true, isProfileComplete: true },
    });
  }

  async getProfileStatus(userId) {
    return this.repository.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, profileImage: true, isProfileComplete: true },
    });
  }

  async getStudentsProfiles() {
    return this.repository.prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, email: true, fullName: true, profileImage: true, isProfileComplete: true, createdAt: true, classStudents: { include: { class: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPending() {
    return this.repository.findPending();
  }

  async getAll(status) {
    return this.repository.findAll(status);
  }

  async reviewVerification(id, adminUser, body) {
    const schema = z.object({ approved: z.boolean() });
    const data = schema.parse(body);

    const verification = await this.repository.findById(id);
    this.throwUnless(verification, 404, 'not_found', 'Verification not found');

    // Update verification and attempt
    const [updated] = await this.repository.prisma.$transaction([
      this.repository.prisma.faceVerification.update({
        where: { id },
        data: { adminReviewed: true, adminApproved: data.approved, adminId: adminUser.id, reviewedAt: new Date() },
        include: { student: { select: { id: true, fullName: true, email: true } }, attempt: { include: { assessment: { select: { title: true } } } } },
      }),
      this.repository.prisma.attempt.update({
        where: { id: verification.attemptId },
        data: { faceVerified: data.approved, faceVerifiedAt: data.approved ? new Date() : null, ...(!data.approved ? { status: 'REJECTED', score: 0 } : {}) },
      }),
    ]);

    // If approved, auto-grade the attempt
    if (data.approved) {
      const attempt = await this.repository.prisma.attempt.findUnique({
        where: { id: verification.attemptId },
        include: { answers: { include: { question: true } }, assessment: true },
      });

      if (attempt && attempt.status === 'SUBMITTED') {
        let totalScore = 0;
        for (const answer of attempt.answers) {
          let score = 0, isCorrect = false;
          if (answer.question?.type === 'MCQ' || answer.question?.type === 'TRUE_FALSE') {
            isCorrect = answer.selectedOption === answer.question.correctAnswer;
            score = isCorrect ? (answer.question.points || 1) : 0;
            totalScore += score;
          } else if (answer.question?.type === 'FITB') {
            if (answer.textAnswer && answer.question.correctAnswer) {
              isCorrect = answer.textAnswer.trim().toLowerCase() === answer.question.correctAnswer.trim().toLowerCase();
              score = isCorrect ? (answer.question.points || 1) : 0;
              totalScore += score;
            }
          } else if (answer.question?.type === 'SHORT_ANSWER') {
            if (answer.textAnswer && answer.textAnswer.trim().length > 0) {
              isCorrect = true; score = answer.question.points || 1; totalScore += score;
            }
          }
          await this.repository.prisma.answer.update({ where: { id: answer.id }, data: { score, isCorrect } });
        }
        const maxScore = attempt.assessment?.maxScore ?? 0;
        const clampedScore = maxScore > 0 ? Math.min(totalScore, maxScore) : totalScore;
        await this.repository.prisma.attempt.update({ where: { id: verification.attemptId }, data: { status: 'GRADED', score: clampedScore } });
      }
    }

    return updated;
  }

  async getAttemptsForGrading(assessmentId, user) {
    const assessment = await this.repository.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: { include: { courseSections: true } } },
    });
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const courseSection = assessment.course.courseSections.find(s => s.teacherId === user.id);
    this.throwUnless(courseSection, 403, 'forbidden', 'Not assigned to this course');

    return this.repository.findAttemptsForGrading(assessmentId);
  }

  async createVerification(user, body) {
    const schema = z.object({ attemptId: z.string(), capturedImage: z.string(), matchResult: z.boolean() });
    const data = schema.parse(body);

    const attempt = await this.repository.prisma.attempt.findFirst({
      where: { id: data.attemptId, studentId: user.id },
    });
    this.throwUnless(attempt, 404, 'attempt_not_found', 'Attempt not found');

    const student = await this.repository.prisma.user.findUnique({
      where: { id: user.id }, select: { profileImage: true },
    });

    return this.repository.upsertVerification(data.attemptId, user.id, data.capturedImage, student?.profileImage, data.matchResult);
  }

  async createVideoVerification(user, body) {
    const schema = z.object({ materialId: z.string(), capturedImage: z.string(), matchResult: z.boolean() });
    const data = schema.parse(body);

    const material = await this.repository.prisma.material.findFirst({
      where: { id: data.materialId, fileType: 'video' },
    });
    this.throwUnless(material, 404, 'not_found', 'Video material not found');

    const student = await this.repository.prisma.user.findUnique({
      where: { id: user.id }, select: { profileImage: true },
    });

    return this.repository.prisma.videoFaceVerification.upsert({
      where: { materialId_studentId: { materialId: data.materialId, studentId: user.id } },
      update: { capturedImage: data.capturedImage, matchedImage: student?.profileImage, matchResult: data.matchResult, adminReviewed: false, adminApproved: false },
      create: { material: { connect: { id: data.materialId } }, student: { connect: { id: user.id } }, capturedImage: data.capturedImage, matchedImage: student?.profileImage, matchResult: data.matchResult },
    });
  }
}
