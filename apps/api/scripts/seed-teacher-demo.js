import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const GRADE_MAP = [
  { min: 90, letter: 'A_PLUS', point: 4.0 },
  { min: 85, letter: 'A', point: 4.0 },
  { min: 80, letter: 'A_MINUS', point: 3.75 },
  { min: 75, letter: 'B_PLUS', point: 3.5 },
  { min: 70, letter: 'B', point: 3.0 },
  { min: 65, letter: 'B_MINUS', point: 2.75 },
  { min: 60, letter: 'C_PLUS', point: 2.5 },
  { min: 50, letter: 'C', point: 2.0 },
  { min: 45, letter: 'C_MINUS', point: 1.75 },
  { min: 40, letter: 'D', point: 1.0 },
  { min: 0, letter: 'F', point: 0.0 },
];

function getGrade(totalScore) {
  for (const g of GRADE_MAP) {
    if (totalScore >= g.min) return g;
  }
  return GRADE_MAP[GRADE_MAP.length - 1];
}

function randomScore(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

async function main() {
  console.log('🌱 Seeding demo data for teacher@lucy.edu...\n');

  // 1. Find or create teacher
  let teacher = await prisma.user.findUnique({ where: { email: 'teacher@lucy.edu' } });
  if (!teacher) {
    const hash = await bcrypt.hash('password123', 10);
    teacher = await prisma.user.create({
      data: { email: 'teacher@lucy.edu', passwordHash: hash, fullName: 'Dr. Alemayehu Bekele', role: 'TEACHER', isApproved: true },
    });
    console.log('✅ Created teacher:', teacher.fullName);
  } else {
    console.log('👤 Found teacher:', teacher.fullName);
  }

  // 2. Find or create department
  let dept = await prisma.department.findFirst({ where: { code: 'CS' } });
  if (!dept) {
    dept = await prisma.department.create({ data: { name: 'Computer Science', code: 'CS', pricePerCreditHour: 500, totalCreditHours: 140, minCreditHoursToGraduate: 120, durationYears: 5 } });
    console.log('✅ Created department:', dept.name);
  }

  // 3. Find or create academic year + semester
  let ay = await prisma.academicYear.findFirst({ where: { name: '2024/2025' } });
  if (!ay) {
    ay = await prisma.academicYear.create({ data: { name: '2024/2025', startDate: new Date('2024-09-01'), endDate: new Date('2025-06-30') } });
    console.log('✅ Created academic year:', ay.name);
  }

  let semester = await prisma.semester.findFirst({ where: { academicYearId: ay.id, type: 'FALL' } });
  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        academicYearId: ay.id, type: 'FALL', name: 'Fall 2024',
        startDate: new Date('2024-09-15'), endDate: new Date('2025-01-30'),
        registrationStart: new Date('2024-09-01'), registrationEnd: new Date('2024-09-14'),
        midtermExamStart: new Date('2024-11-01'), midtermExamEnd: new Date('2024-11-10'),
        finalExamStart: new Date('2025-01-10'), finalExamEnd: new Date('2025-01-25'),
        gradingDeadline: new Date('2025-02-05'),
        status: 'IN_PROGRESS', isCurrent: true,
      },
    });
    console.log('✅ Created semester:', semester.name);
  } else if (semester.status !== 'IN_PROGRESS') {
    semester = await prisma.semester.update({ where: { id: semester.id }, data: { status: 'IN_PROGRESS', isCurrent: true } });
    console.log('🔄 Updated semester status to IN_PROGRESS');
  }

  // 4. Create courses
  const courseDefs = [
    { title: 'Introduction to Programming', code: 'CS101', creditHours: 3, stream: 'Natural Science' },
    { title: 'Data Structures & Algorithms', code: 'CS201', creditHours: 4, stream: 'Natural Science' },
    { title: 'Database Systems', code: 'CS301', creditHours: 3, stream: 'Natural Science' },
    { title: 'Web Development', code: 'CS302', creditHours: 3, stream: 'Natural Science' },
    { title: 'Operating Systems', code: 'CS303', creditHours: 3, stream: 'Natural Science' },
  ];

  const courses = [];
  for (const cd of courseDefs) {
    let c = await prisma.course.findUnique({ where: { code: cd.code } });
    if (!c) {
      c = await prisma.course.create({ data: cd });
      console.log('✅ Created course:', c.code, c.title);
    }
    courses.push(c);
  }

  // 5. Create class
  let cls = await prisma.class.findFirst({ where: { name: 'CS Year 3 Sec A', departmentId: dept.id } });
  if (!cls) {
    cls = await prisma.class.create({ data: { name: 'CS Year 3 Sec A', code: 'CS3A', year: 3, section: 'A', departmentId: dept.id } });
    console.log('✅ Created class:', cls.name);
  }

  // 6. Create course sections for the teacher
  const sections = [];
  for (const course of courses) {
    const sectionCode = `${course.code}-A`;
    let section = await prisma.courseSection.findUnique({
      where: { courseId_semesterId_sectionCode: { courseId: course.id, semesterId: semester.id, sectionCode } },
    });
    if (!section) {
      section = await prisma.courseSection.create({
        data: {
          courseId: course.id, semesterId: semester.id, teacherId: teacher.id,
          classId: cls.id, sectionCode, deliveryMode: 'ONLINE',
          schedule: 'Mon/Wed 9:00-10:30', room: 'Room 201', maxCapacity: 40, isPublished: true,
        },
      });
      console.log('✅ Created section:', sectionCode);
    }
    sections.push(section);
  }

  // 7. Create students (25 students)
  const studentNames = [
    'Abebe Kebede', 'Mekdes Tadesse', 'Yonas Alemu', 'Helen Girma', 'Dawit Amare',
    'Selamawit Desta', 'Bereket Tsegaye', 'Tigist Mulugeta', 'Natnael Assefa', 'Hanna Worku',
    'Yared Bekele', 'Feven Ayele', 'Binyam Gebre', 'Sara Tekle', 'Abel Hailu',
    'Nardos Girma', 'Elias Fikre', 'Lidya Tesfaye', 'Samuel Tadesse', 'Meron Abebe',
    'Isayas Kebede', 'Bethelhem Wondimu', 'Robel Haile', 'Hiwot Demissie', 'Ermias Getachew',
  ];

  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const email = `student${i + 1}@lucy.edu`;
    let student = await prisma.user.findUnique({ where: { email } });
    if (!student) {
      const hash = await bcrypt.hash('password123', 10);
      student = await prisma.user.create({
        data: { email, passwordHash: hash, fullName: studentNames[i], role: 'STUDENT', isApproved: true, isProfileComplete: true },
      });
    }
    students.push(student);

    // Add to class
    await prisma.classStudent.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: student.id } },
      update: {},
      create: { classId: cls.id, studentId: student.id },
    });
  }
  console.log(`✅ Ensured ${students.length} students exist`);

  // 8. Enroll students in sections and create grades
  const weights = { quiz: 15, assignment: 10, midterm: 25, final: 40, attendance: 10 };
  let gradesCreated = 0;

  for (const section of sections) {
    // Create grade components for course
    const existingComponents = await prisma.gradeComponent.findMany({ where: { courseId: section.courseId } });
    if (existingComponents.length === 0) {
      await prisma.gradeComponent.createMany({
        data: [
          { courseId: section.courseId, name: 'Quiz', weight: weights.quiz, sortOrder: 0 },
          { courseId: section.courseId, name: 'Assignment', weight: weights.assignment, sortOrder: 1 },
          { courseId: section.courseId, name: 'Midterm', weight: weights.midterm, sortOrder: 2 },
          { courseId: section.courseId, name: 'Final', weight: weights.final, sortOrder: 3 },
          { courseId: section.courseId, name: 'Attendance', weight: weights.attendance, sortOrder: 4 },
        ],
      });
    }

    for (const student of students) {
      // Enroll
      const enrollment = await prisma.studentEnrollment.upsert({
        where: { courseSectionId_studentId: { courseSectionId: section.id, studentId: student.id } },
        update: {},
        create: { courseSectionId: section.id, studentId: student.id, status: 'ENROLLED' },
      });

      // Generate realistic scores (bell curve around 65-75)
      const quizPct = randomScore(30, 100);
      const assignPct = randomScore(40, 100);
      const midtermPct = randomScore(25, 95);
      const finalPct = randomScore(20, 95);
      const attendPct = randomScore(50, 100);

      const quizScore = Math.round(quizPct * weights.quiz / 100 * 10) / 10;
      const assignmentScore = Math.round(assignPct * weights.assignment / 100 * 10) / 10;
      const midtermScore = Math.round(midtermPct * weights.midterm / 100 * 10) / 10;
      const finalScore = Math.round(finalPct * weights.final / 100 * 10) / 10;
      const attendanceScore = Math.round(attendPct * weights.attendance / 100 * 10) / 10;
      const totalScore = Math.round((quizScore + assignmentScore + midtermScore + finalScore + attendanceScore) * 10) / 10;

      const grade = getGrade(totalScore);

      await prisma.studentGrade.upsert({
        where: { enrollmentId: enrollment.id },
        update: {},
        create: {
          enrollmentId: enrollment.id,
          quizScore, assignmentScore, midtermScore, finalScore, attendanceScore,
          totalScore, gradeLetter: grade.letter, gradePoint: grade.point,
          isSubmitted: true, isPublished: true,
          submittedAt: new Date('2025-01-28'), publishedAt: new Date('2025-01-30'),
        },
      });
      gradesCreated++;

      // Create attendance record
      await prisma.attendance.upsert({
        where: { courseId_studentId: { courseId: section.courseId, studentId: student.id } },
        update: {},
        create: { courseId: section.courseId, studentId: student.id, score: attendPct },
      });
    }

    // Create exam schedules
    const existingExams = await prisma.examSchedule.findMany({ where: { courseSectionId: section.id } });
    if (existingExams.length === 0) {
      await prisma.examSchedule.createMany({
        data: [
          {
            courseSectionId: section.id, examType: 'MIDTERM',
            officialDate: new Date('2024-11-05T10:00:00'), duration: 90,
            location: 'Room 201', isOnline: false,
          },
          {
            courseSectionId: section.id, examType: 'FINAL',
            officialDate: new Date('2025-01-15T14:00:00'), duration: 120,
            location: null, isOnline: true,
          },
        ],
      });
    }
  }
  console.log(`✅ Created ${gradesCreated} grades with attendance`);

  // 9. Create materials
  for (const course of courses) {
    const existingMats = await prisma.material.findMany({ where: { courseId: course.id } });
    if (existingMats.length === 0) {
      await prisma.material.createMany({
        data: [
          { courseId: course.id, createdBy: teacher.id, title: `Lecture 1 - Introduction`, content: 'Introduction to the course' },
          { courseId: course.id, createdBy: teacher.id, title: `Lecture 2 - Core Concepts`, content: 'Core concepts and fundamentals' },
          { courseId: course.id, createdBy: teacher.id, title: `Lecture 3 - Advanced Topics`, content: 'Advanced topics and applications' },
          { courseId: course.id, createdBy: teacher.id, title: `Video Tutorial - Week 1`, content: 'Video tutorial for week 1' },
        ],
      });
    }
  }
  console.log('✅ Created materials for all courses');

  // 10. Create material views (reading progress)
  for (const student of students.slice(0, 15)) {
    const materials = await prisma.material.findMany({ where: { courseId: { in: courses.map(c => c.id) } }, take: 3 });
    for (const mat of materials) {
      await prisma.materialView.create({
        data: { materialId: mat.id, studentId: student.id, durationSec: Math.floor(Math.random() * 600) + 60 },
      }).catch(() => {});
      await prisma.materialReadingProgress.upsert({
        where: { materialId_studentId: { materialId: mat.id, studentId: student.id } },
        update: {},
        create: { materialId: mat.id, studentId: student.id, isCompleted: Math.random() > 0.3 },
      }).catch(() => {});
    }
  }
  console.log('✅ Created material views and reading progress');

  // 11. Create assessments with attempts
  for (const course of courses) {
    const components = await prisma.gradeComponent.findMany({ where: { courseId: course.id } });
    const midtermComp = components.find(c => c.name === 'Midterm');
    const quizComp = components.find(c => c.name === 'Quiz');

    if (midtermComp) {
      const existingAssess = await prisma.assessment.findFirst({ where: { courseId: course.id, componentId: midtermComp.id } });
      if (!existingAssess) {
        const assess = await prisma.assessment.create({
          data: {
            courseId: course.id, componentId: midtermComp.id,
            title: 'Midterm Exam', examType: 'MIDTERM', maxScore: 100,
            isOpen: false,
            questions: {
              create: [
                { type: 'SHORT_ANSWER', prompt: 'Explain the fundamental concepts discussed in class.', points: 50, modelAnswer: 'Key concepts include abstraction, encapsulation, and modularity.' },
                { type: 'SHORT_ANSWER', prompt: 'Solve the following problem step by step.', points: 50, modelAnswer: 'Step-by-step solution provided.' },
              ],
            },
          },
        });

        // Create attempts for some students
        for (const student of students.slice(0, 18)) {
          const score = randomScore(30, 95);
          await prisma.attempt.create({
            data: {
              assessmentId: assess.id, studentId: student.id, status: 'GRADED',
              score, startedAt: new Date('2024-11-05T10:00:00'), submittedAt: new Date('2024-11-05T11:30:00'),
            },
          });
        }
      }
    }

    if (quizComp) {
      const existingQuiz = await prisma.assessment.findFirst({ where: { courseId: course.id, componentId: quizComp.id } });
      if (!existingQuiz) {
        const quiz = await prisma.assessment.create({
          data: {
            courseId: course.id, componentId: quizComp.id,
            title: 'Quiz 1', examType: 'QUIZ', maxScore: 100,
            isOpen: true,
            questions: {
              create: [
                { type: 'MCQ', prompt: 'What is the main concept?', points: 25, optionA: 'Abstraction', optionB: 'Compilation', optionC: 'Execution', optionD: 'None', correct: 'A' },
                { type: 'MCQ', prompt: 'Which statement is correct?', points: 25, optionA: 'Option A', optionB: 'Encapsulation', optionC: 'Option C', optionD: 'Option D', correct: 'B' },
                { type: 'MCQ', prompt: 'Select the best answer.', points: 25, optionA: 'Option A', optionB: 'Option B', optionC: 'Polymorphism', optionD: 'Option D', correct: 'C' },
                { type: 'MCQ', prompt: 'What does this concept mean?', points: 25, optionA: 'Option A', optionB: 'Option B', optionC: 'Option C', optionD: 'Inheritance', correct: 'D' },
              ],
            },
          },
        });

        for (const student of students.slice(0, 20)) {
          const score = randomScore(40, 100);
          await prisma.attempt.create({
            data: {
              assessmentId: quiz.id, studentId: student.id, status: 'GRADED',
              score, startedAt: new Date('2024-10-15T09:00:00'), submittedAt: new Date('2024-10-15T09:30:00'),
            },
          });
        }
      }
    }
  }
  console.log('✅ Created assessments with attempts');

  // 12. Create live sessions (some active)
  for (const section of sections.slice(0, 3)) {
    const existingLive = await prisma.liveSession.findMany({ where: { courseId: section.courseId, classId: cls.id } });
    if (existingLive.length === 0) {
      await prisma.liveSession.createMany({
        data: [
          { courseId: section.courseId, classId: cls.id, teacherId: teacher.id, title: 'Week 1 Live Lecture', scheduledAt: new Date('2024-09-16T09:00:00'), duration: 90, status: 'ENDED', meetingUrl: `https://meet.jit.si/lucy-${section.sectionCode}-w1` },
          { courseId: section.courseId, classId: cls.id, teacherId: teacher.id, title: 'Week 2 Live Lecture', scheduledAt: new Date('2024-09-23T09:00:00'), duration: 90, status: 'ENDED', meetingUrl: `https://meet.jit.si/lucy-${section.sectionCode}-w2` },
          { courseId: section.courseId, classId: cls.id, teacherId: teacher.id, title: 'Live Review Session', scheduledAt: new Date(), duration: 60, status: 'LIVE', meetingUrl: `https://meet.jit.si/lucy-${section.sectionCode}-review` },
        ],
      });
    }
  }
  console.log('✅ Created live sessions');

  // 13. Create manual attendance sessions
  for (const section of sections.slice(0, 3)) {
    const existingManual = await prisma.manualAttendanceSession.findMany({ where: { courseId: section.courseId, classId: cls.id } });
    if (existingManual.length === 0) {
      for (let w = 1; w <= 5; w++) {
        const session = await prisma.manualAttendanceSession.create({
          data: {
            courseId: section.courseId, classId: cls.id, teacherId: teacher.id,
            title: `Week ${w} Face-to-Face`, date: new Date(2024, 8, 10 + (w - 1) * 7), // Sep 10, 17, 24, Oct 1, 8
          },
        });
        // Create records for students
        for (const student of students) {
          const status = Math.random() > 0.15 ? 'PRESENT' : (Math.random() > 0.5 ? 'LATE' : 'ABSENT');
          await prisma.manualAttendanceRecord.create({
            data: { sessionId: session.id, studentId: student.id, status },
          });
        }
      }
    }
  }
  console.log('✅ Created manual attendance sessions with records');

  console.log('\n🎉 Demo data seeding complete! Dashboard should now show rich analytics.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
