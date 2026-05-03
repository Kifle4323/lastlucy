import { BaseRepository } from '../core/BaseRepository.js';

export class AnalyticsRepository extends BaseRepository {
  constructor() { super('user'); }

  getAdminOverview() {
    return Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.class.count(),
      this.prisma.course.count(),
      this.prisma.material.count(),
      this.prisma.assessment.count(),
      this.prisma.liveSession.count(),
      this.prisma.studentEnrollment.count(),
      this.prisma.attempt.count(),
    ]);
  }

  getRecentRegistrations(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.user.count({ where: { createdAt: { gte: since } } });
  }

  getUsersByMonth(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    return this.prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
    });
  }

  getPendingProfiles() {
    return this.prisma.studentProfile.count({ where: { status: 'PENDING_APPROVAL' } });
  }

  getActiveSessions() {
    return this.prisma.liveSession.count({ where: { status: 'ACTIVE' } });
  }

  getGradeDistribution() {
    return this.prisma.studentGrade.findMany({
      where: { isPublished: true },
      select: { gradeLetter: true },
    });
  }

  getAverageGPA() {
    return this.prisma.studentGrade.aggregate({
      _avg: { gradePoint: true },
      where: { isPublished: true },
    });
  }

  getAttendanceStats() {
    return this.prisma.attendance.aggregate({
      _avg: { score: true },
      _count: { id: true },
    });
  }

  getMaterialViews() {
    return this.prisma.materialView.count();
  }

  getCoursesPerClass() {
    return this.prisma.courseClass.groupBy({
      by: ['classId'],
      _count: { id: true },
    });
  }

  getTeacherCourseStats(teacherId) {
    return Promise.all([
      this.prisma.courseSection.findMany({
        where: { teacherId },
        include: { course: { select: { code: true, title: true } }, semester: { select: { name: true } }, class: { select: { name: true } }, enrollments: { where: { status: 'ENROLLED' }, select: { id: true } } },
      }),
      this.prisma.courseClass.findMany({ where: { teacherId }, select: { courseId: true } }),
    ]);
  }

  getStudentCourseStats(studentId) {
    return this.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED' },
      include: { courseSection: { include: { course: true, teacher: { select: { fullName: true } }, semester: { select: { name: true } } } }, grade: true },
    });
  }

  async getTeacherAtRiskStudents(teacherId) {
    // Get current semester
    const currentSemester = await this.prisma.semester.findFirst({
      where: { isCurrent: true },
    });

    if (!currentSemester) return [];

    // Only get sections for current semester that the teacher teaches
    const sections = await this.prisma.courseSection.findMany({
      where: { teacherId, semesterId: currentSemester.id },
      select: { id: true, courseId: true, sectionCode: true, course: { select: { title: true, code: true } } },
    });
    const sectionIds = sections.map(s => s.id);
    const courseIds = [...new Set(sections.map(s => s.courseId))];

    if (sectionIds.length === 0) return [];

    // 1) Students with submitted low grades (totalScore < 50) — only non-completed sections
    const lowGradeEnrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        courseSectionId: { in: sectionIds },
        status: 'ENROLLED',
        grade: { totalScore: { lt: 50 }, isSubmitted: true },
      },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: { select: { title: true, code: true } } } },
        grade: { select: { totalScore: true, gradeLetter: true, gradePoint: true, isSubmitted: true } },
      },
    });

    // 2) Students with low attendance (< 60%)
    const lowAttendance = await this.prisma.attendance.findMany({
      where: { courseId: { in: courseIds }, score: { lt: 60 } },
      select: { studentId: true, courseId: true, score: true },
    });

    // 3) Get all enrolled student IDs for attempt lookup
    const allEnrollments = await this.prisma.studentEnrollment.findMany({
      where: { courseSectionId: { in: sectionIds }, status: 'ENROLLED' },
      select: { studentId: true },
    });
    const allStudentIds = [...new Set(allEnrollments.map(e => e.studentId))];

    // 4) Get attempt scores for all enrolled students in teacher's courses
    const allAttempts = await this.prisma.attempt.findMany({
      where: {
        studentId: { in: allStudentIds },
        status: 'GRADED',
        assessment: { courseId: { in: courseIds } },
        score: { not: null },
      },
      select: { studentId: true, assessment: { select: { courseId: true, maxScore: true } }, score: true },
    });

    // Build a map of student+course → early warning info
    const attendanceMap = {};
    for (const a of lowAttendance) {
      attendanceMap[`${a.studentId}_${a.courseId}`] = a.score;
    }

    // 4) Students enrolled but no grade submitted yet — check partial data
    const noGradeEnrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        courseSectionId: { in: sectionIds },
        status: 'ENROLLED',
        grade: null,
      },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: { select: { title: true, code: true } } } },
      },
    });

    // 5) Fetch ML predictions for at-risk students
    let mlPredictions = {};
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const uniqueStudentIds = [...new Set([
        ...lowGradeEnrollments.map(e => e.studentId),
        ...noGradeEnrollments.map(e => e.studentId),
      ])];
      const predictionPromises = uniqueStudentIds.map(async (sid) => {
        try {
          const res = await fetch(`${mlServiceUrl}/ml/predict-student/${sid}`);
          if (res.ok) {
            const data = await res.json();
            return { sid, data };
          }
        } catch {}
        return { sid, data: null };
      });
      const predictionResults = await Promise.all(predictionPromises);
      for (const { sid, data } of predictionResults) {
        if (data) mlPredictions[sid] = data;
      }
    } catch (e) {
      console.error('ML prediction fetch for at-risk failed:', e.message);
    }

    const results = [];

    // Add students with submitted low grades
    for (const e of lowGradeEnrollments) {
      const mlPred = mlPredictions[e.studentId];
      const coursePred = mlPred?.predictions?.find(p => p.course_id === e.courseSection?.courseId);
      // Also compute real-time score from assessment attempts
      const studentAttempts = allAttempts.filter(
        a => a.studentId === e.studentId && a.assessment?.courseId === e.courseSection?.courseId
      );
      const avgAttemptScore = studentAttempts.length > 0
        ? studentAttempts.reduce((sum, a) => {
            const pct = a.assessment?.maxScore ? (a.score / a.assessment.maxScore) * 100 : a.score;
            return sum + pct;
          }, 0) / studentAttempts.length
        : null;
      // Use the better of totalScore or avgAttemptScore for display
      const displayScore = avgAttemptScore !== null ? avgAttemptScore : e.grade?.totalScore;

      results.push({
        studentId: e.studentId,
        studentName: e.student?.fullName,
        studentEmail: e.student?.email,
        courseId: e.courseSection?.courseId,
        courseTitle: e.courseSection?.course?.title,
        courseCode: e.courseSection?.course?.code,
        sectionCode: e.courseSection?.sectionCode,
        totalScore: e.grade?.totalScore,
        avgAttemptScore,
        displayScore,
        gradeLetter: e.grade?.gradeLetter,
        gradePoint: e.grade?.gradePoint,
        attendanceScore: attendanceMap[`${e.studentId}_${e.courseSection?.courseId}`] ?? null,
        passProbability: coursePred?.pass_probability ?? null,
        expectedCgpa: mlPred?.expected_cgpa ?? null,
        dropoutRisk: mlPred?.dropout_risk ?? null,
        riskLevel: coursePred?.pass_probability != null
          ? (coursePred.pass_probability < 0.3 ? 'HIGH' : coursePred.pass_probability < 0.5 ? 'MEDIUM' : 'LOW')
          : (e.grade?.totalScore < 35 ? 'HIGH' : 'MEDIUM'),
        reason: coursePred?.pass_probability != null
          ? `AI: ${(coursePred.pass_probability * 100).toFixed(1)}% pass chance`
          : 'Low overall grade',
      });
    }

    // Add students with no submitted grade but early warning signs
    for (const e of noGradeEnrollments) {
      const attScore = attendanceMap[`${e.studentId}_${e.courseSection?.courseId}`];
      const studentAttempts = allAttempts.filter(
        a => a.studentId === e.studentId && a.assessment?.courseId === e.courseSection?.courseId
      );
      const avgAttemptScore = studentAttempts.length > 0
        ? studentAttempts.reduce((sum, a) => {
            const pct = a.assessment?.maxScore ? (a.score / a.assessment.maxScore) * 100 : a.score;
            return sum + pct;
          }, 0) / studentAttempts.length
        : null;

      // Flag if: low attendance, low attempt scores, or both
      const hasLowAttendance = attScore !== undefined && attScore < 60;
      const hasLowAttempts = avgAttemptScore !== null && avgAttemptScore < 40;

      if (hasLowAttendance || hasLowAttempts) {
        const mlPred = mlPredictions[e.studentId];
        const coursePred = mlPred?.predictions?.find(p => p.course_id === e.courseSection?.courseId);
        const reasons = [];
        if (hasLowAttendance) reasons.push(`Attendance: ${attScore}%`);
        if (hasLowAttempts) reasons.push(`Avg score: ${avgAttemptScore.toFixed(1)}%`);
        if (coursePred?.pass_probability != null) reasons.push(`AI: ${(coursePred.pass_probability * 100).toFixed(1)}% pass`);

        results.push({
          studentId: e.studentId,
          studentName: e.student?.fullName,
          studentEmail: e.student?.email,
          courseId: e.courseSection?.courseId,
          courseTitle: e.courseSection?.course?.title,
          courseCode: e.courseSection?.course?.code,
          sectionCode: e.courseSection?.sectionCode,
          totalScore: null,
          gradeLetter: null,
          gradePoint: null,
          attendanceScore: attScore ?? null,
          avgAttemptScore,
          passProbability: coursePred?.pass_probability ?? null,
          expectedCgpa: mlPred?.expected_cgpa ?? null,
          dropoutRisk: mlPred?.dropout_risk ?? null,
          riskLevel: coursePred?.pass_probability != null
            ? (coursePred.pass_probability < 0.3 ? 'HIGH' : coursePred.pass_probability < 0.5 ? 'MEDIUM' : 'LOW')
            : (hasLowAttendance && hasLowAttempts) ? 'HIGH' : 'MEDIUM',
          reason: reasons.join(' | '),
        });
      }
    }

    // Sort: HIGH risk first, then by score ascending
    results.sort((a, b) => {
      if (a.riskLevel === 'HIGH' && b.riskLevel !== 'HIGH') return -1;
      if (a.riskLevel !== 'HIGH' && b.riskLevel === 'HIGH') return 1;
      return (a.totalScore ?? 0) - (b.totalScore ?? 0);
    });

    return results.slice(0, 30);
  }
}
