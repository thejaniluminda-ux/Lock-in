/* Workout data: his real record in localStorage 'lockin-workout-v1' (format v:3 since 25 Nov 2026).
   v:2 (the old Workout page) is migrated additively: nothing is dropped, the whole v:2 record is kept under `v2`,
   every log whose exercise id changed keeps its old id in `o`, the old ladder steps stay in `lvlV2`.
   Progress photos stay in their own key 'lockin-wo-photos-v1' so a big photo can never block the rest from saving. */
import {EX,SESS,MUSCLES,START,sessionFor,blocksFor,isDeload,lastSat,phase} from './plan.js';
export const KEY='lockin-workout-v1',PKEY='lockin-wo-photos-v1';
/* the app's own clock (the test copies replace Date, so module code follows the fake date too) */
export const today=()=>new Date();
export const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export const addD=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
export const mondayOf=d=>addD(d,-((d.getDay()+6)%7));
export const FOODS=[['egg','Egg',6],['dhal','Dhal, 1 cup',16],['sprats','Dried sprats, handful',15],['fish','Tinned fish, half tin',20],['milk','Milk, 1 glass',8],['kadala','Kadala, 1 cup',14],['mung','Mung, 1 cup',14],['peanut','Peanuts, handful',7],['chicken','Chicken, 100 g',25]];
const blank=()=>({v:3,logs:[],extra:{},weights:[],tape:[],protein:{},chal:{},face:{},goal:null,lvl:{}});

/* ---------- migration v:2 (old Workout page) -> v:3 ---------- */
/* old exercise ids -> the new plan's ids. Ids with no match in the new plan (plank, crunch, bridge, slbridge, rope, circuit)
   are kept as they are: their logs still count in history, they just don't belong to a session any more. */
export const OLD2NEW={negpull:'pullup',chinneg:'chinup',declinepush:'dpush',backrow:'row',lateral:'lat',pike:'pike',ytw:'ytw',diamond:'diamond',curl:'curl',
  neckiso:'neck',neckcurl:'neck',split:'bss',squat:'hsq',slrdl:'slrdl',towelcurl:'tcurl',calf:'calf',hollow:'hollow',flutter:'flutter',sideplank:'splank',hipdip:'splank',legraise:'legraise'};
/* the Build 4 draft (before v:2) used these keys; the old page already converted it, this only runs if a draft is still stored */
const DRAFT={pull:'negpull',chin:'negpull',push:'declinepush',pike:'pike',diamond:'diamond',squat:'squat',lunge:'split',bridge:'bridge',knee:'legraise',plank:'plank',rope:'rope',circuit:'circuit',side:'sideplank'};
const HOLD2=new Set(['neckiso','plank','rope','sideplank','flutter','hollow']);
function fromDraft(o){const s={v:2,logs:[],extra:{},weights:[],tape:[],protein:{},chal:{},face:{},goal:o.goal||null,legacy:o};
  for(const d in (o.log||{})){const L=o.log[d];if(!L||!L.sets)continue;let t=L.start||new Date(d+'T17:00').getTime();
    for(const k in L.sets){const e=DRAFT[k];if(!e)continue;const off=k==='chin'?10:0;
      L.sets[k].forEach((v,i)=>{if(v==null)return;const hold=HOLD2.has(e);s.logs.push({d,e,set:i+1+off,reps:hold?null:v,secs:hold?(e==='rope'?600:v):null,t:t+=60000})})}
    if(L.done||(L.warm||[]).length||(L.cool||[]).length)s.extra[d]={warm:(L.warm||[]).length?1:0,cool:(L.cool||[]).length||L.done?1:0}}
  (o.weight||[]).forEach(x=>{if(x&&x.d&&x.kg)s.weights.push({d:x.d,w:x.kg})});return s}
export function migrate(o2){const old=JSON.parse(JSON.stringify(o2)),s=Object.assign(blank(),old);
  const keep=JSON.parse(JSON.stringify(old));delete keep.legacy;s.v2=keep;/* the whole v:2 record, untouched (legacy stays at the top, not copied twice) */
  s.v=3;s.migrated={from:2,at:new Date().toISOString()};
  /* logs: new ids, original id in `o`; a set number already used that day by the same new id moves to the next free number (old number in `oset`) */
  const used={};s.logs=(old.logs||[]).map(l=>{const n=OLD2NEW[l.e]||l.e,x=Object.assign({},l,{e:n});if(n!==l.e)x.o=l.e;
    const key=x.d+'|'+n,u=used[key]||(used[key]=new Set());if(u.has(x.set)){x.oset=x.set;let k=1;while(u.has(k))k++;x.set=k}u.add(x.set);return x});
  /* protein: v:2 stored [[food,count]], v:3 stores one entry per tap */
  s.protein={};for(const d in (old.protein||{})){const L=old.protein[d];s.protein[d]=Array.isArray(L)?L.flatMap(it=>Array.isArray(it)?Array(Math.max(0,+it[1]||0)).fill(it[0]):[it]):[]}
  /* monthly challenge: "neg" (negative pull-ups) is copied to "pull"; the typed-in numbers have no date, so they never mark a day as done */
  s.chal={};for(const m in (old.chal||{})){const c=Object.assign({},old.chal[m]);if(c.neg!=null&&c.pull==null)c.pull=c.neg;c.src='v2';s.chal[m]=c}
  /* the old ladder steps (reps / tempo / harder / backpack) don't match the new ladders: kept, and the new plan starts from his tested levels */
  s.lvlV2=old.lvl||{};s.lvl={};
  return s}
let warnSave=()=>{};export const onSaveFail=f=>{warnSave=f};
export function load(){let o=null;try{o=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
  if(!o)return blank();
  if(o.v===3&&Array.isArray(o.logs))return Object.assign(blank(),o);
  if(o.log&&!Array.isArray(o.logs))o=fromDraft(o);
  if(Array.isArray(o.logs)){const s=migrate(o);save(s);return s}
  /* unknown shape: keep it whole under `unknown`; nothing is written until he logs something */
  const s=blank();s.unknown=o;return s}
export function save(S){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){warnSave();return false}}
/* photos: {'YYYY-MM': front photo (the old format, unchanged), 'YYYY-MM:side', 'YYYY-MM:back'} as downscaled JPEG data URLs */
export function loadPhotos(){try{return JSON.parse(localStorage.getItem(PKEY)||'{}')||{}}catch(e){return {}}}
export function savePhotos(P){try{localStorage.setItem(PKEY,JSON.stringify(P));return true}catch(e){return false}}
export const photoKey=(m,v)=>v==='front'?m:m+':'+v;

/* ---------- derived numbers ---------- */
export const protein=(S,k)=>(S.protein[k]||[]).reduce((a,f)=>a+((FOODS.find(x=>x[0]===f)||[0,0,0])[2]),0);
/* a planned day counts as done when it was finished in the session screen (extra.done), a 12-minute minimum was done on the
   old page (extra.mini), or the month's challenge was recorded that day */
export const dayDone=(S,k)=>{const x=S.extra[k];return !!(x&&(x.done!=null||x.mini))||((S.chal[k.slice(0,7)]||{}).d===k)};
export function setsThisWeek(S,t){const a=ymd(mondayOf(t)),b=ymd(t),out={};for(const m in MUSCLES)out[m]=0;
  for(const l of S.logs)if(l.d>=a&&l.d<=b){const x=EX[l.e];if(x)for(const m in x.m)out[m]+=x.m[m]}return out}
export function plannedWeek(t){const out={};for(const m in MUSCLES)out[m]=0;const mo=mondayOf(t);for(let i=0;i<6;i++){const d=addD(mo,i),id=sessionFor(d);if(!id||id==='TEST')continue;for(const [ex,r] of blocksFor(id,d))for(const e of ex)for(const m in EX[e].m)out[m]+=EX[e].m[m]*r}return out}
/* recovery: hours since a muscle last did a main-muscle set; glow fades over 48 h */
export function recovery(S,t){const last={};for(const l of S.logs){const x=EX[l.e];if(!x||!l.t)continue;for(const m in x.m)if(x.m[m]>=0.5&&(!last[m]||l.t>last[m]))last[m]=l.t}
  const out={};for(const m in MUSCLES){const h=last[m]?(t-last[m])/36e5:999;out[m]={h,lvl:Math.max(0,1-h/48)}}return out}
/* the last session that did this exercise (the shadow) */
export function lastSession(S,e,beforeK){let d='';for(const l of S.logs)if(l.e===e&&l.d<beforeK&&l.d>d)d=l.d;return d?S.logs.filter(l=>l.e===e&&l.d===d).sort((a,b)=>a.set-b.set):[]}
export function pb(S,e){let best=null;for(const l of S.logs)if(l.e===e){const v=l.reps??l.secs;if(v!=null&&(best==null||v>best.v))best={v,d:l.d}}return best}
export function exercisesFor(m){const L=[];for(const id in SESS)for(const [ex,r] of SESS[id].blocks)for(const e of ex)if(EX[e].m[m]>=0.5&&!L.includes(e)&&EX[e].kind!=='test')L.push(e);return L}
export function weekDays(t){const mo=mondayOf(t);return Array.from({length:7},(_,i)=>{const d=addD(mo,i);return{d,k:ymd(d),id:sessionFor(d)}})}
export {phase,isDeload,lastSat,START};
