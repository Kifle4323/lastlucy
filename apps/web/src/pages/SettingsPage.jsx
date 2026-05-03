import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { updateMyProfile, changePassword } from '../api';
import Layout from '../components/Layout';
import { Camera, User, Lock, AlertCircle, CheckCircle, Save, Upload, Check, X } from 'lucide-react';
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
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {valid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      <span>{text}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);
  const [capturedImage, setCapturedImage] = useState(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const fileInputRef = useRef(null);

  const { checks, isValid } = validatePassword(newPassword);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setProfileError(t('settings.cameraAccessError'));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    setProfileImage(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError(t('settings.selectImageFile'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError(t('settings.imageSizeLimit'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setProfileImage(event.target.result);
      setCapturedImage(event.target.result);
      setProfileError('');
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    if (!fullName.trim()) {
      setProfileError(t('register.fullNameRequired'));
      setProfileLoading(false);
      return;
    }
    if (/\d/.test(fullName)) {
      setProfileError(t('register.nameNoNumbers'));
      setProfileLoading(false);
      return;
    }

    try {
      await updateMyProfile({
        fullName: fullName.trim(),
        profileImage: capturedImage || profileImage,
      });
      await refreshUser();
      setProfileSuccess(t('settings.profileUpdated'));
      setCapturedImage(null);
    } catch (err) {
      setProfileError(err.message || t('settings.failedUpdateProfile'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordsDoNotMatch'));
      return;
    }

    if (!isValid) {
      setPasswordError(t('settings.passwordRequirements'));
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(t('settings.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || t('settings.failedChangePassword'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.settings')}</h1>

        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('settings.profileInformation')}
          </h2>

          {profileError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{profileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.profilePicture')}
              </label>
              <div className="flex items-center gap-4">
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary-900 dark:border-primary-700"
                  />
                ) : (
                  <div className="w-24 h-24 bg-primary-900 dark:bg-primary-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">
                      {fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="px-4 py-2 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {cameraActive ? t('settings.stopCamera') : t('settings.takePhoto')}
                  </button>
                  <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {t('settings.uploadImage')}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {profileImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileImage(null);
                        setCapturedImage(null);
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                    >
                      {t('settings.remove')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Camera Preview */}
            {cameraActive && (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full max-w-md mx-auto" playsInline muted />
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-white text-primary-900 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                >
                  {t('settings.capture')}
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('register.fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.replace(/[^a-zA-Z\s\u1200-\u137F\u1380-\u139F\u2C80-\u2CFF]/g, ''))}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                placeholder={t('settings.enterFullName')}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 rounded-lg cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settings.emailCannotChange')}</p>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {profileLoading ? t('settings.saving') : t('settings.saveProfile')}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t('settings.changePassword')}
          </h2>

          {passwordError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.currentPassword')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                placeholder={t('settings.enterCurrentPassword')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                placeholder={t('settings.enterNewPassword')}
              />
              {/* Password requirements */}
              {passwordFocused && newPassword && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
                  <PasswordCheck valid={checks.length} text={t('register.atLeast6Chars')} />
                  <PasswordCheck valid={checks.uppercase} text={t('register.atLeastOneUppercase')} />
                  <PasswordCheck valid={checks.lowercase} text={t('register.atLeastOneLowercase')} />
                  <PasswordCheck valid={checks.number} text={t('register.atLeastOneNumber')} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.confirmNewPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                placeholder={t('settings.confirmNewPasswordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-3 px-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              {passwordLoading ? t('settings.changing') : t('settings.changePassword')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
