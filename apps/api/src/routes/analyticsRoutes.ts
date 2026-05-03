import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

export function registerAnalyticsRoutes(router: Router) {

  // Admin: Platform overview analytics
  router.get('/analytics/admin', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    try {
      // User counts by role
      const [totalUsers, students, teachers, admins] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'STUDENT' } }),
        prisma.user.count({ where: { role: 'TEACHER' } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
      ]);

      // Content counts
      const [totalClasses, totalCourses, totalMaterials, totalAssessments] = await Promise.all([
        prisma.class.count(),
        prisma.course.count(),
        prisma.material.count(),
        prisma.assessment.count(),
      ]);

      // Activity counts
      const [totalLiveSessions, totalEnrollments, totalAttempts] = await Promise.all([
        prisma.liveSession.count(),
        prisma.studentEnrollment.count(),
        prisma.attempt.count(),
      ]);

      // Recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRegistrations = await prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      });

      // User growth by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const usersByMonth = await prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: { createdAt: { gte: sixMonthsAgo } },
      });

      // Pending approvals
      const pendingProfiles = await prisma.studentProfile.count({
        where: { status: 'PENDING_APPROVAL' },
      });

      // Active live sessions
      const activeSessions = await prisma.liveSession.count({
        where: { status: 'ACTIVE' },
      });

      // Grade distribution
      const grades = await prisma.studentGrade.findMany({
        where: { isPublished: true },
        select: { gradeLetter: true },
      });
      const gradeDistribution: Record<string, number> = {};
      for (const g of grades) {
        if (g.gradeLetter) {
          gradeDistribution[g.gradeLetter] = (gradeDistribution[g.gradeLetter] || 0) + 1;
        }
      }

      // Average GPA
      const avgResult = await prisma.studentGrade.aggregate({
        _avg: { gradePoint: true },
        where: { isPublished: true },
      });

      // Attendance rate (average across all attendance records)
      const attendanceAvg = await prisma.attendance.aggregate({
        _avg: { score: true },
        _count: { id: true },
      });

      // Material views count
      const totalMaterialViews = await prisma.materialView.count();

      // Courses per class distribution
      const coursesPerClass = await prisma.courseClass.groupBy({
        by: ['classId'],
        _count: { id: true },
      });

      res.json({
        users: { total: totalUsers, students, teachers, admins, recentRegistrations, pendingProfiles },
        content: { classes: totalClasses, courses: totalCourses, materials: totalMaterials, assessments: totalAssessments },
        activity: { liveSessions: totalLiveSessions, activeSessions, enrollments: totalEnrollments, attempts: totalAttempts, materialViews: totalMaterialViews },
        grades: { distribution: gradeDistribution, averageGPA: avgResult._avg.gradePoint ? Math.round(avgResult._avg.gradePoint * 100) / 100 : 0 },
        attendance: { averageScore: attendanceAvg._avg.score ? Math.round(attendanceAvg._avg.score * 10) / 10 : 0, totalRecords: attendanceAvg._count.id },
        usersByMonth: usersByMonth.map(u => ({ role: u.role, count: u._count.id })),
      });
    } catch (err) {
      console.error('Admin analytics error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  // Teacher: Teaching analytics
  router.get('/analytics/teacher', authRequired, requireRole(['TEACHER']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    try {
      // Get current semester (or most recent if none is current)
      const currentSemester = await prisma.semester.findFirst({ where: { isCurrent: true } });
      const targetSemester = currentSemester || await prisma.semester.findFirst({ orderBy: { startDate: 'desc' } });

      // Get teacher's sections for the target semester only
      const sections = await prisma.courseSection.findMany({
        where: { teacherId: user.id, semesterId: targetSemester?.id },
        include: {
          course: { include: { gradeComponents: true, materials: true, assessments: true } },
          semester: true,
          enrollments: { include: { grade: true } },
          class: true,
        },
      });

      const totalStudents = sections.reduce((sum, s) => sum + s.enrollments.length, 0);
      const totalCourses = sections.length;

      // Average grade across all sections
      const allGrades = sections.flatMap(s => s.enrollments.map(e => e.grade).filter(Boolean));
      const avgTotal = allGrades.length > 0
        ? Math.round(allGrades.reduce((sum, g) => sum + (g?.totalScore || 0), 0) / allGrades.length * 10) / 10
        : 0;

      // Per-section stats
      const sectionStats = sections.map(s => {
        const grades = s.enrollments.map(e => e.grade).filter(Boolean);
        const avgScore = grades.length > 0
          ? Math.round(grades.reduce((sum, g) => sum + (g?.totalScore || 0), 0) / grades.length * 10) / 10
          : 0;
        const publishedGrades = grades.filter(g => g?.isPublished).length;
        return {
          sectionId: s.id,
          courseTitle: s.course.title,
          courseCode: s.course.code,
          semester: s.semester?.name || '',
          className: s.class?.name || '',
          students: s.enrollments.length,
          avgScore,
          publishedGrades,
          totalGrades: grades.length,
          materials: s.course.materials.length,
          assessments: s.course.assessments.length,
        };
      });

      // Attendance stats
      const teacherCourseIds = sections.map(s => s.courseId);
      const attendanceRecords = await prisma.attendance.findMany({
        where: { courseId: { in: teacherCourseIds } },
      });
      const avgAttendance = attendanceRecords.length > 0
        ? Math.round(attendanceRecords.reduce((sum, a) => sum + a.score, 0) / attendanceRecords.length * 10) / 10
        : 0;

      // Live sessions
      const liveSessions = await prisma.liveSession.count({
        where: { courseId: { in: teacherCourseIds } },
      });
      const activeSessions = await prisma.liveSession.count({
        where: { courseId: { in: teacherCourseIds }, status: 'ACTIVE' },
      });

      // Material views
      const materialViews = await prisma.materialView.count({
        where: { material: { courseId: { in: teacherCourseIds } } },
      });

      res.json({
        totalCourses,
        totalStudents,
        avgGrade: avgTotal,
        avgAttendance,
        liveSessions,
        activeSessions,
        materialViews,
        sections: sectionStats,
      });
    } catch (err) {
      console.error('Teacher analytics error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  // Student: Learning analytics
  router.get('/analytics/student', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    try {
      // Get student enrollments with grades
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { studentId: user.id },
        include: {
          courseSection: {
            include: {
              course: { include: { materials: true, assessments: { include: { questions: true } } } },
              semester: true,
              class: true,
              teacher: { select: { id: true, fullName: true } },
            },
          },
          grade: true,
        },
      });

      // GPA calculation
      const publishedGrades = enrollments.map(e => e.grade).filter(g => g?.isPublished);
      let gpa = 0;
      if (publishedGrades.length > 0) {
        gpa = Math.round(publishedGrades.reduce((sum, g) => sum + (g?.gradePoint || 0), 0) / publishedGrades.length * 100) / 100;
      }

      // Attendance
      const attendanceRecords = await prisma.attendance.findMany({
        where: { studentId: user.id },
      });
      const avgAttendance = attendanceRecords.length > 0
        ? Math.round(attendanceRecords.reduce((sum, a) => sum + a.score, 0) / attendanceRecords.length * 10) / 10
        : 0;

      // Material reading progress
      const readingProgress = await prisma.materialReadingProgress.findMany({
        where: { studentId: user.id },
      });
      const completedMaterials = readingProgress.filter(r => r.isCompleted).length;
      const studentCourseIds = enrollments.map(e => e.courseSection.courseId);
      const totalReadingMaterials = await prisma.material.count({
        where: { htmlContent: { not: null }, courseId: { in: studentCourseIds } },
      });

      // Attempts / assessments taken
      const attempts = await prisma.attempt.findMany({
        where: { studentId: user.id, status: 'GRADED' },
        include: { assessment: { select: { title: true, maxScore: true, course: { select: { title: true } } } } },
      });
      const avgAttemptScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => {
            if (a.assessment.maxScore) return sum + (a.score / a.assessment.maxScore * 100);
            return sum;
          }, 0) / attempts.length * 10) / 10
        : 0;

      // Per-course stats
      const courseStats = enrollments.map(e => ({
        courseTitle: e.courseSection.course.title,
        courseCode: e.courseSection.course.code,
        semester: e.courseSection.semester?.name || '',
        teacher: e.courseSection.teacher?.fullName || '',
        grade: e.grade?.totalScore ?? null,
        gradeLetter: e.grade?.gradeLetter ?? null,
        gradePoint: e.grade?.gradePoint ?? null,
        isPublished: e.grade?.isPublished ?? false,
        materials: e.courseSection.course.materials.length,
        assessments: e.courseSection.course.assessments.length,
        quizScore: e.grade?.quizScore ?? null,
        assignmentScore: e.grade?.assignmentScore ?? null,
        midtermScore: e.grade?.midtermScore ?? null,
        finalScore: e.grade?.finalScore ?? null,
        attendanceScore: e.grade?.attendanceScore ?? null,
        deliveryMode: e.courseSection.deliveryMode || 'ONLINE',
      }));

      // Upcoming exams
      const studentSectionIds = enrollments.map(e => e.courseSectionId);
      const upcomingExams = await prisma.examSchedule.findMany({
        where: {
          courseSectionId: { in: studentSectionIds },
          confirmedDate: { gte: new Date() },
        },
        include: {
          courseSection: { include: { course: { select: { title: true, code: true } } } },
        },
        orderBy: { confirmedDate: 'asc' },
        take: 5,
      });

      // Video watch data for ML features
      const videoViews = await prisma.materialView.findMany({
        where: { studentId: user.id },
        include: { material: { select: { courseId: true } } },
      });
      const totalVideoSeconds = videoViews.reduce((sum, v) => sum + (v.durationSec || 0), 0);
      const avgVideoWatchPct = videoViews.length > 0
        ? Math.min(100, Math.round(totalVideoSeconds / videoViews.length / 3.6)) // rough: 360s avg full video → 100%
        : 0;
      // Per-course video watch percentage
      const courseVideoMap: Record<string, number> = {};
      for (const v of videoViews) {
        const cid = v.material?.courseId;
        if (cid) {
          courseVideoMap[cid] = (courseVideoMap[cid] || 0) + (v.durationSec || 0);
        }
      }
      // Per-course reading progress percentage
      const courseReadingMap: Record<string, number> = {};
      for (const r of readingProgress) {
        const mat = await prisma.material.findUnique({ where: { id: r.materialId }, select: { courseId: true } });
        if (mat?.courseId) {
          const pct = r.totalSlides > 0 ? Math.round(r.completedSlides / r.totalSlides * 100) : 0;
          courseReadingMap[mat.courseId] = Math.max(courseReadingMap[mat.courseId] || 0, pct);
        }
      }

      // Add video/reading data to courseStats
      const courseStatsWithEngagement = courseStats.map(cs => {
        const courseId = enrollments.find(e => e.courseSection.course.title === cs.courseTitle)?.courseSection?.courseId;
        return {
          ...cs,
          videoWatchPct: courseId ? (courseVideoMap[courseId] ? Math.min(100, Math.round(courseVideoMap[courseId] / 3.6)) : 0) : 0,
          readingPct: courseId ? (courseReadingMap[courseId] || 0) : 0,
        };
      });

      res.json({
        totalCourses: enrollments.length,
        gpa,
        avgAttendance,
        avgAssessmentScore: avgAttemptScore,
        readingProgress: { completed: completedMaterials, total: totalReadingMaterials },
        totalAttempts: attempts.length,
        avgVideoWatchPct,
        totalVideoSeconds,
        courses: courseStatsWithEngagement,
        upcomingExams: upcomingExams.map(e => ({
          id: e.id,
          title: e.courseSection.course.title,
          code: e.courseSection.course.code,
          type: e.examType,
          date: e.confirmedDate || e.officialDate,
          duration: e.duration,
          location: e.location,
        })),
      });
    } catch (err) {
      console.error('Student analytics error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });
}
