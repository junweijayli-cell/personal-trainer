import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),source=path.join(root,'work/natural-voices');
const lines=JSON.parse(fs.readFileSync(path.join(source,'lines.json')));
const ffmpeg=process.env.FFMPEG_BIN || 'ffmpeg';
const output=path.join(root,'public/audio/coach/20260912-af');
const inventory=[];
let missing=0;
for(const line of lines)for(const language of ['en','zh']){
 const sourceFile=path.join(source,language+'-'+line.id+'.json');
 if(!fs.existsSync(sourceFile)){missing++;continue;}
 const info=JSON.parse(fs.readFileSync(sourceFile));
 const file=path.join(output,language,line.id+'.mp3');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 if(!fs.existsSync(file)){
  const response=await fetch(info.audio_url);if(!response.ok)throw Error('Audio download failed: '+line.id);
  const wav=path.join(source,language+'-'+line.id+'.wav');
  fs.writeFileSync(wav,Buffer.from(await response.arrayBuffer()));
  const converted=spawnSync(ffmpeg,['-v','error','-y','-i',wav,'-af','silenceremove=start_periods=1:start_duration=0.015:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_duration=0.015:start_threshold=-48dB,areverse,apad=pad_dur=0.04','-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','64k',file],{encoding:'utf8'});
  if(converted.status!==0)throw Error('Audio encoding failed: '+converted.stderr);
 }
 const bytes=fs.readFileSync(file);
 if(bytes.length<500)throw Error('Empty audio: '+file);
 inventory.push({id:line.id,language,text:line[language],file:'/audio/coach/20260912-af/'+language+'/'+line.id+'.mp3',sourceVoice:info.voiceId,speed:info.speed,sourceUrl:info.audio_url,sourceDuration:info.duration,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
}
fs.writeFileSync(path.join(source,'inventory.json'),JSON.stringify(inventory,null,2));
console.log(JSON.stringify({ready:inventory.length,missing,totalBytes:inventory.reduce((n,item)=>n+item.bytes,0)}));
if(!missing)fs.writeFileSync(path.join(root,'app/coach-voice-assets.json'),JSON.stringify(inventory.map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='sourceUrl'))),null,2)+'\n');
