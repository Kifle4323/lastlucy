import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getClasses, getTeacherSections, getMyEnrollments } from '../api';
import Layout from '../components/Layout';
import { 
  GraduationCap, 
  BookOpen, 
  Users, 
  ChevronRight,
  ChevronDown,
  User,
  FileText,
  Calendar,
  MapPin,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MyClassesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClasses, setExpandedClasses] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getClasses().catch(() => []),
      user?.role === 'TEACHER' ? getTeacherSections().catch(() => []) : 
      user?.role === 'STUDENT' ? getMyEnrollments().catch(() => []) : Promise.resolve([])
    ])
      .then(([classesData, sectionsData]) => {
        setClasses(classesData);
        setSections(sectionsData);
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  const toggleClass = (classId) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));
  };

  if (loading) return <Layout><div className="p-8 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.myClasses')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user?.role === 'TEACHER' ? t('myClasses.classesTeaching') : t('myClasses.classesEnrolled')}
          </p>
        </div>

        
        {/* Teachers see Classes with Course Sections inside */}
        {user?.role === 'TEACHER' && sections.length === 0 && classes.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('myClasses.noClassesAssigned')}</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t('myClasses.noClassesAssignedDesc')}
            </p>
          </div>
        )}

        {/* Teachers: Show Classes with Course Sections */}
        {user?.role === 'TEACHER' && (
          <>
            {(() => {
              // Safely filter sections
              const sectionsWithClass = sections.filter(s => s.classId && s.class);
              const sectionsWithoutClass = sections.filter(s => !s.classId || !s.class);
              
              // Group by class
              const classMap = new Map();
              sectionsWithClass.forEach(section => {
                if (!section.class) return;
                if (!classMap.has(section.classId)) {
                  classMap.set(section.classId, {
                    class: section.class,
                    sections: []
                  });
                }
                classMap.get(section.classId).sections.push(section);
              });

              return (
                <>
                  {/* Classes with Course Sections - Always visible */}
                  {Array.from(classMap.values()).map(({ class: cls, sections: classSections }) => (
                    <div key={cls.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                      {/* Class Header - clickable */}
                      <Link
                        to={`/courses/${classSections[0]?.courseId}?sectionId=${classSections[0]?.id}`}
                        className="block p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{cls.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>{cls.code}</span>
                                {cls.year && (
                                  <>
                                    <span>·</span>
                                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded">
                                      {t('myClasses.year')} {cls.year}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full">
                              {classSections.length} {classSections.length !== 1 ? t('addDrop.courses') : t('myClasses.course')}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </Link>

                      {/* Course Sections - Always visible */}
                      <div className="p-5">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {classSections.map((section) => {
                            const isCompleted = section.allGradesSubmitted;
                            const isCurrent = !section.allGradesSubmitted && section.isCurrentSemester;
                            return (
                            <div 
                              key={section.id} 
                              className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                                isCompleted 
                                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-75' 
                                  : isCurrent 
                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className={`w-5 h-5 ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-primary-600 dark:text-primary-400'}`} />
                                  <span className={`font-medium ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{section.course?.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {isCompleted && (
                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> {t('myClasses.completed')}
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t('myClasses.current')}
                                    </span>
                                  )}
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                                    {section.sectionCode}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{section.course?.code}</p>
                              
                              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{section.semester?.name}</span>
                                </div>
                                {section.schedule && (
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{section.schedule}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  <span>{section._count?.enrollments || 0} {t('nav.students').toLowerCase()}</span>
                                </div>
                              </div>

                              {!isCompleted ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  to={`/courses/${section.courseId}?sectionId=${section.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded hover:bg-primary-700 transition-colors"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t('nav.assessments')}
                                </Link>
                                <Link
                                  to={`/teacher/grades?section=${section.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t('nav.gradebook')}
                                </Link>
                              </div>
                              ) : (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  to={`/teacher/grades?section=${section.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {t('myClasses.viewResults')}
                                </Link>
                              </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Course Sections without Class */}
                  {sectionsWithoutClass.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {t('myClasses.otherCourseSections')}
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sectionsWithoutClass.map((section) => {
                          const isCompleted = section.allGradesSubmitted;
                          const isCurrent = !section.allGradesSubmitted && section.isCurrentSemester;
                          return (
                          <div 
                            key={section.id} 
                            className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${
                              isCompleted 
                                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-75' 
                                : isCurrent 
                                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className={`font-semibold ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{section.course?.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{section.course?.code}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                {isCompleted && (
                                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> {t('myClasses.completed')}
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {t('myClasses.current')}
                                  </span>
                                )}
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                                  {section.sectionCode}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{section.semester?.name} {section.semester?.academicYear?.year}</span>
                              </div>
                              {section.schedule && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  <span>{section.schedule}</span>
                                </div>
                              )}
                              {section.room && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{section.room}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4" />
                                <span>{section._count?.enrollments || 0} {t('nav.students').toLowerCase()}</span>
                              </div>
                            </div>

                            {!isCompleted ? (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={`/courses/${section.courseId}?sectionId=${section.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded hover:bg-primary-700 transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                {t('nav.assessments')}
                              </Link>
                              <Link
                                to={`/teacher/grades?section=${section.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                {t('nav.gradebook')}
                              </Link>
                            </div>
                            ) : (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={`/teacher/grades?section=${section.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                {t('myClasses.viewResults')}
                              </Link>
                            </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Students: Show enrolled courses */}
        {user?.role === 'STUDENT' && sections.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('myClasses.noCoursesEnrolled')}</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t('myClasses.noCoursesEnrolledDesc')}
            </p>
          </div>
        )}

        {/* Students: Show enrolled CourseSections grouped by class */}
        {user?.role === 'STUDENT' && sections.length > 0 && (
          <>
            {(() => {
              // Group enrollments by class
              const sectionsWithClass = sections.filter(s => s.courseSection?.classId && s.courseSection?.class);
              const sectionsWithoutClass = sections.filter(s => !s.courseSection?.classId || !s.courseSection?.class);
              
              // Group by class
              const classMap = new Map();
              sectionsWithClass.forEach(enrollment => {
                const cls = enrollment.courseSection?.class;
                if (!cls) return;
                if (!classMap.has(cls.id)) {
                  classMap.set(cls.id, {
                    class: cls,
                    enrollments: []
                  });
                }
                classMap.get(cls.id).enrollments.push(enrollment);
              });

              return (
                <>
                  {/* Classes with Courses - Always visible */}
                  {Array.from(classMap.values()).map(({ class: cls, enrollments: classEnrollments }) => (
                    <div key={cls.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                      {/* Class Header - clickable */}
                      <Link
                        to={`/courses/${classEnrollments[0]?.courseSection?.courseId}`}
                        className="block p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{cls.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>{cls.code}</span>
                                {cls.year && (
                                  <>
                                    <span>·</span>
                                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded">
                                      {t('myClasses.year')} {cls.year}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full">
                              {classEnrollments.length} {classEnrollments.length !== 1 ? t('addDrop.courses') : t('myClasses.course')}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </Link>

                      {/* Courses - Always visible */}
                      <div className="p-5">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {classEnrollments.map((enrollment) => {
                            const isCompleted = enrollment.gradeSubmitted;
                            const isCurrent = !enrollment.isPastSemester && !enrollment.gradeSubmitted;
                            return (
                            <div 
                              key={enrollment.id} 
                              className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                                isCompleted 
                                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-75' 
                                  : isCurrent 
                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className={`w-5 h-5 ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-primary-600 dark:text-primary-400'}`} />
                                  <span className={`font-medium ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{enrollment.courseSection?.course?.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {isCompleted && (
                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> {t('myClasses.completed')}
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t('myClasses.current')}
                                    </span>
                                  )}
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                                    {enrollment.courseSection?.sectionCode}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{enrollment.courseSection?.course?.code}</p>
                              
                              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{enrollment.courseSection?.semester?.name}</span>
                                </div>
                                {enrollment.courseSection?.teacher && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>{enrollment.courseSection?.teacher?.fullName}</span>
                                  </div>
                                )}
                                {enrollment.courseSection?.schedule && (
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{enrollment.courseSection?.schedule}</span>
                                  </div>
                                )}
                              </div>

                              {!isCompleted ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  to={`/student/results`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded hover:bg-primary-700 transition-colors"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t('myClasses.viewResults')}
                                </Link>
                                <Link
                                  to={`/courses/${enrollment.courseSection?.courseId}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  {t('myClasses.takeAssessments')}
                                </Link>
                              </div>
                              ) : (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  to={`/student/results`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t('myClasses.viewResults')}
                                </Link>
                              </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Courses without Class */}
                  {sectionsWithoutClass.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {t('myClasses.otherCourses')}
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sectionsWithoutClass.map((enrollment) => (
                          <div 
                            key={enrollment.id} 
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{enrollment.courseSection?.course?.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{enrollment.courseSection?.course?.code}</p>
                              </div>
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                                {enrollment.courseSection?.sectionCode}
                              </span>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{enrollment.courseSection?.semester?.name}</span>
                              </div>
                              {enrollment.courseSection?.teacher && (
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  <span>{enrollment.courseSection?.teacher?.fullName}</span>
                                </div>
                              )}
                              {enrollment.courseSection?.schedule && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  <span>{enrollment.courseSection?.schedule}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={`/student/results`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded hover:bg-primary-700 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                {t('myClasses.viewResults')}
                              </Link>
                              <Link
                                to={`/courses/${enrollment.courseSection?.courseId}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                {t('myClasses.takeAssessments')}
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </Layout>
  );
}
