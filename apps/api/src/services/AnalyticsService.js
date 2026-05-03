import { BaseService } from '../core/BaseService.js';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';

export class AnalyticsService extends BaseService {
  constructor() {
    super(new AnalyticsRepository());
  }

  async getAdminOverview() {
    const [totalUsers, students, teachers, admins, totalClasses, totalCourses, totalMaterials, totalAssessments, totalLiveSessions, totalEnrollments, totalAttempts] = await this.repository.getAdminOverview();

    const recentRegistrations = await this.repository.getRecentRegistrations();
    const usersByMonth = await this.repository.getUsersByMonth();
    const pendingProfiles = await this.repository.getPendingProfiles();
    const activeSessions = await this.repository.getActiveSessions();

    const grades = await this.repository.getGradeDistribution();
    const gradeDistribution = {};
    for (const g of grades) {
      if (g.gradeLetter) gradeDistribution[g.gradeLetter] = (gradeDistribution[g.gradeLetter] || 0) + 1;
    }

    const avgResult = await this.repository.getAverageGPA();
    const attendanceAvg = await this.repository.getAttendanceStats();
    const totalMaterialViews = await this.repository.getMaterialViews();
    const coursesPerClass = await this.repository.getCoursesPerClass();

    return {
      users: { total: totalUsers, students, teachers, admins, recentRegistrations, pendingProfiles },
      content: { classes: totalClasses, courses: totalCourses, materials: totalMaterials, assessments: totalAssessments },
      activity: { liveSessions: totalLiveSessions, activeSessions, enrollments: totalEnrollments, attempts: totalAttempts, materialViews: totalMaterialViews },
      grades: { distribution: gradeDistribution, averageGPA: avgResult._avg.gradePoint ? Math.round(avgResult._avg.gradePoint * 100) / 100 : 0 },
      attendance: { averageScore: attendanceAvg._avg.score ? Math.round(attendanceAvg._avg.score * 10) / 10 : 0, totalRecords: attendanceAvg._count.id },
      usersByMonth: usersByMonth.map(u => ({ role: u.role, count: u._count.id })),
    };
  }

  async getTeacherOverview(teacherId) {
    const [sections, classes] = await this.repository.getTeacherCourseStats(teacherId);
    const courseIds = [...new Set([...sections.map(s => s.courseId), ...classes.map(c => c.courseId)])];

    const [totalAssessments, totalAttempts, liveSessions, activeSessions, materialViews] = await Promise.all([
      this.repository.prisma.assessment.count({ where: { courseId: { in: courseIds } } }),
      this.repository.prisma.attempt.count({ where: { assessment: { courseId: { in: courseIds } } } }),
      this.repository.prisma.liveSession.count({ where: { courseId: { in: courseIds } } }),
      this.repository.prisma.liveSession.count({ where: { courseId: { in: courseIds }, status: 'LIVE' } }),
      this.repository.prisma.materialView.count({ where: { material: { courseId: { in: courseIds } } } }),
    ]);

    // Get students count from teacher's sections
    const totalStudents = await this.repository.prisma.studentEnrollment.count({
      where: { courseSection: { courseId: { in: courseIds }, teacherId }, status: 'ENROLLED' },
    });

    // Section details for chart
    const sectionDetails = sections.map(s => ({
      sectionId: s.id,
      courseCode: s.course?.code || '',
      courseTitle: s.course?.title || '',
      semester: s.semester?.name || '',
      className: s.class?.name || '',
      students: s.enrollments?.length || 0,
      avgScore: 0,
    }));

    // Calculate avg scores per section
    for (const sec of sectionDetails) {
      const grades = await this.repository.prisma.studentGrade.findMany({
        where: { enrollment: { courseSectionId: sec.sectionId }, isSubmitted: true },
        select: { totalScore: true },
      });
      if (grades.length > 0) {
        sec.avgScore = Math.round(grades.reduce((sum, g) => sum + (g.totalScore || 0), 0) / grades.length * 10) / 10;
      }
    }

    // Average grade across all sections
    const allGrades = await this.repository.prisma.studentGrade.findMany({
      where: { enrollment: { courseSection: { teacherId } }, isSubmitted: true },
      select: { totalScore: true },
    });
    const avgGrade = allGrades.length > 0 ? Math.round(allGrades.reduce((sum, g) => sum + (g.totalScore || 0), 0) / allGrades.length * 10) / 10 : 'N/A';

    // Average attendance
    const attStats = await this.repository.prisma.attendance.aggregate({
      where: { courseId: { in: courseIds } },
      _avg: { score: true },
    });
    const avgAttendance = attStats._avg.score ? Math.round(attStats._avg.score * 10) / 10 : 0;

    return {
      totalCourses: courseIds.length,
      totalStudents,
      totalAssessments,
      totalAttempts,
      avgGrade,
      avgAttendance,
      liveSessions,
      activeSessions,
      materialViews,
      sections: sectionDetails,
    };
  }

  async getStudentOverview(studentId) {
    const enrollments = await this.repository.getStudentCourseStats(studentId);
    const courseIds = enrollments.map(e => e.courseSection?.courseId).filter(Boolean);

    const [totalAttempts, pendingAssessments] = await Promise.all([
      this.repository.prisma.attempt.count({ where: { studentId } }),
      this.repository.prisma.assessment.count({ where: { courseId: { in: courseIds } } }),
    ]);

    // GPA
    const cgpaResult = await this.repository.prisma.studentGrade.aggregate({
      where: { enrollment: { studentId }, isPublished: true },
      _avg: { gradePoint: true },
    });
    const gpa = cgpaResult._avg.gradePoint ? Math.round(cgpaResult._avg.gradePoint * 100) / 100 : 'N/A';

    // Average attendance
    const attStats = await this.repository.prisma.attendance.aggregate({
      where: { studentId },
      _avg: { score: true },
    });
    const avgAttendance = attStats._avg.score ? Math.round(attStats._avg.score * 10) / 10 : 0;

    // Average assessment score
    const attemptAvg = await this.repository.prisma.attempt.aggregate({
      where: { studentId, status: 'GRADED' },
      _avg: { score: true },
    });
    const avgAssessmentScore = attemptAvg._avg.score ? Math.round(attemptAvg._avg.score * 10) / 10 : 0;

    // Reading progress
    const [completedMats, totalMats] = await Promise.all([
      this.repository.prisma.materialReadingProgress.count({ where: { studentId, isCompleted: true } }),
      this.repository.prisma.material.count({ where: { courseId: { in: courseIds } } }),
    ]);

    // Course list with grades
    const courses = enrollments.map(e => ({
      courseCode: e.courseSection?.course?.code || '',
      courseTitle: e.courseSection?.course?.title || '',
      teacher: e.courseSection?.teacher?.fullName || '',
      semester: e.courseSection?.semester?.name || '',
      grade: e.grade?.totalScore ?? null,
      gradeLetter: e.grade?.gradeLetter ?? null,
      isPublished: e.grade?.isPublished ?? false,
    }));

    // Upcoming exams
    const upcomingExams = await this.repository.prisma.examSchedule.findMany({
      where: {
        courseSection: { enrollments: { some: { studentId, status: 'ENROLLED' } } },
        officialDate: { gte: new Date() },
      },
      include: { courseSection: { include: { course: { select: { title: true } } } } },
      take: 5,
      orderBy: { officialDate: 'asc' },
    }).then(exams => exams.map(e => ({
      id: e.id,
      title: e.courseSection?.course?.title || '',
      type: e.examType,
      date: e.officialDate,
      location: e.isOnline ? 'Online' : (e.location || ''),
    }))).catch(() => []);

    return {
      totalCourses: courseIds.length,
      totalAttempts,
      pendingAssessments,
      gpa,
      avgAttendance,
      avgAssessmentScore,
      readingProgress: { completed: completedMats, total: totalMats },
      courses,
      upcomingExams: await upcomingExams,
    };
  }

  async getTeacherAtRiskStudents(teacherId) {
    return await this.repository.getTeacherAtRiskStudents(teacherId);
  }

  async getPublicOverview() {
    const [totalStudents, totalTeachers, totalCourses, totalClasses, totalMaterials, totalAssessments] = await Promise.all([
      this.repository.prisma.user.count({ where: { role: 'STUDENT', isApproved: true } }),
      this.repository.prisma.user.count({ where: { role: 'TEACHER', isApproved: true } }),
      this.repository.prisma.course.count(),
      this.repository.prisma.class.count(),
      this.repository.prisma.material.count(),
      this.repository.prisma.assessment.count(),
    ]);

    const grades = await this.repository.prisma.studentGrade.findMany({
      where: { isPublished: true, gradeLetter: { not: null } },
      select: { gradeLetter: true },
    });
    const gradeDistribution = {};
    for (const g of grades) {
      if (g.gradeLetter) gradeDistribution[g.gradeLetter] = (gradeDistribution[g.gradeLetter] || 0) + 1;
    }

    const totalEnrollments = await this.repository.prisma.studentEnrollment.count({ where: { status: 'ENROLLED' } });
    const totalAttempts = await this.repository.prisma.attempt.count();
    const totalLiveSessions = await this.repository.prisma.liveSession.count();

    // Department distribution
    const departments = await this.repository.prisma.department.findMany({
      include: { classes: { include: { students: { select: { id: true } } } } },
    });
    const deptData = departments.map(d => ({
      name: d.name,
      code: d.code,
      students: d.classes.reduce((sum, c) => sum + c.students.length, 0),
    }));

    // Monthly registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentUsers = await this.repository.prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo }, isApproved: true },
      select: { createdAt: true, role: true },
    });
    const monthlyData = {};
    for (const u of recentUsers) {
      const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { month: key, students: 0, teachers: 0 };
      if (u.role === 'STUDENT') monthlyData[key].students++;
      else if (u.role === 'TEACHER') monthlyData[key].teachers++;
    }

    return {
      totalStudents, totalTeachers, totalCourses, totalClasses,
      totalMaterials, totalAssessments, totalEnrollments, totalAttempts, totalLiveSessions,
      gradeDistribution, deptData,
      monthlyRegistrations: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      totalGrades: grades.length,
    };
  }
}
