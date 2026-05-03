import { BaseRepository } from '../core/BaseRepository.js';

export class QuestionReportRepository extends BaseRepository {
  constructor() { super('questionReport'); }

  findExistingReport(questionId, studentId) {
    return this.model.findUnique({
      where: { questionId_studentId: { questionId, studentId } },
    });
  }

  createReport(data) {
    return this.model.create({
      data,
      include: { question: { include: { assessment: { include: { course: true } } } } },
    });
  }

  findStudentReports(studentId) {
    return this.model.findMany({
      where: { studentId },
      include: { question: { include: { assessment: { include: { course: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findTeacherReports(assessmentIds, status) {
    const where = { question: { assessmentId: { in: assessmentIds } } };
    if (status && status !== 'ALL') where.status = status;
    return this.model.findMany({
      where,
      include: {
        question: { include: { assessment: { include: { course: true } } } },
        student: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findWithCourse(reportId) {
    return this.model.findUnique({
      where: { id: reportId },
      include: { question: { include: { assessment: { include: { course: true } } } }, student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  updateReport(reportId, data) {
    return this.model.update({
      where: { id: reportId },
      data,
      include: {
        question: { include: { assessment: { include: { course: true } } } },
        student: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  countPendingForTeacher(assessmentIds) {
    return this.model.count({
      where: { question: { assessmentId: { in: assessmentIds } }, status: 'PENDING' },
    });
  }

  findTeacherCourseIds(teacherId) {
    return this.prisma.courseSection.findMany({
      where: { teacherId },
      select: { courseId: true },
    });
  }

  findAssessmentIdsForCourses(courseIds) {
    return this.prisma.assessment.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    });
  }
}
