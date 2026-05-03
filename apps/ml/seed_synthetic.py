
import os, sys, random, math
import psycopg2

# Load DB URL from api/.env
env_path = os.path.join(os.path.dirname(__file__), '..', 'api', '.env')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip('"').strip("'")
            break

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in api/.env"); sys.exit(1)

GRADE_SCALE = [
    (90, 'A_PLUS', 4.0), (85, 'A', 4.0), (80, 'A_MINUS', 3.75),
    (75, 'B_PLUS', 3.5), (70, 'B', 3.0), (65, 'B_MINUS', 2.75),
    (60, 'C_PLUS', 2.5), (55, 'C', 2.0), (50, 'C_MINUS', 1.75),
    (45, 'D', 1.0), (0, 'F', 0.0),
]

def grade_letter_and_point(score):
    for threshold, letter, point in GRADE_SCALE:
        if score >= threshold:
            return letter, point
    return 'F', 0.0

def generate_performance(delivery_mode):
    is_online = delivery_mode == 'ONLINE'
    # Realistic distributions
    attendance = max(0, min(100, random.gauss(78 if not is_online else 70, 16)))
    video_watch = max(0, min(1, random.gauss(0.55 if is_online else 0.3, 0.2)))
    ppt_progress = max(0, min(1, random.gauss(0.65, 0.2)))
    participation = max(0, min(1, random.gauss(0.6 if not is_online else 0.5, 0.2)))
    has_video = random.random() < (0.6 if is_online else 0.3)
    has_ppt = random.random() < 0.7

    quiz_score = max(0, min(100, random.gauss(40 + attendance * 0.3 + participation * 20, 12)))
    assignment_score = max(0, min(100, random.gauss(35 + ppt_progress * 30 + participation * 15, 14)))
    final_score = max(0, min(100, random.gauss(
        attendance * 0.15 + quiz_score * 0.25 + assignment_score * 0.25 +
        video_watch * 15 + ppt_progress * 10 + participation * 10, 10)))
    pass_flag = final_score >= 50

    return {
        'attendance': round(attendance, 1),
        'quiz_score': round(quiz_score, 1),
        'assignment_score': round(assignment_score, 1),
        'final_score': round(final_score, 1),
        'pass': pass_flag,
        'video_watch': round(video_watch, 3),
        'ppt_progress': round(ppt_progress, 3),
        'participation': round(participation, 3),
        'has_video': has_video,
        'has_ppt': has_ppt,
    }

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Get existing enrollments that DON'T already have grades
        cur.execute("""
            SELECT se.id, se."courseSectionId", se."studentId", cs."courseId", cs."deliveryMode"
            FROM "StudentEnrollment" se
            JOIN "CourseSection" cs ON se."courseSectionId" = cs.id
            LEFT JOIN "StudentGrade" sg ON sg."enrollmentId" = se.id
            WHERE se.status = 'ENROLLED' AND sg.id IS NULL
        """)
        enrollments = cur.fetchall()
        if not enrollments:
            print("No enrollments without grades found. Creating synthetic enrollments...")

            # Need at least some courses, sections, and students
            cur.execute("""SELECT id FROM "User" WHERE role = 'STUDENT' LIMIT 50""")
            students = [r[0] for r in cur.fetchall()]
            cur.execute("""SELECT id FROM "CourseSection" LIMIT 20""")
            sections = [r[0] for r in cur.fetchall()]

            if not students or not sections:
                print("ERROR: No students or course sections in DB. Please add some first."); sys.exit(1)

            # Create synthetic enrollments
            enrollment_count = 0
            for section_id in sections:
                # Get section info
                cur.execute("""SELECT "courseId", "deliveryMode" FROM "CourseSection" WHERE id = %s""", (section_id,))
                row = cur.fetchone()
                if not row: continue
                course_id, delivery_mode = row

                # Enroll random subset of students
                num_students = min(random.randint(15, 35), len(students))
                selected = random.sample(students, num_students)
                for student_id in selected:
                    # Check if already enrolled
                    cur.execute("""SELECT id FROM "StudentEnrollment" WHERE "courseSectionId" = %s AND "studentId" = %s""",
                               (section_id, student_id))
                    if cur.fetchone(): continue

                    cur.execute("""INSERT INTO "StudentEnrollment" ("id", "courseSectionId", "studentId", "enrolledAt", "status")
                                  VALUES (gen_random_uuid(), %s, %s, NOW(), 'ENROLLED') RETURNING id""",
                               (section_id, student_id))
                    enrollment_id = cur.fetchone()[0]
                    enrollments.append((enrollment_id, section_id, student_id, course_id, delivery_mode))
                    enrollment_count += 1

            print(f"Created {enrollment_count} synthetic enrollments")

        if not enrollments:
            print("No enrollments available. Exiting."); sys.exit(1)

        print(f"Found {len(enrollments)} enrollments to populate with grades")

        # Insert grades, attendance, and engagement data
        grades_created = 0
        attendance_created = 0

        for enrollment_id, section_id, student_id, course_id, delivery_mode in enrollments:
            perf = generate_performance(delivery_mode)
            gl, gp = grade_letter_and_point(perf['final_score'])

            # Insert StudentGrade
            cur.execute("""
                INSERT INTO "StudentGrade" (id, "enrollmentId", "quizScore", "assignmentScore",
                    "midtermScore", "finalScore", "attendanceScore", "totalScore",
                    "gradeLetter", "gradePoint", "isSubmitted", "isPublished",
                    "submittedAt", "publishedAt", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, true, true, NOW(), NOW(), NOW(), NOW())
            """, (enrollment_id, perf['quiz_score'], perf['assignment_score'],
                  round(random.gauss(50, 15), 1) if perf['pass'] else round(random.gauss(35, 12), 1),
                  perf['final_score'], perf['attendance'], perf['final_score'],
                  gl, gp))
            grades_created += 1

            # Insert Attendance (only if not exists)
            cur.execute("""SELECT id FROM "Attendance" WHERE "courseId" = %s AND "studentId" = %s""",
                       (course_id, student_id))
            if not cur.fetchone():
                cur.execute("""
                    INSERT INTO "Attendance" (id, "courseId", "studentId", score, "createdAt", "updatedAt")
                    VALUES (gen_random_uuid(), %s, %s, %s, NOW(), NOW())
                """, (course_id, student_id, int(perf['attendance'])))
                attendance_created += 1

            # Insert MaterialView (video engagement)
            if perf['has_video']:
                cur.execute("""
                    SELECT m.id FROM "Material" m WHERE m."courseId" = %s AND (m.type = 'VIDEO' OR m."htmlContent" IS NOT NULL) LIMIT 1
                """, (course_id,))
                mat = cur.fetchone()
                if mat:
                    cur.execute("""
                        INSERT INTO "MaterialView" (id, "materialId", "studentId", "openedAt", "closedAt", "durationSec", "createdAt", "updatedAt")
                        VALUES (gen_random_uuid(), %s, %s, NOW(), NOW(), %s, NOW(), NOW())
                    """, (mat[0], student_id, int(perf['video_watch'] * 3600)))

            # Insert MaterialReadingProgress (PPT engagement)
            if perf['has_ppt']:
                cur.execute("""
                    SELECT m.id FROM "Material" m WHERE m."courseId" = %s AND m."htmlContent" IS NOT NULL LIMIT 1
                """, (course_id,))
                mat = cur.fetchone()
                if mat:
                    total_slides = random.randint(10, 30)
                    completed = int(total_slides * perf['ppt_progress'])
                    cur.execute("""
                        INSERT INTO "MaterialReadingProgress" (id, "materialId", "studentId",
                            "totalTime", "completedSlides", "totalSlides", "isCompleted", "lastReadAt", "createdAt", "updatedAt")
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())
                    """, (mat[0], student_id, int(perf['ppt_progress'] * 7200),
                          completed, total_slides, completed == total_slides))

        conn.commit()
        print(f"\nDone! Created:")
        print(f"  - {grades_created} student grades")
        print(f"  - {attendance_created} attendance records")
        print(f"  - Material views and reading progress for engagement tracking")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
