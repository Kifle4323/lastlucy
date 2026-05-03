import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { LiveSessionRepository } from '../repositories/LiveSessionRepository.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import jwt from 'jsonwebtoken';

export class LiveSessionService extends BaseService {
  constructor() {
    super(new LiveSessionRepository());
  }

  async createSession(user, courseId, body) {
    const schema = z.object({
      classId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.string(),
      duration: z.number().int().min(1).optional(),
    });
    const data = schema.parse(body);

    // Verify teacher teaches this course in this class
    const courseSection = await this.repository.prisma.courseSection.findFirst({
      where: { courseId, classId: data.classId, teacherId: user.id },
    });
    const courseClass = await this.repository.prisma.courseClass.findFirst({
      where: { courseId, classId: data.classId, teacherId: user.id },
    });
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'You are not assigned to this course in this class');

    // Generate Jitsi meeting room name
    const JITSI_DOMAIN = process.env.JITSI_APP_ID ? `${process.env.JITSI_APP_ID}.8x8.vc` : 'meet.jit.si';
    const roomName = `edulms-${body.title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)}-${Math.random().toString(36).substring(2, 8)}`;
    const meetingUrl = `https://${JITSI_DOMAIN}/${roomName}`;

    const session = await this.repository.create({
      data: {
        courseId,
        classId: data.classId,
        title: data.title,
        description: data.description || null,
        scheduledAt: new Date(data.scheduledAt),
        duration: data.duration || 60,
        teacherId: user.id,
        meetingUrl,
        status: 'SCHEDULED',
      },
    });

    await AuditLogger.log({ action: 'CREATE', category: 'COURSE', userId: user.id, targetId: session.id, description: `Live session created: ${session.title}` });
    return session;
  }

  async getSessions(courseId, classId) {
    if (classId) return this.repository.findByCourseAndClass(courseId, classId);
    return this.repository.findByCourse(courseId);
  }

  async getClassSessions(classId, user) {
    const where = { classId };
    if (user.role === 'TEACHER') where.teacherId = user.id;
    if (user.role === 'STUDENT') {
      const enrollments = await this.repository.prisma.studentEnrollment.findMany({
        where: { studentId: user.id, status: 'ENROLLED' },
        select: { courseSection: { select: { courseId: true } } },
      });
      const courseIds = [...new Set(enrollments.map(e => e.courseSection?.courseId).filter(Boolean))];
      if (courseIds.length > 0) where.courseId = { in: courseIds };
    }
    return this.repository.prisma.liveSession.findMany({
      where,
      include: { teacher: { select: { id: true, fullName: true } }, course: true, class: true },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getUpcomingSessions(user) {
    const where = { status: { in: ['SCHEDULED', 'LIVE'] } };
    if (user.role === 'TEACHER') {
      where.teacherId = user.id;
    } else if (user.role === 'STUDENT') {
      const classStudents = await this.repository.prisma.classStudent.findMany({
        where: { studentId: user.id },
        select: { classId: true },
      });
      const classIds = classStudents.map(cs => cs.classId);
      where.classId = { in: classIds };
    }
    return this.repository.prisma.liveSession.findMany({
      where,
      include: { teacher: { select: { id: true, fullName: true, email: true } }, course: true, class: true },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });
  }

  async getAttendance(sessionId, user) {
    const session = await this.repository.findById(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');

    // Only teacher who created it, or admin can view attendance
    if (user.role !== 'ADMIN' && session.teacherId !== user.id) {
      // Students can only see their own attendance
      if (user.role === 'STUDENT') {
        const att = await this.repository.prisma.liveSessionAttendance.findUnique({
          where: { sessionId_studentId: { sessionId, studentId: user.id } },
        });
        return { attendance: att ? [att] : [], totalStudents: 1, attended: att?.status === 'ATTENDED' ? 1 : 0, partial: att?.status === 'PARTIAL' ? 1 : 0, absent: att?.status === 'ABSENT' ? 1 : 0 };
      }
      throw AppError.forbidden('forbidden', 'Not authorized');
    }

    const attendance = await this.repository.prisma.liveSessionAttendance.findMany({
      where: { sessionId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const classStudents = await this.repository.prisma.classStudent.findMany({
      where: { classId: session.classId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });

    return {
      attendance,
      classStudents: classStudents.map(cs => cs.student),
      totalStudents: classStudents.length,
      attended: attendance.filter(a => a.status === 'ATTENDED').length,
      partial: attendance.filter(a => a.status === 'PARTIAL').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      joined: attendance.filter(a => a.status === 'JOINED').length,
    };
  }

  async getSession(sessionId) {
    const session = await this.repository.findWithAccess(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');
    return session;
  }

  async updateSession(sessionId, user, body) {
    const session = await this.repository.findWithAccess(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');
    this.throwUnless(session.teacherId === user.id || user.role === 'ADMIN', 403, 'forbidden', 'Not authorized');

    const data = { ...body };
    if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);

    return this.repository.update(sessionId, data);
  }

  async deleteSession(sessionId, user) {
    const session = await this.repository.findWithAccess(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');
    this.throwUnless(session.teacherId === user.id || user.role === 'ADMIN', 403, 'forbidden', 'Not authorized');

    await this.repository.delete(sessionId);
  }

  async generateJaaSToken(sessionId, user) {
    const session = await this.repository.findWithAccess(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');

    const JITSI_APP_ID = process.env.JITSI_APP_ID || '';
    const JITSI_KID = process.env.JITSI_KID || '';
    const JITSI_DOMAIN = JITSI_APP_ID ? `${JITSI_APP_ID}.8x8.vc` : 'meet.jit.si';
    const roomName = session.meetingUrl?.split('/').pop() || 'edulms-default';

    const appId = process.env.JAAS_APP_ID || JITSI_APP_ID;
    const apiKey = process.env.JAAS_API_KEY;
    if (!appId || !apiKey) {
      // Return empty token for public Jitsi
      return { token: '', roomName, appId, domain: JITSI_DOMAIN };
    }

    const payload = {
      iss: apiKey,
      aud: 'jitsi',
      sub: appId,
      room: roomName,
      exp: Math.floor(Date.now() / 1000) + 3600,
      context: {
        user: { name: user.fullName, email: user.email, id: user.id },
        features: { 'livestreaming': true, 'recording': true, 'transcription': true },
      },
    };

    const token = jwt.sign(payload, process.env.JAAS_PRIVATE_KEY || apiKey, { algorithm: 'RS256' });
    return { token, roomName, appId, domain: JITSI_DOMAIN };
  }

  async recordAttendance(sessionId, user, body) {
    const schema = z.object({ action: z.enum(['join', 'leave']) });
    const data = schema.parse(body);

    const session = await this.repository.findById(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');

    if (data.action === 'join') {
      await this.repository.prisma.liveSessionAttendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: user.id } },
        create: { session: { connect: { id: sessionId } }, student: { connect: { id: user.id } }, joinedAt: new Date(), status: 'JOINED' },
        update: { joinedAt: new Date(), status: 'JOINED' },
      });
    } else {
      const record = await this.repository.prisma.liveSessionAttendance.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: user.id } },
      });
      if (record) {
        const durationMin = (Date.now() - new Date(record.joinedAt).getTime()) / 60000;
        const status = durationMin >= (session.duration || 60) * 0.75 ? 'ATTENDED' : 'PARTIAL';
        await this.repository.prisma.liveSessionAttendance.update({
          where: { sessionId_studentId: { sessionId, studentId: user.id } },
          data: { leftAt: new Date(), duration: Math.round(durationMin), status },
        });
      }
    }

    return { success: true };
  }

  async endSession(sessionId, user) {
    const session = await this.repository.findById(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');
    this.throwUnless(session.teacherId === user.id || user.role === 'ADMIN', 403, 'forbidden', 'Not authorized');

    const updated = await this.repository.update(sessionId, { status: 'ENDED' });

    // Update all attendance records that don't have leftAt
    await this.repository.prisma.liveSessionAttendance.updateMany({
      where: { sessionId, leftAt: null },
      data: { leftAt: new Date() },
    });

    return updated;
  }

  async reportFaceAlert(sessionId, user) {
    const session = await this.repository.findById(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Session not found');
    this.throwUnless(user.role === 'STUDENT', 403, 'forbidden', 'Only students can report face alerts');

    // Increment faceAlerts on the attendance record
    const record = await this.repository.prisma.liveSessionAttendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: user.id } },
    });

    if (record) {
      const newAlertCount = (record.faceAlerts || 0) + 1;
      await this.repository.prisma.liveSessionAttendance.update({
        where: { sessionId_studentId: { sessionId, studentId: user.id } },
        data: { faceAlerts: newAlertCount },
      });

      // Notify teacher on first alert and every 3rd alert after that
      if (newAlertCount === 1 || newAlertCount % 3 === 0) {
        const studentName = user.fullName || user.email;
        const notifRepo = new NotificationRepository();
        await notifRepo.createNotification({
          userId: session.teacherId,
          type: 'FACE_ALERT',
          title: 'Face Not Detected',
          message: `Student ${studentName} was not detected on camera in "${session.title}". (${newAlertCount} alert${newAlertCount > 1 ? 's' : ''})`,
          data: { sessionId, studentId: user.id, alertCount: newAlertCount },
        });
      }

      return { success: true, alertCount: newAlertCount };
    }

    return { success: false, message: 'No attendance record found' };
  }
}
