import { getChatGPTUser } from '../../chatgpt-auth';
import type { DailyLog, Profile, ScheduleItem } from '../../account-types';
import { getAccountSnapshot, saveDailyLog, saveProfile, saveSchedule, saveWorkout } from '../../../db';

export const dynamic = 'force-dynamic';

function clamp(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

function localDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ signedIn: false }, { status: 401 });
  const date = localDate(new URL(request.url).searchParams.get('date'));
  return Response.json(await getAccountSnapshot(user, date));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in to save your data.' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? '');
  const date = localDate(body.logDate);

  if (action === 'save-workout') {
    await saveWorkout(user.userId, {
      durationSeconds: Math.round(clamp(body.durationSeconds, 1, 14400)),
      setsCompleted: Math.round(clamp(body.setsCompleted, 1, 100)),
      movementsCompleted: Math.round(clamp(body.movementsCompleted, 1, 50)),
      cameraSets: Math.round(clamp(body.cameraSets, 0, 100)),
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : '',
    });
  } else if (action === 'save-checkin') {
    const input = body.data as Partial<DailyLog> | undefined;
    await saveDailyLog(user.userId, {
      logDate: date,
      waterMl: Math.round(clamp(input?.waterMl, 0, 10000)),
      meals: ['Needs attention', 'Balanced', 'On track'].includes(String(input?.meals)) ? String(input?.meals) : 'Balanced',
      sleepHours: clamp(input?.sleepHours, 0, 16),
      energy: Math.round(clamp(input?.energy, 1, 5)),
      weightKg: input?.weightKg === null || input?.weightKg === undefined || input?.weightKg === 0 ? null : clamp(input.weightKg, 25, 400),
      notes: typeof input?.notes === 'string' ? input.notes.slice(0, 500) : '',
    });
  } else if (action === 'save-profile') {
    const input = body.data as Partial<Profile> | undefined;
    await saveProfile(user.userId, {
      goal: typeof input?.goal === 'string' ? input.goal.slice(0, 80) : 'Build strength',
      level: ['Beginner', 'Intermediate', 'Advanced'].includes(String(input?.level)) ? String(input?.level) : 'Beginner',
      daysPerWeek: Math.round(clamp(input?.daysPerWeek, 1, 7)),
      sessionMinutes: Math.round(clamp(input?.sessionMinutes, 10, 120)),
      hydrationTargetMl: Math.round(clamp(input?.hydrationTargetMl, 500, 6000)),
      sleepTargetHours: clamp(input?.sleepTargetHours, 4, 12),
      injuries: typeof input?.injuries === 'string' ? input.injuries.slice(0, 300) : '',
      reminderTime: typeof input?.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(input.reminderTime) ? input.reminderTime : '18:00',
    });
  } else if (action === 'save-schedule') {
    const source = Array.isArray(body.data) ? body.data : [];
    const seen = new Set<number>();
    const items: ScheduleItem[] = source.flatMap((raw) => {
      const item = raw as Partial<ScheduleItem>;
      const weekday = Math.round(clamp(item.weekday, 0, 6));
      if (seen.has(weekday)) return [];
      seen.add(weekday);
      return [{
        id: '', weekday, workoutName: 'Foundation 01',
        startTime: typeof item.startTime === 'string' && /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '18:00',
        durationMinutes: Math.round(clamp(item.durationMinutes, 10, 120)), enabled: Boolean(item.enabled),
      }];
    });
    await saveSchedule(user.userId, items);
  } else {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }

  return Response.json(await getAccountSnapshot(user, date));
}
