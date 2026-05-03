import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmContext';
import { getCourseAssessments, createAssessment, createQuestion, updateQuestion, deleteQuestion, getAssessmentQuestions, startAttempt, getAttempt, saveAnswer, submitAttempt, gradeAttempt, getCourseMaterials, createMaterial, deleteMaterial, getCourseStudents, toggleAssessmentOpen, updateAssessment, deleteAssessment, getManualGrades, setManualGrade, createFaceVerification, getProfileStatus, getAttemptsForGrading, getStudentAttempts, reportQuestion, recordMaterialView, closeMaterialView, getCourseMaterialStats, getGradeComponents, getMaterialHtml, saveReadingProgress, getReadingProgress, getVideoTrackingStats, pauseAttempt, autoSaveAttempt, API_BASE, getTeacherSections } from '../api';
import Layout from '../components/Layout';
import FaceTracker from '../components/FaceTracker';
import {
  Plus,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
  ListChecks,
  PenLine,
  MessageSquare,
  FolderOpen,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  Users,
  Lock,
  Unlock,
  Edit3,
  Award,
  Upload,
  SkipForward,
  Flag,
  AlertTriangle,
  X,
  Eye,
  BookOpen as ReadIcon,
  Maximize2,
  Minimize2,
  Video
} from 'lucide-react';

export default function CoursePage() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('sectionId');
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [assessments, setAssessments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assessments');
  const [teacherSections, setTeacherSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(sectionId);

  // Teacher: create assessment form
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  const [newAssessment, setNewAssessment] = useState({ title: '', examType: 'QUIZ', deliveryMode: 'ONLINE', timeLimit: '', maxScore: '100', componentId: '' });
  const [gradeComponents, setGradeComponents] = useState([]);

  // Teacher: manual grade entry
  const [showGradeModal, setShowGradeModal] = useState(null); // assessment being graded
  const [manualGrades, setManualGrades] = useState({}); // { studentId: { score: '', feedback: '' } }

  // Teacher: create material form
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', content: '', fileUrl: '', fileType: 'text', fileName: '' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [videoSource, setVideoSource] = useState('url'); // 'url' or 'upload'
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [currentViewId, setCurrentViewId] = useState(null);
  const [materialStats, setMaterialStats] = useState(null);
  const [htmlReaderMaterial, setHtmlReaderMaterial] = useState(null); // For PPTX HTML reader
  const [htmlContent, setHtmlContent] = useState(null); // Fetched HTML content
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoFaceTracking, setVideoFaceTracking] = useState(false);
  const [videoFaceMismatch, setVideoFaceMismatch] = useState(false);
  const [videoTrackingData, setVideoTrackingData] = useState(null);
  const [showVideoTracking, setShowVideoTracking] = useState(false);

  // Teacher: add question form
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [selectedAssessmentQuestions, setSelectedAssessmentQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [editingAssessmentData, setEditingAssessmentData] = useState({ title: '', timeLimit: '', maxScore: '' });
  const [editingAssessmentComponentId, setEditingAssessmentComponentId] = useState(null);
  const [questionType, setQuestionType] = useState('MCQ');
  const [questionForm, setQuestionForm] = useState({
    type: 'MCQ',
    prompt: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct: 'A',
    correctAnswer: '',
    modelAnswer: '',
    points: 1,
  });

  // Teacher: grading view
  const [gradingAttempt, setGradingAttempt] = useState(null);
  const [gradingAnswers, setGradingAnswers] = useState([]);

  // Teacher: view submissions
  const [submissionsAssessment, setSubmissionsAssessment] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Student: attempt state
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [profileImage, setProfileImage] = useState(null);
  const [faceTrackingActive, setFaceTrackingActive] = useState(false);
  const [faceMismatchDetected, setFaceMismatchDetected] = useState(false);
  const [studentAttempts, setStudentAttempts] = useState([]); // Track completed attempts
  
  // Quiz navigation state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [skippedQuestions, setSkippedQuestions] = useState(new Set());
  const [timeRemaining, setTimeRemaining] = useState(null); // in seconds
  const [examSubmitted, setExamSubmitted] = useState(false); // prevent double submit
  const examSubmittedRef = useRef(false); // ref to avoid stale closure in timer
  const confirmingSubmitRef = useRef(false); // true while user is confirming manual submit
  const [lastAutoSave, setLastAutoSave] = useState(null); // timestamp of last auto-save
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const autoSaveIntervalRef = useRef(null);

  // Report question state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Report question handlers
  async function handleReportQuestion() {
    if (!reportingQuestion) return;
    if (reportReason.trim().length < 10) {
      toast.error(t('course.reportReasonMinLength'));
      return;
    }
    setSubmittingReport(true);
    try {
      await reportQuestion(reportingQuestion.id, reportReason);
      toast.success(t('course.questionReported'));
      setShowReportModal(false);
      setReportingQuestion(null);
      setReportReason('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReport(false);
    }
  }

  function openReportModal(question) {
    setReportingQuestion(question);
    setReportReason('');
    setShowReportModal(true);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCourseAssessments(courseId).then(setAssessments),
      getCourseMaterials(courseId).then(setMaterials),
      user?.role === 'TEACHER' ? getTeacherSections().then(sections => {
        const courseSections = sections.filter(s => s.courseId === courseId);
        setTeacherSections(courseSections);
        // If no sectionId selected, auto-select first section
        if (!selectedSectionId && courseSections.length > 0) {
          setSelectedSectionId(courseSections[0].id);
        }
        return courseSections;
      }).catch(() => []) : Promise.resolve(),
      // Only fetch students when we have a selectedSectionId
      user?.role === 'TEACHER' && selectedSectionId ? getCourseStudents(courseId, selectedSectionId).then(setStudents).catch((err) => console.error('Failed to load students:', err)) : Promise.resolve(),
      user?.role === 'TEACHER' ? getCourseMaterialStats(courseId).then(setMaterialStats).catch(() => {}) : Promise.resolve(),
      user?.role === 'TEACHER' ? getGradeComponents(courseId).then(setGradeComponents).catch(() => {}) : Promise.resolve(),
      user?.role === 'STUDENT' ? getProfileStatus().then(status => setProfileImage(status.profileImage)).catch(() => {}) : Promise.resolve(),
      user?.role === 'STUDENT' ? getStudentAttempts(courseId).then(setStudentAttempts).catch(() => []) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [courseId, selectedSectionId, user?.role]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || examSubmittedRef.current || confirmingSubmitRef.current) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit when time runs out (only if not already submitted and not in manual-confirm flow)
          if (activeAttempt && !examSubmittedRef.current && !confirmingSubmitRef.current) {
            handleSubmitAttempt(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Auto-save effect: save answers every 30 seconds during exam
  useEffect(() => {
    if (!activeAttempt || examSubmittedRef.current) {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      return;
    }

    autoSaveIntervalRef.current = setInterval(async () => {
      if (!activeAttempt || examSubmittedRef.current) return;
      try {
        setAutoSaveStatus('saving');
        const answerEntries = Object.entries(answers).map(([questionId, value]) => {
          const question = activeAttempt.assessment?.questions?.find(q => q.id === questionId);
          if (!question) return null;
          if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
            return { questionId, selected: value };
          }
          return { questionId, textAnswer: value };
        }).filter(Boolean);

        await autoSaveAttempt(
          activeAttempt.id,
          answerEntries,
          timeRemaining ?? undefined,
          currentQuestionIdx
        );
        setLastAutoSave(new Date());
        setAutoSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('error');
      }
    }, 5000); // every 5 seconds to ensure remainingSeconds is always saved

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      // Pause exam when component unmounts (SPA navigation)
      if (activeAttempt && !examSubmittedRef.current && timeRemaining != null) {
        const answerEntries = Object.entries(answers).map(([questionId, value]) => {
          const question = activeAttempt.assessment?.questions?.find(q => q.id === questionId);
          if (!question) return null;
          if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
            return { questionId, selected: value };
          }
          return { questionId, textAnswer: value };
        }).filter(Boolean);

        const payload = JSON.stringify({
          remainingSeconds: timeRemaining ?? 0,
          currentQuestionIdx,
          answers: answerEntries,
        });
        fetch(`${API_BASE}/attempts/${activeAttempt.id}/pause`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [activeAttempt, answers, timeRemaining, currentQuestionIdx]);

  // Beforeunload: pause exam when page is closed/disconnected
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!activeAttempt || examSubmittedRef.current) return;
      // Build answers payload
      const answerEntries = Object.entries(answers).map(([questionId, value]) => {
        const question = activeAttempt.assessment?.questions?.find(q => q.id === questionId);
        if (!question) return null;
        if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
          return { questionId, selected: value };
        }
        return { questionId, textAnswer: value };
      }).filter(Boolean);

      const payload = JSON.stringify({
        remainingSeconds: timeRemaining ?? 0,
        currentQuestionIdx,
        answers: answerEntries,
      });
      const url = `${API_BASE}/attempts/${activeAttempt.id}/pause`;

      // fetch with keepalive supports headers and survives page unload
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});

      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeAttempt, answers, timeRemaining, currentQuestionIdx]);

  // Online/offline detection: pause when going offline
  useEffect(() => {
    const handleOffline = () => {
      if (!activeAttempt || examSubmittedRef.current) return;
      toast.warning(t('course.connectionLost'));
    };

    const handleOnline = () => {
      if (!activeAttempt || examSubmittedRef.current) return;
      toast.success(t('course.connectionRestored'));
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [activeAttempt]);

  // Anti-cheat: disable copy/paste/right-click/select during exam
  useEffect(() => {
    if (!activeAttempt || examSubmittedRef.current) return;

    const preventCopy = (e) => { e.preventDefault(); toast.warning(t('course.copyNotAllowed')); };
    const preventCut = (e) => { e.preventDefault(); toast.warning(t('course.copyNotAllowed')); };
    const preventPaste = (e) => { e.preventDefault(); toast.warning(t('course.pasteNotAllowed')); };
    const preventContextMenu = (e) => { e.preventDefault(); };
    const preventSelectStart = (e) => { e.preventDefault(); };
    const preventKeyDown = (e) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+S, F12
      if ((e.ctrlKey || e.metaKey) && ['c','v','x','a','p','s'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (['c','x'].includes(e.key.toLowerCase())) toast.warning(t('course.copyNotAllowed'));
        if (e.key.toLowerCase() === 'v') toast.warning(t('course.pasteNotAllowed'));
        if (e.key.toLowerCase() === 'p') toast.warning(t('course.printNotAllowed'));
      }
      if (e.key === 'F12') e.preventDefault();
      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (dev tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') e.preventDefault();
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCut);
    document.addEventListener('paste', preventPaste);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('selectstart', preventSelectStart);
    document.addEventListener('keydown', preventKeyDown);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCut);
      document.removeEventListener('paste', preventPaste);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', preventSelectStart);
      document.removeEventListener('keydown', preventKeyDown);
    };
  }, [activeAttempt]);

  // Anti-cheat: detect tab switch / window blur during exam
  const tabSwitchCountRef = useRef(0);
  useEffect(() => {
    if (!activeAttempt || examSubmittedRef.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1;
        toast.error(t('course.tabSwitchWarning', { count: tabSwitchCountRef.current }));
        // Auto-submit after 3 tab switches
        if (tabSwitchCountRef.current >= 3) {
          toast.error(t('course.tabSwitchAutoSubmit'));
          handleSubmitAttempt(true);
        }
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden) {
        // Window lost focus but tab still visible (e.g., alt-tab to another window)
        tabSwitchCountRef.current += 1;
        toast.error(t('course.tabSwitchWarning', { count: tabSwitchCountRef.current }));
        if (tabSwitchCountRef.current >= 3) {
          toast.error(t('course.tabSwitchAutoSubmit'));
          handleSubmitAttempt(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeAttempt]);

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    try {
      const assessment = await createAssessment(courseId, {
        title: newAssessment.title,
        examType: newAssessment.examType,
        timeLimit: newAssessment.timeLimit ? parseInt(newAssessment.timeLimit) : undefined,
        maxScore: newAssessment.maxScore ? parseInt(newAssessment.maxScore) : 100,
        componentId: newAssessment.componentId || undefined,
      });
      setAssessments([...assessments, assessment]);
      setNewAssessment({ title: '', examType: 'QUIZ', timeLimit: '', maxScore: '100', componentId: '' });
      setShowCreateAssessment(false);
      toast.success(t('course.assessmentCreated'));
    } catch (err) {
      toast.error(t('course.failedCreateAssessment') + ': ' + err.message);
    }
  };

  const handleToggleAssessment = async (assessmentId, isOpen) => {
    try {
      const updated = await toggleAssessmentOpen(assessmentId, isOpen);
      setAssessments(assessments.map(a => a.id === assessmentId ? updated : a));
    } catch (err) {
      const msg = err?.data?.message || err.message;
      toast.error(msg);
    }
  };

  // Check if an assessment can be activated based on exam schedule
  const canActivateExam = (assessment) => {
    if (assessment.isOpen) return true; // Can always deactivate
    if (assessment.examType !== 'MIDTERM' && assessment.examType !== 'FINAL') return true; // No schedule restriction for quizzes/assignments

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Check scheduledStart on the assessment
    if (assessment.scheduledStart && new Date(assessment.scheduledStart) > now) {
      return false;
    }

    // 1. Check teacher's scheduled exam date (officialDate or confirmedDate)
    if (assessment.examSchedule) {
      const examDate = assessment.examSchedule.confirmedDate
        ? new Date(assessment.examSchedule.confirmedDate)
        : assessment.examSchedule.officialDate
          ? new Date(assessment.examSchedule.officialDate)
          : null;

      if (examDate) {
        const examDayStart = new Date(examDate);
        examDayStart.setHours(0, 0, 0, 0);

        if (examDayStart <= todayStart) {
          // Teacher's exam date has arrived — allow activation
          return true;
        }

        // Exam date hasn't arrived yet — check early exam proposal
        const canEarly = assessment.examSchedule.earlyExamStatus === 'ALL_AGREED' || assessment.examSchedule.earlyExamStatus === 'APPROVED';
        if (canEarly && assessment.examSchedule.proposedDate) {
          const proposedDayStart = new Date(assessment.examSchedule.proposedDate);
          proposedDayStart.setHours(0, 0, 0, 0);
          return proposedDayStart <= todayStart;
        }

        return false; // Teacher's exam date hasn't arrived yet
      }
    }

    // 2. No teacher schedule — fall back to admin's exam period range
    const semester = assessment.semester;
    let examPeriodStart = null;
    let examPeriodEnd = null;

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

    if (examPeriodStart && examPeriodEnd) {
      const periodStart = new Date(examPeriodStart);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(examPeriodEnd);
      periodEnd.setHours(23, 59, 59, 999);

      if (todayStart < periodStart) return false;
      if (todayStart > periodEnd) return false;
      return true; // Within admin period
    }

    // 3. No schedule at all
    return false;
  };

  const handleDeleteAssessment = async (assessment) => {
    const confirmed = await confirm({
      title: t('course.deleteAssessment'),
      message: `${t('course.deleteAssessmentConfirm', { title: assessment.title })}`,
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    
    try {
      await deleteAssessment(assessment.id);
      setAssessments(assessments.filter(a => a.id !== assessment.id));
      toast.success(t('course.assessmentDeleted'));
    } catch (err) {
      toast.error(t('course.failedDeleteAssessment') + ': ' + err.message);
    }
  };

  const startEditAssessment = (assessment) => {
    setEditingAssessmentId(assessment.id);
    setEditingAssessmentData({
      title: assessment.title || '',
      timeLimit: assessment.timeLimit || '',
      maxScore: assessment.maxScore || '',
    });
    setEditingAssessmentComponentId(assessment.componentId || null);
  };

  const cancelEditAssessment = () => {
    setEditingAssessmentId(null);
    setEditingAssessmentData({ title: '', timeLimit: '', maxScore: '' });
    setEditingAssessmentComponentId(null);
  };

  const handleSaveAssessment = async (assessmentId) => {
    try {
      const payload = {
        title: editingAssessmentData.title,
        timeLimit: editingAssessmentData.timeLimit ? parseInt(editingAssessmentData.timeLimit) : null,
      };
      // Only send maxScore when the assessment is NOT linked to a grade component
      if (!editingAssessmentComponentId) {
        payload.maxScore = editingAssessmentData.maxScore ? parseInt(editingAssessmentData.maxScore) : 100;
      }

      const updated = await updateAssessment(assessmentId, payload);
      setAssessments(assessments.map(a => a.id === assessmentId ? updated : a));
      setEditingAssessmentId(null);
      setEditingAssessmentData({ title: '', timeLimit: '', maxScore: '' });
      toast.success(t('course.assessmentUpdated'));
    } catch (err) {
      toast.error(t('course.failedUpdateAssessment') + ': ' + err.message);
    }
  };

  const resetQuestionForm = (type = 'MCQ') => {
    setQuestionType(type);
    setQuestionForm({
      type,
      prompt: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correct: 'A',
      correctAnswer: '',
      modelAnswer: '',
      points: 1,
    });
    setEditingQuestion(null);
  };

  const loadAssessmentQuestions = async (assessment) => {
    try {
      const questions = await getAssessmentQuestions(assessment.id);
      setSelectedAssessmentQuestions(questions);
      setSelectedAssessment(assessment);
      resetQuestionForm('MCQ');
    } catch (err) {
      toast.error(t('course.failedLoadQuestions') + ': ' + err.message);
    }
  };

  const toggleQuestionPanel = async (assessment) => {
    if (selectedAssessment?.id === assessment.id) {
      setSelectedAssessment(null);
      setSelectedAssessmentQuestions([]);
      setEditingQuestion(null);
      return;
    }
    await loadAssessmentQuestions(assessment);
  };

  const prepareEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionType(question.type);
    setQuestionForm({
      type: question.type,
      prompt: question.prompt || '',
      optionA: question.optionA || '',
      optionB: question.optionB || '',
      optionC: question.optionC || '',
      optionD: question.optionD || '',
      correct: question.correct || 'A',
      correctAnswer: question.correctAnswer || '',
      modelAnswer: question.modelAnswer || '',
      points: question.points || 1,
    });
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!selectedAssessment) return;

    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, questionForm);
        toast.success(t('course.questionUpdated'));
      } else {
        await createQuestion(selectedAssessment.id, questionForm);
        toast.success(t('course.questionAdded'));
      }
      const questions = await getAssessmentQuestions(selectedAssessment.id);
      setSelectedAssessmentQuestions(questions);
      resetQuestionForm(questionForm.type);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteQuestion = async (question) => {
    const confirmed = await confirm({
      title: t('course.deleteQuestion'),
      message: t('course.deleteQuestionConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteQuestion(question.id);
      setSelectedAssessmentQuestions(selectedAssessmentQuestions.filter((q) => q.id !== question.id));
      toast.success(t('course.questionDeleted'));
      if (editingQuestion?.id === question.id) {
        resetQuestionForm(questionType);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancelQuestionEdit = () => {
    resetQuestionForm('MCQ');
  };

  const handleOpenGradeModal = async (assessment) => {
    setShowGradeModal(assessment);
    // Load existing grades
    try {
      const grades = await getManualGrades(assessment.id);
      const gradeMap = {};
      grades.forEach(g => {
        gradeMap[g.studentId] = { score: g.score.toString(), feedback: g.feedback || '' };
      });
      setManualGrades(gradeMap);
    } catch (err) {
      console.error('Failed to load grades:', err);
      setManualGrades({});
    }
  };

  const handleSaveManualGrade = async (studentId) => {
    if (!showGradeModal) return;
    const grade = manualGrades[studentId];
    if (!grade || grade.score === '') return;
    
    try {
      await setManualGrade(showGradeModal.id, studentId, parseInt(grade.score), grade.feedback || undefined);
      toast.success(t('grade.gradeSaved'));
    } catch (err) {
      toast.error(t('course.failedSaveGrade') + ': ' + err.message);
    }
  };

  const handleSaveAllGrades = async () => {
    if (!showGradeModal) return;
    
    try {
      const promises = Object.entries(manualGrades)
        .filter(([_, g]) => g.score !== '')
        .map(([studentId, g]) => setManualGrade(showGradeModal.id, studentId, parseInt(g.score), g.feedback || undefined));
      
      await Promise.all(promises);
      toast.success(t('course.allGradesSaved'));
      setShowGradeModal(null);
    } catch (err) {
      toast.error(t('course.failedSaveSomeGrades') + ': ' + err.message);
    }
  };

  const handleMaterialFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 20MB for docs, 200MB for videos)
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov|avi)$/i);
    const maxSize = isVideo ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.warning(isVideo ? t('course.videoSizeLimit') : t('course.fileSizeLimit'));
      return;
    }
    
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewMaterial({
        ...newMaterial,
        fileUrl: event.target.result,
        fileName: file.name,
        fileType: isVideo ? 'video' :
                  file.name.toLowerCase().endsWith('.pdf') ? 'pdf' :
                  file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx') ? 'doc' :
                  file.name.toLowerCase().endsWith('.pptx') ? 'pptx' :
                  file.name.toLowerCase().endsWith('.ppt') ? 'ppt' :
                  file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx') ? 'xls' :
                  'file'
      });
      setUploadingFile(false);
    };
    reader.onerror = () => {
      toast.error(t('course.failedReadFile'));
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMaterial = async (e) => {
    e.preventDefault();

    // Validate: must have content based on type
    const needsFile = ['pdf', 'doc', 'ppt', 'pptx', 'xls'].includes(newMaterial.fileType);
    const needsUrl = newMaterial.fileType === 'link' || (newMaterial.fileType === 'video' && videoSource === 'url');
    const needsContent = newMaterial.fileType === 'text';

    if (needsFile && !newMaterial.fileUrl) {
      toast.error('Please upload a file for this material type.');
      return;
    }
    if (needsUrl && !newMaterial.fileUrl) {
      toast.error('Please provide a URL for this material type.');
      return;
    }
    if (needsContent && !newMaterial.content?.trim()) {
      toast.error('Please enter content for this material type.');
      return;
    }
    if (newMaterial.fileType === 'video' && videoSource === 'upload' && !newMaterial.fileUrl) {
      toast.error('Please upload a video file.');
      return;
    }

    try {
      const material = await createMaterial(courseId, {
        title: newMaterial.title,
        content: newMaterial.content || undefined,
        fileUrl: newMaterial.fileUrl || undefined,
        fileType: newMaterial.fileType,
        fileName: newMaterial.fileName || undefined,
      });
      setMaterials([...materials, material]);
      setNewMaterial({ title: '', content: '', fileUrl: '', fileType: 'text', fileName: '' });
      setVideoSource('url');
      setShowCreateMaterial(false);
      toast.success(t('course.materialCreated'));
    } catch (err) {
      toast.error(t('course.failedCreateMaterial') + ': ' + err.message);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    const confirmed = await confirm({
      title: t('course.deleteMaterial'),
      message: t('course.deleteMaterialConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    await deleteMaterial(materialId);
    setMaterials(materials.filter(m => m.id !== materialId));
    toast.success(t('course.materialDeleted'));
  };

  const handleShowVideoTracking = async (materialId) => {
    try {
      const stats = await getVideoTrackingStats(materialId);
      setVideoTrackingData(stats);
      setShowVideoTracking(true);
    } catch (err) {
      toast.error(t('course.failedLoadTracking'));
    }
  };

  const handleOpenPreview = async (material) => {
    // PPTX/PPT/DOCX/DOC files: use HTML reader (converted via COM/python scripts)
    if ((material.fileType === 'pptx' || material.fileType === 'ppt' || material.fileType === 'docx' || material.fileType === 'doc') && material.fileUrl) {
      return handleOpenHtmlReader(material);
    }
    setPreviewMaterial(material);
    // Reset video face tracking
    setVideoFaceTracking(false);
    setVideoFaceMismatch(false);
    // Track student view
    if (user?.role === 'STUDENT') {
      try {
        const result = await recordMaterialView(material.id);
        setCurrentViewId(result.viewId);
      } catch (err) {
        console.error('Failed to record view:', err);
      }
      // Enable face tracking for uploaded video materials (not YouTube/Vimeo links)
      if (material.fileType === 'video' && material.fileUrl) {
        const url = material.fileUrl;
        const isYouTubeVimeo = url.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/);
        const isUploadedFile = url.startsWith('data:') || url.match(/\.(mp4|webm|ogg)$/i);
        if (isUploadedFile || !isYouTubeVimeo) {
          setVideoFaceTracking(true);
          setVideoFaceMismatch(false);
        }
      }
    }
  };

  const handleClosePreview = async () => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    // Close view tracking for student
    if (user?.role === 'STUDENT' && currentViewId) {
      try {
        await closeMaterialView(currentViewId);
      } catch (err) {
        console.error('Failed to close view tracking:', err);
      }
    }
    setCurrentViewId(null);
    setVideoFaceTracking(false);
    setVideoFaceMismatch(false);
    setPreviewMaterial(null);
  };

  // Open material with reading time tracking (all types)
  const handleOpenHtmlReader = async (material) => {
    // PPT is now handled same as PPTX (converted via PowerPoint COM on Windows)
    // No special case needed - falls through to HTML content fetch
    setHtmlReaderMaterial(material);
    // Reset and enable video face tracking for uploaded videos
    setVideoFaceTracking(false);
    setVideoFaceMismatch(false);
    if (user?.role === 'STUDENT' && material.fileType === 'video' && material.fileUrl) {
      const url = material.fileUrl;
      const isYouTubeVimeo = url.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/);
      const isUploadedFile = url.startsWith('data:') || url.match(/\.(mp4|webm|ogg)$/i);
      if (isUploadedFile || !isYouTubeVimeo) {
        setVideoFaceTracking(true);
        setVideoFaceMismatch(false);
      }
    }
    setHtmlLoading(true);
    try {
      // PPTX/PPT/DOCX/DOC files have HTML content via conversion
      if (material.htmlContent || material.fileType === 'pptx' || material.fileType === 'ppt' || material.fileType === 'docx' || material.fileType === 'doc') {
        const content = await getMaterialHtml(material.id);
        setHtmlContent(content);
      } else {
        // For other types, we'll render them in the reader modal directly
        setHtmlContent(null);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
      // Non-fatal for non-PPTX materials, they can still be viewed
      setHtmlContent(null);
    } finally {
      setHtmlLoading(false);
    }
    // Track student view
    if (user?.role === 'STUDENT') {
      try {
        const view = await recordMaterialView(material.id);
        setCurrentViewId(view.viewId);
      } catch (err) {
        console.error('Failed to record view:', err);
      }
    }
  };

  const handleCloseHtmlReader = async () => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    
    // Close view tracking for student
    if (user?.role === 'STUDENT' && currentViewId) {
      try {
        await closeMaterialView(currentViewId);
      } catch (err) {
        console.error('Failed to close view tracking:', err);
      }
    }
    setCurrentViewId(null);
    setVideoFaceTracking(false);
    setVideoFaceMismatch(false);
    setHtmlReaderMaterial(null);
    setHtmlContent(null);
  };

  const toggleFullscreen = async () => {
    const modalElement = document.getElementById('html-reader-modal');
    if (!modalElement) return;

    try {
      if (!document.fullscreenElement) {
        await modalElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleStartAttempt = async (assessmentId) => {
    try {
      const attempt = await startAttempt(assessmentId);
      // startAttempt returns full attempt data when resuming, but minimal when new
      // Always fetch full data with answers and questions
      const fullAttempt = await getAttempt(attempt.id);
      setActiveAttempt(fullAttempt);
      const initialAnswers = {};
      fullAttempt.answers?.forEach((a) => {
        initialAnswers[a.questionId] = a.selected || a.textAnswer || '';
      });
      setAnswers(initialAnswers);

      // Check if resuming from a paused state (remainingSeconds was saved)
      // Use attempt.remainingSeconds from startAttempt response (more reliable for resume)
      const savedRemainingSeconds = attempt.remainingSeconds ?? fullAttempt.remainingSeconds;
      const savedQuestionIdx = attempt.currentQuestionIdx ?? fullAttempt.currentQuestionIdx;
      const isResuming = savedRemainingSeconds != null;
      console.log('Exam resume check:', { 
        attemptRemaining: attempt.remainingSeconds, 
        fullRemaining: fullAttempt.remainingSeconds, 
        savedRemainingSeconds, 
        savedQuestionIdx, 
        isResuming,
        attemptPausedAt: attempt.pausedAt,
        fullPausedAt: fullAttempt.pausedAt,
      });

      // Restore current question index
      if (isResuming && savedQuestionIdx != null) {
        setCurrentQuestionIdx(savedQuestionIdx);
      } else {
        setCurrentQuestionIdx(0);
      }
      setSkippedQuestions(new Set());

      // Initialize timer - restore remaining time or start from teacher's set time limit
      if (isResuming && savedRemainingSeconds != null) {
        // Resuming from pause — use saved remaining seconds
        setTimeRemaining(savedRemainingSeconds);
      } else if (fullAttempt.assessment?.timeLimit) {
        // First time — use the time limit set by teacher when creating the assessment
        setTimeRemaining(fullAttempt.assessment.timeLimit * 60);
      } else if (fullAttempt.examEndTime) {
        // Fallback — calculate from scheduled exam end time
        const remaining = Math.floor((new Date(fullAttempt.examEndTime).getTime() - Date.now()) / 1000);
        setTimeRemaining(Math.max(remaining, 0));
      } else {
        setTimeRemaining(null);
      }

      // Show resume notification if applicable
      if (isResuming) {
        toast.info(t('course.examResumed'));
      }

      // Start continuous face tracking
      setFaceTrackingActive(true);
      setFaceMismatchDetected(false);
      setExamSubmitted(false);
      examSubmittedRef.current = false;
      setAutoSaveStatus('');
      setLastAutoSave(null);
    } catch (err) {
      if (err.message?.includes('already_submitted')) {
        toast.warning(t('course.alreadySubmitted'));
        // Refresh attempts list
        getStudentAttempts(courseId).then(setStudentAttempts);
      } else {
        toast.error(t('course.failedStartExam') + ': ' + err.message);
      }
    }
  };

  const handleFaceMismatch = async (capturedImage) => {
    if (!activeAttempt) return;
    
    setFaceMismatchDetected(true);
    try {
      await createFaceVerification(activeAttempt.id, capturedImage, false);
    } catch (err) {
      console.error('Failed to record face mismatch:', err);
    }
  };

  const handleEndExam = () => {
    setFaceTrackingActive(false);
    setFaceMismatchDetected(false);
    setCurrentQuestionIdx(0);
    setSkippedQuestions(new Set());
    setTimeRemaining(null);
    setExamSubmitted(false);
    examSubmittedRef.current = false;
    setActiveAttempt(null);
    setAnswers({});
  };

  const handleSelectAnswer = async (questionId, selected) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
    await saveAnswer(activeAttempt.id, questionId, { selected });
  };

  const handleTextAnswer = async (questionId, textAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: textAnswer }));
    await saveAnswer(activeAttempt.id, questionId, { textAnswer });
  };

  const handleSubmitAttempt = async (autoSubmit = false) => {
    if (examSubmittedRef.current) return; // prevent double submit
    if (!autoSubmit) {
      // mark that user is in the manual confirmation flow to avoid race with auto-submit
      confirmingSubmitRef.current = true;
      const confirmed = await confirm({
        title: t('course.submitExam'),
        message: t('course.submitExamConfirm'),
        confirmText: t('common.submit'),
        cancelText: t('common.cancel'),
        type: 'info',
      });
      // leave confirmation flow
      confirmingSubmitRef.current = false;
      if (!confirmed) return;
    }
    setExamSubmitted(true);
    examSubmittedRef.current = true; // set ref immediately to block timer
    setTimeRemaining(null); // stop timer immediately
    try {
      const result = await submitAttempt(activeAttempt.id);
      // Refresh attempts list
      getStudentAttempts(courseId).then(setStudentAttempts);
      if (autoSubmit) {
        toast.success(t('course.timeUpAutoSubmitted'));
      } else {
        toast.success(t('course.examSubmittedSuccess'));
      }
    } catch (err) {
      toast.error(t('course.failedSubmit') + ': ' + err.message);
      setExamSubmitted(false);
      examSubmittedRef.current = false; // allow retry on error
    }
    handleEndExam();
  };

  const handleOpenGrading = async (attempt) => {
    const fullAttempt = await getAttempt(attempt.id);
    setGradingAttempt(fullAttempt);
    setGradingAnswers(fullAttempt.answers.map((a) => ({
      answerId: a.id,
      score: a.score ?? 0,
      feedback: a.feedback ?? '',
    })));
  };

  const handleGradeSubmit = async () => {
    const confirmed = await confirm({
      title: t('course.submitGrades'),
      message: t('course.submitGradesConfirm'),
      confirmText: t('common.submit'),
      cancelText: t('common.cancel'),
      type: 'success',
    });
    if (!confirmed) return;
    await gradeAttempt(gradingAttempt.id, gradingAnswers);
    toast.success(t('course.gradesSubmitted'));
    setGradingAttempt(null);
    setGradingAnswers([]);
  };

  const handleViewSubmissions = async (assessment) => {
    try {
      const attempts = await getAttemptsForGrading(assessment.id);
      setSubmissions(attempts);
      setSubmissionsAssessment(assessment);
    } catch (err) {
      toast.error(t('course.failedLoadSubmissions') + ': ' + err.message);
    }
  };

  if (loading) return <Layout><div className="p-8 text-center">{t('common.loading')}</div></Layout>;

  // Teacher grading view
  if (gradingAttempt) {
    const questions = gradingAttempt.assessment?.questions || [];
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setGradingAttempt(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('course.backToCourse')}
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('course.grading')}: {gradingAttempt.assessment?.title}</h2>
            <p className="text-gray-500">{t('nav.students')}: {gradingAttempt.student?.fullName || gradingAttempt.studentId}</p>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => {
              const answer = gradingAttempt.answers.find((a) => a.questionId === q.id);
              const gradeIdx = gradingAnswers.findIndex((g) => g.answerId === answer?.id);
              return (
                <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded">
                        Q{idx + 1} - {q.type}
                      </span>
                      <p className="mt-2 text-gray-900 font-medium">{q.prompt}</p>
                    </div>
                    <span className="text-sm text-gray-500">{q.points} pts</span>
                  </div>

                  {q.type === 'MCQ' && (
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <span className={`flex items-center gap-2 ${answer?.selected === q.correct ? 'text-green-600' : 'text-red-600'}`}>
                        {answer?.selected === q.correct ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        {t('course.student')}: {answer?.selected || t('course.notAnswered')}
                      </span>
                      <span className="text-gray-500">{t('course.correct')}: {q.correct}</span>
                    </div>
                  )}

                  {q.type === 'FITB' && (
                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{t('course.student')}:</span>
                        <span className={answer?.textAnswer?.toLowerCase().trim() === q.correctAnswer?.toLowerCase().trim() ? 'text-green-600 font-medium' : 'text-red-600'}>
                          {answer?.textAnswer || t('course.notAnswered')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{t('course.correct')}:</span>
                        <span className="text-gray-900">{q.correctAnswer}</span>
                      </div>
                    </div>
                  )}

                  {q.type === 'SHORT_ANSWER' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">{t('course.studentAnswer')}:</p>
                        <p className="text-gray-900 whitespace-pre-wrap">{answer?.textAnswer || t('course.notAnswered')}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600 mb-1">{t('course.modelAnswer')}:</p>
                        <p className="text-gray-900 whitespace-pre-wrap">{q.modelAnswer}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="text-sm text-gray-600">{t('grade.score')}:</label>
                      <input
                        type="number"
                        min="0"
                        max={q.points}
                        value={gradeIdx >= 0 ? gradingAnswers[gradeIdx].score : 0}
                        onChange={(e) => {
                          const updated = [...gradingAnswers];
                          if (gradeIdx >= 0) {
                            updated[gradeIdx] = { ...updated[gradeIdx], score: parseInt(e.target.value) || 0 };
                          }
                          setGradingAnswers(updated);
                        }}
                        className="w-16 ml-2 px-2 py-1 border border-gray-200 rounded"
                      />
                      <span className="text-gray-500 text-sm ml-1">/ {q.points}</span>
                    </div>
                    <input
                      type="text"
                      placeholder={t('course.addFeedback')}
                      value={gradeIdx >= 0 ? gradingAnswers[gradeIdx].feedback : ''}
                      onChange={(e) => {
                        const updated = [...gradingAnswers];
                        if (gradeIdx >= 0) {
                          updated[gradeIdx] = { ...updated[gradeIdx], feedback: e.target.value };
                        }
                        setGradingAnswers(updated);
                      }}
                      className="flex-1 px-3 py-1 border border-gray-200 rounded"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleGradeSubmit}
              className="px-6 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
            >
              {t('course.submitGrades')}
            </button>
            <button
              onClick={() => setGradingAttempt(null)}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Student taking quiz
  if (activeAttempt) {
    const questions = activeAttempt.assessment?.questions || [];
    const currentQuestion = questions[currentQuestionIdx];
    const answeredCount = Object.keys(answers).filter(qId => answers[qId] && answers[qId].length > 0).length;
    const skippedCount = skippedQuestions.size;
    const unansweredCount = questions.length - answeredCount;
    
    return (
      <Layout>
        <FaceTracker
          active={faceTrackingActive}
          attemptId={activeAttempt.id}
          profileImage={profileImage}
          onMismatch={handleFaceMismatch}
          intervalMs={60000}
        />
        <div className="max-w-5xl mx-auto">
          {/* Face Mismatch Warning */}
          {faceMismatchDetected && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">{t('course.faceVerificationAlert')}</p>
                  <p className="text-sm text-yellow-700">
                    {t('course.faceMismatchDetected')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Header with Timer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{activeAttempt.assessment?.title}</h2>
                <p className="text-gray-500 text-sm">{activeAttempt.assessment?.examType}</p>
              </div>
              {timeRemaining !== null && (
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    timeRemaining < 300 ? 'bg-red-100 text-red-700' : 
                    timeRemaining < 600 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <Clock className="w-5 h-5" />
                    <span className="font-mono text-lg font-bold">{formatTime(timeRemaining)}</span>
                  </div>
                  {/* Auto-save indicator */}
                  {autoSaveStatus && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                      autoSaveStatus === 'saved' ? 'text-green-600 bg-green-50' :
                      autoSaveStatus === 'saving' ? 'text-blue-600 bg-blue-50' :
                      'text-red-600 bg-red-50'
                    }`}>
                      {autoSaveStatus === 'saving' && <span className="animate-pulse">●</span>}
                      {autoSaveStatus === 'saved' && <CheckCircle className="w-3 h-3" />}
                      {autoSaveStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                      <span>{autoSaveStatus === 'saving' ? t('course.saving') : autoSaveStatus === 'saved' ? t('course.saved') : t('course.saveFailed')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-6">
            {/* Question Navigator - Left Sidebar */}
            <div className="w-20 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sticky top-4">
                <p className="text-xs text-gray-500 mb-2 text-center">{t('course.questions')}</p>
                <div className="grid grid-cols-2 gap-1">
                  {questions.map((q, idx) => {
                    const isAnswered = answers[q.id] && answers[q.id].length > 0;
                    const isSkipped = skippedQuestions.has(q.id);
                    const isCurrent = idx === currentQuestionIdx;
                    
                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                          isCurrent
                            ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                            : isAnswered
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : isSkipped
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded bg-green-100"></div>
                    <span className="text-gray-500">{answeredCount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded bg-yellow-100"></div>
                    <span className="text-gray-500">{skippedCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Question Area */}
            <div className="flex-1">
              {currentQuestion && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded">
                        Q{currentQuestionIdx + 1} {t('course.of')} {questions.length} - {currentQuestion.type}
                      </span>
                      <p className="mt-3 text-gray-900 font-medium text-lg">{currentQuestion.prompt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{currentQuestion.points} pts</span>
                      <button
                        onClick={() => openReportModal(currentQuestion)}
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title={t('course.reportThisQuestion')}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {currentQuestion.type === 'MCQ' && (
                    <div className="space-y-2 mt-4">
                      {['A', 'B', 'C', 'D'].map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${
                            answers[currentQuestion.id] === opt 
                              ? 'bg-primary-50 border-2 border-primary-500' 
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            checked={answers[currentQuestion.id] === opt}
                            onChange={() => handleSelectAnswer(currentQuestion.id, opt)}
                            className="w-4 h-4 text-primary-600"
                          />
                          <span className="font-medium text-gray-700">{opt}:</span>
                          <span className="text-gray-900">{currentQuestion[`option${opt}`]}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'FITB' && (
                    <input
                      type="text"
                      placeholder={t('course.typeYourAnswer')}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mt-4"
                    />
                  )}

                  {currentQuestion.type === 'SHORT_ANSWER' && (
                    <textarea
                      placeholder={t('course.writeYourAnswer')}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mt-4"
                    />
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
                      disabled={currentQuestionIdx === 0}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t('course.previous')}
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSkippedQuestions(prev => new Set([...prev, currentQuestion.id]));
                          if (currentQuestionIdx < questions.length - 1) {
                            setCurrentQuestionIdx(currentQuestionIdx + 1);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-medium rounded-lg"
                      >
                        <SkipForward className="w-4 h-4" />
                        {t('course.skip')}
                      </button>

                      {currentQuestionIdx < questions.length - 1 ? (
                        <button
                          onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
                        >
                          {t('course.next')}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubmitAttempt(false)}
                          className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
                        >
                          <Flag className="w-4 h-4" />
                          {t('course.submitExam')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Section */}
              <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{answeredCount}</span> {t('course.answered')}, {' '}
                    <span className="font-medium">{skippedCount}</span> {t('course.skipped')}, {' '}
                    <span className="font-medium">{unansweredCount}</span> {t('course.remaining')}
                  </div>
                  {tabSwitchCountRef.current > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      ⚠ {t('course.tabSwitchWarning', { count: tabSwitchCountRef.current })}
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: t('course.exitExam'),
                        message: t('course.exitExamConfirm'),
                        confirmText: t('course.exitExam'),
                        cancelText: t('common.cancel'),
                        type: 'danger',
                      });
                      if (!confirmed) return;
                      setActiveAttempt(null);
                      setAnswers({});
                      handleEndExam();
                    }}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg text-sm"
                  >
                    {t('course.exitExam')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/my-classes" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ChevronLeft className="w-5 h-5" />
            {t('course.backToMyClasses')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('course.course')}</h1>
          <p className="text-gray-500 mt-1">{t('course.courseId')}: {courseId}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'assessments'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListChecks className="w-4 h-4 inline mr-2" />
            {t('nav.assessments')}
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'materials'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="w-4 h-4 inline mr-2" />
            {t('course.materials')}
          </button>
          {user?.role === 'TEACHER' && (
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'students'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              {t('nav.students')}
            </button>
          )}
        </div>

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <>
            {user?.role === 'TEACHER' && (
              <div className="mb-6">
                <button
                  onClick={() => setShowCreateMaterial(!showCreateMaterial)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  {t('course.addMaterial')}
                </button>
              </div>
            )}

            {showCreateMaterial && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('course.addCourseMaterial')}</h3>
                <form onSubmit={handleCreateMaterial} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.title')}</label>
                    <input
                      type="text"
                      value={newMaterial.title}
                      onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('course.weekLectureNotes')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.type')}</label>
                    <select
                      value={newMaterial.fileType}
                      onChange={(e) => setNewMaterial({ ...newMaterial, fileType: e.target.value, fileUrl: '', fileName: '' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value="text">{t('course.textContent')}</option>
                      <option value="link">{t('course.externalLink')}</option>
                      <option value="pdf">{t('course.pdfDocument')}</option>
                      <option value="doc">{t('course.wordDocument')}</option>
                      <option value="ppt">{t('course.powerPoint')}</option>
                      <option value="pptx">{t('course.powerPoint')} (.pptx)</option>
                      <option value="xls">{t('course.excelSpreadsheet')}</option>
                      <option value="video">{t('course.video')}</option>
                    </select>
                  </div>
                  {newMaterial.fileType === 'text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.content')}</label>
                      <textarea
                        value={newMaterial.content}
                        onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={t('course.enterMaterialContent')}
                      />
                    </div>
                  )}
                  {newMaterial.fileType === 'link' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.url')}</label>
                      <input
                        type="url"
                        value={newMaterial.fileUrl}
                        onChange={(e) => setNewMaterial({ ...newMaterial, fileUrl: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="https://..."
                      />
                    </div>
                  )}
                  {newMaterial.fileType === 'video' && (
                    <div>
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => { setVideoSource('url'); setNewMaterial({ ...newMaterial, fileUrl: '', fileName: '' }); }}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${videoSource === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          {t('course.videoUrl')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setVideoSource('upload'); setNewMaterial({ ...newMaterial, fileUrl: '', fileName: '' }); }}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${videoSource === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          {t('course.uploadVideo')}
                        </button>
                      </div>
                      {videoSource === 'url' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.url')}</label>
                          <input
                            type="url"
                            value={newMaterial.fileUrl}
                            onChange={(e) => setNewMaterial({ ...newMaterial, fileUrl: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://youtube.com/... or https://vimeo.com/..."
                          />
                        </div>
                      )}
                      {videoSource === 'upload' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.uploadVideoFile')}</label>
                          <div className="flex gap-3">
                            <label className="flex-1 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors">
                              <Upload className="w-8 h-8 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {uploadingFile ? t('course.uploading') : newMaterial.fileName ? `${t('course.selected')}: ${newMaterial.fileName}` : t('course.clickToUploadVideo')}
                              </span>
                              <span className="text-xs text-gray-400">{t('course.videoFormatsNote')}</span>
                              <input
                                type="file"
                                accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg,.mov,.avi"
                                onChange={handleMaterialFileUpload}
                                className="hidden"
                                disabled={uploadingFile}
                              />
                            </label>
                            {newMaterial.fileUrl && videoSource === 'upload' && (
                              <div className="flex-1">
                                <video controls className="w-full rounded-lg max-h-32">
                                  <source src={newMaterial.fileUrl} />
                                </video>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(newMaterial.fileType === 'pdf' || newMaterial.fileType === 'doc' || newMaterial.fileType === 'ppt' || newMaterial.fileType === 'pptx' || newMaterial.fileType === 'xls') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.uploadFile')}</label>
                      <div className="flex gap-3">
                        <label className="flex-1 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors">
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {uploadingFile ? t('course.uploading') : newMaterial.fileName ? `${t('course.selected')}: ${newMaterial.fileName}` : t('course.clickToUpload')}
                          </span>
                          <input
                            type="file"
                            accept={newMaterial.fileType === 'pdf' ? '.pdf' : newMaterial.fileType === 'doc' ? '.doc,.docx' : newMaterial.fileType === 'pptx' ? '.pptx' : newMaterial.fileType === 'ppt' ? '.ppt' : '.xls,.xlsx'}
                            onChange={handleMaterialFileUpload}
                            className="hidden"
                            disabled={uploadingFile}
                          />
                        </label>
                        {newMaterial.fileUrl && (
                          <button
                            type="button"
                            onClick={() => setNewMaterial({ ...newMaterial, fileUrl: '', fileName: '' })}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{t('course.maxFileSize20MB')}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
                    >
                      {t('course.addMaterial')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateMaterial(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {materials.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('course.noMaterialsYet')}</h3>
                <p className="text-gray-500">
                  {user?.role === 'TEACHER' ? t('course.addMaterialsForStudents') : t('course.noMaterialsAdded')}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {materials.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {m.fileType === 'link' ? (
                            <LinkIcon className="w-5 h-5 text-blue-500" />
                          ) : m.fileType === 'pdf' ? (
                            <FileText className="w-5 h-5 text-red-500" />
                          ) : m.fileType === 'video' ? (
                            <ExternalLink className="w-5 h-5 text-purple-500" />
                          ) : (
                            <FileText className="w-5 h-5 text-gray-500" />
                          )}
                          <h3 className="font-semibold text-gray-900">{m.title}</h3>
                        </div>
                        {user?.role === 'TEACHER' && m.author?.id === user.id && (
                          <button
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {m.fileType}
                      </span>
                      {m.fileType === 'video' && m.fileUrl && !m.fileUrl.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/) && (
                        <span className="inline-block mt-2 ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          <Video className="w-3 h-3 inline mr-1" />
                          {t('course.tracked')}
                        </span>
                      )}
                      {user?.role === 'TEACHER' && Array.isArray(materialStats) && (() => {
                        const stat = materialStats.find(s => s.materialId === m.id);
                        if (!stat) return null;
                        return (
                          <span className="inline-block mt-2 ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            <Eye className="w-3 h-3 inline mr-1" />
                            {stat.uniqueViewers}/{stat.totalStudents} {t('course.viewed')}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="p-5">
                      {m.content && (
                        <p className="text-sm text-gray-600 line-clamp-3">{m.content}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {/* Preview button for teachers/admins only */}
                        {(m.fileUrl || m.content) && user?.role !== 'STUDENT' && (
                          <button
                            onClick={() => handleOpenPreview(m)}
                            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            {t('course.preview')}
                          </button>
                        )}
                        {/* Video Tracking button for teachers on tracked videos */}
                        {user?.role === 'TEACHER' && m.fileType === 'video' && m.fileUrl && !m.fileUrl.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/) && (
                          <button
                            onClick={() => handleShowVideoTracking(m.id)}
                            className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            <Video className="w-4 h-4" />
                            {t('course.tracking')}
                          </button>
                        )}
                        {/* Read with Tracking button for all materials (students) */}
                        {user?.role === 'STUDENT' && (
                          <button
                            onClick={() => handleOpenHtmlReader(m)}
                            className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            <ReadIcon className="w-4 h-4" />
                            {t('course.readWithTracking')}
                          </button>
                        )}
                        {m.fileUrl && m.fileType === 'link' && (
                          <a
                            href={m.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t('course.openLink')}
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        {t('course.addedBy')} {m.author?.fullName || t('course.unknown')} {t('course.on')} {new Date(m.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Assessments Tab */}
        {activeTab === 'assessments' && (
          <>
            {/* Teacher: Create Assessment Button */}
            {user?.role === 'TEACHER' && (
              <div className="mb-6 flex gap-3">
                <button
                  onClick={() => setShowCreateAssessment(!showCreateAssessment)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  {t('course.createAssessment')}
                </button>
                <Link
                  to={`/courses/${courseId}/gradebook`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <BookOpen className="w-5 h-5" />
                  {t('nav.gradebook')}
                </Link>
              </div>
            )}
            {user?.role === 'STUDENT' && (
              <div className="mb-6">
                <Link
                  to={`/courses/${courseId}/gradebook`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Award className="w-5 h-5" />
                  {t('course.viewMyGrades')}
                </Link>
              </div>
            )}

            {/* Create Assessment Form */}
            {showCreateAssessment && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('course.createNewAssessment')}</h3>
                <form onSubmit={handleCreateAssessment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.title')}</label>
                    <input
                      type="text"
                      value={newAssessment.title}
                      onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('course.midtermExam')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.gradeComponents')}</label>
                      <select
                        value={newAssessment.componentId}
                        onChange={(e) => {
                          const compId = e.target.value;
                          const comp = gradeComponents.find(c => c.id === compId);
                          // Auto-derive examType from component name
                          const nameToExamType = {
                            'Quiz': 'QUIZ', 'Assignment': 'ASSIGNMENT', 'Midterm': 'MIDTERM',
                            'Final': 'FINAL', 'Class Activity': 'CLASS_ACTIVITY',
                            'Project': 'PROJECT', 'Presentation': 'PRESENTATION',
                          };
                          const derivedExamType = comp ? (nameToExamType[comp.name] || comp.name.toUpperCase().replace(/\s+/g, '_')) : 'QUIZ';
                          setNewAssessment({
                            ...newAssessment,
                            componentId: compId,
                            examType: derivedExamType,
                            maxScore: comp ? String(comp.weight) : newAssessment.maxScore,
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                      >
                        <option value="">{t('course.none')} (Quiz)</option>
                        {gradeComponents.filter(c => c.name !== 'Attendance' && !assessments.some(a => a.componentId === c.id)).map(comp => (
                          <option key={comp.id} value={comp.id}>{comp.name} ({comp.weight}%)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.deliveryMode')}</label>
                      <select
                        value={newAssessment.deliveryMode}
                        onChange={(e) => setNewAssessment({ ...newAssessment, deliveryMode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                      >
                        <option value="ONLINE">{t('course.online')}</option>
                        <option value="ONLINE_EXAM">{t('course.onlineExam')}</option>
                        <option value="PAPER">{t('course.paper')}</option>
                      </select>
                    </div>
                    {newAssessment.deliveryMode !== 'PAPER' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.timeLimitMin')} {newAssessment.deliveryMode === 'ONLINE_EXAM' && <span className="text-red-500">*</span>}</label>
                      <input
                        type="number"
                        min="1"
                        value={newAssessment.timeLimit}
                        onChange={(e) => setNewAssessment({ ...newAssessment, timeLimit: e.target.value })}
                        required={newAssessment.deliveryMode === 'ONLINE_EXAM'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={newAssessment.deliveryMode === 'ONLINE_EXAM' ? t('course.required') : t('course.optional')}
                      />
                    </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.maxScore')} {newAssessment.componentId && <span className="text-gray-400">({t('course.autoSetFromComponent')})</span>}</label>
                    <input
                      type="number"
                      min="1"
                      value={newAssessment.maxScore}
                      onChange={(e) => setNewAssessment({ ...newAssessment, maxScore: e.target.value })}
                      disabled={!!newAssessment.componentId}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('course.eg100')}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
                    >
                      {t('course.create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateAssessment(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Assessments List */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('nav.assessments')}</h2>
            {assessments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('course.noAssessmentsYet')}</h3>
                <p className="text-gray-500">
                  {user?.role === 'TEACHER' ? t('course.createFirstAssessment') : t('course.waitTeacherAssessments')}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assessments.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{a.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                              a.examType === 'QUIZ' ? 'bg-blue-50 text-blue-700' :
                              a.examType === 'ASSIGNMENT' ? 'bg-emerald-50 text-emerald-700' :
                              a.examType === 'MIDTERM' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {a.examType === 'QUIZ' ? t('course.quiz') : a.examType === 'ASSIGNMENT' ? t('course.assignment') : a.examType === 'MIDTERM' ? t('course.midterm') : a.examType === 'FINAL' ? t('course.final') : a.examType === 'CLASS_ACTIVITY' ? t('course.classActivity') : a.examType === 'LAB' ? t('course.lab') : a.examType === 'PROJECT' ? t('course.project') : a.examType === 'PRESENTATION' ? t('course.presentation') : a.examType}
                            </span>
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                              a.deliveryMode === 'ONLINE' || a.deliveryMode === 'ONLINE_EXAM' ? 'bg-purple-50 text-purple-700' :
                              'bg-orange-50 text-orange-700'
                            }`}>
                              {a.deliveryMode === 'ONLINE_EXAM' ? t('course.onlineExam') : a.deliveryMode === 'PAPER' ? t('course.paper') : t('course.online')}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                              a.isOpen ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                            }`}>
                              {a.isOpen ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {a.isOpen ? t('course.active') : t('course.inactive')}
                            </span>
                          </div>
                        </div>
                        <FileText className="w-5 h-5 text-gray-400" />
                      </div>
                      {editingAssessmentId === a.id && (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                          <h4 className="text-sm font-semibold text-gray-900">{t('course.editAssessment')}</h4>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-sm font-medium text-gray-700">{t('course.title')}</label>
                              <input
                                type="text"
                                value={editingAssessmentData.title}
                                onChange={(e) => setEditingAssessmentData({ ...editingAssessmentData, title: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">{t('course.timeLimit')}</label>
                              <input
                                type="number"
                                min="0"
                                value={editingAssessmentData.timeLimit}
                                onChange={(e) => setEditingAssessmentData({ ...editingAssessmentData, timeLimit: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg"
                                placeholder={t('course.minutes')}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">{t('course.maxScore')}</label>
                              <input
                                type="number"
                                min="1"
                                value={editingAssessmentData.maxScore}
                                onChange={(e) => setEditingAssessmentData({ ...editingAssessmentData, maxScore: e.target.value })}
                                disabled={!!editingAssessmentComponentId}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveAssessment(a.id)}
                              className="flex-1 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
                            >
                              {t('course.saveChanges')}
                            </button>
                            <button
                              onClick={cancelEditAssessment}
                              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                      {a.timeLimit && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {a.timeLimit} {t('course.min')}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                        <span className="font-medium">{t('course.maxScore')}:</span> {a.maxScore || 100}
                        {a.totalPoints !== undefined && a.totalPoints !== a.maxScore && (
                          <span className="ml-2 text-red-600 text-xs font-medium">
                            ({t('course.questionsTotal')}: {a.totalPoints} — {t('course.mustEqual')} {a.maxScore} {t('course.toOpen')})
                          </span>
                        )}
                        {a.totalPoints !== undefined && a.totalPoints === a.maxScore && (
                          <span className="ml-2 text-green-600 text-xs font-medium">
                            ✓ {t('course.pointsMatch')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      {user?.role === 'TEACHER' && (
                        <div className="space-y-2">
                          {a.deliveryMode !== 'PAPER' && a.deliveryMode !== 'MIXED' && (
                          <>
                          <button
                            onClick={() => handleToggleAssessment(a.id, !a.isOpen)}
                            disabled={!a.isOpen && !canActivateExam(a)}
                            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                              a.isOpen 
                                ? 'bg-red-50 hover:bg-red-100 text-red-700' 
                                : !canActivateExam(a)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {a.isOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {a.isOpen ? t('course.deactivate') : !canActivateExam(a) ? t('course.notScheduledYet') : t('course.activate')}
                          </button>
                          {!a.isOpen && !canActivateExam(a) && (
                            <p className="text-xs text-gray-500 text-center">
                              {a.scheduledStart
                                ? `${t('course.opensAt')} ${new Date(a.scheduledStart).toLocaleString()}`
                                : a.examSchedule?.officialDate || a.examSchedule?.confirmedDate
                                  ? `${t('course.examScheduledFor')} ${new Date(a.examSchedule.confirmedDate || a.examSchedule.officialDate).toLocaleString()} (${t('course.examPeriod')} ${a.examType === 'MIDTERM' && a.semester?.midtermExamStart ? `${new Date(a.semester.midtermExamStart).toLocaleDateString()} - ${new Date(a.semester.midtermExamEnd).toLocaleDateString()}` : a.examType === 'FINAL' && a.semester?.finalExamStart ? `${new Date(a.semester.finalExamStart).toLocaleDateString()} - ${new Date(a.semester.finalExamEnd).toLocaleDateString()}` : ''})`
                                  : !a.examSchedule
                                    ? t('course.noExamSchedule')
                                    : t('course.examDateNotArrived')}
                            </p>
                          )}
                          </>
                          )}
                          {a.deliveryMode !== 'PAPER' && a.deliveryMode !== 'MIXED' && (
                          <button
                            onClick={() => handleViewSubmissions(a)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-lg transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            {t('course.viewSubmissions')}
                          </button>
                          )}
                          <button
                            onClick={() => handleOpenGradeModal(a)}
                            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                              a.deliveryMode === 'PAPER' || a.deliveryMode === 'MIXED'
                                ? 'bg-primary-900 hover:bg-primary-800 text-white'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                            }`}
                          >
                            <Edit3 className="w-4 h-4" />
                            {t('course.enterGrades')}
                          </button>
                          {a.deliveryMode !== 'PAPER' && a.deliveryMode !== 'MIXED' && (
                          <button
                            onClick={() => toggleQuestionPanel(a)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            {selectedAssessment?.id === a.id ? t('course.close') : t('course.addQuestions')}
                          </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditAssessment(a)}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              {t('course.edit')}
                            </button>
                            <button
                              onClick={() => handleDeleteAssessment(a)}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      )}
                      {user?.role === 'STUDENT' && (
                        (() => {
                          const rejectedAttempt = studentAttempts.find(att => att.assessmentId === a.id && att.status === 'REJECTED');
                          const existingAttempt = studentAttempts.find(att => att.assessmentId === a.id && (att.status === 'SUBMITTED' || att.status === 'GRADED'));
                          const isPaper = a.deliveryMode === 'PAPER' || a.deliveryMode === 'MIXED';
                          return rejectedAttempt ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                <div className="flex items-center gap-2 text-red-700">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span className="text-sm font-medium">{t('course.rejectedFaceVerification')}</span>
                                </div>
                              </div>
                            </div>
                          ) : isPaper && !existingAttempt ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                <div className="flex items-center gap-2 text-orange-700">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-sm font-medium">{t('course.paperExamInfo')}</span>
                                </div>
                              </div>
                            </div>
                          ) : existingAttempt ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2 text-green-700">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm font-medium">{t('course.completed')}</span>
                                </div>
                                {existingAttempt.score !== null && (
                                  <span className="text-sm font-bold text-green-700">
                                    {t('grade.score')}: {existingAttempt.score}{existingAttempt.assessment?.maxScore ? `/${existingAttempt.assessment.maxScore}` : ` ${t('course.pts')}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : a.isOpen ? (
                            <button
                              onClick={() => handleStartAttempt(a.id)}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
                            >
                              <ListChecks className="w-4 h-4" />
                              {t('course.startExam')}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-red-500 text-sm">
                              <Lock className="w-4 h-4" />
                              {t('course.assessmentNotActivated')}
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Question Manager */}
                    {selectedAssessment?.id === a.id && (
                      <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{t('course.questionManager')}</h4>
                            <p className="text-sm text-gray-500">{t('course.questionManagerDesc')}</p>
                          </div>
                          {editingQuestion && (
                            <button
                              type="button"
                              onClick={handleCancelQuestionEdit}
                              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                            >
                              {t('course.cancelEdit')}
                            </button>
                          )}
                        </div>

                        {selectedAssessmentQuestions.length > 0 && (
                          <div className="space-y-3">
                            {selectedAssessmentQuestions.map((question, idx) => (
                              <div key={question.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                      <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">Q{idx + 1}</span>
                                      <span>{question.type}</span>
                                    </div>
                                    <p className="font-medium text-gray-900">{question.prompt}</p>
                                    <p className="mt-2 text-sm text-gray-500">{question.points} {question.points === 1 ? t('course.point') : t('course.points')}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => prepareEditQuestion(question)}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-sm"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                      {t('course.edit')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(question)}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      {t('common.delete')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-xl border border-gray-200 bg-white p-5">
                          <h5 className="text-base font-semibold text-gray-900 mb-4">
                            {editingQuestion ? t('course.editQuestion') : t('course.addQuestion')}
                          </h5>
                          <form onSubmit={handleSubmitQuestion} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.type')}</label>
                              <select
                                value={questionType}
                                onChange={(e) => {
                                  setQuestionType(e.target.value);
                                  setQuestionForm({ ...questionForm, type: e.target.value });
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                              >
                                <option value="MCQ">{t('course.multipleChoice')}</option>
                                <option value="FITB">{t('course.fillInTheBlank')}</option>
                                <option value="SHORT_ANSWER">{t('course.shortAnswer')}</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.prompt')}</label>
                              <textarea
                                value={questionForm.prompt}
                                onChange={(e) => setQuestionForm({ ...questionForm, prompt: e.target.value })}
                                required
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                placeholder={t('course.enterTheQuestion')}
                              />
                            </div>

                            {questionType === 'MCQ' && (
                              <div className="space-y-3">
                                {['A', 'B', 'C', 'D'].map((opt) => (
                                  <div key={opt} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] items-center">
                                    <span className="text-sm font-medium text-gray-700">{t('course.option')} {opt}</span>
                                    <input
                                      placeholder={`${t('course.option')} ${opt}`}
                                      value={questionForm[`option${opt}`]}
                                      onChange={(e) => setQuestionForm({ ...questionForm, [`option${opt}`]: e.target.value })}
                                      required
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                    />
                                  </div>
                                ))}
                                <select
                                  value={questionForm.correct}
                                  onChange={(e) => setQuestionForm({ ...questionForm, correct: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                >
                                  <option value="A">{t('course.correct')}: A</option>
                                  <option value="B">{t('course.correct')}: B</option>
                                  <option value="C">{t('course.correct')}: C</option>
                                  <option value="D">{t('course.correct')}: D</option>
                                </select>
                              </div>
                            )}

                            {questionType === 'FITB' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.correctAnswer')}</label>
                                <input
                                  placeholder={t('course.correctAnswer')}
                                  value={questionForm.correctAnswer}
                                  onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                                  required
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                />
                              </div>
                            )}

                            {questionType === 'SHORT_ANSWER' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.modelAnswer')}</label>
                                <textarea
                                  placeholder={t('course.modelAnswerGradingRef')}
                                  value={questionForm.modelAnswer}
                                  onChange={(e) => setQuestionForm({ ...questionForm, modelAnswer: e.target.value })}
                                  required
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                />
                              </div>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <div className="sm:flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('course.points')}</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={questionForm.points}
                                  onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 1 })}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                />
                              </div>
                              <button
                                type="submit"
                                className="w-full sm:w-auto px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
                              >
                                {editingQuestion ? t('course.updateQuestion') : t('course.addQuestion')}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
              </div>
            ))}
            </div>
          )}
          </>
        )}

        {/* Students Tab (Teacher only) */}
        {activeTab === 'students' && user?.role === 'TEACHER' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('course.enrolledStudents')}</h2>
              {teacherSections.length > 1 && (
                <select
                  value={selectedSectionId || ''}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {teacherSections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.sectionCode} - {s.class?.name || s.semester?.name || 'No class'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {students.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('course.noStudentsEnrolled')}</h3>
                <p className="text-gray-500">{t('course.studentsAppearHere')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('nav.students')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('course.email')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('course.class')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 font-medium text-sm">
                                {student.fullName?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{student.fullName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.className}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Manual Grade Entry Modal */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t('course.enterGrades')}: {showGradeModal.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('course.maxScore')}: {showGradeModal.maxScore || 100}</p>
              </div>
              <button
                onClick={() => setShowGradeModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-auto flex-1 p-6">
              {students.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('course.noStudentsInCourse')}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('nav.students')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">{t('grade.score')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('course.feedback')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">{t('course.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 font-medium text-sm">
                                {student.fullName?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{student.fullName}</p>
                              <p className="text-xs text-gray-500">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={showGradeModal.maxScore || 100}
                              value={manualGrades[student.id]?.score || ''}
                              onChange={(e) => setManualGrades({
                                ...manualGrades,
                                [student.id]: {
                                  ...manualGrades[student.id],
                                  score: e.target.value
                                }
                              })}
                              className="w-20 px-2 py-1 border border-gray-200 rounded text-center"
                              placeholder="0"
                            />
                            <span className="text-gray-500 text-sm">/ {showGradeModal.maxScore || 100}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={manualGrades[student.id]?.feedback || ''}
                            onChange={(e) => setManualGrades({
                              ...manualGrades,
                              [student.id]: {
                                ...manualGrades[student.id],
                                feedback: e.target.value
                              }
                            })}
                            className="w-full px-2 py-1 border border-gray-200 rounded"
                            placeholder={t('course.optionalFeedback')}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleSaveManualGrade(student.id)}
                            disabled={!manualGrades[student.id]?.score}
                            className="px-3 py-1 bg-primary-900 hover:bg-primary-800 disabled:bg-gray-300 text-white text-sm font-medium rounded"
                          >
                            {t('course.save')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => setShowGradeModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveAllGrades}
                className="px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg"
              >
                {t('course.saveAllGrades')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {submissionsAssessment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t('course.submissions')}: {submissionsAssessment.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">{submissions.length} {t('course.submittedAttempts')}</p>
                </div>
                <button
                  onClick={() => {
                    setSubmissionsAssessment(null);
                    setSubmissions([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {submissions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('course.noSubmissionsYet')}</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">{t('nav.students')}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">{t('course.submitted')}</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">{t('grade.score')}</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">{t('course.faceVerified')}</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">{t('course.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {submissions.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 font-medium text-sm">
                                {attempt.student?.fullName?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{attempt.student?.fullName}</p>
                              <p className="text-xs text-gray-500">{attempt.student?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {attempt.status === 'REJECTED' ? (
                            <span className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-700">
                              {t('course.rejected')} (0)
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              attempt.score !== null ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {attempt.score !== null && submissionsAssessment?.maxScore ? `${attempt.score}/${submissionsAssessment.maxScore}` : attempt.score !== null ? `${attempt.score}` : t('course.pending')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {attempt.faceVerification ? (
                            attempt.faceVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                <CheckCircle className="w-3 h-3" />
                                {t('course.verified')}
                              </span>
                            ) : attempt.faceVerification.adminReviewed && !attempt.faceVerification.adminApproved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                <XCircle className="w-3 h-3" />
                                {t('course.rejected')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                <AlertCircle className="w-3 h-3" />
                                {t('course.pendingReview')}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">{t('course.noCheck')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {attempt.faceVerification && !attempt.faceVerification.matchResult && (!attempt.faceVerification.adminReviewed || !attempt.faceVerification.adminApproved) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                              <AlertCircle className="w-3 h-3" />
                              {!attempt.faceVerification.adminReviewed ? t('course.faceMismatchGradingBlocked') : t('course.faceRejectedGradingBlocked')}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setSubmissionsAssessment(null);
                                setSubmissions([]);
                                handleOpenGrading(attempt);
                              }}
                              className="px-3 py-1 bg-primary-900 hover:bg-primary-800 text-white text-sm font-medium rounded"
                            >
                              {t('course.grade')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {showReportModal && reportingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('course.reportQuestion')}</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportingQuestion(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">{reportingQuestion.prompt}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('course.whyIncorrectQuestion')}
                </label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={t('course.explainIssueMin10')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportingQuestion(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReportQuestion}
                  disabled={submittingReport || reportReason.trim().length < 10}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingReport ? t('course.submitting') : t('course.submitReport')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Preview Modal */}
      {previewMaterial && (
        <div id="preview-modal" className={`${isFullscreen ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'}`}>
          {/* Video Face Tracking for students watching uploaded videos */}
          {videoFaceTracking && user?.role === 'STUDENT' && (
            <FaceTracker
              active={videoFaceTracking}
              materialId={previewMaterial.id}
              profileImage={profileImage}
              onMismatch={() => setVideoFaceMismatch(true)}
              intervalMs={60000}
            />
          )}
          {/* Video Face Mismatch Warning */}
          {videoFaceMismatch && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-lg max-w-md">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">{t('course.faceVerificationAlert')}</p>
                  <p className="text-sm text-yellow-700">{t('course.videoFaceMismatchDetected')}</p>
                </div>
              </div>
            </div>
          )}
          <div className={`bg-white dark:bg-gray-800 ${isFullscreen ? 'w-full h-full' : 'rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh]'} flex flex-col`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${isFullscreen ? 'hidden' : ''}`}>
              <div className="flex items-center gap-3">
                {previewMaterial.fileType === 'video' ? (
                  <ExternalLink className="w-5 h-5 text-purple-500" />
                ) : previewMaterial.fileType === 'pdf' ? (
                  <FileText className="w-5 h-5 text-red-500" />
                ) : previewMaterial.fileType === 'ppt' ? (
                  <FileText className="w-5 h-5 text-orange-500" />
                ) : previewMaterial.fileType === 'doc' ? (
                  <FileText className="w-5 h-5 text-blue-500" />
                ) : previewMaterial.fileType === 'link' ? (
                  <LinkIcon className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileText className="w-5 h-5 text-gray-500" />
                )}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{previewMaterial.title}</h2>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                  {previewMaterial.fileType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                  title={isFullscreen ? t('course.exitFullscreen') : t('course.fullscreen')}
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleClosePreview()}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Floating fullscreen buttons */}
            {isFullscreen && (
              <div className="fixed top-4 right-4 z-[60] flex gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-white/90 hover:bg-white shadow-lg rounded-lg text-gray-700"
                  title={t('course.exitFullscreen')}
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleClosePreview()}
                  className="p-2 bg-white/90 hover:bg-white shadow-lg rounded-lg text-gray-700"
                  title={t('course.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4">
              {/* Text Content */}
              {previewMaterial.fileType === 'text' && previewMaterial.content && (
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                    {previewMaterial.content}
                  </div>
                </div>
              )}

              {/* Video - YouTube/Vimeo embed */}
              {previewMaterial.fileType === 'video' && previewMaterial.fileUrl && (
                <div className="w-full">
                  {(() => {
                    const url = previewMaterial.fileUrl;
                    // YouTube
                    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
                    if (ytMatch) {
                      return (
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            className="absolute inset-0 w-full h-full rounded-lg"
                            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                            title={previewMaterial.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      );
                    }
                    // Vimeo
                    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                    if (vimeoMatch) {
                      return (
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            className="absolute inset-0 w-full h-full rounded-lg"
                            src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                            title={previewMaterial.title}
                            frameBorder="0"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      );
                    }
                    // Direct video URL (mp4, webm, etc.) or uploaded base64 data URL
                    if (url.match(/\.(mp4|webm|ogg)$/i) || url.startsWith('data:video/')) {
                      return (
                        <video controls className="w-full rounded-lg max-h-[70vh]" autoPlay>
                          <source src={url} />
                          Your browser does not support the video tag.
                        </video>
                      );
                    }
                    // Fallback: open in iframe
                    return (
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full rounded-lg"
                          src={url}
                          title={previewMaterial.title}
                          frameBorder="0"
                          allowFullScreen
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* PDF - displayed inline via /preview endpoint */}
              {previewMaterial.fileType === 'pdf' && previewMaterial.fileUrl && (
                <div className="w-full" style={{ height: '75vh' }}>
                  <iframe
                    src={`${API_BASE}/materials/${previewMaterial.id}/preview`}
                    className="w-full h-full rounded-lg border-0"
                    title={previewMaterial.title}
                  />
                </div>
              )}

              {/* XLS / XLSX - Converted to PDF and displayed inline via /preview endpoint */}
              {(previewMaterial.fileType === 'xls' || previewMaterial.fileType === 'xlsx') && previewMaterial.fileUrl && (
                <div className="w-full" style={{ height: '75vh' }}>
                  <iframe
                    src={`${API_BASE}/materials/${previewMaterial.id}/preview`}
                    className="w-full h-full rounded-lg border-0"
                    title={previewMaterial.title}
                  />
                </div>
              )}

              {/* External Link - embed in iframe */}
              {previewMaterial.fileType === 'link' && previewMaterial.fileUrl && (
                <div className="w-full" style={{ height: '75vh' }}>
                  <iframe
                    src={previewMaterial.fileUrl}
                    className="w-full h-full rounded-lg border-0"
                    title={previewMaterial.title}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                </div>
              )}

              {/* Fallback for content-only materials */}
              {!previewMaterial.fileUrl && previewMaterial.content && previewMaterial.fileType !== 'text' && (
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                    {previewMaterial.content}
                  </div>
                </div>
              )}

              {/* No preview available */}
              {!previewMaterial.fileUrl && !previewMaterial.content && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <FileText className="w-16 h-16 text-gray-300" />
                  <p className="text-gray-500">{t('course.noPreviewAvailable')}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400">
                {t('course.addedBy')} {previewMaterial.author?.fullName || t('course.unknown')} {t('course.on')} {new Date(previewMaterial.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                {previewMaterial.fileUrl && (
                  <a
                    href={previewMaterial.fileUrl.startsWith('data:')
                      ? `${API_BASE}/materials/${previewMaterial.id}/file`
                      : previewMaterial.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg text-sm inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('course.openInNewTab')}
                  </a>
                )}
                <button
                  onClick={() => handleClosePreview()}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg text-sm"
                >
                  {t('course.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HTML Reader Modal - supports all material types with tracking */}
      {htmlReaderMaterial && (
        <div id="html-reader-modal" className={`${isFullscreen ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2'}`}>
          {/* Video Face Tracking for students watching uploaded videos */}
          {videoFaceTracking && user?.role === 'STUDENT' && (
            <FaceTracker
              active={videoFaceTracking}
              materialId={htmlReaderMaterial.id}
              profileImage={profileImage}
              onMismatch={() => setVideoFaceMismatch(true)}
              intervalMs={60000}
            />
          )}
          {/* Video Face Mismatch Warning */}
          {videoFaceMismatch && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-lg max-w-md">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">{t('course.faceVerificationAlert')}</p>
                  <p className="text-sm text-yellow-700">{t('course.videoFaceMismatchDetected')}</p>
                </div>
              </div>
            </div>
          )}
          <div className={`bg-white dark:bg-gray-800 ${isFullscreen ? 'w-full h-full' : 'rounded-xl shadow-2xl w-full h-full max-w-[95vw]'} flex flex-col`}>
            {/* Header - hidden in fullscreen */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${isFullscreen ? 'hidden' : ''}`}>
              <div className="flex items-center gap-3">
                <ReadIcon className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{htmlReaderMaterial.title}</h2>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                  {t('course.trackedReader')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                  title={isFullscreen ? t('course.exitFullscreen') : t('course.fullscreen')}
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleCloseHtmlReader()}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Floating exit button for fullscreen */}
            {isFullscreen && (
              <div className="fixed top-4 right-4 z-[60] flex gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-white/90 hover:bg-white shadow-lg rounded-lg text-gray-700"
                  title={t('course.exitFullscreen')}
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleCloseHtmlReader()}
                  className="p-2 bg-white/90 hover:bg-white shadow-lg rounded-lg text-gray-700"
                  title={t('course.closeReader')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content - renders based on material type */}
            <div className="flex-1 overflow-hidden bg-white">
              {htmlLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500">{t('course.loadingReader')}</p>
                  </div>
                </div>
              ) : htmlContent ? (
                /* PPTX/PPT HTML content */
                <iframe
                  srcDoc={htmlContent}
                  className="w-full h-full border-0"
                  style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}
                  title={htmlReaderMaterial.title}
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : htmlReaderMaterial.fileType === 'text' ? (
                /* Text content */
                <div className="p-6 overflow-auto" style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                      {htmlReaderMaterial.content}
                    </div>
                  </div>
                </div>
              ) : htmlReaderMaterial.fileType === 'pdf' && htmlReaderMaterial.fileUrl ? (
                /* PDF via preview endpoint */
                <iframe
                  src={`${API_BASE}/materials/${htmlReaderMaterial.id}/preview`}
                  className="w-full h-full border-0"
                  style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}
                  title={htmlReaderMaterial.title}
                />
              ) : (htmlReaderMaterial.fileType === 'xls' || htmlReaderMaterial.fileType === 'xlsx') && htmlReaderMaterial.fileUrl ? (
                /* Excel via preview endpoint */
                <iframe
                  src={`${API_BASE}/materials/${htmlReaderMaterial.id}/preview`}
                  className="w-full h-full border-0"
                  style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}
                  title={htmlReaderMaterial.title}
                />
              ) : htmlReaderMaterial.fileType === 'video' && htmlReaderMaterial.fileUrl ? (
                /* Video embed */
                <div className="flex items-center justify-center h-full" style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}>
                  {(() => {
                    const url = htmlReaderMaterial.fileUrl;
                    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
                    if (ytMatch) {
                      return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytMatch[1]}`} title={htmlReaderMaterial.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
                    }
                    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                    if (vimeoMatch) {
                      return <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} title={htmlReaderMaterial.title} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen />;
                    }
                    if (url.match(/\.(mp4|webm|ogg)$/i) || url.startsWith('data:video/')) {
                      return <video controls className="w-full h-full" autoPlay><source src={url} />Your browser does not support the video tag.</video>;
                    }
                    return <iframe className="w-full h-full" src={url} title={htmlReaderMaterial.title} allowFullScreen />;
                  })()}
                </div>
              ) : htmlReaderMaterial.fileType === 'link' && htmlReaderMaterial.fileUrl ? (
                /* External link embed */
                <iframe
                  src={htmlReaderMaterial.fileUrl}
                  className="w-full h-full border-0"
                  style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}
                  title={htmlReaderMaterial.title}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              ) : htmlReaderMaterial.content ? (
                /* Fallback: show text content */
                <div className="p-6 overflow-auto" style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 140px)' }}>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                      {htmlReaderMaterial.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-red-500">{t('course.noContentAvailable')}</p>
                </div>
              )}
            </div>

            {/* Footer - hidden in fullscreen */}
            <div className={`flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 ${isFullscreen ? 'hidden' : ''}`}>
              <p className="text-xs text-gray-400">
                {t('course.readingTimeTracked')}
              </p>
              <button
                onClick={() => handleCloseHtmlReader()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg text-sm"
              >
                {t('course.closeReader')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Tracking Stats Modal */}
      {showVideoTracking && videoTrackingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{videoTrackingData.materialTitle}</h2>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">{t('course.tracked')}</span>
              </div>
              <button onClick={() => { setShowVideoTracking(false); setVideoTrackingData(null); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{videoTrackingData.viewCount}/{videoTrackingData.totalStudents}</p>
                <p className="text-xs text-gray-500">{t('course.studentsViewed')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{videoTrackingData.viewPercent}%</p>
                <p className="text-xs text-gray-500">{t('course.viewPercent')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{videoTrackingData.faceMatched}</p>
                <p className="text-xs text-gray-500">{t('course.faceMatched')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{videoTrackingData.faceMismatched}</p>
                <p className="text-xs text-gray-500">{t('course.faceMismatched')}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{t('course.viewProgress')}</span>
                <span className="text-sm text-gray-500">{videoTrackingData.viewPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${videoTrackingData.viewPercent}%` }}></div>
              </div>
            </div>

            {/* Student Table */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('course.student')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">{t('course.viewed')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">{t('course.duration')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">{t('course.faceStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {videoTrackingData.students.map(s => (
                    <tr key={s.studentId} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{s.studentName}</td>
                      <td className="px-3 py-2 text-center">
                        {s.openedAt ? (
                          <CheckCircle className="w-4 h-4 text-green-500 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 inline" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">
                        {s.durationSec ? `${Math.round(s.durationSec / 60)}min` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.faceVerified === null ? (
                          <span className="text-gray-400">—</span>
                        ) : s.faceVerified ? (
                          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> {t('course.matched')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /> {t('course.mismatched')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => { setShowVideoTracking(false); setVideoTrackingData(null); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
