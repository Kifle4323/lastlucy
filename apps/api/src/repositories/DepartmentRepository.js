import { BaseRepository } from '../core/BaseRepository.js';

export class DepartmentRepository extends BaseRepository {
  constructor() { super('department'); }

  findAllWithCounts() {
    return this.model.findMany({
      include: { _count: { select: { classes: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findWithClasses(id) {
    return this.model.findUnique({
      where: { id },
      include: { classes: { include: { _count: { select: { students: true } } } } },
    });
  }
}
