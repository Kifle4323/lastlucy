import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { ClassRepository } from '../repositories/ClassRepository.js';

export class ClassService extends BaseService {
  constructor() {
    super(new ClassRepository());
  }

  async createClass(user, body) {
    const schema = z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      departmentId: z.string().optional(),
      year: z.number().int().min(1).optional(),
      section: z.string().optional(),
    });
    const data = schema.parse(body);

    const cls = await this.repository.create({ data: { ...data, code: data.code.toUpperCase() } });
    await AuditLogger.log({ action: 'CREATE', category: 'CLASS', userId: user.id, targetId: cls.id, description: `Class created: ${cls.name}` });
    return cls;
  }

  async getClasses(user) {
    if (user.role === 'ADMIN') return this.repository.findForAdmin();
    if (user.role === 'TEACHER') return this.repository.findForTeacher(user.id);
    return this.repository.findForStudent(user.id);
  }

  async getClass(classId) {
    const cls = await this.repository.findWithAccess(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');
    return cls;
  }

  async updateClass(user, classId, body) {
    const schema = z.object({
      name: z.string().min(1).optional(),
      code: z.string().min(1).optional(),
      departmentId: z.string().optional(),
      year: z.number().int().min(1).optional(),
      section: z.string().optional(),
    });
    const data = schema.parse(body);

    const cls = await this.repository.findById(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');

    const updated = await this.repository.update(classId, data);
    await AuditLogger.log({ action: 'UPDATE', category: 'CLASS', userId: user.id, targetId: classId, description: `Class updated: ${cls.name}` });
    return updated;
  }

  async deleteClass(user, classId) {
    const cls = await this.repository.findById(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');
    await this.repository.delete(classId);
    await AuditLogger.log({ action: 'DELETE', category: 'CLASS', userId: user.id, targetId: classId, description: `Class deleted: ${cls.name}` });
  }

  async assignStudents(user, classId, studentIds) {
    const cls = await this.repository.findById(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');

    const assignments = studentIds.map(studentId =>
      this.repository.prisma.classStudent.upsert({
        where: { classId_studentId: { classId, studentId } },
        create: { class: { connect: { id: classId } }, student: { connect: { id: studentId } } },
        update: {},
      })
    );
    const result = await Promise.all(assignments);
    await AuditLogger.log({ action: 'CLASS_ASSIGN', category: 'CLASS', userId: user.id, targetId: classId, description: `Assigned ${studentIds.length} students to class` });
    return result;
  }

  async removeStudent(user, classId, studentId) {
    await this.repository.prisma.classStudent.delete({
      where: { classId_studentId: { classId, studentId } },
    });
    await AuditLogger.log({ action: 'CLASS_REMOVE', category: 'CLASS', userId: user.id, targetId: classId, description: `Removed student ${studentId} from class` });
  }

  async assignTeachers(user, classId, teacherIds) {
    const cls = await this.repository.findById(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');

    const assignments = teacherIds.map(teacherId =>
      this.repository.prisma.classTeacher.upsert({
        where: { classId_teacherId: { classId, teacherId } },
        create: { class: { connect: { id: classId } }, teacher: { connect: { id: teacherId } } },
        update: {},
      })
    );
    const result = await Promise.all(assignments);
    await AuditLogger.log({ action: 'CLASS_ASSIGN', category: 'CLASS', userId: user.id, targetId: classId, description: `Assigned ${teacherIds.length} teachers to class` });
    return result;
  }

  async removeTeacher(user, classId, teacherId) {
    await this.repository.prisma.classTeacher.delete({
      where: { classId_teacherId: { classId, teacherId } },
    });
    await AuditLogger.log({ action: 'CLASS_REMOVE', category: 'CLASS', userId: user.id, targetId: classId, description: `Removed teacher ${teacherId} from class` });
  }

  async assignCourse(user, classId, courseId, teacherId) {
    const cls = await this.repository.findById(classId);
    this.throwUnless(cls, 404, 'not_found', 'Class not found');

    const assignment = await this.repository.prisma.courseClass.create({
      data: { classId, courseId, teacherId },
    });
    await AuditLogger.log({ action: 'SECTION_CREATE', category: 'CLASS', userId: user.id, targetId: assignment.id, description: `Assigned course ${courseId} to class ${classId}` });
    return assignment;
  }

  async removeCourse(user, classId, courseId) {
    await this.repository.prisma.courseClass.deleteMany({
      where: { classId, courseId },
    });
    await AuditLogger.log({ action: 'DELETE', category: 'CLASS', userId: user.id, targetId: classId, description: `Removed course ${courseId} from class ${classId}` });
  }
}
