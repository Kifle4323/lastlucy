import { BaseRepository } from '../core/BaseRepository.js';

export class AddDropRepository extends BaseRepository {
  constructor() { super('addDropRequest'); }

  findActiveSemester() {
    const now = new Date();
    return this.prisma.semester.findMany({
      where: { addDropStart: { not: null }, addDropEnd: { not: null } },
    }).then(semesters => semesters.find(s => now >= new Date(s.addDropStart) && now <= new Date(s.addDropEnd)) || null);
  }

  findCurrentEnrollments(studentId, semesterId) {
    return this.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED', courseSection: { semesterId } },
      include: { courseSection: { include: { course: true, teacher: { select: { id: true, fullName: true } } } }, grade: true },
    });
  }

  findFailedEnrollments(studentId) {
    return this.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED', grade: { gradeLetter: 'F' } },
      include: { courseSection: { include: { course: true, semester: true } } },
    });
  }

  findAvailableSections(semesterId, courseIds) {
    return this.prisma.courseSection.findMany({
      where: { semesterId, courseId: { in: courseIds } },
      include: { course: true, teacher: { select: { id: true, fullName: true } }, class: { select: { id: true, name: true, code: true } }, _count: { select: { enrollments: true } } },
    });
  }

  findExistingRequests(studentId, semesterId) {
    return this.model.findMany({
      where: { studentId, semesterId },
      include: {
        courseSection: { include: { course: true, teacher: { select: { id: true, fullName: true } }, class: { select: { name: true } } } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingRequests() {
    return this.model.findMany({
      where: { status: 'PENDING' },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: true, semester: { include: { academicYear: true } }, class: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createRequest(data) {
    return this.model.create({ data });
  }

  updateRequest(id, data) {
    return this.model.update({ where: { id }, data });
  }
}
