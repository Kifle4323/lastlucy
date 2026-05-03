import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAvailableCourses, registerForSemester, getStudentProfile, initializePayment, verifyPayment, getPaymentStatus, getStudentRegistrationFee } from '../api.js';
import Layout from '../components/Layout';
import { AlertCircle, FileText, CreditCard, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmContext';
import { useTranslation } from 'react-i18next';

export default function StudentRegistrationPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileStatus, setProfileStatus] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // { isPaid, status, payment }
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [autoFee, setAutoFee] = useState(null); // { fee, department, semesterCreditHours, pricePerCreditHour }

  useEffect(() => {
    loadData();
  }, []);

  // Handle payment return redirect from Chapa
  useEffect(() => {
    const txRef = searchParams.get('tx_ref') || searchParams.get('txRef');
    if (txRef) {
      handlePaymentReturn(txRef);
    }
  }, [searchParams]);

  async function loadData() {
    try {
      const [result, profile] = await Promise.all([
        getAvailableCourses(),
        getStudentProfile().catch(() => null)
      ]);
      setData(result);
      setProfileStatus(profile?.status || null);

      // Check auto-calculated fee from department first
      let feeInfo = null;
      try {
        feeInfo = await getStudentRegistrationFee();
        if (feeInfo?.hasDepartment && feeInfo?.fee > 0) {
          setAutoFee(feeInfo);
        }
      } catch (err) {
        console.log('No department fee info:', err.message);
      }

      // Always check payment status if semester exists and fee > 0
      const hasFee = result?.semester?.registrationFee > 0 || (feeInfo?.hasDepartment && feeInfo?.fee > 0);
      if (hasFee && result?.semester?.id) {
        try {
          const payment = await getPaymentStatus(result.semester.id);
          setPaymentStatus(payment);
        } catch (err) {
          console.error('Failed to check payment status:', err);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentReturn(txRef) {
    setVerifyingPayment(true);
    try {
      // Retry verification up to 3 times with delay (Chapa may take a moment)
      let result = null;
      for (let i = 0; i < 3; i++) {
        try {
          result = await verifyPayment(txRef);
          if (result.payment?.status === 'COMPLETED') break;
          if (i < 2) await new Promise(r => setTimeout(r, 2000)); // wait 2s between retries
        } catch (err) {
          if (i < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (result?.payment?.status === 'COMPLETED') {
        toast.success(t('semesterReg.paymentCompleted'));
        setPaymentStatus({ isPaid: true, status: 'COMPLETED', payment: result.payment });
      } else if (result?.payment?.status === 'FAILED') {
        toast.error(t('semesterReg.paymentFailed'));
        setPaymentStatus({ isPaid: false, status: 'FAILED', payment: result.payment });
      } else {
        toast.info(t('semesterReg.paymentProcessing'));
        setPaymentStatus({ isPaid: false, status: 'PENDING', payment: result?.payment || null });
      }
      // Reload data
      await loadData();
    } catch (err) {
      toast.error(t('semesterReg.failedVerifyPayment') + ': ' + (err.message || t('common.error')));
    } finally {
      setVerifyingPayment(false);
    }
  }

  async function handlePayNow() {
    if (!data?.semester) return;
    setPaymentLoading(true);
    try {
      const result = await initializePayment(data.semester.id);
      if (result.checkoutUrl) {
        // Redirect to Chapa checkout
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      toast.error(t('semesterReg.failedInitPayment') + ': ' + err.message);
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleRegister() {
    const confirmed = await confirm({
      title: t('semesterReg.registerForCourses'),
      message: t('semesterReg.registerForAllConfirm'),
      confirmText: t('auth.register'),
      cancelText: t('common.cancel'),
      type: 'info',
    });
    if (!confirmed) return;
    
    setRegistering(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await registerForSemester();
      toast.success(result.message || t('semesterReg.registrationSuccess'));
      setSuccess(result.message || t('semesterReg.registrationSuccess'));
      loadData();
    } catch (err) {
      if (err.message) {
        setError(err.message);
        toast.error(err.message);
      }
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return <Layout><div className="p-8">{t('common.loading')}</div></Layout>;

  const { semester, class: studentClass, courses, message } = data || {};

  // Profile not submitted - must complete profile first
  if (!profileStatus || profileStatus === 'DRAFT') {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">{t('semesterReg.completeProfileFirst')}</h2>
                <p className="text-yellow-700 dark:text-yellow-400 mb-4">
                  {t('semesterReg.completeProfileDesc')}
                </p>
                <Link
                  to="/student-profile"
                  className="inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  {t('semesterReg.completeProfile')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Profile pending approval
  if (profileStatus === 'PENDING_APPROVAL') {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">{t('semesterReg.profilePendingApproval')}</h2>
                <p className="text-blue-700 dark:text-blue-400">
                  {t('semesterReg.profilePendingDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Profile rejected
  if (profileStatus === 'REJECTED') {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">{t('semesterReg.profileRejected')}</h2>
                <p className="text-red-700 dark:text-red-400 mb-4">
                  {t('semesterReg.profileRejectedDesc')}
                </p>
                <Link
                  to="/student-profile"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  {t('semesterReg.updateProfile')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // No semester open for registration
  if (!semester) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
            <p className="text-yellow-700 dark:text-yellow-400">{t('semesterReg.noSemesterOpen')}</p>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">{t('semesterReg.checkBackLater')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Student not assigned to a class
  if (message || !studentClass) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{semester.name}</h2>
            <p className="text-blue-700 dark:text-blue-400">{message || t('semesterReg.notAssignedToClass')}</p>
            <p className="text-sm text-blue-600 dark:text-blue-500 mt-2">{t('semesterReg.contactRegistrar')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const allEnrolled = courses.every(c => c.isEnrolled);
  const someEnrolled = courses.some(c => c.isEnrolled);

  // Fee is auto-calculated from department price per credit hour × semester credit hours
  const effectiveFee = autoFee?.fee > 0 ? autoFee.fee : 0;
  const feeSource = autoFee?.fee > 0 ? 'department' : null;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('semesterReg.semesterRegistration')}</h1>

      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 p-3 rounded-lg mb-4">{success}</div>}

      {/* Semester Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{semester.name}</h2>
            <p className="text-gray-500 dark:text-gray-400">{semester.academicYear?.name}</p>
          </div>
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
            {t('semesterReg.registrationOpen')}
          </span>
        </div>
        
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            <div className="text-gray-500 dark:text-gray-400">{t('semesterReg.registrationPeriod')}</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {semester.registrationStart && semester.registrationEnd
                ? `${new Date(semester.registrationStart).toLocaleDateString()} - ${new Date(semester.registrationEnd).toLocaleDateString()}`
                : t('semesterReg.notSpecified')}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            <div className="text-gray-500 dark:text-gray-400">{t('semesterReg.yourClass')}</div>
            <div className="font-medium text-gray-900 dark:text-white">{studentClass.name} ({studentClass.code})</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-3">
            <div className="text-yellow-600 dark:text-yellow-400">{t('course.midterm')}</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {semester.midtermExamDate
                ? new Date(semester.midtermExamDate).toLocaleDateString()
                : t('grade.notSet')}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 rounded p-3">
            <div className="text-red-600 dark:text-red-400">{t('course.final')}</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {semester.finalExamDate
                ? new Date(semester.finalExamDate).toLocaleDateString()
                : t('grade.notSet')}
            </div>
          </div>
        </div>

        {/* Registration Fee & Payment Status */}
        <div className="mt-4 border-t dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('semesterReg.registrationFee')} {feeSource === 'department' && <span className="text-xs">({t('semesterReg.autoCalculated')})</span>}</p>
              {effectiveFee > 0 ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">ETB {effectiveFee?.toLocaleString()}</p>
                  {feeSource === 'department' && autoFee && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{autoFee.semesterCreditHours} {t('semesterReg.ch')} × ETB {autoFee.pricePerCreditHour}/{t('semesterReg.ch')}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('semesterReg.noDepartmentFee')}</p>
              )}
            </div>
            <div>
              {effectiveFee > 0 ? (
                paymentStatus?.isPaid ? (
                  <span className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg text-sm font-medium">
                    <CheckCircle className="w-5 h-5" />
                    {t('semesterReg.paid')}
                  </span>
                ) : paymentStatus?.status === 'PENDING' ? (
                  <span className="inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium">
                    <Clock className="w-5 h-5" />
                    {t('semesterReg.paymentPending')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium">
                    <CreditCard className="w-5 h-5" />
                    {t('semesterReg.unpaid')}
                  </span>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Courses Assigned to Class */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('semesterReg.coursesAssignedToClass')}</h3>
        
        {courses.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('semesterReg.noCoursesAssigned')}</p>
        ) : (
          <div className="space-y-3">
            {courses.map(course => (
              <div key={course.id} className={`border rounded-lg p-4 ${course.alreadyPassed ? 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60' : course.isEnrolled ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{course.course?.code} - {course.course?.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('course.teacher')}: {course.teacher?.fullName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('semesterReg.section')}: {course.sectionCode}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {t('course.creditHours')}: {course.course?.creditHours || 3}
                    </p>
                  </div>
                  {course.alreadyPassed ? (
                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded text-xs">
                      {t('semesterReg.alreadyPassed')}
                    </span>
                  ) : course.isEnrolled ? (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded text-xs">
                      {t('semesterReg.enrolled')}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          <strong>{t('semesterReg.totalCourses')}:</strong> {courses.length} | 
          <strong className="ml-2">{t('course.creditHours')}:</strong> {courses.reduce((sum, c) => sum + (c.course?.creditHours || 3), 0)}
        </div>
      </div>

      {/* Payment & Registration Steps */}
      {!allEnrolled && courses.length > 0 && (
        <div className="space-y-4">
          {/* Step 2: Register (if no fee, or paid, or payment system unavailable) */}
          {(effectiveFee <= 0 || paymentStatus?.isPaid) && (
            <div className="flex justify-center">
              <button
                onClick={handleRegister}
                disabled={registering}
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg disabled:bg-gray-400 text-lg font-medium transition-colors"
              >
                {registering ? t('semesterReg.registering') : someEnrolled ? t('semesterReg.completeRegistration') : t('semesterReg.registerForSemester')}
              </button>
            </div>
          )}

          {/* If fee exists but not paid, and payment system is available, show pay button */}
          {effectiveFee > 0 && !paymentStatus?.isPaid && (
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <CreditCard className="w-8 h-8 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-1">{t('semesterReg.step1PayFee')}</h3>
                  <p className="text-orange-700 dark:text-orange-400 text-sm mb-3">
                    {t('semesterReg.mustPayFee')} <strong>ETB {effectiveFee?.toLocaleString()}</strong> {t('semesterReg.beforeRegister')}
                    {feeSource === 'department' && autoFee && (
                      <span className="block text-xs mt-1">{autoFee.semesterCreditHours} {t('semesterReg.creditHoursLower')} × ETB {autoFee.pricePerCreditHour}/{t('semesterReg.creditHour')}</span>
                    )}
                  </p>
                  {verifyingPayment ? (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                      {t('semesterReg.verifyingPayment')}
                    </div>
                  ) : paymentStatus?.status === 'PENDING' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        {t('semesterReg.pendingPaymentVerify')}
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => paymentStatus?.payment?.checkoutUrl && (window.location.href = paymentStatus.payment.checkoutUrl)}
                          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          {t('semesterReg.resumePayment')}
                        </button>
                        <button
                          onClick={() => handlePaymentReturn(paymentStatus?.payment?.txRef)}
                          disabled={verifyingPayment}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm"
                        >
                          {t('semesterReg.verifyPayment')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handlePayNow}
                      disabled={paymentLoading}
                      className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-400"
                    >
                      {paymentLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {t('semesterReg.processing')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          {t('semesterReg.payWithChapa', { amount: effectiveFee?.toLocaleString() })}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment completed message */}
          {effectiveFee > 0 && paymentStatus?.isPaid && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-green-700 dark:text-green-400 font-medium">{t('semesterReg.paymentConfirmedRegister')}</p>
                {paymentStatus?.payment?.paidAt && (
                  <p className="text-green-600 dark:text-green-500 text-sm">{t('semesterReg.paidOn')} {new Date(paymentStatus.payment.paidAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {allEnrolled && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
          <p className="text-green-700 dark:text-green-400 font-medium">{t('semesterReg.registeredAllCourses')}</p>
        </div>
      )}
      </div>
    </Layout>
  );
}
