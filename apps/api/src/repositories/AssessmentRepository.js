import { BaseRepository } from '../core/BaseRepository.js';

export class AssessmentRepository extends BaseRepository {
  constructor() { super('assessment'); }

  findWithCourse(assessmentId) {
    return this.model.findUnique({
      where: { id: assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } } },
    });
  }

  findWithCourseAndQuestions(assessmentId) {
    return this.model.findUnique({
      where: { id: assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } }, questions: true },
    });
  }

  findWithEnrollments(assessmentId) {
    return this.model.findUnique({
      where: { id: assessmentId },
      include: {
        course: {
          include: {
            courseSections: { include: { enrollments: { where: { status: 'ENROLLED' } } } },
          },
        },
      },
    });
  }

  findByCourse(courseId) {
    return this.model.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true } }, questions: { select: { points: true } } },
    });
  }

  findByCourseWithSchedule(courseId) {
    return this.model.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
        questions: { select: { points: true } },
        course: {
          include: {
            courseSections: { include: { examSchedules: true, semester: { select: { id: true, midtermExamDate: true, finalExamDate: true, midtermExamStart: true, midtermExamEnd: true, finalExamStart: true, finalExamEnd: true } } } },
            courseClasses: true,
          },
        },
      },
    });
  }

  findWithAccessCheck(courseId) {
    return this.model.findUnique({
      where: { id: courseId },
      include: {
        course: {
          include: {
            courseSections: { include: { class: { include: { students: true, teachers: true } }, teacher: true, enrollments: { where: { status: 'ENROLLED' } } } },
            courseClasses: true,
          },
        },
      },
    });
  }
}
