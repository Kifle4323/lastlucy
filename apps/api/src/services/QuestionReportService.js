import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { QuestionReportRepository } from '../repositories/QuestionReportRepository.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';

export class QuestionReportService extends BaseService {
  constructor() {
    super(new QuestionReportRepository());
    this.notificationRepo = new NotificationRepository();
  }

  async reportQuestion(user, questionId, body) {
    const schema = z.object({ reason: z.string().min(10, 'Reason must be at least 10 characters') });
    const data = schema.parse(body);

    const question = await this.repository.prisma.question.findUnique({
      where: { id: questionId },
      include: { assessment: { include: { course: true } } },
    });
    this.throwUnless(question, 404, 'not_found', 'Question not found');

    const existing = await this.repository.findExistingReport(questionId, user.id);
    this.throwIf(existing, 400, 'already_reported', 'You have already reported this question');

    return this.repository.createReport({ questionId, studentId: user.id, reason: data.reason });
  }

  async getStudentReports(userId) {
    return this.repository.findStudentReports(userId);
  }

  async deleteReport(user, reportId) {
    const report = await this.repository.findById(reportId);
    this.throwUnless(report, 404, 'not_found', 'Report not found or already processed');
    this.throwUnless(report.studentId === user.id && report.status === 'PENDING', 404, 'not_found', 'Report not found or already processed');
    await this.repository.delete(reportId);
  }

  async getTeacherReports(user, status) {
    const schema = z.object({ status: z.enum(['PENDING', 'UNDER_REVIEW', 'RESOLVED_CORRECT', 'RESOLVED_INCORRECT', 'DISMISSED', 'ALL']).optional().default('ALL') });
    const query = schema.parse({ status });

    const courseSections = await this.repository.findTeacherCourseIds(user.id);
    const courseIds = [...new Set(courseSections.map(cs => cs.courseId))];
    const assessments = await this.repository.findAssessmentIdsForCourses(courseIds);
    const assessmentIds = assessments.map(a => a.id);

    return this.repository.findTeacherReports(assessmentIds, query.status);
  }

  async updateReport(user, reportId, body) {
    const schema = z.object({
      status: z.enum(['UNDER_REVIEW', 'RESOLVED_CORRECT', 'RESOLVED_INCORRECT', 'DISMISSED']),
      adminNotes: z.string().optional(),
    });
    const data = schema.parse(body);

    const report = await this.repository.findWithCourse(reportId);
    this.throwUnless(report, 404, 'not_found', 'Report not found');

    const courseSection = await this.repository.prisma.courseSection.findFirst({
      where: { courseId: report.question.assessment.courseId, teacherId: user.id },
    });
    this.throwUnless(courseSection, 403, 'forbidden', 'You can only review reports for your own courses');

    const updated = await this.repository.updateReport(reportId, {
      status: data.status,
      adminNotes: data.adminNotes,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    });

    // Notify student
    let title = '', message = '';
    if (data.status === 'RESOLVED_CORRECT') {
      title = 'Question Report Accepted';
      message = `Your report for question in "${updated.question.assessment.title}" has been reviewed and accepted.`;
    } else if (data.status === 'RESOLVED_INCORRECT') {
      title = 'Question Report Reviewed';
      message = `Your report for question in "${updated.question.assessment.title}" has been reviewed. The question was found to be correct.`;
    } else if (data.status === 'DISMISSED') {
      title = 'Question Report Dismissed';
      message = `Your report for question in "${updated.question.assessment.title}" has been dismissed.`;
    }

    if (title) {
      await this.notificationRepo.createNotification({
        data: { userId: updated.studentId, type: 'QUESTION_REPORT_RESOLVED', title, message, data: { reportId } },
      });
    }

    return updated;
  }

  async getTeacherReportCount(user) {
    const courseSections = await this.repository.findTeacherCourseIds(user.id);
    const courseIds = [...new Set(courseSections.map(cs => cs.courseId))];
    const assessments = await this.repository.findAssessmentIdsForCourses(courseIds);
    const assessmentIds = assessments.map(a => a.id);
    const pendingCount = await this.repository.countPendingForTeacher(assessmentIds);
    return { pendingCount };
  }
}
