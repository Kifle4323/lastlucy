import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { TextSimilarity } from '../core/TextSimilarity.js';
import { AssessmentRepository } from '../repositories/AssessmentRepository.js';
import { QuestionRepository } from '../repositories/QuestionRepository.js';
import { AttemptRepository } from '../repositories/AttemptRepository.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';

export class AssessmentService extends BaseService {
  constructor() {
    super(new AssessmentRepository());
    this.questionRepo = new QuestionRepository();
    this.attemptRepo = new AttemptRepository();
    this.notificationRepo = new NotificationRepository();
  }

  async createAssessment(user, body) {
    const schema = z.object({
      courseId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      examType: z.enum(['QUIZ', 'ASSIGNMENT', 'MIDTERM', 'FINAL', 'CLASS_ACTIVITY', 'LAB', 'PROJECT', 'PRESENTATION']).optional(),
      deliveryMode: z.enum(['ONLINE', 'PAPER', 'MIXED']).optional(),
      maxScore: z.number().int().min(1).optional(),
      timeLimit: z.number().int().min(1).optional(),
      componentId: z.string().optional().nullable(),
      scheduledStart: z.string().optional(),
      scheduledEnd: z.string().optional(),
    });
    const data = schema.parse(body);

    // Verify teacher access to this course
    const courseSection = await this.repository.prisma.courseSection.findFirst({
      where: { courseId: data.courseId, teacherId: user.id },
    });
    const courseClass = await this.repository.prisma.courseClass.findFirst({
      where: { courseId: data.courseId, teacherId: user.id },
    });
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'You are not assigned to this course');

    // If componentId provided, derive maxScore from component weight
    let maxScore = data.maxScore ?? 100;
    if (data.componentId) {
      const component = await this.repository.prisma.gradeComponent.findUnique({ where: { id: data.componentId } });
      if (component) {
        maxScore = component.weight;
      }
    }

    const assessment = await this.repository.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description || null,
        examType: data.examType ?? 'QUIZ',
        deliveryMode: data.deliveryMode ?? 'ONLINE',
        maxScore,
        timeLimit: data.timeLimit,
        componentId: data.componentId || null,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
      },
    });

    // Notify enrolled students about new assessment
    const enrollmentWhere = { status: 'ENROLLED' };
    if (courseSection) {
      enrollmentWhere.courseSectionId = courseSection.id;
    } else if (courseClass) {
      enrollmentWhere.courseSection = { classId: courseClass.id };
    }
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: enrollmentWhere,
      select: { studentId: true },
    });
    for (const e of enrollments) {
      await this.notificationRepo.createNotification({
        userId: e.studentId,
        type: 'ASSESSMENT_CREATED',
        title: 'New Assessment',
        message: `A new assessment "${data.title}" has been created`,
        data: { assessmentId: assessment.id, courseId: data.courseId },
      });
    }

    return assessment;
  }

  async getAssessments(courseId) {
    const assessments = await this.repository.findByCourseWithSchedule(courseId);
    return assessments.map(a => {
      // Extract exam schedules and semester info from courseSections
      const courseSections = a.course?.courseSections || [];
      const examSchedules = courseSections.flatMap(cs => cs.examSchedules || []);
      const matchingSchedule = examSchedules.find(es => es.examType === a.examType);
      const semester = courseSections[0]?.semester || null;

      return {
        ...a,
        totalPoints: a.questions?.reduce((sum, q) => sum + q.points, 0) ?? 0,
        questionCount: a._count?.questions ?? 0,
        questions: undefined,
        course: undefined,
        examSchedule: matchingSchedule || null,
        semester: semester ? {
          midtermExamDate: semester.midtermExamDate,
          finalExamDate: semester.finalExamDate,
          midtermExamStart: semester.midtermExamStart,
          midtermExamEnd: semester.midtermExamEnd,
          finalExamStart: semester.finalExamStart,
          finalExamEnd: semester.finalExamEnd,
        } : null,
      };
    });
  }

  async getAssessment(assessmentId, user) {
    const assessment = await this.repository.findWithAccessCheck(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    // Check access
    if (user.role === 'TEACHER') {
      const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
        assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
      this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');
    } else if (user.role === 'STUDENT') {
      const isEnrolled = assessment.course.courseSections.some(s =>
        s.enrollments?.some(e => e.studentId === user.id)
      );
      this.throwUnless(isEnrolled, 403, 'forbidden', 'You are not enrolled in this course');
    }

    return assessment;
  }

  async updateAssessment(assessmentId, user, body) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    // Prevent updating maxScore directly if this assessment is linked to a grade component
    const updateData = { ...body };
    if (assessment.componentId) {
      delete updateData.maxScore;
    }

    return this.repository.update(assessmentId, updateData);
  }

  async deleteAssessment(assessmentId, user) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    await this.attemptRepo.deleteAssessmentCascade(assessmentId);
  }

  // Questions
  async createQuestion(assessmentId, user, body) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    const question = await this.questionRepo.create({
      data: { ...body, assessmentId },
    });
    return question;
  }

  async getQuestions(assessmentId) {
    return this.questionRepo.findByAssessment(assessmentId);
  }

  async getQuestion(questionId, user) {
    const question = await this.questionRepo.findWithCourse(questionId);
    this.throwUnless(question, 404, 'not_found', 'Question not found');

    if (user.role === 'TEACHER') {
      const isTeacher = question.assessment.course.courseSections.some(s => s.teacherId === user.id) ||
        question.assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
      this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');
    }

    return question;
  }

  async updateQuestion(questionId, user, body) {
    const question = await this.questionRepo.findWithCourse(questionId);
    this.throwUnless(question, 404, 'not_found', 'Question not found');

    const isTeacher = question.assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      question.assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    return this.questionRepo.update(questionId, body);
  }

  async deleteQuestion(questionId, user) {
    const question = await this.questionRepo.findWithCourse(questionId);
    this.throwUnless(question, 404, 'not_found', 'Question not found');

    const isTeacher = question.assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      question.assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    await this.questionRepo.deleteAnswersAndQuestion(questionId);
  }

  // Attempts
  async startAttempt(assessmentId, user) {
    const assessment = await this.repository.findWithEnrollments(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    // Check if assessment is open for students
    if (!assessment.isOpen) {
      throw AppError.forbidden('assessment_closed', 'This assessment is not yet open for students');
    }

    const isEnrolled = assessment.course.courseSections.some(s =>
      s.enrollments?.some(e => e.studentId === user.id)
    );
    this.throwUnless(isEnrolled, 403, 'not_enrolled', 'You are not enrolled in this course');

    const existing = await this.attemptRepo.findExisting(assessmentId, user.id);
    if (existing) {
      if (existing.status === 'IN_PROGRESS') {
        // Return the existing in-progress attempt with full data for resume
        const fullAttempt = await this.attemptRepo.findWithAnswersAndQuestions(existing.id);

        // Calculate exam end time from teacher's scheduled date + duration
        let examEndTime = null;
        const courseSections = assessment.course?.courseSections || [];
        const examSchedules = courseSections.flatMap(cs => cs.examSchedules || []);
        const matchingSchedule = examSchedules.find(es => es.examType === assessment.examType);

        if (matchingSchedule) {
          const examDate = matchingSchedule.confirmedDate
            ? new Date(matchingSchedule.confirmedDate)
            : matchingSchedule.officialDate
              ? new Date(matchingSchedule.officialDate)
              : null;
          if (examDate && matchingSchedule.duration) {
            examEndTime = new Date(examDate.getTime() + matchingSchedule.duration * 60 * 1000).toISOString();
          }
        }

        // Clear pausedAt since student is resuming
        if (fullAttempt.pausedAt) {
          await this.attemptRepo.update(existing.id, { pausedAt: null });
        }

        return { ...fullAttempt, pausedAt: null, examEndTime };
      }
      throw AppError.badRequest('already_submitted', 'You have already submitted this assessment');
    }

    const attempt = await this.attemptRepo.create({
      data: { assessment: { connect: { id: assessmentId } }, student: { connect: { id: user.id } }, status: 'IN_PROGRESS' },
    });

    // Calculate exam end time from teacher's scheduled date + duration
    let examEndTime = null;
    const courseSections = assessment.course?.courseSections || [];
    const examSchedules = courseSections.flatMap(cs => cs.examSchedules || []);
    const matchingSchedule = examSchedules.find(es => es.examType === assessment.examType);

    if (matchingSchedule) {
      const examDate = matchingSchedule.confirmedDate
        ? new Date(matchingSchedule.confirmedDate)
        : matchingSchedule.officialDate
          ? new Date(matchingSchedule.officialDate)
          : null;
      if (examDate && matchingSchedule.duration) {
        examEndTime = new Date(examDate.getTime() + matchingSchedule.duration * 60 * 1000).toISOString();
      }
    }

    return { ...attempt, examEndTime };
  }

  async submitAttempt(attemptId, user, body) {
    const attempt = await this.attemptRepo.findWithAnswersAndQuestions(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');
    this.throwUnless(attempt.studentId === user.id, 403, 'forbidden', 'Not your attempt');
    this.throwIf(attempt.status === 'GRADED' || attempt.status === 'SUBMITTED', 400, 'already_submitted', 'Already submitted');

    // Check face verification status
    let hasPendingFaceMismatch = false;
    let hasRejectedFace = false;
    if (attempt.faceVerification && !attempt.faceVerification.matchResult) {
      if (!attempt.faceVerification.adminReviewed) hasPendingFaceMismatch = true;
      if (attempt.faceVerification.adminReviewed && !attempt.faceVerification.adminApproved) hasRejectedFace = true;
    }
    this.throwIf(hasRejectedFace, 403, 'face_mismatch_rejected', 'Face verification was rejected');

    // Build question map
    const questionMap = new Map();
    for (const q of attempt.assessment.questions) {
      questionMap.set(q.id, { id: q.id, type: q.type, correct: q.correct, correctAnswer: q.correctAnswer, modelAnswer: q.modelAnswer, points: q.points });
    }

    let autoScore = 0;
    let hasManualGrading = false;

    for (const ans of attempt.answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      let score = 0;
      let isCorrect = false;

      if (q.type === 'MCQ') {
        isCorrect = ans.selected === q.correct;
        score = isCorrect ? q.points : 0;
        autoScore += score;
      } else if (q.type === 'FITB') {
        if (ans.textAnswer && q.correctAnswer) {
          const alternatives = String(q.correctAnswer).split('||').map(s => s.trim()).filter(Boolean);
          const bestSim = alternatives.length > 0
            ? Math.max(...alternatives.map(a => TextSimilarity.similarityScore(ans.textAnswer, a)))
            : TextSimilarity.similarityScore(ans.textAnswer, q.correctAnswer);
          if (bestSim >= 0.9) { isCorrect = true; score = q.points; }
          else { isCorrect = false; score = Math.round(bestSim * q.points); }
          autoScore += score;
        }
      } else if (q.type === 'TRUE_FALSE') {
        isCorrect = ans.selected === q.correct;
        score = isCorrect ? q.points : 0;
        autoScore += score;
      } else if (q.type === 'SHORT_ANSWER') {
        hasManualGrading = true;
        if (ans.textAnswer && ans.textAnswer.trim().length > 0) {
          if (q.modelAnswer) {
            const sim = TextSimilarity.similarityScore(ans.textAnswer, q.modelAnswer);
            if (sim >= 0.85) { isCorrect = true; score = q.points; }
            else if (sim >= 0.25) { isCorrect = false; score = Math.round(sim * q.points); }
            else { isCorrect = false; score = 0; }
          } else { isCorrect = true; score = q.points; }
          autoScore += score;
        } else { isCorrect = false; score = 0; }
      }

      await this.repository.prisma.answer.update({ where: { id: ans.id }, data: { score, isCorrect } });
    }

    const maxScore = attempt.assessment?.maxScore ?? Array.from(questionMap.values()).reduce((s, q) => s + q.points, 0);
    const clampedScore = Math.min(autoScore, maxScore);
    const status = hasPendingFaceMismatch ? 'SUBMITTED' : 'GRADED';

    const updated = await this.attemptRepo.update(attemptId, { status, submittedAt: new Date(), score: clampedScore });
    return { ...updated, hasManualGrading, autoScore, hasPendingFaceMismatch, hasRejectedFace };
  }

  async gradeAttempt(attemptId, user, body) {
    const schema = z.object({
      answers: z.array(z.object({ answerId: z.string(), score: z.number().int().min(0), feedback: z.string().optional() })),
    });
    const data = schema.parse(body);

    const attempt = await this.attemptRepo.findForGrading(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');

    // Check face verification
    const faceVerification = await this.repository.prisma.faceVerification.findUnique({ where: { attemptId } });
    if (faceVerification && !faceVerification.matchResult) {
      if (!faceVerification.adminReviewed) throw AppError.forbidden('face_mismatch_pending', 'This attempt has a pending face verification review.');
      if (faceVerification.adminReviewed && !faceVerification.adminApproved) throw AppError.forbidden('face_mismatch_rejected', 'Face verification was rejected.');
    }

    // Verify teacher
    const isTeacher = attempt.assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      attempt.assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    // Update each answer
    for (const a of data.answers) {
      const answer = await this.repository.prisma.answer.findUnique({
        where: { id: a.answerId },
        include: { question: { select: { points: true } } },
      });
      const maxPoints = answer?.question?.points ?? 0;
      const clampedAnswerScore = Math.min(Math.max(0, a.score), maxPoints);
      await this.repository.prisma.answer.update({
        where: { id: a.answerId },
        data: { score: clampedAnswerScore, feedback: a.feedback },
      });
    }

    // Recalculate total
    const answers = await this.repository.prisma.answer.findMany({ where: { attemptId } });
    const totalScore = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = attempt.assessment?.maxScore ?? 0;
    const clampedScore = maxScore > 0 ? Math.min(totalScore, maxScore) : totalScore;

    return this.attemptRepo.update(attemptId, { status: 'GRADED', score: clampedScore });
  }

  async toggleOpen(assessmentId, user, body) {
    const schema = z.object({ isOpen: z.boolean() });
    const data = schema.parse(body);

    const assessment = await this.repository.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: { include: { courseSections: true, courseClasses: true } }, questions: true },
    });
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    // If opening the exam, validate that total question points match maxScore
    if (data.isOpen) {
      const totalPoints = assessment.questions.reduce((sum, q) => sum + q.points, 0);
      if (totalPoints !== assessment.maxScore) {
        throw AppError.badRequest('points_mismatch',
          `Cannot open exam: total question points (${totalPoints}) must equal the max score (${assessment.maxScore}). ${assessment.questions.length} question(s) added.`);
      }

      // Validate exam schedule for MIDTERM and FINAL exams
      if (assessment.examType === 'MIDTERM' || assessment.examType === 'FINAL') {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        // Check if assessment has a scheduled start time that hasn't arrived yet
        if (assessment.scheduledStart && new Date(assessment.scheduledStart) > now) {
          throw AppError.badRequest('schedule_not_ready',
            `Cannot activate this ${assessment.examType.toLowerCase()} exam yet. The scheduled start time is ${new Date(assessment.scheduledStart).toLocaleString()}.`);
        }

        const courseSectionIds = assessment.course.courseSections.map(s => s.id);
        const courseSection = assessment.course.courseSections[0];

        // 1. Check teacher's scheduled exam date first
        const examSchedule = await this.repository.prisma.examSchedule.findFirst({
          where: { courseSectionId: { in: courseSectionIds }, examType: assessment.examType },
        });

        if (examSchedule) {
          const examDate = examSchedule.confirmedDate
            ? new Date(examSchedule.confirmedDate)
            : examSchedule.officialDate
              ? new Date(examSchedule.officialDate)
              : null;

          if (examDate) {
            const examDayStart = new Date(examDate);
            examDayStart.setHours(0, 0, 0, 0);

            if (examDayStart <= todayStart) {
              // Teacher's exam date has arrived — allow activation
            } else {
              // Exam date hasn't arrived yet — check early exam proposal
              const canEarly = examSchedule.earlyExamStatus === 'ALL_AGREED' || examSchedule.earlyExamStatus === 'APPROVED';
              if (canEarly && examSchedule.proposedDate) {
                const proposedDayStart = new Date(examSchedule.proposedDate);
                proposedDayStart.setHours(0, 0, 0, 0);
                if (proposedDayStart > todayStart) {
                  throw AppError.badRequest('early_exam_not_yet',
                    `Cannot activate this early ${assessment.examType.toLowerCase()} exam yet. The proposed early date is ${new Date(examSchedule.proposedDate).toLocaleDateString()}.`);
                }
                // Proposed early date has arrived — allow
              } else {
                throw AppError.badRequest('exam_not_scheduled_today',
                  `Cannot activate this ${assessment.examType.toLowerCase()} exam. The scheduled exam date is ${examDate.toLocaleDateString()}, which has not arrived yet.`);
              }
            }
          } else {
            // ExamSchedule exists but no date set — check admin period as fallback
            let examPeriodStart = null;
            let examPeriodEnd = null;

            if (courseSection?.semesterId) {
              const semester = await this.repository.prisma.semester.findUnique({
                where: { id: courseSection.semesterId },
              });
              if (semester) {
                if (assessment.examType === 'MIDTERM') {
                  examPeriodStart = semester.midtermExamStart ? new Date(semester.midtermExamStart) : null;
                  examPeriodEnd = semester.midtermExamEnd ? new Date(semester.midtermExamEnd) : null;
                  if (!examPeriodStart && semester.midtermExamDate) {
                    examPeriodStart = new Date(semester.midtermExamDate);
                    examPeriodEnd = new Date(semester.midtermExamDate);
                  }
                } else {
                  examPeriodStart = semester.finalExamStart ? new Date(semester.finalExamStart) : null;
                  examPeriodEnd = semester.finalExamEnd ? new Date(semester.finalExamEnd) : null;
                  if (!examPeriodStart && semester.finalExamDate) {
                    examPeriodStart = new Date(semester.finalExamDate);
                    examPeriodEnd = new Date(semester.finalExamDate);
                  }
                }
              }
            }

            if (examPeriodStart && examPeriodEnd) {
              const periodStart = new Date(examPeriodStart);
              periodStart.setHours(0, 0, 0, 0);
              const periodEnd = new Date(examPeriodEnd);
              periodEnd.setHours(23, 59, 59, 999);

              if (todayStart < periodStart) {
                throw AppError.badRequest('exam_period_not_started',
                  `Cannot activate this ${assessment.examType.toLowerCase()} exam. The exam period is ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}, which has not started yet.`);
              } else if (todayStart > periodEnd) {
                throw AppError.badRequest('exam_period_ended',
                  `Cannot activate this ${assessment.examType.toLowerCase()} exam. The exam period (${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}) has ended.`);
              }
            } else {
              throw AppError.badRequest('no_exam_schedule',
                `Cannot activate this ${assessment.examType.toLowerCase()} exam. No exam schedule has been created and no admin exam period is set.`);
            }
          }
        } else {
          // 2. No teacher schedule — fall back to admin's exam period range
          let examPeriodStart = null;
          let examPeriodEnd = null;

          if (courseSection?.semesterId) {
            const semester = await this.repository.prisma.semester.findUnique({
              where: { id: courseSection.semesterId },
            });
            if (semester) {
              if (assessment.examType === 'MIDTERM') {
                examPeriodStart = semester.midtermExamStart ? new Date(semester.midtermExamStart) : null;
                examPeriodEnd = semester.midtermExamEnd ? new Date(semester.midtermExamEnd) : null;
                if (!examPeriodStart && semester.midtermExamDate) {
                  examPeriodStart = new Date(semester.midtermExamDate);
                  examPeriodEnd = new Date(semester.midtermExamDate);
                }
              } else {
                examPeriodStart = semester.finalExamStart ? new Date(semester.finalExamStart) : null;
                examPeriodEnd = semester.finalExamEnd ? new Date(semester.finalExamEnd) : null;
                if (!examPeriodStart && semester.finalExamDate) {
                  examPeriodStart = new Date(semester.finalExamDate);
                  examPeriodEnd = new Date(semester.finalExamDate);
                }
              }
            }
          }

          if (examPeriodStart && examPeriodEnd) {
            const periodStart = new Date(examPeriodStart);
            periodStart.setHours(0, 0, 0, 0);
            const periodEnd = new Date(examPeriodEnd);
            periodEnd.setHours(23, 59, 59, 999);

            if (todayStart < periodStart) {
              throw AppError.badRequest('exam_period_not_started',
                `Cannot activate this ${assessment.examType.toLowerCase()} exam. The exam period is ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}, which has not started yet.`);
            } else if (todayStart > periodEnd) {
              throw AppError.badRequest('exam_period_ended',
                `Cannot activate this ${assessment.examType.toLowerCase()} exam. The exam period (${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}) has ended.`);
            }
          } else {
            throw AppError.badRequest('no_exam_schedule',
              `Cannot activate this ${assessment.examType.toLowerCase()} exam. No exam schedule has been created. The admin must set the semester exam period, or the teacher must create an exam schedule.`);
          }
        }
      }
    }

    const result = this.repository.update(assessmentId, { isOpen: data.isOpen });

    // Notify enrolled students when assessment is opened
    if (data.isOpen) {
      const enrollments = await this.repository.prisma.studentEnrollment.findMany({
        where: { courseSection: { courseId: assessment.courseId }, status: 'ENROLLED' },
        select: { studentId: true },
      });
      if (enrollments.length > 0) {
        const examLabel = assessment.examType === 'MIDTERM' ? 'Midterm' : assessment.examType === 'FINAL' ? 'Final' : assessment.examType === 'QUIZ' ? 'Quiz' : assessment.examType === 'ASSIGNMENT' ? 'Assignment' : 'Assessment';
        const notifRepo = new NotificationRepository();
        for (const e of enrollments) {
          await notifRepo.createNotification({
            userId: e.studentId,
            type: 'ASSESSMENT_OPENED',
            title: `${examLabel} Now Available`,
            message: `"${assessment.title}" is now open. You can start your ${examLabel.toLowerCase()} now.`,
            data: { assessmentId, courseId: assessment.courseId },
          });
        }
      }
    }

    return result;
  }

  async getManualGrades(assessmentId, user) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    return this.repository.prisma.manualGrade.findMany({
      where: { assessmentId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async setManualGrade(assessmentId, studentId, user, body) {
    const schema = z.object({ score: z.number().int().min(0), feedback: z.string().optional() });
    const data = schema.parse(body);

    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    // Validate score doesn't exceed maxScore
    if (data.score > assessment.maxScore) {
      throw AppError.badRequest('score_exceeds_max', `Score cannot exceed ${assessment.maxScore}`);
    }

    return this.repository.prisma.manualGrade.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      update: { score: data.score, feedback: data.feedback },
      create: { assessment: { connect: { id: assessmentId } }, student: { connect: { id: studentId } }, score: data.score, feedback: data.feedback },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async deleteManualGrade(assessmentId, studentId, user) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
      assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
    this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');

    await this.repository.prisma.manualGrade.deleteMany({
      where: { assessmentId, studentId },
    });
  }

  async getAttemptsForGrading(assessmentId, user) {
    const assessment = await this.repository.findWithCourse(assessmentId);
    this.throwUnless(assessment, 404, 'not_found', 'Assessment not found');

    if (user.role !== 'ADMIN') {
      const isTeacher = assessment.course.courseSections.some(s => s.teacherId === user.id) ||
        assessment.course.courseClasses?.some(cc => cc.teacherId === user.id);
      this.throwUnless(isTeacher, 403, 'forbidden', 'You are not assigned to this course');
    }

    return this.attemptRepo.findForGradingByAssessment(assessmentId);
  }

  async getAttempt(attemptId, user) {
    const attempt = await this.attemptRepo.findWithAnswersAndQuestions(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');

    // Students can only see their own
    if (user.role === 'STUDENT' && attempt.studentId !== user.id) {
      throw AppError.forbidden('forbidden', 'Not your attempt');
    }

    // Calculate exam end time from teacher's scheduled date + duration
    let examEndTime = null;
    const courseSections = attempt.assessment?.course?.courseSections || [];
    const examSchedules = courseSections.flatMap(cs => cs.examSchedules || []);
    const matchingSchedule = examSchedules.find(es => es.examType === attempt.assessment?.examType);

    if (matchingSchedule) {
      const examDate = matchingSchedule.confirmedDate
        ? new Date(matchingSchedule.confirmedDate)
        : matchingSchedule.officialDate
          ? new Date(matchingSchedule.officialDate)
          : null;
      if (examDate && matchingSchedule.duration) {
        examEndTime = new Date(examDate.getTime() + matchingSchedule.duration * 60 * 1000).toISOString();
      }
    }

    return { ...attempt, examEndTime };
  }

  async saveAnswer(attemptId, user, body) {
    const schema = z.object({
      questionId: z.string(),
      selected: z.string().optional(),
      textAnswer: z.string().optional(),
    });
    const data = schema.parse(body);

    const attempt = await this.attemptRepo.findById(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');
    this.throwUnless(attempt.studentId === user.id, 403, 'forbidden', 'Not your attempt');
    this.throwIf(attempt.status !== 'IN_PROGRESS', 400, 'not_in_progress', 'Attempt is not in progress');

    await this.repository.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: data.questionId } },
      update: { selected: data.selected, textAnswer: data.textAnswer },
      create: { attempt: { connect: { id: attemptId } }, question: { connect: { id: data.questionId } }, selected: data.selected, textAnswer: data.textAnswer },
    });

    return { success: true };
  }

  async pauseAttempt(attemptId, user, body) {
    const schema = z.object({
      remainingSeconds: z.number().int().min(0),
      currentQuestionIdx: z.number().int().min(0).optional(),
      answers: z.array(z.object({
        questionId: z.string(),
        selected: z.string().optional(),
        textAnswer: z.string().optional(),
      })).optional(),
    });
    const data = schema.parse(body);

    const attempt = await this.attemptRepo.findById(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');
    this.throwUnless(attempt.studentId === user.id, 403, 'forbidden', 'Not your attempt');
    this.throwIf(attempt.status !== 'IN_PROGRESS', 400, 'not_in_progress', 'Attempt is not in progress');

    // Save all answers if provided
    if (data.answers && data.answers.length > 0) {
      await Promise.all(data.answers.map(a =>
        this.repository.prisma.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
          update: { selected: a.selected, textAnswer: a.textAnswer },
          create: { attempt: { connect: { id: attemptId } }, question: { connect: { id: a.questionId } }, selected: a.selected, textAnswer: a.textAnswer },
        })
      ));
    }

    // Save remaining time and current question
    await this.attemptRepo.update(attemptId, {
      pausedAt: new Date(),
      remainingSeconds: data.remainingSeconds,
      currentQuestionIdx: data.currentQuestionIdx ?? 0,
    });

    return { success: true, remainingSeconds: data.remainingSeconds };
  }

  async autoSaveAnswers(attemptId, user, body) {
    const schema = z.object({
      answers: z.array(z.object({
        questionId: z.string(),
        selected: z.string().optional(),
        textAnswer: z.string().optional(),
      })),
      remainingSeconds: z.number().int().min(0).optional(),
      currentQuestionIdx: z.number().int().min(0).optional(),
    });
    const data = schema.parse(body);

    const attempt = await this.attemptRepo.findById(attemptId);
    this.throwUnless(attempt, 404, 'not_found', 'Attempt not found');
    this.throwUnless(attempt.studentId === user.id, 403, 'forbidden', 'Not your attempt');
    this.throwIf(attempt.status !== 'IN_PROGRESS', 400, 'not_in_progress', 'Attempt is not in progress');

    // Save all answers
    if (data.answers && data.answers.length > 0) {
      await Promise.all(data.answers.map(a =>
        this.repository.prisma.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
          update: { selected: a.selected, textAnswer: a.textAnswer },
          create: { attempt: { connect: { id: attemptId } }, question: { connect: { id: a.questionId } }, selected: a.selected, textAnswer: a.textAnswer },
        })
      ));
    }

    // Also update remaining time and current question index
    const updateData = {};
    if (data.remainingSeconds !== undefined) updateData.remainingSeconds = data.remainingSeconds;
    if (data.currentQuestionIdx !== undefined) updateData.currentQuestionIdx = data.currentQuestionIdx;
    if (Object.keys(updateData).length > 0) {
      await this.attemptRepo.update(attemptId, updateData);
    }

    return { success: true };
  }

  async getMyAttempts(courseId, user) {
    const assessments = await this.repository.prisma.assessment.findMany({
      where: { courseId },
      select: { id: true },
    });
    const assessmentIds = assessments.map(a => a.id);

    return this.repository.prisma.attempt.findMany({
      where: { studentId: user.id, assessmentId: { in: assessmentIds } },
      include: {
        assessment: { select: { id: true, title: true, examType: true, maxScore: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
