// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

// Helper: Check if a course's semester (via its course sections) is IN_PROGRESS or GRADING
async function requireCourseSemesterInProgress(courseId: string): Promise<{ allowed: boolean; semesterStatus?: string }> {
  const section = await prisma.courseSection.findFirst({
    where: { courseId },
    include: { semester: { select: { id: true, status: true } } },
  });
  if (!section || !section.semester) return { allowed: false };
  return { allowed: section.semester.status === 'IN_PROGRESS' || section.semester.status === 'GRADING', semesterStatus: section.semester.status };
}

// Simple text similarity helpers (Levenshtein distance based)
function normalizeText(s: string | null | undefined) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function levenshtein(a: string, b: string) {
  const na = a.length, nb = b.length;
  if (na === 0) return nb;
  if (nb === 0) return na;
  const v0 = new Array(nb + 1).fill(0);
  const v1 = new Array(nb + 1).fill(0);
  for (let j = 0; j <= nb; j++) v0[j] = j;
  for (let i = 0; i < na; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < nb; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= nb; j++) v0[j] = v1[j];
  }
  return v1[nb];
}

function similarityScore(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / Math.max(na.length, nb.length));
}
export function registerAssessmentRoutes(router: Router) {
  router.post(
    '/courses/:courseId/assessments',
    authRequired,
    requireRole(['TEACHER']),
    async (req: AuthedRequest, res: Response) => {
      try {
      const params = z.object({ courseId: z.string() }).parse(req.params);
      const body = z.object({
        title: z.string().min(2),
        examType: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT']).optional(),
        deliveryMode: z.enum(['ONLINE', 'PAPER', 'MIXED']).optional(),
        timeLimit: z.number().int().positive().optional(),
        maxScore: z.number().int().positive().optional(),
        componentId: z.string().optional(),
      }).parse(req.body);

      // Check if teacher is assigned to this course through CourseSection or CourseClass
      const courseSection = await prisma.courseSection.findFirst({
        where: { courseId: params.courseId, teacherId: req.user!.id },
        include: { course: true },
      });
      const courseClass = await prisma.courseClass.findFirst({
        where: { courseId: params.courseId, teacherId: req.user!.id },
        include: { course: true },
      });

      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // If componentId provided, derive maxScore from component weight (ignore client-provided maxScore)
      let maxScore = body.maxScore ?? 100;
      if (body.componentId) {
        const component = await prisma.gradeComponent.findUnique({ where: { id: body.componentId } });
        if (component) {
          maxScore = component.weight;
        }
      }

      const assessment = await prisma.assessment.create({
        data: {
          courseId: params.courseId,
          title: body.title,
          examType: body.examType ?? 'QUIZ',
          deliveryMode: body.deliveryMode ?? 'ONLINE',
          timeLimit: body.timeLimit,
          maxScore,
          componentId: body.componentId || null,
        },
      });

      // Notify all students enrolled in this teacher's course
      const teacherSection = courseSection || courseClass;
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          courseSectionId: courseSection?.id,
          status: 'ENROLLED',
        },
        select: { studentId: true },
      });

      // Also get students from courseClass if applicable
      let classStudentIds: string[] = [];
      if (courseClass) {
        const classStudents = await prisma.classStudent.findMany({
          where: { courseClassId: courseClass.id },
          select: { studentId: true },
        });
        classStudentIds = classStudents.map(cs => cs.studentId);
      }

      const allStudentIds = [...new Set([
        ...enrollments.map(e => e.studentId),
        ...classStudentIds,
      ])];

      if (allStudentIds.length > 0) {
        const courseTitle = courseSection?.course?.title || courseClass?.course?.title || 'your course';
        const isPaper = body.deliveryMode === 'PAPER' || body.deliveryMode === 'MIXED';
        const isOnlineExam = body.deliveryMode === 'ONLINE_EXAM';
        const examLabel = isPaper ? 'paper ' + (body.examType?.toLowerCase() || 'exam') : isOnlineExam ? 'online ' + (body.examType?.toLowerCase() || 'exam') : (body.examType?.toLowerCase() || 'quiz');
        await prisma.notification.createMany({
          data: allStudentIds.map(studentId => ({
            userId: studentId,
            type: 'NEW_ASSESSMENT',
            title: isPaper ? 'Paper Exam Scheduled' : isOnlineExam ? 'Online Exam Scheduled' : 'New Assessment Available',
            message: `A ${examLabel} "${body.title}" has been scheduled for ${courseTitle}.${isPaper ? ' This is a paper-based exam — your teacher will enter your results after the exam.' : isOnlineExam ? ' This is a proctored online exam — make sure you are ready before starting.' : ''}`,
          })),
        });
      }

      res.json(assessment);
      } catch (err: any) {
        console.error('Create assessment error:', err);
        res.status(500).json({ error: 'Failed to create assessment', message: err?.message || String(err) });
      }
    },
  );

  router.post(
    '/assessments/:assessmentId/questions',
    authRequired,
    requireRole(['TEACHER']),
    async (req: AuthedRequest, res: Response) => {
      try {
      const params = z.object({ assessmentId: z.string() }).parse(req.params);
      const body = z.object({
        type: z.enum(['MCQ', 'FITB', 'SHORT_ANSWER']).default('MCQ'),
        prompt: z.string().min(1),
        // MCQ fields
        optionA: z.string().min(1).optional().or(z.literal('')),
        optionB: z.string().min(1).optional().or(z.literal('')),
        optionC: z.string().min(1).optional().or(z.literal('')),
        optionD: z.string().min(1).optional().or(z.literal('')),
        correct: z.enum(['A', 'B', 'C', 'D']).optional(),
        // FITB field
        correctAnswer: z.string().min(1).optional().or(z.literal('')),
        // Short answer field
        modelAnswer: z.string().min(1).optional().or(z.literal('')),
        points: z.number().int().positive().optional(),
      }).parse(req.body);

      const assessment = await prisma.assessment.findUnique({ where: { id: params.assessmentId }, include: { course: { include: { courseSections: true, courseClasses: true } } } });
      if (!assessment) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Check if teacher is assigned to this course through CourseSection or CourseClass
      const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
      const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Validate required fields based on type
      if (body.type === 'MCQ') {
        if (!body.optionA || !body.optionB || !body.optionC || !body.optionD || !body.correct) {
          res.status(400).json({ error: 'MCQ requires options A-D and correct answer' });
          return;
        }
      } else if (body.type === 'FITB') {
        if (!body.correctAnswer) {
          res.status(400).json({ error: 'FITB requires correctAnswer' });
          return;
        }
      } else if (body.type === 'SHORT_ANSWER') {
        if (!body.modelAnswer) {
          res.status(400).json({ error: 'SHORT_ANSWER requires modelAnswer' });
          return;
        }
      }

      const question = await prisma.question.create({
        data: {
          assessmentId: params.assessmentId,
          type: body.type,
          prompt: body.prompt,
          optionA: body.optionA,
          optionB: body.optionB,
          optionC: body.optionC,
          optionD: body.optionD,
          correct: body.correct,
          correctAnswer: body.correctAnswer,
          modelAnswer: body.modelAnswer,
          points: body.points ?? 1,
        },
      });

      res.json(question);
      } catch (err: any) {
        console.error('Create question error:', err);
        res.status(500).json({ error: 'Failed to create question', message: err?.message || String(err) });
      }
    },
  );

  // Get questions for an assessment
  router.get('/assessments/:assessmentId/questions', authRequired, async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ assessmentId: z.string() }).parse(req.params);
      const assessment = await prisma.assessment.findUnique({
        where: { id: params.assessmentId },
        include: {
          course: {
            include: {
              courseSections: { include: { enrollments: true, teacher: true } },
              courseClasses: true,
            },
          },
        },
      });

      if (!assessment) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const user = req.user!;
      const isAdmin = user.role === 'ADMIN';
      const isTeacher = assessment.course.courseSections.some((s: { teacherId: string | null }) => s.teacherId === user.id) || assessment.course.courseClasses.some((c: { teacherId: string | null }) => c.teacherId === user.id);
      const isStudent = assessment.course.courseSections.some((s: { enrollments: { studentId: string }[] }) =>
        s.enrollments.some((e: { studentId: string }) => e.studentId === user.id)
      );

      if (!isAdmin && !isTeacher && !isStudent) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const questions = await prisma.question.findMany({
        where: { assessmentId: params.assessmentId },
        orderBy: { createdAt: 'asc' },
      });

      res.json(questions);
    } catch (err: any) {
      console.error('Get assessment questions error:', err);
      res.status(500).json({ error: 'Failed to load assessment questions', message: err?.message || String(err) });
    }
  });

  // Update question (Teacher only)
  router.put('/questions/:questionId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ questionId: z.string() }).parse(req.params);
      const body = z.object({
        type: z.enum(['MCQ', 'FITB', 'SHORT_ANSWER']).optional(),
        prompt: z.string().min(1).optional(),
        optionA: z.string().min(1).optional().or(z.literal('')).optional(),
        optionB: z.string().min(1).optional().or(z.literal('')).optional(),
        optionC: z.string().min(1).optional().or(z.literal('')).optional(),
        optionD: z.string().min(1).optional().or(z.literal('')).optional(),
        correct: z.enum(['A', 'B', 'C', 'D']).optional(),
        correctAnswer: z.string().min(1).optional().or(z.literal('')).optional(),
        modelAnswer: z.string().min(1).optional().or(z.literal('')).optional(),
        points: z.number().int().positive().optional(),
      }).parse(req.body);

      const question = await prisma.question.findUnique({
        where: { id: params.questionId },
        include: { assessment: { include: { course: { include: { courseSections: true, courseClasses: true } } } } },
      });

      if (!question) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Check if teacher is assigned to this course
      const courseSection = question.assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
      const courseClass = question.assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Don't allow editing if assessment has submitted attempts
      const attemptCount = await prisma.attempt.count({
        where: { assessmentId: question.assessmentId, status: { in: ['SUBMITTED', 'GRADED'] } },
      });
      if (attemptCount > 0) {
        res.status(400).json({ error: 'has_submissions', message: 'Cannot edit questions after students have submitted attempts' });
        return;
      }

      const updated = await prisma.question.update({
        where: { id: params.questionId },
        data: body,
      });

      res.json(updated);
    } catch (err: any) {
      console.error('Update question error:', err);
      res.status(500).json({ error: 'Failed to update question', message: err?.message || String(err) });
    }
  });

  // Delete question (Teacher only)
  router.delete('/questions/:questionId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ questionId: z.string() }).parse(req.params);

      const question = await prisma.question.findUnique({
        where: { id: params.questionId },
        include: { assessment: { include: { course: { include: { courseSections: true, courseClasses: true } } } } },
      });

      if (!question) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Check if teacher is assigned to this course
      const courseSection = question.assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
      const courseClass = question.assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Don't allow deleting if assessment has submitted attempts
      const attemptCount = await prisma.attempt.count({
        where: { assessmentId: question.assessmentId, status: { in: ['SUBMITTED', 'GRADED'] } },
      });
      if (attemptCount > 0) {
        res.status(400).json({ error: 'has_submissions', message: 'Cannot delete questions after students have submitted attempts' });
        return;
      }

      // Delete answers for this question first
      await prisma.answer.deleteMany({ where: { questionId: params.questionId } });
      await prisma.question.delete({ where: { id: params.questionId } });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete question error:', err);
      res.status(500).json({ error: 'Failed to delete question', message: err?.message || String(err) });
    }
  });

  router.get('/courses/:courseId/assessments', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    const course = await prisma.course.findUnique({
      where: { id: params.courseId },
      include: {
        courseSections: {
          include: {
            class: { include: { students: true, teachers: true } },
            teacher: true,
            enrollments: { where: { status: 'ENROLLED' } },
          },
        },
        courseClasses: true,
      },
    });

    if (!course) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const user = req.user!;

    // Check access: admin, teacher assigned to this course, or student enrolled in this course
    const isAdmin = user.role === 'ADMIN';
    const isTeacher = course.courseSections.some((s: { teacherId: string | null }) => s.teacherId === user.id) || course.courseClasses.some((c: { teacherId: string | null }) => c.teacherId === user.id);
    const isStudent = course.courseSections.some((s: { enrollments: { studentId: string }[] }) =>
      s.enrollments.some((e: { studentId: string }) => e.studentId === user.id)
    );

    if (!isAdmin && !isTeacher && !isStudent) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const assessments = await prisma.assessment.findMany({
      where: { courseId: params.courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
        questions: { select: { points: true } },
      },
    });
    const result = assessments.map(a => ({
      ...a,
      totalPoints: a.questions.reduce((sum: number, q: { points: number }) => sum + q.points, 0),
      questionCount: a._count.questions,
      questions: undefined,
    }));
    res.json(result);
  });

  // Toggle assessment open/closed status (Teacher only)
  router.patch('/assessments/:assessmentId/open', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string() }).parse(req.params);
    const body = z.object({ isOpen: z.boolean() }).parse(req.body);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } }, questions: true },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if teacher is assigned to this course through CourseSection or CourseClass
    const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
    const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Check semester is IN_PROGRESS before allowing assessment open
    if (body.isOpen) {
      const { allowed, semesterStatus } = await requireCourseSemesterInProgress(assessment.courseId);
      if (!allowed) {
        res.status(403).json({ error: 'Semester not in progress', message: `Cannot open assessment. Semester status is ${semesterStatus || 'unknown'}. Wait for admin to start the semester.`, semesterStatus });
        return;
      }
    }

    // If opening the exam, validate that total question points match maxScore
    if (body.isOpen) {
      const totalPoints = assessment.questions.reduce((sum: number, q: { points: number }) => sum + q.points, 0);
      if (totalPoints !== assessment.maxScore) {
        res.status(400).json({
          error: 'points_mismatch',
          message: `Cannot open exam: total question points (${totalPoints}) must equal the max score (${assessment.maxScore}). ${assessment.questions.length} question(s) added.`,
        });
        return;
      }
    }

    const updated = await prisma.assessment.update({
      where: { id: params.assessmentId },
      data: { isOpen: body.isOpen },
    });

    // Notify enrolled students when assessment is opened
    if (body.isOpen) {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { courseSection: { courseId: assessment.courseId }, status: 'ENROLLED' },
        select: { studentId: true },
      });
      if (enrollments.length > 0) {
        const examLabel = assessment.examType === 'MIDTERM' ? 'Midterm' : assessment.examType === 'FINAL' ? 'Final' : assessment.examType === 'QUIZ' ? 'Quiz' : assessment.examType === 'ASSIGNMENT' ? 'Assignment' : 'Assessment';
        await prisma.notification.createMany({
          data: enrollments.map(e => ({
            userId: e.studentId,
            type: 'ASSESSMENT_OPENED',
            title: `${examLabel} Now Available`,
            message: `"${assessment.title}" is now open. You can start your ${examLabel.toLowerCase()} now.`,
            data: { assessmentId: assessment.id, courseId: assessment.courseId },
          })),
        });
      }
    }

    res.json(updated);
  });

  // Update assessment (Teacher only)
  router.put('/assessments/:assessmentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string() }).parse(req.params);
    const body = z.object({
      title: z.string().min(2).optional(),
      examType: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT']).optional(),
      timeLimit: z.number().int().positive().nullable().optional(),
      maxScore: z.number().int().positive().optional(),
    }).parse(req.body);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } } },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if teacher is assigned to this course through CourseSection or CourseClass
    const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
    const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Prevent updating maxScore directly if this assessment is linked to a grade component.
    const updateData: any = { ...body };
    if (assessment.componentId) {
      delete updateData.maxScore;
    }

    const updated = await prisma.assessment.update({
      where: { id: params.assessmentId },
      data: updateData,
    });

    res.json(updated);
  });

  // Delete assessment (Teacher only)
  router.delete('/assessments/:assessmentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string() }).parse(req.params);

    try {
      const assessment = await prisma.assessment.findUnique({
        where: { id: params.assessmentId },
        include: { course: { include: { courseSections: true, courseClasses: true } } },
      });

      if (!assessment) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Check if teacher is assigned to this course through CourseSection or CourseClass
      const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
      const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Delete related records first (attempts, answers, manual grades, questions)
      await prisma.$transaction(async (tx) => {
        // Get all attempt IDs for this assessment
        const attempts = await tx.attempt.findMany({
          where: { assessmentId: params.assessmentId },
          select: { id: true },
        });
        const attemptIds = attempts.map(a => a.id);

        // Delete answers for these attempts
        if (attemptIds.length > 0) {
          await tx.answer.deleteMany({
            where: { attemptId: { in: attemptIds } },
          });
          
          // Delete face verifications for these attempts
          await tx.faceVerification.deleteMany({
            where: { attemptId: { in: attemptIds } },
          });
        }

        // Delete attempts
        await tx.attempt.deleteMany({
          where: { assessmentId: params.assessmentId },
        });

        // Delete manual grades
        await tx.manualGrade.deleteMany({
          where: { assessmentId: params.assessmentId },
        });

        // Delete questions
        await tx.question.deleteMany({
          where: { assessmentId: params.assessmentId },
        });

        // Delete the assessment
        await tx.assessment.delete({
          where: { id: params.assessmentId },
        });
      });

      res.json({ success: true, message: 'Assessment deleted successfully' });
    } catch (err: any) {
      console.error('Delete assessment error:', err);
      const errorMessage = err?.message || String(err) || 'Unknown error';
      res.status(500).json({ error: 'Failed to delete assessment', message: errorMessage });
    }
  });

  // Get all manual grades for an assessment (Teacher only)
  router.get('/assessments/:assessmentId/manual-grades', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string() }).parse(req.params);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } } },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if teacher is assigned to this course through CourseSection or CourseClass
    const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
    const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const grades = await prisma.manualGrade.findMany({
      where: { assessmentId: params.assessmentId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });

    res.json(grades);
  });

  // Create or update manual grade (Teacher only)
  router.put('/assessments/:assessmentId/manual-grades/:studentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string(), studentId: z.string() }).parse(req.params);
    const body = z.object({
      score: z.number().int().min(0),
      feedback: z.string().optional(),
    }).parse(req.body);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } } },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if teacher is assigned to this course through CourseSection or CourseClass
    const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
    const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Check semester is IN_PROGRESS
    const { allowed, semesterStatus } = await requireCourseSemesterInProgress(assessment.courseId);
    if (!allowed) {
      res.status(403).json({ error: 'Semester not in progress', message: `Cannot grade. Semester status is ${semesterStatus || 'unknown'}.`, semesterStatus });
      return;
    }

    // Validate score doesn't exceed maxScore
    if (body.score > assessment.maxScore) {
      res.status(400).json({ error: 'score_exceeds_max', message: `Score cannot exceed ${assessment.maxScore}` });
      return;
    }

    const grade = await prisma.manualGrade.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: params.assessmentId,
          studentId: params.studentId,
        },
      },
      update: {
        score: body.score,
        feedback: body.feedback,
      },
      create: {
        assessmentId: params.assessmentId,
        studentId: params.studentId,
        score: body.score,
        feedback: body.feedback,
      },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });

    res.json(grade);
  });

  // Delete manual grade (Teacher only)
  router.delete('/assessments/:assessmentId/manual-grades/:studentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string(), studentId: z.string() }).parse(req.params);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } } },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if teacher is assigned to this course through CourseSection or CourseClass
    const courseSection = assessment.course.courseSections.find((s: { teacherId: string | null }) => s.teacherId === req.user!.id);
    const courseClass = assessment.course.courseClasses.find((c: { teacherId: string | null }) => c.teacherId === req.user!.id);
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    await prisma.manualGrade.delete({
      where: {
        assessmentId_studentId: {
          assessmentId: params.assessmentId,
          studentId: params.studentId,
        },
      },
    });

    res.json({ success: true });
  });

  router.post('/assessments/:assessmentId/attempts', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ assessmentId: z.string() }).parse(req.params);

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: {
        course: {
          include: {
            courseSections: {
              include: {
                enrollments: { where: { status: 'ENROLLED' } },
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check if assessment is open for students
    if (!assessment.isOpen) {
      res.status(403).json({ error: 'assessment_closed', message: 'This assessment is not yet open for students' });
      return;
    }

    // Check if student is enrolled in this course
    const isEnrolled = assessment.course.courseSections.some((s: { enrollments: { studentId: string }[] }) =>
      s.enrollments.some((e: { studentId: string }) => e.studentId === req.user!.id)
    );

    if (!isEnrolled) {
      res.status(403).json({ error: 'not_enrolled' });
      return;
    }

    // Check if student already has any attempt for this assessment (submitted or in progress)
    const existingAttempt = await prisma.attempt.findFirst({
      where: {
        assessmentId: params.assessmentId,
        studentId: req.user!.id,
      },
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'IN_PROGRESS') {
        // Return the existing in-progress attempt instead of creating a new one
        res.json(existingAttempt);
        return;
      }
      res.status(400).json({ error: 'already_submitted', message: 'You have already submitted this assessment' });
      return;
    }

    const attempt = await prisma.attempt.create({
      data: {
        assessmentId: params.assessmentId,
        studentId: req.user!.id,
      },
    });

    res.json(attempt);
  });

  router.get('/attempts/:attemptId', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ attemptId: z.string() }).parse(req.params);

    const attempt = await prisma.attempt.findUnique({
      where: { id: params.attemptId },
      include: {
        assessment: { include: { questions: true } },
        answers: true,
      },
    });

    if (!attempt) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const user = req.user!;
    const isOwner = user.role === 'STUDENT' && attempt.studentId === user.id;
    const isTeacher = user.role === 'TEACHER' && attempt.assessment.courseId;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isTeacher && !isAdmin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    res.json(attempt);
  });

  router.patch('/attempts/:attemptId/answers', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ attemptId: z.string() }).parse(req.params);
    const body = z.object({
      questionId: z.string(),
      selected: z.enum(['A', 'B', 'C', 'D']).optional(),      // For MCQ
      textAnswer: z.string().optional(),                       // For FITB and SHORT_ANSWER
    }).parse(req.body);

    const attempt = await prisma.attempt.findUnique({ where: { id: params.attemptId } });
    if (!attempt || attempt.studentId !== req.user!.id || attempt.status !== 'IN_PROGRESS') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const answer = await prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId: params.attemptId, questionId: body.questionId } },
      update: {
        selected: body.selected,
        textAnswer: body.textAnswer,
      },
      create: {
        attemptId: params.attemptId,
        questionId: body.questionId,
        selected: body.selected,
        textAnswer: body.textAnswer,
      },
    });

    res.json(answer);
  });

  router.post('/attempts/:attemptId/submit', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ attemptId: z.string() }).parse(req.params);

    try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.attemptId },
      include: { answers: true, assessment: { include: { questions: true } }, faceVerification: true },
    });

    if (!attempt || attempt.studentId !== req.user!.id || attempt.status !== 'IN_PROGRESS') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Check if there's an unreviewed face mismatch or rejected face
    const hasPendingFaceMismatch = attempt.faceVerification && !attempt.faceVerification.matchResult && !attempt.faceVerification.adminReviewed;
    const hasRejectedFace = attempt.faceVerification && !attempt.faceVerification.matchResult && attempt.faceVerification.adminReviewed && !attempt.faceVerification.adminApproved;

    // If face was rejected, mark attempt as REJECTED with no score
    if (hasRejectedFace) {
      const updated = await prisma.attempt.update({
        where: { id: params.attemptId },
        data: { status: 'REJECTED', submittedAt: new Date(), score: 0 },
      });
      return res.json({ ...updated, hasRejectedFace: true });
    }

    // Auto-grade for matched faces and pending review

    // Build question map with all needed fields
    const questionMap = new Map<string, { id: string; type: string; correct: string | null; correctAnswer: string | null; modelAnswer: string | null; points: number }>(
      attempt.assessment.questions.map((q: { id: string; type: string; correct: string | null; correctAnswer: string | null; modelAnswer: string | null; points: number }) => [q.id, {
        id: q.id,
        type: q.type,
        correct: q.correct,
        correctAnswer: q.correctAnswer,
        modelAnswer: q.modelAnswer,
        points: q.points,
      }]),
    );

    let autoScore = 0;
    let hasManualGrading = false;

    // Auto-grade all answers and update Answer records
    for (const ans of attempt.answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      let score = 0;
      let isCorrect = false;

      if (q.type === 'MCQ') {
        // Auto-grade MCQ
        isCorrect = ans.selected === q.correct;
        score = isCorrect ? q.points : 0;
        autoScore += score;
      } else if (q.type === 'FITB') {
        // Auto-grade FITB using fuzzy similarity to allow minor typos and alternatives
        if (ans.textAnswer && q.correctAnswer) {
          const studentAns = ans.textAnswer;
          // support multiple acceptable answers separated by '||'
          const alternatives = String(q.correctAnswer).split('||').map(s => s.trim()).filter(Boolean);
          const bestSim = alternatives.length > 0
            ? Math.max(...alternatives.map(a => similarityScore(studentAns, a)))
            : similarityScore(studentAns, q.correctAnswer as string);
          // full credit threshold; below that award proportional score
          const fullThreshold = 0.9;
          if (bestSim >= fullThreshold) {
            isCorrect = true;
            score = q.points;
          } else {
            isCorrect = false;
            score = Math.round(bestSim * q.points);
          }
          autoScore += score;
        }
      } else if (q.type === 'TRUE_FALSE') {
        // Auto-grade TRUE_FALSE
        isCorrect = ans.selected === q.correct;
        score = isCorrect ? q.points : 0;
        autoScore += score;
      } else if (q.type === 'SHORT_ANSWER') {
        // Auto-grade SHORT_ANSWER using similarity to the modelAnswer when available
        if (ans.textAnswer && ans.textAnswer.trim().length > 0) {
          if (q.modelAnswer) {
            const sim = similarityScore(ans.textAnswer, q.modelAnswer);
            const fullThreshold = 0.85;
            if (sim >= fullThreshold) {
              isCorrect = true;
              score = q.points;
            } else if (sim >= 0.25) {
              isCorrect = false;
              score = Math.round(sim * q.points);
            } else {
              isCorrect = false;
              score = 0;
            }
          } else {
            // no model answer provided - award full points for any substantive response
            isCorrect = true;
            score = q.points;
          }
          autoScore += score;
        } else {
          isCorrect = false;
          score = 0;
        }
      }

      // Update answer with score
      await prisma.answer.update({
        where: { id: ans.id },
        data: { score, isCorrect },
      });
    }

    // Mark as GRADED so score appears immediately, unless face verification issue
    // Store score as raw points out of maxScore, clamp to not exceed maxScore
    const maxScore = attempt.assessment?.maxScore ?? Array.from(questionMap.values()).reduce((s, q) => s + q.points, 0);
    const clampedScore = Math.min(autoScore, maxScore);
    const status = hasPendingFaceMismatch ? 'SUBMITTED' : 'GRADED';
    const updated = await prisma.attempt.update({
      where: { id: params.attemptId },
      data: { status, submittedAt: new Date(), score: clampedScore },
    });

    res.json({ ...updated, hasManualGrading, autoScore, hasPendingFaceMismatch, hasRejectedFace });
    } catch (err) {
      console.error('Submit attempt error:', err);
      res.status(500).json({ error: 'internal_error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // Teacher grades short answer questions
  router.post('/attempts/:attemptId/grade', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ attemptId: z.string() }).parse(req.params);
    const body = z.object({
      answers: z.array(z.object({
        answerId: z.string(),
        score: z.number().int().min(0),
        feedback: z.string().optional(),
      })),
    }).parse(req.body);

    const attempt = await prisma.attempt.findUnique({
      where: { id: params.attemptId },
      include: {
        assessment: {
          include: {
            course: {
              include: {
                courseSections: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Check semester is IN_PROGRESS
    const { allowed, semesterStatus } = await requireCourseSemesterInProgress(attempt.assessment.courseId);
    if (!allowed) {
      res.status(403).json({ error: 'Semester not in progress', message: `Cannot grade attempts. Semester status is ${semesterStatus || 'unknown'}.`, semesterStatus });
      return;
    }

    // Check if attempt has an unreviewed or rejected face mismatch
    const faceVerification = await prisma.faceVerification.findUnique({
      where: { attemptId: params.attemptId },
    });
    if (faceVerification && !faceVerification.matchResult) {
      if (!faceVerification.adminReviewed) {
        res.status(403).json({ error: 'face_mismatch_pending', message: 'This attempt has a pending face verification review. Grading is blocked until an admin confirms the student identity.' });
        return;
      }
      if (faceVerification.adminReviewed && !faceVerification.adminApproved) {
        res.status(403).json({ error: 'face_mismatch_rejected', message: 'This attempt\'s face verification was rejected by admin. Grading is blocked.' });
        return;
      }
    }

    // Check if teacher is assigned to this course
    const isTeacher = attempt.assessment.course.courseSections.some(
      (cc: { teacherId: string | null }) => cc.teacherId === req.user!.id
    ) || attempt.assessment.course.courseClasses?.some(
      (cc: { teacherId: string | null }) => cc.teacherId === req.user!.id
    );
    if (!isTeacher) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Update each answer's score and feedback, clamp to question points
    for (const a of body.answers) {
      const answer = await prisma.answer.findUnique({
        where: { id: a.answerId },
        include: { question: { select: { points: true } } },
      });
      const maxPoints = answer?.question?.points ?? 0;
      const clampedAnswerScore = Math.min(Math.max(0, a.score), maxPoints);
      await prisma.answer.update({
        where: { id: a.answerId },
        data: { score: clampedAnswerScore, feedback: a.feedback },
      });
    }

    // Recalculate total score, clamp to maxScore
    const answers = await prisma.answer.findMany({ where: { attemptId: params.attemptId } });
    const totalScore = answers.reduce((sum: number, a: { score: number | null }) => sum + (a.score ?? 0), 0);
    const maxScore = attempt.assessment?.maxScore ?? 0;
    const clampedScore = maxScore > 0 ? Math.min(totalScore, maxScore) : totalScore;

    const updated = await prisma.attempt.update({
      where: { id: params.attemptId },
      data: { status: 'GRADED', score: clampedScore },
    });

    res.json(updated);
  });
}
