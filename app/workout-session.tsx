'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import CameraCoach from './camera-coach';
import { LanguageSwitch } from './landing-auth';
import type { Exercise } from './workout-data';
import { clockLabel, coachCommand, exerciseTiming, initialClock, trainingStep, workoutResult, type CoachCommand, type WorkoutResult } from './workout-clock';
import { recognitionConstructor, WorkoutAudio, type Recognition } from './workout-audio';
import { coachExerciseCue } from './workout-coach-copy';

type Props = { workout:Exercise[]; startAt:number; cameraFirst:boolean; language:'en'|'zh'; onLanguageChange:(language:'en'|'zh')=>void;
  voiceEnabled:boolean; onVoiceChange:(value:boolean)=>void; exerciseName:(exercise:Exercise)=>string;
  renderGuide:(exercise:Exercise)=>ReactNode; renderPreview:(exercise:Exercise,close:()=>void,camera:()=>void)=>ReactNode;
  onSave:(result:WorkoutResult)=>Promise<void>; onExit:()=>void; };

export default function WorkoutSession({workout,startAt,cameraFirst,language,onLanguageChange,voiceEnabled,onVoiceChange,exerciseName,renderGuide,renderPreview,onSave,onExit}:Props) {
  const [state,dispatch]=useReducer((current:ReturnType<typeof initialClock>,action:Parameters<typeof trainingStep>[1])=>trainingStep(current,action,workout),
    null,()=>({...initialClock(workout,startAt),phase:cameraFirst?'camera' as const:'ready' as const}));
  const [reply,setReply]=useState('');
  const [music,setMusic]=useState(false);
  const [volume,setVolume]=useState(.25);
  const [musicStyle,setMusicStyle]=useState<'focus'|'energy'>('energy');
  const [voiceIssue,setVoiceIssue]=useState(false);
  const [musicIssue,setMusicIssue]=useState(false);
  const [listening,setListening]=useState(false);
  const [micIssue,setMicIssue]=useState('');
  const [preview,setPreview]=useState(false);
  const [exitOpen,setExitOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [sessionId]=useState(()=>crypto.randomUUID());
  const audio=useRef<WorkoutAudio|null>(null);
  const recognition=useRef<Recognition|null>(null);
  const listeningTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const commandRef=useRef<(command:CoachCommand)=>void>(()=>{});
  const exercise=workout[state.move];
  const timing=exerciseTiming(exercise,state.pace);
  const seconds=Math.ceil(state.remaining/1000);
  const result=workoutResult(state);
  const totalSets=workout.reduce((sum,item)=>sum+item.sets,0);
  const tr=useCallback((en:string,zh:string)=>language==='zh'?zh:en,[language]);
  const stopListening=useCallback(()=>{
    if(listeningTimeout.current)clearTimeout(listeningTimeout.current);
    const current=recognition.current;recognition.current=null;current?.abort();
    setListening(false);audio.current?.duck(false);
  },[]);
  const say=useCallback((text:string)=>{setReply(text);audio.current?.say(text,language,voiceEnabled);},[language,voiceEnabled]);
  const unlock=()=>{audio.current?.unlock();setMusicIssue(false);};

  useEffect(()=>{
    audio.current=new WorkoutAudio(kind=>kind==='voice'?setVoiceIssue(true):setMusicIssue(true));
    const engine=audio.current;
    return ()=>{engine.dispose();recognition.current?.abort();if(listeningTimeout.current)clearTimeout(listeningTimeout.current);};
  },[]);
  useEffect(()=>{
    let last=performance.now();
    const timer=window.setInterval(()=>{const now=performance.now();dispatch({type:'tick',milliseconds:now-last});last=now;},100);
    const hide=(event:Event)=>{if(document.hidden || event.type==='pagehide'){dispatch({type:'pause'});audio.current?.silence();audio.current?.setPaused(true);stopListening();}};
    document.addEventListener('visibilitychange',hide);
    window.addEventListener('pagehide',hide);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',hide);};
  },[stopListening]);
  useEffect(()=>{
    audio.current?.setMusic(music,volume,musicStyle);
    audio.current?.setPaused(state.paused || state.phase==='summary' || listening);
  },[music,volume,musicStyle,state.paused,state.started,state.phase,listening]);
  useEffect(()=>{if(!voiceEnabled)audio.current?.silence();},[voiceEnabled]);
  useEffect(()=>{
    if(state.phase!=='summary')return;
    const mic=recognition.current;recognition.current=null;mic?.abort();
    if(listeningTimeout.current)clearTimeout(listeningTimeout.current);
  },[state.phase]);

  let cue=tr('Ready when you are. Press Start set and I’ll count with you.', '准备好后点击“开始本组”，我会陪你一起计时。');
  let cueKey=`${state.phase}:${state.move}:${state.done[state.move]}:${state.side}:${state.rep}:${language}`;
  if(state.phase==='countdown') {cue=tr(seconds===3?'Three':String(seconds),seconds===3?'三':String(seconds));cueKey+=`:${seconds}`;}
  if(state.phase==='rep') cue=timing.hold?exercise.id==='stationary-bike'?tr('Keep a steady rhythm. Relax your shoulders.', '保持稳定节奏，放松肩膀。'):tr('Hold steady. Keep breathing.', '保持动作，均匀呼吸。')
    :tr(`Rep ${state.rep+1}${state.rep===Math.floor(timing.reps/2)?'. Halfway. Keep it steady.':''}`,`第 ${state.rep+1} 次${state.rep===Math.floor(timing.reps/2)?'，已经过半，保持稳定。':''}`);
  if(state.phase==='rep' && timing.hold && seconds<=3) {cue=String(seconds);cueKey+=`:${seconds}`;}
  if(state.phase==='repRest') cue=tr('Reset', '调整');
  if(state.phase==='switchSide') cue=tr('Switch sides. Take five seconds to reset.', '换到另一侧，用五秒调整姿势。');
  if(state.phase==='rest') cue=tr('Nice set. Take a breath. I’ll let you know when it’s time.', '这一组完成得不错。放松呼吸，到时间我会提醒你。');
  if(state.phase==='rest' && seconds<=5) {cue=seconds===5?tr('Five seconds. Get ready to continue.', '还有五秒，准备继续。'):String(seconds);cueKey+=`:${seconds}`;}
  if(state.phase==='ready' && state.started)cue=tr('Rest finished. Ready for your next set? I’m here with you.', '休息结束，该继续训练了。准备好下一组了吗？我陪着你。');
  if(state.phase==='camera')cue=tr('Your camera coach will count your movement. You can pause any time.', '摄像教练会根据动作计数，你可以随时暂停。');
  if(state.phase==='summary')cue=tr(`Well done. Your session is finished. You completed ${result.setsCompleted} sets.`, `训练结束，做得不错。你完成了 ${result.setsCompleted} 组。`);
  if(state.paused && state.phase!=='summary'){cue=tr('We’re paused. Take your time, then press Resume when you’re ready.', '已暂停。按自己的节奏休息，准备好后点击继续。');cueKey='paused';}
  useEffect(()=>{
    const timer=setTimeout(()=>{if(!document.hidden){if(state.started && !recognition.current)say(cue);else setReply(cue);}},0);
    return ()=>clearTimeout(timer);
  },[cueKey,cue,say,state.started]);

  function command(action:CoachCommand) {
    unlock();
    if(action==='pause') {dispatch({type:'pause'});say(tr('Paused. Take a breath. We’ll continue when you’re ready.', '已暂停，放松呼吸，准备好后再继续。'));}
    if(action==='resume') {dispatch({type:state.phase==='ready'?'start':'resume'});}
    if(action==='slower') {dispatch({type:'slower'});say(tr('Of course. Let’s slow the pace and keep each movement controlled.', '没问题，我们放慢节奏，把每次动作做稳。'));}
    if(action==='moreRest') {dispatch({type:'moreRest'});say(['rest','repRest','switchSide'].includes(state.phase)?tr('You’ve got fifteen more seconds. Recover at your pace.', '多休息十五秒，按自己的节奏恢复。'):tr('Let’s pause. Press Resume when you feel ready.', '我们先暂停，准备好后再继续。'));}
    if(action==='repeat')say(coachExerciseCue(exercise,language));
    if(action==='musicOff'){setMusic(false);say(tr('Music off. I’m still here to guide you.', '音乐已关闭，我会继续指导你。'));}
  }
  useEffect(()=>{commandRef.current=command;});
  function listen() {
    if(listening){stopListening();return;}
    const Constructor=recognitionConstructor();
    if(!Constructor){setMicIssue(tr('Voice commands aren’t available in this browser. Use the coach buttons below.', '此浏览器不支持语音指令，请使用下方教练按钮。'));return;}
    unlock();audio.current?.silence();audio.current?.duck(true);setMicIssue('');
    const mic=new Constructor();recognition.current=mic;mic.lang=language==='zh'?'zh-CN':'en-US';mic.continuous=false;mic.interimResults=false;
    mic.onresult=event=>{
      if(recognition.current!==mic)return;
      const action=coachCommand(event.results[0]?.[0]?.transcript??'');stopListening();
      if(action)commandRef.current(action);else setMicIssue(tr('Try “pause”, “continue”, “slower”, “more rest” or “repeat”.', '请说“暂停”“继续”“慢一点”“多休息”或“重复提示”。'));
    };
    mic.onerror=()=>{if(recognition.current===mic){stopListening();setMicIssue(tr('Voice input couldn’t start. Check microphone permission or use the buttons.', '语音输入未能启动。请检查麦克风权限，或使用按钮。'));}};
    mic.onend=()=>{if(recognition.current===mic)stopListening();};
    try{mic.start();setListening(true);listeningTimeout.current=setTimeout(stopListening,10000);}
    catch{stopListening();setMicIssue(tr('Voice input is unavailable. The coach buttons still work.', '语音输入暂不可用，你仍可使用教练按钮。'));}
  }
  function leave() {stopListening();audio.current?.dispose();onExit();}
  async function save() {
    if(saving || !result.setsCompleted)return;
    setSaving(true);setSaveError('');
    try{await onSave({...result,sessionId});}catch{setSaveError(tr('Your workout could not be saved. Please retry.', '训练未能保存，请重试。'));}finally{setSaving(false);}
  }
  const start=()=>{unlock();setVoiceIssue(false);audio.current?.say(tr('Three','三'),language,voiceEnabled);dispatch({type:'start'});};
  const finished=state.phase==='summary';
  const resting=state.phase==='rest';
  const phaseLabel=state.paused?tr('PAUSED','已暂停'):({ready:tr('READY FOR YOUR SET','准备开始本组'),countdown:tr('GET READY','准备'),rep:timing.hold?exercise.id==='stationary-bike'?tr('WORK INTERVAL','计时骑行'):tr('HOLD','保持'):tr('REP TIME','本次动作时间'),repRest:tr('BETWEEN REPS','动作间休息'),switchSide:tr('SWITCH SIDES','换侧'),rest:tr('REST BETWEEN SETS','组间休息'),camera:tr('CAMERA COACH','摄像指导'),summary:tr('SESSION FINISHED','训练结束')})[state.phase];

  const coachPanel = <section className="trainer-coach" aria-label={tr('Coach conversation','教练对话')}><span>{tr('COACH','教练')}</span><p role="status">{reply||cue}</p><div className="trainer-replies">
          <button type="button" onClick={()=>command(state.paused||state.phase==='ready'?'resume':'pause')}>{state.paused?tr('Resume','继续'):state.phase==='ready'?tr('I’m ready','我准备好了'):tr('Pause','暂停')}</button>
          <button type="button" onClick={()=>command('slower')}>{tr('Slower, please','请慢一点')}</button><button type="button" onClick={()=>command('moreRest')}>{tr('I need more rest','我想多休息一下')}</button><button type="button" onClick={()=>command('repeat')}>{tr('Repeat the cue','重复动作提示')}</button>
          <button type="button" aria-pressed={listening} onClick={listen}>{listening?tr('Stop listening','停止聆听'):tr('Talk to coach','对教练说话')}</button></div>
          <small>{listening?tr('Listening for one command…','正在听取一条指令…'):tr('Optional voice commands use your browser’s speech service and may send audio to that provider. TrainWell saves no recording or transcript.', '可选语音指令使用浏览器语音服务，可能向该服务商发送音频。悦练不保存录音或转写内容。')}</small>{micIssue&&<p role="alert">{micIssue}</p>}
        </section>;

  return <main className="guided-session trainer-session">
    <header className="session-top">
      <button type="button" onClick={()=>{dispatch({type:'pause'});stopListening();setExitOpen(true);}} aria-label={tr('Exit workout','退出训练')}>×</button>
      <div><span>{tr('YOUR TRAINING PARTNER','你的训练伙伴')}</span><strong>{result.setsCompleted} / {totalSets} {tr('sets','组')}</strong></div>
      <div className="trainer-session-time"><small>{tr('SESSION TIME','训练总时间')}</small><strong data-testid="session-time">{clockLabel(state.elapsed)}</strong></div>
    </header>
    <div className="trainer-toolbar"><LanguageSwitch language={language} onChange={onLanguageChange}/><button type="button" onClick={()=>{unlock();onVoiceChange(!voiceEnabled);}} aria-pressed={voiceEnabled}>{tr('Voice','语音')} {voiceEnabled?tr('on','开'):tr('off','关')}</button>
      <button type="button" onClick={()=>{unlock();setMusic(!music);}} aria-pressed={music}>{tr('Gym music','健身音乐')} {music?tr('on','开'):tr('off','关')}</button></div>
    {music && <div className="trainer-music"><label>{tr('Music volume','音乐音量')}<input type="range" min="0" max="60" value={Math.round(volume*100)} onChange={event=>setVolume(Number(event.target.value)/100)}/></label><label>{tr('Music style','音乐风格')}<select value={musicStyle} onChange={event=>setMusicStyle(event.target.value as 'focus'|'energy')}><option value="energy">{tr('Energy beat','活力节拍')}</option><option value="focus">{tr('Steady focus','专注节奏')}</option></select></label><small>{tr('Instrumental music softens while your coach speaks','教练说话时，背景音乐会自动调低')}</small></div>}
    {voiceIssue && <p className="trainer-issue">{tr('Voice playback is unavailable. Check device sound; all cues remain on screen.', '语音播放暂不可用，请检查设备声音；所有提示仍会显示在屏幕上。')} <button type="button" onClick={()=>{setVoiceIssue(false);audio.current?.say(tr('Ready. Let’s train together.','准备好，我们一起训练。'),language,true);}}>{tr('Test voice','测试语音')}</button></p>}
    {musicIssue && <p className="trainer-issue">{tr('Music could not start. Tap the music button to retry.', '音乐未能开始，请点击音乐按钮重试。')}</p>}
    <div className="session-progress"><i style={{width:`${result.setsCompleted/totalSets*100}%`}}/></div>

    {finished ? <section className="trainer-finish"><span className="trainer-finish-mark">✓</span><p className="kicker">{tr('SESSION FINISHED','训练结束')}</p><h1>{tr('You showed up','你完成了今天的行动')}<br/>{tr('That’s progress','每一步都是进步')}</h1><div className="trainer-stats"><span><strong>{clockLabel(state.elapsed)}</strong>{tr('Training time','训练时间')}</span><span><strong>{result.setsCompleted}</strong>{tr('Sets completed','完成组数')}</span><span><strong>{result.movementsCompleted}</strong>{tr('Movements trained','训练动作')}</span></div><p>{reply||cue}</p><p>{tr('Paced sets follow your timer. Camera sets use movement estimates. Only completed sets are saved.', '节奏训练按计时进行，摄像训练根据动作估算。只保存已完成的组数。')}</p>{saveError&&<p role="alert">{saveError}</p>}
      {result.setsCompleted>0 && <button className="trainer-primary" type="button" disabled={saving} onClick={()=>void save()}>{saving?tr('Saving…','正在保存…'):tr('Save my session','保存本次训练')}</button>}<button type="button" disabled={saving} onClick={leave}>{tr('Back to training','返回训练主页')}</button></section>
      : <>
        {state.phase==='camera' ? <><CameraCoach language={language} exercise={exercise} audioEnabled={voiceEnabled} paused={state.paused}
          onStart={()=>{unlock();dispatch({type:'camera'});}} onSpeak={text=>audio.current?.say(text,language,voiceEnabled)}
          onClose={()=>dispatch({type:'guide'})} onSetComplete={()=>dispatch({type:'completeSet',camera:true})}/>{coachPanel}</>
        : <section className={`guide-layout${resting?' trainer-rest':''}`}>
          <div className="guide-visual">{renderGuide(resting?workout[state.nextMove]:exercise)}<button type="button" onClick={()=>{dispatch({type:'pause'});setPreview(true);}}>↗ <span>{tr('Full guide','完整动作指导')}</span></button></div>
          <div className="guide-copy"><p className="kicker">{tr(`SET ${Math.min(state.done[state.move]+1,exercise.sets)} OF ${exercise.sets}`,`第 ${Math.min(state.done[state.move]+1,exercise.sets)} / ${exercise.sets} 组`)}</p><h1>{exerciseName(resting?workout[state.nextMove]:exercise)}</h1>
            <div className="trainer-clock" data-phase={state.phase}><span>{phaseLabel}</span><strong data-testid="phase-time">{state.phase==='ready'?'—':seconds}</strong><small>{state.phase==='ready'?tr('Press start when you’re ready','准备好后点击开始'):tr('seconds','秒')}</small></div>
            {!resting&&<p className="trainer-rep-count" data-testid="rep-count">{timing.hold?exercise.id==='stationary-bike'?tr(`${timing.seconds} second interval`, `骑行 ${timing.seconds} 秒`):tr(`${timing.seconds} second hold`, `保持 ${timing.seconds} 秒`):tr(`Rep ${Math.min(timing.reps,state.rep+1)} / ${timing.reps}`,`第 ${Math.min(timing.reps,state.rep+1)} / ${timing.reps} 次`)}{timing.sides===2?tr(` · Side ${state.side+1} / 2`,` · 第 ${state.side+1} / 2 侧`):''}</p>}
            <div className="trainer-main-actions">{state.phase==='ready'?<button className="trainer-primary start-paced-set" type="button" onClick={start}>{tr('Start set','开始本组')} →</button>:<button className="trainer-primary" type="button" onClick={()=>command(state.paused?'resume':'pause')}>{state.paused?tr('Resume timer','继续计时'):tr('Pause timer','暂停计时')}</button>}
              {resting && <><button type="button" onClick={()=>command('moreRest')}>{tr('+15 seconds rest','多休息 15 秒')}</button><button type="button" onClick={()=>dispatch({type:'skipRest'})}>{tr('I’m ready — skip rest','准备好了，结束休息')}</button></>}
            </div>
            {coachPanel}
            {state.phase==='ready' && <><div className="trainer-pacing"><label>{tr('Seconds per rep','每次动作秒数')}<select value={state.pace} onChange={event=>dispatch({type:'pace',seconds:Number(event.target.value)})}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>{tr('Break between reps','动作间休息')}<select value={state.repBreak} onChange={event=>dispatch({type:'repBreak',seconds:Number(event.target.value)})}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n} {tr('sec','秒')}</option>)}</select></label></div>
              <p className="trainer-note">{tr('Follow the timer at a comfortable pace. These are paced reps, not detected movements. Timed holds keep their prescribed duration. Keep this page open; switching away pauses your session.', '请按舒适的节奏跟随计时。这是节奏计数，不是动作识别；静态保持按指定时长计时。请保持此页面打开，切换页面会暂停训练。')}</p>
              <button className="camera-cta" type="button" onClick={()=>{unlock();dispatch({type:'camera'});}}>{tr('Coach me with camera','使用摄像指导')} →</button>
              <button className="manual-cta" type="button" onClick={()=>{unlock();dispatch({type:'completeSet'});}}>{tr('I already did this set','我已完成本组')} ✓</button></>}
          </div>
        </section>}
        {state.phase==='ready' && <div className="session-queue">{workout.map((item,index)=><button className={index===state.move?'active':''} type="button" key={item.id} disabled={state.done[index]>=item.sets} onClick={()=>dispatch({type:'selectMove',index})}><span>{state.done[index]>=item.sets?'✓':index+1}</span><small>{exerciseName(item)}</small></button>)}</div>}
      </>}
    {preview&&renderPreview(exercise,()=>setPreview(false),()=>{setPreview(false);dispatch({type:'guide'});dispatch({type:'camera'});})}
    {exitOpen&&<div className="trainer-exit-backdrop"><section className="trainer-exit" role="dialog" aria-modal="true" aria-label={tr('Finish this session?','结束本次训练？')}><h2>{tr('Finish this session?','结束本次训练？')}</h2><p>{tr('Your timer is paused. You can keep training or finish with the sets you completed.', '计时已暂停。你可以继续训练，或结束并保存已完成的组数。')}</p><button className="trainer-primary" autoFocus type="button" onClick={()=>{setExitOpen(false);command('resume');}}>{tr('Keep training','继续训练')}</button><button type="button" onClick={()=>{setExitOpen(false);dispatch({type:'finish'});}}>{tr('Finish now','现在结束')}</button><button type="button" onClick={leave}>{tr('Discard session','放弃本次训练')}</button></section></div>}
  </main>;
}
