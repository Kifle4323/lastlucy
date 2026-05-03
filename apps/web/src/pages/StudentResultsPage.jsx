import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyResults, getMyCGPA, getMyEnrollments, getStudentGraduationStatus, getStudentCertificates, studentGenerateCertificate } from '../api.js';
import Layout from '../components/Layout';
import { GraduationCap, Award, CheckCircle, XCircle, Clock, Download, Eye, FileText } from 'lucide-react';

export default function StudentResultsPage() {
  const { t } = useTranslation();
  const [currentResults, setCurrentResults] = useState(null);
  const [cgpaData, setCgpaData] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportView, setReportView] = useState(true);
  const [graduationStatus, setGraduationStatus] = useState(null);
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [results, cgpa, enrollData, gradStatus, certs] = await Promise.all([
        getMyResults(),
        getMyCGPA(),
        getMyEnrollments(),
        getStudentGraduationStatus().catch(() => null),
        getStudentCertificates().catch(() => []),
      ]);
      setCurrentResults(results);
      setCgpaData(cgpa);
      setEnrollments(enrollData);
      setGraduationStatus(gradStatus);
      setCertificates(certs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function viewSemesterResults(semesterId) {
    try {
      const results = await getMyResults(semesterId);
      setCurrentResults(results);
      setSelectedSemester(semesterId);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <Layout><div className="p-8">{t('common.loading')}</div></Layout>;

  const activeSemesterName = currentResults?.semester?.name || t('results.currentSemester');
  const activeAcademicYear = currentResults?.semester?.academicYear?.name;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('results.myAcademicResults')}</h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/transcript"
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              {t('results.viewTranscript')}
            </Link>
            <button
              onClick={() => setReportView(v => !v)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
              {reportView ? t('results.switchToNormal') : t('results.switchToReport')}
            </button>
            {currentResults?.courses?.length > 0 && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white text-sm"
              >
                {t('results.printReport')}
              </button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4">{error}</div>}

      {/* CGPA Card */}
      {cgpaData && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-4 sm:p-6 mb-6 text-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold">{cgpaData.cgpa?.toFixed(2) || '-'}</div>
              <div className="text-xs sm:text-sm opacity-80">{t('grade.cgpa')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold">{cgpaData.totalCredits || 0}</div>
              <div className="text-xs sm:text-sm opacity-80">{t('results.totalCredits')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold">{cgpaData.totalCourses || 0}</div>
              <div className="text-xs sm:text-sm opacity-80">{t('results.coursesCompleted')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold">{cgpaData.semesters?.length || 0}</div>
              <div className="text-xs sm:text-sm opacity-80">{t('results.semesters')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Semester GPA History */}
      {cgpaData?.semesters?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('results.semesterHistory')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cgpaData.semesters.map(sem => (
              <button
                key={sem.semester.id}
                onClick={() => viewSemesterResults(sem.semester.id)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedSemester === sem.semester.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">{sem.semester.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{sem.semester.academicYear?.name}</div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('grade.gpa')}: <strong>{sem.gpa.toFixed(2)}</strong></span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.creditHours')}: {sem.credits}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current/Selected Semester Results */}
      {currentResults && (
        reportView ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden print:shadow-none print:border print:border-gray-200">
            <div className="bg-blue-700 dark:bg-blue-800 text-white px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{activeSemesterName}</div>
                  {activeAcademicYear && (
                    <div className="text-sm opacity-90">{activeAcademicYear}</div>
                  )}
                </div>
                <div className="text-right">
                  {currentResults.gpa !== null && (
                    <div>
                      <div className="text-xs opacity-80">{t('grade.semesterGpa')}</div>
                      <div className="text-2xl font-extrabold">{currentResults.gpa.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentResults.courses?.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      <th className="text-left p-3 font-semibold whitespace-nowrap">{t('course.code')}</th>
                      <th className="text-left p-3 font-semibold">{t('course.title')}</th>
                      <th className="text-center p-3 font-semibold whitespace-nowrap">{t('dashboard.creditHours')}</th>
                      <th className="text-center p-3 font-semibold whitespace-nowrap">{t('common.total')}</th>
                      <th className="text-center p-3 font-semibold whitespace-nowrap">{t('grade.grade')}</th>
                      <th className="text-center p-3 font-semibold whitespace-nowrap">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentResults.courses.map(course => (
                      <tr key={course.id} className="border-t dark:border-gray-700">
                        <td className="p-3 align-top font-medium text-gray-900 dark:text-white">
                          {course.course?.code || '-'}
                        </td>
                        <td className="p-3 align-top">
                          <div className="font-medium text-gray-900 dark:text-white">{course.course?.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{course.sectionCode}</div>
                        </td>
                        <td className="p-3 align-top text-center text-gray-900 dark:text-white">{course.creditHours}</td>
                        <td className="p-3 align-top text-center font-semibold text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.totalScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 align-top text-center">
                          {course.grade?.isPublished && course.grade?.gradeLetter ? (
                            <span className="inline-block min-w-10 px-2 py-1 rounded bg-green-700 text-white text-xs font-semibold">
                              {course.grade.gradeLetter}
                            </span>
                          ) : course.grade?.isSubmitted ? (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">{t('results.pending')}</span>
                          ) : (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">-</span>
                          )}
                        </td>
                        <td className="p-3 align-top text-center">
                          {course.grade?.isPublished ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">{t('results.published')}</span>
                          ) : course.grade?.isSubmitted ? (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">{t('results.submitted')}</span>
                          ) : (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{t('results.notGraded')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('results.noCoursesFound')}</p>
            )}

            <div className="px-4 sm:px-6 py-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 dark:text-gray-300">
                <div>
                  <div className="font-semibold mb-1">{t('results.gradingScale')}</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div>A+ (90-100): 4.0</div>
                    <div>A (85-89): 4.0</div>
                    <div>A- (80-84): 3.75</div>
                    <div>B+ (75-79): 3.5</div>
                    <div>B (70-74): 3.0</div>
                    <div>B- (65-69): 2.75</div>
                    <div>C+ (60-64): 2.5</div>
                    <div>C (50-59): 2.0</div>
                    <div>C- (45-49): 1.75</div>
                    <div>D (40-44): 1.0</div>
                    <div>F (&lt;40): 0.0</div>
                  </div>
                </div>
                <div className="md:text-right">
                  {cgpaData?.cgpa !== null && (
                    <div>
                      <div className="font-semibold">{t('grade.cgpa')}</div>
                      <div className="text-lg font-extrabold text-green-700 dark:text-green-400">{cgpaData.cgpa?.toFixed(2)}</div>
                    </div>
                  )}
                  <div className="mt-2 text-gray-600 dark:text-gray-400">{t('results.generated')}: {new Date().toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeSemesterName}</h2>
                {activeAcademicYear && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activeAcademicYear}</p>
                )}
              </div>
              {currentResults.gpa !== null && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{currentResults.gpa.toFixed(2)}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('grade.semesterGpa')}</div>
                </div>
              )}
            </div>

            {currentResults.courses?.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">{t('results.course')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{t('dashboard.creditHours')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('results.quiz')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('results.midterm')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('results.final')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{t('dashboard.attendance')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('common.total')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('grade.grade')}</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-400">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentResults.courses.map(course => (
                      <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b dark:border-gray-700">
                        <td className="p-3">
                          <div className="font-medium text-gray-900 dark:text-white">{course.course?.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{course.course?.code} | {course.sectionCode}</div>
                        </td>
                        <td className="p-3 text-center text-gray-900 dark:text-white">{course.creditHours}</td>
                        <td className="p-3 text-center text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.quizScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 text-center text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.midtermScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 text-center text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.finalScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 text-center text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.attendanceScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 text-center font-medium text-gray-900 dark:text-white">
                          {course.grade?.isPublished ? (course.grade?.totalScore ?? '-') : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {course.grade?.isPublished && course.grade?.gradeLetter ? (
                            <span className={`px-2 py-1 rounded text-white ${
                              course.grade.gradeLetter.startsWith('A') ? 'bg-green-600' :
                              course.grade.gradeLetter.startsWith('B') ? 'bg-blue-600' :
                              course.grade.gradeLetter.startsWith('C') ? 'bg-yellow-600' :
                              course.grade.gradeLetter === 'D' ? 'bg-orange-600' :
                              'bg-red-600'
                            }`}>
                              {course.grade.gradeLetter}
                            </span>
                          ) : course.grade?.isSubmitted ? (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{t('results.pending')}</span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {course.grade?.isPublished ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">{t('results.published')}</span>
                          ) : course.grade?.isSubmitted ? (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">{t('results.submitted')}</span>
                          ) : (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{t('results.notGraded')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('results.noCoursesFound')}</p>
            )}
          </div>
        )
      )}

      {/* My Enrollments */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('results.myEnrollments')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrollments.map(enrollment => (
            <div key={enrollment.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-700">
              <div className="font-medium text-gray-900 dark:text-white">{enrollment.courseSection?.course?.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {enrollment.courseSection?.course?.code} | {enrollment.courseSection?.sectionCode}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {enrollment.courseSection?.semester?.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('course.teacher')}: {enrollment.courseSection?.teacher?.fullName}
              </div>
              {enrollment.grade?.isPublished && (
                <div className="mt-2 flex justify-between items-center">
                  <span className={`px-2 py-1 rounded text-white text-sm ${
                    enrollment.grade.gradeLetter?.startsWith('A') ? 'bg-green-600' :
                    enrollment.grade.gradeLetter?.startsWith('B') ? 'bg-blue-600' :
                    enrollment.grade.gradeLetter?.startsWith('C') ? 'bg-yellow-600' :
                    enrollment.grade.gradeLetter === 'D' ? 'bg-orange-600' :
                    'bg-red-600'
                  }`}>
                    {enrollment.grade.gradeLetter}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{enrollment.grade.totalScore}/100</span>
                </div>
              )}
            </div>
          ))}
          {enrollments.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 col-span-full">{t('results.noEnrollmentsFound')}</p>
          )}
        </div>
      </div>

      {/* Graduation Status & Certificate */}
      {graduationStatus && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            {t('results.graduationStatus')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className={`p-4 rounded-lg border ${graduationStatus.creditHoursMet ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.creditHours')}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{graduationStatus.totalCreditHours} / {graduationStatus.minCreditHoursRequired}</div>
              <div className="flex items-center gap-1 mt-1">
                {graduationStatus.creditHoursMet ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                <span className={`text-sm ${graduationStatus.creditHoursMet ? 'text-green-600' : 'text-red-600'}`}>
                  {graduationStatus.creditHoursMet ? t('results.requirementMet') : t('results.notYetMet')}
                </span>
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${graduationStatus.gradeMet ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('grade.cgpa')}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{graduationStatus.cgpa?.toFixed(2)} / {graduationStatus.minGradeRequired?.toFixed(1)}</div>
              <div className="flex items-center gap-1 mt-1">
                {graduationStatus.gradeMet ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                <span className={`text-sm ${graduationStatus.gradeMet ? 'text-green-600' : 'text-red-600'}`}>
                  {graduationStatus.gradeMet ? t('results.requirementMet') : t('results.notYetMet')}
                </span>
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${graduationStatus.eligible ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'}`}>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('results.overallStatus')}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{graduationStatus.eligible ? t('results.eligible') : t('results.inProgress')}</div>
              <div className="flex items-center gap-1 mt-1">
                {graduationStatus.eligible ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Clock className="w-4 h-4 text-yellow-600" />}
                <span className={`text-sm ${graduationStatus.eligible ? 'text-green-600' : 'text-yellow-600'}`}>
                  {graduationStatus.eligible ? t('results.readyForCertificate') : t('results.keepGoing')}
                </span>
              </div>
            </div>
          </div>
          {graduationStatus.department && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('course.department')}: {graduationStatus.department.name} ({graduationStatus.department.code})</p>
          )}
          {graduationStatus.eligible && graduationStatus.certificate && (
            <div className="mt-4">
              <Link
                to={`/certificates/${graduationStatus.certificate.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <Award className="w-4 h-4" />
                {t('results.viewCertificate')}
              </Link>
            </div>
          )}
          {graduationStatus.eligible && !graduationStatus.certificate && (
            <div className="mt-4">
              <button
                onClick={async () => {
                  try {
                    const cert = await studentGenerateCertificate();
                    setGraduationStatus(prev => ({ ...prev, certificate: cert }));
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <Award className="w-4 h-4" />
                {t('results.generateCertificate')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" />
            {t('results.myCertificates')}
          </h2>
          <div className="space-y-4">
            {certificates.map(cert => (
              <div key={cert.id} className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="font-medium text-green-800 dark:text-green-300">{cert.department?.name || t('results.certificate')}</div>
                    <div className="text-sm text-green-600 dark:text-green-400">{t('results.certificateNumber')}: {cert.certificateNumber}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t('grade.cgpa')}: {cert.cgpa?.toFixed(2)} | {t('dashboard.creditHours')}: {cert.totalCreditHours}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {t('results.issued')}: {new Date(cert.issuedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Link
                      to={`/certificates/${cert.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t('results.viewCertificate')}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
    </Layout>
  );
}
