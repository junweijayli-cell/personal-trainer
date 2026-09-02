'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import CameraCoach from './camera-coach';
import LandingAuth, { LanguageSwitch, type Language } from './landing-auth';
import {
  createCheckout,
  createCustomerPortal,
  deleteAccount,
  downloadAccountExport,
  getActiveSession,
  importLegacySnapshot,
  loadAccountSnapshot,
  loadMember,
  observeAuth,
  readLegacySnapshot,
  saveTrainingProfile,
  saveTrainingSchedule,
  saveWellnessLog,
  saveWorkout as saveWorkoutToAccount,
  signOutAccount,
} from './account-service';
import { membershipDaysRemaining, membershipHasAccess } from './membership';
import type { AccountSnapshot, DailyLog, MemberAccount, ScheduleItem } from './account-types';
import {
  buildWorkout,
  equipmentOptions,
  focusOptions,
  getFocusOption,
  getRecommendedFocus,
  getWorkoutStats,
  weeklyRotation,
  type EquipmentId,
  type Exercise,
  type FocusId,
} from './workout-data';

type View = 'today' | 'history' | 'you';
type SessionStage = 'setup' | 'guide' | 'camera' | 'rest' | 'summary';
type CoachingMode = 'photos' | 'camera';

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
const weekdayChinese = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const focusChinese: Record<FocusId, string> = { legs: '腿部与臀部', chest: '胸部与推力', back: '背部与拉力', neck: '颈部与体态', core: '核心与稳定', mobility: '灵活性与恢复', cardio: '有氧与耐力', 'full-body': '全身训练' };
const focusShortChinese: Record<FocusId, string> = { legs: '腿部', chest: '胸部', back: '背部', neck: '颈部', core: '核心', mobility: '拉伸', cardio: '有氧', 'full-body': '全身' };
const focusDescriptionChinese: Record<FocusId, string> = { legs: '深蹲、髋部铰链与单腿力量', chest: '胸部、肩部与肱三头肌', back: '上背、背阔肌与体态', neck: '温和的颈部力量与对齐', core: '躯干控制与稳定动作', mobility: '恢复日的轻松活动', cardio: '低冲击耐力训练', 'full-body': '从头到脚的均衡训练' };
const equipmentChinese: Record<EquipmentId, string> = { dumbbells: '哑铃', 'resistance-band': '弹力带', bench: '训练凳', kettlebell: '壶铃', barbell: '杠铃', 'cable-machine': '龙门架', 'leg-press': '腿举机', 'suspension-trainer': '悬挂带', 'stability-ball': '健身球', 'medicine-ball': '药球', 'stationary-bike': '健身车' };
const exerciseChinese: Record<string, string> = {
  squat: '徒手深蹲', 'reverse-lunge': '后撤弓步', 'incline-pushup': '上斜俯卧撑', 'glute-bridge': '臀桥', 'plank-rotation': '高位平板旋转', 'forearm-plank': '前臂平板支撑', 'bird-dog': '鸟狗式', 'dead-bug': '死虫式', 'goblet-squat': '高脚杯深蹲', 'dumbbell-rdl': '哑铃罗马尼亚硬拉', 'dumbbell-floor-press': '哑铃地板卧推', 'dumbbell-row': '支撑哑铃划船', 'band-row': '弹力带划船', 'bench-step-up': '训练凳踏步', 'kettlebell-deadlift': '壶铃硬拉', 'barbell-squat': '杠铃后蹲', 'lat-pulldown': '高位下拉', 'leg-press': '腿举', 'cable-chest-press': '站姿绳索推胸', 'suspension-row': '悬挂划船', 'stability-ball-curl': '健身球腿弯举', 'medicine-ball-press': '药球深蹲推举', 'stationary-bike': '健身车间歇训练', 'chin-tuck': '站姿收下巴', 'side-neck-isometric': '颈侧等长训练', 'upper-trap-stretch': '上斜方肌拉伸',
};
const phaseChinese: Record<'start' | 'middle' | 'finish', string> = { start: '准备', middle: '动作', finish: '完成' };

function equipmentSummaryChinese(selected: EquipmentId[]) {
  return selected.length ? selected.map((id) => equipmentChinese[id]).join(' · ') : '仅徒手训练';
}

const muscleChinese: Record<string, string> = {
  Quads: '股四头肌', glutes: '臀肌', Glutes: '臀肌', core: '核心', Core: '核心', Chest: '胸部', shoulders: '肩部', Shoulders: '肩部', triceps: '肱三头肌', Triceps: '肱三头肌', hamstrings: '腘绳肌', Hamstrings: '腘绳肌', balance: '平衡', Back: '背部', lats: '背阔肌', posture: '体态', 'Upper back': '上背', 'Deep core': '深层核心', 'hip flexors': '髋屈肌', coordination: '协调', 'Upper traps': '上斜方肌', neck: '颈部', Neck: '颈部', calves: '小腿', 'lower back': '下背', biceps: '肱二头肌', adductors: '内收肌', cardio: '有氧', stamina: '耐力', mobility: '灵活性', recovery: '恢复',
};

function translateTarget(value: string) {
  return value.replace('reps', '次').replace('/ side', '每侧').replace('sec', '秒').replace('min', '分钟');
}

function translateMuscles(value: string) {
  return value.split(' · ').map((item) => muscleChinese[item] ?? item).join(' · ');
}

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
  const [language, setLanguage] = useState<Language>('en');
  const [member, setMember] = useState<MemberAccount | null>(null);
  const [recommendedFocus, setRecommendedFocus] = useState<FocusId>('full-body');
  const [view, setView] = useState<View>('today');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [stage, setStage] = useState<SessionStage>('setup');
  const [setupStep, setSetupStep] = useState(1);
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('photos');
  const [selectedFocus, setSelectedFocus] = useState<FocusId>('full-body');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentId[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const activeWorkout = useMemo(
    () => buildWorkout(selectedFocus, selectedEquipment),
    [selectedFocus, selectedEquipment],
  );
  const workoutStats = useMemo(() => getWorkoutStats(activeWorkout), [activeWorkout]);
  const totalSets = workoutStats.sets;
  const focusInfo = getFocusOption(selectedFocus);
  const recommendedFocusInfo = getFocusOption(recommendedFocus);
  const planName = `${focusInfo.shortLabel} Day 01`;
  const displayPlanName = language === 'zh' ? `${focusShortChinese[selectedFocus]}训练 01` : planName;
  const equipmentSummary = selectedEquipment.length > 0
    ? selectedEquipment.map((id) => equipmentOptions.find((item) => item.id === id)?.shortLabel).filter(Boolean).join(' · ')
    : 'Bodyweight only';
  const [setsDone, setSetsDone] = useState<number[]>(activeWorkout.map(() => 0));
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
  const [todayWeekday, setTodayWeekday] = useState(-1);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [legacySnapshot, setLegacySnapshot] = useState<AccountSnapshot | null>(null);
  const exercise = activeWorkout[exerciseIndex] ?? activeWorkout[0];
  const completedSetCount = setsDone.reduce((sum, count) => sum + count, 0);
  const sessionPercent = Math.round(completedSetCount / totalSets * 100);
  const sessionHistory = account?.sessions ?? [];
  const totalTrainingMinutes = sessionHistory.length > 0
    ? Math.max(1, Math.round(sessionHistory.reduce((sum, session) => sum + session.durationSeconds, 0) / 60))
    : 0;
  const trainingStreak = calculateStreak(sessionHistory.map((session) => session.completedAt));
  const trialRemaining = member ? membershipDaysRemaining(member.membership) : null;
  const tr = (english: string, chinese: string) => language === 'zh' ? chinese : english;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const todayFocus = getRecommendedFocus();
      setRecommendedFocus(todayFocus);
      setSelectedFocus(todayFocus);
      setTodayWeekday(new Date().getDay());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const savedLanguage = window.localStorage.getItem('relay-language');
        if (savedLanguage === 'zh' || savedLanguage === 'en') setLanguage(savedLanguage);
        const isReset = new URLSearchParams(window.location.search).get('reset') === '1';
        if (isReset) {
          if (!cancelled) { setPasswordRecovery(true); setAccountStatus('signed-out'); }
          return;
        }
        const session = await getActiveSession();
        if (!session) {
          if (!cancelled) setAccountStatus('signed-out');
          return;
        }
        const activeMember = await loadMember(session);
        const snapshot = await loadAccountSnapshot(activeMember);
        if (cancelled) return;
        setMember(activeMember);
        setAccount(snapshot);
        setSelectedEquipment(snapshot.profile.equipment.filter((item): item is EquipmentId => equipmentOptions.some((option) => option.id === item)));
        setLegacySnapshot(readLegacySnapshot(activeMember.email));
        setLanguage(activeMember.locale);
        setAccountStatus('signed-in');
        setCompletedToday(snapshot.sessions.some((item) => localDateKey(new Date(item.completedAt)) === localDateKey()));
      } catch {
        if (!cancelled) setAccountStatus('error');
      }
    }
    void hydrate();
    const unsubscribe = observeAuth((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setMember(null);
        setAccount(null);
        setAccountStatus('signed-out');
      }
      if (event === 'SIGNED_OUT') {
        setMember(null);
        setAccount(null);
        setAccountStatus('signed-out');
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('relay-language', language);
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    } catch {
      // Language preferences are optional.
    }
  }, [language]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('relay-equipment') ?? '[]') as unknown;
      if (Array.isArray(saved)) {
        const valid = saved.filter((item): item is EquipmentId => equipmentOptions.some((option) => option.id === item));
        window.setTimeout(() => setSelectedEquipment(valid), 0);
      }
    } catch {
      // Device preferences are optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('relay-equipment', JSON.stringify(selectedEquipment));
    } catch {
      // Device preferences are optional.
    }
  }, [selectedEquipment]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExerciseIndex(0);
      setPendingExerciseIndex(0);
      setSetsDone(activeWorkout.map(() => 0));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeWorkout]);

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

  useEffect(() => {
    if (!sessionOpen) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [sessionOpen, setupStep, stage, exerciseIndex]);

  function startSession(startAt = 0) {
    setSessionOpen(true);
    setStage('setup');
    setSetupStep(1);
    setCoachingMode('photos');
    setExerciseIndex(startAt);
    setSetsDone(activeWorkout.map(() => 0));
    setElapsed(0);
    setCameraSets(0);
    setPreviewIndex(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function completeSet() {
    const nextSetCount = Math.min(exercise.sets, setsDone[exerciseIndex] + 1);
    setSetsDone((counts) => counts.map((count, index) => index === exerciseIndex ? nextSetCount : count));
    if (exerciseIndex === activeWorkout.length - 1 && nextSetCount >= exercise.sets) {
      setStage('summary');
      return;
    }
    setPendingExerciseIndex(nextSetCount >= exercise.sets ? exerciseIndex + 1 : exerciseIndex);
    setRestSeconds(exercise.rest);
    setStage('rest');
  }

  function toggleEquipment(item: EquipmentId) {
    setSelectedEquipment((current) => current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item]);
  }

  function endRest() {
    setExerciseIndex(pendingExerciseIndex);
    setStage('guide');
  }

  async function postAccount(action: string, data?: unknown) {
    if (!account || !member) throw new Error(tr('Sign in to save this.', '请先登录后保存。'));
    if (action === 'save-workout') {
      await saveWorkoutToAccount(member, data as Parameters<typeof saveWorkoutToAccount>[1]);
    } else if (action === 'save-checkin') {
      await saveWellnessLog(member, data as DailyLog);
    } else if (action === 'save-profile') {
      await saveTrainingProfile(member, data as AccountSnapshot['profile']);
    } else if (action === 'save-schedule') {
      await saveTrainingSchedule(member, data as ScheduleItem[]);
    } else {
      throw new Error('Unsupported account update.');
    }
    const snapshot = await loadAccountSnapshot(member);
    setAccount(snapshot);
    setAccountStatus('signed-in');
    return snapshot;
  }

  async function completeAuthentication(nextMember: MemberAccount) {
    setAccountStatus('loading');
    try {
      const snapshot = await loadAccountSnapshot(nextMember);
      setMember(nextMember);
      setAccount(snapshot);
      setSelectedEquipment(snapshot.profile.equipment.filter((item): item is EquipmentId => equipmentOptions.some((option) => option.id === item)));
      setLegacySnapshot(readLegacySnapshot(nextMember.email));
      setLanguage(nextMember.locale);
      setPasswordRecovery(false);
      setAccountStatus('signed-in');
      setView('today');
      window.scrollTo({ top: 0 });
    } catch {
      setAccountStatus('error');
    }
  }

  function signOut() {
    setMember(null);
    setAccount(null);
    setLegacySnapshot(null);
    setAccountStatus('signed-out');
    setView('today');
    window.scrollTo({ top: 0 });
    void signOutAccount();
  }

  async function selectSubscription(plan: 'monthly' | 'annual') {
    if (!member) return;
    setSaveStatus(tr('Opening secure checkout…', '正在打开安全支付页面…'));
    try {
      window.location.assign(await createCheckout(plan));
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : tr('Checkout is unavailable.', '暂时无法支付。'));
    }
  }

  async function manageBilling() {
    setSaveStatus(tr('Opening billing settings…', '正在打开账单设置…'));
    try { window.location.assign(await createCustomerPortal()); }
    catch (error) { setSaveStatus(error instanceof Error ? error.message : tr('Billing settings are unavailable.', '暂时无法打开账单设置。')); }
  }

  async function importDeviceData() {
    if (!member || !legacySnapshot) return;
    setSaveStatus(tr('Importing this device’s history…', '正在导入此设备的记录…'));
    try {
      await importLegacySnapshot(member, legacySnapshot);
      const imported = await loadAccountSnapshot(member);
      setAccount(imported);
      setSelectedEquipment(imported.profile.equipment.filter((item): item is EquipmentId => equipmentOptions.some((option) => option.id === item)));
      setLegacySnapshot(null);
      setSaveStatus(tr('Your device history is now secured in your account.', '此设备的记录已安全导入账户。'));
    } catch (error) { setSaveStatus(error instanceof Error ? error.message : tr('Import failed.', '导入失败。')); }
  }

  async function removeAccount() {
    if (!member) return;
    const confirmed = window.confirm(tr('Delete your Relay account and all saved data? Active billing will be canceled. This cannot be undone.', '删除 Relay 账户及全部数据？当前订阅也会取消，此操作无法撤销。'));
    if (!confirmed) return;
    setSaveStatus(tr('Deleting your account…', '正在删除账户…'));
    try { await deleteAccount(); signOut(); }
    catch (error) { setSaveStatus(error instanceof Error ? error.message : tr('Account deletion failed.', '账户删除失败。')); }
  }

  async function saveWorkout() {
    setCompletedToday(true);
    if (accountStatus === 'signed-in') {
      setSaveStatus('Saving workout…');
      try {
        await postAccount('save-workout', {
          workoutId: `${selectedFocus}-day-01`,
          workoutName: planName,
          durationSeconds: Math.max(1, elapsed),
          setsCompleted: totalSets,
          movementsCompleted: activeWorkout.length,
          cameraSets,
          notes: `${equipmentSummary}; focus: ${focusInfo.label}`,
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

  async function beginWorkout() {
    if (member && account) {
      const nextProfile = {
        ...account.profile,
        equipment: selectedEquipment,
        preferredFocus: [selectedFocus],
      };
      setAccount({ ...account, profile: nextProfile });
      try { await saveTrainingProfile(member, nextProfile); }
      catch (error) { setSaveStatus(error instanceof Error ? error.message : tr('Could not save your training preferences.', '无法保存你的训练偏好。')); }
    }
    setStage(coachingMode === 'camera' ? 'camera' : 'guide');
  }

  async function saveCheckin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    if (!account.profile.consentHealthData) {
      setSaveStatus(tr('Please consent before saving wellness information.', '保存健康信息前请先同意数据处理。'));
      return;
    }
    setSaveStatus('Saving today’s check-in…');
    try {
      if (member) await saveTrainingProfile(member, account.profile);
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
      await postAccount('save-schedule', account.schedule.map((item) => ({
        ...item,
        workoutName: `${getFocusOption(weeklyRotation[item.weekday]).shortLabel} Day 01`,
      })));
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
        : [...current.schedule, {
          id: '',
          weekday,
          workoutName: `${getFocusOption(weeklyRotation[weekday]).shortLabel} Day 01`,
          startTime: '18:00',
          durationMinutes: 24,
          enabled: true,
          ...patch,
        }];
      return { ...current, schedule: schedule.sort((a, b) => a.weekday - b.weekday) };
    });
  }

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (accountStatus === 'loading') {
    return <main className="relay-loading"><span>R</span><p>{tr('Preparing your coach…', '正在准备你的教练…')}</p></main>;
  }

  if (!member || !account) {
    return <LandingAuth language={language} onLanguageChange={setLanguage} onAuthenticated={completeAuthentication} initialMode={passwordRecovery ? 'reset' : undefined} />;
  }

  if (!membershipHasAccess(member.membership)) {
    return <TrialPaywall language={language} member={member} onLanguageChange={setLanguage} onSubscribe={selectSubscription} onSignOut={signOut} />;
  }

  if (sessionOpen) {
    if (stage === 'setup') {
      return (
        <main className="workout-setup">
          <header className="setup-header">
            <button type="button" onClick={() => setSessionOpen(false)} aria-label="Exit workout setup">×</button>
            <div><span>{displayPlanName.toUpperCase()}</span><strong>{tr('Build today’s session', '创建今天的训练')}</strong></div>
            <span>{setupStep} / 4</span>
          </header>
          <div className="setup-progress" aria-label={`Workout setup step ${setupStep} of 4`}>
            {[1, 2, 3, 4].map((step) => <i className={step <= setupStep ? 'active' : ''} key={step} />)}
          </div>

          {setupStep === 1 && <section className="setup-panel setup-builder-panel">
            <div className="setup-copy">
              <p className="kicker">{tr('STEP 1 · CHOOSE TODAY\'S FOCUS', '第 1 步 · 选择今日部位')}</p>
              <h1>{tr('What do you want', '今天你想训练')}<br />{tr('to train today?', '哪个部位？')}</h1>
              <p>{tr('Follow Relay’s rotation or choose what feels right. Your choice only changes today’s session.', '你可以跟随 Relay 的轮换推荐，也可以选择今天最想练的部位。')}</p>
              <button className={`recommended-focus ${selectedFocus === recommendedFocus ? 'selected' : ''}`} type="button" onClick={() => setSelectedFocus(recommendedFocus)}>
                <span><small>{tr('RECOMMENDED TODAY', '今日推荐')}</small><strong>{language === 'zh' ? focusChinese[recommendedFocus] : recommendedFocusInfo.label}</strong><em>{language === 'zh' ? focusDescriptionChinese[recommendedFocus] : recommendedFocusInfo.description}</em></span>
                <b>{selectedFocus === recommendedFocus ? '✓' : tr('Use this', '使用')}</b>
              </button>
              <div className="focus-grid" role="radiogroup" aria-label="Body area to train">
                {focusOptions.map((option) => (
                  <button className={selectedFocus === option.id ? 'selected' : ''} role="radio" aria-checked={selectedFocus === option.id} type="button" key={option.id} onClick={() => setSelectedFocus(option.id)}>
                    <span>{language === 'zh' ? focusShortChinese[option.id] : option.shortLabel}</span><small>{language === 'zh' ? focusDescriptionChinese[option.id] : option.description}</small><b>{selectedFocus === option.id ? '✓' : '→'}</b>
                  </button>
                ))}
              </div>
              <button className="setup-next" type="button" onClick={() => setSetupStep(2)}>{tr('Next: my equipment', '下一步：我的器械')} <span>→</span></button>
            </div>
          </section>}

          {setupStep === 2 && <section className="setup-panel setup-choice-panel setup-builder-panel">
            <div className="setup-copy">
              <p className="kicker">{tr('STEP 2 · WHAT DO YOU HAVE?', '第 2 步 · 你有什么器械？')}</p>
              <h1>{tr('Pick your', '选择你的')}<br />{tr('equipment.', '训练器械。')}</h1>
              <p>{tr('Select everything available today. Relay will use it where it helps and keep a bodyweight option in every plan.', '选择今天可用的全部器械。Relay 会合理使用，并为每个计划保留徒手选项。')}</p>
              <div className="bodyweight-default"><span>{tr('YOU ALWAYS HAVE', '默认拥有')}</span><strong>{tr('Bodyweight training', '徒手训练')}</strong><b>✓ {tr('Included', '已包含')}</b></div>
              <div className="equipment-grid" role="group" aria-label="Available equipment">
                {equipmentOptions.map((item) => {
                  const selected = selectedEquipment.includes(item.id);
                  return <button className={selected ? 'selected' : ''} aria-pressed={selected} type="button" key={item.id} onClick={() => toggleEquipment(item.id)}>
                    <span>{item.icon}</span><strong>{language === 'zh' ? equipmentChinese[item.id] : item.label}</strong><small>{selected ? tr('In today’s gym', '今天可用') : tr('Tap to add', '点击添加')}</small><b>{selected ? '✓' : '+'}</b>
                  </button>;
                })}
              </div>
              <p className="equipment-note">{tr('No equipment? Leave these unselected. You’ll still get a complete plan.', '没有器械？保持未选择即可，你仍会获得完整计划。')}</p>
              <div className="setup-actions"><button type="button" onClick={() => setSetupStep(1)}>← {tr('Back', '返回')}</button><button className="setup-next" type="button" onClick={() => setSetupStep(3)}>{tr('Build my plan', '生成我的计划')} <span>→</span></button></div>
            </div>
          </section>}

          {setupStep === 3 && <section className="setup-panel setup-review-panel">
            <div className="setup-video"><PhaseGuide key={activeWorkout[0].id} exercise={activeWorkout[0]} compact language={language} /></div>
            <div className="setup-copy">
              <p className="kicker">{tr('STEP 3 · YOUR PLAN IS READY', '第 3 步 · 计划已准备好')}</p>
              <h1>{language === 'zh' ? focusChinese[selectedFocus] : focusInfo.label}.<br />{tr('Zero guesswork.', '无需猜测。')}</h1>
              <div className="setup-facts"><span><strong>{workoutStats.minutes}</strong><small>{tr('MINUTES', '分钟')}</small></span><span><strong>{workoutStats.moves}</strong><small>{tr('MOVES', '动作')}</small></span><span><strong>{workoutStats.sets}</strong><small>{tr('SETS', '组数')}</small></span></div>
              <div className="plan-mini-list">
                {activeWorkout.map((item, index) => <span key={item.id}><b>{index + 1}</b><strong>{language === 'zh' ? exerciseChinese[item.id] ?? item.name : item.name}</strong><small>{item.equipment === 'bodyweight' ? tr('Bodyweight', '徒手') : language === 'zh' ? equipmentChinese[item.equipment] : equipmentOptions.find((option) => option.id === item.equipment)?.label}</small></span>)}
              </div>
              <p className="coach-choice-label">{tr('HOW SHOULD RELAY GUIDE YOU?', '你希望 RELAY 如何指导？')}</p>
              <div className="coach-choice compact" role="radiogroup" aria-label="Coaching mode">
                <button className={coachingMode === 'photos' ? 'selected' : ''} role="radio" aria-checked={coachingMode === 'photos'} type="button" onClick={() => setCoachingMode('photos')}>
                  <span className="choice-icon">1·2·3</span><div><strong>{tr('Follow 3 clear steps', '跟随 3 个清晰步骤')}</strong><small>{tr('Set up, move, finish', '准备、动作、完成')}</small></div><b>{coachingMode === 'photos' ? '✓' : ''}</b>
                </button>
                <button className={coachingMode === 'camera' ? 'selected' : ''} role="radio" aria-checked={coachingMode === 'camera'} type="button" onClick={() => setCoachingMode('camera')}>
                  <span className="choice-icon camera-choice-icon"><i /></span><div><strong>{tr('Use live camera coach', '使用实时摄像指导')}</strong><small>{tr('Rep counting and form cues', '计数与动作纠正提示')}</small></div><b>{coachingMode === 'camera' ? '✓' : ''}</b>
                </button>
              </div>
              <div className="setup-actions"><button type="button" onClick={() => setSetupStep(2)}>← {tr('Back', '返回')}</button><button className="setup-next" type="button" onClick={() => setSetupStep(4)}>{tr('Ready check', '准备检查')} <span>→</span></button></div>
            </div>
          </section>}

          {setupStep === 4 && <section className="setup-panel setup-ready-panel">
            <div className="ready-mark">✓</div>
            <div className="setup-copy">
              <p className="kicker">{tr('STEP 4 · QUICK READY CHECK', '第 4 步 · 快速准备检查')}</p>
              <h1>{tr('Set your space.', '准备训练空间。')}<br />{tr('Then press start.', '然后开始。')}</h1>
              <div className="ready-list"><span><b>1</b><strong>{tr('Clear one arm-span of floor space', '清理出一臂宽的地面空间')}</strong></span><span><b>2</b><strong>{tr('Place your selected equipment within reach', '把选择的器械放在伸手可及的位置')}</strong></span><span><b>3</b><strong>{coachingMode === 'camera' ? tr('Prop your phone 2–3 metres away', '将手机固定在 2–3 米外') : tr('Keep your phone where each photo is easy to see', '将手机放在便于看清每张图片的位置')}</strong></span></div>
              <p className="ready-mode">{tr('TODAY', '今天')} <strong>{language === 'zh' ? focusChinese[selectedFocus] : focusInfo.label} · {language === 'zh' ? equipmentSummaryChinese(selectedEquipment) : equipmentSummary}</strong></p>
              <p className="ready-mode">{tr('YOUR MODE', '指导模式')} <strong>{coachingMode === 'camera' ? tr('Live camera coach', '实时摄像指导') : tr('Step-by-step photo guide', '分步图片指导')}</strong></p>
              <div className="setup-actions"><button type="button" onClick={() => setSetupStep(3)}>← {tr('Back', '返回')}</button><button className="setup-next start-workout-now" type="button" onClick={() => void beginWorkout()}>{tr('Start move 1', '开始第 1 个动作')} <span>→</span></button></div>
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
      const nextExercise = activeWorkout[pendingExerciseIndex];
      return (
        <main className="rest-screen">
          <header className="session-top">
            <button type="button" onClick={() => setSessionOpen(false)} aria-label="Exit workout">×</button>
            <div><span>{planName.toUpperCase()}</span><strong>{completedSetCount} of {totalSets} sets</strong></div>
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
            <span><strong>{activeWorkout.length}</strong><small>MOVES</small></span>
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
          <div><span>{planName.toUpperCase()}</span><strong>Move {exerciseIndex + 1} of {activeWorkout.length}</strong></div>
          <button className={audioEnabled ? 'audio-on' : ''} type="button" onClick={() => setAudioEnabled((value) => !value)} aria-label="Toggle voice coaching">{audioEnabled ? '♪' : '×'}</button>
        </header>
        <div className="session-progress"><i style={{ width: `${Math.max(3, sessionPercent)}%` }} /></div>
        <section className="guide-layout">
          <div className="guide-visual">
            <PhaseGuide key={exercise.id} exercise={exercise} language={language} />
            <span className="start-label">{exercise.video ? tr('VIDEO + 3 STEPS', '视频 + 三步') : tr('3-STEP COACH', '三步指导')}</span>
            <span className="move-label">{tr('LOOK, THEN MOVE', '先看，再练')}</span>
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
          {activeWorkout.map((item, index) => (
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
        {previewIndex !== null && activeWorkout[previewIndex] && (
          <ExercisePreview exercise={activeWorkout[previewIndex]} index={previewIndex} total={activeWorkout.length} language={language} onClose={() => setPreviewIndex(null)} onStartCamera={() => { setExerciseIndex(previewIndex); setPreviewIndex(null); setStage('camera'); }} />
        )}
      </main>
    );
  }

  return (
    <main className="coach-app">
      <header className="coach-header">
        <button className="wordmark" type="button" onClick={() => navigate('today')} aria-label="Relay home"><span>R</span>RELAY</button>
        <p>{trialRemaining !== null ? tr(`${trialRemaining} trial days left`, `试用剩余 ${trialRemaining} 天`) : tr(`${member.membership.plan} member`, `${member.membership.plan === 'monthly' ? '月付' : '年付'}会员`)}</p>
        <div className="coach-header-actions"><LanguageSwitch language={language} onChange={setLanguage} /><button className="avatar" type="button" aria-label="Open profile" onClick={() => navigate('you')}>{account.user.displayName?.charAt(0).toUpperCase() ?? 'R'}</button></div>
      </header>

      {view === 'today' && (
        <>
          <section className="today-head">
            <p className="kicker"><i /> {completedToday ? tr('TODAY\'S WORK IS DONE', '今天的训练已完成') : selectedFocus === recommendedFocus ? tr('RELAY\'S RECOMMENDATION', 'RELAY 今日推荐') : tr('YOUR CHOICE FOR TODAY', '你今天的选择')}</p>
            <h1>{completedToday ? <>{tr('Strong work.', '做得很好。')}<br />{tr('Recover well.', '好好恢复。')}</> : <>{language === 'zh' ? focusChinese[selectedFocus] : focusInfo.label}{tr('.', '。')}<br />{tr('Ready when you are.', '准备好就开始。')}</>}</h1>
            <p>{completedToday ? tr(`${workoutStats.minutes} minutes completed · ${workoutStats.moves} movements`, `已完成 ${workoutStats.minutes} 分钟 · ${workoutStats.moves} 个动作`) : tr(`${workoutStats.minutes} minutes · Beginner-friendly · ${equipmentSummary}`, `${workoutStats.minutes} 分钟 · 新手友好 · ${equipmentSummaryChinese(selectedEquipment)}`)}</p>
          </section>

          <section className="quick-plan" aria-label="Choose today&apos;s training focus">
            <div className="quick-plan-heading">
              <div><span>{tr('TODAY\'S FOCUS', '今日训练部位')}</span><strong>{language === 'zh' ? focusChinese[selectedFocus] : focusInfo.label}</strong><small>{language === 'zh' ? focusDescriptionChinese[selectedFocus] : focusInfo.description}</small></div>
              {selectedFocus !== recommendedFocus && <button type="button" onClick={() => setSelectedFocus(recommendedFocus)}>{tr('Use recommendation', '使用推荐')}</button>}
            </div>
            <div className="quick-focus-tabs" role="radiogroup" aria-label="Body area">
              {focusOptions.map((option) => <button className={selectedFocus === option.id ? 'selected' : ''} role="radio" aria-checked={selectedFocus === option.id} type="button" key={option.id} onClick={() => setSelectedFocus(option.id)}>{language === 'zh' ? focusShortChinese[option.id] : option.shortLabel}</button>)}
            </div>
          </section>

          <section className={`account-strip ${accountStatus === 'signed-in' ? 'account-ready' : ''}`}>
            {accountStatus === 'signed-in' && account && <>
              <span className="account-check">✓</span>
              <div><strong>{tr(`${account.user.displayName}, your progress is saved`, `${account.user.displayName}，你的进度已保存`)}</strong><small>{account.user.email} · {tr('workouts, wellness, and schedule sync securely across your devices', '训练、健康与日程会在你的设备间安全同步')}</small></div>
              <button type="button" onClick={() => navigate('you')}>{tr('My plan', '我的计划')} <span>→</span></button>
            </>}
            {(accountStatus === 'signed-out' || accountStatus === 'error') && <>
              <span className="account-lock">R</span>
              <div><strong>Keep your progress secure</strong><small>Return to the Relay account screen.</small></div>
              <button type="button" onClick={signOut}>Open account screen <span>→</span></button>
            </>}
          </section>

          {saveStatus && <p className="save-toast" role="status">{saveStatus}</p>}

          <section className={`session-card ${completedToday ? 'completed-card' : ''}`}>
            <div className="session-image">
              <PhaseGuide key={activeWorkout[0].id} exercise={activeWorkout[0]} compact language={language} />
              <span className="guide-chip">{completedToday ? tr('COMPLETED', '已完成') : tr(`${activeWorkout.filter((item) => item.video).length} VIDEOS · ${workoutStats.moves} GUIDES`, `${activeWorkout.filter((item) => item.video).length} 个视频 · ${workoutStats.moves} 个指导`)}</span>
              <button type="button" className="preview-button" onClick={() => startSession()} aria-label="Start coached workout"><span>START</span>→</button>
            </div>
            <div className="session-info">
              <div>
                <p>{completedToday ? tr('SAVED TO YOUR HISTORY', '已保存到训练记录') : selectedFocus === recommendedFocus ? tr('RECOMMENDED FOR TODAY', '今日推荐') : tr('CUSTOMIZED FOR TODAY', '今日定制')}</p>
                <h2>{language === 'zh' ? `${focusShortChinese[selectedFocus]}训练 01` : planName}</h2>
                <small className="plan-equipment">{language === 'zh' ? equipmentSummaryChinese(selectedEquipment) : equipmentSummary}</small>
              </div>
              <div className="session-facts"><span><strong>{workoutStats.minutes}</strong> {tr('MIN', '分钟')}</span><span><strong>{workoutStats.moves}</strong> {tr('MOVES', '动作')}</span><span><strong>{workoutStats.sets}</strong> {tr('SETS', '组')}</span></div>
              <button className="start-session" type="button" onClick={() => startSession()}>{completedToday ? tr('Do it again', '再练一次') : tr('Start today’s workout', '开始今天的训练')} <span>→</span></button>
              <p className="privacy-copy"><b>●</b> {tr('Camera coach is optional and runs on this device.', '摄像指导可选，并且只在本设备运行。')}</p>
            </div>
          </section>

          <section className="weekly-rotation">
            <div><p className="kicker">{tr('YOUR WEEKLY ROTATION', '你的每周轮换')}</p><h2>{tr('Balanced across the week.', '一周均衡训练。')}</h2><span>{tr('Relay rotates muscle groups so one area is not trained hard every day. Tap any day to use its focus now.', 'Relay 会轮换训练部位，避免同一部位连续高强度训练。点击任意一天即可使用该计划。')}</span></div>
            <div className="rotation-days">
              {weekdayLabels.map((day, weekday) => {
                const rotationFocus = getFocusOption(weeklyRotation[weekday]);
                const today = weekday === todayWeekday;
                return <button className={`${today ? 'today' : ''} ${selectedFocus === weeklyRotation[weekday] ? 'selected' : ''}`} type="button" key={day} onClick={() => setSelectedFocus(weeklyRotation[weekday])}>
                  <small>{language === 'zh' ? weekdayChinese[weekday] : day}</small><strong>{language === 'zh' ? focusShortChinese[weeklyRotation[weekday]] : rotationFocus.shortLabel}</strong>{today && <b>{tr('TODAY', '今天')}</b>}
                </button>;
              })}
            </div>
          </section>

          <section className="route-section">
            <div className="route-title">
              <div><p className="kicker">{tr('TODAY\'S ROUTE', '今天的训练路线')}</p><h2>{tr('Everything you’ll do', '今天的全部动作')}</h2></div>
              <span>{tr(`${workoutStats.minutes} min total`, `共 ${workoutStats.minutes} 分钟`)}</span>
            </div>
            <div className="simple-list">
              {activeWorkout.map((move, index) => (
                <button type="button" key={move.id} onClick={() => setPreviewIndex(index)}>
                  <span className="move-number">{(index + 1).toString().padStart(2, '0')}</span>
                  <span className="move-copy"><strong>{language === 'zh' ? exerciseChinese[move.id] ?? move.name : move.name}</strong><small>{move.sets} × {language === 'zh' ? translateTarget(move.targetLabel) : move.targetLabel} · {language === 'zh' ? translateMuscles(move.muscles) : move.muscles}</small></span>
                  <span className="move-tag">{move.equipment === 'bodyweight' ? tr('Bodyweight', '徒手') : language === 'zh' ? equipmentChinese[move.equipment] : equipmentOptions.find((option) => option.id === move.equipment)?.shortLabel}</span>
                  <span className="move-arrow">›</span>
                </button>
              ))}
            </div>
          </section>

          <section className="checkin-section">
            <div className="checkin-heading">
              <div><p className="kicker">{tr('DAILY CHECK-IN', '每日健康记录')}</p><h2>{tr('Train the person, not just the plan.', '训练的是完整的你，而不只是一张计划。')}</h2></div>
              <span>{accountStatus === 'signed-in' ? tr('Saved to your account', '已保存到你的账户') : tr('Sign in to save', '登录后保存')}</span>
            </div>
            {accountStatus === 'signed-in' && account ? (
              <form className="checkin-form" onSubmit={saveCheckin}>
                <label><span>{tr('Water today', '今日饮水')}</span><div><input inputMode="numeric" type="number" min="0" max="10000" step="250" value={account.todayLog.waterMl} onChange={(event) => updateLog({ waterMl: Number(event.target.value) })} /><small>ML</small></div></label>
                <label><span>{tr('Sleep', '睡眠')}</span><div><input inputMode="decimal" type="number" min="0" max="16" step="0.5" value={account.todayLog.sleepHours} onChange={(event) => updateLog({ sleepHours: Number(event.target.value) })} /><small>{tr('HRS', '小时')}</small></div></label>
                <label><span>{tr('Meals', '饮食')}</span><select value={account.todayLog.meals} onChange={(event) => updateLog({ meals: event.target.value })}><option value="Needs attention">{tr('Needs attention', '需要注意')}</option><option value="Balanced">{tr('Balanced', '均衡')}</option><option value="On track">{tr('On track', '状态良好')}</option></select></label>
                <label><span>{tr('Energy', '精力')}</span><select value={account.todayLog.energy} onChange={(event) => updateLog({ energy: Number(event.target.value) })}><option value="1">1 · {tr('Very low', '很低')}</option><option value="2">2 · {tr('Low', '较低')}</option><option value="3">3 · {tr('Steady', '稳定')}</option><option value="4">4 · {tr('Good', '良好')}</option><option value="5">5 · {tr('Excellent', '极佳')}</option></select></label>
                <label className="checkin-notes"><span>{tr('Anything your coach should know?', '有什么需要教练了解的吗？')}</span><input type="text" maxLength={500} placeholder={tr('Soreness, stress, appetite, recovery…', '酸痛、压力、食欲、恢复情况…')} value={account.todayLog.notes} onChange={(event) => updateLog({ notes: event.target.value })} /></label>
                <label className="health-consent"><input type="checkbox" checked={account.profile.consentHealthData} onChange={(event) => updateProfile({ consentHealthData: event.target.checked })} /><span>{tr('I consent to securely storing this wellness information so Relay can personalize my training. I can export or delete it at any time.', '我同意安全存储这些健康信息，以便 Relay 个性化训练。我可以随时导出或删除。')}</span></label>
                <button type="submit">{tr('Save check-in', '保存健康记录')} <span>→</span></button>
              </form>
            ) : (
              <div className="checkin-gate"><p>Your water, sleep, food quality and energy stay private and help keep future training realistic.</p><button type="button" onClick={signOut}>Open account screen <span>→</span></button></div>
            )}
          </section>

          <section className="camera-promise">
            <div className="camera-icon"><i /><span /></div>
            <div><p className="kicker">{tr('LIVE FORM COACH', '实时动作教练')}</p><h2>{tr('Your phone can watch the rep—not record your room.', '手机只看动作，不记录你的房间。')}</h2><p>{tr('Set it 2–3 metres away. Relay maps visible joint positions, counts completed reps, and gives one useful correction at a time.', '将手机放在 2–3 米外。Relay 会识别可见关节、计算次数，并一次给出一个实用纠正建议。')}</p></div>
            <button type="button" onClick={() => { setSessionOpen(true); setStage('camera'); }}>{tr('Try camera coach', '体验摄像指导')} <span>→</span></button>
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
            </div> : <div className="empty-history"><span>01</span><h2>Your first session starts here.</h2><p>Finish today&apos;s customized workout and it will appear here automatically.</p><button type="button" onClick={() => navigate('today')}>Choose today&apos;s workout <b>→</b></button></div>}
          </> : <AccountGate title="Your history, ready when you return." copy="Sign in to save completed workouts and securely sync progress across your devices." />}
        </section>
      )}

      {view === 'you' && (
        <section className="subpage you-page">
          <p className="kicker">YOUR COACH</p>
          <h1>Simple choices.<br />Clear training.</h1>
          {accountStatus === 'signed-in' && account ? <>
            <article className="profile-card"><span className="large-avatar">{account.user.displayName.charAt(0).toUpperCase()}</span><div><strong>{account.user.displayName}</strong><small>{account.user.email} · {account.profile.level}</small></div><button type="button" onClick={signOut}>{tr('Sign out', '退出登录')}</button></article>
            <article className="membership-card"><div><small>{tr('MEMBERSHIP', '会员状态')}</small><h2>{member.membership.plan === 'trial' ? tr('7-day free trial', '7 天免费试用') : member.membership.plan === 'monthly' ? tr('Monthly membership', '月付会员') : tr('Annual membership', '年付会员')}</h2><p>{trialRemaining !== null ? tr(`${trialRemaining} days remaining. No card is required during the trial.`, `剩余 ${trialRemaining} 天。试用期间无需绑卡。`) : member.membership.cancelAtPeriodEnd ? tr('Active until the current paid period ends.', '当前付费周期结束前仍可使用。') : tr('Secure subscription access is active.', '安全订阅权限已开启。')}</p></div><span>{member.membership.plan === 'trial' ? `${trialRemaining}/7` : '✓'}</span></article>

            {legacySnapshot && <article className="legacy-import-card"><div><small>{tr('DEVICE HISTORY FOUND', '发现设备历史记录')}</small><h2>{tr('Bring your previous Relay activity with you.', '导入之前的 Relay 训练记录。')}</h2><p>{tr('Only workouts, wellness, and schedule data will be imported. Demo passwords and billing status are never copied.', '仅导入训练、健康记录与日程。演示密码和账单状态绝不会被复制。')}</p></div><button type="button" onClick={importDeviceData}>{tr('Import securely', '安全导入')} <span>→</span></button></article>}

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
                    <span>{day}</span><strong>{item?.enabled ? `${getFocusOption(weeklyRotation[weekday]).shortLabel} Day 01` : 'Recovery day'}</strong>
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
            <article className="account-actions-card"><div><small>{tr('ACCOUNT & PRIVACY', '账户与隐私')}</small><h2>{tr('You control your data.', '你的数据由你掌控。')}</h2><p>{tr('Download a copy, manage billing, or permanently delete your account.', '下载数据副本、管理账单，或永久删除账户。')}</p></div><div><button type="button" onClick={() => downloadAccountExport(member, account)}>{tr('Export my data', '导出我的数据')}</button>{member.membership.plan !== 'trial' && <button type="button" onClick={manageBilling}>{tr('Manage billing', '管理账单')}</button>}<button className="danger" type="button" onClick={removeAccount}>{tr('Delete account', '删除账户')}</button></div></article>
            {saveStatus && <p className="account-save-status" role="status">{saveStatus}</p>}
          </> : <AccountGate title="One account. Your complete routine." copy="Sign in to securely save workouts, daily wellness, goals, and your weekly schedule." />}
        </section>
      )}

      <nav className="phone-nav" aria-label="Primary navigation">
        <button className={view === 'today' ? 'active' : ''} type="button" onClick={() => navigate('today')}><span>●</span>{tr('Today', '今天')}</button>
        <button className={view === 'history' ? 'active' : ''} type="button" onClick={() => navigate('history')}><span>◫</span>{tr('History', '记录')}</button>
        <button className={view === 'you' ? 'active' : ''} type="button" onClick={() => navigate('you')}><span>◌</span>{tr('You', '我的')}</button>
      </nav>
      <footer><span>RELAY / {tr('TRAIN WITH CLARITY', '清晰训练')}</span><span>{tr('PRIVATE BY DESIGN', '隐私优先设计')}</span></footer>

      {previewIndex !== null && activeWorkout[previewIndex] && (
        <ExercisePreview exercise={activeWorkout[previewIndex]} index={previewIndex} total={activeWorkout.length} language={language} onClose={() => setPreviewIndex(null)} onStartCamera={() => startSession(previewIndex)} />
      )}
    </main>
  );
}

function PhaseGuide({ exercise, compact = false, language = 'en' }: { exercise: Exercise; compact?: boolean; language?: Language }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [guideMode, setGuideMode] = useState<'video' | 'photos'>(exercise.video ? 'video' : 'photos');
  const phase = exercise.phases[phaseIndex] ?? exercise.phases[0];
  const showVideo = guideMode === 'video' && Boolean(exercise.video) && !videoFailed;
  const exerciseName = language === 'zh' ? exerciseChinese[exercise.id] ?? exercise.name : exercise.name;

  function handleVideoError() {
    setVideoFailed(true);
    setGuideMode('photos');
  }

  return (
    <div className={`phase-guide ${compact ? 'phase-guide-compact' : ''}`} data-guide-mode={showVideo ? 'video' : 'photos'}>
      {!compact && exercise.video && !videoFailed && (
        <div className="guide-mode-switch" role="tablist" aria-label={language === 'zh' ? `${exerciseName} 指导方式` : `${exerciseName} guide format`}>
          <button className={showVideo ? 'active' : ''} type="button" role="tab" aria-selected={showVideo} onClick={() => setGuideMode('video')}>
            <span aria-hidden="true">▶</span>{language === 'zh' ? '视频示范' : 'Video guide'}
          </button>
          <button className={!showVideo ? 'active' : ''} type="button" role="tab" aria-selected={!showVideo} onClick={() => setGuideMode('photos')}>
            <span aria-hidden="true">③</span>{language === 'zh' ? '三步图片' : '3-step photos'}
          </button>
        </div>
      )}

      {showVideo ? (
        <div className="phase-frame movement-video-frame">
          <video
            key={exercise.video}
            className="movement-video"
            autoPlay
            muted
            loop
            playsInline
            controls={!compact}
            preload={compact ? 'none' : 'metadata'}
            poster={exercise.image}
            aria-label={language === 'zh' ? `${exerciseName} 完整动作视频` : `${exerciseName} complete movement video`}
            onError={handleVideoError}
          >
            <source src={exercise.video} type="video/mp4" />
            {language === 'zh' ? '你的浏览器无法播放此视频。' : 'Your browser cannot play this video.'}
          </video>
          <span className="phase-step-badge video-badge">{language === 'zh' ? '真人动作视频' : 'VIDEO GUIDE'}</span>
        </div>
      ) : (
        <div className="phase-frame">
          <Image className="phase-backdrop" key={`${phase.image}-backdrop`} src={phase.image} alt="" aria-hidden="true" fill sizes={compact ? '(max-width: 760px) 100vw, 65vw' : '(max-width: 760px) 100vw, 55vw'} />
          <Image className="phase-subject" key={phase.image} src={phase.image} alt={`${exerciseName}: ${phase.label.toLowerCase()} position`} fill sizes={compact ? '(max-width: 760px) 100vw, 65vw' : '(max-width: 760px) 100vw, 55vw'} />
          <span className="phase-step-badge">{language === 'zh' ? `第 ${phaseIndex + 1} 步 / 共 3 步` : `STEP ${phaseIndex + 1} OF 3`}</span>
        </div>
      )}

      {!compact && showVideo && (
        <div className="video-coach-note">
          <p><span>{language === 'zh' ? '先观察一整次动作' : 'WATCH ONE COMPLETE REP'}</span>{language === 'zh' ? '留意全身路线和稳定节奏，再开始练习。' : 'Notice the full-body path and steady tempo before you begin.'}</p>
          <button type="button" onClick={() => setGuideMode('photos')}>{language === 'zh' ? '查看三个关键姿势' : 'See 3 key positions'}<b>→</b></button>
        </div>
      )}

      {!compact && !showVideo && <>
        <div className="phase-tabs" role="tablist" aria-label={`${exercise.name} movement steps`}>
          {exercise.phases.map((item, index) => (
            <button
              className={index === phaseIndex ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={index === phaseIndex}
              key={item.id}
              onClick={() => setPhaseIndex(index)}
            >
              <small>{index + 1}</small><strong>{language === 'zh' ? phaseChinese[item.id] : item.label}</strong>
            </button>
          ))}
        </div>
        <div className="phase-cue">
          <button type="button" disabled={phaseIndex === 0} onClick={() => setPhaseIndex((value) => Math.max(0, value - 1))} aria-label="Previous movement step">‹</button>
          <p><span>{language === 'zh' ? phaseChinese[phase.id] : phase.label}</span>{phase.cue}</p>
          <button type="button" disabled={phaseIndex === exercise.phases.length - 1} onClick={() => setPhaseIndex((value) => Math.min(exercise.phases.length - 1, value + 1))} aria-label="Next movement step">›</button>
        </div>
      </>}
    </div>
  );
}

function AccountGate({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="account-gate-card">
      <span className="gate-mark">R</span>
      <small>YOUR PRIVATE TRAINING ACCOUNT</small>
      <h2>{title}</h2>
      <p>{copy}</p>
      <button type="button" onClick={() => window.location.reload()}>Continue securely <span>→</span></button>
      <em>Camera video never uploads</em>
    </article>
  );
}

function TrialPaywall({ language, member, onLanguageChange, onSubscribe, onSignOut }: {
  language: Language;
  member: MemberAccount;
  onLanguageChange: (language: Language) => void;
  onSubscribe: (plan: 'monthly' | 'annual') => void;
  onSignOut: () => void;
}) {
  const tr = (english: string, chinese: string) => language === 'zh' ? chinese : english;
  return <main className="paywall-shell"><header><button className="wordmark" type="button"><span>R</span>RELAY</button><LanguageSwitch language={language} onChange={onLanguageChange} /></header><section><p className="kicker">{tr('YOUR TRIAL IS COMPLETE', '免费试用已结束')}</p><h1>{tr('Keep your momentum.', '继续保持训练节奏。')}</h1><p>{tr(`Thanks for training with Relay, ${member.displayName}. Your history remains safe. Choose secure access to continue personalized workouts.`, `感谢你使用 Relay 训练，${member.displayName}。你的记录仍被安全保存。选择安全方案即可继续个性化训练。`)}</p><div className="paywall-options">{member.market === 'global' && <article><span>{tr('MONTHLY', '月付')}</span><h2>{tr('Monthly access', '月付会员')}</h2><p>{tr('Flexible recurring access. Cancel from the secure billing portal.', '灵活按月续费，可在安全账单页面取消。')}</p><button type="button" onClick={() => onSubscribe('monthly')}>{tr('Choose monthly', '选择月付')}<b>→</b></button></article>}<article className="featured"><small>BEST VALUE</small><span>{tr('ANNUAL', '年付')}</span><h2>{member.market === 'cn' ? tr('One secure annual payment', '一次安全年付') : tr('Annual membership', '年付会员')}</h2><p>{member.market === 'cn' ? tr('365 days of access with Alipay or an eligible card. It does not auto-renew.', '可使用支付宝或支持的银行卡购买 365 天权限，不会自动续费。') : tr('One year of consistent coaching at the best value.', '以更优惠的方式获得一整年的持续指导。')}</p><button type="button" onClick={() => onSubscribe('annual')}>{tr('Choose annual', '选择年付')}<b>→</b></button></article></div><button className="paywall-signout" type="button" onClick={onSignOut}>{tr('Sign out and use another account', '退出并使用其他账户')}</button></section></main>;
}

function ExercisePreview({ exercise: item, index, total, language, onClose, onStartCamera }: { exercise: Exercise; index: number; total: number; language: Language; onClose: () => void; onStartCamera: () => void }) {
  return (
    <div className="preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="exercise-preview" role="dialog" aria-modal="true" aria-label={`${item.name} movement guide`}>
        <button className="preview-close" type="button" onClick={onClose} aria-label="Close movement guide">×</button>
        <div className="preview-visual">
          <PhaseGuide key={item.id} exercise={item} language={language} />
          <span>{item.video ? (language === 'zh' ? '视频 + 三步' : 'VIDEO + 3 STEPS') : (language === 'zh' ? '三步指导' : '3-STEP COACH')}</span><span>{language === 'zh' ? '先看，再练' : 'LOOK FIRST'}</span>
        </div>
        <div className="preview-body">
          <p className="kicker">MOVEMENT {index + 1} OF {total}</p>
          <h2>{language === 'zh' ? exerciseChinese[item.id] ?? item.name : item.name}</h2>
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
