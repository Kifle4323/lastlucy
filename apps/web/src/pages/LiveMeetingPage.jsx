import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { useTranslation } from 'react-i18next';
import { getLiveSession, updateLiveSession, joinLiveSession, leaveLiveSession, endLiveSession, getLiveSessionAttendance, getJaasToken } from '../api';
import Layout from '../components/Layout';
import LiveFaceTracker from '../components/LiveFaceTracker';
import {
  Video,
  Users,
  ChevronLeft,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Minus
} from 'lucide-react';

export default function LiveMeetingPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [attendanceData, setAttendanceData] = useState(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [faceAlerts, setFaceAlerts] = useState(0);
  const [jaasConfig, setJaasConfig] = useState(null);
  const jitsiRef = useRef(null);
  const jitsiContainerRef = useRef(null);
  const attendanceRecordedRef = useRef(false);

  useEffect(() => {
    getLiveSession(sessionId)
      .then(s => {
        setSession(s);
        // Auto-start if teacher and session is at/past scheduled time
        if (user?.role === 'TEACHER' && s.teacherId === user.id && s.status !== 'LIVE') {
          updateLiveSession(s.id, { status: 'LIVE' })
            .then(updated => setSession(updated))
            .catch(err => {
              toast.error(err.message || t('liveSession.cannotStartEarly'));
            });
        }
        // Fetch JaaS token
        getJaasToken(sessionId)
          .then(config => setJaasConfig(config))
          .catch(err => console.error('Failed to get JaaS token:', err));
      })
      .catch(err => setError(err.message || t('liveSession.title')))
      .finally(() => setLoading(false));
  }, [sessionId, user]);

  // Initialize Jitsi External API when joined
  useEffect(() => {
    if (!joined || !session || !jaasConfig) return;

    const rawRoomName = jaasConfig.roomName || session.meetingUrl?.split('/').pop() || 'edulms-default';
    const domain = jaasConfig.domain || 'meet.jit.si';
    // For JaaS, roomName must include appId prefix: appId/roomName
    const roomName = jaasConfig.appId ? `${jaasConfig.appId}/${rawRoomName}` : rawRoomName;

    // Load Jitsi External API script
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => {
      if (!window.JitsiMeetExternalAPI) return;

      const options = {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        jwt: jaasConfig.token || undefined,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          subject: session.title || t('nav.liveClasses'),
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
        userInfo: {
          displayName: displayName,
        },
      };

      const jitsi = new window.JitsiMeetExternalAPI(domain, options);
      jitsiRef.current = jitsi;

      // Student: record attendance on join
      if (user?.role === 'STUDENT' && !attendanceRecordedRef.current) {
        attendanceRecordedRef.current = true;
        joinLiveSession(sessionId).catch(err => {
          console.error('Failed to record attendance:', err);
        });
      }

      // Listen for participant events
      jitsi.addEventListener('participantJoined', (e) => {
        console.log('Participant joined:', e);
      });

      jitsi.addEventListener('participantLeft', (e) => {
        console.log('Participant left:', e);
      });

      // Handle video-conference left (user closes meeting from within Jitsi)
      jitsi.addEventListener('videoConferenceLeft', () => {
        handleLeave();
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (jitsiRef.current) {
        jitsiRef.current.dispose();
        jitsiRef.current = null;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [joined, session, jaasConfig]);

  const handleLeave = useCallback(async () => {
    // Student: record leave
    if (user?.role === 'STUDENT' && attendanceRecordedRef.current) {
      try {
        await leaveLiveSession(sessionId);
      } catch (err) {
        console.error('Failed to record leave:', err);
      }
    }
    navigate('/live-sessions');
  }, [user, sessionId, navigate]);

  const handleEndCall = async () => {
    if (user?.role !== 'TEACHER' || session?.teacherId !== user.id) return;
    setEndingSession(true);
    try {
      const result = await endLiveSession(sessionId);
      toast.success(`Class ended! ${result.attended} attended, ${result.partial} partial, ${result.absent} absent`);
      navigate('/live-sessions');
    } catch (err) {
      toast.error('Failed to end session: ' + err.message);
      setEndingSession(false);
    }
  };

  const handleJoin = async () => {
    if (!displayName.trim()) return;
    setJoined(true);
  };

  const fetchAttendance = async () => {
    try {
      const data = await getLiveSessionAttendance(sessionId);
      setAttendanceData(data);
      setShowAttendance(true);
    } catch (err) {
      toast.error(t('attendance.syncAttendance'));
    }
  };

  // Handle browser/tab close for students
  useEffect(() => {
    if (user?.role !== 'STUDENT' || !attendanceRecordedRef.current) return;

    const handleBeforeUnload = (e) => {
      // Try to record leave (best effort, may not complete)
      leaveLiveSession(sessionId).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, sessionId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ATTENDED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PARTIAL':
        return <Minus className="w-4 h-4 text-yellow-500" />;
      case 'ABSENT':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'JOINED':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'LEFT':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-300" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'ATTENDED': return t('liveSession.present');
      case 'PARTIAL': return t('liveSession.partial');
      case 'ABSENT': return t('liveSession.absent');
      case 'JOINED': return t('liveSession.inSession');
      case 'LEFT': return t('liveSession.leftEarly');
      default: return t('liveSession.notJoined');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => navigate('/live-sessions')}
            className="mt-4 px-4 py-2 bg-primary-900 text-white rounded-lg"
          >
            Back to Live Sessions
          </button>
        </div>
      </Layout>
    );
  }

  // Pre-join screen
  if (!joined) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-900">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white">{session?.title}</h2>
              <p className="text-gray-400 mt-1">{session?.course?.title}</p>
              <p className="text-gray-500 text-sm mt-1">{session?.class?.name}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your display name"
                />
              </div>

              {user?.role === 'STUDENT' && (
                <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">Your attendance will be automatically recorded when you join and leave the session.</p>
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={!displayName.trim()}
                className="w-full py-3 bg-primary-900 hover:bg-primary-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Join Meeting
              </button>

              <button
                onClick={() => navigate('/live-sessions')}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-medium">{session?.title}</h1>
            <p className="text-xs text-gray-400">{session?.class?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE
          </span>
          {user?.role === 'TEACHER' && session?.teacherId === user.id && (
            <>
              <button
                onClick={fetchAttendance}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1"
              >
                <Users className="w-4 h-4" />
                {t('attendance.title')}
              </button>
              <button
                onClick={handleEndCall}
                disabled={endingSession}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg"
              >
                {endingSession ? t('liveSession.ending') : t('liveSession.endClass')}
              </button>
            </>
          )}
          {user?.role === 'STUDENT' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded">
              <UserCheck className="w-3 h-3" />
              {t('liveSession.attendanceTracked')}
            </span>
          )}
          {user?.role === 'STUDENT' && faceAlerts > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 text-xs font-medium rounded">
              <AlertCircle className="w-3 h-3" />
              {faceAlerts} face alert{faceAlerts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* Jitsi Meeting Container */}
      <div className="flex-1 relative">
        <div ref={jitsiContainerRef} style={{ height: '100%', width: '100%' }} />
        {/* Face tracker for students */}
        {user?.role === 'STUDENT' && joined && (
          <LiveFaceTracker
            active={true}
            sessionId={sessionId}
            onMismatch={() => setFaceAlerts(prev => prev + 1)}
            intervalMs={120000}
          />
        )}
      </div>

      {/* Attendance Sidebar for Teachers */}
      {showAttendance && attendanceData && (
        <div className="fixed inset-y-0 right-0 w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">Live Attendance</h3>
            <button
              onClick={() => setShowAttendance(false)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 p-4">
            <div className="bg-green-900/30 rounded-lg p-3 text-center">
              <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-green-400 font-bold text-lg">{attendanceData.attended + attendanceData.joined}</p>
              <p className="text-green-300 text-xs">Present</p>
            </div>
            <div className="bg-yellow-900/30 rounded-lg p-3 text-center">
              <Minus className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-yellow-400 font-bold text-lg">{attendanceData.partial}</p>
              <p className="text-yellow-300 text-xs">Partial</p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 text-center">
              <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <p className="text-red-400 font-bold text-lg">{attendanceData.absent}</p>
              <p className="text-red-300 text-xs">Absent</p>
            </div>
          </div>

          <div className="px-4 pb-2">
            <p className="text-gray-400 text-sm">{attendanceData.totalStudents} students in class</p>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Show students with attendance records */}
            {attendanceData.attendance.map((att) => (
              <div key={att.id} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-gray-300 text-sm font-medium">
                      {att.student?.fullName?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{att.student?.fullName}</p>
                    <p className="text-gray-500 text-xs">
                      {att.duration ? `${att.duration} min` : t('liveSession.inSession')}
                      {att.faceAlerts > 0 && (
                        <span className="text-red-400 ml-2">
                          ⚠ {att.faceAlerts} face alert{att.faceAlerts !== 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(att.status)}
                  <span className={`text-xs ${
                    att.status === 'ATTENDED' || att.status === 'JOINED' ? 'text-green-400' :
                    att.status === 'PARTIAL' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {getStatusLabel(att.status)}
                  </span>
                </div>
              </div>
            ))}

            {/* Show students without attendance (not joined yet) */}
            {attendanceData.classStudents
              .filter(cs => !attendanceData.attendance.some(a => a.studentId === cs.id))
              .map(cs => (
                <div key={cs.id} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-gray-300 text-sm font-medium">
                        {cs.fullName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{cs.fullName}</p>
                      <p className="text-gray-500 text-xs">{cs.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">Not joined</span>
                  </div>
                </div>
              ))
            }
          </div>

          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => setShowAttendance(false)}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
