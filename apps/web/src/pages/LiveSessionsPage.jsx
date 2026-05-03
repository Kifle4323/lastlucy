import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmContext';
import { useTranslation } from 'react-i18next';
import { getUpcomingLiveSessions, createLiveSession, updateLiveSession, deleteLiveSession, getClasses } from '../api';
import Layout from '../components/Layout';
import {
  Video,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Play,
  Users,
  ChevronLeft,
  Radio,
  CheckCircle
} from 'lucide-react';

export default function LiveSessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSession, setNewSession] = useState({
    classId: '',
    courseId: '',
    title: '',
    description: '',
    scheduledAt: '',
    duration: 60,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getUpcomingLiveSessions()
        .then(data => {
          console.log('Fetched sessions:', data);
          setSessions(data);
        })
        .catch(err => {
          console.error('Error fetching sessions:', err);
        }),
      getClasses()
        .then(data => {
          console.log('Fetched classes:', data);
          setClasses(data);
        })
        .catch(err => {
          console.error('Error fetching classes:', err);
        }),
    ]).finally(() => setLoading(false));
  }, []);

  // Get courses the teacher teaches (from CourseSections with semester)
  const teacherCourses = classes.flatMap(c => 
    (c.courseSections || []).map(section => ({
      courseSectionId: section.id,
      courseId: section.courseId,
      classId: c.id,
      className: c.name,
      courseTitle: section.course?.title,
      semester: section.semester?.name,
      academicYear: section.semester?.academicYear?.year
    }))
  );
  
  console.log('User ID:', user?.id);
  console.log('Classes:', classes);
  console.log('Teacher courses available for scheduling:', teacherCourses);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const session = await createLiveSession(newSession.courseId, {
        classId: newSession.classId,
        title: newSession.title,
        description: newSession.description || undefined,
        scheduledAt: newSession.scheduledAt,
        duration: newSession.duration,
      });
      console.log('Created session:', session);
      setSessions([...sessions, session]);
      setShowCreateModal(false);
      setNewSession({ classId: '', courseId: '', title: '', description: '', scheduledAt: '', duration: 60 });
    } catch (err) {
      console.error('Error creating session:', err);
      toast.error('Failed to create session: ' + (err.message || 'Unknown error'));
    }
  };

  const handleStartSession = async (session) => {
    await updateLiveSession(session.id, { status: 'LIVE' });
    navigate(`/live-sessions/${session.id}`);
  };

  const handleJoinSession = (session) => {
    navigate(`/live-sessions/${session.id}`);
  };

  const handleEndSession = async (session) => {
    await updateLiveSession(session.id, { status: 'ENDED' });
    setSessions(sessions.map(s => s.id === session.id ? { ...s, status: 'ENDED' } : s));
  };

  const handleDeleteSession = async (sessionId) => {
    const confirmed = await confirm({
      title: t('liveSession.deleteSession'),
      message: t('liveSession.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    await deleteLiveSession(sessionId);
    setSessions(sessions.filter(s => s.id !== sessionId));
    toast.success(t('liveSession.sessionDeleted'));
  };

  const getStatusBadge = (status, session) => {
    const now = new Date();
    const scheduled = new Date(session.scheduledAt);
    const canStart = status === 'SCHEDULED' && now >= scheduled;

    switch (status) {
      case 'LIVE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full animate-pulse"><Radio className="w-3 h-3" /> {t('liveSession.live')}</span>;
      case 'ENDED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded"><CheckCircle className="w-3 h-3" /> {t('liveSession.ended')}</span>;
      default:
        if (canStart) {
          return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded"><Clock className="w-3 h-3" /> {t('liveSession.readyToStart')}</span>;
        }
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded"><Calendar className="w-3 h-3" /> {t('liveSession.scheduled')}</span>;
    }
  };

  const canStartSession = (session) => {
    // Teacher can only start at or after scheduled time
    return session.status === 'SCHEDULED' && new Date() >= new Date(session.scheduledAt);
  };

  const isSessionReady = (session) => {
    // Session is ready to start at scheduled time
    const now = new Date();
    const scheduled = new Date(session.scheduledAt);
    return session.status === 'SCHEDULED' && now >= scheduled;
  };

  const isSessionInProgress = (session) => {
    const now = new Date();
    const scheduled = new Date(session.scheduledAt);
    const endTime = new Date(scheduled.getTime() + session.duration * 60000);
    return now >= scheduled && now <= endTime;
  };

  if (loading) return <Layout><div className="p-8 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/my-classes" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ChevronLeft className="w-5 h-5" />
            {t('common.back')}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('nav.liveClasses')}</h1>
              <p className="text-gray-500 mt-1">
                {user?.role === 'TEACHER' ? t('liveSession.scheduleManage') : t('liveSession.joinScheduled')}
              </p>
            </div>
            {user?.role === 'TEACHER' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('liveSession.scheduleClass')}
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('liveSession.noUpcoming')}</h3>
            <p className="text-gray-500">
              {user?.role === 'TEACHER' ? t('liveSession.scheduleFirst') : t('liveSession.noLiveScheduled')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Video className="w-5 h-5 text-primary-600" />
                        <h3 className="font-semibold text-gray-900">{session.title}</h3>
                        {getStatusBadge(session.status, session)}
                      </div>
                      {session.description && (
                        <p className="text-sm text-gray-600 mb-3">{session.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(session.scheduledAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' '}({session.duration} min)
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {session.class?.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-700">{session.course?.title}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {t('course.teacher')}: {session.teacher?.fullName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {user?.role === 'TEACHER' && session.teacherId === user.id && (
                        <>
                          {session.status === 'SCHEDULED' && !canStartSession(session) && (
                            <button
                              disabled
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed"
                              title={`Session starts at ${new Date(session.scheduledAt).toLocaleTimeString()}`}
                            >
                              <Clock className="w-4 h-4" />
                              {t('liveSession.startsAt')} {new Date(session.scheduledAt).toLocaleTimeString()}
                            </button>
                          )}
                          {canStartSession(session) && (
                            <button
                              onClick={() => handleStartSession(session)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              {t('liveSession.startNow')}
                            </button>
                          )}
                          {session.status === 'LIVE' && (
                            <button
                              onClick={() => handleJoinSession(session)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
                            >
                              <Video className="w-4 h-4" />
                              {t('liveSession.rejoin')}
                            </button>
                          )}
                          {session.status === 'ENDED' && (
                            <span className="text-sm text-gray-500">{t('liveSession.ended')}</span>
                          )}
                        </>
                      )}

                      {user?.role === 'STUDENT' && session.status === 'LIVE' && (
                        <button
                          onClick={() => handleJoinSession(session)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors animate-pulse"
                        >
                          <Play className="w-4 h-4" />
                          {t('liveSession.joinMeeting')}
                        </button>
                      )}

                      {user?.role === 'STUDENT' && session.status === 'SCHEDULED' && isSessionInProgress(session) && (
                        <span className="text-sm text-yellow-600">{t('liveSession.waitingForTeacher')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('liveSession.scheduleClass')}</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('liveSession.classAndCourse')}</label>
                  <select
                    value={`${newSession.classId}:${newSession.courseId}`}
                    onChange={(e) => {
                      const [classId, courseId] = e.target.value.split(':');
                      setNewSession({ ...newSession, classId, courseId });
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    <option value="">{t('liveSession.selectClassCourse')}</option>
                    {teacherCourses.map(tc => (
                      <option key={tc.courseSectionId} value={`${tc.classId}:${tc.courseId}`}>
                        {tc.className} - {tc.courseTitle}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('liveSession.title')}</label>
                  <input
                    type="text"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Week 1 Lecture - Introduction"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('liveSession.descriptionOptional')}</label>
                  <textarea
                    value={newSession.description}
                    onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={t('liveSession.whatWillBeCovered')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('liveSession.dateTime')}</label>
                    <input
                      type="datetime-local"
                      value={newSession.scheduledAt}
                      onChange={(e) => setNewSession({ ...newSession, scheduledAt: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('liveSession.durationMin')}</label>
                    <select
                      value={newSession.duration}
                      onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
                  >
                    {t('liveSession.scheduleClass')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
