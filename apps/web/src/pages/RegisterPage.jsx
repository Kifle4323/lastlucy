import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';
import { useTheme } from '../ThemeContext';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Mail, Lock, User, AlertCircle, Users, Sun, Moon, CheckCircle, Check, X, Phone } from 'lucide-react';
import lucyLogo from '../assets/lucy_logobg.png';

// Password validation helper
function validatePassword(password) {
  const checks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  return {
    checks,
    isValid: Object.values(checks).every(Boolean),
  };
}

// Password requirement check component
function PasswordCheck({ valid, text }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {valid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      <span>{text}</span>
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    role: 'STUDENT',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { checks, isValid } = validatePassword(form.password);
  const passwordsMatch = form.password === form.confirmPassword && form.confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errors = {};

    if (!form.fullName.trim()) errors.fullName = t('register.fullNameRequired');
    else if (/\d/.test(form.fullName)) errors.fullName = t('register.nameNoNumbers');
    if (!form.email.trim()) errors.email = t('register.emailRequired');
    if (form.email.includes('@')) errors.email = t('register.noAtInEmail');
    if (!isValid) errors.password = t('register.passwordRequirements');
    if (form.password !== form.confirmPassword) errors.confirmPassword = t('register.passwordsDoNotMatch');
    if (form.role === 'STUDENT') {
      if (!form.phone.trim()) errors.phone = t('register.phoneRequired');
      else if (!/^9\d{8}$/.test(form.phone.replace(/[\s\-()]/g, ''))) errors.phone = t('register.invalidPhone');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    
    setLoading(true);
    try {
      const result = await register({ ...form, email: form.email.split('@')[0] });
      setSuccess(t('register.accountCreatedApproval'));
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || t('register.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:bg-primary-950 dark:via-gray-900 dark:to-primary-950 flex items-center justify-center p-4 transition-colors">
      {/* Theme toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all"
        title={darkMode ? t('register.switchToLight') : t('register.switchToDark')}
      >
        {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4 p-2">
            <img src={lucyLogo} alt="Lucy College" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-white">{t('register.lucyCollege')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('auth.registerTitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('register.fullName')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => { setForm({ ...form, fullName: e.target.value.replace(/[^a-zA-Z\s\u1200-\u137F\u1380-\u139F\u2C80-\u2CFF]/g, '') }); setFieldErrors({ ...fieldErrors, fullName: '' }); }}
                  required
                  className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white ${fieldErrors.fullName ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500'}`}
                  placeholder={t('register.fullNamePlaceholder')}
                />
              </div>
              {fieldErrors.fullName && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors({ ...fieldErrors, email: '' }); }}
                  required
                  className={`w-full pl-11 pr-24 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white ${fieldErrors.email ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500'}`}
                  placeholder={t('register.emailPlaceholder')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium">@lucy.edu</span>
              </div>
              {fieldErrors.email && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setFieldErrors({ ...fieldErrors, password: '' }); }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white ${fieldErrors.password ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500'}`}
                  placeholder={t('register.createPassword')}
                />
              </div>
              {fieldErrors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.password}</p>}
              {/* Password requirements */}
              {passwordFocused && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
                  <PasswordCheck valid={checks.length} text={t('register.atLeast6Chars')} />
                  <PasswordCheck valid={checks.uppercase} text={t('register.atLeastOneUppercase')} />
                  <PasswordCheck valid={checks.lowercase} text={t('register.atLeastOneLowercase')} />
                  <PasswordCheck valid={checks.number} text={t('register.atLeastOneNumber')} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => { setForm({ ...form, confirmPassword: e.target.value }); setFieldErrors({ ...fieldErrors, confirmPassword: '' }); }}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  required
                  className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white ${
                    fieldErrors.confirmPassword ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : form.confirmPassword && (passwordsMatch 
                      ? 'border-green-500 dark:border-green-400 focus:ring-green-500' 
                      : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500')
                  }`}
                  placeholder={t('register.confirmYourPassword')}
                />
                {form.confirmPassword && !fieldErrors.confirmPassword && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch 
                      ? <Check className="w-5 h-5 text-green-500" />
                      : <X className="w-5 h-5 text-red-500" />
                    }
                  </div>
                )}
              </div>
              {(fieldErrors.confirmPassword || (form.confirmPassword && !passwordsMatch)) && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.confirmPassword || t('register.passwordsDoNotMatch')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('register.iAmA')}</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none"
                >
                  <option value="STUDENT">{t('register.student')}</option>
                  <option value="TEACHER">{t('register.teacher')}</option>
                </select>
              </div>
            </div>

            {form.role === 'STUDENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('register.phoneNumber')} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <span className="absolute left-11 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">+251</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => { setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') }); setFieldErrors({ ...fieldErrors, phone: '' }); }}
                    required={form.role === 'STUDENT'}
                    className={`w-full pl-[5.5rem] pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white ${fieldErrors.phone ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500'}`}
                    placeholder="9XX XXX XXXX"
                  />
                </div>
                {fieldErrors.phone ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.phone}</p> : <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('register.phoneNote')}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('register.creatingAccount') : t('register.createAccount')}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary-900 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
