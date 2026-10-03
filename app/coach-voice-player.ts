import { preloadVoiceIds, voiceAsset, voiceRequest, type CoachLanguage } from './coach-voice';

// Approved Annie/Lea recordings are served by TrainWell. No browser TTS or runtime generation.
export class CoachVoicePlayer {
  private bytes=new Map<string,Promise<ArrayBuffer>>();
  private buffers=new Map<string,Promise<AudioBuffer>>();
  private abort=new AbortController();
  private sources:AudioBufferSourceNode[]=[];
  private sequence=0;
  private disposed=false;
  private response=false;
  private lastKey='';
  private lastAt=0;
  constructor(private context:()=>AudioContext|null,private duck:(value:boolean)=>void,private issue:()=>void){}
  private fetchClip(id:string,language:CoachLanguage) {
    const url=voiceAsset(id,language);
    let pending=this.bytes.get(url);
    if(!pending) {
      const controller=new AbortController();
      const cancel=()=>controller.abort();
      this.abort.signal.addEventListener('abort',cancel,{once:true});
      const timeout=setTimeout(cancel,10000);
      pending=fetch(url,{signal:controller.signal}).then(async response=>{
        if(!response.ok)throw Error('Voice recording unavailable');
        return response.arrayBuffer();
      }).catch(error=>{this.bytes.delete(url);throw error;})
        .finally(()=>{clearTimeout(timeout);this.abort.signal.removeEventListener('abort',cancel);});
      this.bytes.set(url,pending);
    }
    return pending;
  }
  async preload(language:CoachLanguage,exerciseText:string) {
    const ids=preloadVoiceIds(exerciseText,language);let next=0;
    await Promise.all(Array.from({length:4},async()=>{while(next<ids.length && !this.disposed)await this.fetchClip(ids[next++],language);}));
  }
  private buffer(id:string,language:CoachLanguage,context:AudioContext) {
    const key=voiceAsset(id,language);let pending=this.buffers.get(key);
    if(!pending) {
      pending=this.fetchClip(id,language).then(data=>context.decodeAudioData(data.slice(0))).catch(error=>{this.buffers.delete(key);throw error;});
      this.buffers.set(key,pending);
    }
    return pending;
  }
  say(text:string,language:CoachLanguage,response=false) {
    if(this.disposed)return;
    const request=voiceRequest(text,language);
    if(!request){this.issue();return;}
    // Short counts must not chop a slower conversational reply into fragments.
    if(request.count && this.response)return;
    const key=`${language}:${request.ids.join(',')}`;
    const now=performance.now();
    if(key===this.lastKey && now-this.lastAt<250)return;
    this.stop();this.lastKey=key;this.lastAt=now;this.response=response;
    const context=this.context();if(!context){this.issue();return;}
    const sequence=this.sequence;
    void Promise.all([context.resume(),...request.ids.map(id=>this.buffer(id,language,context))]).then(([, ...buffers])=>{
      if(this.disposed || sequence!==this.sequence)return;
      // Never replay an old count after a slow network response.
      if(request.count && performance.now()-now>700)return;
      let when=context.currentTime+.015;
      this.duck(true);
      for(const buffer of buffers) {
        const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);this.sources.push(source);
        source.onended=()=>{source.disconnect();this.sources=this.sources.filter(item=>item!==source);if(sequence===this.sequence && !this.sources.length){this.response=false;this.duck(false);}};
        source.start(when);when+=buffer.duration+.035;
      }
    }).catch(()=>{if(!this.disposed && sequence===this.sequence){this.stop();this.issue();}});
  }
  stop() {
    this.sequence++;this.response=false;this.lastKey='';
    for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}
    this.sources=[];this.duck(false);
  }
  dispose(){this.disposed=true;this.stop();this.abort.abort();this.bytes.clear();this.buffers.clear();}
}
