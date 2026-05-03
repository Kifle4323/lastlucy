import { BaseRepository } from '../core/BaseRepository.js';

export class LiveSessionRepository extends BaseRepository {
  constructor() { super('liveSession'); }

  findByCourse(courseId) {
    return this.model.findMany({
      where: { courseId },
      include: { course: true, class: true, attendance: true },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  findByClass(classId) {
    return this.model.findMany({
      where: { classId },
      include: { course: true, attendance: { include: { student: { select: { id: true, fullName: true } } } } },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  findWithAccess(sessionId) {
    return this.model.findUnique({
      where: { id: sessionId },
      include: { course: { include: { courseSections: true, courseClasses: true } }, class: true },
    });
  }

  findByCourseAndClass(courseId, classId) {
    return this.model.findMany({
      where: { courseId, classId },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
