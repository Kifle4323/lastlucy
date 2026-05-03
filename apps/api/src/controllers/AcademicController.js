import { BaseController } from '../core/BaseController.js';
import { AcademicService } from '../services/AcademicService.js';

export class AcademicController extends BaseController {
  constructor() {
    super();
    this.academicService = new AcademicService();
    
  }

  setupRoutes() {
    // Academic Years
    this.rolePost('/admin/academic-years', (req, res) => this.createAcademicYear(req, res), ['ADMIN']);
    this.roleGet('/admin/academic-years', (req, res) => this.getAcademicYears(req, res), ['ADMIN']);
    this.rolePatch('/admin/academic-years/:id', (req, res) => this.updateAcademicYear(req, res), ['ADMIN']);
    this.roleDelete('/admin/academic-years/:id', (req, res) => this.deleteAcademicYear(req, res), ['ADMIN']);

    // Semesters
    this.rolePost('/admin/semesters', (req, res) => this.createSemester(req, res), ['ADMIN']);
    this.roleGet('/admin/semesters', (req, res) => this.getSemesters(req, res), ['ADMIN']);
    this.rolePatch('/admin/semesters/:id', (req, res) => this.updateSemester(req, res), ['ADMIN']);
    this.roleDelete('/admin/semesters/:id', (req, res) => this.deleteSemester(req, res), ['ADMIN']);

    // Course Sections
    this.roleGet('/admin/course-sections', (req, res) => this.getSections(req, res), ['ADMIN']);
    this.rolePost('/admin/course-sections', (req, res) => this.createSection(req, res), ['ADMIN']);
    this.authGet('/course-sections', (req, res) => this.getSections(req, res));
    this.authGet('/course-sections/:sectionId', (req, res) => this.getSection(req, res));
    this.rolePatch('/admin/course-sections/:sectionId', (req, res) => this.updateSection(req, res), ['ADMIN']);
    this.roleDelete('/admin/course-sections/:sectionId', (req, res) => this.deleteSection(req, res), ['ADMIN']);

    // Enrollments
    this.rolePost('/admin/course-sections/:sectionId/enroll', (req, res) => this.enrollStudent(req, res), ['ADMIN']);
    this.roleDelete('/admin/course-sections/:sectionId/students/:studentId', (req, res) => this.unenrollStudent(req, res), ['ADMIN']);

    // Grades
    this.rolePost('/admin/course-sections/:sectionId/publish-grades', (req, res) => this.publishGrades(req, res), ['ADMIN']);
    this.rolePost('/admin/course-sections/:sectionId/calculate-grades', (req, res) => this.calculateGrades(req, res), ['ADMIN']);

    // Weekly Schedule routes
    this.roleGet('/student/my-schedule', (req, res) => this.getMyWeeklySchedule(req, res), ['STUDENT']);
    this.roleGet('/teacher/my-schedule', (req, res) => this.getTeacherWeeklySchedule(req, res), ['TEACHER']);
    this.rolePost('/admin/course-sections/:sectionId/schedule-slots', (req, res) => this.createScheduleSlot(req, res), ['ADMIN']);
    this.roleDelete('/admin/schedule-slots/:slotId', (req, res) => this.deleteScheduleSlot(req, res), ['ADMIN']);

    // Student routes
    this.roleGet('/student/my-courses', (req, res) => this.getMyCourses(req, res), ['STUDENT']);
    this.roleGet('/student/available-courses', (req, res) => this.getAvailableCourses(req, res), ['STUDENT']);
    this.rolePost('/student/register-semester', (req, res) => this.registerForSemester(req, res), ['STUDENT']);
    this.roleGet('/student/results/:semesterId?', (req, res) => this.getMyResults(req, res), ['STUDENT']);
    this.roleGet('/student/cgpa', (req, res) => this.getMyCGPA(req, res), ['STUDENT']);
    this.roleGet('/student/exam-schedules', (req, res) => this.getStudentExamSchedules(req, res), ['STUDENT']);
    this.rolePost('/student/exam-schedules/:id/respond', (req, res) => this.respondToEarlyExam(req, res), ['STUDENT']);

    // Teacher routes
    this.roleGet('/teacher/my-sections', (req, res) => this.getTeacherSections(req, res), ['TEACHER']);
    this.roleGet('/teacher/sections/:sectionId/students', (req, res) => this.getSectionStudents(req, res), ['TEACHER']);
    this.rolePost('/teacher/grades', (req, res) => this.enterGrade(req, res), ['TEACHER']);
    this.rolePost('/teacher/sections/:sectionId/submit-grades', (req, res) => this.submitSectionGrades(req, res), ['TEACHER']);
    this.rolePost('/teacher/sections/:sectionId/sync-assessments', (req, res) => this.syncAssessmentsToGrades(req, res), ['TEACHER']);
    this.rolePost('/teacher/exam-schedules', (req, res) => this.createExamSchedule(req, res), ['TEACHER']);
    this.roleGet('/teacher/sections/:sectionId/exam-schedules', (req, res) => this.getSectionExamSchedules(req, res), ['TEACHER']);
    this.rolePatch('/teacher/exam-schedules/:id', (req, res) => this.updateExamSchedule(req, res), ['TEACHER']);
    this.roleDelete('/teacher/exam-schedules/:id', (req, res) => this.deleteExamSchedule(req, res), ['TEACHER']);
    this.rolePost('/teacher/exam-schedules/:id/propose-early', (req, res) => this.proposeEarlyExam(req, res), ['TEACHER']);
    this.roleDelete('/teacher/exam-schedules/:id/propose-early', (req, res) => this.cancelEarlyExamProposal(req, res), ['TEACHER']);
    this.roleGet('/teacher/exam-schedules/:id/early-responses', (req, res) => this.getEarlyExamResponses(req, res), ['TEACHER']);
    this.rolePost('/teacher/exam-schedules/:id/confirm-early', (req, res) => this.confirmEarlyExam(req, res), ['TEACHER']);

    // Admin semester management
    this.roleGet('/admin/semesters/add-drop', (req, res) => this.getSemestersAddDrop(req, res), ['ADMIN']);
    this.rolePatch('/admin/semesters/:semesterId/add-drop', (req, res) => this.updateSemesterAddDrop(req, res), ['ADMIN']);
    this.rolePatch('/admin/semesters/:semesterId/fee', (req, res) => this.setRegistrationFee(req, res), ['ADMIN']);
    this.roleGet('/admin/payments/semester/:semesterId', (req, res) => this.getSemesterPayments(req, res), ['ADMIN']);
    this.roleGet('/admin/audit-logs', (req, res) => this.getAuditLogs(req, res), ['ADMIN']);
    this.roleGet('/admin/enrollments', (req, res) => this.getEnrollments(req, res), ['ADMIN']);
    this.roleDelete('/admin/enrollments/:enrollmentId', (req, res) => this.removeEnrollment(req, res), ['ADMIN']);
    this.authGet('/semesters/current', (req, res) => this.getCurrentSemester(req, res));
    this.rolePost('/admin/semesters/:semesterId/publish-grades', (req, res) => this.publishSemesterGrades(req, res), ['ADMIN']);
    this.roleGet('/admin/semesters/:semesterId/gpa-report', (req, res) => this.getSemesterGPAReport(req, res), ['ADMIN']);
    this.roleGet('/admin/results', (req, res) => this.getAdminResults(req, res), ['ADMIN']);

    // Transcript
    this.roleGet('/student/transcript', (req, res) => this.getStudentTranscript(req, res), ['STUDENT']);
    this.roleGet('/admin/students/:studentId/transcript', (req, res) => this.getAdminTranscript(req, res), ['ADMIN']);
  }

  async createAcademicYear(req, res) {
    const year = await this.academicService.createAcademicYear(req.user, req.body);
    res.status(201).json(year);
  }

  async getAcademicYears(req, res) {
    const years = await this.academicService.getAcademicYears();
    res.json(years);
  }

  async updateAcademicYear(req, res) {
    const year = await this.academicService.updateAcademicYear(req.user, req.params.id, req.body);
    res.json(year);
  }

  async deleteAcademicYear(req, res) {
    await this.academicService.deleteAcademicYear(req.user, req.params.id);
    res.json({ success: true });
  }

  async createSemester(req, res) {
    const semester = await this.academicService.createSemester(req.user, req.body);
    res.status(201).json(semester);
  }

  async getSemesters(req, res) {
    const semesters = await this.academicService.repository.findActiveSemesters();
    res.json(semesters);
  }

  async updateSemester(req, res) {
    const semester = await this.academicService.updateSemester(req.user, req.params.id, req.body);
    res.json(semester);
  }

  async deleteSemester(req, res) {
    await this.academicService.deleteSemester(req.user, req.params.id);
    res.json({ success: true });
  }

  async createSection(req, res) {
    const section = await this.academicService.createSection(req.user, req.body);
    res.status(201).json(section);
  }

  async getSections(req, res) {
    const sections = await this.academicService.getSections(req.query.semesterId);
    res.json(sections);
  }

  async getSection(req, res) {
    const section = await this.academicService.getSection(req.params.sectionId);
    res.json(section);
  }

  async updateSection(req, res) {
    const section = await this.academicService.updateSection(req.user, req.params.sectionId, req.body);
    res.json(section);
  }

  async deleteSection(req, res) {
    await this.academicService.deleteSection(req.user, req.params.sectionId);
    res.json({ success: true });
  }

  async enrollStudent(req, res) {
    const enrollment = await this.academicService.enrollStudent(req.user, req.params.sectionId, req.body.studentId);
    res.json(enrollment);
  }

  async unenrollStudent(req, res) {
    await this.academicService.unenrollStudent(req.user, req.params.sectionId, req.params.studentId);
    res.json({ success: true });
  }

  async publishGrades(req, res) {
    const result = await this.academicService.publishGrades(req.user, req.params.sectionId);
    res.json(result);
  }

  async calculateGrades(req, res) {
    const result = await this.academicService.calculateAndSaveGrades(req.params.sectionId);
    res.json(result);
  }

  // Weekly Schedule methods
  async getMyWeeklySchedule(req, res) {
    const schedule = await this.academicService.getMyWeeklySchedule(req.user.id);
    res.json(schedule);
  }

  async getTeacherWeeklySchedule(req, res) {
    const schedule = await this.academicService.getTeacherWeeklySchedule(req.user.id);
    res.json(schedule);
  }

  async createScheduleSlot(req, res) {
    const slot = await this.academicService.createScheduleSlot(req.user, req.params.sectionId, req.body);
    res.status(201).json(slot);
  }

  async deleteScheduleSlot(req, res) {
    await this.academicService.deleteScheduleSlot(req.user, req.params.slotId);
    res.json({ success: true });
  }

  // Student routes
  async getMyCourses(req, res) {
    const courses = await this.academicService.getMyCourses(req.user.id);
    res.json(courses);
  }

  async getAvailableCourses(req, res) {
    const courses = await this.academicService.getAvailableCourses(req.user.id);
    res.json(courses);
  }

  async registerForSemester(req, res) {
    const result = await this.academicService.registerForSemester(req.user.id);
    res.json(result);
  }

  async getMyResults(req, res) {
    const results = await this.academicService.getMyResults(req.user.id, req.params.semesterId);
    res.json(results);
  }

  async getMyCGPA(req, res) {
    const cgpa = await this.academicService.getMyCGPA(req.user.id);
    res.json(cgpa);
  }

  async getStudentExamSchedules(req, res) {
    const schedules = await this.academicService.getStudentExamSchedules(req.user.id);
    res.json(schedules);
  }

  async respondToEarlyExam(req, res) {
    const result = await this.academicService.respondToEarlyExam(req.user.id, req.params.id, req.body.agreed);
    res.json(result);
  }

  // Teacher routes
  async getTeacherSections(req, res) {
    const sections = await this.academicService.getTeacherSections(req.user.id);
    res.json(sections);
  }

  async getSectionStudents(req, res) {
    const students = await this.academicService.getSectionStudents(req.params.sectionId);
    res.json(students);
  }

  async enterGrade(req, res) {
    const result = await this.academicService.enterGrade(req.user.id, req.body);
    res.json(result);
  }

  async submitSectionGrades(req, res) {
    const result = await this.academicService.submitSectionGrades(req.user.id, req.params.sectionId);
    res.json(result);
  }

  async syncAssessmentsToGrades(req, res) {
    const result = await this.academicService.syncAssessmentsToGrades(req.user.id, req.params.sectionId);
    res.json(result);
  }

  async createExamSchedule(req, res) {
    const schedule = await this.academicService.createExamSchedule(req.user.id, req.body);
    res.json(schedule);
  }

  async getSectionExamSchedules(req, res) {
    const schedules = await this.academicService.getSectionExamSchedules(req.params.sectionId);
    res.json(schedules);
  }

  async updateExamSchedule(req, res) {
    const schedule = await this.academicService.updateExamSchedule(req.params.id, req.body);
    res.json(schedule);
  }

  async deleteExamSchedule(req, res) {
    await this.academicService.deleteExamSchedule(req.params.id);
    res.json({ success: true });
  }

  async proposeEarlyExam(req, res) {
    const result = await this.academicService.proposeEarlyExam(req.params.id, req.user.id, req.body);
    res.json(result);
  }

  async cancelEarlyExamProposal(req, res) {
    const result = await this.academicService.cancelEarlyExamProposal(req.params.id);
    res.json(result);
  }

  async getEarlyExamResponses(req, res) {
    const responses = await this.academicService.getEarlyExamResponses(req.params.id);
    res.json(responses);
  }

  async confirmEarlyExam(req, res) {
    const result = await this.academicService.confirmEarlyExam(req.params.id);
    res.json(result);
  }

  // Admin extended routes
  async getSemestersAddDrop(req, res) {
    const semesters = await this.academicService.getSemestersAddDrop();
    res.json(semesters);
  }

  async updateSemesterAddDrop(req, res) {
    const result = await this.academicService.updateSemesterAddDrop(req.params.semesterId, req.body);
    res.json(result);
  }

  async setRegistrationFee(req, res) {
    const result = await this.academicService.setRegistrationFee(req.params.semesterId, req.body.registrationFee);
    res.json(result);
  }

  async getSemesterPayments(req, res) {
    const payments = await this.academicService.getSemesterPayments(req.params.semesterId);
    res.json(payments);
  }

  async getAuditLogs(req, res) {
    const logs = await this.academicService.getAuditLogs(req.query);
    res.json(logs);
  }

  async getEnrollments(req, res) {
    const enrollments = await this.academicService.getEnrollments(req.query);
    res.json(enrollments);
  }

  async removeEnrollment(req, res) {
    await this.academicService.removeEnrollment(req.params.enrollmentId);
    res.json({ success: true });
  }

  async getCurrentSemester(req, res) {
    const semester = await this.academicService.getCurrentSemester();
    res.json(semester);
  }

  async publishSemesterGrades(req, res) {
    const result = await this.academicService.publishSemesterGrades(req.params.semesterId);
    res.json(result);
  }

  async getSemesterGPAReport(req, res) {
    const report = await this.academicService.getSemesterGPAReport(req.params.semesterId);
    res.json(report);
  }

  async getAdminResults(req, res) {
    const results = await this.academicService.getAdminResults(req.query);
    res.json(results);
  }

  async getStudentTranscript(req, res) {
    const transcript = await this.academicService.getTranscript(req.user.id);
    res.json(transcript);
  }

  async getAdminTranscript(req, res) {
    const transcript = await this.academicService.getTranscript(req.params.studentId);
    res.json(transcript);
  }
}
