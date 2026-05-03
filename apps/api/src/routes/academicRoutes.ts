// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

// Helper: Check if a course section's semester is IN_PROGRESS or GRADING
async function requireSemesterInProgress(sectionId: string): Promise<{ allowed: boolean; semesterStatus?: string }> {
  const section = await prisma.courseSection.findUnique({
    where: { id: sectionId },
    include: { semester: { select: { id: true, status: true } } },
  });
  if (!section || !section.semester) return { allowed: false };
  return { allowed: section.semester.status === 'IN_PROGRESS' || section.semester.status === 'GRADING', semesterStatus: section.semester.status };
}

// Helper: Get sectionId from enrollmentId
async function getSectionFromEnrollment(enrollmentId: string): Promise<string | null> {
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { courseSectionId: true },
  });
  return enrollment?.courseSectionId || null;
}
import { createAuditLog } from '../auditLog';

// Grade point mapping based on the grading scale
const GRADE_POINTS: Record<string, { min: number; max: number; point: number; letter: string }> = {
  'A+': { min: 90, max: 100, point: 4.0, letter: 'A+' },
  'A': { min: 85, max: 89, point: 4.0, letter: 'A' },
  'A-': { min: 80, max: 84, point: 3.75, letter: 'A-' },
  'B+': { min: 75, max: 79, point: 3.5, letter: 'B+' },
  'B': { min: 70, max: 74, point: 3.0, letter: 'B' },
  'B-': { min: 65, max: 69, point: 2.75, letter: 'B-' },
  'C+': { min: 60, max: 64, point: 2.5, letter: 'C+' },
  'C': { min: 50, max: 59, point: 2.0, letter: 'C' },
  'C-': { min: 45, max: 49, point: 1.75, letter: 'C-' },
  'D': { min: 40, max: 44, point: 1.0, letter: 'D' },
  'F': { min: 0, max: 39, point: 0.0, letter: 'F' },
};

// Helper function to convert display letter to Prisma enum value
function letterToEnum(letter: string): string {
  const map: Record<string, string> = {
    'A+': 'A_PLUS', 'A-': 'A_MINUS',
    'B+': 'B_PLUS', 'B-': 'B_MINUS',
    'C+': 'C_PLUS', 'C-': 'C_MINUS',
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'F': 'F',
  };
  return map[letter] || letter;
}

// Helper function to get grade letter and point from score
function getGradeFromScore(score: number): { letter: string; point: number } {
  for (const [, data] of Object.entries(GRADE_POINTS)) {
    if (score >= data.min && score <= data.max) {
      return { letter: data.letter, point: data.point };
    }
  }
  return { letter: 'F', point: 0.0 };
}

export function registerAcademicRoutes(router: Router) {
  // ==================== ACADEMIC YEAR MANAGEMENT (Admin) ====================

  // Create academic year
  router.post('/admin/academic-years', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      name: z.string().min(1), // e.g., "2024-2025"
      startDate: z.string(),
      endDate: z.string(),
    }).parse(req.body);

    const academicYear = await prisma.academicYear.create({
      data: {
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
    });

    res.status(201).json(academicYear);
  });

  // Get all academic years
  router.get('/admin/academic-years', authRequired, requireRole(['ADMIN']), async (_req: AuthedRequest, res: Response) => {
    const academicYears = await prisma.academicYear.findMany({
      include: { semesters: true },
      orderBy: { startDate: 'desc' },
    });
    res.json(academicYears);
  });

  // Update academic year
  router.patch('/admin/academic-years/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const academicYear = await prisma.academicYear.update({
      where: { id: params.id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });

    res.json(academicYear);
  });

  // Delete academic year
  router.delete('/admin/academic-years/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    await prisma.academicYear.delete({ where: { id: params.id } });
    res.status(204).send();
  });

  // ==================== SEMESTER MANAGEMENT (Admin) ====================

  // Create semester
  router.post('/admin/semesters', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      academicYearId: z.string(),
      type: z.enum(['FALL', 'SPRING', 'SUMMER']),
      name: z.string().min(1), // e.g., "Fall 2024"
      startDate: z.string(),
      endDate: z.string(),
      registrationStart: z.string().optional(),
      registrationEnd: z.string().optional(),
      midtermExamDate: z.string().optional(),
      finalExamDate: z.string().optional(),
      gradingDeadline: z.string().optional(),
      addDropStart: z.string().optional(),
      addDropEnd: z.string().optional(),
    }).parse(req.body);

    try {
      // Validate academic year exists
      const ay = await prisma.academicYear.findUnique({ where: { id: body.academicYearId } });
      if (!ay) {
        return res.status(400).json({ error: 'invalid_academic_year', message: 'Academic year not found' });
      }

      const semesterData = {
        academicYearId: body.academicYearId,
        type: body.type,
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        registrationStart: body.registrationStart ? new Date(body.registrationStart) : null,
        registrationEnd: body.registrationEnd ? new Date(body.registrationEnd) : null,
        midtermExamDate: body.midtermExamDate ? new Date(body.midtermExamDate) : null,
        finalExamDate: body.finalExamDate ? new Date(body.finalExamDate) : null,
        gradingDeadline: body.gradingDeadline ? new Date(body.gradingDeadline) : null,
        addDropStart: body.addDropStart ? new Date(body.addDropStart) : null,
        addDropEnd: body.addDropEnd ? new Date(body.addDropEnd) : null,
      };

      const semester = await prisma.semester.upsert({
        where: { academicYearId_type: { academicYearId: body.academicYearId, type: body.type } },
        update: semesterData,
        create: semesterData,
        include: { academicYear: true },
      });

      res.status(201).json(semester);
    } catch (err: any) {
      console.error('Create semester error:', err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'duplicate_semester', message: 'A semester with this type already exists for the selected academic year' });
      }
      res.status(500).json({ error: 'Failed to create semester', message: err?.message || String(err) });
    }
  });

  // Get all semesters
  router.get('/admin/semesters', authRequired, requireRole(['ADMIN']), async (_req: AuthedRequest, res: Response) => {
    const semesters = await prisma.semester.findMany({
      include: { academicYear: true, _count: { select: { courseSections: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(semesters);
  });

  // Get current semester
  router.get('/semesters/current', authRequired, async (_req: AuthedRequest, res: Response) => {
    const semester = await prisma.semester.findFirst({
      where: { isCurrent: true },
      include: { academicYear: true },
    });
    res.json(semester);
  });

  // Update semester
  router.patch('/admin/semesters/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      registrationStart: z.string().nullable().optional(),
      registrationEnd: z.string().nullable().optional(),
      midtermExamDate: z.string().nullable().optional(),
      finalExamDate: z.string().nullable().optional(),
      gradingDeadline: z.string().nullable().optional(),
      addDropStart: z.string().nullable().optional(),
      addDropEnd: z.string().nullable().optional(),
      status: z.enum(['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'GRADING', 'COMPLETED']).optional(),
      isCurrent: z.boolean().optional(),
    }).parse(req.body);

    // If setting as current, unset other current semesters
    if (body.isCurrent) {
      await prisma.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    // Get old semester to check status change
    const oldSemester = await prisma.semester.findUnique({
      where: { id: params.id },
    });

    const semester = await prisma.semester.update({
      where: { id: params.id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        registrationStart: body.registrationStart ? new Date(body.registrationStart) : body.registrationStart === null ? null : undefined,
        registrationEnd: body.registrationEnd ? new Date(body.registrationEnd) : body.registrationEnd === null ? null : undefined,
        midtermExamDate: body.midtermExamDate ? new Date(body.midtermExamDate) : body.midtermExamDate === null ? null : undefined,
        finalExamDate: body.finalExamDate ? new Date(body.finalExamDate) : body.finalExamDate === null ? null : undefined,
        gradingDeadline: body.gradingDeadline ? new Date(body.gradingDeadline) : body.gradingDeadline === null ? null : undefined,
        addDropStart: body.addDropStart ? new Date(body.addDropStart) : body.addDropStart === null ? null : undefined,
        addDropEnd: body.addDropEnd ? new Date(body.addDropEnd) : body.addDropEnd === null ? null : undefined,
      },
      include: { academicYear: true },
    });

    // If status changed to REGISTRATION_OPEN, notify all students
    if (body.status === 'REGISTRATION_OPEN' && oldSemester?.status !== 'REGISTRATION_OPEN') {
      // Get all students
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true },
      });

      // Create notifications for all students
      await prisma.notification.createMany({
        data: students.map(s => ({
          userId: s.id,
          type: 'REGISTRATION_OPEN',
          title: 'Registration Open',
          message: `Registration for ${semester.name} is now open. Register before ${semester.registrationEnd ? new Date(semester.registrationEnd).toLocaleDateString() : 'the deadline'}.`,
          data: { semesterId: semester.id },
        })),
      });
    }

    res.json(semester);
  });

  // Delete semester (cascades related records)
  router.delete('/admin/semesters/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const semesterId = params.id;

    // Get all course sections for this semester
    const sections = await prisma.courseSection.findMany({
      where: { semesterId },
      select: { id: true },
    });
    const sectionIds = sections.map(s => s.id);

    // Delete in correct order to respect foreign keys
    // 1. Early exam requests
    await prisma.earlyExamRequest.deleteMany({
      where: { examSchedule: { courseSectionId: { in: sectionIds } } },
    });
    // 2. Exam schedules
    await prisma.examSchedule.deleteMany({
      where: { courseSectionId: { in: sectionIds } },
    });
    // 3. Student grades (via enrollments)
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { courseSectionId: { in: sectionIds } },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map(e => e.id);
    await prisma.studentGrade.deleteMany({
      where: { enrollmentId: { in: enrollmentIds } },
    });
    // 4. Add/drop requests referencing these enrollments or sections
    await prisma.addDropRequest.deleteMany({
      where: {
        OR: [
          { semesterId },
          { courseSectionId: { in: sectionIds } },
          { dropEnrollmentId: { in: enrollmentIds } },
        ],
      },
    });
    // 5. Student enrollments
    await prisma.studentEnrollment.deleteMany({
      where: { courseSectionId: { in: sectionIds } },
    });
    // 6. Attendance
    await prisma.attendance.deleteMany({
      where: { courseId: { in: (await prisma.courseSection.findMany({ where: { id: { in: sectionIds } }, select: { courseId: true } })).map(s => s.courseId) } },
    });
    // 7. Course sections
    await prisma.courseSection.deleteMany({
      where: { semesterId },
    });
    // 8a. Delete semester payments if any
    await prisma.semesterPayment.deleteMany({ where: { semesterId } });

    // 8b. Finally, the semester itself
    await prisma.semester.delete({ where: { id: semesterId } });
    res.status(204).send();
  });

  // ==================== COURSE SECTION MANAGEMENT (Admin) ====================

  // Create course section (assign course to teacher for a semester)
  router.post('/admin/course-sections', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    try {
      const body = z.object({
        courseId: z.string(),
        semesterId: z.string(),
        teacherId: z.string(),
        classId: z.string().nullable().optional(), // Optional: assign to a class
        sectionCode: z.string().min(1), // e.g., "CS101-A"
        deliveryMode: z.enum(['ONLINE', 'PAPER', 'MIXED']).optional(),
        schedule: z.string().optional(),
        room: z.string().optional(),
        maxCapacity: z.number().int().optional(),
      }).parse(req.body);

      // Create course section and optionally add teacher to class
      const courseSection = await prisma.$transaction(async (tx) => {
        // Create the course section
        const section = await tx.courseSection.create({
          data: {
            courseId: body.courseId,
            semesterId: body.semesterId,
            teacherId: body.teacherId,
            classId: body.classId || null,
            deliveryMode: body.deliveryMode || 'ONLINE',
            sectionCode: body.sectionCode,
            schedule: body.schedule,
            room: body.room,
            maxCapacity: body.maxCapacity,
          },
          include: { course: true, semester: true, teacher: true, class: true },
        });

        // If classId is provided, add teacher to class (if not already added)
        if (body.classId) {
          await tx.classTeacher.upsert({
            where: {
              classId_teacherId: {
                classId: body.classId,
                teacherId: body.teacherId,
              },
            },
            create: {
              classId: body.classId,
              teacherId: body.teacherId,
            },
            update: {}, // No-op if already exists
          });
        }

        return section;
      });

      res.status(201).json(courseSection);
    } catch (error) {
      console.error('Error creating course section:', error);
      res.status(500).json({ error: error.message || 'Failed to create course section' });
    }
  });

  // Get all course sections for a semester
  router.get('/admin/course-sections', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const query = z.object({ semesterId: z.string().optional() }).parse(req.query);

    const courseSections = await prisma.courseSection.findMany({
      where: query.semesterId ? { semesterId: query.semesterId } : undefined,
      include: {
        course: true,
        semester: true,
        teacher: { select: { id: true, fullName: true, email: true } },
        class: { select: { id: true, name: true, code: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { sectionCode: 'asc' },
    });

    res.json(courseSections);
  });

  // Update course section
  router.patch('/admin/course-sections/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ id: z.string() }).parse(req.params);
      const body = z.object({
        teacherId: z.string().optional(),
        classId: z.string().nullable().optional(),
        sectionCode: z.string().min(1).optional(),
        deliveryMode: z.enum(['ONLINE', 'PAPER', 'MIXED']).optional(),
        schedule: z.string().optional(),
        room: z.string().optional(),
        maxCapacity: z.number().int().optional(),
        isPublished: z.boolean().optional(),
      }).parse(req.body);

      // Get current course section
      const current = await prisma.courseSection.findUnique({
        where: { id: params.id },
      });

      if (!current) {
        return res.status(404).json({ error: 'Course section not found' });
      }

      // Update course section and sync teacher to class
      const courseSection = await prisma.$transaction(async (tx) => {
        const section = await tx.courseSection.update({
          where: { id: params.id },
          data: body,
          include: { course: true, semester: true, teacher: true, class: true },
        });

        // If classId or teacherId changed, sync to ClassTeacher
        const newClassId = body.classId !== undefined ? body.classId : current.classId;
        const newTeacherId = body.teacherId || current.teacherId;

        if (newClassId) {
          await tx.classTeacher.upsert({
            where: {
              classId_teacherId: {
                classId: newClassId,
                teacherId: newTeacherId,
              },
            },
            create: {
              classId: newClassId,
              teacherId: newTeacherId,
            },
            update: {},
          });
        }

        return section;
      });

      res.json(courseSection);
    } catch (error) {
      console.error('Error updating course section:', error);
      res.status(500).json({ error: error.message || 'Failed to update course section' });
    }
  });

  // Delete course section
  router.delete('/admin/course-sections/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ id: z.string() }).parse(req.params);

      // First delete related records in correct order
      await prisma.$transaction([
        // Delete early exam requests (references exam schedules)
        prisma.earlyExamRequest.deleteMany({
          where: { examSchedule: { courseSectionId: params.id } }
        }),
        // Delete schedule slots
        prisma.courseScheduleSlot.deleteMany({
          where: { courseSectionId: params.id }
        }),
        // Delete student grades
        prisma.studentGrade.deleteMany({
          where: { enrollment: { courseSectionId: params.id } }
        }),
        // Delete exam schedules
        prisma.examSchedule.deleteMany({
          where: { courseSectionId: params.id }
        }),
        // Nullify add/drop requests referencing this section
        prisma.addDropRequest.updateMany({
          where: { courseSectionId: params.id },
          data: { courseSectionId: null }
        }),
        // Delete enrollments
        prisma.studentEnrollment.deleteMany({
          where: { courseSectionId: params.id }
        }),
        // Finally delete the course section
        prisma.courseSection.delete({
          where: { id: params.id }
        }),
      ]);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting course section:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Course section not found' });
      }
      res.status(500).json({ error: 'Failed to delete course section. It may have related records.' });
    }
  });

  // ==================== STUDENT ENROLLMENT ====================

  // Admin: Enroll student in course section
  router.post('/admin/enrollments', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      courseSectionId: z.string(),
      studentId: z.string(),
    }).parse(req.body);

    // Check if already enrolled in this section
    const existing = await prisma.studentEnrollment.findUnique({
      where: {
        courseSectionId_studentId: {
          courseSectionId: body.courseSectionId,
          studentId: body.studentId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Student already enrolled in this course section' });
    }

    // Check if student already took this course AND PASSED (allow retaking failed courses)
    const section = await prisma.courseSection.findUnique({
      where: { id: body.courseSectionId },
      select: { courseId: true },
    });
    if (section) {
      const previousEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: body.studentId,
          courseSection: { courseId: section.courseId },
          status: 'ENROLLED',
          grade: { isSubmitted: true },
        },
        include: { courseSection: { include: { course: true, semester: true } }, grade: true },
      });
      if (previousEnrollment && previousEnrollment.grade) {
        const passed = previousEnrollment.grade.gradeLetter !== 'F' && (previousEnrollment.grade.totalScore ?? 0) >= 40;
        if (passed) {
          return res.status(400).json({
            error: `Student already passed ${previousEnrollment.courseSection.course?.title || 'this course'} (${previousEnrollment.grade.gradeLetter}) in ${previousEnrollment.courseSection.semester?.name || 'a previous semester'}. Cannot retake a passed course.`,
          });
        }
      }
    }

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        courseSectionId: body.courseSectionId,
        studentId: body.studentId,
      },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: true } },
      },
    });

    createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'ENROLL', category: 'ENROLLMENT', targetId: enrollment.id, targetType: 'StudentEnrollment', description: `Admin enrolled ${enrollment.student?.fullName} in ${enrollment.courseSection?.course?.title}`, ipAddress: req.ip });
    res.status(201).json(enrollment);
  });

  // Admin: Get all enrollments for a course section
  router.get('/admin/course-sections/:id/enrollments', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { courseSectionId: params.id },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        grade: true,
      },
    });

    res.json(enrollments);
  });

  // Admin: Remove enrollment
  router.delete('/admin/enrollments/:id', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    await prisma.studentEnrollment.delete({ where: { id: params.id } });
    res.status(204).send();
  });

  // Student: Get available courses for registration (courses assigned to their class)
  router.get('/student/available-courses', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    // Get current semester with registration open
    const currentSemester = await prisma.semester.findFirst({
      where: {
        status: 'REGISTRATION_OPEN',
      },
    });

    if (!currentSemester) {
      return res.json({ semester: null, courses: [] });
    }

    // Get student's class and profile
    const [classStudent, studentProfile] = await Promise.all([
      prisma.classStudent.findFirst({
        where: { studentId: user.id },
        include: { class: true },
      }),
      prisma.studentProfile.findUnique({
        where: { userId: user.id },
      })
    ]);

    if (!classStudent) {
      return res.json({ semester: currentSemester, courses: [], message: 'You are not assigned to a class yet.' });
    }

    if (!studentProfile?.stream) {
      return res.json({ semester: currentSemester, courses: [], message: 'Please select your stream (Natural Science or Social Science) in your profile first.' });
    }

    // Get course sections assigned to student's class for this semester
    // Filter by student's stream: show courses matching their stream or common courses (stream = null)
    const courseSections = await prisma.courseSection.findMany({
      where: {
        semesterId: currentSemester.id,
        classId: classStudent.classId,
        course: {
          OR: [
            { stream: studentProfile.stream },
            { stream: null }
          ]
        }
      },
      include: {
        course: true,
        teacher: { select: { id: true, fullName: true, email: true } },
        semester: true,
        class: { select: { id: true, name: true, code: true } },
        _count: { select: { enrollments: true } },
      },
    });

    // Check which courses student is already enrolled in
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId: user.id, courseSectionId: { in: courseSections.map(cs => cs.id) } },
      select: { courseSectionId: true },
    });

    const enrolledIds = enrollments.map(e => e.courseSectionId);

    // Check which courses student already PASSED in any previous semester (allow retaking failed)
    const allPreviousGrades = await prisma.studentEnrollment.findMany({
      where: {
        studentId: user.id,
        status: 'ENROLLED',
        grade: { isSubmitted: true },
        courseSection: { courseId: { in: courseSections.map(cs => cs.courseId) } },
      },
      include: { courseSection: { select: { courseId: true } }, grade: true },
    });
    const passedCourseIds = new Set(
      allPreviousGrades
        .filter(e => e.grade && e.grade.gradeLetter !== 'F' && (e.grade.totalScore ?? 0) >= 40)
        .map(e => e.courseSection.courseId)
    );

    res.json({
      semester: currentSemester,
      class: classStudent.class,
      courses: courseSections.map(cs => ({
        ...cs,
        isEnrolled: enrolledIds.includes(cs.id),
        alreadyPassed: passedCourseIds.has(cs.courseId),
      })),
    });
  });

  // Student: Register for semester (enroll in all courses for their class)
  router.post('/student/register-semester', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    // Get current semester with registration open
    const currentSemester = await prisma.semester.findFirst({
      where: { status: 'REGISTRATION_OPEN' },
    });

    if (!currentSemester) {
      return res.status(400).json({ error: 'No semester open for registration' });
    }

    // Get student's class and department to calculate fee
    const classStudent = await prisma.classStudent.findFirst({
      where: { studentId: user.id },
      include: { class: { include: { department: true } } },
    });

    // Auto-calculate registration fee from department pricePerCreditHour * credit hours
    let registrationFee = 0;
    if (classStudent?.class?.department) {
      const dept = classStudent.class.department;

      // Get student profile for stream filtering
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

      const semesterCreditHours = courseSections.reduce((sum, cs) => sum + (cs.course?.creditHours || 3), 0);
      registrationFee = semesterCreditHours * dept.pricePerCreditHour;
    }

    // Check payment if fee is required
    if (registrationFee > 0) {
      const completedPayment = await prisma.semesterPayment.findFirst({
        where: {
          studentId: user.id,
          semesterId: currentSemester.id,
          status: 'COMPLETED',
        },
      });

      if (!completedPayment) {
        return res.status(402).json({
          error: 'Payment required before registration',
          requiresPayment: true,
          semesterId: currentSemester.id,
          registrationFee,
        });
      }
    }

    if (!classStudent) {
      return res.status(400).json({ error: 'You are not assigned to a class' });
    }

    // Get course sections for student's class this semester
    // (studentProfile and courseSectionsWhere already computed above for fee calculation)
    const courseSectionsWhere2: any = {
      semesterId: currentSemester.id,
      classId: classStudent.classId,
    };

    const studentProfile2 = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });

    if (studentProfile2?.stream) {
      courseSectionsWhere2.course = {
        OR: [
          { stream: studentProfile2.stream },
          { stream: null }
        ]
      };
    }

    const courseSections = await prisma.courseSection.findMany({
      where: courseSectionsWhere2,
    });

    if (courseSections.length === 0) {
      return res.status(400).json({ error: 'No courses assigned to your class for this semester' });
    }

    // Enroll student in all courses (skip ones already passed — allow retaking failed courses)
    const enrollments = [];
    const skippedCourses = [];
    for (const cs of courseSections) {
      // Check if already enrolled in this section
      const existing = await prisma.studentEnrollment.findUnique({
        where: {
          courseSectionId_studentId: {
            courseSectionId: cs.id,
            studentId: user.id,
          },
        },
      });

      if (existing) continue;

      // Check if student already PASSED this course (allow retaking failed ones)
      const previousEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: user.id,
          courseSection: { courseId: cs.courseId },
          status: 'ENROLLED',
          grade: { isSubmitted: true },
        },
        include: { courseSection: { include: { course: { select: { title: true } }, semester: { select: { name: true } } } }, grade: true },
      });

      if (previousEnrollment && previousEnrollment.grade) {
        const passed = previousEnrollment.grade.gradeLetter !== 'F' && (previousEnrollment.grade.totalScore ?? 0) >= 40;
        if (passed) {
          skippedCourses.push(previousEnrollment.courseSection.course?.title || cs.courseId);
          continue;
        }
      }

      const enrollment = await prisma.studentEnrollment.create({
        data: {
          courseSectionId: cs.id,
          studentId: user.id,
        },
        include: {
          courseSection: { include: { course: true } },
        },
      });
      enrollments.push(enrollment);
    }

    createAuditLog({ userId: user.id, userRole: 'STUDENT', action: 'SEMESTER_REGISTER', category: 'ENROLLMENT', targetId: currentSemester.id, targetType: 'Semester', description: `Student registered for ${enrollments.length} courses in ${currentSemester.name}${skippedCourses.length > 0 ? ` (skipped passed: ${skippedCourses.join(', ')})` : ''}`, ipAddress: req.ip });
    res.json({
      message: skippedCourses.length > 0
        ? `Registered for ${enrollments.length} courses. Skipped already taken: ${skippedCourses.join(', ')}`
        : `Successfully registered for ${enrollments.length} courses`,
      semester: currentSemester,
      enrollments,
      skippedCourses,
    });
  });

  // Student: Get my enrollments
  router.get('/student/my-courses', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId: user.id, status: 'ENROLLED' },
      include: {
        courseSection: {
          include: {
            course: true,
            teacher: { select: { id: true, fullName: true } },
            semester: { include: { academicYear: true } },
            class: true,
          },
        },
        grade: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    // Sort: current semester first, past semesters last
    const sorted = enrollments.map(e => {
      const isCurrentSemester = e.courseSection?.semester?.isCurrent || false;
      const isPastSemester = e.courseSection?.semester?.status === 'COMPLETED'
        || (e.courseSection?.semester?.endDate && new Date(e.courseSection.semester.endDate) < new Date());
      const gradeSubmitted = e.grade?.isSubmitted || false;
      const gradePublished = e.grade?.isPublished || false;
      return { ...e, isCurrentSemester, isPastSemester, gradeSubmitted, gradePublished };
    });

    sorted.sort((a, b) => {
      if (a.isCurrentSemester !== b.isCurrentSemester) return a.isCurrentSemester ? -1 : 1;
      if (a.isPastSemester !== b.isPastSemester) return a.isPastSemester ? 1 : -1;
      return 0;
    });

    res.json(sorted);
  });

  // ==================== GRADE ENTRY (Teacher) ====================

  // Teacher: Get my course sections
  router.get('/teacher/my-sections', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    const sections = await prisma.courseSection.findMany({
      where: { teacherId: user.id },
      include: {
        course: true,
        semester: { include: { academicYear: true } },
        class: true,
        _count: { select: { enrollments: true } },
        enrollments: { select: { id: true, status: true, grade: { select: { isSubmitted: true, isPublished: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add grade submission status and sort: current semester first
    const enriched = sections.map(s => {
      const activeEnrollments = s.enrollments.filter(e => e.status === 'ENROLLED');
      const totalEnrollments = activeEnrollments.length;
      const submittedGrades = activeEnrollments.filter(e => e.grade?.isSubmitted).length;
      const publishedGrades = activeEnrollments.filter(e => e.grade?.isPublished).length;
      const allGradesSubmitted = totalEnrollments > 0 && submittedGrades >= totalEnrollments;
      const allGradesPublished = totalEnrollments > 0 && publishedGrades >= totalEnrollments;
      const isCurrentSemester = s.semester?.isCurrent || false;
      const isPastSemester = s.semester?.status === 'COMPLETED' || (s.semester?.endDate && new Date(s.semester.endDate) < new Date());

      // Remove enrollments from response (only needed for counting)
      const { enrollments, ...rest } = s;
      return {
        ...rest,
        allGradesSubmitted,
        allGradesPublished,
        isCurrentSemester,
        isPastSemester,
        semesterStatus: s.semester?.status || null,
      };
    });

    // Sort: current semester first, then by semester start date desc
    enriched.sort((a, b) => {
      if (a.isCurrentSemester !== b.isCurrentSemester) return a.isCurrentSemester ? -1 : 1;
      if (a.isPastSemester !== b.isPastSemester) return a.isPastSemester ? 1 : -1;
      return 0;
    });

    res.json(enriched);
  });

  // Teacher: Get students in my course section
  router.get('/teacher/sections/:id/students', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    // Verify teacher owns this section
    const section = await prisma.courseSection.findFirst({
      where: { id: params.id, teacherId: user.id },
    });

    if (!section) {
      return res.status(404).json({ error: 'Course section not found' });
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { courseSectionId: params.id },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        grade: true,
      },
    });

    res.json(enrollments);
  });

  // Teacher: Enter/Update grade for a student
  router.post('/teacher/grades', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      enrollmentId: z.string(),
      quizScore: z.number().min(0).optional(),
      assignmentScore: z.number().min(0).optional(),
      midtermScore: z.number().min(0).optional(),
      finalScore: z.number().min(0).optional(),
      attendanceScore: z.number().min(0).optional(),
      feedback: z.union([z.string(), z.null()]).optional(),
    }).parse(req.body);

    const user = req.user!;

    // Check semester is IN_PROGRESS before allowing grade entry
    const sectionId = await getSectionFromEnrollment(body.enrollmentId);
    if (sectionId) {
      const { allowed, semesterStatus } = await requireSemesterInProgress(sectionId);
      if (!allowed) {
        return res.status(403).json({ error: 'Semester not in progress', message: `Cannot enter grades. Semester status is ${semesterStatus || 'unknown'}. Wait for admin to start the semester.`, semesterStatus });
      }
    }

    // Verify teacher owns this enrollment's course section
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: body.enrollmentId },
      include: { courseSection: { include: { course: { include: { gradeConfig: true, gradeComponents: true } } } } },
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    if (enrollment.courseSection.teacherId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to grade this student' });
    }

    // Get weights from GradeComponents (new system) or fall back to gradeConfig
    const components = enrollment.courseSection.course.gradeComponents || [];
    const getWeight = (name: string, fallback: number) => {
      const comp = components.find((c: any) => c.name === name);
      return comp ? comp.weight : fallback;
    };
    const config = enrollment.courseSection.course.gradeConfig || {
      quizWeight: getWeight('Quiz', 25),
      midtermWeight: getWeight('Midterm', 25),
      finalWeight: getWeight('Final', 40),
      attendanceWeight: getWeight('Attendance', 10),
    };
    // Override with component weights if available
    if (components.length > 0) {
      config.quizWeight = getWeight('Quiz', config.quizWeight);
      config.midtermWeight = getWeight('Midterm', config.midtermWeight);
      config.finalWeight = getWeight('Final', config.finalWeight);
      config.attendanceWeight = getWeight('Attendance', config.attendanceWeight);
    }

    // Validate scores don't exceed weights
    const assignmentWeight = getWeight('Assignment', 0);
    if (body.quizScore !== undefined && body.quizScore > config.quizWeight) {
      return res.status(400).json({ error: `Quiz score cannot exceed ${config.quizWeight}` });
    }
    if (body.assignmentScore !== undefined && body.assignmentScore > assignmentWeight) {
      return res.status(400).json({ error: `Assignment score cannot exceed ${assignmentWeight}` });
    }
    if (body.midtermScore !== undefined && body.midtermScore > config.midtermWeight) {
      return res.status(400).json({ error: `Midterm score cannot exceed ${config.midtermWeight}` });
    }
    if (body.finalScore !== undefined && body.finalScore > config.finalWeight) {
      return res.status(400).json({ error: `Final score cannot exceed ${config.finalWeight}` });
    }
    if (body.attendanceScore !== undefined && body.attendanceScore > config.attendanceWeight) {
      return res.status(400).json({ error: `Attendance score cannot exceed ${config.attendanceWeight}` });
    }

    // Calculate total score (sum of weighted marks, out of 100)
    const quiz = body.quizScore ?? 0;
    const assignment = body.assignmentScore ?? 0;
    const midterm = body.midtermScore ?? 0;
    const final = body.finalScore ?? 0;
    const attendance = body.attendanceScore ?? 0;

    const totalScore = Math.round(Math.min(quiz + assignment + midterm + final + attendance, 100) * 10) / 10;

    const { letter, point } = getGradeFromScore(totalScore);

    // Upsert grade
    const grade = await prisma.studentGrade.upsert({
      where: { enrollmentId: body.enrollmentId },
      create: {
        enrollmentId: body.enrollmentId,
        quizScore: body.quizScore,
        assignmentScore: body.assignmentScore,
        midtermScore: body.midtermScore,
        finalScore: body.finalScore,
        attendanceScore: body.attendanceScore,
        totalScore,
        gradeLetter: letterToEnum(letter) as any,
        gradePoint: point,
        feedback: body.feedback,
      },
      update: {
        quizScore: body.quizScore,
        assignmentScore: body.assignmentScore,
        midtermScore: body.midtermScore,
        finalScore: body.finalScore,
        attendanceScore: body.attendanceScore,
        totalScore,
        gradeLetter: letterToEnum(letter) as any,
        gradePoint: point,
        feedback: body.feedback,
      },
    });

    res.json(grade);
  });

  // Teacher: Submit final grades for a course section
  router.post('/teacher/sections/:id/submit-grades', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    // Verify teacher owns this section
    const section = await prisma.courseSection.findFirst({
      where: { id: params.id, teacherId: user.id },
    });

    if (!section) {
      return res.status(404).json({ error: 'Course section not found' });
    }

    // Check semester is IN_PROGRESS
    const { allowed, semesterStatus } = await requireSemesterInProgress(params.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Semester not in progress', message: `Cannot submit grades. Semester status is ${semesterStatus || 'unknown'}.`, semesterStatus });
    }

    // Mark all grades as submitted
    await prisma.studentGrade.updateMany({
      where: {
        enrollment: { courseSectionId: params.id },
      },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });

    createAuditLog({ userId: user.id, userRole: 'TEACHER', action: 'GRADE_SUBMIT', category: 'GRADE', targetId: params.id, targetType: 'CourseSection', description: `Teacher submitted final grades for section ${section.sectionCode}`, ipAddress: req.ip });
    res.json({ message: 'Grades submitted successfully' });
  });

  // Teacher: Sync assessment results to grades for a course section
  router.post('/teacher/sections/:id/sync-assessments', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    // Verify teacher owns this section
    const section = await prisma.courseSection.findFirst({
      where: { id: params.id, teacherId: user.id },
      include: { 
        course: { include: { gradeConfig: true, gradeComponents: { orderBy: { sortOrder: 'asc' } } } },
        enrollments: { 
          where: { status: 'ENROLLED' },
          include: { student: true, grade: true }
        }
      },
    });

    if (!section) {
      return res.status(404).json({ error: 'Course section not found' });
    }

    // Check semester is IN_PROGRESS
    const { allowed, semesterStatus } = await requireSemesterInProgress(params.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Semester not in progress', message: `Cannot sync assessments. Semester status is ${semesterStatus || 'unknown'}.`, semesterStatus });
    }

    const gradeComponents = section.course.gradeComponents;

    // Get dynamic grade components
    let components = section.course.gradeComponents;
    if (components.length === 0) {
      // Seed defaults if none exist
      const config = section.course.gradeConfig || { quizWeight: 25, midtermWeight: 25, finalWeight: 40, attendanceWeight: 10 };
      components = [
        { id: '__quiz__', name: 'Quiz', weight: config.quizWeight },
        { id: '__midterm__', name: 'Midterm', weight: config.midtermWeight },
        { id: '__final__', name: 'Final', weight: config.finalWeight },
        { id: '__attendance__', name: 'Attendance', weight: config.attendanceWeight },
      ] as any[];
    }

    // Validate that grade components total 100%
    const totalWeight = components.reduce((s: number, c: { weight: number }) => s + c.weight, 0);
    if (totalWeight !== 100) {
      return res.status(400).json({ error: `Grade components must total 100%. Current total: ${totalWeight}%` });
    }

    // Get all assessments for this course with GRADED attempts and manual grades
    const assessments = await prisma.assessment.findMany({
      where: { courseId },
      include: {
        attempts: {
          where: { status: 'GRADED' },
        },
        manualGrades: true,
      },
    });

    // Get attendance for this course - always recalculate from sessions
    // Get live session attendance
    const liveSessions = await prisma.liveSession.findMany({
      where: { courseId, classId: section.classId, status: 'ENDED' },
      include: { attendance: true },
    });

    // Get manual attendance sessions
    const manualSessions = await prisma.manualAttendanceSession.findMany({
      where: { courseId, classId: section.classId },
      include: { records: true },
    });

    const totalSessions = liveSessions.length + manualSessions.length;

    if (totalSessions > 0) {
      for (const enrollment of section.enrollments) {
        const studentId = enrollment.studentId;

        // Live session points
        let livePoints = 0;
        for (const ls of liveSessions) {
          const att = ls.attendance.find(a => a.studentId === studentId);
          if (att) {
            if (att.status === 'ATTENDED') livePoints += 100;
            else if (att.status === 'PARTIAL') livePoints += 50;
          }
        }

        // Manual session points
        let manualPoints = 0;
        for (const ms of manualSessions) {
          const record = ms.records.find(r => r.studentId === studentId);
          if (record) {
            if (record.status === 'PRESENT') manualPoints += 100;
            else if (record.status === 'LATE') manualPoints += 75;
            else if (record.status === 'EXCUSED') manualPoints += 50;
          }
        }

        const totalPoints = livePoints + manualPoints;
        const percentage = Math.round(totalPoints / totalSessions);
        const score = Math.round(Math.min(100, Math.max(0, percentage)) * 10) / 10;

        await prisma.attendance.upsert({
          where: { courseId_studentId: { courseId, studentId } },
          update: { score },
          create: { courseId, studentId, score },
        });
      }
    }

    // Re-fetch attendance records (either just calculated or pre-existing)
    const attendanceRecords = await prisma.attendance.findMany({
      where: { courseId },
    });

    // Process each enrolled student
    const results = [];
    for (const enrollment of section.enrollments) {
      const studentId = enrollment.studentId;

      // Calculate per-component scores using same logic as gradebook
      const componentScores: Record<string, number> = {};
      let totalGrade = 0;

      for (const component of components) {
        if (component.name === 'Attendance') {
          // Attendance is stored as percentage (0-100)
          const attendance = attendanceRecords.find(a => a.studentId === studentId);
          const attendancePercent = Math.round((attendance?.score || 0) * 10) / 10;
          const weightedMark = Math.round(attendancePercent * component.weight / 100 * 10) / 10;
          componentScores[component.id] = weightedMark;
          totalGrade += weightedMark;
        } else {
          // Get assessments linked to this component
          const componentAssessments = assessments.filter(a => a.componentId === component.id);

          if (componentAssessments.length > 0) {
            // Average of all assessments in this component
            let score = 0;
            let count = 0;
            for (const assessment of componentAssessments) {
              const attempt = assessment.attempts.find(at => at.studentId === studentId);
              if (attempt && attempt.score !== null && assessment.maxScore) {
                // attempt.score is raw points, convert to percentage
                score += (attempt.score / assessment.maxScore) * 100;
                count++;
              } else {
                const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === studentId);
                if (manualGrade && assessment.maxScore) {
                  score += (manualGrade.score / assessment.maxScore) * 100;
                  count++;
                }
              }
            }
            const avg = count > 0 ? score / count : 0;
            const weightedMark = Math.round(avg * component.weight / 100 * 10) / 10;
            // Clamp to not exceed weight
            componentScores[component.id] = Math.min(weightedMark, component.weight);
            totalGrade += Math.min(weightedMark, component.weight);
          } else {
            // Legacy: match by examType to component name
            // Map component names to examTypes
            const examTypeMap: Record<string, string[]> = {
              'Quiz': ['QUIZ'],
              'Assignment': ['ASSIGNMENT'],
              'Midterm': ['MIDTERM'],
              'Final': ['FINAL'],
              'Class Activity': ['CLASS_ACTIVITY'],
              'Lab': ['LAB'],
              'Project': ['PROJECT'],
              'Presentation': ['PRESENTATION'],
            };
            const matchingTypes = examTypeMap[component.name] || [];
            // Also try matching by component name = examType (case-insensitive)
            const nameMatch = assessments.filter(a => 
              a.examType === component.name.toUpperCase().replace(/\s+/g, '_') ||
              matchingTypes.includes(a.examType)
            );

            if (nameMatch.length > 0) {
              let score = 0;
              let count = 0;
              for (const assessment of nameMatch) {
                const attempt = assessment.attempts.find(at => at.studentId === studentId);
                if (attempt && attempt.score !== null && assessment.maxScore) {
                  score += (attempt.score / assessment.maxScore) * 100;
                  count++;
                } else {
                  const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === studentId);
                  if (manualGrade && assessment.maxScore) {
                    score += (manualGrade.score / assessment.maxScore) * 100;
                    count++;
                  }
                }
              }
              const avg = count > 0 ? score / count : 0;
              const weightedMark = Math.round(avg * component.weight / 100 * 10) / 10;
              componentScores[component.id] = Math.min(weightedMark, component.weight);
              totalGrade += Math.min(weightedMark, component.weight);
            } else {
              // No matching assessments - score is 0
              componentScores[component.id] = 0;
            }
          }
        }
      }

      totalGrade = Math.round(Math.min(totalGrade, 100) * 10) / 10;
      const { letter, point } = getGradeFromScore(totalGrade);

      // Map component scores to legacy grade fields for backward compat
      const quizComp = components.find(c => c.name === 'Quiz');
      const assignmentComp = components.find(c => c.name === 'Assignment');
      const midtermComp = components.find(c => c.name === 'Midterm');
      const finalComp = components.find(c => c.name === 'Final');
      const attendanceComp = components.find(c => c.name === 'Attendance');

      const quizMark = quizComp ? (componentScores[quizComp.id] || 0) : 0;
      const assignmentMark = assignmentComp ? (componentScores[assignmentComp.id] || 0) : 0;
      const midtermMark = midtermComp ? (componentScores[midtermComp.id] || 0) : 0;
      const finalMark = finalComp ? (componentScores[finalComp.id] || 0) : 0;
      const attendanceMark = attendanceComp ? (componentScores[attendanceComp.id] || 0) : 0;

      // Upsert grade - store weighted marks (out of weight)
      const grade = await prisma.studentGrade.upsert({
        where: { enrollmentId: enrollment.id },
        create: {
          enrollmentId: enrollment.id,
          quizScore: quizMark,
          assignmentScore: assignmentMark,
          midtermScore: midtermMark,
          finalScore: finalMark,
          attendanceScore: attendanceMark,
          totalScore: totalGrade,
          gradeLetter: letterToEnum(letter) as any,
          gradePoint: point,
        },
        update: {
          quizScore: quizMark,
          assignmentScore: assignmentMark,
          midtermScore: midtermMark,
          finalScore: finalMark,
          attendanceScore: attendanceMark,
          totalScore: totalGrade,
          gradeLetter: letterToEnum(letter) as any,
          gradePoint: point,
        },
      });

      results.push({
        studentId,
        studentName: enrollment.student.fullName,
        quizScore: quizMark,
        assignmentScore: assignmentMark,
        midtermScore: midtermMark,
        finalScore: finalMark,
        attendanceScore: attendanceMark,
        totalScore: totalGrade,
        gradeLetter: letter,
      });
    }

    res.json({ 
      message: `Synced ${results.length} student grades from assessments`,
      results 
    });
  });

  // ==================== STUDENT RESULTS ====================

  // Student: Get my results for a semester
  router.get('/student/results/:semesterId?', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ semesterId: z.string().optional() }).parse(req.params);
    const user = req.user!;

    // Get current semester if not specified
    let semesterId = params.semesterId;
    if (!semesterId) {
      const current = await prisma.semester.findFirst({
        where: { isCurrent: true },
      });
      semesterId = current?.id;
    }

    if (!semesterId) {
      return res.json({ semester: null, courses: [], gpa: null });
    }

    // Get enrollments with grades for this semester
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: user.id,
        courseSection: { semesterId },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
    });

    // Calculate GPA for this semester
    let totalPoints = 0;
    let totalCredits = 0;

    const courses = enrollments.map(e => {
      const credits = e.courseSection.course.creditHours;
      const grade = e.grade;

      if (grade && grade.isPublished && grade.gradePoint !== null) {
        totalPoints += grade.gradePoint * credits;
        totalCredits += credits;
      }

      return {
        id: e.id,
        course: e.courseSection.course,
        sectionCode: e.courseSection.sectionCode,
        creditHours: e.courseSection.course.creditHours,
        grade: grade ? {
          quizScore: grade.isPublished ? grade.quizScore : null,
          midtermScore: grade.isPublished ? grade.midtermScore : null,
          finalScore: grade.isPublished ? grade.finalScore : null,
          attendanceScore: grade.isPublished ? grade.attendanceScore : null,
          totalScore: grade.isPublished ? grade.totalScore : null,
          gradeLetter: grade.isPublished ? grade.gradeLetter : null,
          gradePoint: grade.isPublished ? grade.gradePoint : null,
          isSubmitted: grade.isSubmitted,
          isPublished: grade.isPublished,
        } : null,
      };
    });

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    // Get semester info
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: { academicYear: true },
    });

    res.json({ semester, courses, gpa });
  });

  // Student: Get my CGPA (cumulative)
  router.get('/student/cgpa', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    // Get all enrollments with published grades
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: user.id,
        grade: { isPublished: true },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
    });

    let totalPoints = 0;
    let totalCredits = 0;

    const semesterResults: Record<string, { semester: any; points: number; credits: number; gpa: number }> = {};

    for (const e of enrollments) {
      const credits = e.courseSection.course.creditHours;
      const grade = e.grade!;

      if (grade.gradePoint !== null) {
        totalPoints += grade.gradePoint * credits;
        totalCredits += credits;

        const semKey = e.courseSection.semesterId;
        if (!semesterResults[semKey]) {
          semesterResults[semKey] = {
            semester: e.courseSection.semester,
            points: 0,
            credits: 0,
            gpa: 0,
          };
        }
        semesterResults[semKey].points += grade.gradePoint * credits;
        semesterResults[semKey].credits += credits;
      }
    }

    // Calculate GPA for each semester
    for (const key of Object.keys(semesterResults)) {
      const sr = semesterResults[key];
      sr.gpa = sr.credits > 0 ? sr.points / sr.credits : 0;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    res.json({
      cgpa,
      totalCredits,
      totalCourses: enrollments.length,
      semesters: Object.values(semesterResults).sort((a, b) =>
        new Date(b.semester.startDate).getTime() - new Date(a.semester.startDate).getTime()
      ),
    });
  });

  // ==================== TRANSCRIPT ====================

  // Student: Get my transcript (all semesters with courses and grades)
  router.get('/student/transcript', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    const student = await prisma.user.findUnique({
      where: { id: user.id },
      include: { department: true },
    });

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: user.id,
        grade: { isPublished: true },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
      orderBy: { courseSection: { semester: { startDate: 'asc' } } },
    });

    // Group by semester
    const semesterMap: Record<string, { semester: any; courses: any[]; points: number; credits: number; gpa: number }> = {};

    for (const e of enrollments) {
      const semKey = e.courseSection.semesterId;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = {
          semester: e.courseSection.semester,
          courses: [],
          points: 0,
          credits: 0,
          gpa: 0,
        };
      }
      semesterMap[semKey].courses.push({
        id: e.id,
        course: e.courseSection.course,
        creditHours: e.courseSection.course.creditHours,
        grade: e.grade,
      });

      if (e.grade?.gradePoint !== null && e.grade?.gradePoint !== undefined) {
        const credits = e.courseSection.course.creditHours;
        semesterMap[semKey].points += e.grade.gradePoint * credits;
        semesterMap[semKey].credits += credits;
      }
    }

    // Calculate semester GPAs
    let totalPoints = 0;
    let totalCredits = 0;
    for (const key of Object.keys(semesterMap)) {
      const sr = semesterMap[key];
      sr.gpa = sr.credits > 0 ? sr.points / sr.credits : 0;
      totalPoints += sr.points;
      totalCredits += sr.credits;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    res.json({
      student: {
        id: student?.id,
        fullName: student?.fullName,
        email: student?.email,
        studentId: student?.studentId,
        department: student?.department,
      },
      semesters: Object.values(semesterMap).sort((a, b) =>
        new Date(a.semester.startDate).getTime() - new Date(b.semester.startDate).getTime()
      ),
      cgpa,
      totalCredits,
      totalCourses: enrollments.length,
    });
  });

  // Admin: Get student transcript by studentId
  router.get('/admin/students/:studentId/transcript', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ studentId: z.string() }).parse(req.params);

    const student = await prisma.user.findUnique({
      where: { id: params.studentId },
      include: { department: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: params.studentId,
        grade: { isPublished: true },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
      orderBy: { courseSection: { semester: { startDate: 'asc' } } },
    });

    // Group by semester
    const semesterMap: Record<string, { semester: any; courses: any[]; points: number; credits: number; gpa: number }> = {};

    for (const e of enrollments) {
      const semKey = e.courseSection.semesterId;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = {
          semester: e.courseSection.semester,
          courses: [],
          points: 0,
          credits: 0,
          gpa: 0,
        };
      }
      semesterMap[semKey].courses.push({
        id: e.id,
        course: e.courseSection.course,
        creditHours: e.courseSection.course.creditHours,
        grade: e.grade,
      });

      if (e.grade?.gradePoint !== null && e.grade?.gradePoint !== undefined) {
        const credits = e.courseSection.course.creditHours;
        semesterMap[semKey].points += e.grade.gradePoint * credits;
        semesterMap[semKey].credits += credits;
      }
    }

    // Calculate semester GPAs
    let totalPoints = 0;
    let totalCredits = 0;
    for (const key of Object.keys(semesterMap)) {
      const sr = semesterMap[key];
      sr.gpa = sr.credits > 0 ? sr.points / sr.credits : 0;
      totalPoints += sr.points;
      totalCredits += sr.credits;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    res.json({
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        studentId: student.studentId,
        department: student.department,
      },
      semesters: Object.values(semesterMap).sort((a, b) =>
        new Date(a.semester.startDate).getTime() - new Date(b.semester.startDate).getTime()
      ),
      cgpa,
      totalCredits,
      totalCourses: enrollments.length,
    });
  });

  // ==================== ADMIN: PUBLISH GRADES ====================

  // Admin: Publish grades for a semester
  router.post('/admin/semesters/:id/publish-grades', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);

    // Get semester info
    const semester = await prisma.semester.findUnique({
      where: { id: params.id },
    });

    // Get all students with submitted grades for this semester
    const enrollmentsWithGrades = await prisma.studentEnrollment.findMany({
      where: {
        courseSection: { semesterId: params.id },
        grade: { isSubmitted: true, isPublished: false },
      },
      select: { studentId: true },
    });

    // Get unique student IDs
    const studentIds = [...new Set(enrollmentsWithGrades.map(e => e.studentId))];

    // Publish grades
    const result = await prisma.studentGrade.updateMany({
      where: {
        isSubmitted: true,
        enrollment: { courseSection: { semesterId: params.id } },
      },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Create notifications for affected students
    if (studentIds.length > 0) {
      await prisma.notification.createMany({
        data: studentIds.map(studentId => ({
          userId: studentId,
          type: 'GRADE_PUBLISHED',
          title: 'Grades Published',
          message: `Your grades for ${semester?.name || 'this semester'} have been published. Check your results now.`,
          data: { semesterId: params.id },
        })),
      });
    }

    createAuditLog({ userId: req.user!.id, userRole: 'ADMIN', action: 'GRADE_PUBLISH', category: 'GRADE', targetId: params.id, targetType: 'Semester', description: `Admin published ${result.count} grades for ${semester?.name || 'semester'}`, ipAddress: req.ip });
    res.json({ message: 'Grades published successfully', count: result.count });
  });

  // Admin: Get GPA report for a semester
  router.get('/admin/semesters/:id/gpa-report', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);

    // Get all enrollments with published grades for this semester
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        courseSection: { semesterId: params.id },
        grade: { isPublished: true },
      },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: true } },
        grade: true,
      },
    });

    // Group by student
    const studentMap: Record<string, { student: any; points: number; credits: number; courses: any[] }> = {};

    for (const e of enrollments) {
      const studentId = e.studentId;
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          student: e.student,
          points: 0,
          credits: 0,
          courses: [],
        };
      }

      const credits = e.courseSection.course.creditHours;
      const grade = e.grade!;

      if (grade.gradePoint !== null) {
        studentMap[studentId].points += grade.gradePoint * credits;
        studentMap[studentId].credits += credits;
      }

      studentMap[studentId].courses.push({
        course: e.courseSection.course,
        gradeLetter: grade.gradeLetter,
        gradePoint: grade.gradePoint,
        creditHours: credits,
      });
    }

    // Calculate GPA for each student
    const report = Object.values(studentMap).map(s => ({
      student: s.student,
      gpa: s.credits > 0 ? s.points / s.credits : 0,
      totalCredits: s.credits,
      courseCount: s.courses.length,
      courses: s.courses,
    }));

    res.json(report.sort((a, b) => b.gpa - a.gpa));
  });

  // ==================== EXAM SCHEDULING (Teacher) ====================

  // Teacher: Create exam schedule (uses official date from semester)
  router.post('/teacher/exam-schedules', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      courseSectionId: z.string(),
      examType: z.enum(['MIDTERM', 'FINAL']),
      duration: z.number().int().min(1),
      location: z.string().optional(),
      instructions: z.string().optional(),
      weight: z.number().int().min(1).max(100).optional(),
      // Teacher-set exam date and time
      examDate: z.string().optional(),
      // Early exam proposal fields
      proposedDate: z.string().optional(),
      proposalDeadline: z.string().optional(),
    }).parse(req.body);

    const user = req.user!;

    // Verify teacher owns this section
    const section = await prisma.courseSection.findFirst({
      where: { id: body.courseSectionId, teacherId: user.id },
      include: { semester: true },
    });

    if (!section) {
      return res.status(404).json({ error: 'Course section not found' });
    }

    // Use teacher-set date or fallback to official date from semester
    let officialDate: Date | null = null;
    if (body.examDate) {
      officialDate = new Date(body.examDate);
    } else {
      officialDate = body.examType === 'MIDTERM' ? section.semester.midtermExamDate : section.semester.finalExamDate;
    }

    // Determine early exam status
    let earlyExamStatus: 'NONE' | 'PROPOSED' = 'NONE';
    let proposedDate: Date | null = null;
    let proposalDeadline: Date | null = null;

    if (body.proposedDate && body.proposalDeadline) {
      earlyExamStatus = 'PROPOSED';
      proposedDate = new Date(body.proposedDate);
      proposalDeadline = new Date(body.proposalDeadline);
    }

    const examSchedule = await prisma.examSchedule.create({
      data: {
        courseSectionId: body.courseSectionId,
        examType: body.examType,
        officialDate: officialDate,
        duration: body.duration,
        location: body.location,
        instructions: body.instructions,
        weight: body.weight || 30,
        earlyExamStatus,
        proposedDate,
        proposalDeadline,
      },
      include: { courseSection: { include: { course: true, semester: true } } },
    });

    res.status(201).json(examSchedule);
  });

  // Teacher: Get exam schedules for my section
  router.get('/teacher/sections/:id/exam-schedules', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    // Verify teacher owns this section
    const section = await prisma.courseSection.findFirst({
      where: { id: params.id, teacherId: user.id },
    });

    if (!section) {
      return res.status(404).json({ error: 'Course section not found' });
    }

    const examSchedules = await prisma.examSchedule.findMany({
      where: { courseSectionId: params.id },
      include: {
        courseSection: { include: { semester: true } },
        _count: { select: { earlyRequests: true } },
      },
      orderBy: { examType: 'asc' },
    });

    res.json(examSchedules);
  });

  // Teacher: Update exam schedule
  router.patch('/teacher/exam-schedules/:id', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      duration: z.number().int().min(1).optional(),
      location: z.string().optional(),
      instructions: z.string().optional(),
    }).parse(req.body);

    const user = req.user!;

    // Verify teacher owns this exam schedule
    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id },
      include: { courseSection: true },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found' });
    }

    const updated = await prisma.examSchedule.update({
      where: { id: params.id },
      data: body,
    });

    res.json(updated);
  });

  // Teacher: Propose early exam
  router.post('/teacher/exam-schedules/:id/propose-early', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      proposedDate: z.string(),
      proposalDeadline: z.string(),
    }).parse(req.body);

    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id },
      include: { courseSection: { include: { semester: true } } },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found' });
    }

    // Verify proposed date is before official date
    const proposedDate = new Date(body.proposedDate);
    if (exam.officialDate && proposedDate >= exam.officialDate) {
      return res.status(400).json({ error: 'Proposed date must be before the official exam date' });
    }

    const updated = await prisma.examSchedule.update({
      where: { id: params.id },
      data: {
        proposedDate: proposedDate,
        proposalDeadline: new Date(body.proposalDeadline),
        earlyExamStatus: 'PROPOSED',
      },
    });

    res.json(updated);
  });

  // Teacher: Cancel early exam proposal
  router.delete('/teacher/exam-schedules/:id/propose-early', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id },
      include: { courseSection: true },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found' });
    }

    await prisma.examSchedule.update({
      where: { id: params.id },
      data: {
        proposedDate: null,
        proposalDeadline: null,
        earlyExamStatus: 'NONE',
      },
    });

    // Delete all early exam requests
    await prisma.earlyExamRequest.deleteMany({
      where: { examScheduleId: params.id },
    });

    res.json({ message: 'Early exam proposal cancelled' });
  });

  // Teacher: Get early exam responses for an exam
  router.get('/teacher/exam-schedules/:id/early-responses', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id },
      include: { courseSection: true },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found' });
    }

    // Get all enrolled students and their responses
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { courseSectionId: exam.courseSectionId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
      },
    });

    const requests = await prisma.earlyExamRequest.findMany({
      where: { examScheduleId: params.id },
    });

    const requestMap = new Map(requests.map(r => [r.studentId, r]));

    const result = enrollments.map(e => ({
      student: e.student,
      hasResponded: requestMap.has(e.studentId),
      agreed: requestMap.get(e.studentId)?.agreed ?? null,
      respondedAt: requestMap.get(e.studentId)?.respondedAt ?? null,
    }));

    // Count agreed and disagreed
    const agreedCount = requests.filter(r => r.agreed).length;
    const disagreedCount = requests.filter(r => !r.agreed).length;
    const pendingCount = enrollments.length - requests.length;

    // Check if all students have agreed
    const allAgreed = enrollments.length > 0 && enrollments.every(e => {
      const req = requestMap.get(e.studentId);
      return req && req.agreed === true;
    });

    // Check if any student disagreed
    const anyDisagreed = requests.some(r => r.agreed === false);

    res.json({
      exam,
      totalStudents: enrollments.length,
      agreedCount,
      disagreedCount,
      pendingCount,
      allAgreed,
      anyDisagreed,
      students: result,
    });
  });

  // Teacher: Confirm early exam (when all students agreed)
  router.post('/teacher/exam-schedules/:id/confirm-early', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id, earlyExamStatus: 'PROPOSED' },
      include: { courseSection: true },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found or no early exam proposed' });
    }

    // Get all enrolled students
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { courseSectionId: exam.courseSectionId },
    });

    // Get all responses
    const requests = await prisma.earlyExamRequest.findMany({
      where: { examScheduleId: params.id },
    });

    // Check if all students have agreed
    const allAgreed = enrollments.length > 0 && enrollments.every(e =>
      requests.some(r => r.studentId === e.studentId && r.agreed === true)
    );

    if (!allAgreed) {
      return res.status(400).json({ error: 'Not all students have agreed to early exam' });
    }

    // Confirm early exam - use proposed date
    const updated = await prisma.examSchedule.update({
      where: { id: params.id },
      data: {
        earlyExamStatus: 'APPROVED',
        confirmedDate: exam.proposedDate,
      },
    });

    res.json({ message: 'Early exam confirmed', exam: updated });
  });

  // Teacher: Delete exam schedule
  router.delete('/teacher/exam-schedules/:id', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id },
      include: { courseSection: true },
    });

    if (!exam || exam.courseSection.teacherId !== user.id) {
      return res.status(404).json({ error: 'Exam schedule not found' });
    }

    await prisma.examSchedule.delete({ where: { id: params.id } });
    res.status(204).send();
  });

  // ==================== STUDENT EXAM VIEWING ====================

  // Student: Get exam schedules for my enrolled sections
  router.get('/student/exam-schedules', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;

    // Get student's enrollments
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId: user.id },
      select: { courseSectionId: true },
    });

    const sectionIds = enrollments.map(e => e.courseSectionId);

    const examSchedules = await prisma.examSchedule.findMany({
      where: { courseSectionId: { in: sectionIds } },
      include: {
        courseSection: {
          include: { course: true, semester: true },
        },
        _count: { select: { earlyRequests: true } },
      },
      orderBy: [{ examType: 'asc' }],
    });

    // Check if student has responded to early exam proposal for each
    const earlyRequests = await prisma.earlyExamRequest.findMany({
      where: {
        studentId: user.id,
        examScheduleId: { in: examSchedules.map(e => e.id) },
      },
    });

    const requestMap = new Map(earlyRequests.map(r => [r.examScheduleId, r]));

    const result = examSchedules.map(e => {
      // Determine the actual exam date
      let actualDate = e.confirmedDate || e.officialDate;
      if (e.earlyExamStatus === 'APPROVED' && e.proposedDate) {
        actualDate = e.proposedDate;
      }

      return {
        ...e,
        actualDate,
        myResponse: requestMap.get(e.id) || null,
      };
    });

    res.json(result);
  });

  // Student: Respond to early exam proposal (agree or disagree)
  router.post('/student/exam-schedules/:id/respond', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ agreed: z.boolean() }).parse(req.body);
    const user = req.user!;

    const exam = await prisma.examSchedule.findFirst({
      where: { id: params.id, earlyExamStatus: 'PROPOSED' },
      include: { courseSection: { include: { enrollments: true } } },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam schedule not found or no early exam proposed' });
    }

    // Check if student is enrolled
    const isEnrolled = exam.courseSection.enrollments.some(e => e.studentId === user.id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check if deadline has passed
    if (exam.proposalDeadline && new Date() > exam.proposalDeadline) {
      return res.status(400).json({ error: 'Response deadline has passed' });
    }

    // Create or update response
    const request = await prisma.earlyExamRequest.upsert({
      where: {
        examScheduleId_studentId: {
          examScheduleId: params.id,
          studentId: user.id,
        },
      },
      create: {
        examScheduleId: params.id,
        studentId: user.id,
        agreed: body.agreed,
        respondedAt: new Date(),
      },
      update: {
        agreed: body.agreed,
        respondedAt: new Date(),
      },
    });

    res.json(request);
  });

  // ==================== AUDIT LOGS (Admin) ====================

  // Admin: Get audit logs with filtering and pagination
  router.get('/admin/audit-logs', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      action: z.string().optional().or(z.literal('')),
      category: z.string().optional().or(z.literal('')),
      userId: z.string().optional().or(z.literal('')),
      search: z.string().optional().or(z.literal('')),
      startDate: z.string().optional().or(z.literal('')),
      endDate: z.string().optional().or(z.literal('')),
    }).parse(req.query);

    const where: any = {};
    if (query.action && query.action !== '') where.action = query.action;
    if (query.category && query.category !== '') where.category = query.category;
    if (query.userId && query.userId !== '') where.userId = query.userId;
    if (query.startDate && query.startDate !== '') where.createdAt = { ...where.createdAt, gte: new Date(query.startDate) };
    if (query.endDate && query.endDate !== '') where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };
    if (query.search && query.search !== '') where.description = { contains: query.search, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    });
  });
}
