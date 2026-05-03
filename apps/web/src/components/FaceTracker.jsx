import { useState, useRef, useEffect } from 'react';
import { Video, AlertTriangle, CheckCircle, Camera } from 'lucide-react';
import { createFaceVerification, createVideoFaceVerification } from '../api';

export default function FaceTracker({ active, attemptId, materialId, profileImage, onMismatch, intervalMs = 60000 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [lastCapture, setLastCapture] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [verificationCreated, setVerificationCreated] = useState(false);

  // Auto-start camera when active
  useEffect(() => {
    if (active) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [active]);

  // Periodic face capture
  useEffect(() => {
    if (!active || !cameraReady || !stream) return;

    const captureAndCheck = () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL('image/jpeg', 0.7);
          setLastCapture(imageData);
          setLastCheckTime(new Date());
          
          // Simulate face matching check
          simulateFaceCheck(imageData);
        }
      }
    };

    // Initial capture after camera is ready
    const initialTimer = setTimeout(captureAndCheck, 3000);
    
    // Set up interval for periodic checks
    const interval = setInterval(captureAndCheck, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [active, cameraReady, stream, intervalMs]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 320 }, 
          height: { ideal: 240 },
          frameRate: { ideal: 15 }
        },
        audio: false,
      });
      setStream(mediaStream);
      setCameraStarted(true);
      
      // Wait for video element to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              setCameraReady(true);
            })
            .catch(err => {
              console.error('Play error:', err);
              setCameraError('Could not start video');
            });
        };
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Permission denied. Click the lock icon in address bar, allow camera, then refresh.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera.');
      } else {
        setCameraError('Camera error. Please check browser settings.');
      }
      setCameraStarted(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraReady(false);
      setCameraStarted(false);
    }
  };

  const simulateFaceCheck = async (capturedImage) => {
    if (!attemptId && !materialId) return;
    
    // In production, this would call a face recognition API
    // For demo purposes, we simulate a mismatch detection (20% chance)
    const isMismatch = Math.random() < 0.2;
    
    try {
      // Create face verification record for every capture
      // matchResult = true means face matched, false means mismatch
      if (materialId) {
        await createVideoFaceVerification(materialId, capturedImage, !isMismatch);
      } else if (attemptId) {
        await createFaceVerification(attemptId, capturedImage, !isMismatch);
      }
      setVerificationCreated(true);
      
      if (isMismatch && onMismatch) {
        setMismatchCount(prev => prev + 1);
        onMismatch(capturedImage);
      }
    } catch (err) {
      console.error('Failed to create face verification:', err);
    }
  };

  if (!active) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-64">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-gray-700">Face Tracking</span>
          </div>
          {cameraReady ? (
            mismatchCount > 0 ? (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                {mismatchCount} alerts
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            )
          ) : cameraStarted ? (
            <span className="text-xs text-gray-500">Starting...</span>
          ) : cameraError ? (
            <span className="text-xs text-red-600">Error</span>
          ) : null}
        </div>
        
        <div className="relative bg-gray-900 rounded overflow-hidden h-32">
          {cameraError ? (
            <button
              onClick={startCamera}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-center p-2 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <Camera className="w-8 h-8 text-white mb-2" />
              <p className="text-xs text-white font-medium">
                {cameraError}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Click to retry
              </p>
            </button>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}
          {cameraReady && !cameraError && (
            <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>
          )}
        </div>
        
        {lastCheckTime && (
          <p className="text-xs text-gray-500 mt-2">
            Last check: {lastCheckTime.toLocaleTimeString()}
          </p>
        )}
        
        {mismatchCount > 0 && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Face mismatch detected. Admin will review.
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
