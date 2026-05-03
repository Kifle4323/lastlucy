import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { AddDropRepository } from '../repositories/AddDropRepository.js';

export class AddDropService extends BaseService {
  constructor() {
    super(new AddDropRepository());
  }

  async getEligibility(user) {
    const currentSemester = await this.repository.findActiveSemester();
    if (!currentSemester) return { canAddDrop: false, message: 'No active add/drop period found' };

    const currentEnrollments = await this.repository.findCurrentEnrollments(user.id, currentSemester.id);
    const failedEnrollments = await this.repository.findFailedEnrollments(user.id);
    const failedCourseIds = failedEnrollments.map(e => e.courseSection.courseId);
    const availableSectionsForAdd = failedCourseIds.length > 0
      ? await this.repository.findAvailableSections(currentSemester.id, failedCourseIds)
      : [];
    const enrolledCourseIds = currentEnrollments.map(e => e.courseSection?.courseId).filter(Boolean);
    const addableCourses = availableSectionsForAdd.filter(s => !enrolledCourseIds.includes(s.courseId));
    const existingRequests = await this.repository.findExistingRequests(user.id, currentSemester.id);

    return { canAddDrop: true, semester: currentSemester, currentEnrollments, addableCourses, existingRequests };
  }

  async createRequest(user, body) {
    const schema = z.object({
      type: z.enum(['ADD', 'DROP']),
      courseSectionId: z.string(),
      reason: z.string().min(10),
    });
    const data = schema.parse(body);

    const currentSemester = await this.repository.findActiveSemester();
    this.throwUnless(currentSemester, 400, 'no_add_drop', 'No active add/drop period');

    // Get courseId from the courseSection
    const section = await this.repository.prisma.courseSection.findUnique({ where: { id: data.courseSectionId } });
    this.throwUnless(section, 404, 'not_found', 'Course section not found');

    const request = await this.repository.createRequest({
      data: { student: { connect: { id: user.id } }, semester: { connect: { id: currentSemester.id } }, type: data.type, courseSection: { connect: { id: data.courseSectionId } }, course: { connect: { id: section.courseId } }, reason: data.reason, status: 'PENDING' },
    });

    await AuditLogger.log({ action: 'ADD_DROP_REQUEST', category: 'ADD_DROP', userId: user.id, targetId: request.id, description: `Add/drop request created` });
    return request;
  }

  async createAddRequest(user, body) {
    const schema = z.object({
      courseSectionId: z.string(),
      reason: z.string().min(1),
    });
    const data = schema.parse(body);

    const currentSemester = await this.repository.findActiveSemester();
    this.throwUnless(currentSemester, 400, 'no_add_drop', 'No active add/drop period');

    // Get courseId from the courseSection
    const section = await this.repository.prisma.courseSection.findUnique({ where: { id: data.courseSectionId } });
    this.throwUnless(section, 404, 'not_found', 'Course section not found');

    const request = await this.repository.createRequest({
      data: { student: { connect: { id: user.id } }, semester: { connect: { id: currentSemester.id } }, type: 'ADD', courseSection: { connect: { id: data.courseSectionId } }, course: { connect: { id: section.courseId } }, reason: data.reason, status: 'PENDING' },
    });

    await AuditLogger.log({ action: 'ADD_DROP_REQUEST', category: 'ADD_DROP', userId: user.id, targetId: request.id, description: `Add request created` });
    return request;
  }

  async createDropRequest(user, body) {
    const schema = z.object({
      enrollmentId: z.string(),
      reason: z.string().min(1),
    });
    const data = schema.parse(body);

    const currentSemester = await this.repository.findActiveSemester();
    this.throwUnless(currentSemester, 400, 'no_add_drop', 'No active add/drop period');

    // Get the enrollment to find the courseSectionId and courseId
    const enrollment = await this.repository.prisma.studentEnrollment.findUnique({
      where: { id: data.enrollmentId },
      include: { courseSection: { select: { courseId: true } } },
    });
    this.throwUnless(enrollment, 404, 'not_found', 'Enrollment not found');

    const request = await this.repository.createRequest({
      data: { student: { connect: { id: user.id } }, semester: { connect: { id: currentSemester.id } }, type: 'DROP', courseSection: { connect: { id: enrollment.courseSectionId } }, course: { connect: { id: enrollment.courseSection.courseId } }, dropEnrollment: { connect: { id: data.enrollmentId } }, reason: data.reason, status: 'PENDING' },
    });

    await AuditLogger.log({ action: 'ADD_DROP_REQUEST', category: 'ADD_DROP', userId: user.id, targetId: request.id, description: `Drop request created` });
    return request;
  }

  async cancelRequest(user, requestId) {
    const request = await this.repository.findById(requestId);
    this.throwUnless(request, 404, 'not_found', 'Request not found');
    this.throwUnless(request.studentId === user.id, 403, 'forbidden', 'Not your request');
    this.throwUnless(request.status === 'PENDING', 400, 'already_processed', 'Request already processed');

    await this.repository.delete(requestId);
    return { success: true };
  }

  async getRequests(query) {
    const where = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.semesterId) where.semesterId = query.semesterId;

    return this.repository.model.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        courseSection: { include: { course: { select: { id: true, title: true, code: true } }, class: { select: { id: true, name: true } } } },
        course: { select: { id: true, title: true, code: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingRequests() {
    return this.repository.findPendingRequests();
  }

  async approveRequest(adminUser, requestId) {
    const request = await this.repository.findById(requestId);
    this.throwUnless(request, 404, 'not_found', 'Request not found');
    this.throwUnless(request.status === 'PENDING', 400, 'already_processed', 'Request already processed');

    if (request.type === 'ADD') {
      this.throwUnless(request.courseSectionId, 400, 'invalid_request', 'ADD request missing courseSectionId');
      await this.repository.prisma.studentEnrollment.create({
        data: { courseSection: { connect: { id: request.courseSectionId } }, student: { connect: { id: request.studentId } }, status: 'ENROLLED' },
      });
    } else {
      // For DROP, use dropEnrollmentId if available, otherwise fall back to courseSectionId
      if (request.dropEnrollmentId) {
        await this.repository.prisma.studentEnrollment.update({
          where: { id: request.dropEnrollmentId },
          data: { status: 'DROPPED' },
        });
      } else {
        this.throwUnless(request.courseSectionId, 400, 'invalid_request', 'DROP request missing enrollment reference');
        await this.repository.prisma.studentEnrollment.updateMany({
          where: { courseSectionId: request.courseSectionId, studentId: request.studentId, status: 'ENROLLED' },
          data: { status: 'DROPPED' },
        });
      }
    }

    const updated = await this.repository.update(requestId, { status: 'APPROVED', adminReviewedBy: adminUser.id, reviewedAt: new Date() });
    await AuditLogger.log({ action: 'ADD_DROP_APPROVE', category: 'ADD_DROP', userId: adminUser.id, targetId: requestId, description: `Add/drop request approved` });
    return updated;
  }

  async rejectRequest(adminUser, requestId, reason) {
    const request = await this.repository.findById(requestId);
    this.throwUnless(request, 404, 'not_found', 'Request not found');

    const updated = await this.repository.update(requestId, { status: 'REJECTED', adminReviewedBy: adminUser.id, adminNotes: reason, reviewedAt: new Date() });
    await AuditLogger.log({ action: 'ADD_DROP_REJECT', category: 'ADD_DROP', userId: adminUser.id, targetId: requestId, description: `Add/drop request rejected` });
    return updated;
  }

  async getSemestersAddDrop() {
    return this.repository.prisma.semester.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { addDropRequests: true } } },
    });
  }

  async updateSemesterAddDrop(semesterId, body) {
    const schema = z.object({
      addDropStart: z.string().optional().nullable(),
      addDropEnd: z.string().optional().nullable(),
    });
    const data = schema.parse(body);

    const semester = await this.repository.prisma.semester.findUnique({ where: { id: semesterId } });
    this.throwUnless(semester, 404, 'not_found', 'Semester not found');

    return this.repository.prisma.semester.update({
      where: { id: semesterId },
      data: {
        addDropStart: data.addDropStart ? new Date(data.addDropStart) : null,
        addDropEnd: data.addDropEnd ? new Date(data.addDropEnd) : null,
      },
    });
  }
}
