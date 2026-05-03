import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { getAuditLogs } from '../api';
import Layout from '../components/Layout';
import {
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  BookOpen,
  GraduationCap,
  Calendar,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  FileText,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ACTION_ICONS = {
  LOGIN: LogIn,
  LOGIN_FAILED: AlertTriangle,
  LOGOUT: LogOut,
  REGISTER: User,
  CREATE: FileText,
  UPDATE: FileText,
  DELETE: XCircle,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  ENROLL: GraduationCap,
  UNENROLL: XCircle,
  GRADE_SUBMIT: ClipboardList,
  GRADE_PUBLISH: CheckCircle,
  SEMESTER_REGISTER: Calendar,
  ADD_DROP_REQUEST: ClipboardList,
  ADD_DROP_APPROVE: CheckCircle,
  ADD_DROP_REJECT: XCircle,
  CLASS_ASSIGN: Users,
  CLASS_REMOVE: XCircle,
};

const CATEGORIES = ['AUTH', 'USER', 'COURSE', 'ENROLLMENT', 'GRADE', 'SEMESTER', 'CLASS', 'PAYMENT', 'PROFILE', 'ADD_DROP'];
const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ENROLL', 'UNENROLL', 'GRADE_SUBMIT', 'GRADE_PUBLISH', 'SEMESTER_REGISTER', 'ADD_DROP_REQUEST', 'ADD_DROP_APPROVE', 'ADD_DROP_REJECT', 'CLASS_ASSIGN', 'CLASS_REMOVE'];

const ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  TEACHER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  STUDENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const CATEGORY_COLORS = {
  AUTH: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  USER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  COURSE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  ENROLLMENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  GRADE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SEMESTER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CLASS: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  PAYMENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PROFILE: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ADD_DROP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function Users({ className }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

export default function AdminLogsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    category: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    loadLogs();
  }, [user, page, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        page,
        limit: 30,
        ...filters,
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', category: '', search: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ScrollText className="w-7 h-7 text-primary-600" />
            {t('auditLogs.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('auditLogs.description')}</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('auditLogs.filters')}</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="ml-auto text-xs text-red-600 hover:text-red-700 dark:text-red-400">
                {t('auditLogs.clearFilters')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('auditLogs.search')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  placeholder={t('auditLogs.searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('auditLogs.category')}</label>
              <select
                value={filters.category}
                onChange={e => handleFilterChange('category', e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('auditLogs.allCategories')}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('auditLogs.action')}</label>
              <select
                value={filters.action}
                onChange={e => handleFilterChange('action', e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('auditLogs.allActions')}</option>
                {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('auditLogs.startDate')}</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => handleFilterChange('startDate', e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('auditLogs.endDate')}</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => handleFilterChange('endDate', e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('auditLogs.totalLogs')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('auditLogs.page')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{page} / {totalPages}</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('auditLogs.noLogs')}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('auditLogs.timestamp')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('auditLogs.user')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('auditLogs.action')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('auditLogs.category')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('auditLogs.description')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {logs.map(log => {
                      const ActionIcon = ACTION_ICONS[log.action] || FileText;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(log.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {log.user ? (
                                <>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{log.user.fullName}</span>
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${ROLE_COLORS[log.userRole] || 'bg-gray-100 text-gray-600'}`}>{log.userRole}</span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-400">{t('auditLogs.system')}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <ActionIcon className={`w-4 h-4 ${log.action === 'LOGIN_FAILED' || log.action === 'DELETE' || log.action === 'REJECT' ? 'text-red-500' : log.action === 'APPROVE' || log.action === 'GRADE_PUBLISH' ? 'text-green-500' : 'text-gray-500'}`} />
                              <span className="text-sm text-gray-900 dark:text-white">{log.action.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-600'}`}>{log.category}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate">{log.description}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ipAddress || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map(log => {
                  const ActionIcon = ACTION_ICONS[log.action] || FileText;
                  return (
                    <div key={log.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ActionIcon className={`w-4 h-4 ${log.action === 'LOGIN_FAILED' || log.action === 'DELETE' || log.action === 'REJECT' ? 'text-red-500' : log.action === 'APPROVE' || log.action === 'GRADE_PUBLISH' ? 'text-green-500' : 'text-gray-500'}`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{log.action.replace(/_/g, ' ')}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-600'}`}>{log.category}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{log.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{log.user ? `${log.user.fullName} (${log.userRole})` : t('auditLogs.system')}</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('auditLogs.previous')}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('auditLogs.page')} {page} {t('auditLogs.of')} {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('auditLogs.next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
