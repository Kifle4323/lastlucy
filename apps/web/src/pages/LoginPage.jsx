import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Mail, Lock, AlertCircle, Sun, Moon, Clock, Globe } from 'lucide-react';
import lucyLogo from '../assets/lucy_logobg.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsPending(false);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.message?.includes('pending') || err.message?.includes('approval')) {
        setIsPending(true);
      }
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:bg-primary-950 dark:via-gray-900 dark:to-primary-950 flex items-center justify-center p-4 transition-colors">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <select
          value={i18n.language}
          onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('lang', e.target.value); }}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md text-sm border-0 outline-none cursor-pointer"
        >
          <option value="en">English</option>
          <option value="am">አማርኛ</option>
          <option value="om">Afaan Oromoo</option>
        </select>
        <button
          onClick={toggleDarkMode}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4 p-2">
            <img src={lucyLogo} alt="Lucy College" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-white">Lucy College</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('auth.loginTitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          {error && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
              isPending 
                ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400' 
                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            }`}>
              {isPending ? <Clock className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder={t('register.emailPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary-900 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
