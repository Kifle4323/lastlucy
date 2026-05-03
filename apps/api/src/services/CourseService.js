import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { CourseRepository } from '../repositories/CourseRepository.js';

export class CourseService extends BaseService {
  constructor() {
    super(new CourseRepository());
  }

  async createCourse(user, body) {
    const schema = z.object({
      title: z.string().min(1),
      code: z.string().min(1),
      description: z.string().optional(),
      creditHours: z.number().int().min(1).default(3),
      stream: z.string().optional().nullable(),
    });
    const data = schema.parse(body);

    const course = await this.repository.create({
      data: { ...data, code: data.code.toUpperCase() },
    });

    await AuditLogger.log({ action: 'COURSE_CREATE', category: 'COURSE', userId: user.id, targetId: course.id, description: `Course created: ${course.title}` });
    return course;
  }

  async getCourses(user) {
    if (user.role === 'ADMIN') return this.repository.findForAdmin();
    if (user.role === 'TEACHER') return this.repository.findForTeacher(user.id);
    return this.repository.findForStudent(user.id);
  }

  async getCourse(courseId) {
    const course = await this.repository.findById(courseId);
    this.throwUnless(course, 404, 'not_found', 'Course not found');
    return course;
  }

  async updateCourse(user, courseId, body) {
    const schema = z.object({
      title: z.string().min(1).optional(),
      code: z.string().min(1).optional(),
      description: z.string().optional(),
      creditHours: z.number().int().min(1).optional(),
      stream: z.string().optional().nullable(),
    });
    const data = schema.parse(body);

    const course = await this.repository.findById(courseId);
    this.throwUnless(course, 404, 'not_found', 'Course not found');

    const updated = await this.repository.update(courseId, data);
    await AuditLogger.log({ action: 'COURSE_UPDATE', category: 'COURSE', userId: user.id, targetId: courseId, description: `Course updated: ${course.title}` });
    return updated;
  }

  async deleteCourse(user, courseId) {
    const course = await this.repository.findById(courseId);
    this.throwUnless(course, 404, 'not_found', 'Course not found');
    await this.repository.delete(courseId);
    await AuditLogger.log({ action: 'DELETE', category: 'COURSE', userId: user.id, targetId: courseId, description: `Course deleted: ${course.title}` });
  }

  async getCourseStudents(courseId, user, sectionId) {
    const course = await this.repository.findById(courseId);
    this.throwUnless(course, 404, 'not_found', 'Course not found');

    // Build filter for course sections this teacher actually teaches
    const sectionFilter = {
      courseId,
      teacherId: user.id,
      ...(sectionId ? { id: sectionId } : {}),
    };

    // Get current semester to scope results
    const currentSemester = await this.repository.prisma.semester.findFirst({
      where: { isCurrent: true },
    });
    if (currentSemester) {
      sectionFilter.semesterId = currentSemester.id;
    }

    // Verify teacher teaches at least one section for this course
    const teacherSections = await this.repository.prisma.courseSection.findMany({
      where: sectionFilter,
    });
    this.throwUnless(teacherSections.length > 0, 403, 'forbidden', 'You do not teach any section of this course');

    // Get students enrolled in only this teacher's sections
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: {
        courseSection: sectionFilter,
        status: 'ENROLLED',
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        courseSection: {
          select: { id: true, sectionCode: true, classId: true, class: { select: { name: true } } },
        },
      },
    });

    const sectionStudents = enrollments.map(e => ({
      id: e.student.id,
      fullName: e.student.fullName,
      email: e.student.email,
      sectionId: e.courseSectionId,
      sectionCode: e.courseSection.sectionCode,
      className: e.courseSection.class?.name,
    }));

    // Get students from course classes (only classes this teacher is assigned to)
    const teacherClassIds = teacherSections.map(s => s.classId).filter(Boolean);
    const courseClasses = await this.repository.prisma.courseClass.findMany({
      where: {
        courseId,
        ...(teacherClassIds.length > 0 ? { classId: { in: teacherClassIds } } : {}),
        teacherId: user.id,
      },
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

    const classStudents = courseClasses.flatMap(cc =>
      cc.class.students.map(s => ({
        id: s.student.id,
        fullName: s.student.fullName,
        email: s.student.email,
        sectionId: null,
        className: cc.class.name,
      }))
    );

    // Deduplicate by student id
    const seen = new Set(sectionStudents.map(s => s.id));
    const uniqueClassStudents = classStudents.filter(s => !seen.has(s.id));

    return [...sectionStudents, ...uniqueClassStudents];
  }

  async getMaterialStats(courseId) {
    const course = await this.repository.findById(courseId);
    this.throwUnless(course, 404, 'not_found', 'Course not found');

    const materials = await this.repository.prisma.material.findMany({
      where: { courseId },
      include: {
        _count: { select: { views: true } },
      },
    });

    const totalViews = materials.reduce((sum, m) => sum + m._count.views, 0);

    return {
      totalMaterials: materials.length,
      totalViews,
      byType: materials.reduce((acc, m) => {
        const type = m.fileType || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}
