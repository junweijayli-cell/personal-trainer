import {afterEach,describe,expect,it,vi} from 'vitest';
import {CoachVoicePlayer} from '../app/coach-voice-player';
import {voiceRequest,voiceAsset} from '../app/coach-voice';
import {exerciseCatalog} from '../app/workout-data';
import {coachExerciseCue} from '../app/workout-coach-copy';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import lines from '../app/coach-voice-lines.json';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){
  const sources:Array<{start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;buffer:unknown;onended:(()=>void)|null}>=[];
  const context={currentTime:0,destination:{},resume:vi.fn(async()=>{}),decodeAudioData:vi.fn(async()=>({duration:.4})),createBufferSource:()=>{
    const source={start:vi.fn(),stop:vi.fn(),disconnect:vi.fn(),connect:vi.fn(),buffer:null,onended:null};sources.push(source);return source;
  }};
  const duck=vi.fn(),issue=vi.fn();
  const player=new CoachVoicePlayer(()=>context as unknown as AudioContext,duck,issue);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array([1,2,3]))));
  return {player,sources,duck,issue,context};
}
describe('approved coach voices',()=>{
  it('ships every cue with the approved voice, slower setting and intact audio asset',()=>{
    const assets=JSON.parse(readFileSync('app/coach-voice-assets.json','utf8')) as Array<{id:string;language:'en'|'zh';file:string;sourceVoice:string;speed:number;sha256:string}>;
    for(const language of ['en','zh'] as const){
      const ids=[...lines.map(line=>line.id),...Object.keys(exerciseCatalog).map(id=>`exercise-${id}`)];
      for(const id of ids){
        const asset=assets.find(item=>item.id===id && item.language===language);expect(asset).toBeDefined();
        expect(asset!.sourceVoice).toBe(language==='en'?'330290724a1b470fb63153f34d4c0183':'1803df59c37443789d2e4f71c82859a0');
        expect(asset!.speed).toBe(.88);
        expect(createHash('sha256').update(readFileSync('public'+asset!.file)).digest('hex')).toBe(asset!.sha256);
      }
    }
  });
  it('covers every exercise in both languages and composes camera counts',()=>{
    for(const language of ['en','zh'] as const)for(const exercise of Object.values(exerciseCatalog))expect(voiceRequest(coachExerciseCue(exercise,language),language)).not.toBeNull();
    expect(voiceRequest('Rep 6. Halfway. Keep it steady.','en')).toEqual({ids:['count-6'],count:true});
    expect(voiceRequest('第 6 次，已经过半，保持稳定。','zh')).toEqual({ids:['count-6'],count:true});
    expect(voiceRequest('45','en')?.ids).toEqual(['count-40','count-5']);
    expect(voiceRequest('20 秒','zh')?.ids).toEqual(['count-20']);
    expect(voiceRequest('unrecorded text','en')).toBeNull();
  });
  it('uses the hosting base path and distinct language assets',()=>{
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH','/personal-trainer');
    expect(voiceAsset('count-1','zh')).toBe('/personal-trainer/audio/coach/20260912-af/zh/count-1.mp3');
    vi.unstubAllEnvs();
    expect(readFileSync('public/_headers','utf8')).toContain('microphone=(self)');
  });
  it('plays recorded audio, ducks music, and restores music after completion',async()=>{
    const f=fixture();f.player.say('Three','en');await settle();
    expect(f.sources).toHaveLength(1);expect(f.sources[0].start).toHaveBeenCalled();expect(f.duck).toHaveBeenLastCalledWith(true);
    f.sources[0].onended?.();expect(f.duck).toHaveBeenLastCalledWith(false);expect(f.issue).not.toHaveBeenCalled();
  });
  it('cancels pending playback on silence or account/session exit',async()=>{
    const f=fixture();let release!:(r:Response)=>void;
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{release=resolve;})));
    f.player.say('Three','en');f.player.stop();release(new Response(new Uint8Array([1])));await settle();expect(f.sources).toHaveLength(0);
    f.player.say('Three','en');await settle();expect(f.sources).toHaveLength(1);
    f.player.dispose();expect(f.sources[0].stop).toHaveBeenCalled();f.player.say('Three','en');await settle();expect(f.sources).toHaveLength(1);
  });
  it('keeps a slower response intact when count and reset cues arrive',async()=>{
    const f=fixture();f.player.say('Ready. Let’s train together.','en',true);f.player.say('1','en');await settle();
    expect(f.sources).toHaveLength(1);f.player.say('Reset','en');expect(f.sources[0].stop).not.toHaveBeenCalled();
    f.sources[0].onended?.();f.player.say('2','en');await settle();expect(f.sources).toHaveLength(2);
  });
  it('changes languages immediately and does not use robotic speech on asset failure',async()=>{
    const f=fixture();f.player.say('Three','en');await settle();f.player.say('三','zh');await settle();
    expect(f.sources[0].stop).toHaveBeenCalled();expect(f.sources).toHaveLength(2);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:503})));
    f.player.say('4','zh');await settle();expect(f.issue).toHaveBeenCalledOnce();expect(f.sources).toHaveLength(2);
  });
  it('drops a count that arrives after its timing window',async()=>{
    const f=fixture();let time=0;vi.spyOn(performance,'now').mockImplementation(()=>time);
    let release!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{release=resolve;})));
    f.player.say('Three','en');time=1000;release(new Response(new Uint8Array([1])));await settle();
    expect(f.sources).toHaveLength(0);expect(f.issue).not.toHaveBeenCalled();
  });
});
