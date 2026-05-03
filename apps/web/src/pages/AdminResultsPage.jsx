import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAdminResults, getSemesters, getCourseSections } from '../api.js';
import Layout from '../components/Layout';
import { Award, Filter, Search, ChevronDown, ChevronUp, BookOpen, User, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

const GRADE_COLORS = {
  'A+': 'bg-green-600', 'A': 'bg-green-600', 'A-': 'bg-green-500',
  'B+': 'bg-blue-600', 'B': 'bg-blue-600', 'B-': 'bg-blue-500',
  'C+': 'bg-yellow-600', 'C': 'bg-yellow-600', 'C-': 'bg-yellow-500',
  'D': 'bg-orange-600',
  'F': 'bg-red-600',
  'I': 'bg-gray-500',
};

export default function AdminResultsPage() {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    loadSemesters();
  }, []);

  useEffect(() => {
    if (selectedSemester) {
      loadSections();
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedSemester]);

  useEffect(() => {
    loadResults();
  }, [selectedSemester, selectedSection]);

  async function loadSemesters() {
    try {
      const data = await getSemesters();
      setSemesters(data);
      const current = data.find(s => s.isCurrent);
      if (current) setSelectedSemester(current.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSections() {
    try {
      const data = await getCourseSections(selectedSemester);
      setSections(data);
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  }

  async function loadResults() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedSemester) params.semesterId = selectedSemester;
      if (selectedSection) params.sectionId = selectedSection;
      const data = await getAdminResults(params);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Group results by section
  const groupedBySection = results.reduce((acc, enrollment) => {
    const sectionId = enrollment.courseSectionId;
    if (!acc[sectionId]) {
      acc[sectionId] = {
        section: enrollment.courseSection,
        enrollments: [],
      };
    }
    acc[sectionId].enrollments.push(enrollment);
    return acc;
  }, {});

  // Filter by search
  const filteredGroups = Object.entries(groupedBySection).map(([sectionId, group]) => {
    if (!search) return [sectionId, group];
    const filtered = group.enrollments.filter(e =>
      e.student?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.student?.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.courseSection?.course?.title?.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length === 0) return null;
    return [sectionId, { ...group, enrollments: filtered }];
  }).filter(Boolean);

  // Stats
  const totalEnrollments = results.length;
  const gradedCount = results.filter(e => e.grade?.isSubmitted).length;
  const publishedCount = results.filter(e => e.grade?.isPublished).length;
  const avgScore = results.filter(e => e.grade?.totalScore != null).reduce((sum, e) => sum + e.grade.totalScore, 0) / (results.filter(e => e.grade?.totalScore != null).length || 1);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Award className="w-7 h-7 text-primary-600" />
            {t('adminResults.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('adminResults.description')}</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('adminResults.filters')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('adminResults.semester')}</label>
              <select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('adminResults.allSemesters')}</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.type} - {s.academicYear?.name || ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('adminResults.section')}</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('adminResults.allSections')}</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.course?.title} ({s.sectionCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('adminResults.search')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('adminResults.searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('adminResults.totalEnrollments')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalEnrollments}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('adminResults.graded')}</p>
            <p className="text-xl font-bold text-blue-600">{gradedCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('adminResults.published')}</p>
            <p className="text-xl font-bold text-green-600">{publishedCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('adminResults.avgScore')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{avgScore.toFixed(1)}</p>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-700 dark:text-red-400">{error}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('adminResults.noResults')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map(([sectionId, group]) => {
              const isExpanded = expandedSection === sectionId || filteredGroups.length === 1;
              const sectionGrades = group.enrollments.filter(e => e.grade?.isSubmitted);
              const sectionAvg = sectionGrades.length > 0
                ? sectionGrades.reduce((sum, e) => sum + (e.grade.totalScore || 0), 0) / sectionGrades.length
                : 0;
              const passCount = sectionGrades.filter(e => e.grade.gradeLetter && e.grade.gradeLetter !== 'F' && e.grade.gradeLetter !== 'I').length;

              return (
                <div key={sectionId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Section Header */}
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : sectionId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-primary-600" />
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {group.section?.course?.title || t('adminResults.unknownCourse')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {group.section?.sectionCode} | {group.section?.teacher?.fullName || t('adminResults.noTeacher')} | {group.enrollments.length} {t('adminResults.students')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('adminResults.avg')}: <span className="font-semibold text-gray-900 dark:text-white">{sectionAvg.toFixed(1)}</span></span>
                        <span className="text-gray-500 dark:text-gray-400">{t('adminResults.passRate')}: <span className="font-semibold text-green-600">{sectionGrades.length > 0 ? ((passCount / sectionGrades.length) * 100).toFixed(0) : 0}%</span></span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </button>

                  {/* Students Table */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.student')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.quiz')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.assignment')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.midterm')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.final')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.attendance')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.total')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.grade')}</th>
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('adminResults.status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {group.enrollments.map(enrollment => {
                              const g = enrollment.grade;
                              return (
                                <tr key={enrollment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-gray-400" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 dark:text-white">{enrollment.student?.fullName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{enrollment.student?.email}</div>
                                      </div>
                                      <Link
                                        to={`/admin/students/${enrollment.studentId}/transcript?admin=1`}
                                        className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-blue-700 hover:bg-blue-800 text-white rounded transition-colors"
                                        title={t('results.viewTranscript')}
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span className="hidden sm:inline">{t('results.viewTranscript')}</span>
                                      </Link>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center text-gray-900 dark:text-white">{g?.quizScore != null ? g.quizScore : '-'}</td>
                                  <td className="px-3 py-3 text-center text-gray-900 dark:text-white">{g?.assignmentScore != null ? g.assignmentScore : '-'}</td>
                                  <td className="px-3 py-3 text-center text-gray-900 dark:text-white">{g?.midtermScore != null ? g.midtermScore : '-'}</td>
                                  <td className="px-3 py-3 text-center text-gray-900 dark:text-white">{g?.finalScore != null ? g.finalScore : '-'}</td>
                                  <td className="px-3 py-3 text-center text-gray-900 dark:text-white">{g?.attendanceScore != null ? g.attendanceScore : '-'}</td>
                                  <td className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">{g?.totalScore != null ? g.totalScore : '-'}</td>
                                  <td className="px-3 py-3 text-center">
                                    {g?.gradeLetter ? (
                                      <span className={`px-2 py-1 rounded text-white text-xs font-bold ${GRADE_COLORS[g.gradeLetter] || 'bg-gray-500'}`}>
                                        {g.gradeLetter}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {g?.isPublished ? (
                                      <span className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                                        <CheckCircle className="w-3 h-3" /> {t('adminResults.published')}
                                      </span>
                                    ) : g?.isSubmitted ? (
                                      <span className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                        <Clock className="w-3 h-3" /> {t('adminResults.submitted')}
                                      </span>
                                    ) : (
                                      <span className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                        <XCircle className="w-3 h-3" /> {t('adminResults.notGraded')}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
