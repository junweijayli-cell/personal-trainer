import type { Exercise } from './workout-data';

export type TrainingPhase = 'ready' | 'countdown' | 'rep' | 'repRest' | 'switchSide' | 'rest' | 'camera' | 'summary';
export type WorkoutResult = { durationSeconds: number; setsCompleted: number; movementsCompleted: number; cameraSets: number; sessionId?: string };
export type TrainingClock = {
  phase: TrainingPhase; move: number; nextMove: number; side: number; rep: number; done: number[];
  remaining: number; duration: number; elapsed: number; started: boolean; paused: boolean;
  pace: number; repBreak: number; cameraSets: number;
};
export type ClockAction = { type: 'tick'; milliseconds: number } | { type: 'start' | 'pause' | 'resume' | 'moreRest' | 'slower' | 'skipRest' | 'camera' | 'guide' | 'finish' }
  | { type: 'completeSet'; camera?: boolean } | { type: 'pace' | 'repBreak'; seconds: number } | { type: 'selectMove'; index: number };

export function exerciseTiming(exercise: Exercise, pace: number) {
  const hold = ['forearm-plank', 'upper-trap-stretch', 'stationary-bike'].includes(exercise.id);
  return { hold, sides: exercise.targetLabel.includes('/ side') ? 2 : 1,
    reps: hold ? 1 : exercise.target, seconds: hold ? exercise.target : exercise.id === 'side-neck-isometric' ? Math.max(5, pace) : pace };
}
export function initialClock(workout: Exercise[], startAt = 0): TrainingClock {
  const move = Math.max(0, Math.min(workout.length - 1, startAt));
  return { phase:'ready', move, nextMove:move, side:0, rep:0, done:workout.map(()=>0), remaining:0, duration:0,
    elapsed:0, started:false, paused:false, pace:4, repBreak:1, cameraSets:0 };
}
function phase(state: TrainingClock, next: TrainingPhase, seconds = 0): TrainingClock {
  return { ...state, phase:next, remaining:seconds*1000, duration:seconds*1000 };
}
function completed(state: TrainingClock, workout: Exercise[], camera = false): TrainingClock {
  if (state.done[state.move] >= workout[state.move].sets) return state;
  const done=state.done.map((count,index)=>index===state.move?count+1:count);
  const next={...state, done, rep:0, side:0, cameraSets:state.cameraSets+(camera?1:0), started:true, paused:false};
  if(done.every((count,index)=>count>=workout[index].sets)) return phase(next,'summary');
  const nextMove=done[state.move]<workout[state.move].sets ? state.move
    : Array.from({length:workout.length},(_,offset)=>(state.move+offset+1)%workout.length).find(index=>done[index]<workout[index].sets)!;
  return phase({...next,nextMove},'rest',workout[state.move].rest);
}
function advance(state: TrainingClock, workout: Exercise[]): TrainingClock {
  const timing=exerciseTiming(workout[state.move],state.pace);
  if(state.phase==='countdown' || state.phase==='repRest' || state.phase==='switchSide') return phase(state,'rep',timing.seconds);
  if(state.phase==='rest') return phase({...state,move:state.nextMove},'ready');
  if(state.phase!=='rep') return state;
  const next={...state,rep:state.rep+1};
  if(next.rep<timing.reps) return phase(next,state.repBreak ? 'repRest' : 'rep',state.repBreak || timing.seconds);
  if(state.side+1<timing.sides) return phase({...next,rep:0,side:state.side+1},'switchSide',5);
  return completed(next,workout);
}
export function trainingStep(state: TrainingClock, action: ClockAction, workout: Exercise[]): TrainingClock {
  if(state.phase==='summary') return state;
  switch(action.type) {
    case 'start': return state.phase==='ready' && state.done[state.move]<workout[state.move].sets
      ? phase({...state,started:true,paused:false,rep:0,side:0},'countdown',3) : state;
    case 'pause': return {...state,paused:true};
    case 'resume': return {...state,paused:false};
    case 'moreRest': return state.phase==='rest' || state.phase==='repRest' || state.phase==='switchSide'
      ? {...state,remaining:Math.min(300000,state.remaining+15000),duration:Math.min(300000,state.duration+15000)} : {...state,paused:true};
    case 'slower': {
      const pace=Math.min(8,state.pace+1);
      const delta=(exerciseTiming(workout[state.move],pace).seconds-exerciseTiming(workout[state.move],state.pace).seconds)*1000;
      return {...state,pace,remaining:state.phase==='rep'?state.remaining+delta:state.remaining,duration:state.phase==='rep'?state.duration+delta:state.duration};
    }
    case 'pace': return {...state,pace:Math.max(2,Math.min(8,action.seconds))};
    case 'repBreak': return {...state,repBreak:Math.max(0,Math.min(5,action.seconds))};
    case 'skipRest': return state.phase==='rest' ? phase({...state,move:state.nextMove},'ready') : state;
    case 'camera': return state.phase==='ready' || state.phase==='camera'? phase({...state,started:true,paused:false},'camera'):state;
    case 'guide': return phase({...state,rep:0,side:0},'ready');
    case 'completeSet': return ['ready','camera','rep','repRest','countdown','switchSide'].includes(state.phase)? completed(state,workout,action.camera):state;
    case 'finish': return phase(state,'summary');
    case 'selectMove': return state.phase==='ready' && action.index>=0 && action.index<workout.length && state.done[action.index]<workout[action.index].sets
      ? {...state,move:action.index,rep:0,side:0}:state;
    case 'tick': {
      if(!state.started || state.paused || !Number.isFinite(action.milliseconds) || action.milliseconds<=0) return state;
      // A suspended tab must never silently finish reps or fabricate a workout.
      if(action.milliseconds>2500) return {...state,paused:true};
      let next={...state,elapsed:state.elapsed+action.milliseconds}, delta=action.milliseconds;
      while(delta>0 && !['ready','camera','summary'].includes(next.phase)) {
        if(delta<next.remaining) { next={...next,remaining:next.remaining-delta}; break; }
        delta-=next.remaining; next=advance(next,workout);
      }
      // Stop the saved duration at the actual final boundary.
      if(next.phase==='summary') next={...next,elapsed:next.elapsed-delta};
      return next;
    }
  }
}
export function workoutResult(state: TrainingClock): WorkoutResult {
  return {durationSeconds:Math.max(1,Math.floor(state.elapsed/1000)),setsCompleted:state.done.reduce((a,b)=>a+b,0),
    movementsCompleted:state.done.filter(count=>count>0).length,cameraSets:state.cameraSets};
}
export function clockLabel(milliseconds: number) {
  const seconds=Math.floor(milliseconds/1000);
  return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}

export type CoachCommand = 'pause' | 'resume' | 'slower' | 'moreRest' | 'repeat' | 'musicOff';
export function coachCommand(text: string): CoachCommand | null {
  const value=text.trim().toLowerCase();
  if(/(music.*(off|stop)|(?:stop|turn off).*music|关.*音乐|停止音乐)/.test(value)) return 'musicOff';
  if(/(more rest|more time|need.*break|休息|歇一会)/.test(value)) return 'moreRest';
  if(/(pause|stop|暂停|停一下|停下)/.test(value)) return 'pause';
  if(/(slower|slow down|慢一点|慢点|慢下来)/.test(value)) return 'slower';
  if(/(repeat|again|重复|再说|提示)/.test(value)) return 'repeat';
  if(/(ready|resume|continue|let.s go|start|开始|继续|准备好了)/.test(value)) return 'resume';
  return null;
}
