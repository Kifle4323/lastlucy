import { useState, useRef, useEffect } from 'react';
import { Video, AlertTriangle, CheckCircle, Camera } from 'lucide-react';
import { reportFaceAlert } from '../api';

export default function LiveFaceTracker({ active, sessionId, onMismatch, intervalMs = 120000 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [noFaceCount, setNoFaceCount] = useState(0);

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
          setLastCheckTime(new Date());

          // Simulate face presence check
          // In production, this would call a face detection API
          simulateFacePresenceCheck();
        }
      }
    };

    const initialTimer = setTimeout(captureAndCheck, 5000);
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
        setCameraError('Camera permission required for face tracking.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found.');
      } else {
        setCameraError('Camera error.');
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

  const simulateFacePresenceCheck = async () => {
    // In production, send captured frame to a face detection API
    // For demo: 15% chance of "no face detected" (student left)
    const noFaceDetected = Math.random() < 0.15;

    if (noFaceDetected) {
      setNoFaceCount(prev => prev + 1);
      setMismatchCount(prev => prev + 1);
      if (onMismatch) {
        onMismatch();
      }
      // Report to backend so teacher gets notified
      if (sessionId) {
        try {
          await reportFaceAlert(sessionId);
        } catch (err) {
          console.error('Failed to report face alert:', err);
        }
      }
    }
  };

  if (!active) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-600 p-3 w-56">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Face Monitor</span>
          </div>
          {cameraReady ? (
            mismatchCount > 0 ? (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {mismatchCount} alert{mismatchCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            )
          ) : cameraError ? (
            <span className="text-xs text-red-400">Error</span>
          ) : (
            <span className="text-xs text-gray-500">Starting...</span>
          )}
        </div>

        <div className="relative bg-gray-900 rounded overflow-hidden h-24">
          {cameraError ? (
            <button
              onClick={startCamera}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-center p-2 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <Camera className="w-6 h-6 text-white mb-1" />
              <p className="text-xs text-gray-300">{cameraError}</p>
              <p className="text-xs text-gray-500 mt-1">Click to retry</p>
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
          <p className="text-xs text-gray-500 mt-1.5">
            Last check: {lastCheckTime.toLocaleTimeString()}
          </p>
        )}

        {mismatchCount > 0 && (
          <div className="mt-1.5 p-1.5 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Face not detected. Please stay in front of camera.
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
