import { BaseController } from '../core/BaseController.js';
import { ClassService } from '../services/ClassService.js';

export class ClassController extends BaseController {
  constructor() {
    super();
    this.classService = new ClassService();
    
  }

  setupRoutes() {
    this.rolePost('/classes', (req, res) => this.createClass(req, res), ['ADMIN']);
    this.authGet('/classes', (req, res) => this.getClasses(req, res));
    this.authGet('/classes/:classId', (req, res) => this.getClass(req, res));
    this.rolePatch('/classes/:classId', (req, res) => this.updateClass(req, res), ['ADMIN']);
    this.roleDelete('/classes/:classId', (req, res) => this.deleteClass(req, res), ['ADMIN']);

    // Student assignments
    this.rolePost('/classes/:classId/students', (req, res) => this.assignStudents(req, res), ['ADMIN']);
    this.roleDelete('/classes/:classId/students/:studentId', (req, res) => this.removeStudent(req, res), ['ADMIN']);

    // Teacher assignments
    this.rolePost('/classes/:classId/teachers', (req, res) => this.assignTeachers(req, res), ['ADMIN']);
    this.roleDelete('/classes/:classId/teachers/:teacherId', (req, res) => this.removeTeacher(req, res), ['ADMIN']);

    // Course assignments
    this.rolePost('/classes/:classId/courses', (req, res) => this.assignCourse(req, res), ['ADMIN']);
    this.roleDelete('/classes/:classId/courses/:courseId', (req, res) => this.removeCourse(req, res), ['ADMIN']);
  }

  async createClass(req, res) {
    const cls = await this.classService.createClass(req.user, req.body);
    res.status(201).json(cls);
  }

  async getClasses(req, res) {
    const classes = await this.classService.getClasses(req.user);
    res.json(classes);
  }

  async getClass(req, res) {
    const cls = await this.classService.getClass(req.params.classId);
    res.json(cls);
  }

  async updateClass(req, res) {
    const cls = await this.classService.updateClass(req.user, req.params.classId, req.body);
    res.json(cls);
  }

  async deleteClass(req, res) {
    await this.classService.deleteClass(req.user, req.params.classId);
    res.json({ success: true });
  }

  async assignStudents(req, res) {
    const studentIds = req.body.studentIds || (req.body.studentId ? [req.body.studentId] : []);
    const result = await this.classService.assignStudents(req.user, req.params.classId, studentIds);
    res.json(result);
  }

  async removeStudent(req, res) {
    await this.classService.removeStudent(req.user, req.params.classId, req.params.studentId);
    res.json({ success: true });
  }

  async assignTeachers(req, res) {
    const teacherIds = req.body.teacherIds || (req.body.teacherId ? [req.body.teacherId] : []);
    const result = await this.classService.assignTeachers(req.user, req.params.classId, teacherIds);
    res.json(result);
  }

  async removeTeacher(req, res) {
    await this.classService.removeTeacher(req.user, req.params.classId, req.params.teacherId);
    res.json({ success: true });
  }

  async assignCourse(req, res) {
    const result = await this.classService.assignCourse(req.user, req.params.classId, req.body.courseId, req.body.teacherId);
    res.json(result);
  }

  async removeCourse(req, res) {
    await this.classService.removeCourse(req.user, req.params.classId, req.params.courseId);
    res.json({ success: true });
  }
}
