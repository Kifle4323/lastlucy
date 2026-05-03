import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getStudentTranscript } from '../api';
import Layout from '../components/Layout';
import { Printer, ArrowLeft, FileText, Download } from 'lucide-react';
import lucyLogo from '../assets/lucy_logobg.png';

export default function TranscriptPage() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const transcriptRef = useRef(null);

  const isAdmin = searchParams.get('admin') === '1';

  useEffect(() => {
    loadTranscript();
  }, [studentId]);

  async function loadTranscript() {
    try {
      const data = await getStudentTranscript(studentId);
      setTranscript(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    const printContent = transcriptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transcript - ${transcript?.student?.fullName || 'Student'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #fff; }
          .transcript { max-width: 210mm; margin: 0 auto; padding: 15mm; }
          .header { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 8mm; margin-bottom: 8mm; }
          .institution { font-size: 16pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
          .doc-title { font-size: 12pt; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; margin-top: 3mm; color: #444; }
          .student-info { display: flex; justify-content: space-between; margin-bottom: 6mm; font-size: 9pt; border-bottom: 1px solid #ddd; padding-bottom: 4mm; }
          .student-info div { line-height: 1.6; }
          .student-info .label { color: #666; }
          .student-info .value { font-weight: 600; }
          .semester-block { margin-bottom: 6mm; }
          .semester-header { background: #1a1a1a; color: white; padding: 2mm 4mm; font-size: 9pt; font-weight: 600; display: flex; justify-content: space-between; }
          .semester-header .gpa { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
          th { background: #f5f5f5; text-align: left; padding: 2mm 3mm; font-weight: 600; border-bottom: 1px solid #ddd; }
          th.center, td.center { text-align: center; }
          td { padding: 2mm 3mm; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: 1px solid #ddd; }
          .grade-letter { display: inline-block; min-width: 24px; text-align: center; font-weight: 700; }
          .summary { margin-top: 8mm; border-top: 2px solid #1a1a1a; padding-top: 4mm; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; text-align: center; margin-bottom: 6mm; }
          .summary-item .value { font-size: 16pt; font-weight: 700; color: #1a1a1a; }
          .summary-item .label { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .grading-scale { font-size: 7.5pt; color: #666; margin-top: 4mm; }
          .grading-scale .title { font-weight: 600; margin-bottom: 1mm; }
          .grading-scale .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1mm; }
          .footer { margin-top: 8mm; display: flex; justify-content: space-between; font-size: 7pt; color: #999; border-top: 1px solid #ddd; padding-top: 3mm; }
          .signatures { margin-top: 10mm; display: flex; justify-content: space-between; }
          .sig-block { width: 35%; text-align: center; }
          .sig-line { border-bottom: 1px solid #999; margin-bottom: 2mm; height: 10mm; }
          .sig-label { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72pt; color: rgba(0,0,0,0.02); font-weight: 900; letter-spacing: 8px; pointer-events: none; white-space: nowrap; z-index: -1; }
          @media print {
            @page { size: A4; margin: 10mm; }
            body { background: white; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="watermark">LUCY LMS</div>
        ${printContent.innerHTML}
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (loading) return <Layout><div className="p-8">{t('common.loading')}</div></Layout>;
  if (error) return <Layout><div className="p-8 text-red-600">{error}</div></Layout>;
  if (!transcript) return <Layout><div className="p-8">{t('results.transcript')} {t('common.notFound')}</div></Layout>;

  const { student, semesters, cgpa, totalCredits, totalCourses } = transcript;
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 no-print">
          <Link
            to={isAdmin ? '/admin/results' : '/student/results'}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')} {t('nav.results')}
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm"
            >
              <Printer className="w-4 h-4" />
              {t('results.printReport')}
            </button>
          </div>
        </div>

        {/* Transcript Document */}
        <div ref={transcriptRef} className="bg-white dark:bg-gray-50 shadow-2xl rounded-lg overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="p-8 sm:p-12">
            {/* Header */}
            <div className="text-center border-b-4 border-double border-gray-900 pb-6 mb-6">
              <img src={lucyLogo} alt="Lucy College" className="w-16 h-16 mx-auto mb-2 object-contain" />
              <div className="text-lg font-bold tracking-widest uppercase">Lucy College</div>
              <div className="text-sm font-semibold tracking-[3px] uppercase mt-1 text-gray-500">
                {t('results.officialTranscript')}
              </div>
            </div>

            {/* Student Info */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm border-b border-gray-300 pb-4 mb-6">
              <div>
                <span className="text-gray-500">{t('results.studentName')}: </span>
                <span className="font-semibold">{student?.fullName}</span>
                <br />
                <span className="text-gray-500">{t('results.studentId')}: </span>
                <span className="font-semibold">{student?.studentId || student?.id?.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="text-right">
                {student?.department && (
                  <>
                    <span className="text-gray-500">{t('course.department')}: </span>
                    <span className="font-semibold">{student.department.name} ({student.department.code})</span>
                    <br />
                  </>
                )}
                <span className="text-gray-500">{t('results.dateGenerated')}: </span>
                <span className="font-semibold">{generatedDate}</span>
              </div>
            </div>

            {/* Semester Blocks */}
            {semesters?.map((sem, idx) => (
              <div key={sem.semester.id} className="mb-6">
                {/* Semester Header */}
                <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center text-sm">
                  <span className="font-semibold">{sem.semester.name} — {sem.semester.academicYear?.name}</span>
                  <span className="font-bold">{t('grade.gpa')}: {sem.gpa.toFixed(2)}</span>
                </div>

                {/* Course Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-200">
                      <th className="text-left px-4 py-2 font-semibold">{t('course.code')}</th>
                      <th className="text-left px-4 py-2 font-semibold">{t('course.title')}</th>
                      <th className="text-center px-3 py-2 font-semibold">{t('dashboard.creditHours')}</th>
                      <th className="text-center px-3 py-2 font-semibold">{t('common.total')}</th>
                      <th className="text-center px-3 py-2 font-semibold">{t('grade.grade')}</th>
                      <th className="text-center px-3 py-2 font-semibold">{t('grade.gradePoint')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sem.courses.map(course => (
                      <tr key={course.id} className="border-b border-gray-200">
                        <td className="px-4 py-2 font-medium">{course.course?.code || '-'}</td>
                        <td className="px-4 py-2">{course.course?.title}</td>
                        <td className="text-center px-3 py-2">{course.creditHours}</td>
                        <td className="text-center px-3 py-2 font-semibold">{course.grade?.totalScore ?? '-'}</td>
                        <td className="text-center px-3 py-2">
                          <span className="font-bold">{course.grade?.gradeLetter || '-'}</span>
                        </td>
                        <td className="text-center px-3 py-2">{course.grade?.gradePoint?.toFixed(2) ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-400 bg-gray-50 dark:bg-gray-100 font-semibold">
                      <td colSpan={2} className="px-4 py-2">{t('results.semesterTotal')}</td>
                      <td className="text-center px-3 py-2">{sem.credits}</td>
                      <td className="text-center px-3 py-2"></td>
                      <td className="text-center px-3 py-2"></td>
                      <td className="text-center px-3 py-2">{sem.points.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* Cumulative Summary */}
            <div className="border-t-2 border-gray-900 pt-4 mt-6">
              <div className="text-center font-bold text-lg mb-4 tracking-widest uppercase">{t('results.cumulativeRecord')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-6">
                <div>
                  <div className="text-2xl font-bold">{cgpa?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('grade.cgpa')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalCredits || 0}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('results.totalCredits')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalCourses || 0}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('results.coursesCompleted')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{semesters?.length || 0}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{t('results.semesters')}</div>
                </div>
              </div>

              {/* Grading Scale */}
              <div className="text-xs text-gray-500 mt-4">
                <div className="font-semibold mb-1">{t('results.gradingScale')}</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-0.5">
                  <div>A+ (90-100): 4.0</div>
                  <div>A (85-89): 4.0</div>
                  <div>A- (80-84): 3.75</div>
                  <div>B+ (75-79): 3.5</div>
                  <div>B (70-74): 3.0</div>
                  <div>B- (65-69): 2.75</div>
                  <div>C+ (60-64): 2.5</div>
                  <div>C (50-59): 2.0</div>
                  <div>C- (45-49): 1.75</div>
                  <div>D (40-44): 1.0</div>
                  <div>F (&lt;40): 0.0</div>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-10">
              <div className="w-1/3 text-center">
                <div className="border-b border-gray-400 h-10 mb-2"></div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{t('certificate.academicDirector')}</div>
              </div>
              <div className="w-1/3 text-center">
                <div className="border-b border-gray-400 h-10 mb-2"></div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{t('certificate.registrar')}</div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between text-xs text-gray-400 mt-6 border-t border-gray-200 pt-3">
              <span>{t('results.officialTranscript')} — Lucy College</span>
              <span>{t('results.generated')}: {generatedDate}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
