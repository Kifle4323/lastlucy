import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { GradeCalculator } from '../core/GradeCalculator.js';
import { AcademicRepository } from '../repositories/AcademicRepository.js';

export class AcademicService extends BaseService {
  constructor() {
    super(new AcademicRepository());
  }

  // Academic Years
  async createAcademicYear(user, body) {
    const schema = z.object({ name: z.string().min(1), startDate: z.string(), endDate: z.string() });
    const data = schema.parse(body);
    const year = await this.repository.create({ data: { name: data.name, startDate: new Date(data.startDate), endDate: new Date(data.endDate) } });
    await AuditLogger.log({ action: 'CREATE', category: 'SEMESTER', userId: user.id, targetId: year.id, description: `Academic year created: ${year.name}` });
    return year;
  }

  async getAcademicYears() {
    return this.repository.findWithSemesters();
  }

  async updateAcademicYear(user, id, body) {
    const schema = z.object({ name: z.string().min(1).optional(), startDate: z.string().optional(), endDate: z.string().optional(), isActive: z.boolean().optional() });
    const data = schema.parse(body);
    const updateData = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    return this.repository.update(id, updateData);
  }

  async deleteAcademicYear(user, id) {
    await this.repository.delete(id);
    await AuditLogger.log({ action: 'DELETE', category: 'SEMESTER', userId: user.id, targetId: id, description: `Academic year deleted` });
  }

  // Semesters
  async createSemester(user, body) {
    const schema = z.object({
      academicYearId: z.string(),
      type: z.enum(['FALL', 'SPRING', 'SUMMER']),
      name: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
      registrationStart: z.string().optional(),
      registrationEnd: z.string().optional(),
      addDropStart: z.string().optional(),
      addDropEnd: z.string().optional(),
      midtermExamStart: z.string().optional(),
      midtermExamEnd: z.string().optional(),
      finalExamStart: z.string().optional(),
      finalExamEnd: z.string().optional(),
      gradingDeadline: z.string().optional(),
      registrationFee: z.number().nullable().optional(),
    });
    const data = schema.parse(body);
    const semester = await this.repository.createSemester({
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      registrationStart: data.registrationStart ? new Date(data.registrationStart) : null,
      registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : null,
      addDropStart: data.addDropStart ? new Date(data.addDropStart) : null,
      addDropEnd: data.addDropEnd ? new Date(data.addDropEnd) : null,
      midtermExamStart: data.midtermExamStart ? new Date(data.midtermExamStart) : null,
      midtermExamEnd: data.midtermExamEnd ? new Date(data.midtermExamEnd) : null,
      finalExamStart: data.finalExamStart ? new Date(data.finalExamStart) : null,
      finalExamEnd: data.finalExamEnd ? new Date(data.finalExamEnd) : null,
      gradingDeadline: data.gradingDeadline ? new Date(data.gradingDeadline) : null,
    });
    await AuditLogger.log({ action: 'CREATE', category: 'SEMESTER', userId: user.id, targetId: semester.id, description: `Semester created: ${semester.name}` });
    return semester;
  }

  async updateSemester(user, id, body) {
    // If setting this semester as current, unset all others first
    if (body.isCurrent === true) {
      await this.repository.prisma.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const data = { ...body };
    // Convert date strings, empty strings become null
    const toDate = (v) => v ? new Date(v) : null;
    if (data.startDate !== undefined) data.startDate = toDate(data.startDate);
    if (data.endDate !== undefined) data.endDate = toDate(data.endDate);
    if (data.registrationStart !== undefined) data.registrationStart = toDate(data.registrationStart);
    if (data.registrationEnd !== undefined) data.registrationEnd = toDate(data.registrationEnd);
    if (data.addDropStart !== undefined) data.addDropStart = toDate(data.addDropStart);
    if (data.addDropEnd !== undefined) data.addDropEnd = toDate(data.addDropEnd);
    if (data.midtermExamStart !== undefined) data.midtermExamStart = toDate(data.midtermExamStart);
    if (data.midtermExamEnd !== undefined) data.midtermExamEnd = toDate(data.midtermExamEnd);
    if (data.finalExamStart !== undefined) data.finalExamStart = toDate(data.finalExamStart);
    if (data.finalExamEnd !== undefined) data.finalExamEnd = toDate(data.finalExamEnd);
    if (data.gradingDeadline !== undefined) data.gradingDeadline = toDate(data.gradingDeadline);
    // Remove non-updatable fields
    delete data.type;
    delete data.academicYearId;
    return this.repository.updateSemester(id, data);
  }

  async deleteSemester(user, id) {
    await this.repository.deleteSemester(id);
  }

  // Course Sections
  async createSection(user, body) {
    const schema = z.object({
      courseId: z.string(),
      classId: z.string().nullable().optional(),
      semesterId: z.string(),
      teacherId: z.string().nullable().optional(),
      sectionCode: z.string().nullable().optional(),
      schedule: z.string().nullable().optional(),
    });
    const data = schema.parse(body);

    // Check for duplicate section (same course + semester + sectionCode)
    const existing = await this.repository.prisma.courseSection.findFirst({
      where: { courseId: data.courseId, semesterId: data.semesterId, sectionCode: data.sectionCode || '' },
    });
    if (existing) throw AppError.badRequest('duplicate_section', 'A section for this course in this semester with the same section code already exists');

    const section = await this.repository.createSection(data);
    await AuditLogger.log({ action: 'SECTION_CREATE', category: 'ENROLLMENT', userId: user.id, targetId: section.id, description: `Section created` });
    return section;
  }

  async getSections(semesterId) {
    return this.repository.findSections(semesterId);
  }

  async getSection(sectionId) {
    const section = await this.repository.findSection(sectionId);
    this.throwUnless(section, 404, 'not_found', 'Section not found');
    return section;
  }

  async updateSection(user, sectionId, body) {
    return this.repository.updateSection(sectionId, body);
  }

  async deleteSection(user, sectionId) {
    await this.repository.deleteSection(sectionId);
  }

  // Enrollments
  async enrollStudent(user, sectionId, studentId) {
    // Check if already enrolled
    const existing = await this.repository.prisma.studentEnrollment.findFirst({
      where: { courseSectionId: sectionId, studentId, status: 'ENROLLED' },
    });
    if (existing) return existing;

    const enrollment = await this.repository.prisma.studentEnrollment.create({
      data: { courseSection: { connect: { id: sectionId } }, student: { connect: { id: studentId } }, status: 'ENROLLED' },
    });
    await AuditLogger.log({ action: 'ENROLL', category: 'ENROLLMENT', userId: user.id, targetId: enrollment.id, description: `Student enrolled` });
    return enrollment;
  }

  async unenrollStudent(user, sectionId, studentId) {
    await this.repository.unenrollStudent(sectionId, studentId);
    await AuditLogger.log({ action: 'UNENROLL', category: 'ENROLLMENT', userId: user.id, description: `Student unenrolled` });
  }

  // Grades
  async publishGrades(user, sectionId) {
    const result = await this.repository.publishGrades(sectionId);
    await AuditLogger.log({ action: 'GRADE_PUBLISH', category: 'GRADE', userId: user.id, targetId: sectionId, description: `Grades published for section` });
    return result;
  }

  async calculateAndSaveGrades(sectionId) {
    const section = await this.repository.findSection(sectionId);
    this.throwUnless(section, 404, 'not_found', 'Section not found');

    const enrollments = await this.repository.findEnrollments(sectionId);
    const components = await this.repository.prisma.gradeComponent.findMany({ where: { courseId: section.courseId }, orderBy: { sortOrder: 'asc' } });

    const results = [];
    for (const enrollment of enrollments) {
      const studentId = enrollment.studentId;
      const courseId = section.courseId;
      const componentScores = {};
      let totalGrade = 0;

      for (const comp of components) {
        if (comp.name === 'Attendance') {
          const att = await this.repository.prisma.attendance.findUnique({ where: { courseId_studentId: { courseId, studentId } } });
          const pct = Math.round((att?.score || 0) * 10) / 10;
          const weighted = Math.round(pct * comp.weight / 100 * 10) / 10;
          componentScores[comp.id] = weighted;
          totalGrade += weighted;
        } else {
          const compAssessments = await this.repository.prisma.assessment.findMany({
            where: { courseId, componentId: comp.id },
            include: { attempts: { where: { studentId, status: 'GRADED' } } },
          });
          if (compAssessments.length > 0) {
            let score = 0, count = 0;
            for (const a of compAssessments) {
              const att = a.attempts.find(at => at.studentId === studentId);
              if (att && att.score !== null && a.maxScore) {
                score += (att.score / a.maxScore) * 100;
                count++;
              }
            }
            const avg = count > 0 ? score / count : 0;
            const weighted = Math.round(avg * comp.weight / 100 * 10) / 10;
            componentScores[comp.id] = Math.min(weighted, comp.weight);
            totalGrade += Math.min(weighted, comp.weight);
          }
        }
      }

      totalGrade = Math.round(Math.min(totalGrade, 100) * 10) / 10;
      const { letter, point } = GradeCalculator.getGradeFromScore(totalGrade);
      const gradeLetter = GradeCalculator.letterToEnum(letter);

      const quizComp = components.find(c => c.name === 'Quiz');
      const assignmentComp = components.find(c => c.name === 'Assignment');
      const midtermComp = components.find(c => c.name === 'Midterm');
      const finalComp = components.find(c => c.name === 'Final');
      const attendanceComp = components.find(c => c.name === 'Attendance');

      const grade = await this.repository.prisma.studentGrade.upsert({
        where: { enrollmentId: enrollment.id },
        create: {
          enrollmentId: enrollment.id,
          quizScore: quizComp ? (componentScores[quizComp.id] || 0) : 0,
          assignmentScore: assignmentComp ? (componentScores[assignmentComp.id] || 0) : 0,
          midtermScore: midtermComp ? (componentScores[midtermComp.id] || 0) : 0,
          finalScore: finalComp ? (componentScores[finalComp.id] || 0) : 0,
          attendanceScore: attendanceComp ? (componentScores[attendanceComp.id] || 0) : 0,
          totalScore: totalGrade,
          gradeLetter,
          gradePoint: point,
        },
        update: {
          quizScore: quizComp ? (componentScores[quizComp.id] || 0) : 0,
          assignmentScore: assignmentComp ? (componentScores[assignmentComp.id] || 0) : 0,
          midtermScore: midtermComp ? (componentScores[midtermComp.id] || 0) : 0,
          finalScore: finalComp ? (componentScores[finalComp.id] || 0) : 0,
          attendanceScore: attendanceComp ? (componentScores[attendanceComp.id] || 0) : 0,
          totalScore: totalGrade,
          gradeLetter,
          gradePoint: point,
        },
      });
      results.push(grade);
    }

    return results;
  }

  // Student routes
  async getMyCourses(studentId) {
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED' },
      include: {
        courseSection: {
          include: {
            course: true,
            teacher: { select: { id: true, fullName: true } },
            semester: { include: { academicYear: true } },
            class: true,
            scheduleSlots: true,
          },
        },
        grade: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });
    const sorted = enrollments.map(e => {
      const isCurrentSemester = e.courseSection?.semester?.isCurrent || false;
      const isPastSemester = e.courseSection?.semester?.status === 'COMPLETED'
        || (e.courseSection?.semester?.endDate && new Date(e.courseSection.semester.endDate) < new Date());
      const gradeSubmitted = e.grade?.isSubmitted || false;
      const gradePublished = e.grade?.isPublished || false;
      return { ...e, isCurrentSemester, isPastSemester, gradeSubmitted, gradePublished };
    });
    sorted.sort((a, b) => {
      if (a.isCurrentSemester !== b.isCurrentSemester) return a.isCurrentSemester ? -1 : 1;
      if (a.isPastSemester !== b.isPastSemester) return a.isPastSemester ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  async getAvailableCourses(studentId) {
    const student = await this.repository.prisma.user.findUnique({
      where: { id: studentId },
      include: { classStudents: { include: { class: true } } },
    });
    if (!student || student.classStudents.length === 0) {
      return { semester: null, class: null, courses: [], message: 'Student not assigned to any class' };
    }
    const classIds = student.classStudents.map(cs => cs.classId);
    const studentClass = student.classStudents[0].class;

    // Find the best semester: one that has course sections for this student's class
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

    let currentSemester = await findSemesterWithSections({ status: 'REGISTRATION_OPEN' });
    if (!currentSemester) {
      currentSemester = await findSemesterWithSections({
        isCurrent: true,
        registrationStart: { lte: new Date() },
        registrationEnd: { gte: new Date() },
      });
    }
    if (!currentSemester) {
      currentSemester = await findSemesterWithSections({ isCurrent: true });
    }
    if (!currentSemester) {
      // Last resort: most recent semester with sections for this class
      const sectionWithSemester = await this.repository.prisma.courseSection.findFirst({
        where: { classId: { in: classIds } },
        include: { semester: true },
        orderBy: { createdAt: 'desc' },
      });
      if (sectionWithSemester?.semester) currentSemester = sectionWithSemester.semester;
    }

    if (!currentSemester) {
      return { semester: null, class: studentClass, courses: [], message: 'No current semester found with courses for your class' };
    }
    return this._getAvailableCoursesForSemester(studentId, currentSemester.id, studentClass);
  }

  async _getAvailableCoursesForSemester(studentId, semesterId, studentClass = null) {
    const student = await this.repository.prisma.user.findUnique({
      where: { id: studentId },
      include: { classStudents: { include: { class: true } } },
    });
    if (!student || student.classStudents.length === 0) return { semester: null, class: null, courses: [], message: 'Student not assigned to any class' };

    if (!studentClass) studentClass = student.classStudents[0].class;

    const classIds = student.classStudents.map(cs => cs.classId);

    const semester = await this.repository.prisma.semester.findUnique({
      where: { id: semesterId },
      include: { academicYear: true },
    });

    const sections = await this.repository.prisma.courseSection.findMany({
      where: { semesterId, classId: { in: classIds } },
      include: { course: true, teacher: { select: { id: true, fullName: true } }, class: true },
    });

    const enrolledSectionIds = (await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED' },
      select: { courseSectionId: true },
    })).map(e => e.courseSectionId);

    const courses = sections.map(s => ({
      ...s,
      isEnrolled: enrolledSectionIds.includes(s.id),
    }));

    return {
      semester,
      class: studentClass,
      courses,
      message: courses.length === 0 ? 'No courses available for registration' : '',
    };
  }

  async registerForSemester(studentId) {
    const student = await this.repository.prisma.user.findUnique({
      where: { id: studentId },
      include: { classStudents: { include: { class: true } } },
    });
    this.throwUnless(student, 404, 'not_found', 'Student not found');
    this.throwUnless(student.classStudents.length > 0, 400, 'no_class', 'You are not assigned to any class. Contact admin.');

    const classIds = student.classStudents.map(cs => cs.classId);
    const classNames = student.classStudents.map(cs => cs.class?.name || cs.classId).join(', ');

    // Find the best semester for registration:
    // 1. REGISTRATION_OPEN semester that has sections for this student's class
    // 2. Any isCurrent semester that has sections for this student's class
    // 3. Any semester that has sections for this student's class (most recent)
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

    let currentSemester = await findSemesterWithSections({ status: 'REGISTRATION_OPEN' });
    if (!currentSemester) {
      currentSemester = await findSemesterWithSections({ isCurrent: true });
    }
    if (!currentSemester) {
      // Last resort: find the most recent semester that has sections for this class
      const sectionWithSemester = await this.repository.prisma.courseSection.findFirst({
        where: { classId: { in: classIds } },
        include: { semester: true },
        orderBy: { createdAt: 'desc' },
      });
      if (sectionWithSemester?.semester) {
        currentSemester = sectionWithSemester.semester;
      }
    }
    this.throwUnless(currentSemester, 400, 'no_registration', 'No current semester found with courses for your class. Please wait for admin to open registration and create course sections.');

    // Check payment: calculate fee from department and verify payment if fee > 0
    const classStudent = await this.repository.prisma.classStudent.findFirst({
      where: { studentId, classId: { in: classIds } },
      include: { class: { include: { department: true } } },
    });
    if (classStudent?.class?.department) {
      const dept = classStudent.class.department;
      const courseSections = await this.repository.prisma.courseSection.findMany({
        where: { semesterId: currentSemester.id, classId: { in: classIds } },
        include: { course: true },
      });
      const semesterCreditHours = courseSections.reduce((sum, cs) => sum + (cs.course?.creditHours || 0), 0);
      const registrationFee = dept.pricePerCreditHour * (semesterCreditHours || dept.totalCreditHours || 3);

      if (registrationFee > 0) {
        const completedPayment = await this.repository.prisma.semesterPayment.findFirst({
          where: { studentId, semesterId: currentSemester.id, status: 'COMPLETED' },
        });
        this.throwUnless(completedPayment, 400, 'payment_required',
          `Registration fee of ETB ${registrationFee.toLocaleString()} must be paid before registering. Please complete payment first.`
        );
      }
    }

    const sections = await this.repository.prisma.courseSection.findMany({
      where: { semesterId: currentSemester.id, classId: { in: classIds } },
    });

    // If no sections for this semester, try finding sections in any semester for this class
    if (sections.length === 0) {
      const anySections = await this.repository.prisma.courseSection.findMany({
        where: { classId: { in: classIds } },
        include: { semester: true },
        take: 5,
      });
      const semesterNames = [...new Set(anySections.map(s => `${s.semester?.name} (${s.semesterId})`))].join(', ');
      this.throwUnless(false, 400, 'no_sections',
        `No course sections found for your class (${classNames}) in semester "${currentSemester.name}" (${currentSemester.id}). ` +
        `Sections exist in other semesters: ${semesterNames || 'none'}. Contact admin to create sections.`
      );
    }

    const enrolled = [];
    for (const section of sections) {
      const existing = await this.repository.prisma.studentEnrollment.findFirst({
        where: { courseSectionId: section.id, studentId, status: 'ENROLLED' },
      });
      if (!existing) {
        const enrollment = await this.repository.prisma.studentEnrollment.create({
          data: { courseSection: { connect: { id: section.id } }, student: { connect: { id: studentId } }, status: 'ENROLLED' },
        });
        enrolled.push(enrollment);
      }
    }
    return { enrolled: enrolled.length, total: sections.length, message: `Successfully registered for ${enrolled.length} course(s)` };
  }

  async getMyResults(studentId, semesterId) {
    // Get current semester if not specified
    if (!semesterId) {
      const current = await this.repository.prisma.semester.findFirst({ where: { isCurrent: true } });
      semesterId = current?.id;
    }
    if (!semesterId) return { semester: null, courses: [], gpa: null };

    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, courseSection: { semesterId } },
      include: {
        courseSection: { include: { course: true, semester: { include: { academicYear: true } } } },
        grade: true,
      },
    });

    let totalPoints = 0, totalCredits = 0;
    const courses = enrollments.map(e => {
      const credits = e.courseSection.course.creditHours;
      const grade = e.grade;
      if (grade && grade.isPublished && grade.gradePoint !== null) {
        totalPoints += grade.gradePoint * credits;
        totalCredits += credits;
      }
      return {
        id: e.id,
        course: e.courseSection.course,
        sectionCode: e.courseSection.sectionCode,
        creditHours: credits,
        grade: grade ? {
          quizScore: grade.isPublished ? grade.quizScore : null,
          midtermScore: grade.isPublished ? grade.midtermScore : null,
          finalScore: grade.isPublished ? grade.finalScore : null,
          attendanceScore: grade.isPublished ? grade.attendanceScore : null,
          totalScore: grade.isPublished ? grade.totalScore : null,
          gradeLetter: grade.isPublished ? grade.gradeLetter : null,
          gradePoint: grade.isPublished ? grade.gradePoint : null,
          isSubmitted: grade.isSubmitted,
          isPublished: grade.isPublished,
        } : null,
      };
    });

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : null;
    const semester = await this.repository.prisma.semester.findUnique({
      where: { id: semesterId },
      include: { academicYear: true },
    });

    return { semester, courses, gpa };
  }

  async getMyCGPA(studentId) {
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, grade: { isPublished: true } },
      include: {
        courseSection: { include: { course: true, semester: { include: { academicYear: true } } } },
        grade: true,
      },
    });

    let totalPoints = 0, totalCredits = 0;
    const semesterResults = {};

    for (const e of enrollments) {
      const credits = e.courseSection.course.creditHours;
      const grade = e.grade;
      if (grade?.gradePoint !== null && grade?.gradePoint !== undefined) {
        totalPoints += grade.gradePoint * credits;
        totalCredits += credits;
        const semKey = e.courseSection.semesterId;
        if (!semesterResults[semKey]) {
          semesterResults[semKey] = { semester: e.courseSection.semester, points: 0, credits: 0, gpa: 0 };
        }
        semesterResults[semKey].points += grade.gradePoint * credits;
        semesterResults[semKey].credits += credits;
      }
    }

    for (const key of Object.keys(semesterResults)) {
      const sr = semesterResults[key];
      sr.gpa = sr.credits > 0 ? sr.points / sr.credits : 0;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : null;
    return {
      cgpa,
      totalCredits,
      totalCourses: enrollments.length,
      semesters: Object.values(semesterResults).sort((a, b) =>
        new Date(b.semester?.startDate || 0) - new Date(a.semester?.startDate || 0)
      ),
    };
  }

  async getStudentExamSchedules(studentId) {
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { studentId, status: 'ENROLLED' },
      select: { courseSectionId: true },
    });
    const sectionIds = enrollments.map(e => e.courseSectionId);
    return this.repository.prisma.examSchedule.findMany({
      where: { courseSectionId: { in: sectionIds } },
      include: { courseSection: { include: { course: true } } },
      orderBy: { officialDate: 'asc' },
    });
  }

  async respondToEarlyExam(studentId, scheduleId, agreed) {
    return this.repository.prisma.earlyExamRequest.upsert({
      where: { examScheduleId_studentId: { examScheduleId: scheduleId, studentId } },
      create: { examSchedule: { connect: { id: scheduleId } }, student: { connect: { id: studentId } }, agreed, respondedAt: new Date() },
      update: { agreed, respondedAt: new Date() },
    });
  }

  // Teacher routes
  async getTeacherSections(teacherId) {
    const sections = await this.repository.prisma.courseSection.findMany({
      where: { teacherId },
      include: {
        course: true,
        semester: { include: { academicYear: true } },
        class: true,
        scheduleSlots: true,
        _count: { select: { enrollments: true } },
        enrollments: { select: { id: true, status: true, grade: { select: { isSubmitted: true, isPublished: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with grade submission status and semester status
    const enriched = sections.map(s => {
      const activeEnrollments = s.enrollments.filter(e => e.status === 'ENROLLED');
      const totalEnrollments = activeEnrollments.length;
      const submittedGrades = activeEnrollments.filter(e => e.grade?.isSubmitted).length;
      const publishedGrades = activeEnrollments.filter(e => e.grade?.isPublished).length;
      const allGradesSubmitted = totalEnrollments > 0 && submittedGrades >= totalEnrollments;
      const allGradesPublished = totalEnrollments > 0 && publishedGrades >= totalEnrollments;
      const isCurrentSemester = s.semester?.isCurrent || false;
      const isPastSemester = s.semester?.status === 'COMPLETED' || (s.semester?.endDate && new Date(s.semester.endDate) < new Date());

      const { enrollments, ...rest } = s;
      return {
        ...rest,
        allGradesSubmitted,
        allGradesPublished,
        isCurrentSemester,
        isPastSemester,
        semesterStatus: s.semester?.status || null,
      };
    });

    // Sort: current semester first, then by semester start date desc
    enriched.sort((a, b) => {
      if (a.isCurrentSemester !== b.isCurrentSemester) return a.isCurrentSemester ? -1 : 1;
      if (a.isPastSemester !== b.isPastSemester) return a.isPastSemester ? 1 : -1;
      return 0;
    });

    return enriched;
  }

  async getSectionStudents(sectionId) {
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { courseSectionId: sectionId, status: 'ENROLLED' },
      include: { student: { select: { id: true, fullName: true, email: true, profileImage: true } }, grade: true },
    });
    return enrollments;
  }

  async enterGrade(teacherId, body) {
    const schema = z.object({ enrollmentId: z.string(), quizScore: z.number().optional(), assignmentScore: z.number().optional(), midtermScore: z.number().optional(), finalScore: z.number().optional(), attendanceScore: z.number().optional() });
    const data = schema.parse(body);

    // Check semester is IN_PROGRESS or GRADING
    const enrollment = await this.repository.prisma.studentEnrollment.findUnique({
      where: { id: data.enrollmentId },
      include: { courseSection: { include: { semester: { select: { status: true } } } } },
    });
    if (enrollment && enrollment.courseSection?.semester?.status !== 'IN_PROGRESS' && enrollment.courseSection?.semester?.status !== 'GRADING') {
      const err = new Error(`Cannot enter grades. Semester status is ${enrollment.courseSection.semester.status}. Wait for admin to start the semester.`);
      err.status = 403;
      err.semesterStatus = enrollment.courseSection.semester.status;
      throw err;
    }

    const existing = await this.repository.prisma.studentGrade.findUnique({ where: { enrollmentId: data.enrollmentId } });
    if (existing) {
      return this.repository.prisma.studentGrade.update({ where: { enrollmentId: data.enrollmentId }, data: { ...data, isSubmitted: true } });
    }
    return this.repository.prisma.studentGrade.create({ data: { ...data, isSubmitted: true } });
  }

  async submitSectionGrades(teacherId, sectionId) {
    // Check semester is IN_PROGRESS or GRADING
    const section = await this.repository.prisma.courseSection.findUnique({
      where: { id: sectionId },
      include: { semester: { select: { status: true } } },
    });
    if (section && section.semester?.status !== 'IN_PROGRESS' && section.semester?.status !== 'GRADING') {
      const err = new Error(`Cannot submit grades. Semester status is ${section.semester.status}.`);
      err.status = 403;
      err.semesterStatus = section.semester.status;
      throw err;
    }

    const grades = await this.repository.prisma.studentGrade.findMany({
      where: { enrollment: { courseSectionId: sectionId } },
    });
    for (const g of grades) {
      await this.repository.prisma.studentGrade.update({ where: { enrollmentId: g.enrollmentId }, data: { isSubmitted: true } });
    }
    return { submitted: grades.length };
  }

  async syncAssessmentsToGrades(teacherId, sectionId) {
    // Check semester is IN_PROGRESS or GRADING
    const section = await this.repository.prisma.courseSection.findUnique({
      where: { id: sectionId },
      include: { semester: { select: { status: true } } },
    });
    if (section && section.semester?.status !== 'IN_PROGRESS' && section.semester?.status !== 'GRADING') {
      const err = new Error(`Cannot sync assessments. Semester status is ${section.semester.status}.`);
      err.status = 403;
      err.semesterStatus = section.semester.status;
      throw err;
    }

    return this.calculateAndSaveGrades(sectionId);
  }

  async createExamSchedule(teacherId, body) {
    const schema = z.object({
      courseSectionId: z.string(),
      examType: z.enum(['MIDTERM', 'FINAL']),
      examDate: z.string(), // Teacher picks exact date within admin range
      duration: z.number(),
      location: z.string().optional(),
      isOnline: z.boolean().optional(),
      instructions: z.string().optional(),
      weight: z.number().optional(),
      proposedDate: z.string().optional(),
      proposalDeadline: z.string().optional(),
    });
    const data = schema.parse(body);

    // Verify teacher access to this section
    const section = await this.repository.prisma.courseSection.findFirst({
      where: { id: data.courseSectionId, teacherId },
      include: { course: { select: { id: true } } },
    });
    if (!section) throw AppError.forbidden('forbidden', 'You are not assigned to this course section');

    const teacherDate = new Date(data.examDate);

    // Validate teacher's date is within admin's exam period
    if (section.semesterId) {
      const semester = await this.repository.prisma.semester.findUnique({ where: { id: section.semesterId } });
      if (semester) {
        const rangeStart = data.examType === 'MIDTERM' ? semester.midtermExamStart : semester.finalExamStart;
        const rangeEnd = data.examType === 'MIDTERM' ? semester.midtermExamEnd : semester.finalExamEnd;

        if (rangeStart && rangeEnd) {
          const periodStart = new Date(rangeStart);
          periodStart.setHours(0, 0, 0, 0);
          const periodEnd = new Date(rangeEnd);
          periodEnd.setHours(23, 59, 59, 999);
          const teacherDayStart = new Date(teacherDate);
          teacherDayStart.setHours(0, 0, 0, 0);

          if (teacherDayStart < periodStart || teacherDayStart > periodEnd) {
            throw AppError.badRequest('date_out_of_range',
              `The exam date must be between ${periodStart.toLocaleDateString()} and ${periodEnd.toLocaleDateString()} as set by the admin.`);
          }
        }
      }
    }

    // Check for scheduling conflicts: same semester, same examType, same date, different course
    if (section.semesterId) {
      const conflictingSchedules = await this.repository.prisma.examSchedule.findMany({
        where: {
          examType: data.examType,
          courseSection: { semesterId: section.semesterId },
          officialDate: {
            gte: new Date(teacherDate.getFullYear(), teacherDate.getMonth(), teacherDate.getDate(), 0, 0, 0),
            lt: new Date(teacherDate.getFullYear(), teacherDate.getMonth(), teacherDate.getDate(), 23, 59, 59),
          },
          courseSectionId: { not: data.courseSectionId }, // Exclude own section
        },
        include: {
          courseSection: {
            select: { course: { select: { code: true, title: true } }, teacher: { select: { fullName: true } } },
          },
        },
      });

      if (conflictingSchedules.length > 0) {
        const conflicts = conflictingSchedules.map(s =>
          `${s.courseSection.course.code} - ${s.courseSection.course.title} (${s.courseSection.teacher.fullName})`
        ).join(', ');
        throw AppError.badRequest('exam_schedule_conflict',
          `Another exam is already scheduled on this date for: ${conflicts}. Please choose a different date.`);
      }
    }

    const scheduleData = {
      courseSectionId: data.courseSectionId,
      examType: data.examType,
      officialDate: teacherDate, // Teacher's chosen date within admin range
      duration: data.duration,
      location: data.isOnline ? null : (data.location || null),
      isOnline: data.isOnline || false,
      instructions: data.instructions || null,
      weight: data.weight || 30,
      proposedDate: data.proposedDate ? new Date(data.proposedDate) : null,
      proposalDeadline: data.proposalDeadline ? new Date(data.proposalDeadline) : null,
      earlyExamStatus: data.proposedDate ? 'PROPOSED' : 'NONE',
    };

    // Use upsert because of @@unique([courseSectionId, examType])
    return this.repository.prisma.examSchedule.upsert({
      where: { courseSectionId_examType: { courseSectionId: data.courseSectionId, examType: data.examType } },
      create: scheduleData,
      update: {
        officialDate: scheduleData.officialDate,
        duration: scheduleData.duration,
        location: scheduleData.location,
        instructions: scheduleData.instructions,
        weight: scheduleData.weight,
        proposedDate: scheduleData.proposedDate,
        proposalDeadline: scheduleData.proposalDeadline,
        earlyExamStatus: scheduleData.earlyExamStatus,
      },
    });
  }

  async getSectionExamSchedules(sectionId) {
    return this.repository.prisma.examSchedule.findMany({
      where: { courseSectionId: sectionId },
      orderBy: { officialDate: 'asc' },
      include: {
        courseSection: {
          select: { semesterId: true, semester: { select: { midtermExamDate: true, finalExamDate: true } } },
        },
      },
    });
  }

  async updateExamSchedule(id, body) {
    const data = { ...body };
    if (data.officialDate) data.officialDate = new Date(data.officialDate);
    if (data.proposedDate) data.proposedDate = new Date(data.proposedDate);
    return this.repository.prisma.examSchedule.update({ where: { id }, data });
  }

  async deleteExamSchedule(id) {
    await this.repository.prisma.examSchedule.delete({ where: { id } });
  }

  async proposeEarlyExam(scheduleId, teacherId, body) {
    const schema = z.object({ proposedDate: z.string(), proposalDeadline: z.string().optional() });
    const data = schema.parse(body);
    return this.repository.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { proposedDate: new Date(data.proposedDate), earlyExamStatus: 'PROPOSED', proposalDeadline: data.proposalDeadline ? new Date(data.proposalDeadline) : null },
    });
  }

  async cancelEarlyExamProposal(scheduleId) {
    return this.repository.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { proposedDate: null, earlyExamStatus: 'NONE', proposalDeadline: null },
    });
  }

  async getEarlyExamResponses(scheduleId) {
    return this.repository.prisma.earlyExamRequest.findMany({ where: { examScheduleId: scheduleId }, include: { student: { select: { id: true, fullName: true, email: true } } } });
  }

  async confirmEarlyExam(scheduleId) {
    const schedule = await this.repository.prisma.examSchedule.findUnique({ where: { id: scheduleId } });
    this.throwUnless(schedule?.proposedDate, 400, 'no_proposal', 'No early exam proposal');
    return this.repository.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { confirmedDate: schedule.proposedDate, earlyExamStatus: 'APPROVED' },
    });
  }

  // Admin extended routes
  async getSemestersAddDrop() {
    return this.repository.prisma.semester.findMany({
      where: { OR: [{ addDropStart: { not: null } }, { addDropEnd: { not: null } }] },
      include: { academicYear: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async updateSemesterAddDrop(semesterId, body) {
    const data = {};
    if (body.addDropStart) data.addDropStart = new Date(body.addDropStart);
    if (body.addDropEnd) data.addDropEnd = new Date(body.addDropEnd);
    return this.repository.prisma.semester.update({ where: { id: semesterId }, data });
  }

  async setRegistrationFee(semesterId, registrationFee) {
    return this.repository.prisma.semester.update({ where: { id: semesterId }, data: { registrationFee } });
  }

  async getSemesterPayments(semesterId) {
    return this.repository.prisma.payment.findMany({ where: { semesterId }, include: { student: { select: { id: true, fullName: true, email: true } } } });
  }

  async getAuditLogs(query = {}) {
    const where = {};
    if (query.category) where.category = query.category;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate + 'T23:59:59');
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 30;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.repository.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.repository.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, totalPages: Math.ceil(total / limit) };
  }

  async getEnrollments(query = {}) {
    const where = {};
    if (query.semesterId) where.courseSection = { semesterId: query.semesterId };
    if (query.studentId) where.studentId = query.studentId;
    return this.repository.prisma.studentEnrollment.findMany({
      where,
      include: { student: { select: { id: true, fullName: true, email: true } }, courseSection: { include: { course: true } } },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async removeEnrollment(enrollmentId) {
    await this.repository.prisma.studentEnrollment.delete({ where: { id: enrollmentId } });
  }

  async getCurrentSemester() {
    return this.repository.prisma.semester.findFirst({ where: { isCurrent: true }, include: { academicYear: true } });
  }

  async publishSemesterGrades(semesterId) {
    const grades = await this.repository.prisma.studentGrade.findMany({
      where: { enrollment: { courseSection: { semesterId } }, isSubmitted: true },
    });
    let published = 0;
    for (const g of grades) {
      await this.repository.prisma.studentGrade.update({ where: { enrollmentId: g.enrollmentId }, data: { isPublished: true } });
      published++;
    }
    return { published };
  }

  async getSemesterGPAReport(semesterId) {
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { courseSection: { semesterId }, status: 'ENROLLED' },
      include: { student: { select: { id: true, fullName: true, email: true } }, grade: true, courseSection: { include: { course: true } } },
    });
    return enrollments.filter(e => e.grade?.isPublished);
  }

  async getAdminResults(query = {}) {
    const where = { status: 'ENROLLED' };
    if (query.semesterId) where.courseSection = { semesterId: query.semesterId };
    if (query.sectionId) where.courseSectionId = query.sectionId;
    if (query.studentId) where.studentId = query.studentId;

    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, email: true, profileImage: true } },
        courseSection: {
          include: {
            course: true,
            teacher: { select: { id: true, fullName: true } },
            class: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
      orderBy: { student: { fullName: 'asc' } },
    });

    return enrollments;
  }

  // Weekly Schedule methods
  async getMyWeeklySchedule(studentId) {
    // Get current semester
    const currentSemester = await this.repository.prisma.semester.findFirst({
      where: { isCurrent: true },
    });

    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: {
        studentId,
        status: 'ENROLLED',
        courseSection: { semesterId: currentSemester?.id },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            teacher: { select: { id: true, fullName: true } },
            class: true,
            scheduleSlots: true,
          },
        },
      },
    });

    // Flatten schedule slots
    const schedule = [];
    for (const enrollment of enrollments) {
      const section = enrollment.courseSection;
      if (section.scheduleSlots && section.scheduleSlots.length > 0) {
        for (const slot of section.scheduleSlots) {
          schedule.push({
            id: slot.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            isOnline: slot.isOnline,
            courseCode: section.course.code,
            courseTitle: section.course.title,
            sectionCode: section.sectionCode,
            teacherName: section.teacher?.fullName,
            className: section.class?.name,
          });
        }
      } else {
        // Fallback to legacy schedule string if no slots
        schedule.push({
          id: `legacy-${section.id}`,
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          room: section.room,
          isOnline: section.deliveryMode === 'ONLINE',
          courseCode: section.course.code,
          courseTitle: section.course.title,
          sectionCode: section.sectionCode,
          teacherName: section.teacher?.fullName,
          className: section.class?.name,
          legacySchedule: section.schedule,
        });
      }
    }

    // Sort by day of week and time
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    schedule.sort((a, b) => {
      if (a.dayOfWeek && b.dayOfWeek) {
        const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.startTime?.localeCompare(b.startTime);
      }
      return 0;
    });

    return { semester: currentSemester, schedule };
  }

  async getTeacherWeeklySchedule(teacherId) {
    const currentSemester = await this.repository.prisma.semester.findFirst({
      where: { isCurrent: true },
    });

    const sections = await this.repository.prisma.courseSection.findMany({
      where: {
        teacherId,
        semesterId: currentSemester?.id,
      },
      include: {
        course: true,
        class: true,
        scheduleSlots: true,
      },
    });

    const schedule = [];
    for (const section of sections) {
      if (section.scheduleSlots && section.scheduleSlots.length > 0) {
        for (const slot of section.scheduleSlots) {
          schedule.push({
            id: slot.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            isOnline: slot.isOnline,
            courseCode: section.course.code,
            courseTitle: section.course.title,
            sectionCode: section.sectionCode,
            className: section.class?.name,
          });
        }
      } else {
        schedule.push({
          id: `legacy-${section.id}`,
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          room: section.room,
          isOnline: section.deliveryMode === 'ONLINE',
          courseCode: section.course.code,
          courseTitle: section.course.title,
          sectionCode: section.sectionCode,
          className: section.class?.name,
          legacySchedule: section.schedule,
        });
      }
    }

    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    schedule.sort((a, b) => {
      if (a.dayOfWeek && b.dayOfWeek) {
        const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.startTime?.localeCompare(b.startTime);
      }
      return 0;
    });

    return { semester: currentSemester, schedule };
  }

  async createScheduleSlot(user, sectionId, body) {
    const schema = z.object({
      dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
      startTime: z.string(), // "14:30"
      endTime: z.string(),   // "16:30"
      room: z.string().nullable().optional(),
      isOnline: z.boolean().default(false),
    });
    const data = schema.parse(body);

    const slot = await this.repository.prisma.courseScheduleSlot.upsert({
      where: {
        courseSectionId_dayOfWeek_startTime: {
          courseSectionId: sectionId,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
        },
      },
      update: {
        endTime: data.endTime,
        room: data.isOnline ? null : data.room,
        isOnline: data.isOnline,
      },
      create: {
        courseSection: { connect: { id: sectionId } },
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.isOnline ? null : data.room,
        isOnline: data.isOnline,
      },
    });

    await AuditLogger.log({
      action: 'CREATE',
      category: 'COURSE',
      userId: user.id,
      targetId: slot.id,
      description: `Schedule slot created for section ${sectionId}`,
    });

    return slot;
  }

  async deleteScheduleSlot(user, slotId) {
    await this.repository.prisma.courseScheduleSlot.delete({ where: { id: slotId } });
    await AuditLogger.log({
      action: 'DELETE',
      category: 'COURSE',
      userId: user.id,
      targetId: slotId,
      description: `Schedule slot deleted`,
    });
  }

  async getTranscript(studentId) {
    const student = await this.repository.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: true,
        classStudents: { include: { class: { include: { department: true } } } },
      },
    });
    this.throwUnless(student, 404, 'not_found', 'Student not found');

    // Get department from student's first class
    const firstClass = student.classStudents?.[0]?.class;
    const department = firstClass?.department || null;

    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: {
        studentId,
        grade: { isPublished: true },
      },
      include: {
        courseSection: {
          include: {
            course: true,
            semester: { include: { academicYear: true } },
          },
        },
        grade: true,
      },
      orderBy: { courseSection: { semester: { startDate: 'asc' } } },
    });

    const semesterMap = {};
    for (const e of enrollments) {
      const semKey = e.courseSection.semesterId;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = { semester: e.courseSection.semester, courses: [], points: 0, credits: 0, gpa: 0 };
      }
      semesterMap[semKey].courses.push({
        id: e.id,
        course: e.courseSection.course,
        creditHours: e.courseSection.course.creditHours,
        grade: e.grade,
      });
      if (e.grade?.gradePoint !== null && e.grade?.gradePoint !== undefined) {
        const credits = e.courseSection.course.creditHours;
        semesterMap[semKey].points += e.grade.gradePoint * credits;
        semesterMap[semKey].credits += credits;
      }
    }

    let totalPoints = 0, totalCredits = 0;
    for (const key of Object.keys(semesterMap)) {
      const sr = semesterMap[key];
      sr.gpa = sr.credits > 0 ? sr.points / sr.credits : 0;
      totalPoints += sr.points;
      totalCredits += sr.credits;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        studentId: student.studentProfile?.nationalIdFan || student.id,
        department,
      },
      semesters: Object.values(semesterMap).sort((a, b) =>
        new Date(a.semester.startDate).getTime() - new Date(b.semester.startDate).getTime()
      ),
      cgpa,
      totalCredits,
      totalCourses: enrollments.length,
    };
  }
}
