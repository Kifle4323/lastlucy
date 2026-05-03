import { useState, useEffect } from 'react';
import {
  getAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear,
  getSemesters, createSemester, updateSemester, deleteSemester, publishSemesterGrades,
  getCourses, getUsers, getCourseSections, createCourseSection, updateCourseSection, deleteCourseSection,
  createScheduleSlot, deleteScheduleSlot,
  getClasses
} from '../api.js';
import Layout from '../components/Layout';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmContext';
import { useTranslation } from 'react-i18next';

export default function AdminAcademicPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courseSections, setCourseSections] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [activeTab, setActiveTab] = useState('years');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '' });
  const [semesterForm, setSemesterForm] = useState({
    academicYearId: '', type: 'FALL', semesterNumber: '1', name: 'Semester 1', startDate: '', endDate: '',
    registrationStart: '', registrationEnd: '', addDropStart: '', addDropEnd: '',
    midtermExamStart: '', midtermExamEnd: '', finalExamStart: '', finalExamEnd: '', gradingDeadline: ''
  });
  const [courseSectionRows, setCourseSectionRows] = useState([
    { courseId: '', teacherId: '', classId: '', sectionCode: '', deliveryMode: 'ONLINE', scheduleSlots: [{ dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: '', isOnline: false }] }
  ]);
  const [editingYear, setEditingYear] = useState(null);
  const [editingSemester, setEditingSemester] = useState(null);
  const [editingCourseSection, setEditingCourseSection] = useState(null);
  const [editingScheduleSlots, setEditingScheduleSlots] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [yearsData, semestersData, coursesData, usersData, classesData] = await Promise.all([
        getAcademicYears(),
        getSemesters(),
        getCourses(),
        getUsers(),
        getClasses()
      ]);
      setAcademicYears(yearsData);
      setSemesters(semestersData);
      setCourses(coursesData);
      setTeachers(usersData.filter(u => u.role === 'TEACHER'));
      setClasses(classesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Academic Year handlers
  async function handleCreateYear(e) {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    if (yearForm.startDate < today) { setError('Start date cannot be in the past'); return; }
    if (yearForm.endDate && yearForm.startDate && yearForm.endDate <= yearForm.startDate) { setError('End date must be after start date'); return; }
    try {
      const newYear = await createAcademicYear(yearForm);
      setAcademicYears([...academicYears, newYear]);
      setYearForm({ name: '', startDate: '', endDate: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateYear(e) {
    e.preventDefault();
    if (yearForm.endDate && yearForm.startDate && yearForm.endDate <= yearForm.startDate) { setError('End date must be after start date'); return; }
    try {
      const updated = await updateAcademicYear(editingYear.id, yearForm);
      setAcademicYears(academicYears.map(y => y.id === updated.id ? updated : y));
      setEditingYear(null);
      setYearForm({ name: '', startDate: '', endDate: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteYear(id) {
    const confirmed = await confirm({
      title: t('admin.deleteAcademicYear'),
      message: t('admin.confirmDeleteAcademicYear'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteAcademicYear(id);
      setAcademicYears(academicYears.filter(y => y.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditYear(year) {
    setEditingYear(year);
    setYearForm({
      name: year.name,
      startDate: year.startDate.split('T')[0],
      endDate: year.endDate.split('T')[0]
    });
  }

  // Semester handlers
  async function handleCreateSemester(e) {
    e.preventDefault();
    try {
      const newSem = await createSemester(semesterForm);
      setSemesters([...semesters, newSem]);
      setSemesterForm({
        academicYearId: '', type: 'FALL', semesterNumber: '1', name: 'Semester 1', startDate: '', endDate: '',
        registrationStart: '', registrationEnd: '', addDropStart: '', addDropEnd: '',
        midtermExamStart: '', midtermExamEnd: '', finalExamStart: '', finalExamEnd: '', gradingDeadline: '', registrationFee: ''
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateSemester(e) {
    e.preventDefault();
    try {
      const updated = await updateSemester(editingSemester.id, semesterForm);
      setSemesters(semesters.map(s => s.id === updated.id ? updated : s));
      setEditingSemester(null);
      setSemesterForm({
        academicYearId: '', type: 'FALL', semesterNumber: '1', name: 'Semester 1', startDate: '', endDate: '',
        registrationStart: '', registrationEnd: '', addDropStart: '', addDropEnd: '',
        midtermExamStart: '', midtermExamEnd: '', finalExamStart: '', finalExamEnd: '', gradingDeadline: '', registrationFee: ''
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSemester(id) {
    const confirmed = await confirm({
      title: t('admin.deleteSemester'),
      message: t('admin.confirmDeleteSemester'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteSemester(id);
      setSemesters(semesters.filter(s => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePublishGrades(semesterId) {
    const confirmed = await confirm({
      title: t('admin.publishGrades'),
      message: t('admin.confirmPublishGrades'),
      confirmText: t('admin.publish'),
      cancelText: t('common.cancel'),
      type: 'success',
    });
    if (!confirmed) return;
    try {
      await publishSemesterGrades(semesterId);
      toast.success(t('admin.gradesPublishedSuccess'));
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleChangeSemesterStatus(semesterId, newStatus) {
    const statusLabels = {
      'REGISTRATION_OPEN': t('admin.openRegistrationAction'),
      'IN_PROGRESS': t('admin.startSemesterAction'),
      'GRADING': t('admin.startGradingAction'),
      'COMPLETED': t('admin.completeSemesterAction')
    };
    const confirmed = await confirm({
      title: t('admin.changeSemesterStatus'),
      message: t('admin.confirmChangeStatus', { action: statusLabels[newStatus] }),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await updateSemester(semesterId, { status: newStatus, isCurrent: true });
      toast.success(t('admin.semesterStatusUpdated'));
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditSemester(sem) {
    setEditingSemester(sem);
    setSemesterForm({
      academicYearId: sem.academicYearId,
      type: sem.type,
      name: sem.name,
      startDate: sem.startDate.split('T')[0],
      endDate: sem.endDate.split('T')[0],
      registrationStart: sem.registrationStart?.split('T')[0] || '',
      registrationEnd: sem.registrationEnd?.split('T')[0] || '',
      addDropStart: sem.addDropStart?.split('T')[0] || '',
      addDropEnd: sem.addDropEnd?.split('T')[0] || '',
      midtermExamStart: sem.midtermExamStart?.split('T')[0] || '',
      midtermExamEnd: sem.midtermExamEnd?.split('T')[0] || '',
      finalExamStart: sem.finalExamStart?.split('T')[0] || '',
      finalExamEnd: sem.finalExamEnd?.split('T')[0] || '',
      gradingDeadline: sem.gradingDeadline?.split('T')[0] || ''
    });
  }

  // Course Section handlers
  async function loadCourseSections(semesterId) {
    setSelectedSemester(semesterId);
    try {
      const data = await getCourseSections(semesterId);
      setCourseSections(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function addCourseSectionRow() {
    setCourseSectionRows([...courseSectionRows, { courseId: '', teacherId: '', classId: '', sectionCode: '', deliveryMode: 'ONLINE', scheduleSlots: [{ dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: '', isOnline: false }] }]);
  }

  function removeCourseSectionRow(index) {
    if (courseSectionRows.length > 1) {
      setCourseSectionRows(courseSectionRows.filter((_, i) => i !== index));
    }
  }

  function updateCourseSectionRow(index, field, value) {
    const updated = [...courseSectionRows];
    updated[index][field] = value;
    setCourseSectionRows(updated);
  }

  async function handleCreateCourseSections(e) {
    e.preventDefault();
    try {
      // Create all course sections
      const createdSections = [];
      for (const row of courseSectionRows) {
        if (!row.courseId || !row.teacherId || !row.sectionCode) continue;

        const data = {
          courseId: row.courseId,
          semesterId: selectedSemester,
          teacherId: row.teacherId,
          classId: row.classId || null,
          sectionCode: row.sectionCode,
          deliveryMode: row.deliveryMode || 'ONLINE',
          schedule: null,
          room: null
        };
        const newSection = await createCourseSection(data);
        // Create schedule slots for this section
        if (row.scheduleSlots && row.scheduleSlots.length > 0) {
          for (const slot of row.scheduleSlots) {
            if (slot.dayOfWeek && slot.startTime && slot.endTime) {
              try {
                await createScheduleSlot(newSection.id, {
                  dayOfWeek: slot.dayOfWeek,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  room: slot.isOnline ? null : (slot.room || null),
                  isOnline: slot.isOnline,
                });
              } catch (slotErr) {
                console.error('Failed to create schedule slot:', slotErr);
              }
            }
          }
        }
        createdSections.push(newSection);
      }

      setCourseSections([...courseSections, ...createdSections]);
      setCourseSectionRows([{ courseId: '', teacherId: '', classId: '', sectionCode: '', deliveryMode: 'ONLINE', scheduleSlots: [{ dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: '', isOnline: false }] }]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateCourseSection(e) {
    e.preventDefault();
    try {
      const updated = await updateCourseSection(editingCourseSection.id, {
        teacherId: editingCourseSection.teacherId,
        classId: editingCourseSection.classId || null,
        sectionCode: editingCourseSection.sectionCode,
        deliveryMode: editingCourseSection.deliveryMode || 'ONLINE',
        schedule: editingCourseSection.schedule,
        room: editingCourseSection.room
      });
      // Create new schedule slots (those marked as isNew)
      const newSlots = editingScheduleSlots.filter(s => s.isNew);
      for (const slot of newSlots) {
        if (slot.dayOfWeek && slot.startTime && slot.endTime) {
          try {
            await createScheduleSlot(editingCourseSection.id, {
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.isOnline ? null : (slot.room || null),
              isOnline: slot.isOnline,
            });
          } catch (slotErr) {
            console.error('Failed to create schedule slot:', slotErr);
          }
        }
      }
      // Reload sections to get updated slots
      if (selectedSemester) {
        const data = await getCourseSections(selectedSemester);
        setCourseSections(data);
      }
      setEditingCourseSection(null);
      toast.success(t('admin.courseSectionUpdated', 'Course section updated'));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCourseSection(id) {
    const confirmed = await confirm({
      title: t('admin.deleteCourseSection'),
      message: t('admin.confirmDeleteCourseSection'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteCourseSection(id);
      setCourseSections(courseSections.filter(s => s.id !== id));
      toast.success(t('admin.courseSectionDeleted'));
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditCourseSection(section) {
    setEditingCourseSection(section);
    setEditingScheduleSlots(
      section.scheduleSlots && section.scheduleSlots.length > 0
        ? section.scheduleSlots.map(s => ({ ...s, isNew: false }))
        : [{ dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: section.room || '', isOnline: section.deliveryMode === 'ONLINE', isNew: true }]
    );
    setCourseSectionForm({
      courseId: section.courseId,
      semesterId: section.semesterId,
      teacherId: section.teacherId,
      classId: section.classId || '',
      sectionCode: section.sectionCode || ''
    });
  }

  if (loading) return <Layout><div className="p-8">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('admin.academicManagement')}</h1>

      {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded mb-4">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('years')}
          className={`pb-2 px-4 ${activeTab === 'years' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
        >
          {t('admin.academicYears')}
        </button>
        <button
          onClick={() => setActiveTab('semesters')}
          className={`pb-2 px-4 ${activeTab === 'semesters' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
        >
          {t('admin.semesters')}
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`pb-2 px-4 ${activeTab === 'sections' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
        >
          {t('admin.courseSections')}
        </button>
      </div>

      {/* Academic Years Tab */}
      {activeTab === 'years' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {editingYear ? t('admin.editAcademicYear') : t('admin.createAcademicYear')}
            </h2>
            <form onSubmit={editingYear ? handleUpdateYear : handleCreateYear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.nameExample')}</label>
                <input
                  type="text"
                  value={yearForm.name}
                  onChange={e => setYearForm({ ...yearForm, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.startDate')}</label>
                <input
                  type="date"
                  value={yearForm.startDate}
                  onChange={e => setYearForm({ ...yearForm, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.endDate')}</label>
                <input
                  type="date"
                  value={yearForm.endDate}
                  onChange={e => setYearForm({ ...yearForm, endDate: e.target.value })}
                  min={yearForm.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
                {yearForm.startDate && yearForm.endDate && yearForm.endDate <= yearForm.startDate && <p className="text-red-500 text-xs mt-1">End date must be after start date</p>}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {editingYear ? t('common.update') : t('common.create')}
                </button>
                {editingYear && (
                  <button type="button" onClick={() => { setEditingYear(null); setYearForm({ name: '', startDate: '', endDate: '' }); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.academicYears')}</h2>
            <div className="space-y-3">
              {academicYears.map(year => (
                <div key={year.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{year.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                    </div>
                    {year.isActive && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded">{t('admin.active')}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditYear(year)} className="text-blue-600 hover:underline">{t('common.edit')}</button>
                    <button onClick={() => handleDeleteYear(year.id)} className="text-red-600 hover:underline">{t('common.delete')}</button>
                  </div>
                </div>
              ))}
              {academicYears.length === 0 && <p className="text-gray-500">{t('admin.noAcademicYearsYet')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Semesters Tab */}
      {activeTab === 'semesters' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {editingSemester ? t('admin.editSemester') : t('admin.createSemester')}
            </h2>
            <form onSubmit={editingSemester ? handleUpdateSemester : handleCreateSemester} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.academicYear')}</label>
                  <select
                    value={semesterForm.academicYearId}
                    onChange={e => setSemesterForm({ ...semesterForm, academicYearId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">{t('admin.selectYear')}</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.type')}</label>
                  <select
                    value={semesterForm.type}
                    onChange={e => setSemesterForm({ ...semesterForm, type: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="FALL">{t('admin.fall')}</option>
                    <option value="SPRING">{t('admin.spring')}</option>
                    <option value="SUMMER">{t('admin.summer')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Semester</label>
                <select
                  value={semesterForm.semesterNumber}
                  onChange={e => {
                    const semesterNumber = e.target.value;
                    const name = `Semester ${semesterNumber}`;
                    setSemesterForm({ ...semesterForm, semesterNumber, name });
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.startDate')}</label>
                  <input
                    type="date"
                    value={semesterForm.startDate}
                    onChange={e => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.endDate')}</label>
                  <input
                    type="date"
                    value={semesterForm.endDate}
                    onChange={e => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.registrationStart')}</label>
                  <input
                    type="date"
                    value={semesterForm.registrationStart}
                    onChange={e => setSemesterForm({ ...semesterForm, registrationStart: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.registrationEnd')}</label>
                  <input
                    type="date"
                    value={semesterForm.registrationEnd}
                    onChange={e => setSemesterForm({ ...semesterForm, registrationEnd: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
                <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">{t('admin.addDropPeriod')}</div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {t('admin.addDropPeriodDesc')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.addDropStart')}</label>
                  <input
                    type="date"
                    value={semesterForm.addDropStart}
                    onChange={e => setSemesterForm({ ...semesterForm, addDropStart: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.addDropEnd')}</label>
                  <input
                    type="date"
                    value={semesterForm.addDropEnd}
                    onChange={e => setSemesterForm({ ...semesterForm, addDropEnd: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.midtermExamPeriod')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={semesterForm.midtermExamStart}
                      onChange={e => setSemesterForm({ ...semesterForm, midtermExamStart: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Start"
                    />
                    <input
                      type="date"
                      value={semesterForm.midtermExamEnd}
                      onChange={e => setSemesterForm({ ...semesterForm, midtermExamEnd: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="End"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.finalExamPeriod')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={semesterForm.finalExamStart}
                      onChange={e => setSemesterForm({ ...semesterForm, finalExamStart: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Start"
                    />
                    <input
                      type="date"
                      value={semesterForm.finalExamEnd}
                      onChange={e => setSemesterForm({ ...semesterForm, finalExamEnd: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="End"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-sm">
                <div className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">{t('admin.officialExamDates')}</div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  {t('admin.officialExamDatesDesc')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.gradingDeadline')}</label>
                <input
                  type="date"
                  value={semesterForm.gradingDeadline}
                  onChange={e => setSemesterForm({ ...semesterForm, gradingDeadline: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-300">
                {t('admin.feeAutoCalculated')}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {editingSemester ? t('common.update') : t('common.create')}
                </button>
                {editingSemester && (
                  <button type="button" onClick={() => { setEditingSemester(null); setSemesterForm({ academicYearId: '', type: 'FALL', name: '', startDate: '', endDate: '', registrationStart: '', registrationEnd: '', addDropStart: '', addDropEnd: '', midtermExamStart: '', midtermExamEnd: '', finalExamStart: '', finalExamEnd: '', gradingDeadline: '' }); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.semesters')}</h2>
            <div className="space-y-4">
              {semesters.map(sem => (
                <div key={sem.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-700">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-lg text-gray-900 dark:text-white">{sem.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {sem.academicYear?.name} | {sem.type}
                      </div>

                      {/* Timeline */}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
                          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('admin.semesterPeriod')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {new Date(sem.startDate).toLocaleDateString()} - {new Date(sem.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium">{t('admin.registration')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {sem.registrationStart && sem.registrationEnd
                              ? `${new Date(sem.registrationStart).toLocaleDateString()} - ${new Date(sem.registrationEnd).toLocaleDateString()}`
                              : t('admin.notSet')}
                          </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-2">
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">{t('admin.midtermExam')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {sem.midtermExamStart
                              ? `${new Date(sem.midtermExamStart).toLocaleDateString()} - ${new Date(sem.midtermExamEnd).toLocaleDateString()}`
                              : sem.midtermExamDate
                                ? new Date(sem.midtermExamDate).toLocaleDateString()
                                : t('admin.notSet')}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/30 rounded p-2">
                          <div className="text-xs text-red-600 dark:text-red-400 font-medium">{t('admin.finalExam')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {sem.finalExamStart
                              ? `${new Date(sem.finalExamStart).toLocaleDateString()} - ${new Date(sem.finalExamEnd).toLocaleDateString()}`
                              : sem.finalExamDate
                                ? new Date(sem.finalExamDate).toLocaleDateString()
                                : t('admin.notSet')}
                          </div>
                        </div>
                      </div>

                      {/* Grading Deadline */}
                      {sem.gradingDeadline && (
                        <div className="mt-2 text-sm text-purple-600 dark:text-purple-400">
                          {t('admin.gradingDeadline')}: {new Date(sem.gradingDeadline).toLocaleDateString()}
                        </div>
                      )}

                      {/* Registration Fee */}
                      {sem.registrationFee > 0 && (
                        <div className="mt-1 text-sm text-orange-600 dark:text-orange-400">
                          {t('admin.registrationFee')}: ETB {sem.registrationFee?.toLocaleString()}
                        </div>
                      )}

                      <div className="mt-2 flex gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${
                          sem.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                          sem.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          sem.status === 'REGISTRATION_OPEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          sem.status === 'GRADING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}>
                          {sem.status.replace('_', ' ')}
                        </span>
                        {sem.isCurrent && <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded">{t('admin.current')}</span>}
                      </div>

                      {/* Status Change Buttons */}
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {sem.status === 'UPCOMING' && (
                          <button
                            onClick={() => handleChangeSemesterStatus(sem.id, 'REGISTRATION_OPEN')}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            {t('admin.openRegistration')}
                          </button>
                        )}
                        {sem.status === 'REGISTRATION_OPEN' && (
                          <button
                            onClick={() => handleChangeSemesterStatus(sem.id, 'IN_PROGRESS')}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          >
                            {t('admin.startSemester')}
                          </button>
                        )}
                        {sem.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleChangeSemesterStatus(sem.id, 'GRADING')}
                            className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                          >
                            {t('admin.startGrading')}
                          </button>
                        )}
                        {sem.status === 'GRADING' && (
                          <button
                            onClick={() => handlePublishGrades(sem.id)}
                            className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                          >
                            {t('admin.publishAndComplete')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditSemester(sem)} className="text-blue-600 hover:underline text-sm">{t('common.edit')}</button>
                      <button onClick={() => handleDeleteSemester(sem.id)} className="text-red-600 hover:underline text-sm">{t('common.delete')}</button>
                    </div>
                  </div>
                </div>
              ))}
              {semesters.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t('admin.noSemestersYet')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Course Sections Tab */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Semester Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.selectSemester')}</h2>
            <select
              value={selectedSemester}
              onChange={e => loadCourseSections(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">-- {t('admin.selectSemester')} --</option>
              {semesters.map(sem => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} ({sem.academicYear?.name})
                </option>
              ))}
            </select>
          </div>

          {selectedSemester && (
            <div className="space-y-6">
              {/* Batch Course Section Form */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.addCourseSections')}</h2>
                  <button
                    type="button"
                    onClick={addCourseSectionRow}
                    className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    + {t('admin.addAnotherCourse')}
                  </button>
                </div>

                <form onSubmit={handleCreateCourseSections} className="space-y-4">
                  {/* Class selector for all courses */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.assignToClassOptional')}</label>
                    <select
                      value={courseSectionRows[0]?.classId || ''}
                      onChange={e => {
                        const updated = courseSectionRows.map(row => ({ ...row, classId: e.target.value }));
                        setCourseSectionRows(updated);
                      }}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">-- {t('admin.noClassIndividualEnrollment')} --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) - {c.year ? t('admin.yearNum', { num: c.year }) : ''} {c.section || ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('admin.allCoursesAssignedToClass')}</p>
                  </div>

                  {/* Course rows */}
                  {courseSectionRows.map((row, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.courseNum', { num: index + 1 })}</span>
                        {courseSectionRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCourseSectionRow(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {t('admin.remove')}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">{t('nav.courses')}</label>
                          <select
                            value={row.courseId}
                            onChange={e => updateCourseSectionRow(index, 'courseId', e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          >
                            <option value="">-- {t('admin.select')} --</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.code} - {c.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">{t('nav.teachers')}</label>
                          <select
                            value={row.teacherId}
                            onChange={e => updateCourseSectionRow(index, 'teacherId', e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          >
                            <option value="">-- {t('admin.select')} --</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.sectionCode')}</label>
                          <input
                            type="text"
                            value={row.sectionCode}
                            onChange={e => updateCourseSectionRow(index, 'sectionCode', e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t('admin.sectionCodePlaceholder')}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.deliveryMode')}</label>
                          <select
                            value={row.deliveryMode || 'ONLINE'}
                            onChange={e => updateCourseSectionRow(index, 'deliveryMode', e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="ONLINE">{t('admin.online')}</option>
                            <option value="PAPER">{t('admin.faceToFace')}</option>
                            <option value="MIXED">Mixed</option>
                          </select>
                        </div>
                      </div>
                      {/* Schedule Slots */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('admin.weeklySchedule', 'Weekly Schedule')}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...courseSectionRows];
                              updated[index].scheduleSlots = [...(updated[index].scheduleSlots || []), { dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: '', isOnline: false }];
                              setCourseSectionRows(updated);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            + {t('admin.addScheduleSlot', 'Add Slot')}
                          </button>
                        </div>
                        {(row.scheduleSlots || []).map((slot, slotIdx) => (
                          <div key={slotIdx} className="grid grid-cols-6 gap-2 mb-2 items-center">
                            <select
                              value={slot.dayOfWeek}
                              onChange={e => {
                                const updated = [...courseSectionRows];
                                updated[index].scheduleSlots[slotIdx].dayOfWeek = e.target.value;
                                setCourseSectionRows(updated);
                              }}
                              className="border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              {['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(d => (
                                <option key={d} value={d}>{d.slice(0,3)}</option>
                              ))}
                            </select>
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={e => {
                                const updated = [...courseSectionRows];
                                updated[index].scheduleSlots[slotIdx].startTime = e.target.value;
                                setCourseSectionRows(updated);
                              }}
                              className="border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={e => {
                                const updated = [...courseSectionRows];
                                updated[index].scheduleSlots[slotIdx].endTime = e.target.value;
                                setCourseSectionRows(updated);
                              }}
                              className="border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={slot.room}
                              onChange={e => {
                                const updated = [...courseSectionRows];
                                updated[index].scheduleSlots[slotIdx].room = e.target.value;
                                setCourseSectionRows(updated);
                              }}
                              placeholder={t('admin.roomPlaceholder')}
                              disabled={slot.isOnline}
                              className="border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                checked={slot.isOnline}
                                onChange={e => {
                                  const updated = [...courseSectionRows];
                                  updated[index].scheduleSlots[slotIdx].isOnline = e.target.checked;
                                  if (e.target.checked) updated[index].scheduleSlots[slotIdx].room = '';
                                  setCourseSectionRows(updated);
                                }}
                                className="w-3 h-3"
                              />
                              {t('admin.online', 'Online')}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...courseSectionRows];
                                updated[index].scheduleSlots = updated[index].scheduleSlots.filter((_, i) => i !== slotIdx);
                                setCourseSectionRows(updated);
                              }}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                      {t('admin.createAllCourseSections')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseSectionRows([{ courseId: '', teacherId: '', classId: '', sectionCode: '' }])}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {t('admin.clearAll')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Edit Course Section Form */}
              {editingCourseSection && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow p-6 border border-yellow-200 dark:border-yellow-800">
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.editCourseSection')}</h2>
                  <form onSubmit={handleUpdateCourseSection} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('nav.courses')}</label>
                        <input
                          type="text"
                          value={editingCourseSection.course?.title || ''}
                          disabled
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('nav.teachers')}</label>
                        <select
                          value={editingCourseSection.teacherId}
                          onChange={e => setEditingCourseSection({ ...editingCourseSection, teacherId: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.fullName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.sectionCode')}</label>
                        <input
                          type="text"
                          value={editingCourseSection.sectionCode || ''}
                          onChange={e => setEditingCourseSection({ ...editingCourseSection, sectionCode: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.classOptional')}</label>
                        <select
                          value={editingCourseSection.classId || ''}
                          onChange={e => setEditingCourseSection({ ...editingCourseSection, classId: e.target.value || null })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">{t('admin.noClass')}</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('admin.deliveryMode')}</label>
                        <select
                          value={editingCourseSection.deliveryMode || 'ONLINE'}
                          onChange={e => setEditingCourseSection({ ...editingCourseSection, deliveryMode: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="ONLINE">{t('admin.online')}</option>
                          <option value="PAPER">{t('admin.faceToFace')}</option>
                          <option value="MIXED">Mixed</option>
                        </select>
                      </div>
                    </div>
                    {/* Schedule Slots in Edit Form */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.weeklySchedule', 'Weekly Schedule')}</span>
                        <button
                          type="button"
                          onClick={() => setEditingScheduleSlots([...editingScheduleSlots, { dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:30', room: '', isOnline: false, isNew: true }])}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
                          + {t('admin.addScheduleSlot', 'Add Slot')}
                        </button>
                      </div>
                      {editingScheduleSlots.map((slot, slotIdx) => (
                        <div key={slot.id || slotIdx} className="grid grid-cols-6 gap-2 mb-2 items-center">
                          <select
                            value={slot.dayOfWeek}
                            onChange={e => {
                              const updated = [...editingScheduleSlots];
                              updated[slotIdx] = { ...updated[slotIdx], dayOfWeek: e.target.value };
                              setEditingScheduleSlots(updated);
                            }}
                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(d => (
                              <option key={d} value={d}>{d.slice(0,3)}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={e => {
                              const updated = [...editingScheduleSlots];
                              updated[slotIdx] = { ...updated[slotIdx], startTime: e.target.value };
                              setEditingScheduleSlots(updated);
                            }}
                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={e => {
                              const updated = [...editingScheduleSlots];
                              updated[slotIdx] = { ...updated[slotIdx], endTime: e.target.value };
                              setEditingScheduleSlots(updated);
                            }}
                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={slot.room || ''}
                            onChange={e => {
                              const updated = [...editingScheduleSlots];
                              updated[slotIdx] = { ...updated[slotIdx], room: e.target.value };
                              setEditingScheduleSlots(updated);
                            }}
                            placeholder={t('admin.roomPlaceholder')}
                            disabled={slot.isOnline}
                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          />
                          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={slot.isOnline}
                              onChange={e => {
                                const updated = [...editingScheduleSlots];
                                updated[slotIdx] = { ...updated[slotIdx], isOnline: e.target.checked, room: e.target.checked ? '' : updated[slotIdx].room };
                                setEditingScheduleSlots(updated);
                              }}
                              className="w-4 h-4"
                            />
                            {t('admin.online', 'Online')}
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              if (slot.id && !slot.isNew) {
                                try {
                                  await deleteScheduleSlot(slot.id);
                                  setEditingScheduleSlots(editingScheduleSlots.filter((_, i) => i !== slotIdx));
                                  toast.success(t('admin.scheduleSlotDeleted', 'Schedule slot deleted'));
                                } catch (err) {
                                  toast.error(err.message);
                                }
                              } else {
                                setEditingScheduleSlots(editingScheduleSlots.filter((_, i) => i !== slotIdx));
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        {t('common.update')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCourseSection(null)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Course Sections List - Grouped by Class */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.courseSectionsByClass')}</h2>
                
                {courseSections.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('admin.noCourseSectionsYet')}</p>
                ) : (
                  <div className="space-y-6">
                    {/* Group sections by class */}
                    {Object.entries(
                      courseSections.reduce((acc, section) => {
                        const classKey = section.classId || 'no-class';
                        const className = section.class?.name || t('admin.unassignedIndividual');
                        const classCode = section.class?.code || '';
                        if (!acc[classKey]) {
                          acc[classKey] = {
                            name: className,
                            code: classCode,
                            sections: []
                          };
                        }
                        acc[classKey].sections.push(section);
                        return acc;
                      }, {})
                    ).map(([classId, classGroup]) => (
                      <div key={classId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        {/* Class Header */}
                        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900 dark:text-white">{classGroup.name}</span>
                              {classGroup.code && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">({classGroup.code})</span>
                              )}
                            </div>
                            <span className="text-sm bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-1 rounded">
                              {t('admin.courseCount', { count: classGroup.sections.length })}
                            </span>
                          </div>
                        </div>
                        
                        {/* Courses Table */}
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('nav.courses')}</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.section')}</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('nav.teachers')}</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.schedule')}</th>
                              <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('nav.students')}</th>
                              <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {classGroup.sections.map(section => (
                              <tr key={section.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{section.course?.code}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{section.course?.title}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-gray-900 dark:text-white">{section.sectionCode}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-gray-900 dark:text-white">{section.teacher?.fullName || t('admin.notAssigned')}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {section.scheduleSlots && section.scheduleSlots.length > 0 ? (
                                    <div className="space-y-1">
                                      {section.scheduleSlots.map(slot => (
                                        <div key={slot.id} className="text-xs">
                                          <span className="font-medium">{slot.dayOfWeek?.slice(0,3)}</span>{' '}
                                          {slot.startTime}-{slot.endTime}
                                          {slot.isOnline ? (
                                            <span className="text-blue-500 ml-1">Online</span>
                                          ) : (
                                            <span className="text-gray-400 ml-1">{slot.room || ''}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{section.schedule || '-'}</span>
                                  )}
                                  {section.room && (!section.scheduleSlots || section.scheduleSlots.length === 0) && (
                                    <span className="block text-xs text-gray-400">{section.room}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-gray-900 dark:text-white">{section._count?.enrollments || 0}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {section.isPublished ? (
                                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 text-xs rounded">{t('admin.published')}</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">{t('admin.draft')}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => startEditCourseSection(section)}
                                      className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                      {t('common.edit')}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCourseSection(section.id)}
                                      className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                      {t('common.delete')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </Layout>
  );
}
