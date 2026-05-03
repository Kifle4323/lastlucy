import { prisma } from '../db.js';

export class BaseRepository {
  constructor(modelName) {
    this.prisma = prisma;
    this.model = prisma[modelName];
  }

  findById(id, include) {
    return this.model.findUnique({ where: { id }, include });
  }

  findMany(whereOrArgs, extraArgs) {
    if (whereOrArgs && typeof whereOrArgs === 'object' && !whereOrArgs.constructor?.name?.includes('Where')) {
      // Check if first arg looks like a full Prisma args object (has select/include/orderBy without where)
      if (whereOrArgs.select || whereOrArgs.include || whereOrArgs.orderBy) {
        if (!whereOrArgs.where) whereOrArgs.where = {};
        return this.model.findMany(whereOrArgs);
      }
    }
    // Old style: findMany(where, { select, include, orderBy })
    const where = whereOrArgs || {};
    if (extraArgs) {
      return this.model.findMany({ where, ...extraArgs });
    }
    return this.model.findMany({ where });
  }

  findFirst(where, include) {
    return this.model.findFirst({ where, include });
  }

  create(args) {
    return this.model.create(args);
  }

  update(id, data, include) {
    return this.model.update({ where: { id }, data, include });
  }

  updateWhere(where, data) {
    return this.model.update({ where, data });
  }

  delete(id) {
    return this.model.delete({ where: { id } });
  }

  deleteWhere(where) {
    return this.model.delete({ where });
  }

  count(where) {
    return this.model.count({ where });
  }

  exists(where) {
    return this.model.count({ where }).then(c => c > 0);
  }

  upsert(where, update, create, include) {
    return this.model.upsert({ where, update, create, include });
  }

  updateMany(where, data) {
    return this.model.updateMany({ where, data });
  }

  deleteMany(where) {
    return this.model.deleteMany({ where });
  }

  findUnique(where, include) {
    return this.model.findUnique({ where, include });
  }

  aggregate(args) {
    return this.model.aggregate(args);
  }

  groupBy(args) {
    return this.model.groupBy(args);
  }

  transaction(fn) {
    return this.prisma.$transaction(fn);
  }
}
