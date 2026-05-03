import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { api } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import CoursePage from './pages/CoursePage';
import AdminClassesPage from './pages/AdminClassesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminCoursesPage from './pages/AdminCoursesPage';
import AdminLogsPage from './pages/AdminLogsPage';
import AdminAcademicPage from './pages/AdminAcademicPage';
import AdminDepartmentsPage from './pages/AdminDepartmentsPage';
import MyClassesPage from './pages/MyClassesPage';
import LiveSessionsPage from './pages/LiveSessionsPage';
import LiveMeetingPage from './pages/LiveMeetingPage';
import GradebookPage from './pages/GradebookPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import AdminFaceVerificationPage from './pages/AdminFaceVerificationPage';
import SettingsPage from './pages/SettingsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import AdminStudentProfilesPage from './pages/AdminStudentProfilesPage';
import TeacherGradesPage from './pages/TeacherGradesPage';
import StudentResultsPage from './pages/StudentResultsPage';
import StudentExamsPage from './pages/StudentExamsPage';
import StudentRegistrationPage from './pages/StudentRegistrationPage';
import AddDropPage from './pages/AddDropPage';
import AdminAddDropRequestsPage from './pages/AdminAddDropRequestsPage';
import TeacherQuestionReportsPage from './pages/TeacherQuestionReportsPage';
import StudentMyReportsPage from './pages/StudentMyReportsPage';
import CertificatePage from './pages/CertificatePage';
import StudentPerformancePage from './pages/StudentPerformancePage';
import WeeklySchedulePage from './pages/WeeklySchedulePage';
import AdminResultsPage from './pages/AdminResultsPage';
import TranscriptPage from './pages/TranscriptPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  // Redirect students to complete profile if not complete
  if (user.role === 'STUDENT' && !user.isProfileComplete && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" />;
  }
  
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const toast = useToast();

  // Global API error toast
  useEffect(() => {
    api.onError((err) => {
      // Show validation and server errors as toast
      if (err.details && Array.isArray(err.details)) {
        err.details.forEach(d => {
          const field = d.path?.join('.') || '';
          toast.error(field ? `${field}: ${d.message}` : d.message);
        });
      } else {
        toast.error(err.message);
      }
    });
    return api.onError(null);
  }, [toast]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/my-classes"
        element={
          <PrivateRoute>
            <MyClassesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <PrivateRoute>
            <WeeklySchedulePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/live-sessions"
        element={
          <PrivateRoute>
            <LiveSessionsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/live-sessions/:sessionId"
        element={
          <PrivateRoute>
            <LiveMeetingPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/classes"
        element={
          <PrivateRoute>
            <AdminClassesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <AdminUsersPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/courses"
        element={
          <PrivateRoute>
            <AdminCoursesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/courses/:courseId"
        element={
          <PrivateRoute>
            <CoursePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/courses/:courseId/gradebook"
        element={
          <PrivateRoute>
            <GradebookPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/complete-profile"
        element={
          <PrivateRoute>
            <CompleteProfilePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/face-verifications"
        element={
          <PrivateRoute>
            <AdminFaceVerificationPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <SettingsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student-profile"
        element={
          <PrivateRoute>
            <StudentProfilePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/student-profiles"
        element={
          <PrivateRoute>
            <AdminStudentProfilesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/academic"
        element={
          <PrivateRoute>
            <AdminAcademicPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/departments"
        element={
          <PrivateRoute>
            <AdminDepartmentsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/grades"
        element={
          <PrivateRoute>
            <TeacherGradesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/results"
        element={
          <PrivateRoute>
            <StudentResultsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/registration"
        element={
          <PrivateRoute>
            <StudentRegistrationPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/payment-return"
        element={
          <PrivateRoute>
            <StudentRegistrationPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/exams"
        element={
          <PrivateRoute>
            <StudentExamsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/add-drop"
        element={
          <PrivateRoute>
            <AddDropPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <PrivateRoute>
            <AdminLogsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/add-drop-requests"
        element={
          <PrivateRoute>
            <AdminAddDropRequestsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/results"
        element={
          <PrivateRoute>
            <AdminResultsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/question-reports"
        element={
          <PrivateRoute>
            <TeacherQuestionReportsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/my-reports"
        element={
          <PrivateRoute>
            <StudentMyReportsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/transcript"
        element={
          <PrivateRoute>
            <TranscriptPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/students/:studentId/transcript"
        element={
          <PrivateRoute>
            <AdminRoute>
              <TranscriptPage />
            </AdminRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/certificates/:id"
        element={
          <PrivateRoute>
            <CertificatePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/performance"
        element={
          <PrivateRoute>
            <AdminRoute>
              <StudentPerformancePage />
            </AdminRoute>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
