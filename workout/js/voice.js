/* Lock In voice player: pre-recorded ElevenLabs clips (eleven_v4) with a speechSynthesis fallback.
   No ElevenLabs calls at runtime: clips are static MP3s in assets/voice/<who>/<id>.mp3, listed in
   assets/voice/manifest.json (written by voice/make-voices.ps1, which also copies moments.json into it).

   API
     moment(id, who, vars)   play one of the moment's variants (random, never the same as last time).
                             vars fill slots, e.g. {secs:60}, {min:32}, {session:'UA'}, {left:12}, {brk:5}, {days:251}.
                             'parents' moments play at most once a day (else their alt moment plays).
                             -> Promise<{id, v, how}>  how = 'clips'|'tts'|'muted'|'cancelled'|'none'|'skipped'
     dynamic(parts, who)     play clip ids in order, e.g. [ID.name('pullup'), ID.set(1,4), ID.range(5,8)]
                             -> Promise<how>
     speak(text, who)        a whole sentence: covered by clips when possible, else the browser voice -> Promise<how>
     preload(who, onProgress)  fetch every clip of a voice into the offline cache -> {clips, ok, failed}
     stop(), setMuted(bool), isMuted(), configure({base, src}), ID (clip id helpers), speakable, keyOf
   Never overlaps: every call cancels the line before it. If any clip of a line is missing, the WHOLE line
   goes to the browser voice (never a mix of two voices). */

export function speakable(t){return String(t).replace(/\bY-T-W\b/g,'Y, T, W').replace(/\bRIR\b/g,'reps in reserve').replace(/\bRDL\b/g,'Romanian deadlift')
  .replace(/\+/g,' plus ').replace(/ x (\d+)/g,' times $1').replace(/(\d+) s\b/g,'$1 seconds')
  .replace(/(\d+)\s*[-–]\s*(\d+)/g,'$1 to $2').replace(/(\d+)-s\b/g,'$1 second').replace(/\b(\d+(?:\.\d+)?) L\b/g,'$1 litre')
  .replace(/([A-Za-z]+)-([A-Za-z]+)/g,(m,a,b)=>(a+' '+b).toLowerCase())
  .replace(/[()]/g,', ').replace(/\s+,/g,',').replace(/,\s*,/g,',').replace(/\s{2,}/g,' ').replace(/[,\s]+$/,'').trim()}
export function keyOf(t){return speakable(t).toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim()}

/* clip id helpers for dynamic() */
export const ID={name:e=>'name-'+e,set:(s,n)=>`set-${s}-of-${n}`,cue:e=>'cue-'+e,switchTo:e=>'switch-'+e,secs:r=>'sec-'+r,min:m=>'min-'+m,session:s=>'sess-'+s,
  range:(lo,hi,kind='reps')=>kind==='reps'?`range-${lo}-to-${hi}-reps`:kind==='count'?'range-as-many-as-you-can':kind==='max'?'range-hold-as-long-as-you-can':lo===hi?`range-hold-${lo}-seconds`:`range-hold-${lo}-to-${hi}-seconds`,
  countdown:()=>'count3',go:()=>'go'};

const CFG={base:new URL('../assets/voice/',import.meta.url).href,src:new URL('../voice/',import.meta.url).href,muted:false,cacheName:'lockin-voice-clips',gapEnd:0.22,gapMid:0.07,decodedMax:80};
export function configure(o){o=o||{};for(const k of ['base','src'])if(o[k])o[k]=new URL(o[k],location.href).href;Object.assign(CFG,o);DATA=null}
export function setMuted(m){CFG.muted=!!m;if(CFG.muted)stop()}
export const isMuted=()=>CFG.muted;

/* state (additive key): last variant per moment, and the day a once-a-day group last played */
const SKEY='lockin-voice-v1';
const st=()=>{try{return Object.assign({last:{},once:{}},JSON.parse(localStorage.getItem(SKEY)||'{}'))}catch(e){return{last:{},once:{}}}};
const save=s=>{try{localStorage.setItem(SKEY,JSON.stringify(s))}catch(e){}};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

/* data: manifest (clips + moments). Without a manifest, the texts come from voice/lines.json + moments.json (browser voice only). */
let DATA=null;
async function cacheOpen(){try{return 'caches' in window?await caches.open(CFG.cacheName):null}catch(e){return null}}
async function getJson(url,c){try{const r=await fetch(url,{cache:'no-cache'});if(r.ok){if(c){try{await c.put(url,r.clone())}catch(e){}}return await r.json()}}catch(e){}
  try{const hit=c&&await c.match(url);return hit?await hit.json():null}catch(e){return null}}
function index(voices,mom){const out={voices:{},mom:mom||{slots:{},defaults:{},moments:{}}};
  for(const who in voices){const byId=new Map(),byKey=new Map();let max=1;
    for(const id in voices[who].clips){const c=voices[who].clips[id];const e={id,say:c.say||c.text||'',key:c.key,file:c.file?c.file+(c.bytes?'?v='+c.bytes:''):null};byId.set(id,e);
      if(e.file&&c.key){byKey.set(c.key,e);max=Math.max(max,c.key.split(' ').length)}}
    out.voices[who]={byId,byKey,max}}return out}
function data(){if(!DATA)DATA=(async()=>{const c=await cacheOpen();const m=await getJson(CFG.base+'manifest.json',c);
    if(m&&m.voices)return index(m.voices,m.moments);
    const [lines,mom]=await Promise.all([getJson(CFG.src+'lines.json',c),getJson(CFG.src+'moments.json',c)]);if(!lines)return null;
    const v={};for(const l of lines)(v[l.voice]||(v[l.voice]={clips:{}})).clips[l.id]={key:l.key,say:l.say,file:null};return index(v,mom)})();return DATA}

/* audio */
let AC=null,seq=0,SRC=[],PEND=null;const DEC=new Map();
const ctx=()=>{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C()}return AC};
async function bytes(url){const c=await cacheOpen();try{if(c){const hit=await c.match(url);if(hit)return await hit.arrayBuffer()}}catch(e){}
  const r=await fetch(url);if(!r.ok)throw new Error('clip '+r.status+' '+url);if(c){try{await c.put(url,r.clone())}catch(e){}}return await r.arrayBuffer()}
async function buffer(url){if(DEC.has(url)){const b=DEC.get(url);DEC.delete(url);DEC.set(url,b);return b}
  const a=ctx();const raw=await bytes(url);const b=await a.decodeAudioData(raw.slice(0));const d=b.getChannelData(0),thr=0.008,pad=Math.round(b.sampleRate*0.025);
  let s=0,e=d.length-1;while(s<d.length&&Math.abs(d[s])<thr)s++;while(e>s&&Math.abs(d[e])<thr)e--;if(s>=d.length){s=0;e=d.length-1}/* all quiet: keep it whole */
  const t={buf:b,off:Math.max(0,s-pad)/b.sampleRate,dur:Math.max(0.05,(Math.min(d.length,e+pad)-Math.max(0,s-pad))/b.sampleRate)};
  DEC.set(url,t);if(DEC.size>CFG.decodedMax)DEC.delete(DEC.keys().next().value);return t}

export function stop(){seq++;for(const s of SRC){try{s.onended=null;s.stop()}catch(e){}}SRC=[];if(PEND){const p=PEND;PEND=null;p('cancelled')}try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}}

function pickVoice(who){const L=(speechSynthesis.getVoices?speechSynthesis.getVoices():[]).filter(v=>/^en/i.test(v.lang));const male=/guy|andrew|brian|christopher|eric|roger|davis|ryan|thomas|william|george|david|mark|james/i;
  return who==='baku'?(L.find(v=>/natural/i.test(v.name)&&male.test(v.name))||L.find(v=>male.test(v.name))||L[0]):(L.find(v=>/natural/i.test(v.name))||L[0])}
function tts(txt,who,my){return new Promise(res=>{if(!txt||!('speechSynthesis' in window))return res('none');try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(speakable(txt));const v=pickVoice(who);if(v)u.voice=v;
  u.rate=who==='baku'?0.86:1.0;u.pitch=who==='baku'?0.8:1.0;let done=false;const fin=r=>{if(done)return;done=true;if(PEND===fin)PEND=null;res(r)};PEND=fin;
  u.onend=u.onerror=()=>fin(my===seq?'tts':'cancelled');speechSynthesis.speak(u);setTimeout(()=>fin('tts'),Math.min(20000,1500+txt.length*90))}catch(e){res('none')}})}

/* play a list of clip entries; any missing file -> the whole line through the browser voice */
async function play(entries,who,my){if(CFG.muted)return 'muted';const text=entries.map(e=>e.say).join(' ').trim();
  const a=entries.length&&entries.every(e=>e.file)?ctx():null;if(!a)return tts(text,who,my);
  try{if(a.state==='suspended')await a.resume();const bufs=await Promise.all(entries.map(e=>buffer(CFG.base+e.file)));if(my!==seq)return 'cancelled';if(CFG.muted)return 'muted';
    if(a.state!=='running')return tts(text,who,my);/* autoplay blocked: the browser voice still works */
    let t=a.currentTime+0.03;return await new Promise(res=>{let done=false;const fin=r=>{if(done)return;done=true;if(PEND===fin)PEND=null;res(r)};PEND=fin;
      bufs.forEach((b,i)=>{const s=a.createBufferSource();s.buffer=b.buf;s.connect(a.destination);s.start(t,b.off,b.dur);SRC.push(s);
        t+=b.dur+(i<bufs.length-1?(/[.!?]$/.test(entries[i].say.trim())?CFG.gapEnd:CFG.gapMid):0);if(i===bufs.length-1)s.onended=()=>fin(my===seq?'clips':'cancelled')});
      setTimeout(()=>fin(my===seq?'clips':'cancelled'),(t-a.currentTime+2)*1000)/* safety net if the context stalls */})}
  catch(e){if(my!==seq)return 'cancelled';return tts(text,who,my)}}

/* cover a sentence's key with the fewest clips that have files */
function cover(key,V){const w=key.split(' ').filter(Boolean),n=w.length;if(!n||!V)return null;const best=new Array(n+1).fill(Infinity),from=new Array(n+1);best[0]=0;
  for(let i=0;i<n;i++){if(best[i]===Infinity)continue;for(let j=i+1;j<=Math.min(n,i+V.max);j++){const c=V.byKey.get(w.slice(i,j).join(' '));if(c&&best[i]+1<best[j]){best[j]=best[i]+1;from[j]=[i,c]}}}
  if(best[n]===Infinity)return null;const out=[];for(let j=n;j>0;j=from[j][0])out.unshift(from[j][1]);return out}

export async function speak(text,who='coach'){stop();const my=seq;if(CFG.muted||!text)return 'muted';const D=await data();if(my!==seq)return 'cancelled';
  const parts=D&&cover(keyOf(text),D.voices[who]);return parts?play(parts,who,my):tts(text,who,my)}

/* parts: clip ids, or {say:'text'} for a piece with no clip (forces the browser voice for that line) */
export async function dynamic(parts,who='coach'){stop();const my=seq;if(CFG.muted)return 'muted';const D=await data();if(my!==seq)return 'cancelled';const V=D&&D.voices[who];
  const ents=(parts||[]).map(p=>typeof p==='string'?(V&&V.byId.get(p))||null:{say:String(p.say||''),file:null});
  const miss=(parts||[]).filter((p,i)=>!ents[i]);if(miss.length)console.warn('voice: unknown clip ids',miss);
  const ok=ents.filter(Boolean);return ok.length?play(ok,who,my):'none'}

/* which entries a variant uses with these vars; null if a required slot has no clip */
function resolve(seqIds,who,vars,D){const V=D.voices[who],sl=(D.mom.slots||{})[who]||{},def=D.mom.defaults||{},out=[];
  for(const p of seqIds){const m=/^\{([a-z]+)(\?)?\}$/.exec(p);if(!m){const e=V.byId.get(p);if(!e)return null;out.push(e);continue}
    const val=vars[m[1]]!=null?vars[m[1]]:def[m[1]];const e=val!=null&&sl[m[1]]?V.byId.get(sl[m[1]].replace('{v}',val)):null;
    if(e)out.push(e);else if(!m[2])return null}return out}

export async function moment(id,who='coach',vars={}){stop();const my=seq;const D=await data();if(my!==seq)return{id,v:-1,how:'cancelled'};
  const M=D&&D.mom.moments&&D.mom.moments[who]&&D.mom.moments[who][id];if(!M||!D.voices[who])return{id,v:-1,how:'none'};
  const S=st(),day=today();
  if(M.once&&S.once[M.once]===day)return M.alt?moment(M.alt,who,vars):{id,v:-1,how:'skipped'};
  const ok=M.variants.map((q,i)=>[i,resolve(q,who,vars||{},D)]).filter(x=>x[1]&&x[1].length);if(!ok.length)return{id,v:-1,how:'none'};
  const lk=who+'/'+id,pool=ok.length>1?ok.filter(x=>x[0]!==S.last[lk]):ok;const [v,ents]=pool[Math.floor(Math.random()*pool.length)];
  S.last[lk]=v;if(M.once)S.once[M.once]=day;save(S);
  if(CFG.muted)return{id,v,how:'muted'};return{id,v,how:await play(ents,who,my)}}

export async function preload(who='coach',onProgress){const D=await data();const V=D&&D.voices[who];if(!V)return{clips:0,ok:0,failed:0};
  const files=[...new Set([...V.byId.values()].filter(e=>e.file).map(e=>e.file))];let ok=0,failed=0;
  for(let i=0;i<files.length;i+=6){await Promise.all(files.slice(i,i+6).map(f=>bytes(CFG.base+f).then(()=>ok++,()=>failed++)));onProgress&&onProgress(ok+failed,files.length)}
  return{clips:files.length,ok,failed}}
