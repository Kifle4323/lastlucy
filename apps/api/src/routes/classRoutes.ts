// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';
import { createAuditLog } from '../auditLog';

export function registerClassRoutes(router: Router) {
  // Create a new class (Admin only)
  router.post('/classes', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const body = z.object({
      name: z.string().min(2),
      code: z.string().min(2),
      year: z.number().int().optional(),
      section: z.string().optional(),
      departmentId: z.string().optional(),
    }).parse(req.body);

    const newClass = await prisma.class.create({
      data: {
        name: body.name,
        code: body.code,
        year: body.year,
        section: body.section,
        departmentId: body.departmentId || null,
      },
      include: { department: true },
    });

    res.json(newClass);
  });

  // Get all classes
  router.get('/classes', authRequired, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    if (user.role === 'ADMIN') {
      const classes = await prisma.class.findMany({
        include: {
          students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
          teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
          courses: {
            select: {
              id: true,
              teacherId: true,
              courseId: true,
              course: true,
              teacher: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(classes);
      return;
    }

    if (user.role === 'TEACHER') {
      // Get classes where teacher is either a class teacher OR teaches a course section in that class
      const classes = await prisma.class.findMany({
        where: {
          OR: [
            { teachers: { some: { teacherId: user.id } } },
            { courseSections: { some: { teacherId: user.id } } },
          ],
        },
        include: {
          students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
          teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
          courseSections: {
            where: { teacherId: user.id },
            include: {
              course: true,
              semester: { include: { academicYear: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(classes);
      return;
    }

    // Student
    const classes = await prisma.class.findMany({
      where: { students: { some: { studentId: user.id } } },
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
        courses: {
          select: {
            id: true,
            teacherId: true,
            courseId: true,
            course: true,
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(classes);
  });

  // Get single class
  router.get('/classes/:classId', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);
    const user = req.user!;

    const classData = await prisma.class.findUnique({
      where: { id: params.classId },
      include: {
        students: { include: { student: { select: { id: true, fullName: true, email: true, role: true } } } },
        teachers: { include: { teacher: { select: { id: true, fullName: true, email: true, role: true } } } },
        courses: { include: { course: true, teacher: { select: { id: true, fullName: true } } } },
      },
    });

    if (!classData) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check access
    if (user.role === 'ADMIN') {
      res.json(classData);
      return;
    }

    if (user.role === 'TEACHER' && classData.teachers.some((t: { teacherId: string }) => t.teacherId === user.id)) {
      res.json(classData);
      return;
    }

    if (user.role === 'STUDENT' && classData.students.some((s: { studentId: string }) => s.studentId === user.id)) {
      res.json(classData);
      return;
    }

    res.status(403).json({ error: 'forbidden' });
  });

  // Add student to class (Admin only)
  router.post('/classes/:classId/students', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);
    const body = z.object({ studentId: z.string() }).parse(req.body);

    const student = await prisma.user.findUnique({ where: { id: body.studentId } });
    if (!student || student.role !== 'STUDENT') {
      res.status(400).json({ error: 'student_not_found' });
      return;
    }

    // Check if student is already in another class
    const existingClass = await prisma.classStudent.findFirst({
      where: { studentId: body.studentId },
      include: { class: { select: { id: true, name: true, code: true } } },
    });
    if (existingClass && existingClass.classId !== params.classId) {
      res.status(400).json({
        error: `Student is already in class "${existingClass.class.name}" (${existingClass.class.code}). Remove from current class first.`,
      });
      return;
    }

    try {
      const classStudent = await prisma.classStudent.create({
        data: { classId: params.classId, studentId: body.studentId },
        include: { student: { select: { id: true, fullName: true, email: true } } },
      });
      createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'CLASS_ASSIGN', category: 'CLASS', targetId: body.studentId, targetType: 'ClassStudent', description: `Admin assigned ${classStudent.student?.fullName} to class ${params.classId}`, ipAddress: req.ip });
      res.json(classStudent);
    } catch {
      res.status(400).json({ error: 'already_in_class' });
    }
  });

  // Remove student from class (Admin only)
  router.delete('/classes/:classId/students/:studentId', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string(), studentId: z.string() }).parse(req.params);

    await prisma.classStudent.delete({
      where: { classId_studentId: { classId: params.classId, studentId: params.studentId } },
    });

    res.json({ success: true });
  });

  // Add teacher to class (Admin only)
  router.post('/classes/:classId/teachers', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);
    const body = z.object({ teacherId: z.string() }).parse(req.body);

    const teacher = await prisma.user.findUnique({ where: { id: body.teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      res.status(400).json({ error: 'teacher_not_found' });
      return;
    }

    try {
      const classTeacher = await prisma.classTeacher.create({
        data: { classId: params.classId, teacherId: body.teacherId },
        include: { teacher: { select: { id: true, fullName: true, email: true } } },
      });
      res.json(classTeacher);
    } catch {
      res.status(400).json({ error: 'already_teaching' });
    }
  });

  // Remove teacher from class (Admin only)
  router.delete('/classes/:classId/teachers/:teacherId', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string(), teacherId: z.string() }).parse(req.params);

    await prisma.classTeacher.delete({
      where: { classId_teacherId: { classId: params.classId, teacherId: params.teacherId } },
    });

    res.json({ success: true });
  });

  // Assign course to class with teacher (Admin only)
  router.post('/classes/:classId/courses', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);
    const body = z.object({ courseId: z.string(), teacherId: z.string().optional() }).parse(req.body);

    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (!course) {
      res.status(400).json({ error: 'course_not_found' });
      return;
    }

    if (body.teacherId) {
      const teacher = await prisma.user.findUnique({ where: { id: body.teacherId } });
      if (!teacher || teacher.role !== 'TEACHER') {
        res.status(400).json({ error: 'teacher_not_found' });
        return;
      }
    }

    try {
      const courseClass = await prisma.courseClass.create({
        data: { classId: params.classId, courseId: body.courseId, teacherId: body.teacherId },
        include: { course: true, teacher: { select: { id: true, fullName: true } } },
      });
      res.json(courseClass);
    } catch {
      res.status(400).json({ error: 'already_assigned' });
    }
  });

  // Remove course from class (Admin only)
  router.delete('/classes/:classId/courses/:courseId', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string(), courseId: z.string() }).parse(req.params);

    await prisma.courseClass.delete({
      where: { courseId_classId: { classId: params.classId, courseId: params.courseId } },
    });

    res.json({ success: true });
  });

  // Update class (Admin only)
  router.patch('/classes/:classId', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(2).optional(),
      code: z.string().min(2).optional(),
      year: z.number().int().nullable().optional(),
      section: z.string().nullable().optional(),
    }).parse(req.body);

    const updated = await prisma.class.update({
      where: { id: params.classId },
      data: {
        name: body.name,
        code: body.code,
        year: body.year,
        section: body.section,
      },
    });

    res.json(updated);
  });

  // Delete class (Admin only)
  router.delete('/classes/:classId', authRequired, requireRole(['ADMIN']), async (req: Request, res: Response) => {
    const params = z.object({ classId: z.string() }).parse(req.params);

    await prisma.class.delete({
      where: { id: params.classId },
    });

    res.json({ success: true });
  });
}
