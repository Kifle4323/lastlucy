// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

export function registerDepartmentRoutes(router: Router) {
  // Admin: Create department
  router.post('/admin/departments', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      name: z.string().min(2),
      code: z.string().min(1).max(10),
      description: z.string().optional().nullable(),
      pricePerCreditHour: z.number().positive(),
      totalCreditHours: z.number().int().positive(),
      minCreditHoursToGraduate: z.number().int().positive(),
      minGradeToGraduate: z.number().min(0).max(4).optional(),
      durationYears: z.number().int().min(1).max(8).optional(),
    }).parse(req.body);

    try {
      const department = await prisma.department.create({
        data: {
          name: body.name,
          code: body.code.toUpperCase(),
          description: body.description,
          pricePerCreditHour: body.pricePerCreditHour,
          totalCreditHours: body.totalCreditHours,
          minCreditHoursToGraduate: body.minCreditHoursToGraduate,
          minGradeToGraduate: body.minGradeToGraduate || 2.0,
          durationYears: body.durationYears || 4,
        },
      });

      res.status(201).json(department);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'Department with this name or code already exists' });
      }
      console.error('Create department error:', err);
      res.status(500).json({ error: 'Failed to create department' });
    }
  });

  // Get all departments (admin, teacher, student)
  router.get('/departments', authRequired, async (req: AuthedRequest, res: Response) => {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { classes: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  });

  // Get single department
  router.get('/departments/:id', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);

    const department = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        classes: {
          include: {
            _count: { select: { students: true } },
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(department);
  });

  // Admin: Update department
  router.patch('/admin/departments/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(2).optional(),
      code: z.string().min(1).max(10).optional(),
      description: z.string().nullable().optional(),
      pricePerCreditHour: z.number().positive().optional(),
      totalCreditHours: z.number().int().positive().optional(),
      minCreditHoursToGraduate: z.number().int().positive().optional(),
      minGradeToGraduate: z.number().min(0).max(4).optional(),
      durationYears: z.number().int().min(1).max(8).optional(),
    }).parse(req.body);

    try {
      const department = await prisma.department.update({
        where: { id: params.id },
        data: {
          ...body,
          code: body.code?.toUpperCase(),
        },
      });

      res.json(department);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'Department with this name or code already exists' });
      }
      console.error('Update department error:', err);
      res.status(500).json({ error: 'Failed to update department' });
    }
  });

  // Admin: Delete department
  router.delete('/admin/departments/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);

    // Check if department has classes
    const classCount = await prisma.class.count({
      where: { departmentId: params.id },
    });

    if (classCount > 0) {
      return res.status(400).json({ error: `Cannot delete department with ${classCount} classes. Remove classes first.` });
    }

    await prisma.department.delete({ where: { id: params.id } });
    res.status(204).send();
  });

  // Student: Calculate registration fee for their department
  router.get('/student/registration-fee', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    try {
      // Get student's class and department
      const classStudent = await prisma.classStudent.findFirst({
        where: { studentId: user.id },
        include: {
          class: {
            include: { department: true },
          },
        },
      });

      if (!classStudent?.class?.department) {
        return res.json({ hasDepartment: false, fee: 0, message: 'No department assigned' });
      }

      const dept = classStudent.class.department;

      // Get current semester's course sections for this student's class
      const currentSemester = await prisma.semester.findFirst({
        where: { status: 'REGISTRATION_OPEN' },
      });

      let semesterCreditHours = 0;
      if (currentSemester) {
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { userId: user.id },
        });

        const courseSectionsWhere: any = {
          semesterId: currentSemester.id,
          classId: classStudent.classId,
        };

        if (studentProfile?.stream) {
          courseSectionsWhere.course = {
            OR: [
              { stream: studentProfile.stream },
              { stream: null }
            ]
          };
        }

        const courseSections = await prisma.courseSection.findMany({
          where: courseSectionsWhere,
          include: { course: true },
        });

        semesterCreditHours = courseSections.reduce((sum, cs) => sum + (cs.course?.creditHours || 3), 0);
      }

      const registrationFee = semesterCreditHours * dept.pricePerCreditHour;

      res.json({
        hasDepartment: true,
        department: dept,
        semesterCreditHours,
        pricePerCreditHour: dept.pricePerCreditHour,
        fee: registrationFee,
        totalProgramFee: dept.totalCreditHours * dept.pricePerCreditHour,
      });
    } catch (err) {
      console.error('Error calculating registration fee:', err);
      res.status(500).json({ error: 'Failed to calculate registration fee' });
    }
  });

  // Student: Check graduation eligibility and generate certificate
  router.get('/student/graduation-status', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    try {
      const classStudent = await prisma.classStudent.findFirst({
        where: { studentId: user.id },
        include: {
          class: {
            include: { department: true },
          },
        },
      });

      if (!classStudent?.class?.department) {
        return res.json({ eligible: false, message: 'No department assigned' });
      }

      const dept = classStudent.class.department;

      // Get all completed enrollments with grades
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          studentId: user.id,
          status: 'ENROLLED',
          grade: { isNot: null },
        },
        include: {
          courseSection: { include: { course: true } },
          grade: true,
        },
      });

      // Calculate total credit hours completed and CGPA
      let totalCreditHours = 0;
      let totalGradePoints = 0;

      enrollments.forEach(e => {
        const creditHours = e.courseSection?.course?.creditHours || 3;
        const gradePoint = e.grade?.gradePoint || 0;
        totalCreditHours += creditHours;
        totalGradePoints += creditHours * gradePoint;
      });

      const cgpa = totalCreditHours > 0 ? totalGradePoints / totalCreditHours : 0;

      // Check if existing certificate
      const existingCert = await prisma.certificate.findFirst({
        where: { studentId: user.id, departmentId: dept.id },
      });

      const eligible = totalCreditHours >= dept.minCreditHoursToGraduate && cgpa >= dept.minGradeToGraduate;

      // Auto-generate certificate if eligible and doesn't already exist
      let certificate = existingCert;
      if (eligible && !existingCert) {
        const certNumber = `LUCY-${dept.code}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        certificate = await prisma.certificate.create({
          data: {
            studentId: user.id,
            departmentId: dept.id,
            certificateNumber: certNumber,
            cgpa: Math.round(cgpa * 100) / 100,
            totalCreditHours,
          },
        });

        // Mark all active enrollments as COMPLETED since student is now certified
        await prisma.studentEnrollment.updateMany({
          where: { studentId: user.id, status: 'ENROLLED' },
          data: { status: 'COMPLETED' },
        });
      }

      res.json({
        eligible,
        department: dept,
        totalCreditHoursCompleted: totalCreditHours,
        minCreditHoursRequired: dept.minCreditHoursToGraduate,
        cgpa: Math.round(cgpa * 100) / 100,
        minGradeRequired: dept.minGradeToGraduate,
        gradeMet: cgpa >= dept.minGradeToGraduate,
        creditHoursMet: totalCreditHours >= dept.minCreditHoursToGraduate,
        certificate,
        enrollments: enrollments.length,
      });
    } catch (err) {
      console.error('Error checking graduation status:', err);
      res.status(500).json({ error: 'Failed to check graduation status' });
    }
  });

  // Admin: Generate certificate for student
  router.post('/admin/certificates/generate', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      studentId: z.string(),
    }).parse(req.body);

    try {
      // Check if certificate already exists
      const classStudent = await prisma.classStudent.findFirst({
        where: { studentId: body.studentId },
        include: {
          class: { include: { department: true } },
        },
      });

      if (!classStudent?.class?.department) {
        return res.status(400).json({ error: 'Student has no department assigned' });
      }

      const dept = classStudent.class.department;

      const existingCert = await prisma.certificate.findFirst({
        where: { studentId: body.studentId, departmentId: dept.id },
      });

      if (existingCert) {
        return res.status(400).json({ error: 'Certificate already exists', certificate: existingCert });
      }

      // Calculate CGPA
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          studentId: body.studentId,
          status: 'ENROLLED',
          grade: { isNot: null },
        },
        include: {
          courseSection: { include: { course: true } },
          grade: true,
        },
      });

      let totalCreditHours = 0;
      let totalGradePoints = 0;

      enrollments.forEach(e => {
        const creditHours = e.courseSection?.course?.creditHours || 3;
        const gradePoint = e.grade?.gradePoint || 0;
        totalCreditHours += creditHours;
        totalGradePoints += creditHours * gradePoint;
      });

      const cgpa = totalCreditHours > 0 ? totalGradePoints / totalCreditHours : 0;

      if (totalCreditHours < dept.minCreditHoursToGraduate) {
        return res.status(400).json({
          error: 'Student has not completed enough credit hours',
          completed: totalCreditHours,
          required: dept.minCreditHoursToGraduate,
        });
      }

      if (cgpa < dept.minGradeToGraduate) {
        return res.status(400).json({
          error: 'Student CGPA is below the minimum required grade',
          cgpa: Math.round(cgpa * 100) / 100,
          required: dept.minGradeToGraduate,
        });
      }

      // Generate certificate number
      const certNumber = `LUCY-${dept.code}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const certificate = await prisma.certificate.create({
        data: {
          studentId: body.studentId,
          departmentId: dept.id,
          certificateNumber: certNumber,
          cgpa: Math.round(cgpa * 100) / 100,
          totalCreditHours,
        },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          department: true,
        },
      });

      // Mark all active enrollments as COMPLETED since student is now certified
      await prisma.studentEnrollment.updateMany({
        where: { studentId: body.studentId, status: 'ENROLLED' },
        data: { status: 'COMPLETED' },
      });

      res.status(201).json(certificate);
    } catch (err) {
      console.error('Error generating certificate:', err);
      res.status(500).json({ error: 'Failed to generate certificate' });
    }
  });

  // Get student's certificates
  router.get('/student/certificates', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    const certificates = await prisma.certificate.findMany({
      where: { studentId: user.id },
      include: { department: true },
      orderBy: { issuedAt: 'desc' },
    });

    res.json(certificates);
  });

  // Get certificate by ID (for viewing/printing)
  router.get('/certificates/:id', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    const certificate = await prisma.certificate.findUnique({
      where: { id: params.id },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        department: true,
      },
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Only allow the student themselves, or admin, to view
    if (certificate.studentId !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'forbidden' });
    }

    res.json(certificate);
  });

  // Admin: Get all certificates
  router.get('/admin/certificates', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const certificates = await prisma.certificate.findMany({
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        department: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    res.json(certificates);
  });
}
