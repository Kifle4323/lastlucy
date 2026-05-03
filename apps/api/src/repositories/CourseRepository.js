import { BaseRepository } from '../core/BaseRepository.js';

export class CourseRepository extends BaseRepository {
  constructor() { super('course'); }

  findForAdmin() {
    return this.model.findMany({
      include: {
        courseClasses: {
          include: { class: true, teacher: { select: { id: true, fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForTeacher(teacherId) {
    return this.model.findMany({
      where: { courseClasses: { some: { teacherId } } },
      include: { courseClasses: { where: { teacherId }, include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForStudent(studentId) {
    return this.model.findMany({
      where: { courseClasses: { some: { class: { students: { some: { studentId } } } } } },
      include: { courseClasses: { include: { class: true, teacher: { select: { id: true, fullName: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  hasCourseSections(courseId) {
    return this.model.findFirst({ where: { courseSections: { some: { courseId } } } });
  }
}
