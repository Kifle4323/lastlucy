// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

export function registerGradebookRoutes(router: Router) {
  // Get grade components for a course
  router.get('/courses/:courseId/grade-components', authRequired, async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    const components = await prisma.gradeComponent.findMany({
      where: { courseId: params.courseId },
      orderBy: { sortOrder: 'asc' },
    });

    // Also return legacy config for backward compat
    let config = await prisma.courseGradeConfig.findUnique({
      where: { courseId: params.courseId },
    });

    // If no components exist yet, seed from legacy config or defaults
    if (components.length === 0 && config) {
      const seeded = await Promise.all([
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Quiz', weight: config.quizWeight, sortOrder: 0 } }),
        config.assignmentWeight ? prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Assignment', weight: config.assignmentWeight, sortOrder: 1 } }) : null,
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Midterm', weight: config.midtermWeight, sortOrder: 2 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Final', weight: config.finalWeight, sortOrder: 3 } }),
        config.attendanceWeight ? prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Attendance', weight: config.attendanceWeight, sortOrder: 4 } }) : null,
      ].filter(Boolean));
      return res.json(seeded);
    }

    if (components.length === 0 && !config) {
      // Create defaults
      const defaults = await Promise.all([
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Quiz', weight: 15, sortOrder: 0 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Assignment', weight: 10, sortOrder: 1 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Midterm', weight: 25, sortOrder: 2 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Final', weight: 40, sortOrder: 3 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Attendance', weight: 10, sortOrder: 4 } }),
      ]);
      return res.json(defaults);
    }

    res.json(components);
  });

  // Add a grade component
  router.post('/courses/:courseId/grade-components', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1),
      weight: z.number().int().min(0).max(100),
    }).parse(req.body);

    // Verify teacher
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Validate total weight
    const existing = await prisma.gradeComponent.findMany({ where: { courseId: params.courseId } });
    const totalWeight = existing.reduce((sum, c) => sum + c.weight, 0) + body.weight;
    if (totalWeight > 100) {
      res.status(400).json({ error: 'invalid_weights', message: `Total weight would be ${totalWeight}%, max is 100%` });
      return;
    }

    const component = await prisma.gradeComponent.create({
      data: { courseId: params.courseId, name: body.name, weight: body.weight, sortOrder: existing.length },
    });

    res.json(component);
  });

  // Update a grade component
  router.patch('/courses/:courseId/grade-components/:componentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string(), componentId: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      weight: z.number().int().min(0).max(100).optional(),
    }).parse(req.body);

    // Verify teacher
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Validate total weight if weight changed
    if (body.weight !== undefined) {
      const existing = await prisma.gradeComponent.findMany({ where: { courseId: params.courseId, id: { not: params.componentId } } });
      const totalWeight = existing.reduce((sum, c) => sum + c.weight, 0) + body.weight;
      if (totalWeight > 100) {
        res.status(400).json({ error: 'invalid_weights', message: `Total weight would be ${totalWeight}%, max is 100%` });
        return;
      }
    }

    const component = await prisma.gradeComponent.update({
      where: { id: params.componentId },
      data: body,
    });

    // If weight changed, sync linked assessments' maxScore to the new weight
    if (body.weight !== undefined) {
      await prisma.assessment.updateMany({
        where: { componentId: params.componentId },
        data: { maxScore: body.weight },
      });
    }

    res.json(component);
  });

  // Delete a grade component
  router.delete('/courses/:courseId/grade-components/:componentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string(), componentId: z.string() }).parse(req.params);

    // Verify teacher
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Unlink assessments from this component
    await prisma.assessment.updateMany({
      where: { componentId: params.componentId },
      data: { componentId: null },
    });

    await prisma.gradeComponent.delete({ where: { id: params.componentId } });
    res.json({ success: true });
  });

  // Get attendance for a course (all students)
  router.get('/courses/:courseId/attendance', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    // Verify teacher teaches this course through CourseSection or CourseClass
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });

    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const attendance = await prisma.attendance.findMany({
      where: { courseId: params.courseId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });

    res.json(attendance);
  });

  // Set attendance for a student
  router.put('/courses/:courseId/attendance/:studentId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    try {
      const params = z.object({ courseId: z.string(), studentId: z.string() }).parse(req.params);
      const body = z.object({
        score: z.number().int().min(0).max(100),
        feedback: z.union([z.string(), z.null()]).optional(),
      }).parse(req.body);

      // Verify teacher teaches this course through CourseSection or CourseClass
      const courseSection = await prisma.courseSection.findFirst({
        where: { courseId: params.courseId, teacherId: req.user!.id },
      });
      const courseClass = await prisma.courseClass.findFirst({
        where: { courseId: params.courseId, teacherId: req.user!.id },
      });

      if (!courseSection && !courseClass) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const attendance = await prisma.attendance.upsert({
        where: {
          courseId_studentId: {
            courseId: params.courseId,
            studentId: params.studentId,
          },
        },
        update: { score: body.score, ...(body.feedback !== undefined && { feedback: body.feedback }) },
        create: {
          courseId: params.courseId,
          studentId: params.studentId,
          score: body.score,
          ...(body.feedback !== undefined && { feedback: body.feedback }),
        },
      });

      res.json(attendance);
    } catch (error) {
      console.error('Attendance save error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Get complete gradebook for a course (teacher view)
  router.get('/courses/:courseId/gradebook', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    // Verify teacher teaches this course through CourseSection or CourseClass
    const courseSection = await prisma.courseSection.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });
    const courseClass = await prisma.courseClass.findFirst({
      where: { courseId: params.courseId, teacherId: req.user!.id },
    });

    if (!courseSection && !courseClass) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Get grade components (dynamic weights)
    const components = await prisma.gradeComponent.findMany({
      where: { courseId: params.courseId },
      orderBy: { sortOrder: 'asc' },
    });

    // If no components, seed defaults
    if (components.length === 0) {
      const seeded = await Promise.all([
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Quiz', weight: 15, sortOrder: 0 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Assignment', weight: 10, sortOrder: 1 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Midterm', weight: 25, sortOrder: 2 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Final', weight: 40, sortOrder: 3 } }),
        prisma.gradeComponent.create({ data: { courseId: params.courseId, name: 'Attendance', weight: 10, sortOrder: 4 } }),
      ]);
      components.push(...seeded);
    }

    // Legacy config for backward compat
    const config = await prisma.courseGradeConfig.findUnique({
      where: { courseId: params.courseId },
    }) || { quizWeight: 15, assignmentWeight: 10, midtermWeight: 25, finalWeight: 40, attendanceWeight: 10 };

    // Get students enrolled in this teacher's course sections only
    const sections = await prisma.courseSection.findMany({
      where: { courseId: params.courseId, teacherId: req.user!.id },
      include: {
        class: true,
        enrollments: {
          where: { status: 'ENROLLED' },
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });

    // Also get students from course classes (only this teacher's)
    const courseClasses = await prisma.courseClass.findMany({
      where: { courseId: params.courseId, teacherId: req.user!.id },
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

    // Flatten students from all sections
    const sectionStudents = sections.flatMap(section =>
      section.enrollments.map(e => ({
        ...e.student,
        classId: section.classId,
        className: section.class?.name || 'No Class',
        sectionCode: section.sectionCode,
      }))
    );

    // Flatten students from course classes
    type CourseClassWithStudents = {
      classId: string;
      class: {
        id: string;
        name: string;
        students: { student: { id: string; fullName: string; email: string } }[];
      };
    };
    const classStudents = (courseClasses as CourseClassWithStudents[]).flatMap(cc =>
      cc.class.students.map(s => ({
        ...s.student,
        classId: cc.classId,
        className: cc.class.name,
        sectionCode: '',
      }))
    );

    // Merge and remove duplicates
    const allStudents = [...sectionStudents, ...classStudents];
    type StudentWithClass = { id: string; fullName: string; email: string; classId: string | null; className: string; sectionCode: string };
    const uniqueStudents = allStudents.reduce<StudentWithClass[]>((acc, student) => {
      if (!acc.find(s => s.id === student.id)) {
        acc.push(student);
      }
      return acc;
    }, []);

    // Get all assessments for this course
    const assessments = await prisma.assessment.findMany({
      where: { courseId: params.courseId },
      include: {
        questions: true,
        attempts: {
          where: { status: 'GRADED' },
          include: { student: { select: { id: true } } },
        },
        manualGrades: true,
      },
    });

    // Define types for the assessment data
    type AttemptType = { studentId: string; status: string; score: number | null };
    type ManualGradeType = { studentId: string; score: number };
    type AssessmentType = {
      id: string;
      title: string;
      examType: string;
      maxScore: number | null;
      questions: unknown[];
      attempts: AttemptType[];
      manualGrades: ManualGradeType[];
    };
    const typedAssessments = assessments as AssessmentType[];

    // Get attendance
    const attendance = await prisma.attendance.findMany({
      where: { courseId: params.courseId },
    });
    type AttendanceType = { studentId: string; score: number };
    const typedAttendance = attendance as AttendanceType[];

    // Calculate grades for each student using dynamic components
    const gradebook = uniqueStudents.map(student => {
      // Calculate per-component scores
      const componentMarks: Record<string, number> = {};
      const componentPercentages: Record<string, number> = {};
      let totalGrade = 0;

      for (const component of components) {
        if (component.name === 'Attendance') {
          // Attendance is stored as percentage (0-100)
          const studentAttendance = typedAttendance.find(a => a.studentId === student.id);
          const attendancePercent = Math.round((studentAttendance?.score || 0) * 10) / 10;
          const weightedMark = Math.round(attendancePercent * component.weight / 100 * 10) / 10;
          componentMarks[component.id] = weightedMark;
          componentPercentages[component.id] = attendancePercent;
          totalGrade += weightedMark;
        } else {
          // Get assessments linked to this component
          const componentAssessments = typedAssessments.filter(a =>
            a.componentId === component.id
          );

          if (componentAssessments.length > 0) {
            // Average of all assessments in this component
            let score = 0;
            let count = 0;
            for (const assessment of componentAssessments) {
              const attempt = assessment.attempts.find(at => at.studentId === student.id && at.status === 'GRADED');
              if (attempt && attempt.score !== null && assessment.maxScore) {
                score += (attempt.score / assessment.maxScore) * 100;
                count++;
              } else {
                const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === student.id);
                if (manualGrade && assessment.maxScore) {
                  score += (manualGrade.score / assessment.maxScore) * 100;
                  count++;
                }
              }
            }
            if (count > 0) {
              const avg = score / count;
              const percent = Math.round(avg * 10) / 10;
              const mark = Math.round(avg * component.weight / 100 * 10) / 10;
              componentMarks[component.id] = mark;
              componentPercentages[component.id] = percent;
              totalGrade += mark;
            }
          } else {
            // No assessments linked yet - match by examType to component name
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
            const nameMatch = typedAssessments.filter(a => 
              a.examType === component.name.toUpperCase().replace(/\s+/g, '_') ||
              matchingTypes.includes(a.examType)
            );

            let legacyScore: number | null = null;
            if (nameMatch.length > 0) {
              let score = 0, count = 0;
              for (const assessment of nameMatch) {
                const attempt = assessment.attempts.find(at => at.studentId === student.id && at.status === 'GRADED');
                if (attempt && attempt.score !== null && assessment.maxScore) {
                  score += (attempt.score / assessment.maxScore) * 100;
                  count++;
                } else {
                  const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === student.id);
                  if (manualGrade && assessment.maxScore) {
                    score += (manualGrade.score / assessment.maxScore) * 100;
                    count++;
                  }
                }
              }
              if (count > 0) {
                legacyScore = score / count;
              }
            }
            if (legacyScore !== null) {
              const percent = Math.round(legacyScore * 10) / 10;
              const mark = Math.round(legacyScore * component.weight / 100 * 10) / 10;
              componentMarks[component.id] = mark;
              componentPercentages[component.id] = percent;
              totalGrade += mark;
            }
          }
        }
      }

      return {
        student,
        componentMarks,
        componentPercentages,
        totalGrade: Math.round(totalGrade * 10) / 10,
      };
    });

    res.json({
      components,
      config,
      gradebook,
      assessments: typedAssessments.map(a => ({
        id: a.id,
        title: a.title,
        examType: a.examType,
        maxScore: a.maxScore,
        componentId: a.componentId,
        questionCount: a.questions.length,
      })),
    });
  });

  // Get student's own grades for a course
  router.get('/courses/:courseId/my-grades', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ courseId: z.string() }).parse(req.params);

    // Get grade components
    const components = await prisma.gradeComponent.findMany({
      where: { courseId: params.courseId },
      orderBy: { sortOrder: 'asc' },
    });

    // Get all assessments for this course
    const assessments = await prisma.assessment.findMany({
      where: { courseId: params.courseId },
      include: {
        questions: true,
        attempts: {
          where: { studentId: req.user!.id },
        },
        manualGrades: {
          where: { studentId: req.user!.id },
        },
      },
    });

    type StudentAttemptType = { studentId: string; status: string; score: number | null };
    type StudentManualGradeType = { studentId: string; score: number };
    type StudentAssessmentType = {
      id: string;
      title: string;
      examType: string;
      maxScore: number | null;
      componentId: string | null;
      questions: unknown[];
      attempts: StudentAttemptType[];
      manualGrades: StudentManualGradeType[];
    };
    const typedAssessments = assessments as StudentAssessmentType[];

    // Get attendance
    const attendance = await prisma.attendance.findUnique({
      where: {
        courseId_studentId: {
          courseId: params.courseId,
          studentId: req.user!.id,
        },
      },
    });

    // Calculate per-component marks
    const componentMarks: Record<string, number> = {};
    const componentDetails: Record<string, { title: string; score: number; maxScore: number; percent: number }[]> = {};
    let totalGrade = 0;

    for (const component of components) {
      if (component.name === 'Attendance') {
        // Attendance score is stored as percentage (0-100)
        const attendancePercent = Math.round((attendance?.score || 0) * 10) / 10;
        const mark = Math.round(attendancePercent * component.weight / 100 * 10) / 10;
        componentMarks[component.id] = mark;
        totalGrade += mark;
      } else {
        const componentAssessments = typedAssessments.filter(a => a.componentId === component.id);
        const details: { title: string; score: number; maxScore: number; percent: number }[] = [];
        let score = 0, count = 0;

        for (const assessment of componentAssessments) {
          const attempt = assessment.attempts.find(at => at.studentId === req.user!.id && at.status === 'GRADED');
          if (attempt && attempt.score !== null && assessment.maxScore) {
            const percent = (attempt.score / assessment.maxScore) * 100;
            score += percent;
            count++;
            details.push({ title: assessment.title, score: attempt.score, maxScore: assessment.maxScore, percent: Math.round(percent * 10) / 10 });
          } else {
            const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === req.user!.id);
            if (manualGrade && assessment.maxScore) {
              const percent = (manualGrade.score / assessment.maxScore) * 100;
              score += percent;
              count++;
              details.push({ title: assessment.title, score: manualGrade.score, maxScore: assessment.maxScore, percent: Math.round(percent * 10) / 10, isPaper: true });
            }
          }
        }

        if (count > 0) {
          const avg = score / count;
          const mark = Math.round(avg * component.weight / 100 * 10) / 10;
          componentMarks[component.id] = mark;
          totalGrade += mark;
        }
        componentDetails[component.id] = details;
      }
    }

    res.json({
      components,
      componentMarks,
      componentDetails,
      attendanceScore: attendance?.score || 0,
      totalGrade: Math.round(totalGrade * 10) / 10,
    });
  });

  // Get attendance stats (live + manual) for a course section
  router.get('/course-sections/:sectionId/live-attendance', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ sectionId: z.string() }).parse(req.params);
    const user = req.user!;

    try {
      // Verify teacher teaches this section
      const section = await prisma.courseSection.findFirst({
        where: { id: params.sectionId, teacherId: user.id },
        include: { course: true, class: true },
      });

      if (!section) {
        return res.status(403).json({ error: 'forbidden' });
      }

      // Get all live sessions for this course
      const liveSessions = await prisma.liveSession.findMany({
        where: { courseId: section.courseId, classId: section.classId },
        orderBy: { scheduledAt: 'asc' },
      });

      // Get all manual attendance sessions
      const manualSessions = await prisma.manualAttendanceSession.findMany({
        where: { courseId: section.courseId, classId: section.classId },
        include: { records: true },
        orderBy: { date: 'desc' },
      });

      const totalLiveSessions = liveSessions.length;
      const endedLiveSessions = liveSessions.filter(s => s.status === 'ENDED').length;
      const totalManualSessions = manualSessions.length;
      const totalSessions = totalLiveSessions + totalManualSessions;
      const endedSessions = endedLiveSessions + totalManualSessions;

      if (totalSessions === 0) {
        return res.json({
          totalSessions: 0,
          endedSessions: 0,
          liveSessions: 0,
          manualSessions: 0,
          students: [],
          manualAttendanceHistory: [],
        });
      }

      // Get all students in the class
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: section.classId },
        include: { student: { select: { id: true, fullName: true, email: true } } },
      });

      // Get attendance records for all live sessions
      const sessionIds = liveSessions.map(s => s.id);
      const attendanceRecords = await prisma.liveSessionAttendance.findMany({
        where: { sessionId: { in: sessionIds } },
      });

      // Calculate per-student attendance stats (cumulative)
      const studentStats = classStudents.map(cs => {
        // Live session stats
        const studentRecords = attendanceRecords.filter(a => a.studentId === cs.studentId);
        const liveAttended = studentRecords.filter(a => a.status === 'ATTENDED').length;
        const livePartial = studentRecords.filter(a => a.status === 'PARTIAL').length;
        const liveAbsent = studentRecords.filter(a => a.status === 'ABSENT').length;

        // Manual session stats
        let manualPresent = 0;
        let manualLate = 0;
        let manualExcused = 0;
        let manualAbsent = 0;
        for (const ms of manualSessions) {
          const record = ms.records.find(r => r.studentId === cs.studentId);
          if (record) {
            if (record.status === 'PRESENT') manualPresent++;
            else if (record.status === 'LATE') manualLate++;
            else if (record.status === 'EXCUSED') manualExcused++;
            else manualAbsent++;
          } else {
            manualAbsent++;
          }
        }

        // Cumulative score
        let score = 0;
        if (endedSessions > 0) {
          const livePoints = (liveAttended * 100) + (livePartial * 50);
          const manualPoints = (manualPresent * 100) + (manualLate * 75) + (manualExcused * 50);
          const totalPoints = livePoints + manualPoints;
          score = Math.round(totalPoints / endedSessions);
        }

        return {
          student: cs.student,
          liveAttended,
          livePartial,
          liveAbsent,
          manualPresent,
          manualLate,
          manualExcused,
          manualAbsent,
          totalJoined: studentRecords.filter(a => a.status !== 'ABSENT').length + manualPresent + manualLate + manualExcused,
          score,
        };
      });

      res.json({
        totalSessions,
        endedSessions,
        liveSessions: totalLiveSessions,
        endedLiveSessions,
        manualSessions: totalManualSessions,
        students: studentStats,
        manualAttendanceHistory: manualSessions,
      });
    } catch (err) {
      console.error('Error fetching live attendance:', err);
      res.status(500).json({ error: 'Failed to fetch attendance stats' });
    }
  });

  // Sync attendance (live + manual) to grade attendance scores
  router.post('/course-sections/:sectionId/sync-attendance', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ sectionId: z.string() }).parse(req.params);
    const user = req.user!;

    try {
      // Verify teacher teaches this section
      const section = await prisma.courseSection.findFirst({
        where: { id: params.sectionId, teacherId: user.id },
        include: { course: { include: { gradeConfig: true, gradeComponents: true } }, class: true },
      });

      if (!section) {
        return res.status(403).json({ error: 'forbidden' });
      }

      // Get all ended live sessions for this course
      const liveSessions = await prisma.liveSession.findMany({
        where: { courseId: section.courseId, classId: section.classId, status: 'ENDED' },
      });

      // Get all manual attendance sessions
      const manualSessions = await prisma.manualAttendanceSession.findMany({
        where: { courseId: section.courseId, classId: section.classId },
        include: { records: true },
      });

      const endedLiveSessions = liveSessions.length;
      const totalManualSessions = manualSessions.length;
      const totalSessions = endedLiveSessions + totalManualSessions;

      if (totalSessions === 0) {
        return res.status(400).json({ error: 'No attendance data to sync' });
      }

      // Get all students in the class
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: section.classId },
      });

      // Get live attendance records
      const liveSessionIds = liveSessions.map(s => s.id);
      const liveAttendanceRecords = await prisma.liveSessionAttendance.findMany({
        where: { sessionId: { in: liveSessionIds } },
      });

      // Calculate and upsert attendance scores (cumulative: live + manual)
      const results = [];
      for (const cs of classStudents) {
        // Live session points
        const studentLiveRecords = liveAttendanceRecords.filter(a => a.studentId === cs.studentId);
        const liveAttended = studentLiveRecords.filter(a => a.status === 'ATTENDED').length;
        const livePartial = studentLiveRecords.filter(a => a.status === 'PARTIAL').length;
        const livePoints = (liveAttended * 100) + (livePartial * 50);

        // Manual session points
        let manualPoints = 0;
        for (const ms of manualSessions) {
          const record = ms.records.find(r => r.studentId === cs.studentId);
          if (record) {
            if (record.status === 'PRESENT') manualPoints += 100;
            else if (record.status === 'LATE') manualPoints += 75;
            else if (record.status === 'EXCUSED') manualPoints += 50;
            // ABSENT = 0
          }
        }

        const totalPoints = livePoints + manualPoints;
        const percentage = Math.round(totalPoints / totalSessions);
        // Store attendance as percentage (0-100) - gradebook will apply weight
        const score = Math.round(Math.min(100, Math.max(0, percentage)) * 10) / 10;

        const record = await prisma.attendance.upsert({
          where: {
            courseId_studentId: {
              courseId: section.courseId,
              studentId: cs.studentId,
            },
          },
          update: {
            score,
            feedback: `Auto-calculated from ${endedLiveSessions} live + ${totalManualSessions} in-person sessions (live: ${liveAttended} attended, ${livePartial} partial)`,
          },
          create: {
            courseId: section.courseId,
            studentId: cs.studentId,
            score,
            feedback: `Auto-calculated from ${endedLiveSessions} live + ${totalManualSessions} in-person sessions (live: ${liveAttended} attended, ${livePartial} partial)`,
          },
          include: {
            student: { select: { id: true, fullName: true, email: true } },
          },
        });

        results.push(record);
      }

      res.json({
        success: true,
        synced: results.length,
        attendance: results,
      });
    } catch (err) {
      console.error('Error syncing attendance:', err);
      res.status(500).json({ error: 'Failed to sync attendance' });
    }
  });

  // === Manual (Face-to-Face) Attendance ===

  // Create a manual attendance session
  router.post('/course-sections/:sectionId/manual-attendance', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ sectionId: z.string() }).parse(req.params);
    const body = z.object({
      title: z.string().optional(),
      date: z.string(),
      records: z.array(z.object({
        studentId: z.string(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      })).optional(),
    }).parse(req.body);
    const user = req.user!;

    try {
      const section = await prisma.courseSection.findFirst({
        where: { id: params.sectionId, teacherId: user.id },
        include: { course: true, class: true },
      });

      if (!section) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const date = new Date(body.date);

      // Create or find session for this date
      const session = await prisma.manualAttendanceSession.upsert({
        where: {
          courseId_classId_date: {
            courseId: section.courseId,
            classId: section.classId,
            date,
          },
        },
        update: {
          title: body.title || 'Face-to-Face Class',
          teacherId: user.id,
        },
        create: {
          courseId: section.courseId,
          classId: section.classId,
          teacherId: user.id,
          title: body.title || 'Face-to-Face Class',
          date,
        },
      });

      // If records provided, save them
      if (body.records && body.records.length > 0) {
        for (const record of body.records) {
          await prisma.manualAttendanceRecord.upsert({
            where: {
              sessionId_studentId: {
                sessionId: session.id,
                studentId: record.studentId,
              },
            },
            update: { status: record.status },
            create: {
              sessionId: session.id,
              studentId: record.studentId,
              status: record.status,
            },
          });
        }
      }

      // Return session with records
      const result = await prisma.manualAttendanceSession.findUnique({
        where: { id: session.id },
        include: {
          records: {
            include: {
              student: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });

      res.json(result);
    } catch (err) {
      console.error('Error creating manual attendance:', err);
      res.status(500).json({ error: 'Failed to create manual attendance' });
    }
  });

  // Get manual attendance sessions for a section
  router.get('/course-sections/:sectionId/manual-attendance', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ sectionId: z.string() }).parse(req.params);
    const user = req.user!;

    try {
      const section = await prisma.courseSection.findFirst({
        where: { id: params.sectionId, teacherId: user.id },
        include: { course: true, class: true },
      });

      if (!section) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const sessions = await prisma.manualAttendanceSession.findMany({
        where: { courseId: section.courseId, classId: section.classId },
        include: {
          records: {
            include: {
              student: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      res.json(sessions);
    } catch (err) {
      console.error('Error fetching manual attendance:', err);
      res.status(500).json({ error: 'Failed to fetch manual attendance' });
    }
  });

  // Delete a manual attendance session
  router.delete('/manual-attendance/:sessionId', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ sessionId: z.string() }).parse(req.params);
    const user = req.user!;

    try {
      const session = await prisma.manualAttendanceSession.findUnique({
        where: { id: params.sessionId },
      });

      if (!session || session.teacherId !== user.id) {
        return res.status(403).json({ error: 'forbidden' });
      }

      await prisma.manualAttendanceSession.delete({
        where: { id: params.sessionId },
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting manual attendance:', err);
      res.status(500).json({ error: 'Failed to delete manual attendance' });
    }
  });
}
