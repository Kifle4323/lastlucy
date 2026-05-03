// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

export function registerCourseRoutes(router: Router) {
  // Create course (Admin only)
  router.post('/courses', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z
      .object({
        title: z.string().min(2),
        code: z.string().min(2),
        description: z.string().optional(),
        creditHours: z.number().int().min(1),
        ectsCredits: z.number().int().min(1),
      })
      .parse(req.body);

    const course = await prisma.course.create({
      data: {
        title: body.title,
        code: body.code,
        description: body.description,
        creditHours: body.creditHours,
        ectsCredits: body.ectsCredits,
      },
    });

    res.json(course);
  });

  // Get courses based on role
  router.get('/courses', authRequired, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    if (user.role === 'ADMIN') {
      const courses = await prisma.course.findMany({
        include: {
          courseClasses: {
            include: {
              class: true,
              teacher: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(courses);
      return;
    }

    if (user.role === 'TEACHER') {
      // Get courses where teacher is assigned through CourseClass
      const courses = await prisma.course.findMany({
        where: {
          courseClasses: {
            some: { teacherId: user.id },
          },
        },
        include: {
          courseClasses: {
            where: { teacherId: user.id },
            include: {
              class: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(courses);
      return;
    }

    // Student - get courses through their classes
    const courses = await prisma.course.findMany({
      where: {
        courseClasses: {
          some: {
            class: {
              students: { some: { studentId: user.id } },
            },
          },
        },
      },
      include: {
        courseClasses: {
          include: {
            class: true,
            teacher: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(courses);
  });

  // Get all users (for admin to assign teachers/students)
  router.get('/users', authRequired, requireRole(['ADMIN']), async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, profileImage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  });

  // Get students enrolled in a course (Teacher only - for courses they teach)
  router.get('/courses/:courseId/students', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);
    const query = z.object({ sectionId: z.string().optional() }).parse(req.query);
    const user = req.user!;

    // Verify teacher teaches this course
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: user.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: user.id },
    });

    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Get current semester
    const currentSemester = await prisma.semester.findFirst({
      where: { isCurrent: true },
    });

    // If sectionId provided, fetch only that specific section's students
    // Otherwise fetch all sections this teacher teaches for this course
    const courseSections = await prisma.courseSection.findMany({
      where: {
        courseId: params.courseId,
        teacherId: user.id,
        ...(query.sectionId ? { id: query.sectionId } : {}),
        ...(currentSemester ? { semesterId: currentSemester.id } : {}),
      },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
        class: { select: { id: true, name: true } },
      },
    });

    type StudentWithClass = { id: string; fullName: string; email: string; classId: string | null; className: string | null };

    // Students from course sections only (enrollment-based, not class-based)
    const sectionStudents: StudentWithClass[] = courseSections.flatMap(cs =>
      cs.enrollments.map(e => ({
        ...e.student,
        classId: cs.classId,
        className: cs.class?.name || cs.sectionCode,
      }))
    );

    // Deduplicate
    const uniqueStudents = sectionStudents.reduce<StudentWithClass[]>((acc, student) => {
      if (!acc.find(s => s.id === student.id)) {
        acc.push(student);
      }
      return acc;
    }, []);

    res.json(uniqueStudents);
  });

  // Get students enrolled in a specific course-class (Teacher only)
  router.get('/course-classes/:courseClassId/students', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseClassId: z.string() }).parse(req.params);
    const user = req.user!;

    // Verify teacher teaches this course-class
    const courseClass = await prisma.courseClass.findFirst({
      where: { id: params.courseClassId, teacherId: user.id },
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

    if (!courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    type StudentEnrollment = { student: { id: string; fullName: string; email: string } };
    const students = (courseClass.class.students as StudentEnrollment[]).map(s => ({
      ...s.student,
      classId: courseClass.classId,
      className: courseClass.class.name,
    }));

    res.json(students);
  });

  // Student: Get own attempts for a course
  router.get('/courses/:courseId/my-attempts', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);
    const user = req.user!;

    // Get all assessments for this course
    const assessments = await prisma.assessment.findMany({
      where: { courseId: params.courseId },
      select: { id: true },
    });

    const assessmentIds = assessments.map((a: { id: string }) => a.id);

    // Get student's attempts for these assessments
    const attempts = await prisma.attempt.findMany({
      where: {
        studentId: user.id,
        assessmentId: { in: assessmentIds },
      },
      include: {
        assessment: { select: { id: true, maxScore: true, title: true } },
      },
    });

    res.json(attempts);
  });

  // Update course (Admin only)
  router.patch('/courses/:courseId', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);
    const body = z.object({
      title: z.string().min(2).optional(),
      code: z.string().min(2).optional(),
      description: z.string().optional().nullable(),
      creditHours: z.number().int().min(1).optional(),
      ectsCredits: z.number().int().min(1).optional(),
    }).parse(req.body);

    const course = await prisma.course.update({
      where: { id: params.courseId },
      data: {
        title: body.title,
        code: body.code,
        description: body.description,
        creditHours: body.creditHours,
        ectsCredits: body.ectsCredits,
      },
    });

    res.json(course);
  });

  // Delete course (Admin only)
  router.delete('/courses/:courseId', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    // Check if course is used in any course sections
    const courseSections = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId },
    });

    if (courseSections) {
      res.status(400).json({ error: 'Cannot delete course that is assigned to classes. Remove from classes first.' });
      return;
    }

    await prisma.course.delete({
      where: { id: params.courseId },
    });

    res.json({ success: true });
  });
}
