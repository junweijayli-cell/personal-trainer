// Original instrumental accompaniment synthesized on this device; no external tracks or uploads.
export class WorkoutAudio {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat=0;
  private beat=0;
  private volume=.25;
  private ducked=false;
  private enabled=false;
  private paused=false;
  private style: 'focus' | 'energy'='energy';
  private utterance: SpeechSynthesisUtterance | null=null;
  private disposed=false;
  constructor(private onIssue: (kind:'voice'|'music')=>void) {}

  unlock() {
    if(this.disposed) return;
    try {
      const Constructor=window.AudioContext ?? (window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!Constructor) throw Error('Audio unavailable');
      if(!this.context) {
        this.context=new Constructor(); this.bus=this.context.createGain(); this.bus.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);
        const samples=this.noise.getChannelData(0); for(let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1;
      }
      void this.context.resume().catch(()=>{if(!this.disposed)this.onIssue('music');});
    } catch {this.onIssue('music');}
  }
  setMusic(enabled:boolean, volume=this.volume, style=this.style) {
    const changed=this.enabled!==enabled || this.style!==style;
    this.enabled=enabled; this.volume=Math.max(0,Math.min(.6,volume)); this.style=style;
    if(changed)this.sync();else this.level();
  }
  setPaused(paused:boolean) {if(this.paused===paused)return;this.paused=paused;this.sync();}
  duck(value:boolean) {this.ducked=value;this.level();}
  private level() {
    if(!this.context || !this.bus) return;
    const value=this.enabled && !this.paused ? this.volume*(this.ducked?.18:1) : 0;
    this.bus.gain.cancelScheduledValues(this.context.currentTime);
    this.bus.gain.setTargetAtTime(value,this.context.currentTime,.035);
  }
  private sync() {
    this.level();
    if(this.timer) {clearInterval(this.timer);this.timer=null;}
    if(!this.enabled || this.paused || !this.context || this.disposed) return;
    this.nextBeat=this.context.currentTime+.04;
    this.timer=setInterval(()=>this.schedule(),80);this.schedule();
  }
  private tone(frequency:number,time:number,length:number,volume:number,type:OscillatorType='sine') {
    const ctx=this.context!;const note=ctx.createOscillator(),gain=ctx.createGain();
    note.type=type;note.frequency.value=frequency;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    note.connect(gain);gain.connect(this.bus!);note.start(time);note.stop(time+length+.02);
    note.onended=()=>{note.disconnect();gain.disconnect();};
  }
  private percussion(time:number,hat:boolean) {
    const ctx=this.context!,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise;filter.type='highpass';filter.frequency.value=hat?6500:1700;
    gain.gain.setValueAtTime(hat?.1:.22,time);gain.gain.exponentialRampToValueAtTime(.0001,time+(hat?.06:.14));
    source.connect(filter);filter.connect(gain);gain.connect(this.bus!);source.start(time);source.stop(time+.16);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  private schedule() {
    const ctx=this.context;if(!ctx || this.disposed) return;
    if(this.nextBeat<ctx.currentTime-.3)this.nextBeat=ctx.currentTime+.03;
    const step=60/(this.style==='energy'?116:92)/2;
    while(this.nextBeat<ctx.currentTime+.16) {
      const n=this.beat++,time=this.nextBeat, root=[55,43.6535,65.4064,48.9994][Math.floor(n/16)%4];
      if(n%2===0) {this.tone(54,time,.18,.7);this.tone(root,time,.28,.27,'triangle');}
      if(n%8===2 || n%8===6)this.percussion(time,false);
      this.percussion(time,true);
      const melody=[4,6,8,6,4,5,6,3][n%8];
      if(this.style==='energy' || n%2===0)this.tone(root*melody,time,.45,.065,'sine');
      if(n%16===0)for(const ratio of [2,2.5,3])this.tone(root*ratio,time,step*14,.06,'triangle');
      this.nextBeat+=step;
    }
  }
  say(text:string, language:'en'|'zh', enabled:boolean) {
    if(!enabled || this.disposed) return;
    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {this.onIssue('voice');return;}
    this.silence();
    const utterance=new SpeechSynthesisUtterance(text);this.utterance=utterance;
    utterance.lang=language==='zh'?'zh-CN':'en-US';utterance.rate=language==='zh'?1:1.04;
    const voices=window.speechSynthesis.getVoices();
    utterance.voice=voices.find(voice=>voice.lang===utterance.lang && voice.localService)
      ?? voices.find(voice=>voice.lang.toLowerCase().startsWith(language==='zh'?'zh':'en')) ?? null;
    this.duck(true);
    const ended=()=>{if(this.utterance===utterance){this.utterance=null;this.duck(false);}};
    utterance.onend=ended;
    utterance.onerror=(event)=>{ended();if(!this.disposed && event.error!=='canceled' && event.error!=='interrupted')this.onIssue('voice');};
    window.speechSynthesis.resume();window.speechSynthesis.speak(utterance);
  }
  silence() {this.utterance=null;if('speechSynthesis' in window)window.speechSynthesis.cancel();this.duck(false);}
  dispose() {this.disposed=true;this.silence();if(this.timer)clearInterval(this.timer);this.timer=null;void this.context?.close().catch(()=>{});this.context=null;}
}

export type Recognition = {lang:string;continuous:boolean;interimResults:boolean;start:()=>void;abort:()=>void;
  onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
  onerror:(()=>void)|null;onend:(()=>void)|null;};
export function recognitionConstructor() {
  const browser=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
