import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check if notifications already exist for students
  const existingCount = await prisma.notification.count({ where: { user: { role: 'STUDENT' } } });
  if (existingCount > 0) {
    console.log(`Students already have ${existingCount} notifications. Skipping.`);
    return;
  }

  const allStudents = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
  const currentSem = await prisma.semester.findFirst({ where: { isCurrent: true } });

  const notifTypes = [
    { type: 'GRADE_PUBLISHED', title: 'Grades Published', message: `Your grades for ${currentSem?.name || 'this semester'} have been published. Check your results now.` },
    { type: 'NEW_ASSESSMENT', title: 'New Assessment', message: 'A new assessment has been created for your course. Check your classes for details.' },
    { type: 'REGISTRATION_OPEN', title: 'Registration Open', message: 'Course registration is now open for the upcoming semester. Register now to secure your spot.' },
    { type: 'ASSESSMENT_CREATED', title: 'Assessment Created', message: 'A new online exam has been scheduled. Check your course page for details.' },
  ];

  let notifCount = 0;
  for (const student of allStudents) {
    const numNotifs = 1 + Math.floor(Math.random() * 3);
    const selected = notifTypes.sort(() => Math.random() - 0.5).slice(0, numNotifs);
    for (const notif of selected) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: Math.random() < 0.3,
        },
      });
      notifCount++;
    }
  }
  console.log(`Created ${notifCount} student notifications for ${allStudents.length} students`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
