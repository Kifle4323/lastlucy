import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { GradebookRepository } from '../repositories/GradebookRepository.js';

export class GradebookService extends BaseService {
  constructor() {
    super(new GradebookRepository());
  }

  async getComponents(courseId) {
    let components = await this.repository.findComponents(courseId);

    if (components.length === 0) {
      const config = await this.repository.findLegacyConfig(courseId);
      if (config) {
        // Seed from legacy config
        const seeded = await Promise.all([
          this.repository.prisma.gradeComponent.create({ data: { courseId, name: 'Quiz', weight: config.quizWeight, sortOrder: 0 } }),
          config.assignmentWeight ? this.repository.prisma.gradeComponent.create({ data: { courseId, name: 'Assignment', weight: config.assignmentWeight, sortOrder: 1 } }) : null,
          this.repository.prisma.gradeComponent.create({ data: { courseId, name: 'Midterm', weight: config.midtermWeight, sortOrder: 2 } }),
          this.repository.prisma.gradeComponent.create({ data: { courseId, name: 'Final', weight: config.finalWeight, sortOrder: 3 } }),
          config.attendanceWeight ? this.repository.prisma.gradeComponent.create({ data: { courseId, name: 'Attendance', weight: config.attendanceWeight, sortOrder: 4 } }) : null,
        ].filter(Boolean));
        return seeded;
      }
      return this.repository.seedDefaults(courseId);
    }

    return components;
  }

  async addComponent(courseId, teacherId, body) {
    const schema = z.object({ name: z.string().min(1), weight: z.number().int().min(0).max(100) });
    const data = schema.parse(body);

    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    const existing = await this.repository.findComponents(courseId);
    const totalWeight = existing.reduce((sum, c) => sum + c.weight, 0) + data.weight;
    this.throwIf(totalWeight > 100, 400, 'invalid_weights', `Total weight would be ${totalWeight}%, max is 100%`);

    return this.repository.create({ data: { courseId, name: data.name, weight: data.weight, sortOrder: existing.length } });
  }

  async updateComponent(courseId, componentId, teacherId, body) {
    const schema = z.object({ name: z.string().min(1).optional(), weight: z.number().int().min(0).max(100).optional() });
    const data = schema.parse(body);

    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    if (data.weight !== undefined) {
      const existing = await this.repository.findMany({ courseId, id: { not: componentId } });
      const totalWeight = existing.reduce((sum, c) => sum + c.weight, 0) + data.weight;
      this.throwIf(totalWeight > 100, 400, 'invalid_weights', `Total weight would be ${totalWeight}%`);
    }

    const component = await this.repository.update(componentId, data);

    if (data.weight !== undefined) {
      await this.repository.prisma.assessment.updateMany({
        where: { componentId },
        data: { maxScore: data.weight },
      });
    }

    return component;
  }

  async deleteComponent(courseId, componentId, teacherId) {
    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    await this.repository.prisma.assessment.updateMany({ where: { componentId }, data: { componentId: null } });
    await this.repository.delete(componentId);
  }

  async getAttendance(courseId, teacherId) {
    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    return this.repository.findAttendanceForCourse(courseId);
  }

  async setAttendance(courseId, studentId, teacherId, body) {
    const schema = z.object({ score: z.number().int().min(0).max(100), feedback: z.union([z.string(), z.null()]).optional() });
    const data = schema.parse(body);

    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    return this.repository.upsertAttendance(courseId, studentId, data.score, data.feedback);
  }

  async getGradebook(courseId, teacherId) {
    const courseSection = await this.repository.findTeacherCourseSection(courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    let components = await this.getComponents(courseId);
    const config = await this.repository.findLegacyConfig(courseId) || { quizWeight: 15, assignmentWeight: 10, midtermWeight: 25, finalWeight: 40, attendanceWeight: 10 };

    const sections = await this.repository.findSectionsWithStudents(courseId, teacherId);
    const courseClasses = await this.repository.findCourseClassesWithStudents(courseId, teacherId);
    const assessments = await this.repository.findAssessmentsWithAttempts(courseId);
    const attendance = await this.repository.findAttendanceForCourse(courseId);

    // Merge students
    const sectionStudents = sections.flatMap(section =>
      section.enrollments.map(e => ({ ...e.student, classId: section.classId, className: section.class?.name || 'No Class', sectionCode: section.sectionCode }))
    );
    const classStudents = courseClasses.flatMap(cc =>
      cc.class.students.map(s => ({ ...s.student, classId: cc.classId, className: cc.class.name, sectionCode: '' }))
    );
    const allStudents = [...sectionStudents, ...classStudents];
    const uniqueStudents = allStudents.reduce((acc, student) => {
      if (!acc.find(s => s.id === student.id)) acc.push(student);
      return acc;
    }, []);

    const gradebook = uniqueStudents.map(student => {
      const componentMarks = {};
      const componentPercentages = {};
      let totalGrade = 0;

      for (const component of components) {
        if (component.name === 'Attendance') {
          const studentAttendance = attendance.find(a => a.studentId === student.id);
          const attendancePercent = Math.round((studentAttendance?.score || 0) * 10) / 10;
          const weightedMark = Math.round(attendancePercent * component.weight / 100 * 10) / 10;
          componentMarks[component.id] = weightedMark;
          componentPercentages[component.id] = attendancePercent;
          totalGrade += weightedMark;
        } else {
          const componentAssessments = assessments.filter(a => a.componentId === component.id);
          if (componentAssessments.length > 0) {
            let score = 0, count = 0;
            for (const assessment of componentAssessments) {
              // Check online attempts first
              const attempt = assessment.attempts.find(at => at.studentId === student.id && at.status === 'GRADED');
              if (attempt && attempt.score !== null && assessment.maxScore) {
                score += (attempt.score / assessment.maxScore) * 100;
                count++;
              } else {
                // Check manual grades (paper exams)
                const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === student.id);
                if (manualGrade && assessment.maxScore) {
                  score += (manualGrade.score / assessment.maxScore) * 100;
                  count++;
                }
              }
            }
            if (count > 0) {
              const avg = score / count;
              const percent = Math.round(avg * 10) / 10;
              const mark = Math.round(avg * component.weight / 100 * 10) / 10;
              componentMarks[component.id] = mark;
              componentPercentages[component.id] = percent;
              totalGrade += mark;
            }
          }
        }
      }

      return { student, componentMarks, componentPercentages, totalGrade: Math.round(totalGrade * 10) / 10 };
    });

    return { components, config, gradebook, assessments: assessments.map(a => ({ id: a.id, title: a.title, examType: a.examType, maxScore: a.maxScore, componentId: a.componentId, questionCount: a.questions.length })) };
  }

  async getMyGrades(courseId, studentId) {
    const components = await this.getComponents(courseId);
    const assessments = await this.repository.findAssessmentsWithAttempts(courseId, studentId);
    const attendance = await this.repository.findStudentAttendance(courseId, studentId);

    const componentMarks = {};
    const componentDetails = {};
    let totalGrade = 0;

    for (const component of components) {
      if (component.name === 'Attendance') {
        const attendancePercent = Math.round((attendance?.score || 0) * 10) / 10;
        const mark = Math.round(attendancePercent * component.weight / 100 * 10) / 10;
        componentMarks[component.id] = mark;
        totalGrade += mark;
      } else {
        const componentAssessments = assessments.filter(a => a.componentId === component.id);
        const details = [];
        let score = 0, count = 0;
        for (const assessment of componentAssessments) {
          const attempt = assessment.attempts.find(at => at.studentId === studentId && at.status === 'GRADED');
          if (attempt && attempt.score !== null && assessment.maxScore) {
            const percent = (attempt.score / assessment.maxScore) * 100;
            score += percent;
            count++;
            details.push({ title: assessment.title, score: attempt.score, maxScore: assessment.maxScore, percent: Math.round(percent * 10) / 10 });
          } else {
            // Check manual grades (paper exams)
            const manualGrade = assessment.manualGrades?.find(mg => mg.studentId === studentId);
            if (manualGrade && assessment.maxScore) {
              const percent = (manualGrade.score / assessment.maxScore) * 100;
              score += percent;
              count++;
              details.push({ title: assessment.title, score: manualGrade.score, maxScore: assessment.maxScore, percent: Math.round(percent * 10) / 10, isPaper: true });
            }
          }
        }
        if (count > 0) {
          const avg = score / count;
          const mark = Math.round(avg * component.weight / 100 * 10) / 10;
          componentMarks[component.id] = mark;
          totalGrade += mark;
        }
        componentDetails[component.id] = details;
      }
    }

    return { components, componentMarks, componentDetails, attendanceScore: attendance?.score || 0, totalGrade: Math.round(totalGrade * 10) / 10 };
  }

  async getLiveAttendance(sectionId, teacherId) {
    const section = await this.repository.findSectionWithCourse(sectionId, teacherId);
    this.throwUnless(section, 403, 'forbidden', 'Not assigned to this section');

    const liveSessions = await this.repository.findLiveSessions(section.courseId, section.classId);
    const manualSessions = await this.repository.findManualSessions(section.courseId, section.classId);
    const classStudents = await this.repository.findClassStudents(section.classId);

    const totalLiveSessions = liveSessions.length;
    const endedLiveSessions = liveSessions.filter(s => s.status === 'ENDED').length;
    const totalManualSessions = manualSessions.length;
    const totalSessions = totalLiveSessions + totalManualSessions;
    const endedSessions = endedLiveSessions + totalManualSessions;

    if (totalSessions === 0) {
      return { totalSessions: 0, endedSessions: 0, liveSessions: 0, manualSessions: 0, students: [], manualAttendanceHistory: [] };
    }

    const sessionIds = liveSessions.map(s => s.id);
    const attendanceRecords = await this.repository.findLiveAttendanceRecords(sessionIds);

    const studentStats = classStudents.map(cs => {
      const studentRecords = attendanceRecords.filter(a => a.studentId === cs.studentId);
      const liveAttended = studentRecords.filter(a => a.status === 'ATTENDED').length;
      const livePartial = studentRecords.filter(a => a.status === 'PARTIAL').length;
      const liveAbsent = studentRecords.filter(a => a.status === 'ABSENT').length;

      let manualPresent = 0, manualLate = 0, manualExcused = 0, manualAbsent = 0;
      for (const ms of manualSessions) {
        const record = ms.records.find(r => r.studentId === cs.studentId);
        if (record) {
          if (record.status === 'PRESENT') manualPresent++;
          else if (record.status === 'LATE') manualLate++;
          else if (record.status === 'EXCUSED') manualExcused++;
          else manualAbsent++;
        } else { manualAbsent++; }
      }

      let score = 0;
      if (endedSessions > 0) {
        const livePoints = (liveAttended * 100) + (livePartial * 50);
        const manualPoints = (manualPresent * 100) + (manualLate * 75) + (manualExcused * 50);
        score = Math.round((livePoints + manualPoints) / endedSessions);
      }

      return {
        student: cs.student,
        liveAttended, livePartial, liveAbsent,
        manualPresent, manualLate, manualExcused, manualAbsent,
        totalJoined: studentRecords.filter(a => a.status !== 'ABSENT').length + manualPresent + manualLate + manualExcused,
        score,
      };
    });

    return { totalSessions, endedSessions, liveSessions: totalLiveSessions, endedLiveSessions, manualSessions: totalManualSessions, students: studentStats, manualAttendanceHistory: manualSessions };
  }

  async syncAttendance(sectionId, teacherId) {
    const section = await this.repository.findSectionWithCourse(sectionId, teacherId);
    this.throwUnless(section, 403, 'forbidden', 'Not assigned to this section');

    const liveSessions = await this.repository.findLiveSessions(section.courseId, section.classId);
    const endedLive = liveSessions.filter(s => s.status === 'ENDED');
    const manualSessions = await this.repository.findManualSessions(section.courseId, section.classId);
    const totalSessions = endedLive.length + manualSessions.length;
    this.throwUnless(totalSessions > 0, 400, 'no_data', 'No attendance data to sync');

    const classStudents = await this.repository.findClassStudents(section.classId);
    const liveSessionIds = endedLive.map(s => s.id);
    const liveAttendanceRecords = await this.repository.findLiveAttendanceRecords(liveSessionIds);

    const results = [];
    for (const cs of classStudents) {
      const studentLiveRecords = liveAttendanceRecords.filter(a => a.studentId === cs.studentId);
      const liveAttended = studentLiveRecords.filter(a => a.status === 'ATTENDED').length;
      const livePartial = studentLiveRecords.filter(a => a.status === 'PARTIAL').length;
      const livePoints = (liveAttended * 100) + (livePartial * 50);

      let manualPoints = 0;
      for (const ms of manualSessions) {
        const record = ms.records.find(r => r.studentId === cs.studentId);
        if (record) {
          if (record.status === 'PRESENT') manualPoints += 100;
          else if (record.status === 'LATE') manualPoints += 75;
          else if (record.status === 'EXCUSED') manualPoints += 50;
        }
      }

      const percentage = Math.round((livePoints + manualPoints) / totalSessions);
      const score = Math.round(Math.min(100, Math.max(0, percentage)) * 10) / 10;

      const record = await this.repository.upsertAttendance(section.courseId, cs.studentId, score,
        `Auto-calculated from ${endedLive.length} live + ${manualSessions.length} in-person sessions (live: ${liveAttended} attended, ${livePartial} partial)`
      );
      results.push(record);
    }

    return { success: true, synced: results.length, attendance: results };
  }

  async createManualAttendance(sectionId, teacherId, body) {
    const schema = z.object({
      title: z.string().optional(),
      date: z.string(),
      records: z.array(z.object({ studentId: z.string(), status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) })).optional(),
    });
    const data = schema.parse(body);

    const section = await this.repository.findSectionWithCourse(sectionId, teacherId);
    this.throwUnless(section, 403, 'forbidden', 'Not assigned to this section');

    const date = new Date(data.date);
    const session = await this.repository.upsertManualSession(section.courseId, section.classId, teacherId, data.title || 'Face-to-Face Class', date);

    if (data.records && data.records.length > 0) {
      for (const record of data.records) {
        await this.repository.upsertManualAttendance(session.id, record.studentId, record.status);
      }
    }

    return session;
  }

  async getManualAttendanceSessions(sectionId, teacherId) {
    const section = await this.repository.findSectionWithCourse(sectionId, teacherId);
    this.throwUnless(section, 403, 'forbidden', 'Not assigned to this section');

    const sessions = await this.repository.findManualSessionsByCourse(section.courseId);
    return sessions;
  }

  async deleteManualAttendanceSession(sessionId, teacherId) {
    const session = await this.repository.findById(sessionId);
    this.throwUnless(session, 404, 'not_found', 'Manual attendance session not found');

    // Verify teacher owns this session's course
    const courseSection = await this.repository.findTeacherCourseSection(session.courseId, teacherId);
    const courseClass = await this.repository.findTeacherCourseClass(session.courseId, teacherId);
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'Not assigned to this course');

    await this.repository.deleteManualSession(sessionId);
  }
}
