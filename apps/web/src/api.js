// API base URL - uses local API when on localhost or local network, Render in production
const isLocal = window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1'
  || window.location.hostname.startsWith('192.168.')
  || window.location.hostname.startsWith('10.')
  || window.location.hostname.startsWith('172.16.');
const API_BASE = isLocal
  ? `http://${window.location.hostname}:4000/api`
  : 'https://lastlucy.onrender.com/api';

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this._refreshing = null;
    this._onError = null;
  }

  onError(callback) {
    this._onError = callback;
    return () => { this._onError = null; };
  }

  getToken() {
    return localStorage.getItem('accessToken');
  }

  async refreshTokens() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await fetch(`${this.baseURL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) throw new Error('Refresh failed');
        const data = await res.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return data.accessToken;
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new Error('Session expired');
      } finally {
        this._refreshing = null;
      }
    })();
    return this._refreshing;
  }

  async fetch(path, options = {}) {
    const token = this.getToken();
    const res = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401 && token) {
      const newToken = await this.refreshTokens();
      const retry = await fetch(`${this.baseURL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new Error(body.error || body.message || `HTTP ${retry.status}`);
      }
      return retry.json();
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      let message = body.error || body.message || `HTTP ${res.status}`;
      // Format Zod validation details into readable message
      if (Array.isArray(body.details) && body.details.length > 0) {
        const fieldMessages = body.details.map(d => {
          const field = d.path?.join('.') || '';
          return field ? `${field}: ${d.message}` : d.message;
        });
        message = fieldMessages.join('\n');
      }
      const err = new Error(message);
      if (body.missingFields) err.missingFields = body.missingFields;
      if (body.details) err.details = body.details;
      // Flatten details.missingFields for convenience
      if (body.details?.missingFields) err.missingFields = body.details.missingFields;
      if (this._onError) this._onError(err);
      throw err;
    }

    return res.json();
  }

  get(path) { return this.fetch(path); }
  post(path, data) { return this.fetch(path, { method: 'POST', body: JSON.stringify(data) }); }
  put(path, data) { return this.fetch(path, { method: 'PUT', body: JSON.stringify(data) }); }
  patch(path, data) { return this.fetch(path, { method: 'PATCH', body: JSON.stringify(data) }); }
  del(path) { return this.fetch(path, { method: 'DELETE' }); }
}

const api = new ApiClient(API_BASE);
export { api, API_BASE };
export default api;

// ==================== AUTH ====================
export async function register(data) { return api.post('/auth/register', data); }
export async function login(data) {
  const result = await api.post('/auth/login', data);
  localStorage.setItem('accessToken', result.accessToken);
  localStorage.setItem('refreshToken', result.refreshToken);
  return result;
}
export async function getMe() { return api.get('/auth/me'); }
export async function updateMyProfile(data) { return api.patch('/users/me/profile', data); }
export async function changePassword(currentPassword, newPassword) { return api.patch('/users/me/password', { currentPassword, newPassword }); }
export async function adminCreateUser(data) { return api.post('/admin/users', data); }
export async function adminResetPassword(userId, newPassword) { return api.post(`/admin/users/${userId}/reset-password`, { newPassword }); }
export async function adminUpdateUser(userId, data) { return api.patch(`/admin/users/${userId}`, data); }
export async function getPendingUsers() { return api.get('/admin/users/pending'); }
export async function approveUser(userId) { return api.post(`/admin/users/${userId}/approve`); }
export async function deleteUser(userId) { return api.del(`/admin/users/${userId}`); }

// ==================== CLASSES ====================
export async function getClasses() { return api.get('/classes'); }
export async function getClass(classId) { return api.get(`/classes/${classId}`); }
export async function createClass(data) { return api.post('/classes', data); }
export async function updateClass(classId, data) { return api.patch(`/classes/${classId}`, data); }
export async function deleteClass(classId) { return api.del(`/classes/${classId}`); }
export async function addStudentToClass(classId, studentId) { return api.post(`/classes/${classId}/students`, { studentId }); }
export async function removeStudentFromClass(classId, studentId) { return api.del(`/classes/${classId}/students/${studentId}`); }
export async function addTeacherToClass(classId, teacherId) { return api.post(`/classes/${classId}/teachers`, { teacherId }); }
export async function removeTeacherFromClass(classId, teacherId) { return api.del(`/classes/${classId}/teachers/${teacherId}`); }
export async function assignCourseToClass(classId, courseId, teacherId) { return api.post(`/classes/${classId}/courses`, { courseId, teacherId }); }
export async function removeCourseFromClass(classId, courseId) { return api.del(`/classes/${classId}/courses/${courseId}`); }

// ==================== COURSES ====================
export async function getCourses() { return api.get('/courses'); }
export async function createCourse(data) { return api.post('/courses', data); }
export async function updateCourse(id, data) { return api.patch(`/courses/${id}`, data); }
export async function deleteCourse(id) { return api.del(`/courses/${id}`); }
export async function getUsers() { return api.get('/users'); }
export async function getCourseStudents(courseId, sectionId) { return api.get(`/courses/${courseId}/students${sectionId ? `?sectionId=${sectionId}` : ''}`); }
export async function getStudentAttempts(courseId) { return api.get(`/courses/${courseId}/my-attempts`); }

// ==================== ASSESSMENTS ====================
export async function getCourseAssessments(courseId) { return api.get(`/courses/${courseId}/assessments`); }
export async function createAssessment(courseId, data) { return api.post(`/courses/${courseId}/assessments`, data); }
export async function createQuestion(assessmentId, data) { return api.post(`/assessments/${assessmentId}/questions`, data); }
export async function updateQuestion(questionId, data) { return api.put(`/questions/${questionId}`, data); }
export async function deleteQuestion(questionId) { return api.del(`/questions/${questionId}`); }
export async function getAssessmentQuestions(assessmentId) { return api.get(`/assessments/${assessmentId}/questions`); }
export async function toggleAssessmentOpen(assessmentId, isOpen) { return api.patch(`/assessments/${assessmentId}/open`, { isOpen }); }
export async function updateAssessment(assessmentId, data) { return api.put(`/assessments/${assessmentId}`, data); }
export async function deleteAssessment(assessmentId) { return api.del(`/assessments/${assessmentId}`); }
export async function getManualGrades(assessmentId) { return api.get(`/assessments/${assessmentId}/manual-grades`); }
export async function setManualGrade(assessmentId, studentId, score, feedback) { return api.put(`/assessments/${assessmentId}/manual-grades/${studentId}`, { score, feedback }); }
export async function deleteManualGrade(assessmentId, studentId) { return api.del(`/assessments/${assessmentId}/manual-grades/${studentId}`); }

// ==================== GRADEBOOK ====================
export async function getGradeComponents(courseId) { return api.get(`/courses/${courseId}/grade-components`); }
export async function addGradeComponent(courseId, name, weight) { return api.post(`/courses/${courseId}/grade-components`, { name, weight }); }
export async function updateGradeComponent(courseId, componentId, data) { return api.patch(`/courses/${courseId}/grade-components/${componentId}`, data); }
export async function deleteGradeComponent(courseId, componentId) { return api.del(`/courses/${courseId}/grade-components/${componentId}`); }
export async function getGradeConfig(courseId) { return api.get(`/courses/${courseId}/grade-components`); }
export async function getAttendance(courseId) { return api.get(`/courses/${courseId}/attendance`); }
export async function setAttendance(courseId, studentId, score, feedback) { return api.put(`/courses/${courseId}/attendance/${studentId}`, { score, feedback }); }
export async function getGradebook(courseId) { return api.get(`/courses/${courseId}/gradebook`); }
export async function getMyGrades(courseId) { return api.get(`/courses/${courseId}/my-grades`); }

// ==================== FACE VERIFICATION ====================
export async function updateProfile(data) { return api.patch('/users/me/profile', data); }
export async function getProfileStatus() { return api.get('/users/me/profile-status'); }
export async function getStudentsProfiles() { return api.get('/admin/students-profiles'); }
export async function getPendingFaceVerifications() { return api.get('/admin/face-verifications/pending'); }
export async function getFaceVerifications(status) { return api.get(`/admin/face-verifications${status ? `?status=${status}` : ''}`); }
export async function reviewFaceVerification(id, approved) { return api.post(`/admin/face-verifications/${id}/review`, { approved }); }
export async function getAttemptsForGrading(assessmentId) { return api.get(`/assessments/${assessmentId}/attempts-for-grading`); }
export async function createFaceVerification(attemptId, capturedImage, matchResult) { return api.post('/face-verifications', { attemptId, capturedImage, matchResult }); }
export async function createVideoFaceVerification(materialId, capturedImage, matchResult) { return api.post('/video-face-verifications', { materialId, capturedImage, matchResult }); }
export async function getVideoTrackingStats(materialId) { return api.get(`/materials/${materialId}/video-tracking`); }
export async function gradeAttempt(attemptId, answers) { return api.post(`/attempts/${attemptId}/grade`, { answers }); }
export async function startAttempt(assessmentId) { return api.post(`/assessments/${assessmentId}/attempts`); }
export async function getAttempt(attemptId) { return api.get(`/attempts/${attemptId}`); }
export async function saveAnswer(attemptId, questionId, data) { return api.patch(`/attempts/${attemptId}/answers`, { questionId, ...data }); }
export async function pauseAttempt(attemptId, remainingSeconds, currentQuestionIdx, answers) { return api.post(`/attempts/${attemptId}/pause`, { remainingSeconds, currentQuestionIdx, answers }); }
export async function autoSaveAttempt(attemptId, answers, remainingSeconds, currentQuestionIdx) { return api.post(`/attempts/${attemptId}/auto-save`, { answers, remainingSeconds, currentQuestionIdx }); }
export async function submitAttempt(attemptId) { return api.post(`/attempts/${attemptId}/submit`); }

// ==================== MATERIALS ====================
export async function getCourseMaterials(courseId) { return api.get(`/courses/${courseId}/materials`); }
export async function createMaterial(courseId, data) { return api.post(`/courses/${courseId}/materials`, data); }
export async function updateMaterial(materialId, data) { return api.put(`/materials/${materialId}`, data); }
export async function deleteMaterial(materialId) { return api.del(`/materials/${materialId}`); }
export async function recordMaterialView(materialId) { return api.post(`/materials/${materialId}/view`); }
export async function closeMaterialView(viewId) { return api.patch(`/material-views/${viewId}/close`); }
export async function getMaterialHtml(materialId) {
  const res = await fetch(`${API_BASE}/materials/${materialId}/html`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  });
  if (!res.ok) throw new Error('Failed to load HTML material');
  return res.text();
}
export async function saveReadingProgress(materialId, progress) { return api.post(`/materials/${materialId}/progress`, progress); }
export async function getReadingProgress(materialId) { return api.get(`/materials/${materialId}/progress`); }
export async function getAllReadingProgress(materialId) { return api.get(`/materials/${materialId}/progress-all`); }
export async function getCourseMaterialStats(courseId) { return api.get(`/courses/${courseId}/material-stats`); }

// ==================== LIVE SESSIONS ====================
export async function getCourseLiveSessions(courseId) { return api.get(`/courses/${courseId}/live-sessions`); }
export async function getClassLiveSessions(classId) { return api.get(`/classes/${classId}/live-sessions`); }
export async function getUpcomingLiveSessions() { return api.get('/live-sessions/upcoming'); }
export async function createLiveSession(courseId, data) { return api.post(`/courses/${courseId}/live-sessions`, data); }
export async function updateLiveSession(sessionId, data) { return api.patch(`/live-sessions/${sessionId}`, data); }
export async function deleteLiveSession(sessionId) { return api.del(`/live-sessions/${sessionId}`); }
export async function getLiveSession(sessionId) { return api.get(`/live-sessions/${sessionId}`); }
export async function joinLiveSession(sessionId) { return api.post(`/live-sessions/${sessionId}/join`); }
export async function leaveLiveSession(sessionId) { return api.post(`/live-sessions/${sessionId}/leave`); }
export async function endLiveSession(sessionId) { return api.post(`/live-sessions/${sessionId}/end`); }
export async function getLiveSessionAttendance(sessionId) { return api.get(`/live-sessions/${sessionId}/attendance`); }
export async function reportFaceAlert(sessionId) { return api.post(`/live-sessions/${sessionId}/face-alert`); }

// ==================== STUDENT PROFILE ====================
export async function getStudentProfile() { return api.get('/student/profile'); }
export async function updateStudentProfile(data) { return api.patch('/student/profile', data); }
export async function uploadStudentDocument(documentType, fileName, fileUrl) { return api.post('/student/profile/documents', { documentType, fileName, fileUrl }); }
export async function deleteStudentDocument(documentId) { return api.del(`/student/profile/documents/${documentId}`); }
export async function getPendingStudentProfiles() { return api.get('/admin/student-profiles/pending'); }
export async function getAllStudentProfiles(status) { return api.get(`/admin/student-profiles${status ? `?status=${status}` : ''}`); }
export async function getStudentProfileById(profileId) { return api.get(`/admin/student-profiles/${profileId}`); }
export async function approveStudentProfile(profileId) { return api.post(`/admin/student-profiles/${profileId}/approve`); }
export async function rejectStudentProfile(profileId, reason) { return api.post(`/admin/student-profiles/${profileId}/reject`, { reason }); }

// ==================== NOTIFICATIONS ====================
export async function getAdminNotifications() { return api.get('/admin/notifications'); }
export async function getNotifications() { return api.get('/notifications'); }
export async function markNotificationRead(id) { return api.patch(`/notifications/${id}/read`); }
export async function markAllNotificationsRead() { return api.post('/notifications/read-all'); }

// ==================== ACADEMIC MANAGEMENT ====================
export async function createAcademicYear(data) { return api.post('/admin/academic-years', data); }
export async function getAcademicYears() { return api.get('/admin/academic-years'); }
export async function updateAcademicYear(id, data) { return api.patch(`/admin/academic-years/${id}`, data); }
export async function deleteAcademicYear(id) { return api.del(`/admin/academic-years/${id}`); }
export async function createSemester(data) {
  const sanitized = { ...data };
  if (sanitized.registrationFee !== '' && sanitized.registrationFee !== undefined) {
    sanitized.registrationFee = parseFloat(sanitized.registrationFee) || null;
  } else { sanitized.registrationFee = null; }
  return api.post('/admin/semesters', sanitized);
}
export async function getSemesters() { return api.get('/admin/semesters'); }
export async function getCurrentSemester() { return api.get('/semesters/current'); }
export async function updateSemester(id, data) {
  const sanitized = { ...data };
  if (sanitized.registrationFee !== '' && sanitized.registrationFee !== undefined) {
    sanitized.registrationFee = parseFloat(sanitized.registrationFee) || null;
  } else if (sanitized.registrationFee === '') { sanitized.registrationFee = null; }
  return api.patch(`/admin/semesters/${id}`, sanitized);
}
export async function deleteSemester(id) { return api.del(`/admin/semesters/${id}`); }
export async function publishSemesterGrades(semesterId) { return api.post(`/admin/semesters/${semesterId}/publish-grades`); }
export async function getSemesterGPAReport(semesterId) { return api.get(`/admin/semesters/${semesterId}/gpa-report`); }
export async function createCourseSection(data) { return api.post('/admin/course-sections', data); }
export async function getCourseSections(semesterId) { return api.get(`/admin/course-sections${semesterId ? `?semesterId=${semesterId}` : ''}`); }
export async function updateCourseSection(id, data) { return api.patch(`/admin/course-sections/${id}`, data); }
export async function deleteCourseSection(id) { return api.del(`/admin/course-sections/${id}`); }
export async function enrollStudent(data) { return api.post('/admin/enrollments', data); }
export async function getSectionEnrollments(sectionId) { return api.get(`/admin/course-sections/${sectionId}/enrollments`); }
export async function removeEnrollment(enrollmentId) { return api.del(`/admin/enrollments/${enrollmentId}`); }
export async function getAvailableCourses() { return api.get('/student/available-courses'); }
export async function registerForSemester() { return api.post('/student/register-semester'); }
export async function getMyEnrollments() { return api.get('/student/my-courses'); }
export async function getMyResults(semesterId) { return api.get(`/student/results${semesterId ? `/${semesterId}` : ''}`); }
export async function getMyCGPA() { return api.get('/student/cgpa'); }
export async function getTeacherSections() { return api.get('/teacher/my-sections'); }
export async function getMyWeeklySchedule() { return api.get('/student/my-schedule'); }
export async function getTeacherWeeklySchedule() { return api.get('/teacher/my-schedule'); }
export async function createScheduleSlot(sectionId, data) { return api.post(`/admin/course-sections/${sectionId}/schedule-slots`, data); }
export async function deleteScheduleSlot(slotId) { return api.del(`/admin/schedule-slots/${slotId}`); }
export async function getAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.action) query.set('action', params.action);
  if (params.category) query.set('category', params.category);
  if (params.userId) query.set('userId', params.userId);
  if (params.search) query.set('search', params.search);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  const qs = query.toString();
  return api.get(`/admin/audit-logs${qs ? '?' + qs : ''}`);
}
export async function getAdminResults(params = {}) {
  const query = new URLSearchParams();
  if (params.semesterId) query.set('semesterId', params.semesterId);
  if (params.sectionId) query.set('sectionId', params.sectionId);
  if (params.studentId) query.set('studentId', params.studentId);
  const qs = query.toString();
  return api.get(`/admin/results${qs ? '?' + qs : ''}`);
}
export async function getSectionStudents(sectionId) { return api.get(`/teacher/sections/${sectionId}/students`); }
export async function enterGrade(data) { return api.post('/teacher/grades', data); }
export async function submitSectionGrades(sectionId) { return api.post(`/teacher/sections/${sectionId}/submit-grades`); }
export async function syncAssessmentsToGrades(sectionId) { return api.post(`/teacher/sections/${sectionId}/sync-assessments`); }
export async function getLiveAttendanceStats(sectionId) { return api.get(`/course-sections/${sectionId}/live-attendance`); }
export async function syncAttendanceToGrades(sectionId) { return api.post(`/course-sections/${sectionId}/sync-attendance`); }
export async function createManualAttendance(sectionId, data) { return api.post(`/course-sections/${sectionId}/manual-attendance`, data); }
export async function getManualAttendanceSessions(sectionId) { return api.get(`/course-sections/${sectionId}/manual-attendance`); }
export async function deleteManualAttendanceSession(sessionId) { return api.del(`/manual-attendance/${sessionId}`); }
export async function createExamSchedule(data) { return api.post('/teacher/exam-schedules', data); }
export async function getSectionExamSchedules(sectionId) { return api.get(`/teacher/sections/${sectionId}/exam-schedules`); }
export async function updateExamSchedule(id, data) { return api.patch(`/teacher/exam-schedules/${id}`, data); }
export async function deleteExamSchedule(id) { return api.del(`/teacher/exam-schedules/${id}`); }
export async function proposeEarlyExam(id, data) { return api.post(`/teacher/exam-schedules/${id}/propose-early`, data); }
export async function cancelEarlyExamProposal(id) { return api.del(`/teacher/exam-schedules/${id}/propose-early`); }
export async function getEarlyExamResponses(examScheduleId) { return api.get(`/teacher/exam-schedules/${examScheduleId}/early-responses`); }
export async function confirmEarlyExam(examScheduleId) { return api.post(`/teacher/exam-schedules/${examScheduleId}/confirm-early`); }
export async function getStudentExamSchedules() { return api.get('/student/exam-schedules'); }
export async function respondToEarlyExamProposal(examScheduleId, agreed) { return api.post(`/student/exam-schedules/${examScheduleId}/respond`, { agreed }); }

// ==================== QUESTION REPORTS ====================
export async function reportQuestion(questionId, reason) { return api.post(`/questions/${questionId}/report`, { reason }); }
export async function getMyQuestionReports() { return api.get('/my/question-reports'); }
export async function deleteMyQuestionReport(reportId) { return api.del(`/my/question-reports/${reportId}`); }
export async function getTeacherQuestionReports(status = 'ALL') { return api.get(`/teacher/question-reports${status !== 'ALL' ? `?status=${status}` : ''}`); }
export async function updateQuestionReportStatus(reportId, data) { return api.patch(`/teacher/question-reports/${reportId}`, data); }
export async function getTeacherQuestionReportsCount() { return api.get('/teacher/question-reports/count'); }

// ==================== ADD/DROP ====================
export async function getAddDropEligibility() { return api.get('/add-drop/eligibility'); }
export async function submitAddRequest(courseSectionId, reason) { return api.post('/add-drop/add', { courseSectionId, reason }); }
export async function submitDropRequest(enrollmentId, reason) { return api.post('/add-drop/drop', { enrollmentId, reason }); }
export async function cancelAddDropRequest(requestId) { return api.del(`/add-drop/${requestId}`); }
export async function getAdminAddDropRequests(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== '') params.append('status', filters.status);
  if (filters.type && filters.type !== '') params.append('type', filters.type);
  if (filters.semesterId && filters.semesterId !== '') params.append('semesterId', filters.semesterId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/admin/add-drop-requests${query}`);
}
export async function approveAddDropRequest(requestId, adminNotes) { return api.post(`/admin/add-drop-requests/${requestId}/approve`, { adminNotes }); }
export async function rejectAddDropRequest(requestId, adminNotes) { return api.post(`/admin/add-drop-requests/${requestId}/reject`, { adminNotes }); }
export async function getSemestersAddDrop() { return api.get('/admin/semesters/add-drop'); }
export async function updateSemesterAddDrop(semesterId, addDropStart, addDropEnd) { return api.patch(`/admin/semesters/${semesterId}/add-drop`, { addDropStart, addDropEnd }); }

// ==================== ANALYTICS ====================
export async function getAdminAnalytics() { return api.get('/analytics/admin'); }
export async function getTeacherAnalytics() { return api.get('/analytics/teacher'); }
export async function getTeacherAtRiskStudents() { return api.get('/analytics/teacher/at-risk'); }
export async function getStudentAnalytics() { return api.get('/analytics/student'); }
export async function getPublicAnalytics() { return api.get('/analytics/public'); }

// ==================== PAYMENT ====================
export async function initializePayment(semesterId) { return api.post('/payments/initialize', { semesterId }); }
export async function verifyPayment(txRef) { return api.get(`/payments/verify/${txRef}`); }
export async function getMyPayments() { return api.get('/payments/my'); }
export async function getPaymentStatus(semesterId) { return api.get(`/payments/semester/${semesterId}/status`); }
export async function getSemesterPayments(semesterId) { return api.get(`/admin/payments/semester/${semesterId}`); }
export async function setRegistrationFee(semesterId, registrationFee) { return api.patch(`/admin/semesters/${semesterId}/fee`, { registrationFee }); }
export async function getStudentRegistrationFee() { return api.get('/student/registration-fee'); }

// ==================== DEPARTMENTS ====================
export async function getDepartments() { return api.get('/departments'); }
export async function getDepartment(id) { return api.get(`/departments/${id}`); }
export async function createDepartment(data) { return api.post('/admin/departments', data); }
export async function updateDepartment(id, data) { return api.patch(`/admin/departments/${id}`, data); }
export async function deleteDepartment(id) { return api.del(`/admin/departments/${id}`); }

// ==================== CERTIFICATES ====================
export async function getStudentGraduationStatus() { return api.get('/student/graduation-status'); }
export async function getStudentCertificates() { return api.get('/student/certificates'); }
export async function studentGenerateCertificate() { return api.post('/student/generate-certificate'); }
export async function generateCertificate(studentId) { return api.post('/admin/certificates/generate', { studentId }); }
export async function getAdminCertificates() { return api.get('/admin/certificates'); }
export async function getCertificateById(id) { return api.get(`/certificates/${id}`); }
export async function getStudentTranscript(studentId) { return api.get(studentId ? `/admin/students/${studentId}/transcript` : '/student/transcript'); }
export async function getJaasToken(sessionId) { return api.post(`/live-sessions/${sessionId}/jaas-token`); }

// ==================== ML PERFORMANCE ====================
export async function trainMLModel() { return api.post('/ml/train'); }
export async function getMLAnalytics() { return api.get('/ml/analytics'); }
export async function getMLFeatureImportance() { return api.get('/ml/feature-importance'); }
export async function predictStudentPerformance(features) { return api.post('/ml/predict', features); }
export async function predictStudentById(studentId) { return api.get(`/ml/predict-student/${studentId}`); }
