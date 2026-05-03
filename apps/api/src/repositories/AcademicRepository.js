import { BaseRepository } from '../core/BaseRepository.js';

export class AcademicRepository extends BaseRepository {
  constructor() { super('academicYear'); }

  findWithSemesters() {
    return this.model.findMany({
      include: { semesters: true },
      orderBy: { startDate: 'desc' },
    });
  }

  findSemester(semesterId) {
    return this.prisma.semester.findUnique({ where: { id: semesterId } });
  }

  findActiveSemesters() {
    return this.prisma.semester.findMany({
      include: { academicYear: true, _count: { select: { courseSections: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  createSemester(data) {
    return this.prisma.semester.upsert({
      where: { academicYearId_type: { academicYearId: data.academicYearId, type: data.type } },
      update: data,
      create: data,
    });
  }

  updateSemester(semesterId, data) {
    return this.prisma.semester.update({ where: { id: semesterId }, data });
  }

  deleteSemester(semesterId) {
    return this.prisma.semester.delete({ where: { id: semesterId } });
  }

  createSection(data) {
    return this.prisma.courseSection.create({ data });
  }

  findSections(semesterId) {
    return this.prisma.courseSection.findMany({
      where: semesterId ? { semesterId } : {},
      include: { course: true, class: true, teacher: { select: { id: true, fullName: true, email: true } }, semester: true, scheduleSlots: true, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findSection(sectionId) {
    return this.prisma.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true, class: true, teacher: { select: { id: true, fullName: true, email: true } }, semester: true, scheduleSlots: true, enrollments: { where: { status: 'ENROLLED' }, include: { student: { select: { id: true, fullName: true, email: true } } } } },
    });
  }

  updateSection(sectionId, data) {
    return this.prisma.courseSection.update({ where: { id: sectionId }, data });
  }

  deleteSection(sectionId) {
    return this.prisma.$transaction(async (tx) => {
      // Delete early exam requests first
      await tx.earlyExamRequest.deleteMany({
        where: { examSchedule: { courseSectionId: sectionId } }
      });
      // Delete schedule slots
      await tx.courseScheduleSlot.deleteMany({
        where: { courseSectionId: sectionId }
      });
      // Delete student grades
      await tx.studentGrade.deleteMany({
        where: { enrollment: { courseSectionId: sectionId } }
      });
      // Delete exam schedules
      await tx.examSchedule.deleteMany({
        where: { courseSectionId: sectionId }
      });
      // Nullify add/drop requests referencing this section
      await tx.addDropRequest.updateMany({
        where: { courseSectionId: sectionId },
        data: { courseSectionId: null }
      });
      // Delete enrollments
      await tx.studentEnrollment.deleteMany({
        where: { courseSectionId: sectionId }
      });
      // Finally delete the section
      await tx.courseSection.delete({ where: { id: sectionId } });
    });
  }

  findEnrollments(sectionId) {
    return this.prisma.studentEnrollment.findMany({
      where: { courseSectionId: sectionId, status: 'ENROLLED' },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  enrollStudent(sectionId, studentId) {
    return this.prisma.studentEnrollment.upsert({
      where: { id: '' }, // Will use create + find pattern
      create: { courseSection: { connect: { id: sectionId } }, student: { connect: { id: studentId } }, status: 'ENROLLED' },
      update: { status: 'ENROLLED' },
    });
  }

  unenrollStudent(sectionId, studentId) {
    return this.prisma.studentEnrollment.updateMany({
      where: { courseSectionId: sectionId, studentId },
      data: { status: 'DROPPED' },
    });
  }

  publishGrades(sectionId) {
    return this.prisma.studentGrade.updateMany({
      where: { enrollment: { courseSectionId: sectionId } },
      data: { isPublished: true },
    });
  }
}
