import { BaseRepository } from '../core/BaseRepository.js';

export class MaterialRepository extends BaseRepository {
  constructor() { super('material'); }

  findByCourse(courseId) {
    return this.model.findMany({
      where: { courseId },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForPreview(materialId) {
    return this.model.findUnique({
      where: { id: materialId },
      select: { fileUrl: true, fileType: true, fileName: true, title: true, previewFileUrl: true },
    });
  }

  findForFile(materialId) {
    return this.model.findUnique({
      where: { id: materialId },
      select: { fileUrl: true, fileType: true, fileName: true, title: true },
    });
  }

  findForHtml(materialId) {
    return this.model.findUnique({
      where: { id: materialId },
      include: { course: true },
    });
  }

  findForProgress(materialId) {
    return this.model.findUnique({
      where: { id: materialId },
      select: { courseId: true, title: true },
    });
  }

  findWithStats(courseId) {
    return this.model.findMany({
      where: { courseId },
      include: { views: { include: { student: { select: { id: true, fullName: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
