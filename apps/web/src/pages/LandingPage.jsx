import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicAnalytics } from '../api';
import logo from '../assets/lucy_logobg.png';
import {
  GraduationCap, BookOpen, Users, Brain, ShieldCheck, Video,
  ClipboardList, BarChart3, ArrowRight, MonitorSmartphone,
  FileText, CalendarClock, Sparkles, Award, Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';

const BLUE = { deep: '#1e3a5f', primary: '#2563eb', light: '#3b82f6', pale: '#dbeafe' };
const GOLD = { deep: '#b8860b', primary: '#d4a017', light: '#f59e0b', pale: '#fef3c7' };
const COLORS = ['#2563eb', '#d4a017', '#3b82f6', '#f59e0b', '#1e3a5f', '#b8860b', '#60a5fa'];

function AnimatedCounter({ target, duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        let s = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
          s += step;
          if (s >= target) { setCount(target); clearInterval(timer); } else setCount(Math.floor(s));
        }, 16);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function StatCounter({ icon: Icon, value, label, bg }) {
  return (
    <div className="flex flex-col items-center p-4 text-center">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${bg}`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <p className="text-3xl font-bold text-white"><AnimatedCounter target={value} /></p>
      <p className="text-blue-200 text-xs mt-1">{label}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, #2563eb, #1e3a5f)' }}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({ num, title, desc, icon: Icon }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 border-blue-600 bg-blue-50">
          <Icon className="w-9 h-9 text-blue-600" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: GOLD.primary }}>{num}</div>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm max-w-xs">{desc}</p>
    </div>
  );
}

const GL = { A_PLUS:'A+', A:'A', A_MINUS:'A-', B_PLUS:'B+', B:'B', B_MINUS:'B-', C_PLUS:'C+', C:'C', C_MINUS:'C-', D:'D', F:'F' };

export default function LandingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicAnalytics().then(d => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  const d = data || {};
  const gradeData = Object.entries(d.gradeDistribution || {}).map(([l, c]) => ({ name: GL[l]||l, value: c }));
  const roleData = [{ name:'Students', value: d.totalStudents||0 }, { name:'Teachers', value: d.totalTeachers||0 }].filter(r=>r.value>0);
  const deptData = (d.deptData||[]).map(dep => ({ name: dep.code||dep.name?.substring(0,6), students: dep.students }));
  const monthlyData = (d.monthlyRegistrations||[]).map(m => ({ month: m.month?.substring(5)||'', Students: m.students, Teachers: m.teachers }));

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Lucy LMS" className="h-10 w-auto" />
            <span className="text-xl font-bold" style={{ color: BLUE.deep }}>Lucy College</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium px-5 py-2 rounded-lg border-2" style={{ borderColor: BLUE.primary, color: BLUE.primary }}>Login</Link>
            <Link to="/register" className="text-sm font-medium px-5 py-2 rounded-lg text-white" style={{ background: GOLD.primary }}>Register</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-24 pb-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${BLUE.deep} 0%, ${BLUE.primary} 50%, #1a4f8a 100%)` }}>
        <div className="absolute top-10 right-10 w-72 h-72 rounded-full opacity-10" style={{ background: GOLD.primary }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-5 bg-white" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ background: 'rgba(212,160,23,0.2)', color: GOLD.light }}>
            <Sparkles className="w-4 h-4" /> AI-Powered Learning Management System
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Transform Education<br /><span style={{ color: GOLD.primary }}>with Intelligence</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Lucy College delivers a next-generation LMS combining smart gradebooks, AI performance prediction,
            live virtual classrooms, and automated exam proctoring — all in one unified platform.
          </p>
          <div className="flex items-center justify-center gap-4 mb-14">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg shadow-lg"
              style={{ background: GOLD.primary }}>Get Started <ArrowRight className="w-5 h-5" /></Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg border-2 text-white hover:bg-white/10"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}>Sign In</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <StatCounter icon={Users} value={d.totalStudents||0} label="Students" bg="bg-blue-500" />
            <StatCounter icon={GraduationCap} value={d.totalTeachers||0} label="Teachers" bg="bg-yellow-600" />
            <StatCounter icon={BookOpen} value={d.totalCourses||0} label="Courses" bg="bg-blue-700" />
            <StatCounter icon={Brain} value={d.totalAttempts||0} label="AI Predictions" bg="bg-amber-500" />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ background: GOLD.pale, color: GOLD.deep }}>About Our College</div>
              <h2 className="text-4xl font-extrabold mb-6" style={{ color: BLUE.deep }}>
                Lucy College —<br />Where Innovation Meets Education
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Lucy College is a premier institution dedicated to academic excellence and technological innovation.
                Our LMS is purpose-built to deliver a seamless, data-driven educational experience for students, teachers, and administrators.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                From AI-powered performance prediction that identifies at-risk students before they fall behind,
                to smart gradebooks that auto-calculate weighted scores, Lucy College ensures every learner
                gets the personalized support they need to succeed.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                With real-time attendance tracking, live virtual classrooms, exam proctoring with face verification,
                and comprehensive transcript generation — Lucy College is redefining what a modern institution looks like.
              </p>
              <div className="flex gap-8">
                <div className="text-center"><p className="text-3xl font-bold" style={{ color: BLUE.primary }}><AnimatedCounter target={d.totalEnrollments||0} /></p><p className="text-xs text-gray-500">Enrollments</p></div>
                <div className="text-center"><p className="text-3xl font-bold" style={{ color: GOLD.primary }}><AnimatedCounter target={d.totalLiveSessions||0} /></p><p className="text-xs text-gray-500">Live Sessions</p></div>
                <div className="text-center"><p className="text-3xl font-bold" style={{ color: BLUE.primary }}><AnimatedCounter target={d.totalGrades||0} /></p><p className="text-xs text-gray-500">Grades Published</p></div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl border-4" style={{ borderColor: GOLD.primary }}>
                <img src={logo} alt="Lucy College" className="w-full h-80 object-contain p-8" style={{ background: BLUE.deep }} />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-xl flex items-center justify-center shadow-lg" style={{ background: GOLD.primary }}>
                <Award className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, white 100%)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: BLUE.pale, color: BLUE.primary }}>Platform Features</div>
            <h2 className="text-4xl font-extrabold" style={{ color: BLUE.deep }}>Everything You Need in One Platform</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">A comprehensive suite of tools designed for modern educational institutions</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard icon={Brain} title="AI Performance Prediction" desc="ML models predict student pass probability and dropout risk, enabling early intervention for at-risk students." />
            <FeatureCard icon={ClipboardList} title="Smart Gradebook" desc="Auto-calculated weighted scores from quizzes, midterms, finals, and attendance. One-click grade submission and publishing." />
            <FeatureCard icon={Video} title="Live Virtual Classrooms" desc="Integrated Jitsi video conferencing with attendance tracking, screen sharing, and real-time interaction." />
            <FeatureCard icon={ShieldCheck} title="Exam Proctoring" desc="AI-powered face verification during exams ensures academic integrity with real-time identity confirmation." />
            <FeatureCard icon={BarChart3} title="Attendance Analytics" desc="Track both online and face-to-face attendance with automated scoring and comprehensive reporting dashboards." />
            <FeatureCard icon={FileText} title="Material Management" desc="Upload and organize course materials with reading progress tracking, view analytics, and content preview." />
            <FeatureCard icon={CalendarClock} title="Exam Scheduling" desc="Schedule midterms and finals with room assignment or online options. Early exam proposals with student response tracking." />
            <FeatureCard icon={MonitorSmartphone} title="Student Registration" desc="Semester registration with add/drop period, payment integration, and automatic enrollment management." />
            <FeatureCard icon={Globe} title="Transcript & Certificates" desc="Auto-generated transcripts with CGPA calculation and digital certificates with QR verification for graduates." />
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section className="py-20" style={{ background: BLUE.deep }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'rgba(212,160,23,0.2)', color: GOLD.light }}>Live Analytics</div>
            <h2 className="text-4xl font-extrabold text-white">Data-Driven <span style={{ color: GOLD.primary }}>Insights</span></h2>
            <p className="text-blue-200 mt-3 max-w-xl mx-auto">Real-time analytics from our platform — see the impact of data-driven education</p>
          </div>
          {loading ? <div className="text-center text-blue-200 py-20">Loading analytics...</div> : (
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4" style={{ color: BLUE.deep }}>Grade Distribution</h3>
                {gradeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart><Pie data={gradeData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {gradeData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-64 text-gray-400">No grade data yet</div>}
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4" style={{ color: BLUE.deep }}>User Distribution</h3>
                {roleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart><Pie data={roleData} cx="50%" cy="50%" outerRadius={110} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill={BLUE.primary} /><Cell fill={GOLD.primary} /></Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-64 text-gray-400">No user data yet</div>}
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4" style={{ color: BLUE.deep }}>Students per Department</h3>
                {deptData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={deptData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} />
                    <Tooltip /><Bar dataKey="students" fill={BLUE.primary} radius={[6,6,0,0]} /></BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-64 text-gray-400">No department data yet</div>}
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4" style={{ color: BLUE.deep }}>Monthly Registrations</h3>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} />
                    <Tooltip /><Area type="monotone" dataKey="Students" stroke={BLUE.primary} fill={BLUE.pale} />
                    <Area type="monotone" dataKey="Teachers" stroke={GOLD.primary} fill={GOLD.pale} /></AreaChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-64 text-gray-400">No registration data yet</div>}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: GOLD.pale, color: GOLD.deep }}>How It Works</div>
            <h2 className="text-4xl font-extrabold" style={{ color: BLUE.deep }}>Simple Steps to <span style={{ color: GOLD.primary }}>Success</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <StepCard num={1} icon={BookOpen} title="Register & Enroll" desc="Students create profiles, register for semesters, and enroll in courses with seamless payment integration." />
            <StepCard num={2} icon={MonitorSmartphone} title="Learn & Engage" desc="Access course materials, join live sessions, take online exams with AI proctoring, and track attendance." />
            <StepCard num={3} icon={Award} title="Achieve & Graduate" desc="View grades, track AI-predicted performance, generate transcripts, and receive verified digital certificates." />
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16" style={{ background: 'linear-gradient(180deg, #f8fafc, white)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold" style={{ color: BLUE.deep }}>Trusted by Educators & Students</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Dr. Alemayehu B.', role: 'CS Professor', quote: 'The AI prediction feature helped me identify struggling students weeks before the final. Intervention rates improved by 40%.' },
              { name: 'Helen G.', role: '3rd Year Student', quote: 'Having all my courses, grades, and schedules in one place made my academic life so much easier. The live sessions are amazing!' },
              { name: 'Academic Affairs', role: 'Admin Office', quote: 'Grade publishing, transcript generation, and semester management — all automated. What used to take days now takes minutes.' },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center gap-1 mb-3">{[1,2,3,4,5].map(s=><span key={s} style={{ color: GOLD.primary }}>&#9733;</span>)}</div>
                <p className="text-gray-600 text-sm italic mb-4">"{t.quote}"</p>
                <p className="font-bold text-sm" style={{ color: BLUE.deep }}>{t.name}</p>
                <p className="text-xs text-gray-400">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${GOLD.deep}, ${GOLD.primary}, ${GOLD.light})` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full" style={{ background: BLUE.deep }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full" style={{ background: BLUE.primary }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Ready to Transform Your Institution?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Join Lucy College today and experience the future of education management. Smart, secure, and built for success.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg shadow-lg"
              style={{ background: BLUE.deep, color: 'white' }}>Get Started <ArrowRight className="w-5 h-5" /></Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg border-2 text-white hover:bg-white/10"
              style={{ borderColor: 'rgba(255,255,255,0.4)' }}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: BLUE.deep }} className="text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="Lucy" className="h-8 w-auto" />
                <span className="text-lg font-bold">Lucy College</span>
              </div>
              <p className="text-blue-300 text-sm leading-relaxed">
                A next-generation AI-powered Learning Management System built for modern educational institutions.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3" style={{ color: GOLD.primary }}>Platform</h4>
              <ul className="space-y-2 text-sm text-blue-300">
                <li>Smart Gradebook</li><li>AI Predictions</li><li>Live Sessions</li><li>Exam Proctoring</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3" style={{ color: GOLD.primary }}>Resources</h4>
              <ul className="space-y-2 text-sm text-blue-300">
                <li>Student Guide</li><li>Teacher Manual</li><li>Admin Panel</li><li>API Documentation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3" style={{ color: GOLD.primary }}>Contact</h4>
              <ul className="space-y-2 text-sm text-blue-300">
                <li>info@lucycollege.edu</li><li>+251 11 123 4567</li><li>Addis Ababa, Ethiopia</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 pt-6 flex flex-col md:flex-row items-center justify-between text-sm text-blue-400">
            <p>&copy; {new Date().getFullYear()} Lucy College. All rights reserved.</p>
            <p>Powered by AI | Built with ❤️ for Education</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
