import { BaseController } from '../core/BaseController.js';
import { CourseService } from '../services/CourseService.js';

export class CourseController extends BaseController {
  constructor() {
    super();
    this.courseService = new CourseService();
    
  }

  setupRoutes() {
    this.rolePost('/courses', (req, res) => this.createCourse(req, res), ['ADMIN']);
    this.authGet('/courses', (req, res) => this.getCourses(req, res));
    this.authGet('/courses/:courseId', (req, res) => this.getCourse(req, res));
    this.authGet('/courses/:courseId/students', (req, res) => this.getCourseStudents(req, res));
    this.authGet('/courses/:courseId/material-stats', (req, res) => this.getMaterialStats(req, res));
    this.rolePatch('/courses/:courseId', (req, res) => this.updateCourse(req, res), ['ADMIN']);
    this.roleDelete('/courses/:courseId', (req, res) => this.deleteCourse(req, res), ['ADMIN']);
  }

  async createCourse(req, res) {
    const course = await this.courseService.createCourse(req.user, req.body);
    res.status(201).json(course);
  }

  async getCourses(req, res) {
    const courses = await this.courseService.getCourses(req.user);
    res.json(courses);
  }

  async getCourse(req, res) {
    const course = await this.courseService.getCourse(req.params.courseId);
    res.json(course);
  }

  async updateCourse(req, res) {
    const course = await this.courseService.updateCourse(req.user, req.params.courseId, req.body);
    res.json(course);
  }

  async deleteCourse(req, res) {
    await this.courseService.deleteCourse(req.user, req.params.courseId);
    res.json({ success: true });
  }

  async getCourseStudents(req, res) {
    const students = await this.courseService.getCourseStudents(req.params.courseId, req.user, req.query.sectionId);
    res.json(students);
  }

  async getMaterialStats(req, res) {
    const stats = await this.courseService.getMaterialStats(req.params.courseId);
    res.json(stats);
  }
}
