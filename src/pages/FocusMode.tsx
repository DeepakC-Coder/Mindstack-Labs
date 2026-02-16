import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Eye, AlertTriangle, Volume2, Link, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// MediaPipe Face Mesh indices for eye landmarks
const LEFT_EYE_UPPER = [159, 145];
const LEFT_EYE_LOWER = [145, 159];
const RIGHT_EYE_UPPER = [386, 374];
const RIGHT_EYE_LOWER = [374, 386];

// Eye aspect ratio thresholds
const EAR_THRESHOLD = 0.2; // Below this = eyes closed
const CLOSED_FRAMES_THRESHOLD = 15; // Consecutive frames with closed eyes before alert

const FocusMode: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [cameraOn, setCameraOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [eyeStatus, setEyeStatus] = useState<'open' | 'closed' | 'unknown'>('unknown');
  const [closedFrameCount, setClosedFrameCount] = useState(0);
  const [alertPlaying, setAlertPlaying] = useState(false);
  const [faceMeshLoaded, setFaceMeshLoaded] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [contentUrl, setContentUrl] = useState('https://www.youtube-nocookie.com/embed/ivVPJhYM8Ng?si=V403wNzR3u0u06yr&autoplay=1&loop=1&playlist=ivVPJhYM8Ng&mute=1');
  const [urlInput, setUrlInput] = useState('');

  // Create alert sound
  useEffect(() => {
    // Create oscillator-based alert sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    alertAudioRef.current = new Audio();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Play alert sound 3 times
  const playAlertSound = useCallback(async () => {
    if (alertPlaying) return;
    setAlertPlaying(true);
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    for (let i = 0; i < 3; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    setAlertPlaying(false);
  }, [alertPlaying]);

  // Calculate Eye Aspect Ratio
  const calculateEAR = (landmarks: any[], eyeIndices: number[]) => {
    if (!landmarks || landmarks.length === 0) return 1;
    
    // Simplified EAR calculation using vertical and horizontal distances
    // Upper eyelid points: 159, 158, 157, 173, 133 (left eye)
    // Lower eyelid points: 145, 144, 163, 7, 33 (left eye)
    
    const leftEyeTop = [159, 158, 157];
    const leftEyeBottom = [145, 144, 163];
    const leftEyeLeft = 33;
    const leftEyeRight = 133;
    
    const rightEyeTop = [386, 385, 384];
    const rightEyeBottom = [374, 373, 390];
    const rightEyeLeft = 362;
    const rightEyeRight = 263;
    
    const getEAR = (topIndices: number[], bottomIndices: number[], leftIdx: number, rightIdx: number) => {
      try {
        let verticalSum = 0;
        for (let i = 0; i < topIndices.length; i++) {
          const top = landmarks[topIndices[i]];
          const bottom = landmarks[bottomIndices[i]];
          if (top && bottom) {
            verticalSum += Math.abs(top.y - bottom.y);
          }
        }
        const avgVertical = verticalSum / topIndices.length;
        
        const left = landmarks[leftIdx];
        const right = landmarks[rightIdx];
        const horizontal = left && right ? Math.abs(left.x - right.x) : 0.1;
        
        return horizontal > 0 ? avgVertical / horizontal : 1;
      } catch {
        return 1;
      }
    };
    
    const leftEAR = getEAR(leftEyeTop, leftEyeBottom, leftEyeLeft, leftEyeRight);
    const rightEAR = getEAR(rightEyeTop, rightEyeBottom, rightEyeLeft, rightEyeRight);
    
    return (leftEAR + rightEAR) / 2;
  };

  // Load MediaPipe Face Mesh
  const loadFaceMesh = useCallback(async () => {
    if (faceMeshLoaded) return;
    
    try {
      // Dynamically load MediaPipe scripts
      const loadScript = (src: string) => {
        return new Promise<void>((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');

      // Wait for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      const FaceMesh = (window as any).FaceMesh;
      if (!FaceMesh) {
        console.error('FaceMesh not loaded');
        return;
      }

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults((results: any) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw video frame
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          
          // Draw face mesh (simplified - just key points)
          ctx.fillStyle = '#00ff00';
          
          // Draw eye contours
          const drawUtils = (window as any).drawConnectors;
          if (drawUtils) {
            const FACEMESH_LEFT_EYE = (window as any).FACEMESH_LEFT_EYE;
            const FACEMESH_RIGHT_EYE = (window as any).FACEMESH_RIGHT_EYE;
            
            if (FACEMESH_LEFT_EYE) {
              drawUtils(ctx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30', lineWidth: 1 });
            }
            if (FACEMESH_RIGHT_EYE) {
              drawUtils(ctx, landmarks, FACEMESH_RIGHT_EYE, { color: '#30FF30', lineWidth: 1 });
            }
          }

          // Calculate EAR
          const ear = calculateEAR(landmarks, []);
          
          // Determine eye state
          if (ear < EAR_THRESHOLD) {
            setEyeStatus('closed');
            setClosedFrameCount(prev => {
              const newCount = prev + 1;
              if (newCount >= CLOSED_FRAMES_THRESHOLD && !alertPlaying) {
                playAlertSound();
              }
              return newCount;
            });
          } else {
            setEyeStatus('open');
            setClosedFrameCount(0);
          }

          // Draw EAR value
          ctx.fillStyle = ear < EAR_THRESHOLD ? '#ff0000' : '#00ff00';
          ctx.font = '16px Arial';
          ctx.fillText(`EAR: ${ear.toFixed(3)}`, 10, 30);
          ctx.fillText(`Status: ${ear < EAR_THRESHOLD ? 'DROWSY!' : 'Alert'}`, 10, 50);
        } else {
          setEyeStatus('unknown');
          ctx.fillStyle = '#ffff00';
          ctx.font = '16px Arial';
          ctx.fillText('No face detected', 10, 30);
        }

        ctx.restore();
      });

      faceMeshRef.current = faceMesh;
      setFaceMeshLoaded(true);
    } catch (error) {
      console.error('Error loading FaceMesh:', error);
    }
  }, [faceMeshLoaded, alertPlaying, playAlertSound]);

  // Start camera
  const startCamera = async () => {
    setIsLoading(true);
    
    try {
      await loadFaceMesh();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Set canvas size
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }
        
        setDetectionActive(true);
        
        // Start detection loop
        const detectLoop = async () => {
          if (!videoRef.current || !faceMeshRef.current || !cameraOn) return;
          
          try {
            await faceMeshRef.current.send({ image: videoRef.current });
          } catch (e) {
            console.error('Detection error:', e);
          }
          
          if (cameraOn && detectionActive) {
            requestAnimationFrame(detectLoop);
          }
        };
        
        detectLoop();
      }
      
      setCameraOn(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setDetectionActive(false);
    setCameraOn(false);
    setEyeStatus('unknown');
    setClosedFrameCount(0);
  };

  // Handle camera toggle
  const handleCameraToggle = (checked: boolean) => {
    if (checked) {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Detection loop effect
  useEffect(() => {
    let animationId: number;
    
    const detectLoop = async () => {
      if (!videoRef.current || !faceMeshRef.current || !cameraOn || !detectionActive) return;
      
      try {
        await faceMeshRef.current.send({ image: videoRef.current });
      } catch (e) {
        // Silent error
      }
      
      animationId = requestAnimationFrame(detectLoop);
    };
    
    if (cameraOn && detectionActive && faceMeshRef.current) {
      detectLoop();
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [cameraOn, detectionActive]);

  // Handle URL submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    let finalUrl = urlInput.trim();
    
    // Check if it's a YouTube URL and convert to embed
    const youtubeMatch = finalUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      finalUrl = `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}?autoplay=1&loop=1&playlist=${youtubeMatch[1]}&mute=1`;
    }
    
    // Ensure URL has protocol
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    
    setContentUrl(finalUrl);
    setUrlInput('');
  };

  const resetToDefault = () => {
    setContentUrl('https://www.youtube-nocookie.com/embed/ivVPJhYM8Ng?si=V403wNzR3u0u06yr&autoplay=1&loop=1&playlist=ivVPJhYM8Ng&mute=1');
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Side - Content Area */}
      <div className="flex-1 flex flex-col p-6 border-r border-border">
        {/* URL Input Bar */}
        <form onSubmit={handleUrlSubmit} className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter website URL or video link..."
                className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button type="submit" variant="default" className="px-6">
              Load
            </Button>
            <Button type="button" variant="outline" onClick={resetToDefault} className="px-3">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-2">Focus Mode</h2>
          <p className="text-muted-foreground text-sm">Stay focused with AI-powered drowsiness detection</p>
        </div>
        
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-background border border-border">
          <iframe 
            className="absolute inset-0 w-full h-full"
            src={contentUrl}
            title="Focus Mode Content"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          />
        </div>
      </div>

      {/* Right Side - Camera Preview & Controls */}
      <div className="w-[400px] flex flex-col p-6 bg-muted/30">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Detection Preview</h3>
          
          {/* Camera Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border mb-4">
            <div className="flex items-center gap-3">
              {cameraOn ? (
                <Camera className="w-5 h-5 text-green-500" />
              ) : (
                <CameraOff className="w-5 h-5 text-muted-foreground" />
              )}
              <Label htmlFor="camera-toggle" className="text-foreground font-medium">
                Turn Camera {cameraOn ? 'Off' : 'On'}
              </Label>
            </div>
            <Switch
              id="camera-toggle"
              checked={cameraOn}
              onCheckedChange={handleCameraToggle}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Camera Preview */}
        <Card className="flex-1 bg-muted/50 border-border overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Loading face detection...</p>
              </div>
            </div>
          )}
          
          {!cameraOn && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <CameraOff className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Camera is off</p>
                <p className="text-muted-foreground/50 text-sm mt-1">Toggle the switch above to enable</p>
              </div>
            </div>
          )}
          
          {/* Hidden video element for camera feed */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />
          
          {/* Canvas for drawing detection results */}
          <canvas
            ref={canvasRef}
            className={`w-full h-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
          />
        </Card>

        {/* Status Panel */}
        <div className="mt-4 space-y-3">
          {/* Eye Status */}
          <div className={`p-4 rounded-xl border ${
            eyeStatus === 'closed' 
              ? 'bg-destructive/20 border-destructive/50' 
              : eyeStatus === 'open'
                ? 'bg-green-500/20 border-green-500/50'
                : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className={`w-5 h-5 ${
                  eyeStatus === 'closed' ? 'text-destructive' : 
                  eyeStatus === 'open' ? 'text-green-500' : 'text-muted-foreground'
                }`} />
                <span className="text-foreground font-medium">Eye Status</span>
              </div>
              <span className={`text-sm font-bold uppercase ${
                eyeStatus === 'closed' ? 'text-destructive' : 
                eyeStatus === 'open' ? 'text-green-500' : 'text-muted-foreground'
              }`}>
                {eyeStatus === 'unknown' ? 'Waiting...' : eyeStatus}
              </span>
            </div>
          </div>

          {/* Alert Status */}
          {eyeStatus === 'closed' && (
            <div className="p-4 rounded-xl bg-destructive/20 border border-destructive/50 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-destructive font-bold">Drowsiness Detected!</p>
                  <p className="text-destructive/60 text-sm">Keep your eyes open to stay focused</p>
                </div>
              </div>
            </div>
          )}

          {/* Sound indicator */}
          {alertPlaying && (
            <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/50 flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-yellow-500 animate-pulse" />
              <span className="text-yellow-500 text-sm font-medium">Playing alert sound...</span>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border">
          <h4 className="text-foreground/80 font-medium mb-2">How it works</h4>
          <ul className="text-muted-foreground text-sm space-y-1">
            <li>• AI detects your face and eyes in real-time</li>
            <li>• Monitors eye aspect ratio (EAR) for drowsiness</li>
            <li>• Alerts you with sound if eyes stay closed</li>
            <li>• Works entirely in your browser - no data sent</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FocusMode;
