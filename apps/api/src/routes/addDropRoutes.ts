// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';
import { createAuditLog } from '../auditLog';

export function registerAddDropRoutes(router: Router) {
  // Student: Get add/drop eligibility and available courses
  router.get('/add-drop/eligibility', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    
    try {
      // Find semester with active add/drop period
      const now = new Date();
      const allSemesters = await prisma.semester.findMany({
        where: {
          addDropStart: { not: null },
          addDropEnd: { not: null },
        },
      });
      const currentSemester = allSemesters.find(s => {
        return now >= new Date(s.addDropStart!) && now <= new Date(s.addDropEnd!);
      });
      
      if (!currentSemester) {
        res.json({ 
          canAddDrop: false, 
          message: 'No active add/drop period found' 
        });
        return;
      }
      
      // Check if add/drop period is active
      const addDropStart = currentSemester.addDropStart;
      const addDropEnd = currentSemester.addDropEnd;
      
      const isAddDropPeriod = addDropStart && addDropEnd && 
        now >= new Date(addDropStart) && now <= new Date(addDropEnd);
      
      // Get student's current enrollments for this semester
      const currentEnrollments = await prisma.studentEnrollment.findMany({
        where: { 
          studentId: user.id,
          status: 'ENROLLED',
          courseSection: { semesterId: currentSemester.id },
        },
        include: {
          courseSection: {
            include: {
              course: true,
              teacher: { select: { id: true, fullName: true } },
            },
          },
          grade: true,
        },
      });
      
      // Get courses student can ADD (courses they got F in previous semesters)
      const failedEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          studentId: user.id,
          status: 'ENROLLED',
          grade: { gradeLetter: 'F' },
        },
        include: {
          courseSection: {
            include: { course: true, semester: true },
          },
        },
      });
      
      // Get available sections for failed courses in current semester
      const failedCourseIds = failedEnrollments.map(e => e.courseSection.courseId);
      const availableSectionsForAdd = await prisma.courseSection.findMany({
        where: {
          semesterId: currentSemester.id,
          courseId: { in: failedCourseIds },
        },
        include: {
          course: true,
          teacher: { select: { id: true, fullName: true } },
          class: { select: { id: true, name: true, code: true } },
          _count: { select: { enrollments: true } },
        },
      });
      
      // Filter out courses already enrolled in
      const enrolledCourseIds = currentEnrollments.map(e => e.courseSection?.courseId).filter(Boolean);
      const addableCourses = availableSectionsForAdd.filter(
        s => !enrolledCourseIds.includes(s.courseId)
      );
      
      // Get existing add/drop requests for this semester
      const existingRequests = await prisma.addDropRequest.findMany({
        where: {
          studentId: user.id,
          semesterId: currentSemester.id,
        },
        include: {
          course: true,
          courseSection: { include: { teacher: { select: { fullName: true } } } },
        },
      });
      
      res.json({
        canAddDrop: isAddDropPeriod,
        semester: currentSemester,
        addDropStart,
        addDropEnd,
        currentEnrollments: currentEnrollments.filter(e => e.courseSection),
        addableCourses,
        existingRequests,
      });
    } catch (err) {
      console.error('Error fetching add/drop eligibility:', err);
      res.status(500).json({ error: 'Failed to fetch eligibility' });
    }
  });

  // Student: Submit add request
  router.post('/add-drop/add', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const body = z.object({
      courseSectionId: z.string(),
      reason: z.string().optional(),
    }).parse(req.body);
    
    try {
      // Find semester with active add/drop period
      const now = new Date();
      const allSemesters = await prisma.semester.findMany({
        where: {
          addDropStart: { not: null },
          addDropEnd: { not: null },
        },
      });
      const currentSemester = allSemesters.find(s => {
        return now >= new Date(s.addDropStart!) && now <= new Date(s.addDropEnd!);
      });
      
      if (!currentSemester) {
        res.status(400).json({ error: 'Add/drop period is not active' });
        return;
      }
      
      // Get course section
      const courseSection = await prisma.courseSection.findUnique({
        where: { id: body.courseSectionId },
        include: { course: true },
      });
      
      if (!courseSection) {
        res.status(404).json({ error: 'Course section not found' });
        return;
      }
      
      // Check if already enrolled in this section
      const existingEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: user.id,
          courseSectionId: body.courseSectionId,
        },
      });
      
      if (existingEnrollment) {
        res.status(400).json({ error: 'Already enrolled in this course' });
        return;
      }

      // Check if student already PASSED this course (allow retaking failed ones)
      const previousEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: user.id,
          courseSection: { courseId: courseSection.courseId },
          status: 'ENROLLED',
          grade: { isSubmitted: true },
        },
        include: { courseSection: { include: { course: { select: { title: true } }, semester: { select: { name: true } } } }, grade: true },
      });

      if (previousEnrollment && previousEnrollment.grade) {
        const passed = previousEnrollment.grade.gradeLetter !== 'F' && (previousEnrollment.grade.totalScore ?? 0) >= 40;
        if (passed) {
          res.status(400).json({
            error: `You already passed ${previousEnrollment.courseSection.course?.title || 'this course'} (${previousEnrollment.grade.gradeLetter}) in ${previousEnrollment.courseSection.semester?.name || 'a previous semester'}. Cannot retake a passed course.`,
          });
          return;
        }
      }
      
      // Check for existing pending request
      const existingRequest = await prisma.addDropRequest.findFirst({
        where: {
          studentId: user.id,
          semesterId: currentSemester.id,
          courseId: courseSection.courseId,
          type: 'ADD',
          status: 'PENDING',
        },
      });
      
      if (existingRequest) {
        res.status(400).json({ error: 'Already have a pending add request for this course' });
        return;
      }
      
      // Create add request
      const addRequest = await prisma.addDropRequest.create({
        data: {
          studentId: user.id,
          semesterId: currentSemester.id,
          type: 'ADD',
          courseSectionId: body.courseSectionId,
          courseId: courseSection.courseId,
          reason: body.reason,
        },
        include: {
          course: true,
          courseSection: { include: { teacher: { select: { fullName: true } } } },
        },
      });

      createAuditLog({ userId: user.id, userRole: 'STUDENT', action: 'ADD_DROP_REQUEST', category: 'ADD_DROP', targetId: addRequest.id, targetType: 'AddDropRequest', description: `Student requested to add ${addRequest.course?.title || 'course'}`, ipAddress: req.ip });
      res.json(addRequest);
    } catch (err) {
      console.error('Error creating add request:', err);
      res.status(500).json({ error: 'Failed to create add request' });
    }
  });

  // Student: Submit drop request
  router.post('/add-drop/drop', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const body = z.object({
      enrollmentId: z.string(),
      reason: z.string().optional(),
    }).parse(req.body);
    
    try {
      // Find semester with active add/drop period
      const now = new Date();
      const allSemesters = await prisma.semester.findMany({
        where: {
          addDropStart: { not: null },
          addDropEnd: { not: null },
        },
      });
      const currentSemester = allSemesters.find(s => {
        return now >= new Date(s.addDropStart!) && now <= new Date(s.addDropEnd!);
      });
      
      if (!currentSemester) {
        res.status(400).json({ error: 'Add/drop period is not active' });
        return;
      }
      
      // Get enrollment
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
          id: body.enrollmentId,
          studentId: user.id,
          status: 'ENROLLED',
        },
        include: {
          courseSection: {
            include: { course: true, semester: true },
          },
        },
      });
      
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found' });
        return;
      }
      
      // Check for existing pending drop request
      const existingRequest = await prisma.addDropRequest.findFirst({
        where: {
          studentId: user.id,
          semesterId: currentSemester.id,
          courseId: enrollment.courseSection.courseId,
          type: 'DROP',
          status: 'PENDING',
        },
      });
      
      if (existingRequest) {
        res.status(400).json({ error: 'Already have a pending drop request for this course' });
        return;
      }
      
      // Create drop request
      const dropRequest = await prisma.addDropRequest.create({
        data: {
          studentId: user.id,
          semesterId: currentSemester.id,
          type: 'DROP',
          dropEnrollmentId: body.enrollmentId,
          courseId: enrollment.courseSection.courseId,
          reason: body.reason,
        },
        include: {
          course: true,
          courseSection: { include: { teacher: { select: { fullName: true } } } },
        },
      });
      
      res.json(dropRequest);
    } catch (err) {
      console.error('Error creating drop request:', err);
      res.status(500).json({ error: 'Failed to create drop request' });
    }
  });

  // Student: Cancel add/drop request
  router.delete('/add-drop/:requestId', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ requestId: z.string() }).parse(req.params);
    const user = req.user!;
    
    try {
      const request = await prisma.addDropRequest.findFirst({
        where: {
          id: params.requestId,
          studentId: user.id,
          status: 'PENDING',
        },
      });
      
      if (!request) {
        res.status(404).json({ error: 'Request not found or already processed' });
        return;
      }
      
      await prisma.addDropRequest.delete({
        where: { id: params.requestId },
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error canceling request:', err);
      res.status(500).json({ error: 'Failed to cancel request' });
    }
  });

  // Admin: Get all add/drop requests
  router.get('/admin/add-drop-requests', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const query = z.object({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().or(z.literal('')),
      type: z.enum(['ADD', 'DROP']).optional().or(z.literal('')),
      semesterId: z.string().optional().or(z.literal('')),
    }).parse(req.query);
    
    // Build where clause, filtering out empty strings
    const where: any = {};
    if (query.status && query.status !== '') where.status = query.status;
    if (query.type && query.type !== '') where.type = query.type;
    if (query.semesterId && query.semesterId !== '') where.semesterId = query.semesterId;
    
    try {
      const requests = await prisma.addDropRequest.findMany({
        where,
        include: {
          student: { 
            select: { id: true, fullName: true, email: true } 
          },
          course: true,
          courseSection: { 
            include: { 
              teacher: { select: { fullName: true } },
              class: { select: { name: true, code: true } },
            } 
          },
          semester: { select: { name: true } },
          reviewedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      res.json(requests);
    } catch (err) {
      console.error('Error fetching add/drop requests:', err);
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  });

  // Admin: Approve add/drop request
  router.post('/admin/add-drop-requests/:requestId/approve', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ requestId: z.string() }).parse(req.params);
    const body = z.object({ adminNotes: z.string().optional() }).parse(req.body);
    const user = req.user!;
    
    try {
      const request = await prisma.addDropRequest.findUnique({
        where: { id: params.requestId },
        include: {
          courseSection: true,
          dropEnrollment: true,
        },
      });
      
      if (!request || request.status !== 'PENDING') {
        res.status(400).json({ error: 'Request not found or already processed' });
        return;
      }
      
      if (request.type === 'ADD') {
        // Create enrollment for add request
        if (!request.courseSectionId) {
          res.status(400).json({ error: 'No course section specified for add request' });
          return;
        }
        
        await prisma.$transaction([
          // Create enrollment
          prisma.studentEnrollment.create({
            data: {
              studentId: request.studentId,
              courseSectionId: request.courseSectionId,
              status: 'ENROLLED',
            },
          }),
          // Update request status
          prisma.addDropRequest.update({
            where: { id: params.requestId },
            data: {
              status: 'APPROVED',
              adminReviewedBy: user.id,
              reviewedAt: new Date(),
              adminNotes: body.adminNotes,
            },
          }),
        ]);
      } else if (request.type === 'DROP') {
        // Update enrollment status for drop request
        if (!request.dropEnrollmentId) {
          res.status(400).json({ error: 'No enrollment specified for drop request' });
          return;
        }
        
        await prisma.$transaction([
          // Update enrollment status
          prisma.studentEnrollment.update({
            where: { id: request.dropEnrollmentId },
            data: { status: 'DROPPED' },
          }),
          // Update request status
          prisma.addDropRequest.update({
            where: { id: params.requestId },
            data: {
              status: 'APPROVED',
              adminReviewedBy: user.id,
              reviewedAt: new Date(),
              adminNotes: body.adminNotes,
            },
          }),
        ]);
      }
      
      const updatedRequest = await prisma.addDropRequest.findUnique({
        where: { id: params.requestId },
        include: {
          student: { select: { fullName: true, email: true } },
          course: true,
          courseSection: { include: { teacher: { select: { fullName: true } } } },
        },
      });
      
      // Create notification for student
      await prisma.notification.create({
        data: {
          userId: request.studentId,
          type: 'ADD_DROP_APPROVED',
          title: `${request.type === 'ADD' ? 'Add' : 'Drop'} Request Approved`,
          message: `Your request to ${request.type.toLowerCase()} ${updatedRequest?.course?.title || 'the course'} has been approved.`,
          data: { requestId: params.requestId, type: request.type },
        },
      });
      
      createAuditLog({ userId: user.id, userRole: 'ADMIN', action: 'ADD_DROP_APPROVE', category: 'ADD_DROP', targetId: params.requestId, targetType: 'AddDropRequest', description: `Admin approved ${request.type.toLowerCase()} request for ${updatedRequest?.student?.fullName || 'student'} - ${updatedRequest?.course?.title || 'course'}`, ipAddress: req.ip });
      res.json(updatedRequest);
    } catch (err) {
      console.error('Error approving request:', err);
      res.status(500).json({ error: 'Failed to approve request' });
    }
  });

  // Admin: Reject add/drop request
  router.post('/admin/add-drop-requests/:requestId/reject', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ requestId: z.string() }).parse(req.params);
    const body = z.object({ adminNotes: z.string().optional() }).parse(req.body);
    const user = req.user!;
    
    try {
      const request = await prisma.addDropRequest.findUnique({
        where: { id: params.requestId },
      });
      
      if (!request || request.status !== 'PENDING') {
        res.status(400).json({ error: 'Request not found or already processed' });
        return;
      }
      
      const updatedRequest = await prisma.addDropRequest.update({
        where: { id: params.requestId },
        data: {
          status: 'REJECTED',
          adminReviewedBy: user.id,
          reviewedAt: new Date(),
          adminNotes: body.adminNotes,
        },
        include: {
          student: { select: { fullName: true, email: true } },
          course: true,
          courseSection: { include: { teacher: { select: { fullName: true } } } },
        },
      });
      
      // Create notification for student
      if (request) {
        await prisma.notification.create({
          data: {
            userId: request.studentId,
            type: 'ADD_DROP_REJECTED',
            title: `${request.type === 'ADD' ? 'Add' : 'Drop'} Request Rejected`,
            message: `Your request to ${request.type.toLowerCase()} ${updatedRequest?.course?.title || 'the course'} has been rejected.${body.adminNotes ? ` Reason: ${body.adminNotes}` : ''}`,
            data: { requestId: params.requestId, type: request.type },
          },
        });
      }
      
      res.json(updatedRequest);
    } catch (err) {
      console.error('Error rejecting request:', err);
      res.status(500).json({ error: 'Failed to reject request' });
    }
  });

  // Admin: Get semesters with add/drop settings
  router.get('/admin/semesters/add-drop', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    try {
      const semesters = await prisma.semester.findMany({
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          name: true,
          addDropStart: true,
          addDropEnd: true,
          isCurrent: true,
          _count: { select: { addDropRequests: true } },
        },
      });
      
      res.json(semesters);
    } catch (err) {
      console.error('Error fetching semesters:', err);
      res.status(500).json({ error: 'Failed to fetch semesters' });
    }
  });

  // Admin: Update add/drop period for semester
  router.patch('/admin/semesters/:semesterId/add-drop', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ semesterId: z.string() }).parse(req.params);
    const body = z.object({
      addDropStart: z.string().nullable().optional(),
      addDropEnd: z.string().nullable().optional(),
    }).parse(req.body);
    
    try {
      const semester = await prisma.semester.update({
        where: { id: params.semesterId },
        data: {
          addDropStart: body.addDropStart ? new Date(body.addDropStart) : null,
          addDropEnd: body.addDropEnd ? new Date(body.addDropEnd) : null,
        },
      });
      
      res.json(semester);
    } catch (err) {
      console.error('Error updating add/drop period:', err);
      res.status(500).json({ error: 'Failed to update add/drop period' });
    }
  });
}
