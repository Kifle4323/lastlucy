import { BaseRepository } from '../core/BaseRepository.js';

export class ClassRepository extends BaseRepository {
  constructor() { super('class'); }

  findForAdmin() {
    return this.model.findMany({
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
        courses: { select: { id: true, teacherId: true, courseId: true, course: true, teacher: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForTeacher(teacherId) {
    return this.model.findMany({
      where: { OR: [{ teachers: { some: { teacherId } } }, { courseSections: { some: { teacherId } } }] },
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
        courseSections: { where: { teacherId }, include: { course: true, semester: { include: { academicYear: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForStudent(studentId) {
    return this.model.findMany({
      where: { students: { some: { studentId } } },
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
        courses: { select: { id: true, teacherId: true, courseId: true, course: true, teacher: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findWithAccess(classId) {
    return this.model.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true, role: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true, role: true } } } },
        courses: { include: { course: true, teacher: { select: { id: true, fullName: true } } } },
      },
    });
  }
}
