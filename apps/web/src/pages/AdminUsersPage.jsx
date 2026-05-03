import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmContext';
import { getUsers, adminCreateUser, adminUpdateUser, adminResetPassword, getPendingUsers, approveUser, deleteUser } from '../api';
import Layout from '../components/Layout';
import { UserCircle, GraduationCap, BookOpen, Shield, Search, Plus, X, AlertCircle, CheckCircle, Clock, Trash2, Check, KeyRound, Eye, EyeOff, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <div className={`flex items-center gap-2 text-xs ${valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{text}</span>
    </div>
  );
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'pending'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', role: 'STUDENT', isApproved: true });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [createSuccess, setCreateSuccess] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'STUDENT',
  });

  const { checks, isValid } = validatePassword(newUser.password);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [allUsers, pending] = await Promise.all([getUsers(), getPendingUsers()]);
      setUsers(allUsers);
      setPendingUsers(pending);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setFieldErrors({});
    setCreateSuccess('');
    
    if (!isValid) {
      setCreateError(t('admin.passwordRequirements'));
      return;
    }
    if (/\d/.test(newUser.fullName)) {
      setCreateError(t('register.nameNoNumbers'));
      return;
    }
    
    setCreateLoading(true);

    try {
      const created = await adminCreateUser(newUser);
      setUsers([...users, created]);
      setCreateSuccess(t('admin.userCreatedSuccess', { name: created.fullName }));
      setNewUser({ email: '', password: '', fullName: '', role: 'STUDENT' });
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess('');
      }, 2000);
    } catch (err) {
      if (err.details && Array.isArray(err.details)) {
        const errors = {};
        err.details.forEach(d => {
          const field = d.path.join('.');
          errors[field] = d.message;
        });
        setFieldErrors(errors);
        setCreateError(t('admin.correctErrors'));
      } else {
        setCreateError(err.message || t('admin.failedCreateUser'));
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      await approveUser(userId);
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      loadData(); // Refresh all users
    } catch (err) {
      toast.error(t('admin.failedApproveUser'));
    }
  };

  const handleRejectUser = async (userId) => {
    const confirmed = await confirm({
      title: t('admin.rejectUser'),
      message: t('admin.confirmRejectUser'),
      confirmText: t('reports.rejected'),
      cancelText: t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteUser(userId);
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      toast.success(t('admin.userRejectedDeleted'));
    } catch (err) {
      toast.error(t('admin.failedRejectUser'));
    }
  };

  const handleOpenResetPassword = (u) => {
    setResetUser(u);
    setNewPassword('');
    setResetError('');
    setShowNewPassword(false);
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError(t('admin.passwordRequirements'));
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      await adminResetPassword(resetUser.id, newPassword);
      toast.success(t('admin.passwordResetSuccess', { name: resetUser.fullName }));
      setShowResetModal(false);
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.message || t('admin.failedResetPassword'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleOpenEditUser = (u) => {
    setEditUser(u);
    setEditForm({ fullName: u.fullName, email: u.email, role: u.role, isApproved: u.isApproved });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      const updated = await adminUpdateUser(editUser.id, editForm);
      setUsers(users.map(u => u.id === editUser.id ? { ...u, ...updated } : u));
      toast.success(t('admin.userUpdatedSuccess', { name: editForm.fullName }));
      setShowEditModal(false);
      setEditUser(null);
    } catch (err) {
      setEditError(err.message || t('admin.failedUpdateUser'));
    } finally {
      setEditLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) ||
                         u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    STUDENT: users.filter(u => u.role === 'STUDENT').length,
    TEACHER: users.filter(u => u.role === 'TEACHER').length,
    ADMIN: users.filter(u => u.role === 'ADMIN').length,
    PENDING: pendingUsers.length,
  };

  if (user?.role !== 'ADMIN') return <div className="p-8 text-center">{t('common.accessDenied')}</div>;
  if (loading) return <Layout><div className="p-8 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.users')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('admin.manageAllUsers')}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('admin.createUser')}
          </button>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin.createNewUser')}</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5 dark:text-gray-300" />
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{createError}</span>
                </div>
              )}

              {createSuccess && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{createSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.fullName')}</label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value.replace(/[^a-zA-Z\s\u1200-\u137F\u1380-\u139F\u2C80-\u2CFF]/g, '') })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.email')}</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => { setNewUser({ ...newUser, email: e.target.value }); setFieldErrors(prev => { const { email, ...rest } = prev; return rest; }); }}
                    required
                    className={`w-full px-4 py-3 border ${fieldErrors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none`}
                    placeholder="user@example.com"
                  />
                  {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('auth.password')}</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder={t('admin.passwordPlaceholder')}
                  />
                  {/* Password requirements */}
                  {passwordFocused && newUser.password && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-0.5">
                      <PasswordCheck valid={checks.length} text={t('admin.atLeast6Chars')} />
                      <PasswordCheck valid={checks.uppercase} text={t('admin.atLeastOneUppercase')} />
                      <PasswordCheck valid={checks.lowercase} text={t('admin.atLeastOneLowercase')} />
                      <PasswordCheck valid={checks.number} text={t('admin.atLeastOneNumber')} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.role')}</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="STUDENT">{t('nav.students')}</option>
                    <option value="TEACHER">{t('nav.teachers')}</option>
                    <option value="ADMIN">{t('admin.admins')}</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {createLoading ? t('admin.creating') : t('admin.createUser')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{roleStats.STUDENT}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('nav.students')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{roleStats.TEACHER}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('nav.teachers')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{roleStats.ADMIN}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.admins')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{roleStats.PENDING}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.pending')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-primary-900 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {t('admin.allUsers')}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {t('admin.pendingApproval')}
            {roleStats.PENDING > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-white/20' : 'bg-yellow-100 text-yellow-700'}`}>
                {roleStats.PENDING}
              </span>
            )}
          </button>
        </div>

        {/* Pending Users List */}
        {activeTab === 'pending' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            {pendingUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {t('admin.noPendingUsers')}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('admin.user')}</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('admin.role')}</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('admin.registered')}</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pendingUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{u.fullName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          u.role === 'STUDENT' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' :
                          u.role === 'TEACHER' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveUser(u.id)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {t('faceVerification.approve')}
                          </button>
                          <button
                            onClick={() => handleRejectUser(u.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('reports.rejected')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Filters - only show for all users tab */}
        {activeTab === 'all' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin.searchByNameOrEmail')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="ALL">{t('admin.allRoles')}</option>
                <option value="STUDENT">{t('nav.students')}</option>
                <option value="TEACHER">{t('nav.teachers')}</option>
                <option value="ADMIN">{t('admin.admins')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Users Table */}
        {activeTab === 'all' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.user')}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.role')}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.joined')}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.profileImage ? (
                        <img src={u.profileImage} alt={u.fullName} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          u.role === 'STUDENT' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' :
                          u.role === 'TEACHER' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                          'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                        }`}>
                          <span className="font-semibold">{u.fullName.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{u.fullName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      u.role === 'STUDENT' ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' :
                      u.role === 'TEACHER' ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                      'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleOpenResetPassword(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                        {t('admin.resetPassword')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {t('admin.noUsersFound')}
            </div>
          )}
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetModal && resetUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('admin.resetPassword')}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{resetUser.fullName} ({resetUser.email})</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowResetModal(false); setResetUser(null); }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5 dark:text-gray-300" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('admin.resetPasswordNote')}</p>
              </div>

              {resetError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.newPassword')}</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-4 pr-11 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder={t('admin.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-0.5">
                      <PasswordCheck valid={newPassword.length >= 6} text={t('admin.atLeast6Chars')} />
                      <PasswordCheck valid={/[A-Z]/.test(newPassword)} text={t('admin.atLeastOneUppercase')} />
                      <PasswordCheck valid={/[a-z]/.test(newPassword)} text={t('admin.atLeastOneLowercase')} />
                      <PasswordCheck valid={/[0-9]/.test(newPassword)} text={t('admin.atLeastOneNumber')} />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowResetModal(false); setResetUser(null); }}
                    className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || newPassword.length < 6}
                    className="flex-1 py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {resetLoading ? t('admin.resetting') : t('admin.resetPassword')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('admin.editUser')}</h2>
                </div>
                <button
                  onClick={() => { setShowEditModal(false); setEditUser(null); }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5 dark:text-gray-300" />
                </button>
              </div>

              {editError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{editError}</span>
                </div>
              )}

              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.fullName')}</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value.replace(/[^a-zA-Z\s\u1200-\u137F\u1380-\u139F\u2C80-\u2CFF]/g, '') })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.email')}</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.role')}</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="STUDENT">{t('nav.students')}</option>
                    <option value="TEACHER">{t('nav.teachers')}</option>
                    <option value="ADMIN">{t('admin.admins')}</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.approved')}</label>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isApproved: !editForm.isApproved })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isApproved ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isApproved ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditUser(null); }}
                    className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {editLoading ? t('admin.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
