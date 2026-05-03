import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { DepartmentRepository } from '../repositories/DepartmentRepository.js';

export class DepartmentService extends BaseService {
  constructor() {
    super(new DepartmentRepository());
  }

  async createDepartment(body) {
    const schema = z.object({
      name: z.string().min(2),
      code: z.string().min(1).max(10),
      description: z.string().optional().nullable(),
      pricePerCreditHour: z.number().positive(),
      totalCreditHours: z.number().int().positive(),
      minCreditHoursToGraduate: z.number().int().positive(),
      minGradeToGraduate: z.number().min(0).max(4).optional(),
      durationYears: z.number().int().min(1).max(8).optional(),
    });
    const data = schema.parse(body);

    try {
      return await this.repository.create({
        data: {
          ...data,
          code: data.code.toUpperCase(),
          minGradeToGraduate: data.minGradeToGraduate || 2.0,
          durationYears: data.durationYears || 4,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') throw AppError.badRequest('duplicate', 'Department with this name or code already exists');
      throw err;
    }
  }

  async getDepartments() {
    return this.repository.findAllWithCounts();
  }

  async getDepartment(id) {
    const dept = await this.repository.findWithClasses(id);
    this.throwUnless(dept, 404, 'not_found', 'Department not found');
    return dept;
  }

  async updateDepartment(id, body) {
    const schema = z.object({
      name: z.string().min(2).optional(),
      code: z.string().min(1).max(10).optional(),
      description: z.string().nullable().optional(),
      pricePerCreditHour: z.number().positive().optional(),
      totalCreditHours: z.number().int().positive().optional(),
      minCreditHoursToGraduate: z.number().int().positive().optional(),
      minGradeToGraduate: z.number().min(0).max(4).optional(),
      durationYears: z.number().int().min(1).max(8).optional(),
    });
    const data = schema.parse(body);

    try {
      return await this.repository.update(id, { ...data, code: data.code?.toUpperCase() });
    } catch (err) {
      if (err.code === 'P2002') throw AppError.badRequest('duplicate', 'Department with this name or code already exists');
      throw err;
    }
  }

  async deleteDepartment(id) {
    await this.repository.delete(id);
  }

  async getRegistrationFee(studentId) {
    const classStudent = await this.repository.prisma.classStudent.findFirst({
      where: { studentId },
      include: { class: { include: { department: true } } },
    });
    if (!classStudent?.class?.department) return { fee: 0, hasDepartment: false, department: null, semesterCreditHours: 0, pricePerCreditHour: 0 };
    const dept = classStudent.class.department;

    // Find the best semester for this student's class
    const classIds = [classStudent.classId];
    const findSemesterWithSections = async (whereClause) => {
      const semesters = await this.repository.prisma.semester.findMany({ where: whereClause });
      for (const sem of semesters) {
        const count = await this.repository.prisma.courseSection.count({
          where: { semesterId: sem.id, classId: { in: classIds } },
        });
        if (count > 0) return sem;
      }
      return null;
    };

    let semester = await findSemesterWithSections({ status: 'REGISTRATION_OPEN' });
    if (!semester) semester = await findSemesterWithSections({ isCurrent: true });
    if (!semester) semester = await this.repository.prisma.semester.findFirst({ where: { isCurrent: true } });

    // Calculate total credit hours from course sections for this class in the semester
    let semesterCreditHours = 0;
    if (semester) {
      const sections = await this.repository.prisma.courseSection.findMany({
        where: { semesterId: semester.id, classId: { in: classIds } },
        include: { course: true },
      });
      semesterCreditHours = sections.reduce((sum, s) => sum + (s.course?.creditHours || 0), 0);
    }

    const fee = dept.pricePerCreditHour * (semesterCreditHours || dept.totalCreditHours || 3);
    return { fee, hasDepartment: true, department: { name: dept.name, code: dept.code }, semesterCreditHours, pricePerCreditHour: dept.pricePerCreditHour };
  }

  async getGraduationStatus(studentId) {
    const classStudent = await this.repository.prisma.classStudent.findFirst({
      where: { studentId },
      include: { class: { include: { department: true } } },
    });
    if (!classStudent?.class?.department) return { eligible: false, reason: 'No department assigned' };
    const dept = classStudent.class.department;

    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED' },
      include: { courseSection: { include: { course: true } }, grade: true },
    });

    const totalCredits = enrollments.reduce((sum, e) => sum + (e.courseSection?.course?.creditHours || 0), 0);
    const publishedGrades = enrollments.filter(e => e.grade?.isPublished);
    const totalPoints = publishedGrades.reduce((sum, e) => sum + (e.grade?.gradePoint || 0) * (e.courseSection?.course?.creditHours || 0), 0);
    const cgpa = publishedGrades.length > 0 ? totalPoints / publishedGrades.reduce((s, e) => s + (e.courseSection?.course?.creditHours || 0), 0) : 0;

    const eligible = totalCredits >= dept.minCreditHoursToGraduate && cgpa >= dept.minGradeToGraduate;

    // Check if certificate already exists
    const certificate = await this.repository.prisma.certificate.findFirst({
      where: { studentId, departmentId: dept.id },
    });

    return {
      eligible,
      totalCreditHours: totalCredits,
      minCreditHoursRequired: dept.minCreditHoursToGraduate,
      creditHoursMet: totalCredits >= dept.minCreditHoursToGraduate,
      cgpa: Math.round(cgpa * 100) / 100,
      minGradeRequired: dept.minGradeToGraduate,
      gradeMet: cgpa >= dept.minGradeToGraduate,
      department: { name: dept.name, code: dept.code },
      certificate,
    };
  }

  async getCertificates(studentId) {
    return this.repository.prisma.certificate.findMany({
      where: { studentId },
      include: { department: { select: { name: true, code: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async generateCertificate(studentId) {
    const classStudent = await this.repository.prisma.classStudent.findFirst({
      where: { studentId },
      include: { class: { include: { department: true } } },
    });
    if (!classStudent?.class?.department) throw AppError.badRequest('no_department', 'Student has no department');

    // Check for existing certificate
    const existing = await this.repository.prisma.certificate.findFirst({
      where: { studentId, departmentId: classStudent.class.department.id },
    });
    if (existing) return existing;

    const cgpaData = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, grade: { isPublished: true } },
      include: { courseSection: { include: { course: true } }, grade: true },
    });
    let totalPoints = 0, totalCredits = 0;
    for (const e of cgpaData) {
      if (e.grade?.gradePoint !== null && e.grade?.gradePoint !== undefined) {
        totalPoints += e.grade.gradePoint * (e.courseSection?.course?.creditHours || 0);
        totalCredits += e.courseSection?.course?.creditHours || 0;
      }
    }
    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    const certNumber = `CERT-${Date.now()}-${studentId.slice(0, 6)}`;

    return this.repository.prisma.certificate.create({
      data: { student: { connect: { id: studentId } }, department: { connect: { id: classStudent.class.department.id } }, certificateNumber: certNumber, cgpa, totalCreditHours: totalCredits },
    });
  }

  async getAdminCertificates() {
    return this.repository.prisma.certificate.findMany({
      include: { student: { select: { id: true, fullName: true, email: true } }, department: { select: { name: true, code: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getCertificateById(id) {
    const cert = await this.repository.prisma.certificate.findUnique({
      where: { id },
      include: { student: { select: { id: true, fullName: true, email: true } }, department: true },
    });
    this.throwUnless(cert, 404, 'not_found', 'Certificate not found');
    return cert;
  }
}
