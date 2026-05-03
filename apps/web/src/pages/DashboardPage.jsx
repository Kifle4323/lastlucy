import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from 'react-i18next';
import { getClasses, getAdminAnalytics, getTeacherAnalytics, getTeacherAtRiskStudents, getStudentAnalytics, getMLAnalytics, predictStudentById } from '../api';
import Layout from '../components/Layout';
import {
  GraduationCap, BookOpen, Users, Calendar, ChevronRight, Clock, User,
  ClipboardList, Award, FileText, CalendarClock, TrendingUp, Activity,
  BarChart3, Eye, CheckCircle, AlertCircle, AlertTriangle, Brain
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function StatCard({ icon: Icon, iconBg, iconColor, value, label, sub }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics({ data, t }) {
  if (!data) return null;
  const users = data.users || { total: 0, students: 0, teachers: 0, admins: 0, recentRegistrations: 0, pendingProfiles: 0 };
  const content = data.content || { courses: 0, classes: 0, materials: 0, assessments: 0 };
  const activity = data.activity || { enrollments: 0, attempts: 0, materialViews: 0, liveSessions: 0, activeSessions: 0 };
  const grades = data.grades || { averageGPA: null, distribution: {} };
  const attendance = data.attendance || { averageScore: 0, totalRecords: 0 };

  const roleData = [
    { name: 'Students', value: users.students },
    { name: 'Teachers', value: users.teachers },
    { name: 'Admins', value: users.admins },
  ].filter(d => d.value > 0);

  const gradeData = Object.entries(grades.distribution || {}).map(([letter, count]) => ({
    letter, count
  }));

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Users} iconBg="bg-primary-100" iconColor="text-primary-600" value={users.total} label={t('dashboard.totalUsers')} sub={`${users.recentRegistrations} new (30d)`} />
        <StatCard icon={GraduationCap} iconBg="bg-blue-100" iconColor="text-blue-600" value={users.students} label={t('dashboard.students')} />
        <StatCard icon={BookOpen} iconBg="bg-green-100" iconColor="text-green-600" value={content.courses} label={t('dashboard.courses')} />
        <StatCard icon={Activity} iconBg="bg-purple-100" iconColor="text-purple-600" value={content.classes} label={t('dashboard.classes')} />
        <StatCard icon={FileText} iconBg="bg-orange-100" iconColor="text-orange-600" value={content.materials} label={t('dashboard.materials')} />
        <StatCard icon={ClipboardList} iconBg="bg-red-100" iconColor="text-red-600" value={content.assessments} label={t('dashboard.assessments')} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* User Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.userDistribution')}</h3>
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">{t('dashboard.noUserData')}</p>}
        </div>

        {/* Grade Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.gradeDistribution')}</h3>
          {gradeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gradeData}>
                <XAxis dataKey="letter" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">{t('dashboard.noGradeData')}</p>}
        </div>
      </div>

      {/* Activity & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.platformActivity')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.enrollments')}</span>
              <span className="font-semibold text-gray-900">{activity.enrollments}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.assessmentAttempts')}</span>
              <span className="font-semibold text-gray-900">{activity.attempts}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.materialViews')}</span>
              <span className="font-semibold text-gray-900">{activity.materialViews}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.liveSessions')}</span>
              <span className="font-semibold text-gray-900">{activity.liveSessions}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">{t('dashboard.activeSessions')}</span>
              <span className="font-semibold text-green-600">{activity.activeSessions}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.academicSummary')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.averageGPA')}</span>
              <span className="font-semibold text-gray-900">{grades.averageGPA || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.avgAttendance')}</span>
              <span className="font-semibold text-gray-900">{attendance.averageScore}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('dashboard.attendanceRecords')}</span>
              <span className="font-semibold text-gray-900">{attendance.totalRecords}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.alerts')}</h3>
          <div className="space-y-3">
            {users.pendingProfiles > 0 && (
              <Link to="/admin/users" className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">{users.pendingProfiles} {t('dashboard.pendingApprovals')}</p>
                  <p className="text-xs text-yellow-600">{t('dashboard.studentProfilesAwaiting')}</p>
                </div>
              </Link>
            )}
            {activity.activeSessions > 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">{activity.activeSessions} {t('dashboard.activeLiveSessions')}</p>
                  <p className="text-xs text-green-600">{t('dashboard.currentlyInProgress')}</p>
                </div>
              </div>
            )}
            {users.pendingProfiles === 0 && activity.activeSessions === 0 && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-gray-400" />
                <p className="text-gray-500">{t('dashboard.noPendingAlerts')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TeacherAnalytics({ data, mlAnalytics, atRiskStudents, t }) {
  if (!data) return null;
  const totalCourses = data.totalCourses ?? 0;
  const totalStudents = data.totalStudents ?? 0;
  const avgGrade = data.avgGrade ?? 'N/A';
  const avgAttendance = data.avgAttendance ?? 0;
  const liveSessions = data.liveSessions ?? 0;
  const activeSessions = data.activeSessions ?? 0;
  const materialViews = data.materialViews ?? 0;
  const sections = data.sections || [];

  const sectionChartData = (sections || []).map(s => ({
    name: s.courseCode || s.courseTitle?.substring(0, 8),
    students: s.students,
    avg: s.avgScore,
  }));

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={BookOpen} iconBg="bg-green-100" iconColor="text-green-600" value={totalCourses} label={t('dashboard.courses')} />
        <StatCard icon={GraduationCap} iconBg="bg-blue-100" iconColor="text-blue-600" value={totalStudents} label={t('dashboard.students')} />
        <StatCard icon={TrendingUp} iconBg="bg-purple-100" iconColor="text-purple-600" value={avgGrade} label={t('dashboard.avgGrade')} />
        <StatCard icon={CheckCircle} iconBg="bg-teal-100" iconColor="text-teal-600" value={`${avgAttendance}%`} label={t('dashboard.avgAttendance')} />
        <StatCard icon={Activity} iconBg="bg-orange-100" iconColor="text-orange-600" value={liveSessions} label={t('dashboard.liveSessions')} />
        <StatCard icon={Eye} iconBg="bg-indigo-100" iconColor="text-indigo-600" value={materialViews} label={t('dashboard.materialViews')} />
      </div>

      {/* Course Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.studentsPerCourse')}</h3>
          {sectionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sectionChartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="students" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">{t('dashboard.noCoursesYet')}</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.courseSections')}</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(sections || []).map(s => (
              <div key={s.sectionId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{s.courseTitle}</p>
                  <p className="text-xs text-gray-500">{s.semester} - {s.className}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{s.avgScore}</p>
                  <p className="text-xs text-gray-500">{s.students} students</p>
                </div>
              </div>
            ))}
            {(!sections || sections.length === 0) && <p className="text-gray-400 text-center py-8">{t('dashboard.noSectionsYet')}</p>}
          </div>
        </div>
      </div>

      {activeSessions > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Activity className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">{activeSessions} {t('dashboard.activeLiveSessions')}</p>
        </div>
      )}

      {/* At-Risk Students (Real DB Data) */}
      {atRiskStudents?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            {t('dashboard.atRiskStudents')} ({atRiskStudents.length})
          </h3>
          <p className="text-xs text-gray-500 mb-4">{t('dashboard.atRiskDesc')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.studentName')}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.course')}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.score')}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.attendance')}</th>
                  <th className="text-left px-3 py-2 text-gray-500">AI Pass%</th>
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.riskLevel')}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{t('dashboard.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {atRiskStudents.slice(0, 15).map((s, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-gray-900">{s.studentName}</p>
                        <p className="text-xs text-gray-400">{s.studentEmail}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <p className="text-gray-900">{s.courseTitle}</p>
                        <p className="text-xs text-gray-400">{s.courseCode} - {s.sectionCode}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {s.displayScore !== null && s.displayScore !== undefined ? (
                        <span className="text-gray-900 font-semibold">{s.displayScore?.toFixed(1)}%</span>
                      ) : s.totalScore !== null && s.totalScore !== undefined ? (
                        <span className="text-gray-900 font-semibold">{s.totalScore?.toFixed(1)}</span>
                      ) : s.avgAttemptScore !== null && s.avgAttemptScore !== undefined ? (
                        <span className="text-orange-600 font-semibold">{s.avgAttemptScore?.toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.attendanceScore !== null && s.attendanceScore !== undefined ? (
                        <span className={s.attendanceScore < 60 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                          {s.attendanceScore}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.passProbability != null ? (
                        <span className={`font-semibold ${s.passProbability >= 0.5 ? 'text-green-600' : s.passProbability >= 0.3 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {(s.passProbability * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={'px-2 py-1 rounded text-xs font-medium ' + (s.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                        {s.riskLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{s.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function StudentAnalytics({ data, mlPredictions, t }) {
  if (!data) return null;
  const totalCourses = data.totalCourses ?? 0;
  const gpa = data.gpa ?? 'N/A';
  const avgAttendance = data.avgAttendance ?? 0;
  const avgAssessmentScore = data.avgAssessmentScore ?? 0;
  const readingProgress = data.readingProgress || { total: 0, completed: 0 };
  const totalAttempts = data.totalAttempts ?? 0;
  const courses = data.courses || [];
  const upcomingExams = data.upcomingExams || [];

  const courseGradeData = (courses || []).filter(c => c.grade !== null).map(c => ({
    name: c.courseCode || c.courseTitle?.substring(0, 8),
    score: c.grade,
  }));

  const readPct = readingProgress?.total > 0 ? Math.round(readingProgress.completed / readingProgress.total * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={BookOpen} iconBg="bg-green-100" iconColor="text-green-600" value={totalCourses} label={t('dashboard.courses')} />
        <StatCard icon={Award} iconBg="bg-blue-100" iconColor="text-blue-600" value={gpa} label={t('dashboard.gpa')} />
        <StatCard icon={CheckCircle} iconBg="bg-teal-100" iconColor="text-teal-600" value={`${avgAttendance}%`} label={t('dashboard.attendance')} />
        <StatCard icon={BarChart3} iconBg="bg-purple-100" iconColor="text-purple-600" value={`${avgAssessmentScore}%`} label={t('dashboard.avgAssessment')} />
        <StatCard icon={FileText} iconBg="bg-orange-100" iconColor="text-orange-600" value={totalAttempts} label={t('dashboard.attempts')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Course Grades */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.myCourseGrades')}</h3>
          {courseGradeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={courseGradeData}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">{t('dashboard.noGradesPublished')}</p>}
        </div>

        {/* Reading Progress & Upcoming */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.readingProgress')}</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div className="bg-primary-600 h-4 rounded-full transition-all" style={{ width: `${readPct}%` }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{readPct}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{readingProgress?.completed || 0} of {readingProgress?.total || 0} {t('dashboard.materialsCompleted')}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.upcomingExams')}</h3>
            {(upcomingExams || []).length > 0 ? (
              <div className="space-y-2">
                {upcomingExams.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-500">{e.type} Exam</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{e.date ? new Date(e.date).toLocaleDateString() : 'TBD'}</p>
                      {e.location && <p className="text-xs text-gray-500">{e.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-center py-4">{t('dashboard.noUpcomingExams')}</p>}
          </div>
        </div>
      </div>

      {/* AI Pass Probability */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          {t('dashboard.aiPassProbability')}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t('dashboard.aiPassProbabilityDesc')}</p>
        {mlPredictions?.expected_cgpa != null && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-center">
              <p className="text-xs text-indigo-500 font-medium">{t('dashboard.currentCgpa')}</p>
              <p className="text-xl font-bold text-indigo-600">{(mlPredictions.current_cgpa ?? 0).toFixed(2)}</p>
              <p className="text-xs text-indigo-400">/ 4.00</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-xs text-blue-500 font-medium">{t('dashboard.expectedCgpa')}</p>
              <p className="text-xl font-bold text-blue-600">{(mlPredictions.expected_cgpa ?? 0).toFixed(2)}</p>
              <p className="text-xs text-blue-400">/ 4.00</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              mlPredictions.dropout_risk === 'CRITICAL' ? 'bg-red-50' :
              mlPredictions.dropout_risk === 'HIGH' ? 'bg-orange-50' :
              mlPredictions.dropout_risk === 'MODERATE' ? 'bg-yellow-50' : 'bg-green-50'
            }`}>
              <p className={`text-xs font-medium ${
                mlPredictions.dropout_risk === 'CRITICAL' ? 'text-red-500' :
                mlPredictions.dropout_risk === 'HIGH' ? 'text-orange-500' :
                mlPredictions.dropout_risk === 'MODERATE' ? 'text-yellow-600' : 'text-green-500'
              }`}>{t('dashboard.dropoutRisk')}</p>
              <p className={`text-lg font-bold ${
                mlPredictions.dropout_risk === 'CRITICAL' ? 'text-red-600' :
                mlPredictions.dropout_risk === 'HIGH' ? 'text-orange-600' :
                mlPredictions.dropout_risk === 'MODERATE' ? 'text-yellow-600' : 'text-green-600'
              }`}>{mlPredictions.dropout_risk}</p>
              <p className={`text-xs ${
                mlPredictions.dropout_risk === 'CRITICAL' ? 'text-red-400' :
                mlPredictions.dropout_risk === 'HIGH' ? 'text-orange-400' :
                mlPredictions.dropout_risk === 'MODERATE' ? 'text-yellow-500' : 'text-green-400'
              }`}>{t(`dashboard.destination_${mlPredictions.destination}`)}</p>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {(mlPredictions?.predictions || []).map((p, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{p.course_title}</p>
                <p className="text-xs text-gray-500">{p.course_code}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div className="w-24 bg-gray-200 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full" style={{
                    width: `${(p.pass_probability || 0) * 100}%`,
                    backgroundColor: p.pass_probability >= 0.7 ? '#10b981' : (p.pass_probability >= 0.4 ? '#f59e0b' : '#ef4444')
                  }} />
                </div>
                <span className={'text-sm font-bold ' + (p.pass_probability >= 0.7 ? 'text-green-600' : (p.pass_probability >= 0.4 ? 'text-yellow-600' : 'text-red-600'))}>{((p.pass_probability || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
          {(!mlPredictions?.predictions || mlPredictions.predictions.length === 0) && <p className="text-gray-400 text-center py-4 col-span-2">{data?.courses?.length > 0 ? t('dashboard.predictionError') : t('dashboard.noPredictionsYet')}</p>}
        </div>
      </div>

      {/* Course List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.myCourses')}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {(courses || []).map((c, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{c.courseTitle}</p>
                <p className="text-xs text-gray-500">{c.teacher} - {c.semester}</p>
              </div>
              <div className="text-right">
                {c.isPublished ? (
                  <>
                    <p className="font-bold text-gray-900">{c.grade}</p>
                    <p className={'text-xs font-medium ' + (c.gradeLetter?.startsWith('A') || c.gradeLetter?.startsWith('B') ? 'text-green-600' : c.gradeLetter?.startsWith('C') ? 'text-yellow-600' : 'text-red-600')}>{c.gradeLetter}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">{t('dashboard.notPublished')}</p>
                )}
              </div>
            </div>
          ))}
          {(!courses || courses.length === 0) && <p className="text-gray-400 text-center py-4 col-span-2">{t('dashboard.noEnrollments')}</p>}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [classes, setClasses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [mlAnalytics, setMLAnalytics] = useState(null);
  const [mlPredictions, setMLPredictions] = useState(null);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getClasses().catch(() => []),
      user?.role === 'ADMIN' ? getAdminAnalytics().catch(() => null) :
      user?.role === 'TEACHER' ? getTeacherAnalytics().catch(() => null) :
      user?.role === 'STUDENT' ? getStudentAnalytics().catch(() => null) :
      Promise.resolve(null),
      // ML analytics for teacher/admin
      (user?.role === 'TEACHER' || user?.role === 'ADMIN') ? getMLAnalytics().catch(() => null) : Promise.resolve(null),
      // Real at-risk students for teacher
      user?.role === 'TEACHER' ? getTeacherAtRiskStudents().catch(() => []) : Promise.resolve([]),
    ])
      .then(([classesData, analyticsData, mlData, atRiskData]) => {
        setClasses(classesData);
        setAnalytics(analyticsData);
        setMLAnalytics(mlData);
        setAtRiskStudents(atRiskData || []);

        // For students: predict pass probability using predictStudentById (same as Performance page)
        if (user?.role === 'STUDENT' && user?.id) {
          predictStudentById(user.id)
            .then(predData => {
              setMLPredictions(predData || { predictions: [], current_cgpa: 0, expected_cgpa: 0 });
            })
            .catch(err => {
              console.error('ML predict-student failed:', err);
              setMLPredictions({ predictions: [], current_cgpa: 0, expected_cgpa: 0 });
            });
        }
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  if (loading) return <Layout><div className="p-8 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.welcome')}, {user?.fullName?.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.role === 'ADMIN' ? t('dashboard.adminOverview') :
             user?.role === 'TEACHER' ? t('dashboard.teacherOverview') :
             t('dashboard.studentOverview')}
          </p>
        </div>

        {/* Analytics by Role */}
        {user?.role === 'ADMIN' && <AdminAnalytics data={analytics} t={t} />}
        {user?.role === 'TEACHER' && <TeacherAnalytics data={analytics} t={t} mlAnalytics={mlAnalytics} atRiskStudents={atRiskStudents} />}
        {user?.role === 'STUDENT' && <StudentAnalytics data={analytics} mlPredictions={mlPredictions} t={t} />}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {user?.role === 'ADMIN' && (
              <Link to="/admin/academic" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.academicManagement')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.yearsSemesters')}</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'TEACHER' && (
              <Link to="/teacher/grades" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.gradeManagement')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.enterStudentGrades')}</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'STUDENT' && (
              <Link to="/student/registration" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.semesterRegistration')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.registerForCourses')}</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'STUDENT' && (
              <Link to="/student/exams" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.examSchedule')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.midtermFinal')}</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'STUDENT' && (
              <Link to="/student/results" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Award className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.myResults')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.gpaGrades')}</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'STUDENT' && (
              <Link to="/performance" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('dashboard.aiPerformance')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.aiPerformanceDesc')}</p>
                  </div>
                </div>
              </Link>
            )}

            <Link to={user?.role === 'ADMIN' ? '/admin/courses' : '/my-classes'} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.role === 'ADMIN' ? t('dashboard.manageCourses') : t('dashboard.myCourses')}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.viewAllCourses')}</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Classes List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.yourClasses')}</h2>
        </div>

        {classes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noClassesYet')}</h3>
            <p className="text-gray-500">
              {user?.role === 'ADMIN'
                ? t('dashboard.createClasses')
                : t('dashboard.notAddedToClasses')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      <p className="text-sm text-gray-500">{cls.code}</p>
                    </div>
                    {cls.year && (
                      <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded">
                        Year {cls.year}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{cls.teachers?.length || 0} teacher{cls.teachers?.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <GraduationCap className="w-4 h-4" />
                    <span>{cls.students?.length || 0} student{cls.students?.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4" />
                    <span>
                      {user?.role === 'TEACHER'
                        ? (cls.courses?.filter(cc => cc.teacherId === user.id).length || 0)
                        : (cls.courses?.length || 0)
                      } course{cls.courses?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Link
                    to={user?.role === 'ADMIN' ? `/admin/classes` : `/my-classes`}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium rounded-lg transition-colors"
                  >
                    {user?.role === 'ADMIN' ? t('dashboard.manageClasses') : t('dashboard.viewMyClasses')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
