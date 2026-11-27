/* The narrator: the ONE adapter every spoken line in the Workout page goes through.
   who = 'coach' (warm trainer) or 'baku' (cold, commanding; the Shadow-mode voice). Lines approved 25 Nov 2026
   (voice-lines-draft.md). The player is voice.js: recorded ElevenLabs clips from assets/voice/manifest.json, and the
   browser voice (speechSynthesis) for any line that has no clip yet. Line texts live in voice/lines.json + moments.json.

   Items for say():  ['moment', id, vars]   ['dynamic', [clip ids or {say:'text'}]]   ['speak', text]
   say(list) plays the items one after another and cancels whatever was playing before, so two lines never overlap.
   Moments without a line for that voice (Baku only has workout.begin/rest/again/done) are skipped. */
import * as VP from './voice.js';
export const ID=VP.ID;
export const speakable=VP.speakable;
VP.configure({base:new URL('../assets/voice/',import.meta.url).href,src:new URL('../voice/',import.meta.url).href});
const VKEY='lockin-wo-voice-v1';
export const V={on:true,who:'coach'};
try{if(localStorage.getItem('lockin-wo-mute')==='1')V.on=false;Object.assign(V,JSON.parse(localStorage.getItem(VKEY)||'{}'))}catch(e){}
VP.setMuted(!V.on);
/* load the line texts now (manifest, moments), so the first line of a session does not wait for them */
try{VP.dynamic([],'coach')}catch(e){}
export function saveV(){try{localStorage.setItem(VKEY,JSON.stringify(V));localStorage.setItem('lockin-wo-mute',V.on?'0':'1')}catch(e){}}
const BAKU=new Set(['workout.begin','workout.rest','workout.again','workout.done']);
const has=(id,who)=>who==='baku'?BAKU.has(id):!BAKU.has(id);
/* {say} parts get the same text cleaning as the clips' keys */
const clean=p=>typeof p==='string'?p:{say:speakable(p.say||'')};
/* what was asked for, for the test copies: [{t, who, id, parts|vars}] */
export const LOG=[];
let seq=0;
export function stop(){seq++;VP.stop()}
export async function say(list,who=V.who){stop();if(!V.on)return;const my=seq;
  for(const [k,a,b] of list){if(my!==seq||!V.on)return;
    try{if(k==='moment'){if(!has(a,who))continue;LOG.push({t:Date.now(),who,id:a,vars:b||{}});await VP.moment(a,who,b||{})}
      else if(k==='dynamic'){const p=(a||[]).filter(Boolean).map(clean);if(!p.length)continue;LOG.push({t:Date.now(),who,id:'dynamic',parts:p});await VP.dynamic(p,who)}
      else if(k==='speak'){LOG.push({t:Date.now(),who,id:'speak',text:a});await VP.speak(a,who)}}catch(e){}}}
export const moment=(id,who=V.who,vars)=>say([['moment',id,vars]],who);
export const dynamic=(parts,who=V.who)=>say([['dynamic',parts]],who);
export const speak=(text,who=V.who)=>say([['speak',text]],who);
export function setMuted(m){V.on=!m;saveV();VP.setMuted(!!m);if(m)stop()}
export const hush=stop;
