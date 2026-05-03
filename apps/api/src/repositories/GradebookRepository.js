import { BaseRepository } from '../core/BaseRepository.js';

export class GradebookRepository extends BaseRepository {
  constructor() { super('gradeComponent'); }

  findComponents(courseId) {
    return this.model.findMany({ where: { courseId }, orderBy: { sortOrder: 'asc' } });
  }

  seedDefaults(courseId) {
    return this.prisma.$transaction(async (tx) => {
      const defaults = [
        { courseId, name: 'Quiz', weight: 15, sortOrder: 0 },
        { courseId, name: 'Assignment', weight: 10, sortOrder: 1 },
        { courseId, name: 'Midterm', weight: 25, sortOrder: 2 },
        { courseId, name: 'Final', weight: 40, sortOrder: 3 },
        { courseId, name: 'Attendance', weight: 10, sortOrder: 4 },
      ];
      return Promise.all(defaults.map(d => tx.gradeComponent.create({ data: d })));
    });
  }

  findLegacyConfig(courseId) {
    return this.prisma.courseGradeConfig.findUnique({ where: { courseId } });
  }

  findTeacherCourseSection(courseId, teacherId) {
    return this.prisma.courseSection.findFirst({ where: { courseId, teacherId } });
  }

  findTeacherCourseClass(courseId, teacherId) {
    return this.prisma.courseClass.findFirst({ where: { courseId, teacherId } });
  }

  findAttendanceForCourse(courseId) {
    return this.prisma.attendance.findMany({
      where: { courseId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  upsertAttendance(courseId, studentId, score, feedback) {
    return this.prisma.attendance.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      update: { score, ...(feedback !== undefined && { feedback }) },
      create: { courseId, studentId, score, ...(feedback !== undefined && { feedback }) },
    });
  }

  findSectionsWithStudents(courseId, teacherId) {
    return this.prisma.courseSection.findMany({
      where: { courseId, ...(teacherId ? { teacherId } : {}) },
      include: {
        class: true,
        enrollments: {
          where: { status: 'ENROLLED' },
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
  }

  findCourseClassesWithStudents(courseId, teacherId) {
    return this.prisma.courseClass.findMany({
      where: { courseId, ...(teacherId ? { teacherId } : {}) },
      include: {
        class: {
          include: {
            students: {
              include: { student: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
    });
  }

  findAssessmentsWithAttempts(courseId, studentId) {
    return this.prisma.assessment.findMany({
      where: { courseId },
      include: {
        questions: true,
        attempts: studentId
          ? { where: { studentId, status: 'GRADED' }, include: { student: { select: { id: true } } } }
          : { where: { status: 'GRADED' }, include: { student: { select: { id: true } } } },
        manualGrades: studentId
          ? { where: { studentId } }
          : true,
      },
    });
  }

  findStudentAttendance(courseId, studentId) {
    return this.prisma.attendance.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
    });
  }

  findSectionWithCourse(sectionId, teacherId) {
    return this.prisma.courseSection.findFirst({
      where: { id: sectionId, teacherId },
      include: { course: true, class: true },
    });
  }

  findLiveSessions(courseId, classId) {
    return this.prisma.liveSession.findMany({
      where: { courseId, classId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  findManualSessions(courseId, classId) {
    return this.prisma.manualAttendanceSession.findMany({
      where: { courseId, classId },
      include: { records: true },
      orderBy: { date: 'desc' },
    });
  }

  findClassStudents(classId) {
    return this.prisma.classStudent.findMany({
      where: { classId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  findLiveAttendanceRecords(sessionIds) {
    return this.prisma.liveSessionAttendance.findMany({
      where: { sessionId: { in: sessionIds } },
    });
  }

  upsertManualAttendance(sessionId, studentId, status) {
    return this.prisma.manualAttendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      update: { status },
      create: { sessionId, studentId, status },
    });
  }

  upsertManualSession(courseId, classId, teacherId, title, date) {
    return this.prisma.manualAttendanceSession.upsert({
      where: { courseId_classId_date: { courseId, classId, date } },
      update: { title, teacherId },
      create: { courseId, classId, teacherId, title, date },
    });
  }

  findManualSessionsByCourse(courseId) {
    return this.prisma.manualAttendanceSession.findMany({
      where: { courseId },
      include: { records: { include: { student: { select: { id: true, fullName: true, email: true } } } } },
      orderBy: { date: 'desc' },
    });
  }

  deleteManualSession(sessionId) {
    return this.prisma.manualAttendanceSession.delete({
      where: { id: sessionId },
    });
  }
}
