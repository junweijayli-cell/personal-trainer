import {describe,expect,it} from 'vitest';
import {coachCommand,exerciseTiming,initialClock,trainingStep,workoutResult, type TrainingClock} from '../app/workout-clock';
import {exerciseCatalog,type Exercise} from '../app/workout-data';
const workout=[{...exerciseCatalog.squat,sets:1,target:2,rest:4},{...exerciseCatalog['forearm-plank'],sets:1,target:4,rest:2}];
const tick=(state:TrainingClock,ms:number,plan:Exercise[]=workout)=>{
  for(let delta=ms;delta>0;delta-=Math.min(delta,100))state=trainingStep(state,{type:'tick',milliseconds:Math.min(delta,100)},plan);
  return state;
};
describe('guided session clock',()=>{
  it('waits for Start, times each rep and recovery, announces rest boundary without auto-starting another set',()=>{
    let state=initialClock(workout);expect(tick(state,1000)).toEqual(state);
    state=trainingStep(state,{type:'start'},workout);
    expect(trainingStep(state,{type:'start'},workout)).toEqual(state);
    state=tick(state,3000);expect(state.phase).toBe('rep');expect(state.remaining).toBe(4000);
    state=tick(state,4000);expect(state.phase).toBe('repRest');expect(state.rep).toBe(1);
    state=tick(state,1000);expect(state.phase).toBe('rep');
    state=tick(state,4000);expect(state.phase).toBe('rest');expect(state.done).toEqual([1,0]);
    state=tick(state,4000);expect(state.phase).toBe('ready');expect(state.move).toBe(1);
    state=tick(state,6000);expect(state.done).toEqual([1,0]);expect(state.elapsed).toBe(22000);
    state=trainingStep(state,{type:'start'},workout);state=tick(state,7000);
    expect(state.phase).toBe('summary');expect(workoutResult(state)).toEqual({durationSeconds:29,setsCompleted:2,movementsCompleted:2,cameraSets:0});
    expect(tick(state,10000)).toEqual(state);
  });
  it('pauses both clocks, resumes without drift, and refuses background catch-up',()=>{
    let state=tick(trainingStep(initialClock(workout),{type:'start'},workout),4500);
    state=trainingStep(state,{type:'pause'},workout);expect(tick(state,5000)).toEqual(state);
    state=trainingStep(state,{type:'resume'},workout);expect(tick(state,500).remaining).toBe(state.remaining-500);
    expect(trainingStep(state,{type:'tick',milliseconds:60000},workout)).toEqual({...state,paused:true});
  });
  it('counts both sides and fixed holds instead of confusing seconds with reps',()=>{
    for(const id of ['forearm-plank','upper-trap-stretch','stationary-bike'])expect(exerciseTiming(exerciseCatalog[id],4).hold).toBe(true);
    expect(exerciseTiming(exerciseCatalog['chin-tuck'],4)).toMatchObject({hold:false,reps:8,seconds:4});
    expect(exerciseTiming(exerciseCatalog['side-neck-isometric'],4)).toEqual({hold:false,reps:5,seconds:5,sides:2});
    const plan=[{...exerciseCatalog['upper-trap-stretch'],sets:1,target:2}];
    let state=tick(trainingStep(initialClock(plan),{type:'start'},plan),5000,plan);
    expect(state.phase).toBe('switchSide');expect(state.done).toEqual([0]);
    state=tick(state,7000,plan);expect(state.phase).toBe('summary');expect(state.done).toEqual([1]);
  });
  it('lets the user slow down, extend or skip rest, and choose zero rep breaks',()=>{
    let state=tick(trainingStep(initialClock(workout),{type:'start'},workout),4000);
    state=trainingStep(state,{type:'slower'},workout);expect(state.pace).toBe(5);expect(state.remaining).toBe(4000);
    state=trainingStep(state,{type:'completeSet'},workout);
    state=trainingStep(state,{type:'moreRest'},workout);expect(state.remaining).toBe(19000);
    state=trainingStep(state,{type:'skipRest'},workout);expect(state.phase).toBe('ready');
    let noBreak=trainingStep(initialClock(workout),{type:'repBreak',seconds:0},workout);
    noBreak=tick(trainingStep(noBreak,{type:'start'},workout),7000);expect(noBreak.phase).toBe('rep');expect(noBreak.rep).toBe(1);
  });
  it('does not over-credit skipped movements, duplicate clicks, or partial sessions',()=>{
    let state=trainingStep(initialClock(workout),{type:'selectMove',index:1},workout);
    state=trainingStep(state,{type:'completeSet',camera:true},workout);
    expect(state.phase).toBe('rest');expect(state.nextMove).toBe(0);
    expect(trainingStep(state,{type:'completeSet',camera:true},workout)).toEqual(state);
    state=trainingStep(state,{type:'finish'},workout);
    expect(workoutResult(state)).toMatchObject({setsCompleted:1,movementsCompleted:1,cameraSets:1});
  });
  it.each([['pause','pause'],['I need more rest','moreRest'],['slower please','slower'],['准备好了','resume'],['慢一点','slower'],['多休息一下','moreRest'],['重复提示','repeat'],['关闭音乐','musicOff'],['stop music','musicOff']])('understands coach command %s',(text,command)=>expect(coachCommand(text)).toBe(command));
  it('does not invent commands from unrelated conversation',()=>expect(coachCommand('what is the weather today')).toBeNull());
});
