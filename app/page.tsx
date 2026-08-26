'use client';

import { useEffect, useMemo, useState } from 'react';
import CameraCoach from './camera-coach';
import type { AccountSnapshot, DailyLog, ScheduleItem } from './account-types';
import { totalSets, workout, type Exercise } from './workout-data';

type View = 'today' | 'history' | 'you';
type SessionStage = 'setup' | 'guide' | 'camera' | 'rest' | 'summary';
type CoachingMode = 'video' | 'camera';

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(date).toUpperCase();
}

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function calculateStreak(dates: string[]) {
  const unique = new Set(dates.map((value) => localDateKey(new Date(value))));
  const cursor = new Date();
  if (!unique.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (unique.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Home() {
  const [view, setView] = useState<View>('today');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [stage, setStage] = useState<SessionStage>('setup');
  const [setupStep, setSetupStep] = useState(1);
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('video');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setsDone, setSetsDone] = useState<number[]>(workout.map(() => 0));
  const [restSeconds, setRestSeconds] = useState(45);
  const [elapsed, setElapsed] = useState(0);
  const [cameraSets, setCameraSets] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return window.localStorage.getItem('relay-audio') !== 'off'; } catch { return true; }
  });
  const [completedToday, setCompletedToday] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [accountStatus, setAccountStatus] = useState<'loading' | 'signed-out' | 'signed-in' | 'error'>('loading');
  const [saveStatus, setSaveStatus] = useState('');
  const [pendingExerciseIndex, setPendingExerciseIndex] = useState(0);
  const exercise = workout[exerciseIndex];
  const completedSetCount = setsDone.reduce((sum, count) => sum + count, 0);
  const sessionPercent = Math.round(completedSetCount / totalSets * 100);
  const sessionHistory = account?.sessions ?? [];
  const totalTrainingMinutes = sessionHistory.length > 0
    ? Math.max(1, Math.round(sessionHistory.reduce((sum, session) => sum + session.durationSeconds, 0) / 60))
    : 0;
  const trainingStreak = calculateStreak(sessionHistory.map((session) => session.completedAt));

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()).toUpperCase(),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/account?date=${localDateKey()}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setAccountStatus('signed-out');
          return null;
        }
        if (!response.ok) throw new Error('Account data could not be loaded.');
        return response.json() as Promise<AccountSnapshot>;
      })
      .then((snapshot) => {
        if (!snapshot) return;
        setAccount(snapshot);
        setAccountStatus('signed-in');
        setCompletedToday(snapshot.sessions.some((session) => localDateKey(new Date(session.completedAt)) === localDateKey()));
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setAccountStatus('error');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('relay-audio', audioEnabled ? 'on' : 'off');
    } catch {
      // Device storage is optional.
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!sessionOpen || stage === 'summary' || stage === 'setup') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionOpen, stage]);

  useEffect(() => {
    if (stage !== 'rest') return;
    const timer = window.setTimeout(() => {
      if (restSeconds <= 1) {
        setRestSeconds(0);
        setExerciseIndex(pendingExerciseIndex);
        setStage('guide');
      } else {
        setRestSeconds(restSeconds - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [stage, restSeconds, pendingExerciseIndex]);

  function startSession(startAt = 0) {
    setSessionOpen(true);
    setStage('setup');
    setSetupStep(1);
    setCoachingMode('video');
    setExerciseIndex(startAt);
    setSetsDone(workout.map(() => 0));
    setElapsed(0);
    setCameraSets(0);
    setPreviewIndex(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function completeSet() {
    const nextSetCount = Math.min(exercise.sets, setsDone[exerciseIndex] + 1);
    setSetsDone((counts) => counts.map((count, index) => index === exerciseIndex ? nextSetCount : count));
    if (exerciseIndex === workout.length - 1 && nextSetCount >= exercise.sets) {
      setStage('summary');
      return;
    }
    setPendingExerciseIndex(nextSetCount >= exercise.sets ? exerciseIndex + 1 : exerciseIndex);
    setRestSeconds(exercise.rest);
    setStage('rest');
  }

  function endRest() {
    setExerciseIndex(pendingExerciseIndex);
    setStage('guide');
  }

  async function postAccount(action: string, data?: unknown) {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, data, logDate: localDateKey(), ...(action === 'save-workout' && typeof data === 'object' ? data : {}) }),
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to save this.' : 'Could not save. Try again.');
    const snapshot = await response.json() as AccountSnapshot;
    setAccount(snapshot);
    setAccountStatus('signed-in');
    return snapshot;
  }

  async function saveWorkout() {
    setCompletedToday(true);
    if (accountStatus === 'signed-in') {
      setSaveStatus('Saving workout…');
      try {
        await postAccount('save-workout', {
          durationSeconds: Math.max(1, elapsed),
          setsCompleted: totalSets,
          movementsCompleted: workout.length,
          cameraSets,
        });
        setSaveStatus('Workout saved to your account.');
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : 'Could not save. Try again.');
        return;
      }
    }
    setSessionOpen(false);
    setView('today');
  }

  async function saveCheckin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    setSaveStatus('Saving today’s check-in…');
    try {
      await postAccount('save-checkin', account.todayLog);
      setSaveStatus('Today’s check-in is saved.');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Could not save. Try again.');
    }
  }

  async function saveProfileAndSchedule() {
    if (!account) return;
    setSaveStatus('Saving your plan…');
    try {
      await postAccount('save-profile', account.profile);
      await postAccount('save-schedule', account.schedule);
      setSaveStatus('Your plan and schedule are saved.');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Could not save. Try again.');
    }
  }

  function updateLog(patch: Partial<DailyLog>) {
    setAccount((current) => current ? { ...current, todayLog: { ...current.todayLog, ...patch } } : current);
  }

  function updateProfile(patch: Partial<AccountSnapshot['profile']>) {
    setAccount((current) => current ? { ...current, profile: { ...current.profile, ...patch } } : current);
  }

  function updateScheduleDay(weekday: number, patch: Partial<ScheduleItem>) {
    setAccount((current) => {
      if (!current) return current;
      const existing = current.schedule.find((item) => item.weekday === weekday);
      const schedule = existing
        ? current.schedule.map((item) => item.weekday === weekday ? { ...item, ...patch } : item)
        : [...current.schedule, { id: '', weekday, workoutName: 'Foundation 01', startTime: '18:00', durationMinutes: 24, enabled: true, ...patch }];
      return { ...current, schedule: schedule.sort((a, b) => a.weekday - b.weekday) };
    });
  }

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (sessionOpen) {
    if (stage === 'setup') {
      return (
        <main className="workout-setup">
          <header className="setup-header">
            <button type="button" onClick={() => setSessionOpen(false)} aria-label="Exit workout setup">×</button>
            <div><span>FOUNDATION 01</span><strong>Get ready</strong></div>
            <span>{setupStep} / 3</span>
          </header>
          <div className="setup-progress" aria-label={`Workout setup step ${setupStep} of 3`}>
            {[1, 2, 3].map((step) => <i className={step <= setupStep ? 'active' : ''} key={step} />)}
          </div>

          {setupStep === 1 && <section className="setup-panel">
            <div className="setup-video"><MovementVideo exercise={workout[0]} controls={false} /></div>
            <div className="setup-copy">
              <p className="kicker">STEP 1 · SEE TODAY&apos;S PLAN</p>
              <h1>Know exactly<br />what&apos;s ahead.</h1>
              <p>Six beginner-friendly movements. Every set includes a looping video, one key cue, your reps, and rest time.</p>
              <div className="setup-facts"><span><strong>24</strong><small>MINUTES</small></span><span><strong>6</strong><small>MOVES</small></span><span><strong>16</strong><small>SETS</small></span></div>
              <button className="setup-next" type="button" onClick={() => setSetupStep(2)}>Choose how I&apos;ll train <span>→</span></button>
            </div>
          </section>}

          {setupStep === 2 && <section className="setup-panel setup-choice-panel">
            <div className="setup-copy">
              <p className="kicker">STEP 2 · CHOOSE YOUR COACH</p>
              <h1>How should Relay<br />guide you?</h1>
              <p>Both modes show the same workout. You can switch to the camera at any movement.</p>
              <div className="coach-choice" role="radiogroup" aria-label="Coaching mode">
                <button className={coachingMode === 'video' ? 'selected' : ''} role="radio" aria-checked={coachingMode === 'video'} type="button" onClick={() => setCoachingMode('video')}>
                  <span className="choice-icon">▶</span><div><strong>Follow the videos</strong><small>Recommended · watch, move, tap done</small></div><b>{coachingMode === 'video' ? '✓' : ''}</b>
                </button>
                <button className={coachingMode === 'camera' ? 'selected' : ''} role="radio" aria-checked={coachingMode === 'camera'} type="button" onClick={() => setCoachingMode('camera')}>
                  <span className="choice-icon camera-choice-icon"><i /></span><div><strong>Use live camera coach</strong><small>Rep counting and one form cue at a time</small></div><b>{coachingMode === 'camera' ? '✓' : ''}</b>
                </button>
              </div>
              <div className="setup-actions"><button type="button" onClick={() => setSetupStep(1)}>← Back</button><button className="setup-next" type="button" onClick={() => setSetupStep(3)}>Next <span>→</span></button></div>
            </div>
          </section>}

          {setupStep === 3 && <section className="setup-panel setup-ready-panel">
            <div className="ready-mark">✓</div>
            <div className="setup-copy">
              <p className="kicker">STEP 3 · QUICK READY CHECK</p>
              <h1>Set your space.<br />Then press start.</h1>
              <div className="ready-list"><span><b>1</b><strong>Clear one arm-span of floor space</strong></span><span><b>2</b><strong>Keep water within reach</strong></span><span><b>3</b><strong>{coachingMode === 'camera' ? 'Prop your phone 2–3 metres away' : 'Keep your phone where the video is easy to see'}</strong></span></div>
              <p className="ready-mode">YOUR MODE <strong>{coachingMode === 'camera' ? 'Live camera coach' : 'Looping video guides'}</strong></p>
              <div className="setup-actions"><button type="button" onClick={() => setSetupStep(2)}>← Back</button><button className="setup-next start-workout-now" type="button" onClick={() => setStage(coachingMode === 'camera' ? 'camera' : 'guide')}>Start move 1 <span>→</span></button></div>
            </div>
          </section>}
        </main>
      );
    }

    if (stage === 'camera') {
      return (
        <CameraCoach
          exercise={exercise}
          audioEnabled={audioEnabled}
          onClose={() => setStage('guide')}
          onSetComplete={() => { setCameraSets((count) => count + 1); completeSet(); }}
        />
      );
    }

    if (stage === 'rest') {
      const nextExercise = workout[pendingExerciseIndex];
      return (
        <main className="rest-screen">
          <header className="session-top">
            <button type="button" onClick={() => setSessionOpen(false)} aria-label="Exit workout">×</button>
            <div><span>FOUNDATION 01</span><strong>{completedSetCount} of {totalSets} sets</strong></div>
            <span>{formatClock(elapsed)}</span>
          </header>
          <div className="rest-content">
            <p>REST</p>
            <div className="rest-ring" style={{ '--rest': `${Math.max(0, restSeconds / exercise.rest * 100)}%` } as React.CSSProperties}>
              <strong>{restSeconds}</strong><span>SECONDS</span>
            </div>
            <h1>Nice set.<br />Breathe slowly.</h1>
            <p className="up-next">{pendingExerciseIndex === exerciseIndex ? `Next: set ${setsDone[exerciseIndex] + 1} of ${exercise.sets}` : `Up next: ${nextExercise.name}`}</p>
            <button type="button" onClick={endRest}>Skip rest <span>→</span></button>
          </div>
        </main>
      );
    }

    if (stage === 'summary') {
      return (
        <main className="summary-screen">
          <div className="summary-confetti"><i /><i /><i /><i /><i /></div>
          <div className="summary-mark">R</div>
          <p>WORKOUT COMPLETE</p>
          <h1>You showed up.<br />That&apos;s the win.</h1>
          <div className="summary-stats">
            <span><strong>{formatClock(elapsed)}</strong><small>TIME</small></span>
            <span><strong>{totalSets}</strong><small>SETS</small></span>
            <span><strong>6</strong><small>MOVES</small></span>
          </div>
          <div className="summary-coach">
            <span>COACH NOTE</span>
            <p>{cameraSets > 0
              ? `Camera coaching was used on ${cameraSets} set${cameraSets === 1 ? '' : 's'}. Next time, reuse the same phone position for more consistent tracking.`
              : 'You logged this session manually. Turn on camera coaching next time if you want rep counting and live movement cues.'}</p>
          </div>
          <button type="button" onClick={saveWorkout}>{accountStatus === 'signed-in' ? 'Save to my account' : 'Finish workout'} <span>→</span></button>
          <small>Movement feedback is an estimate from visible joint positions.</small>
        </main>
      );
    }

    return (
      <main className="guided-session">
        <header className="session-top">
          <button type="button" onClick={() => setSessionOpen(false)} aria-label="Exit workout">×</button>
          <div><span>FOUNDATION 01</span><strong>Move {exerciseIndex + 1} of {workout.length}</strong></div>
          <button className={audioEnabled ? 'audio-on' : ''} type="button" onClick={() => setAudioEnabled((value) => !value)} aria-label="Toggle voice coaching">{audioEnabled ? '♪' : '×'}</button>
        </header>
        <div className="session-progress"><i style={{ width: `${Math.max(3, sessionPercent)}%` }} /></div>
        <section className="guide-layout">
          <div className="guide-visual">
            <MovementVideo exercise={exercise} />
            <span className="start-label">LOOPING VIDEO</span>
            <span className="move-label">WATCH, THEN MOVE</span>
            <button type="button" onClick={() => setPreviewIndex(exerciseIndex)}>↗ <span>Full guide</span></button>
          </div>
          <div className="guide-copy">
            <p className="kicker">SET {setsDone[exerciseIndex] + 1} OF {exercise.sets}</p>
            <h1>{exercise.name}</h1>
            <p className="exercise-intro">{exercise.intro}</p>
            <div className="prescription">
              <span><small>DO</small><strong>{exercise.targetLabel}</strong></span>
              <span><small>THEN REST</small><strong>{exercise.rest} sec</strong></span>
            </div>
            <div className="one-cue"><span>KEY CUE</span><p>{exercise.tips[1]}</p></div>
            <button className="camera-cta" type="button" onClick={() => setStage('camera')}><span className="camera-dot"><i /></span><b>Coach me with camera</b><em>→</em></button>
            <button className="manual-cta" type="button" onClick={completeSet}>I did this set <span>✓</span></button>
            <p className="device-note">Camera feedback stays on this device. You can always log manually.</p>
          </div>
        </section>
        <div className="session-queue">
          {workout.map((item, index) => (
            <button
              className={`${index === exerciseIndex ? 'active' : ''} ${setsDone[index] >= item.sets ? 'done' : ''}`}
              type="button"
              key={item.id}
              onClick={() => setExerciseIndex(index)}
            >
              <span>{setsDone[index] >= item.sets ? '✓' : index + 1}</span>
              <small>{item.name}</small>
            </button>
          ))}
        </div>
        {previewIndex !== null && (
          <ExercisePreview index={previewIndex} onClose={() => setPreviewIndex(null)} onStartCamera={() => { setExerciseIndex(previewIndex); setPreviewIndex(null); setStage('camera'); }} />
        )}
      </main>
    );
  }

  return (
    <main className="coach-app">
      <header className="coach-header">
        <button className="wordmark" type="button" onClick={() => navigate('today')} aria-label="Relay home"><span>R</span>RELAY</button>
        <p>{dateLabel}</p>
        <button className="avatar" type="button" aria-label="Open profile" onClick={() => navigate('you')}>
          {account?.user.displayName?.charAt(0).toUpperCase() ?? 'R'}
        </button>
      </header>

      {view === 'today' && (
        <>
          <section className="today-head">
            <p className="kicker"><i /> {completedToday ? 'TODAY\'S WORK IS DONE' : 'YOUR WORKOUT IS READY'}</p>
            <h1>{completedToday ? <>Strong work.<br />Recover well.</> : <>Full body.<br />Zero guesswork.</>}</h1>
            <p>{completedToday ? '24 minutes completed · 6 movements' : '24 minutes · Beginner · No equipment'}</p>
          </section>

          <section className={`account-strip ${accountStatus === 'signed-in' ? 'account-ready' : ''}`}>
            {accountStatus === 'loading' && <><span className="account-pulse" /><div><strong>Loading your training</strong><small>Getting today ready…</small></div></>}
            {accountStatus === 'signed-in' && account && <>
              <span className="account-check">✓</span>
              <div><strong>{account.user.displayName}, your progress is synced</strong><small>{account.user.email} · workouts, wellness and schedule stay with your account</small></div>
              <button type="button" onClick={() => navigate('you')}>My plan <span>→</span></button>
            </>}
            {(accountStatus === 'signed-out' || accountStatus === 'error') && <>
              <span className="account-lock">R</span>
              <div><strong>Keep your progress on every phone</strong><small>Sign in with the email on your ChatGPT account. No extra password.</small></div>
              <a href="/signin-with-chatgpt?return_to=%2F">Sign in securely <span>→</span></a>
            </>}
          </section>

          {saveStatus && <p className="save-toast" role="status">{saveStatus}</p>}

          <section className={`session-card ${completedToday ? 'completed-card' : ''}`}>
            <div className="session-image">
              <MovementVideo exercise={workout[0]} controls={false} />
              <span className="guide-chip">{completedToday ? 'COMPLETED' : '6 VIDEO GUIDES'}</span>
              <button type="button" className="preview-button" onClick={() => startSession()} aria-label="Start coached workout"><span>START</span>→</button>
            </div>
            <div className="session-info">
              <div>
                <p>{completedToday ? 'SAVED TO YOUR HISTORY' : 'RECOMMENDED FOR TODAY'}</p>
                <h2>Foundation 01</h2>
              </div>
              <div className="session-facts"><span><strong>24</strong> MIN</span><span><strong>6</strong> MOVES</span><span><strong>16</strong> SETS</span></div>
              <button className="start-session" type="button" onClick={() => startSession()}>{completedToday ? 'Do it again' : 'Start today’s workout'} <span>→</span></button>
              <p className="privacy-copy"><b>●</b> Camera coach is optional and runs on this device.</p>
            </div>
          </section>

          <section className="route-section">
            <div className="route-title">
              <div><p className="kicker">TODAY&apos;S ROUTE</p><h2>Everything you&apos;ll do</h2></div>
              <span>24 min total</span>
            </div>
            <div className="simple-list">
              {workout.map((move, index) => (
                <button type="button" key={move.id} onClick={() => setPreviewIndex(index)}>
                  <span className="move-number">{(index + 1).toString().padStart(2, '0')}</span>
                  <span className="move-copy"><strong>{move.name}</strong><small>{move.sets} × {move.targetLabel} · {move.muscles}</small></span>
                  <span className="move-tag">Guide + camera</span>
                  <span className="move-arrow">›</span>
                </button>
              ))}
            </div>
          </section>

          <section className="checkin-section">
            <div className="checkin-heading">
              <div><p className="kicker">DAILY CHECK-IN</p><h2>Train the person, not just the plan.</h2></div>
              <span>{accountStatus === 'signed-in' ? 'Saved to your account' : 'Sign in to save'}</span>
            </div>
            {accountStatus === 'signed-in' && account ? (
              <form className="checkin-form" onSubmit={saveCheckin}>
                <label><span>Water today</span><div><input inputMode="numeric" type="number" min="0" max="10000" step="250" value={account.todayLog.waterMl} onChange={(event) => updateLog({ waterMl: Number(event.target.value) })} /><small>ML</small></div></label>
                <label><span>Sleep</span><div><input inputMode="decimal" type="number" min="0" max="16" step="0.5" value={account.todayLog.sleepHours} onChange={(event) => updateLog({ sleepHours: Number(event.target.value) })} /><small>HRS</small></div></label>
                <label><span>Meals</span><select value={account.todayLog.meals} onChange={(event) => updateLog({ meals: event.target.value })}><option>Needs attention</option><option>Balanced</option><option>On track</option></select></label>
                <label><span>Energy</span><select value={account.todayLog.energy} onChange={(event) => updateLog({ energy: Number(event.target.value) })}><option value="1">1 · Very low</option><option value="2">2 · Low</option><option value="3">3 · Steady</option><option value="4">4 · Good</option><option value="5">5 · Excellent</option></select></label>
                <label className="checkin-notes"><span>Anything your coach should know?</span><input type="text" maxLength={500} placeholder="Soreness, stress, appetite, recovery…" value={account.todayLog.notes} onChange={(event) => updateLog({ notes: event.target.value })} /></label>
                <button type="submit">Save check-in <span>→</span></button>
              </form>
            ) : (
              <div className="checkin-gate"><p>Your water, sleep, food quality and energy stay private and help keep future training realistic.</p><a href="/signin-with-chatgpt?return_to=%2F">Create my training account <span>→</span></a></div>
            )}
          </section>

          <section className="camera-promise">
            <div className="camera-icon"><i /><span /></div>
            <div><p className="kicker">LIVE FORM COACH</p><h2>Your phone can watch the rep—not record your room.</h2><p>Set it 2–3 metres away. Relay maps visible joint positions, counts completed reps, and gives one useful correction at a time.</p></div>
            <button type="button" onClick={() => { setSessionOpen(true); setStage('camera'); }}>Try camera coach <span>→</span></button>
          </section>
        </>
      )}

      {view === 'history' && (
        <section className="subpage history-page">
          <p className="kicker">YOUR TRAINING</p>
          <h1>Proof you&apos;re<br />showing up.</h1>
          {accountStatus === 'signed-in' ? <>
            <div className="history-summary"><span><strong>{sessionHistory.length}</strong><small>SESSIONS</small></span><span><strong>{totalTrainingMinutes}</strong><small>MINUTES</small></span><span><strong>{trainingStreak}</strong><small>DAY STREAK</small></span></div>
            {sessionHistory.length > 0 ? <div className="history-list">
              {sessionHistory.map((item) => (
                <article key={item.id}><span className="history-tick">✓</span><div><small>{formatSessionDate(item.completedAt)}</small><strong>{item.workoutName}</strong><p>{Math.max(1, Math.round(item.durationSeconds / 60))} min · {item.setsCompleted} sets</p></div><b>{item.cameraSets > 0 ? `${item.cameraSets} coached` : 'Complete'}</b></article>
              ))}
            </div> : <div className="empty-history"><span>01</span><h2>Your first session starts here.</h2><p>Finish today&apos;s workout and it will appear here automatically.</p><button type="button" onClick={() => navigate('today')}>Start Foundation 01 <b>→</b></button></div>}
          </> : <AccountGate title="Your history, on every device." copy="Sign in with your email-based ChatGPT account to securely save completed workouts and progress." />}
        </section>
      )}

      {view === 'you' && (
        <section className="subpage you-page">
          <p className="kicker">YOUR COACH</p>
          <h1>Simple choices.<br />Clear training.</h1>
          {accountStatus === 'signed-in' && account ? <>
            <article className="profile-card"><span className="large-avatar">{account.user.displayName.charAt(0).toUpperCase()}</span><div><strong>{account.user.displayName}</strong><small>{account.user.email} · {account.profile.level}</small></div><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></article>

            <article className="profile-form-card">
              <div className="card-heading"><div><small>TRAINING PROFILE</small><h2>Make the plan fit your life.</h2></div><span>Private to your account</span></div>
              <div className="profile-grid">
                <label><span>Main goal</span><select value={account.profile.goal} onChange={(event) => updateProfile({ goal: event.target.value })}><option>Build strength</option><option>Move better</option><option>Lose body fat</option><option>Improve conditioning</option></select></label>
                <label><span>Experience</span><select value={account.profile.level} onChange={(event) => updateProfile({ level: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
                <label><span>Days per week</span><input type="number" min="1" max="7" value={account.profile.daysPerWeek} onChange={(event) => updateProfile({ daysPerWeek: Number(event.target.value) })} /></label>
                <label><span>Session length</span><div><input type="number" min="10" max="120" value={account.profile.sessionMinutes} onChange={(event) => updateProfile({ sessionMinutes: Number(event.target.value) })} /><small>MIN</small></div></label>
                <label><span>Water target</span><div><input type="number" min="500" max="6000" step="250" value={account.profile.hydrationTargetMl} onChange={(event) => updateProfile({ hydrationTargetMl: Number(event.target.value) })} /><small>ML</small></div></label>
                <label><span>Sleep target</span><div><input type="number" min="4" max="12" step="0.5" value={account.profile.sleepTargetHours} onChange={(event) => updateProfile({ sleepTargetHours: Number(event.target.value) })} /><small>HRS</small></div></label>
                <label><span>Daily reminder</span><select value={account.profile.reminderTime} onChange={(event) => updateProfile({ reminderTime: event.target.value })}><option value="06:30">6:30 AM</option><option value="07:30">7:30 AM</option><option value="12:00">12:00 PM</option><option value="17:30">5:30 PM</option><option value="18:00">6:00 PM</option><option value="19:00">7:00 PM</option><option value="20:30">8:30 PM</option></select></label>
                <label className="profile-wide"><span>Injuries or movement limits</span><input type="text" maxLength={300} placeholder="Optional — e.g. sensitive right knee" value={account.profile.injuries} onChange={(event) => updateProfile({ injuries: event.target.value })} /></label>
              </div>
            </article>

            <article className="schedule-card">
              <div className="card-heading"><div><small>WEEKLY ROUTINE</small><h2>Your training schedule</h2></div><span>{account.profile.reminderTime} reminder</span></div>
              <div className="schedule-list">
                {weekdayLabels.map((day, weekday) => {
                  const item = account.schedule.find((entry) => entry.weekday === weekday);
                  return <label className={item?.enabled ? 'scheduled' : ''} key={day}>
                    <input type="checkbox" checked={item?.enabled ?? false} onChange={(event) => updateScheduleDay(weekday, { enabled: event.target.checked })} />
                    <span>{day}</span><strong>{item?.enabled ? 'Foundation 01' : 'Recovery day'}</strong>
                    <select aria-label={`${day} workout time`} disabled={!item?.enabled} value={item?.startTime ?? account.profile.reminderTime} onChange={(event) => updateScheduleDay(weekday, { startTime: event.target.value, enabled: true })}><option value="06:30">6:30 AM</option><option value="07:30">7:30 AM</option><option value="12:00">12:00 PM</option><option value="17:30">5:30 PM</option><option value="18:00">6:00 PM</option><option value="19:00">7:00 PM</option><option value="20:30">8:30 PM</option></select>
                  </label>;
                })}
              </div>
              <button className="save-plan" type="button" onClick={saveProfileAndSchedule}>Save plan & schedule <span>→</span></button>
              {saveStatus && <p className="inline-status" role="status">{saveStatus}</p>}
            </article>

            <article className="setting-card">
              <div><span>VOICE COACH</span><h2>Hear reps and form cues</h2><p>Relay speaks only during a camera-coached set.</p></div>
              <button className={audioEnabled ? 'switch on' : 'switch'} type="button" onClick={() => setAudioEnabled((value) => !value)} aria-pressed={audioEnabled}><i /></button>
            </article>
            <article className="privacy-card"><span className="shield">✓</span><div><small>CAMERA PRIVACY</small><h2>Your video stays yours.</h2><p>Pose tracking runs in your browser. Relay never saves or uploads camera frames; only your completed workout totals are stored.</p></div></article>
          </> : <AccountGate title="One account. Your complete routine." copy="Sign in with the email on your ChatGPT account to save workouts, daily wellness, goals and your weekly schedule." />}
        </section>
      )}

      <nav className="phone-nav" aria-label="Primary navigation">
        <button className={view === 'today' ? 'active' : ''} type="button" onClick={() => navigate('today')}><span>●</span>Today</button>
        <button className={view === 'history' ? 'active' : ''} type="button" onClick={() => navigate('history')}><span>◫</span>History</button>
        <button className={view === 'you' ? 'active' : ''} type="button" onClick={() => navigate('you')}><span>◌</span>You</button>
      </nav>
      <footer><span>RELAY / TRAIN WITH CLARITY</span><span>PRIVATE BY DESIGN</span></footer>

      {previewIndex !== null && (
        <ExercisePreview index={previewIndex} onClose={() => setPreviewIndex(null)} onStartCamera={() => startSession(previewIndex)} />
      )}
    </main>
  );
}

function MovementVideo({ exercise, controls = true }: { exercise: Exercise; controls?: boolean }) {
  return (
    <video
      key={exercise.video}
      src={exercise.video}
      poster={exercise.image}
      autoPlay
      loop
      muted
      playsInline
      controls={controls}
      preload="metadata"
      aria-label={`Looping movement demonstration for ${exercise.name}`}
    >
      Your browser does not support the movement video.
    </video>
  );
}

function AccountGate({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="account-gate-card">
      <span className="gate-mark">R</span>
      <small>YOUR PRIVATE TRAINING ACCOUNT</small>
      <h2>{title}</h2>
      <p>{copy}</p>
      <a href="/signin-with-chatgpt?return_to=%2F">Continue securely <span>→</span></a>
      <em>No extra password · camera video never uploads</em>
    </article>
  );
}

function ExercisePreview({ index, onClose, onStartCamera }: { index: number; onClose: () => void; onStartCamera: () => void }) {
  const item = workout[index];
  return (
    <div className="preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="exercise-preview" role="dialog" aria-modal="true" aria-label={`${item.name} movement guide`}>
        <button className="preview-close" type="button" onClick={onClose} aria-label="Close movement guide">×</button>
        <div className="preview-visual">
          <MovementVideo exercise={item} />
          <span>LOOPING VIDEO</span><span>WATCH FIRST</span>
        </div>
        <div className="preview-body">
          <p className="kicker">MOVEMENT {index + 1} OF {workout.length}</p>
          <h2>{item.name}</h2>
          <p>{item.intro}</p>
          <div className="preview-dose"><span><small>DO</small><strong>{item.sets} × {item.targetLabel}</strong></span><span><small>REST</small><strong>{item.rest} sec</strong></span></div>
          <ol>{item.tips.map((tip, tipIndex) => <li key={tip}><span>{tipIndex + 1}</span>{tip}</li>)}</ol>
          <button className="camera-cta" type="button" onClick={onStartCamera}><span className="camera-dot"><i /></span><b>Start with camera coach</b><em>→</em></button>
          <button className="manual-cta" type="button" onClick={onClose}>Got it</button>
        </div>
      </section>
    </div>
  );
}
