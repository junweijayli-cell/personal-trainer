'use client';

import { useEffect, useRef, useState } from 'react';
import type { Exercise } from './workout-data';

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks: Landmark[][] };
  close: () => void;
};

type CameraCoachProps = {
  exercise: Exercise;
  audioEnabled: boolean;
  onClose: () => void;
  onSetComplete: () => void;
};

const connections = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
];

function angle(a: Landmark, b: Landmark, c: Landmark) {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (ba.x * bc.x + ba.y * bc.y) /
    (Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function visible(point?: Landmark) {
  return Boolean(point && (point.visibility ?? 1) > 0.42);
}

export default function CameraCoach({ exercise, audioEnabled, onClose, onSetComplete }: CameraCoachProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceRef = useRef(0);
  const phaseRef = useRef<'ready' | 'loaded'>('ready');
  const feedbackRef = useRef('');
  const lastSpeechRef = useRef({ text: '', time: 0 });
  const holdStartRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState('Step into view when you are ready.');
  const [metric, setMetric] = useState('Waiting for you');
  const [complete, setComplete] = useState(false);

  function speak(text: string, important = false) {
    if (!audioEnabled || !('speechSynthesis' in window)) return;
    const now = Date.now();
    if (!important && now - lastSpeechRef.current.time < 4500) return;
    if (!important && lastSpeechRef.current.text === text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    lastSpeechRef.current = { text, time: now };
  }

  function updateFeedback(next: string, shouldSpeak = false) {
    if (feedbackRef.current === next) return;
    feedbackRef.current = next;
    setFeedback(next);
    if (shouldSpeak) speak(next);
  }

  function addRep() {
    setCount((current) => {
      const next = Math.min(exercise.target, current + 1);
      if (next !== current) speak(next.toString(), true);
      if (next >= exercise.target) {
        setComplete(true);
        speak('Set complete. Nice work.', true);
      }
      return next;
    });
  }

  function drawPose(landmarks: Landmark[]) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = Math.max(3, canvas.width / 260);
    context.lineCap = 'round';
    context.strokeStyle = '#d9ff43';
    for (const [from, to] of connections) {
      const a = landmarks[from];
      const b = landmarks[to];
      if (!visible(a) || !visible(b)) continue;
      context.beginPath();
      context.moveTo(a.x * canvas.width, a.y * canvas.height);
      context.lineTo(b.x * canvas.width, b.y * canvas.height);
      context.stroke();
    }
    context.fillStyle = '#ff6737';
    for (const index of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const point = landmarks[index];
      if (!visible(point)) continue;
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(4, canvas.width / 180), 0, Math.PI * 2);
      context.fill();
    }
  }

  function analyzePose(landmarks: Landmark[], timestamp: number) {
    const head = landmarks[0];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    if (!visible(head) || (!visible(leftAnkle) && !visible(rightAnkle))) {
      holdStartRef.current = null;
      setMetric('Frame check');
      updateFeedback('Step back until your head and shoes are both visible.', true);
      return;
    }

    const leftScore = [11, 13, 15, 23, 25, 27].reduce((sum, index) => sum + (landmarks[index]?.visibility ?? 0), 0);
    const rightScore = [12, 14, 16, 24, 26, 28].reduce((sum, index) => sum + (landmarks[index]?.visibility ?? 0), 0);
    const [shoulderIndex, elbowIndex, wristIndex, hipIndex, kneeIndex, ankleIndex] =
      leftScore >= rightScore ? [11, 13, 15, 23, 25, 27] : [12, 14, 16, 24, 26, 28];
    const shoulder = landmarks[shoulderIndex];
    const elbow = landmarks[elbowIndex];
    const wrist = landmarks[wristIndex];
    const hip = landmarks[hipIndex];
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];

    if (![shoulder, hip, knee, ankle].every(visible)) {
      setMetric('Finding joints');
      updateFeedback('Turn slightly so your shoulder, hip, knee, and ankle are visible.');
      return;
    }

    if (exercise.cameraMode === 'knee') {
      const kneeAngle = angle(hip, knee, ankle);
      setMetric(`Knee angle · ${Math.round(kneeAngle)}°`);
      if (phaseRef.current === 'ready' && kneeAngle < 108) {
        phaseRef.current = 'loaded';
        updateFeedback('Good depth. Drive through your whole front foot.');
      } else if (phaseRef.current === 'loaded' && kneeAngle > 154) {
        phaseRef.current = 'ready';
        updateFeedback('Rep complete. Stay tall for the next one.');
        addRep();
      } else if (phaseRef.current === 'ready' && kneeAngle > 138) {
        updateFeedback(exercise.id === 'reverse-lunge' ? 'Step back, then lower straight down.' : 'Sit your hips down and back.');
      }
      return;
    }

    if (exercise.cameraMode === 'elbow') {
      if (![elbow, wrist].every(visible)) {
        setMetric('Finding arms');
        updateFeedback('Show your hands and elbows to the phone.');
        return;
      }
      const elbowAngle = angle(shoulder, elbow, wrist);
      const bodyLine = angle(shoulder, hip, ankle);
      setMetric(`Elbow · ${Math.round(elbowAngle)}°`);
      if (bodyLine < 158) {
        updateFeedback('Bring your hips into line with your shoulders and heels.', true);
      } else if (phaseRef.current === 'ready' && elbowAngle < 103) {
        phaseRef.current = 'loaded';
        updateFeedback('Strong bottom position. Press the bench away.');
      } else if (phaseRef.current === 'loaded' && elbowAngle > 151) {
        phaseRef.current = 'ready';
        updateFeedback('Rep complete. Keep that long body line.');
        addRep();
      } else {
        updateFeedback('Lower your chest with elbows angled back.');
      }
      return;
    }

    if (exercise.cameraMode === 'hip') {
      const hipAngle = angle(shoulder, hip, knee);
      setMetric(`Hip line · ${Math.round(hipAngle)}°`);
      if (phaseRef.current === 'ready' && hipAngle > 156) {
        phaseRef.current = 'loaded';
        updateFeedback('Hips are tall. Squeeze, then lower with control.');
      } else if (phaseRef.current === 'loaded' && hipAngle < 125) {
        phaseRef.current = 'ready';
        updateFeedback('Rep complete. Keep your feet planted.');
        addRep();
      } else {
        updateFeedback('Drive through your heels and lift your hips.');
      }
      return;
    }

    if (exercise.cameraMode === 'extension') {
      if (![wrist, ankle].every(visible)) {
        setMetric('Finding limbs');
        updateFeedback('Make sure your reaching hand and foot stay in frame.');
        return;
      }
      const armReach = distance(wrist, shoulder);
      const legReach = distance(ankle, hip);
      const extended = armReach > 0.22 && legReach > 0.22;
      setMetric(extended ? 'Long position' : 'Reset position');
      if (phaseRef.current === 'ready' && extended) {
        phaseRef.current = 'loaded';
        updateFeedback('Reach long. Keep both hips facing the floor.');
      } else if (phaseRef.current === 'loaded' && !extended) {
        phaseRef.current = 'ready';
        updateFeedback('Rep complete. Reset without shifting.');
        addRep();
      }
      return;
    }

    const bodyLine = angle(shoulder, hip, ankle);
    setMetric(`Body line · ${Math.round(bodyLine)}°`);
    if (bodyLine >= 160) {
      if (holdStartRef.current === null) holdStartRef.current = timestamp - count * 1000;
      const seconds = Math.min(exercise.target, Math.floor((timestamp - holdStartRef.current) / 1000));
      setCount(seconds);
      updateFeedback('Strong line. Breathe slowly and keep pressing the floor away.');
      if (seconds >= exercise.target) {
        setComplete(true);
        speak('Hold complete. Nice work.', true);
      } else if (seconds > 0 && seconds % 10 === 0) {
        speak(`${seconds} seconds`);
      }
    } else {
      holdStartRef.current = null;
      updateFeedback('Bring your hips into line with your shoulders and heels.', true);
    }
  }

  function renderLoop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;
    const now = performance.now();
    if (
      video.readyState >= 2 &&
      video.currentTime !== lastVideoTimeRef.current &&
      now - lastInferenceRef.current > 65
    ) {
      lastVideoTimeRef.current = video.currentTime;
      lastInferenceRef.current = now;
      const result = landmarker.detectForVideo(video, now);
      const landmarks = result.landmarks[0];
      if (landmarks) {
        drawPose(landmarks);
        analyzePose(landmarks, now);
      } else {
        const canvas = canvasRef.current;
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        setMetric('No body found');
        updateFeedback('Step back and keep your whole body in the frame.');
      }
    }
    frameRef.current = requestAnimationFrame(renderLoop);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setFeedback('Camera coaching needs a modern browser with camera access.');
      return;
    }
    setStatus('loading');
    try {
      const [{ FilesetResolver, PoseLandmarker }, stream] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
        }),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video element unavailable');
      video.srcObject = stream;
      await video.play();
      const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const vision = await FilesetResolver.forVisionTasks(`${publicBasePath}/mediapipe/wasm`);
      let landmarker;
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${publicBasePath}/models/pose_landmarker_lite.task`, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${publicBasePath}/models/pose_landmarker_lite.task` },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
      landmarkerRef.current = landmarker as PoseLandmarkerLike;
      setStatus('live');
      setFeedback('Step back until your head and shoes are visible.');
      speak('Camera ready. Step back until your whole body is visible.', true);
      frameRef.current = requestAnimationFrame(renderLoop);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStatus('error');
      setFeedback('Camera access did not start. You can still follow the guide and log the set manually.');
    }
  }

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  return (
    <section className="camera-coach" aria-label="Live camera coach">
      <header className="camera-header">
        <button type="button" onClick={onClose} aria-label="Close camera coach">×</button>
        <div><span>LIVE FORM COACH</span><strong>{exercise.name}</strong></div>
        <i className={status === 'live' ? 'live' : ''}>{status === 'live' ? 'LIVE' : 'PRIVATE'}</i>
      </header>

      <div className="camera-stage">
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} />
        {status === 'idle' && (
          <div className="camera-setup">
            <div className="phone-placement"><span /><i /><b>2–3 m</b></div>
            <p>PHONE PLACEMENT</p>
            <h2>Let Relay see your whole movement.</h2>
            <ol>
              <li><span>1</span>Prop your phone securely in landscape.</li>
              <li><span>2</span>Stand 2–3 metres away in good light.</li>
              <li><span>3</span>{exercise.view}.</li>
            </ol>
            <div className="camera-privacy"><b>Processed on this device</b><span>No video is saved or uploaded by Relay.</span></div>
            <button className="camera-start" type="button" onClick={startCamera}>Enable camera <span>→</span></button>
          </div>
        )}
        {status === 'loading' && <div className="camera-loading"><i /><strong>Preparing your coach…</strong><span>Loading private pose tracking</span></div>}
        {status === 'error' && <div className="camera-error"><strong>Camera unavailable</strong><p>{feedback}</p><button type="button" onClick={onClose}>Return to movement guide</button></div>}
        {status === 'live' && (
          <>
            <div className="camera-score">
              <span>{exercise.cameraMode === 'hold' ? 'SECONDS' : 'REPS'}</span>
              <strong>{count}<small> / {exercise.target}</small></strong>
            </div>
            <div className="camera-metric">{metric}</div>
            <div className={`live-cue ${complete ? 'complete' : ''}`}>
              <span>{complete ? '✓' : 'COACH'}</span>
              <p>{complete ? 'Set complete. You hit the target.' : feedback}</p>
              {complete && <button type="button" onClick={onSetComplete}>Continue <b>→</b></button>}
            </div>
          </>
        )}
      </div>
      <p className="camera-disclaimer">Form feedback is a movement aid, not a medical assessment. Stop if you feel sharp or worsening pain.</p>
    </section>
  );
}
