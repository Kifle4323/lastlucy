import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { updateProfile, getProfileStatus } from '../api';
import Layout from '../components/Layout';
import { Camera, User, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import lucyLogo from '../assets/lucy_logobg.png';
import { useTranslation } from 'react-i18next';

export default function CompleteProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Check if profile is already complete
    getProfileStatus().then(status => {
      if (status.isProfileComplete) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      setCameraActive(true);
      // Wait for next tick to ensure video element is ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setError(t('settings.cameraAccessError'));
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
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('settings.selectImageFile'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('settings.imageSizeLimit'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      stopCamera();
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!capturedImage) {
      setError(t('completeProfile.captureProfilePhoto'));
      return;
    }
    if (!fullName.trim()) {
      setError(t('completeProfile.enterFullName'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateProfile({
        fullName: fullName.trim(),
        profileImage: capturedImage,
      });
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || t('studentProfile.failedSaveProfile'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4 p-2">
              <img src={lucyLogo} alt="Lucy College" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-primary-900">{t('completeProfile.title')}</h1>
            <p className="text-gray-500 mt-2">
              {t('completeProfile.subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('register.fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('settings.enterFullName')}
              />
            </div>

            {/* Profile Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.profilePicture')}
              </label>
              
              {capturedImage ? (
                <div className="relative">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-64 h-64 object-cover rounded-lg mx-auto border-2 border-green-500"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapturedImage(null)}
                    className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                  >
                    {t('completeProfile.changePhoto')}
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  {cameraActive ? (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-64 h-64 object-cover rounded-lg mx-auto"
                      />
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
                      >
                        <Camera className="w-5 h-5" />
                        {t('settings.capture')}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">
                        {t('completeProfile.takeClearPhoto')}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-6 py-3 bg-primary-900 hover:bg-primary-800 text-white font-medium rounded-lg inline-flex items-center justify-center gap-2"
                        >
                          <Camera className="w-5 h-5" />
                          {t('settings.takePhoto')}
                        </button>
                        <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer inline-flex items-center justify-center gap-2">
                          <Upload className="w-5 h-5" />
                          {t('settings.uploadImage')}
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">{t('completeProfile.photoRequirements')}</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>{t('completeProfile.goodLighting')}</li>
                <li>{t('completeProfile.faceCameraDirectly')}</li>
                <li>{t('completeProfile.removeGlasses')}</li>
                <li>{t('completeProfile.neutralExpression')}</li>
              </ul>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !capturedImage}
              className="w-full py-3 bg-primary-900 hover:bg-primary-800 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? t('settings.saving') : t('completeProfile.completeProfile')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
