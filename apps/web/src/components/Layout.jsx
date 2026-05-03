import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import {
  Home,
  Users,
  BookOpen,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle,
  Video,
  ScanFace,
  Sun,
  Moon,
  FileText,
  User,
  Bell,
  Calendar,
  ClipboardList,
  Award,
  CalendarClock,
  Building2,
  Brain,
  ScrollText
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import lucyLogo from '../assets/lucy_logobg.png';
import { getAdminNotifications, getNotifications, markAllNotificationsRead, getTeacherQuestionReportsCount } from '../api';
import LanguageSwitcher from './LanguageSwitcher';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState({
    faceVerifications: 0,
    studentProfiles: 0,
    pendingUsers: 0,
    pendingAddDropRequests: 0,
    pendingQuestionReports: 0,
    total: 0,
  });
  const [teacherNotifications, setTeacherNotifications] = useState({
    pendingQuestionReports: 0,
    notifications: [],
    unreadCount: 0,
  });
  const [studentNotifications, setStudentNotifications] = useState({
    notifications: [],
    unreadCount: 0,
  });

  // Fetch notifications for admin
  const fetchNotifications = useCallback(async () => {
    if (user?.role === 'ADMIN') {
      try {
        const data = await getAdminNotifications();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    } else if (user?.role === 'TEACHER') {
      try {
        const [reportsData, notifData] = await Promise.all([
          getTeacherQuestionReportsCount(),
          getNotifications(),
        ]);
        setTeacherNotifications({
          pendingQuestionReports: reportsData.pendingCount,
          notifications: notifData.notifications || [],
          unreadCount: notifData.unreadCount || 0,
        });
      } catch (err) {
        console.error('Failed to fetch teacher notifications:', err);
      }
    } else if (user?.role === 'STUDENT') {
      try {
        const data = await getNotifications();
        setStudentNotifications(data);
      } catch (err) {
        console.error('Failed to fetch student notifications:', err);
      }
    }
  }, [user?.role]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh notifications when location changes
  useEffect(() => {
    fetchNotifications();
  }, [location.pathname, user?.role, fetchNotifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get notification count for a specific path
  const getNotificationCount = (path) => {
    if (user?.role === 'ADMIN') {
      switch (path) {
        case '/admin/face-verifications':
          return notifications.faceVerifications;
        case '/admin/student-profiles':
          return notifications.studentProfiles;
        case '/admin/users':
          return notifications.pendingUsers;
        default:
          return 0;
      }
    }
    if (user?.role === 'TEACHER') {
      switch (path) {
        case '/teacher/question-reports':
          return teacherNotifications.pendingQuestionReports;
        default:
          return 0;
      }
    }
    return 0;
  };

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: Home },
    ...(user?.role === 'ADMIN' ? [
      { path: '/admin/classes', label: t('nav.classes'), icon: Users },
      { path: '/admin/users', label: t('nav.users'), icon: UserCircle },
      { path: '/admin/courses', label: t('nav.courses'), icon: BookOpen },
      { path: '/admin/academic', label: t('nav.academic'), icon: Calendar },
      { path: '/admin/departments', label: t('nav.departments'), icon: Building2 },
      { path: '/admin/face-verifications', label: t('nav.faceVerification'), icon: ScanFace },
      { path: '/admin/student-profiles', label: t('nav.studentProfiles'), icon: FileText },
      { path: '/admin/add-drop-requests', label: t('nav.addDropRequests'), icon: ClipboardList },
      { path: '/admin/audit-logs', label: t('nav.auditLogs'), icon: ScrollText },
      { path: '/admin/results', label: t('nav.adminResults'), icon: Award },
    ] : []),
    ...(user?.role === 'TEACHER' ? [
      { path: '/my-classes', label: t('nav.myClasses'), icon: Users },
      { path: '/schedule', label: t('nav.schedule'), icon: Calendar },
      { path: '/teacher/grades', label: t('nav.gradeManagement'), icon: ClipboardList },
      { path: '/teacher/question-reports', label: t('nav.questionReports'), icon: FileText },
      { path: '/live-sessions', label: t('nav.liveClasses'), icon: Video },
    ] : []),
    ...(user?.role === 'STUDENT' ? [
      { path: '/my-classes', label: t('nav.myClasses'), icon: GraduationCap },
      { path: '/schedule', label: t('nav.schedule'), icon: Calendar },
      { path: '/student/registration', label: t('nav.semesterRegistration'), icon: ClipboardList },
      { path: '/student/add-drop', label: t('nav.addDropCourses'), icon: ClipboardList },
      { path: '/student/exams', label: t('nav.examSchedule'), icon: CalendarClock },
      { path: '/student/results', label: t('nav.myResults'), icon: Award },
      { path: '/student/my-reports', label: t('nav.myReports'), icon: FileText },
      { path: '/live-sessions', label: t('nav.liveClasses'), icon: Video },
      { path: '/student-profile', label: t('nav.myProfile'), icon: User },
    ] : []),
    ...(user?.role === 'ADMIN' ? [
      { path: '/performance', label: t('nav.performance'), icon: Brain },
    ] : []),
    { path: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 bg-primary-900 dark:bg-primary-950">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-lg p-1 flex items-center justify-center">
              <img src={lucyLogo} alt="Lucy College" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg text-white">{t('nav.lucyCollege')}</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-primary-800 dark:hover:bg-primary-900 rounded">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-4rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const notifCount = getNotificationCount(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                  isActive 
                    ? 'bg-primary-900 dark:bg-primary-800 text-white font-medium' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-700 hover:text-primary-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {notifCount > 0 && (
                  <span className="absolute right-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Menu className="w-5 h-5 dark:text-gray-300" />
          </button>

          <div className="flex-1 lg:hidden" />

          <div className="hidden lg:flex items-center gap-2 text-primary-900 dark:text-primary-300 font-semibold">
            <GraduationCap className="w-5 h-5" />
            <span>{t('nav.lms')}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell - Student */}
            {user?.role === 'STUDENT' && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white relative"
                >
                  <Bell className="w-5 h-5" />
                  {studentNotifications.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-bounce">
                      {studentNotifications.unreadCount > 99 ? '99+' : studentNotifications.unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-semibold text-sm">{t('nav.notifications')}</h3>
                      <button
                        onClick={async () => {
                          await markAllNotificationsRead();
                          setStudentNotifications({ ...studentNotifications, unreadCount: 0, notifications: studentNotifications.notifications.map(n => ({ ...n, isRead: true })) });
                          setShowNotificationDropdown(false);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t('nav.markAllRead')}
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {studentNotifications.notifications.slice(0, 5).map(notif => (
                        <Link
                          key={notif.id}
                          to={
                            notif.type === 'REGISTRATION_OPEN' ? '/student/registration' :
                            notif.type === 'GRADE_PUBLISHED' ? '/student/results' :
                            notif.type === 'NEW_ASSESSMENT' ? '/my-classes' :
                            notif.type === 'ASSESSMENT_OPENED' ? '/my-classes' :
                            notif.type === 'ASSESSMENT_CREATED' ? '/my-classes' :
                            notif.type === 'ADD_DROP_APPROVED' ? '/student/my-courses' :
                            notif.type === 'ADD_DROP_REJECTED' ? '/student/add-drop' :
                            notif.type === 'QUESTION_REPORT_RESOLVED' ? '/student/my-reports' :
                            '/'
                          }
                          onClick={() => setShowNotificationDropdown(false)}
                          className={`block p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </Link>
                      ))}
                      {studentNotifications.notifications.length === 0 && (
                        <p className="p-4 text-center text-gray-500 text-sm">{t('nav.noNotifications')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Bell - Teacher */}
            {user?.role === 'TEACHER' && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white relative"
                >
                  <Bell className="w-5 h-5" />
                  {teacherNotifications.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-bounce">
                      {teacherNotifications.unreadCount > 99 ? '99+' : teacherNotifications.unreadCount}
                    </span>
                  )}
                </button>
                {showNotificationDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-semibold text-sm">{t('nav.notifications')}</h3>
                      <button
                        onClick={async () => {
                          await markAllNotificationsRead();
                          setTeacherNotifications({ ...teacherNotifications, unreadCount: 0, notifications: teacherNotifications.notifications.map(n => ({ ...n, isRead: true })) });
                          setShowNotificationDropdown(false);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t('nav.markAllRead')}
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {teacherNotifications.notifications.slice(0, 5).map(notif => (
                        <div
                          key={notif.id}
                          className={`block p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                      {teacherNotifications.notifications.length === 0 && (
                        <p className="p-4 text-center text-gray-500 text-sm">{t('nav.noNotifications')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Bell - Admin only */}
            {user?.role === 'ADMIN' && notifications.total > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white relative"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-bounce">
                    {notifications.total > 99 ? '99+' : notifications.total}
                  </span>
                </button>

                {/* Admin Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-sm">{t('nav.pendingActions')}</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {notifications.pendingUsers > 0 && (
                        <Link
                          to="/admin/users"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm">{t('nav.pendingUsers')}</span>
                          </div>
                          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{notifications.pendingUsers}</span>
                        </Link>
                      )}
                      {notifications.faceVerifications > 0 && (
                        <Link
                          to="/admin/face-verifications"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                              <ScanFace className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-sm">{t('nav.faceVerifications')}</span>
                          </div>
                          <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">{notifications.faceVerifications}</span>
                        </Link>
                      )}
                      {notifications.studentProfiles > 0 && (
                        <Link
                          to="/admin/student-profiles"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm">{t('nav.studentProfiles')}</span>
                          </div>
                          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">{notifications.studentProfiles}</span>
                        </Link>
                      )}
                      {notifications.pendingAddDropRequests > 0 && (
                        <Link
                          to="/admin/add-drop-requests"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                              <ClipboardList className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-sm">{t('nav.addDropRequests')}</span>
                          </div>
                          <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{notifications.pendingAddDropRequests}</span>
                        </Link>
                      )}
                      {notifications.pendingQuestionReports > 0 && (
                        <Link
                          to="/admin/question-reports"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                              <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-sm">{t('nav.questionReports')}</span>
                          </div>
                          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{notifications.pendingQuestionReports}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white"
              title={darkMode ? t('nav.switchToLight') : t('nav.switchToDark')}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Language switcher */}
            <LanguageSwitcher />

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            {user?.profileImage ? (
              <img 
                src={user.profileImage} 
                alt={user.fullName} 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary-900 dark:border-primary-700"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-900 dark:bg-primary-700 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm sm:text-base">
                  {user?.fullName?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white"
              title={t('nav.logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
