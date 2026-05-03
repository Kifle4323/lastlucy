import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const NOTIFICATION_WINDOW_HOURS = 24; // Notify within 24 hours of event

export class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.notifiedKeys = new Set(); // Prevent duplicate notifications
  }

  start() {
    // Run immediately on start
    this.runChecks().catch(err => console.error('Scheduler initial check error:', err));
    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runChecks().catch(err => console.error('Scheduler periodic check error:', err));
    }, CHECK_INTERVAL_MS);
    console.log(`Scheduler started (checking every ${CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async runChecks() {
    await Promise.all([
      this.checkSemesterRegistration(),
      this.checkSemesterStart(),
      this.checkExamScheduleActivation(),
      this.checkAssessmentScheduledOpen(),
      this.checkSemesterCalendarEvents(),
    ]);
  }

  getNotificationKey(type, targetId, dateStr) {
    return `${type}:${targetId}:${dateStr}`;
  }

  async sendNotification(userId, type, title, message, data = {}) {
    const key = this.getNotificationKey(type, data.targetId || '', data.dateKey || '');
    if (this.notifiedKeys.has(key)) return; // Already notified
    this.notifiedKeys.add(key);

    await prisma.notification.create({
      data: { userId, type, title, message, data },
    });
  }

  // 1. Notify admins when registration period is approaching or open
  async checkSemesterRegistration() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

    const semesters = await prisma.semester.findMany({
      where: {
        registrationStart: { not: null },
        status: { in: ['UPCOMING', 'REGISTRATION_OPEN'] },
      },
      include: { academicYear: true },
    });

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isApproved: true },
      select: { id: true },
    });

    for (const semester of semesters) {
      const regStart = new Date(semester.registrationStart);
      const regEnd = semester.registrationEnd ? new Date(semester.registrationEnd) : null;
      const dateKey = regStart.toISOString().slice(0, 10);

      // Registration is about to open (within 24h)
      if (regStart > now && regStart <= windowEnd) {
        for (const admin of admins) {
          await this.sendNotification(admin.id, 'REGISTRATION_OPENING_SOON',
            'Registration Opening Soon',
            `Registration for ${semester.name} opens on ${regStart.toLocaleDateString()}. Prepare to open it.`,
            { targetId: semester.id, dateKey, semesterId: semester.id },
          );
        }
      }

      // Registration period has started
      if (regStart <= now && semester.status === 'UPCOMING') {
        // Auto-update semester status to REGISTRATION_OPEN
        await prisma.semester.update({
          where: { id: semester.id },
          data: { status: 'REGISTRATION_OPEN' },
        });
        for (const admin of admins) {
          await this.sendNotification(admin.id, 'REGISTRATION_OPEN',
            'Registration Now Open',
            `Registration for ${semester.name} has opened. Students can now register.`,
            { targetId: semester.id, dateKey, semesterId: semester.id },
          );
        }
      }

      // Registration period has ended
      if (regEnd && regEnd < now && (semester.status === 'REGISTRATION_OPEN' || semester.status === 'UPCOMING')) {
        await prisma.semester.update({
          where: { id: semester.id },
          data: { status: 'IN_PROGRESS' },
        });
        for (const admin of admins) {
          await this.sendNotification(admin.id, 'REGISTRATION_CLOSED',
            'Registration Closed',
            `Registration for ${semester.name} has closed.`,
            { targetId: semester.id, dateKey: regEnd.toISOString().slice(0, 10), semesterId: semester.id },
          );
        }
      }
    }
  }

  // 2. Notify admins when semester is about to start
  async checkSemesterStart() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

    const semesters = await prisma.semester.findMany({
      where: { status: { in: ['UPCOMING', 'REGISTRATION_OPEN'] } },
      include: { academicYear: true },
    });

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isApproved: true },
      select: { id: true },
    });

    for (const semester of semesters) {
      const startDate = new Date(semester.startDate);
      const dateKey = startDate.toISOString().slice(0, 10);

      // Semester starting within 24h
      if (startDate > now && startDate <= windowEnd) {
        for (const admin of admins) {
          await this.sendNotification(admin.id, 'SEMESTER_STARTING_SOON',
            'Semester Starting Soon',
            `${semester.name} starts on ${startDate.toLocaleDateString()}. Make sure all sections and enrollments are ready.`,
            { targetId: semester.id, dateKey, semesterId: semester.id },
          );
        }
      }

      // Semester has started
      if (startDate <= now && semester.status !== 'IN_PROGRESS') {
        await prisma.semester.update({
          where: { id: semester.id },
          data: { status: 'IN_PROGRESS', isCurrent: true },
        });
        for (const admin of admins) {
          await this.sendNotification(admin.id, 'SEMESTER_STARTED',
            'Semester Has Started',
            `${semester.name} has officially started. Classes should now be in session.`,
            { targetId: semester.id, dateKey, semesterId: semester.id },
          );
        }
      }
    }
  }

  // 3. Notify teachers when it's time to activate midterm/final assessments based on exam schedule
  async checkExamScheduleActivation() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

    const examSchedules = await prisma.examSchedule.findMany({
      where: {
        OR: [
          { officialDate: { not: null } },
          { confirmedDate: { not: null } },
        ],
      },
      include: {
        courseSection: {
          include: {
            course: { select: { id: true, title: true, code: true } },
            teacher: { select: { id: true, fullName: true } },
            enrollments: { where: { status: 'ENROLLED' }, select: { studentId: true } },
          },
        },
      },
    });

    for (const schedule of examSchedules) {
      const examDate = schedule.confirmedDate
        ? new Date(schedule.confirmedDate)
        : schedule.officialDate
          ? new Date(schedule.officialDate)
          : null;

      if (!examDate) continue;

      const teacher = schedule.courseSection.teacher;
      if (!teacher) continue;

      const dateKey = examDate.toISOString().slice(0, 10);
      const examTypeLabel = schedule.examType === 'MIDTERM' ? 'Midterm' : 'Final';
      const courseTitle = schedule.courseSection.course.title;

      // Check if there's already an assessment for this exam
      const existingAssessment = await prisma.assessment.findFirst({
        where: {
          courseId: schedule.courseSection.courseId,
          examType: schedule.examType,
        },
      });

      // Exam is within 24h - notify teacher to activate
      if (examDate > now && examDate <= windowEnd) {
        await this.sendNotification(teacher.id, 'EXAM_ACTIVATION_DUE',
          `${examTypeLabel} Exam Approaching`,
          `The ${examTypeLabel} exam for ${courseTitle} is scheduled for ${examDate.toLocaleDateString()}. ${existingAssessment ? 'You can now activate the assessment for students.' : 'Please create and activate the assessment.'}`,
          { targetId: schedule.id, dateKey, courseSectionId: schedule.courseSectionId, examType: schedule.examType },
        );
      }

      // Exam date has arrived - notify teacher
      if (examDate <= now) {
        // If early exam was approved (ALL_AGREED or APPROVED), teacher can activate even before official date
        const canActivateEarly = schedule.earlyExamStatus === 'ALL_AGREED' || schedule.earlyExamStatus === 'APPROVED';

        await this.sendNotification(teacher.id, 'EXAM_READY_TO_ACTIVATE',
          `${examTypeLabel} Exam Ready to Activate`,
          `It's time to activate the ${examTypeLabel} exam for ${courseTitle}.${canActivateEarly ? ' Students have agreed to take the exam early.' : ''} ${existingAssessment ? 'Activate the assessment now.' : 'Create and activate the assessment.'}`,
          { targetId: schedule.id, dateKey, courseSectionId: schedule.courseSectionId, examType: schedule.examType, canActivateEarly },
        );
      }
    }
  }

  // 4. Notify teachers when scheduled assessment start time is approaching
  async checkAssessmentScheduledOpen() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

    const assessments = await prisma.assessment.findMany({
      where: {
        scheduledStart: { not: null },
        isOpen: false,
      },
      include: {
        course: {
          include: {
            courseSections: { select: { teacherId: true } },
            courseClasses: { select: { teacherId: true } },
          },
        },
      },
    });

    for (const assessment of assessments) {
      const scheduledStart = new Date(assessment.scheduledStart);
      const dateKey = scheduledStart.toISOString().slice(0, 10);

      // Collect unique teacher IDs
      const teacherIds = new Set();
      assessment.course.courseSections.forEach(s => { if (s.teacherId) teacherIds.add(s.teacherId); });
      assessment.course.courseClasses?.forEach(c => { if (c.teacherId) teacherIds.add(c.teacherId); });

      // Scheduled start is within 24h
      if (scheduledStart > now && scheduledStart <= windowEnd) {
        for (const teacherId of teacherIds) {
          await this.sendNotification(teacherId, 'ASSESSMENT_OPENING_SOON',
            'Assessment Opening Soon',
            `"${assessment.title}" is scheduled to open at ${scheduledStart.toLocaleString()}. Remember to activate it when ready.`,
            { targetId: assessment.id, dateKey, assessmentId: assessment.id },
          );
        }
      }

      // Scheduled start time has passed - auto-open if points match
      if (scheduledStart <= now) {
        const questions = await prisma.question.findMany({
          where: { assessmentId: assessment.id },
          select: { points: true },
        });
        const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

        if (totalPoints === assessment.maxScore) {
          // Auto-open the assessment
          await prisma.assessment.update({
            where: { id: assessment.id },
            data: { isOpen: true },
          });
          for (const teacherId of teacherIds) {
            await this.sendNotification(teacherId, 'ASSESSMENT_AUTO_OPENED',
              'Assessment Auto-Opened',
              `"${assessment.title}" has been automatically opened as scheduled. Total points (${totalPoints}) match max score (${assessment.maxScore}).`,
              { targetId: assessment.id, dateKey, assessmentId: assessment.id },
            );
          }
          // Notify enrolled students
          const enrollments = await prisma.studentEnrollment.findMany({
            where: { courseSection: { courseId: assessment.courseId }, status: 'ENROLLED' },
            select: { studentId: true },
          });
          if (enrollments.length > 0) {
            const examLabel = assessment.examType === 'MIDTERM' ? 'Midterm' : assessment.examType === 'FINAL' ? 'Final' : assessment.examType === 'QUIZ' ? 'Quiz' : assessment.examType === 'ASSIGNMENT' ? 'Assignment' : 'Assessment';
            await prisma.notification.createMany({
              data: enrollments.map(e => ({
                userId: e.studentId,
                type: 'ASSESSMENT_OPENED',
                title: `${examLabel} Now Available`,
                message: `"${assessment.title}" is now open. You can start your ${examLabel.toLowerCase()} now.`,
                data: { assessmentId: assessment.id, courseId: assessment.courseId },
              })),
            });
          }
        } else {
          // Points mismatch - notify teacher to fix
          for (const teacherId of teacherIds) {
            await this.sendNotification(teacherId, 'ASSESSMENT_OPEN_BLOCKED',
              'Assessment Cannot Auto-Open',
              `"${assessment.title}" was scheduled to open but total question points (${totalPoints}) don't match max score (${assessment.maxScore}). Fix the questions to activate.`,
              { targetId: assessment.id, dateKey, assessmentId: assessment.id },
            );
          }
        }
      }
    }
  }

  // 5. Notify admins when semester calendar events (midterm, final, grading deadline) are approaching
  async checkSemesterCalendarEvents() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

    const semesters = await prisma.semester.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { academicYear: true },
    });

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isApproved: true },
      select: { id: true },
    });

    const events = [
      { field: 'midtermExamDate', label: 'Midterm Exam', type: 'MIDTERM_EXAM_APPROACHING', passedType: 'MIDTERM_EXAM_STARTED' },
      { field: 'finalExamDate', label: 'Final Exam', type: 'FINAL_EXAM_APPROACHING', passedType: 'FINAL_EXAM_STARTED' },
      { field: 'gradingDeadline', label: 'Grading Deadline', type: 'GRADING_DEADLINE_APPROACHING', passedType: 'GRADING_DEADLINE_PASSED' },
    ];

    for (const semester of semesters) {
      for (const event of events) {
        const eventDate = semester[event.field] ? new Date(semester[event.field]) : null;
        if (!eventDate) continue;

        const dateKey = eventDate.toISOString().slice(0, 10);

        // Event approaching within 24h
        if (eventDate > now && eventDate <= windowEnd) {
          for (const admin of admins) {
            await this.sendNotification(admin.id, event.type,
              `${event.label} Approaching`,
              `${event.label} for ${semester.name} is scheduled on ${eventDate.toLocaleDateString()}. Make sure teachers are prepared.`,
              { targetId: semester.id, dateKey, semesterId: semester.id, eventType: event.field },
            );
          }
        }

        // Event date has passed
        if (eventDate <= now) {
          for (const admin of admins) {
            await this.sendNotification(admin.id, event.passedType,
              `${event.label} Date Reached`,
              `${event.label} for ${semester.name} (${eventDate.toLocaleDateString()}) has been reached.${event.field === 'gradingDeadline' ? ' Ensure all grades are submitted.' : ''}`,
              { targetId: semester.id, dateKey, semesterId: semester.id, eventType: event.field },
            );
          }

          // Auto-transition semester to GRADING when grading deadline passes
          if (event.field === 'gradingDeadline' && semester.status === 'IN_PROGRESS') {
            await prisma.semester.update({
              where: { id: semester.id },
              data: { status: 'GRADING' },
            });
            for (const admin of admins) {
              await this.sendNotification(admin.id, 'SEMESTER_GRADING_PHASE',
                'Semester Entered Grading Phase',
                `${semester.name} has automatically entered the grading phase as the grading deadline has passed.`,
                { targetId: semester.id, dateKey, semesterId: semester.id },
              );
            }
          }
        }
      }
    }
  }
}
