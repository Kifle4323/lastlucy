import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { getGradeComponents, addGradeComponent, updateGradeComponent, deleteGradeComponent, getGradebook, getAttendance, setAttendance, getMyGrades } from '../api';
import Layout from '../components/Layout';
import {
  ChevronLeft,
  Settings,
  Users,
  Calculator,
  Save,
  Award,
  BookOpen,
  Clock,
  UserCheck,
  TrendingUp,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GradebookPage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [gradebook, setGradebook] = useState(null);
  const [myGrades, setMyGrades] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [activeView, setActiveView] = useState('gradebook');
  const [saving, setSaving] = useState(false);
  const [newComponent, setNewComponent] = useState({ name: '', weight: '' });

  useEffect(() => {
    setLoading(true);
    if (user?.role === 'TEACHER') {
      Promise.all([
        getGradeComponents(courseId).then(setComponents),
        getGradebook(courseId).then(data => {
          setGradebook(data);
          setComponents(data.components || components);
          // Initialize attendance state
          const attMap = {};
          data.gradebook.forEach(g => {
            const attComponent = (data.components || []).find(c => c.name === 'Attendance');
            const percent = attComponent && g.componentPercentages ? g.componentPercentages[attComponent.id] || 0 : 0;
            attMap[g.student.id] = percent;
          });
          setAttendance(attMap);
        }),
      ]).finally(() => setLoading(false));
    } else if (user?.role === 'STUDENT') {
      getMyGrades(courseId).then(setMyGrades).finally(() => setLoading(false));
    }
  }, [courseId, user?.role]);

  const handleAddComponent = async () => {
    if (!newComponent.name || !newComponent.weight) return;
    const newTotal = components.reduce((s, c) => s + c.weight, 0) + parseInt(newComponent.weight);
    if (newTotal > 100) {
      toast.error(t('gradebook.totalWeightExceed', { total: newTotal }));
      return;
    }
    try {
      const created = await addGradeComponent(courseId, newComponent.name, parseInt(newComponent.weight));
      setComponents([...components, created]);
      setNewComponent({ name: '', weight: '' });
      toast.success(t('gradebook.componentAdded'));
    } catch (err) {
      toast.error(t('gradebook.failedAdd') + ': ' + err.message);
    }
  };

  const handleLocalUpdateComponent = (componentId, field, value) => {
    setComponents(components.map(c => c.id === componentId ? { ...c, [field]: field === 'weight' ? parseInt(value) || 0 : value } : c));
  };

  const handleSaveComponents = async () => {
    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    if (totalWeight !== 100) {
      toast.error(t('gradebook.mustTotal100', { total: totalWeight }));
      return;
    }
    setSaving(true);
    try {
      // Save each component
      for (const comp of components) {
        await updateGradeComponent(courseId, comp.id, { name: comp.name, weight: comp.weight });
      }
      toast.success(t('gradebook.componentsSaved'));
    } catch (err) {
      toast.error(t('gradebook.failedSave') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (componentId) => {
    try {
      await deleteGradeComponent(courseId, componentId);
      setComponents(components.filter(c => c.id !== componentId));
      toast.success(t('gradebook.componentDeleted'));
    } catch (err) {
      toast.error(t('gradebook.failedDelete') + ': ' + err.message);
    }
  };

  const handleAttendanceChange = (studentId, value) => {
    setAttendance({ ...attendance, [studentId]: Math.round(parseFloat(value) || 0) });
  };

  const handleSaveAttendance = async (studentId) => {
    if (attendance[studentId] === undefined) {
      toast.error(t('gradebook.attendanceNotLoaded'));
      return;
    }
    try {
      await setAttendance(courseId, studentId, attendance[studentId]);
      toast.success(t('gradebook.attendanceSaved'));
    } catch (err) {
      toast.error(t('gradebook.failedSave') + ': ' + err.message);
    }
  };

  const handleSaveAllAttendance = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(attendance).map(([studentId, score]) => {
        if (score === undefined) return Promise.resolve();
        return setAttendance(courseId, studentId, score);
      });
      await Promise.all(promises);
      toast.success(t('gradebook.allAttendanceSaved'));
    } catch (err) {
      toast.error(t('gradebook.failedSaveSome') + ': ' + err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  // Student view
  if (user?.role === 'STUDENT' && myGrades) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Link to={`/course/${courseId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ChevronLeft className="w-5 h-5" />
            {t('gradebook.backToCourse')}
          </Link>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('gradebook.myGrades')}</h1>
            <p className="text-gray-500">{t('gradebook.overallPerformance')}</p>
          </div>

          {/* Total Grade Card */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl shadow-lg p-8 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm font-medium">{t('gradebook.totalGrade')}</p>
                <p className="text-5xl font-bold mt-2">{myGrades.totalGrade !== null && myGrades.totalGrade !== undefined ? `${myGrades.totalGrade}/100` : t('gradebook.notGraded')}</p>
              </div>
              <Award className="w-16 h-16 text-primary-200" />
            </div>
          </div>

          {/* Grade Breakdown - Dynamic Components */}
          <div className="grid gap-4 md:grid-cols-2">
            {(myGrades.components || []).map(comp => {
              const mark = myGrades.componentMarks?.[comp.id];
              const hasGrade = mark !== undefined && mark !== null;
              const details = myGrades.componentDetails?.[comp.id] || [];
              return (
                <div key={comp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      comp.name === 'Attendance' ? 'bg-green-100' :
                      comp.name === 'Final' ? 'bg-red-100' :
                      comp.name === 'Midterm' ? 'bg-yellow-100' :
                      comp.name === 'Assignment' ? 'bg-emerald-100' :
                      'bg-blue-100'
                    }`}>
                      {comp.name === 'Attendance' ? <UserCheck className="w-5 h-5 text-green-600" /> :
                       comp.name === 'Final' ? <Award className="w-5 h-5 text-red-600" /> :
                       comp.name === 'Midterm' ? <Clock className="w-5 h-5 text-yellow-600" /> :
                       <BookOpen className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                      <p className="text-sm text-gray-500">{comp.weight}% {t('gradebook.weight')}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{hasGrade ? `${mark}/${comp.weight}` : t('gradebook.notGraded')}</p>
                  {details.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {details.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">{d.title}</span>
                          <span className="font-medium">{d.score}/{d.maxScore}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Layout>
    );
  }

  // Teacher view
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <Link to={`/course/${courseId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ChevronLeft className="w-5 h-5" />
          {t('gradebook.backToCourse')}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('nav.gradebook')}</h1>
            <p className="text-gray-500">{t('gradebook.manageGradesAttendance')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveView('gradebook')}
              className={`px-4 py-2 font-medium rounded-lg ${activeView === 'gradebook' ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              <Calculator className="w-4 h-4 inline mr-2" />
              {t('nav.gradebook')}
            </button>
            <button
              onClick={() => setActiveView('config')}
              className={`px-4 py-2 font-medium rounded-lg ${activeView === 'config' ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              {t('gradebook.weights')}
            </button>
            {/* <button
              onClick={() => setActiveView('attendance')}
              className={`px-4 py-2 font-medium rounded-lg ${activeView === 'attendance' ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              <UserCheck className="w-4 h-4 inline mr-2" />
              {t('nav.attendance')}
            </button> */}
            {user?.role === 'TEACHER' && (
              <Link
                to={`/teacher/grades?course=${courseId}`}
                className="px-4 py-2 font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                {t('gradebook.semesterGrades')}
              </Link>
            )}
          </div>
        </div>

        {/* Weight Configuration - Dynamic Components */}
        {activeView === 'config' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('gradebook.gradeComponentsWeights')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('gradebook.componentsDesc')}</p>

            <div className="space-y-3">
              {components.map(comp => (
                <div key={comp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={comp.name}
                    onChange={(e) => handleLocalUpdateComponent(comp.id, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder={t('gradebook.componentName')}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={comp.weight}
                      onChange={(e) => handleLocalUpdateComponent(comp.id, 'weight', e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <button
                    onClick={() => handleDeleteComponent(comp.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new component */}
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={newComponent.name}
                onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder={t('gradebook.newComponentPlaceholder')}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={newComponent.weight}
                onChange={(e) => setNewComponent({ ...newComponent, weight: e.target.value })}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center text-sm"
                placeholder="%"
              />
              <button
                onClick={handleAddComponent}
                disabled={!newComponent.name || !newComponent.weight || components.reduce((s, c) => s + c.weight, 0) >= 100}
                className="px-4 py-2 bg-primary-900 hover:bg-primary-800 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t('common.add')}
              </button>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {t('common.total')}: <span className={`font-bold ${components.reduce((s, c) => s + c.weight, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {components.reduce((s, c) => s + c.weight, 0)}%
                  </span>
                </p>
                <button
                  onClick={handleSaveComponents}
                  disabled={saving || components.reduce((s, c) => s + c.weight, 0) !== 100}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? t('settings.saving') : t('gradebook.saveChanges')}
                </button>
              </div>
              {components.reduce((s, c) => s + c.weight, 0) !== 100 && (
                <p className="text-xs text-red-500 mt-2">{t('gradebook.weightsMustTotal100')}</p>
              )}
            </div>
          </div>
        )}

        {/* Attendance Entry - Grouped by Class */}
        {/* {activeView === 'attendance' && gradebook && (() => {
          // Group students by class
          const classGroups = {};
          gradebook.gradebook.forEach(g => {
            const cls = g.student.className || 'Unassigned';
            if (!classGroups[cls]) classGroups[cls] = [];
            classGroups[cls].push(g);
          });
          const classNames = Object.keys(classGroups).sort();

          return (
            <div className="space-y-6">
              {classNames.map(cls => (
                <div key={cls} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{cls}</h3>
                          <p className="text-xs text-gray-500">{classGroups[cls].length} student{classGroups[cls].length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const promises = classGroups[cls].map(g =>
                            setAttendance(courseId, g.student.id, attendance[g.student.id] || 0)
                          );
                          Promise.all(promises).then(() => toast.success(`Attendance saved for ${cls}`)).catch(() => toast.error('Failed to save'));
                        }}
                        disabled={saving}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg inline-flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {t('gradebook.saveClass')}
                      </button>
                    </div>
                  </div>

                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('gradebook.student')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">{t('gradebook.score')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {classGroups[cls].map((g) => (
                        <tr key={g.student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-primary-700 font-medium text-sm">
                                  {g.student.fullName?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{g.student.fullName}</p>
                                <p className="text-xs text-gray-500">{g.student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={attendance[g.student.id] || 0}
                                onChange={(e) => handleAttendanceChange(g.student.id, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-200 rounded text-center"
                              />
                              <span className="text-gray-500">/100</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleSaveAttendance(g.student.id)}
                              className="px-3 py-1 bg-primary-900 hover:bg-primary-800 text-white text-sm font-medium rounded"
                            >
                              {t('common.save')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  onClick={handleSaveAllAttendance}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {t('gradebook.saveAllAttendance')}
                </button>
              </div>
            </div>
          );
        })()} */}

        {/* Gradebook View - Grouped by Class */}
        {activeView === 'gradebook' && gradebook && (() => {
          const allComponents = gradebook.components || components;
          // Group students by class
          const classGroups = {};
          gradebook.gradebook.forEach(g => {
            const cls = g.student.className || 'Unassigned';
            if (!classGroups[cls]) classGroups[cls] = [];
            classGroups[cls].push(g);
          });
          const classNames = Object.keys(classGroups).sort();

          return (
            <div className="space-y-6">
              {classNames.map(cls => (
                <div key={cls} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{cls}</h3>
                        <p className="text-xs text-gray-500">{classGroups[cls].length} student{classGroups[cls].length !== 1 ? 's' : ''} | {allComponents.map(c => `${c.name}: ${c.weight}%`).join(' | ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('gradebook.student')}</th>
                          {allComponents.map(comp => (
                            <th key={comp.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              {comp.name}<br/><span className="text-gray-400">/{comp.weight}</span>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-primary-50">Total<br/><span className="text-gray-400">/100</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {classGroups[cls].map((g) => (
                          <tr key={g.student.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                  <span className="text-primary-700 font-medium text-sm">
                                    {g.student.fullName?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{g.student.fullName}</p>
                                  <p className="text-xs text-gray-500">{g.student.email}</p>
                                </div>
                              </div>
                            </td>
                            {allComponents.map(comp => {
                              const mark = g.componentMarks?.[comp.id];
                              const hasGrade = mark !== undefined && mark !== null;
                              const displayMark = hasGrade ? mark : null;
                              return (
                                <td key={comp.id} className="px-4 py-4 text-center">
                                  <span className={`font-medium ${hasGrade ? (displayMark > 0 ? (displayMark / comp.weight * 100 >= 60 ? 'text-green-600' : 'text-red-600') : 'text-red-600') : 'text-gray-400'}`}>
                                    {hasGrade ? `${displayMark}/${comp.weight}` : '-'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 text-center bg-primary-50">
                              <span className={`font-bold text-lg ${g.totalGrade > 0 ? (g.totalGrade >= 60 ? 'text-green-600' : 'text-red-600') : g.totalGrade === 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {g.totalGrade > 0 ? g.totalGrade : g.totalGrade === 0 ? '0' : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
