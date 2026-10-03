import lines from './coach-voice-lines.json';
import { exerciseCatalog } from './workout-data';
import { coachExerciseCue } from './workout-coach-copy';

export type CoachLanguage = 'en' | 'zh';
export const coachVoices = { en: 'Annie', zh: 'Lea' } as const;
export const voiceVersion = '20260912-af';
const lookup = { en: new Map<string,string>(), zh: new Map<string,string>() };
for (const language of ['en','zh'] as const) {
  for (const line of lines) lookup[language].set(line[language],line.id);
  for (const exercise of Object.values(exerciseCatalog)) lookup[language].set(coachExerciseCue(exercise,language),`exercise-${exercise.id}`);
}
const aliases: Array<[string,string,string]> = [
  ['ready','Ready when you are. Press Start set and I’ll count with you.','准备好后点击“开始本组”，我会陪你一起计时。'],
  ['reset','Reset','调整'],
  ['switch','Switch sides. Take five seconds to reset.','换到另一侧，用五秒调整姿势。'],
  ['paused','We’re paused. Take your time, then press Resume when you’re ready.','已暂停。按自己的节奏休息，准备好后点击继续。'],
  ['paused','Paused. Take a breath. We’ll continue when you’re ready.','已暂停，放松呼吸，准备好后再继续。'],
  ['paused','Let’s pause. Press Resume when you feel ready.','我们先暂停，准备好后再继续。'],
  ['slower','Of course. Let’s slow the pace and keep each movement controlled.','没问题，我们放慢节奏，把每次动作做稳。'],
  ['count-5','Five seconds. Get ready to continue.','还有五秒，准备继续。'],
  ['count-3','Three','三'],
];
for (const [id,en,zh] of aliases) { lookup.en.set(en,id);lookup.zh.set(zh,id); }

export function voiceRequest(text:string,language:CoachLanguage): {ids:string[];count:boolean}|null {
  const number = text.match(/^(?:Rep |第\s*)?(\d+)(?:\s*次| seconds| 秒)?(?:[.,，].*)?$/)?.[1];
  if(number) {
    const n=Number(number);
    if(n<1 || n>49)return null;
    const ids=n<=20 || n%10===0?[`count-${n}`]:[`count-${Math.floor(n/10)*10}`,`count-${n%10}`];
    return {ids,count:true};
  }
  if(text.startsWith('Well done. Your session is finished.') || text.startsWith('训练结束，做得不错。'))return {ids:['summary'],count:false};
  const id=lookup[language].get(text);
  return id?{ids:[id],count:id.startsWith('count-') || id==='reset'}:null;
}
export function voiceAsset(id:string,language:CoachLanguage) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/audio/coach/${voiceVersion}/${language}/${id}.mp3`;
}
export function preloadVoiceIds(exerciseText:string,language:CoachLanguage) {
  return [...new Set(['count-3','count-2','count-1',...lines.map(line=>line.id),...(voiceRequest(exerciseText,language)?.ids??[])])];
}
