/* Lock In Workout page (ported from the approved Workout Lab, 25 Nov 2026).
   index.html loads this module only when the Workout page opens (renderWorkout -> render()), so three.js never slows app start-up.
   Host hooks come from index.html in window.WO_HOST: tickRoutine(dayKey) ticks the routine's Workout row, slot(dayKey) gives
   the routine's workout time, toast(text) and storageFull() show messages. */
import {EX,SESS,MUSCLES,RANGE,START,WSTART,SLOT,sessionFor,blocksFor,timing,phase,isDeload,BASE} from './plan.js';
import {load,save,onSaveFail,today,ymd,addD,mondayOf,FOODS,protein,setsThisWeek,plannedWeek,recovery,lastSession,pb,exercisesFor,weekDays,dayDone,loadPhotos,savePhotos,photoKey} from './data.js';
const HOST=()=>window.WO_HOST||{};
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD=d=>`${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`,fmtK=k=>{const [y,m,d]=k.split('-');return `${+d} ${MON[m-1]}`};
const ICON={play:'<svg viewBox="0 0 16 16"><path d="M5 3.5v9l7-4.5z"/></svg>',ok:'<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>',miss:'<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',dot:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2"/></svg>',
  x:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  up:'<svg viewBox="0 0 16 16"><path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7"/></svg>',down:'<svg viewBox="0 0 16 16"><path d="M8 3.5v9M4.5 9L8 12.5 11.5 9"/></svg>',
  prev:'<svg viewBox="0 0 16 16"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',next:'<svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>'};
/* body outline used when there is no photo yet, and as the flat body map when 3D is off */
const silhouette=(view)=>{const back=view==='back',side=view==='side';const body=side?'M50 10c7 0 11 6 10 13-1 6-4 9-4 12 9 3 13 9 13 20l-3 34c-1 7-3 9-6 9l-2 40c0 5-2 8-7 8-6 0-7-3-7-8l-1-40c-3 0-5-2-5-8l-1-36c0-10 4-16 12-19 0-3-3-6-4-12-1-7 3-13 10-13z':'M50 9c7 0 11 6 10 13-1 6-4 9-4 12 12 2 20 8 22 19l4 33c1 5-2 7-5 6l-6-30-2 30 2 50c0 6-3 9-8 9s-7-3-8-9l-2-36-2 36c-1 6-3 9-8 9s-8-3-8-9l2-50-2-30-6 30c-3 1-6-1-5-6l4-33c2-11 10-17 22-19 0-3-3-6-4-12-1-7 3-13 10-13z';
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><defs><radialGradient id="g" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#0f2a3a"/><stop offset="1" stop-color="#070b0d"/></radialGradient></defs><rect width="100" height="200" fill="url(#g)"/><path d="${body}" fill="rgba(95,184,255,.10)" stroke="#9fe3ff" stroke-opacity=".7" stroke-width=".8"/>${back?'<path d="M50 34v60" stroke="#9fe3ff" stroke-opacity=".25" stroke-width=".6"/>':''}</svg>`)};
export const trainingWeek=d=>Math.floor((mondayOf(d)-mondayOf(WSTART))/6048e5)+1;
/* ladder step; neck moves from isometric holds (weeks 1-2) to curls and extensions in week 3 unless he set it himself */
const lv=(e,d=T)=>{const x=EX[e];if(!x||!x.lad)return 0;if(e==='neck'&&S.lvl.neck==null)return trainingWeek(d)>x.iso.weeks?1:0;return Math.min(x.lad.length-1,S.lvl[e]??x.start??0)};

/* ---------- state, recomputed on every render (the page can stay open past midnight) ---------- */
let S,T,TK,SID,PH,DL,REC,WK,PLAN,PHOTOS;const TGT=new Set(),TGT2=new Set();
function state(){S=load();T=today();if(S.lvl.neck==null&&trainingWeek(T)>EX.neck.iso.weeks)S.lvl.neck=1;TK=ymd(T);SID=sessionFor(T);PH=phase(T);DL=isDeload(T);REC=recovery(S,T);WK=setsThisWeek(S,T);PLAN=plannedWeek(T);PHOTOS=loadPhotos();
  TGT.clear();TGT2.clear();if(SID)for(const [ex] of blocksFor(SID,T))for(const e of ex)for(const m in EX[e].m){if(EX[e].m[m]>=1)TGT.add(m);else if(EX[e].m[m]>=0.5)TGT2.add(m)}}
const persist=()=>save(S);
onSaveFail(()=>{const h=HOST();if(h.storageFull)h.storageFull();else if(h.toast)h.toast('Could not save the workout. Storage is full.')});

/* the routine's Workout row gives the slot (17:15 most days, 11:45 on Tuesday); the plan's SLOT is the fallback */
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function slotOf(d){try{const r=HOST().slot&&HOST().slot(ymd(d));if(r)return hm(r[0])+'–'+hm(r[1])}catch(e){}return SLOT(d)}

/* ---------- today ---------- */
function todaySets(){const L=S.logs.filter(l=>l.d===TK),c={};for(const l of L)c[l.e]=(c[l.e]||0)+1;return c}
/* double progression: ready to move up when every set hit the top of the range in each of the last 2 sessions;
   step back when the last 2 sessions both had a set under the bottom of the range */
function ladderState(e){const x=EX[e];if(!x||!x.lad||x.kind==='test')return null;const by={};for(const l of S.logs)if(l.e===e&&!l.mini&&(l.reps!=null||l.secs!=null))(by[l.d]||(by[l.d]=[])).push(l.reps??l.secs);
  const ds=Object.keys(by).filter(k=>k<=TK).sort().slice(-2);if(ds.length<2)return null;const step=lv(e);
  if(ds.every(k=>by[k].length>=2&&by[k].every(v=>v>=x.rng[1]))&&step<x.lad.length-1)return 'up';
  if(ds.every(k=>by[k].some(v=>v<x.rng[0]))&&step>0)return 'down';return null}
function renderToday(){const el=$('#woToday');const yest=addD(T,-1),yk=ymd(yest),yid=sessionFor(yest);
  const nudge=yid&&!dayDone(S,yk)&&yest>=START?`<div class="nudge"><span>${ICON.miss.replace('<svg','<svg width="16" height="16" fill="none" stroke="#ffb36b" stroke-width="2" stroke-linecap="round"')}</span><div><b>Missed ${DOW[yest.getDay()]}: ${esc(SESS[yid].n)}.</b> One miss changes nothing. Do today's session in full; never miss twice.</div></div>`:'';
  const head=`<div class="date"><span class="k">${fmtD(T)} · training week ${trainingWeek(T)}</span></div>`;
  if(!SID){const nx=[1,2,3,4,5,6,7].map(i=>addD(T,i)).find(d=>sessionFor(d));const fresh=Object.keys(MUSCLES).filter(m=>REC[m].lvl>0.05);
    el.innerHTML=`${head}<div class="title"><h1>Rest day</h1></div><p class="focus">${T<START?'Day 1 is '+fmtD(START)+'. Training starts then.':'Muscles grow while you rest. No training today; sleep by 23:00 and hit 110 g protein.'}</p>
      <div class="chips"><span class="chip">Still recovering <b>${fresh.length}</b></span>${nx?`<span class="chip">Next <b>${DOW[nx.getDay()]}</b> ${esc(SESS[sessionFor(nx)].n)}</span>`:''}<span class="chip">${esc(PH.n)}</span></div>
      ${weekStrip()}${nudge}${nx?preview(nx):''}`;return}
  const S0=SESS[SID],B=blocksFor(SID,T),tm=timing(SID,T,trainingWeek(T)),done=todaySets(),tot=B.reduce((a,[ex,r])=>a+ex.length*r,0),dn=Math.min(tot,B.reduce((a,[ex,r])=>a+ex.reduce((b,e)=>b+Math.min(r,done[e]||0),0),0));
  const C=2*Math.PI*31,off=C*(1-Math.min(1,dn/tot)),fin=dayDone(S,TK),firstTest=S0.test&&!Object.values(S.chal).some(c=>c&&c.d&&c.d<TK);
  const rows=B.map(([ex,r,rest],bi)=>`<div class="blk"><div class="blk-h"><span class="k">${S0.test?'Test':ex.length>1?'Superset '+'ABCDEFG'[bi]:'Block '+'ABCDEFG'[bi]}</span><span class="k">× ${r}</span><span>${S0.test?'one max set':r===1?'one round':ex.length>1?`rest ${rest} s after each round`:`rest ${rest} s`}</span></div>${ex.map((e,i)=>{const x=EX[e],sh=lastSession(S,e,TK),ls=ladderState(e);
      const tg=e==='neck'&&x.iso&&trainingWeek(T)<=x.iso.weeks?'4 × 15 s holds':x.kind==='test'?(e==='t_plank'?'max hold':'max'):x.kind==='hold'?`${x.rng[0]}–${x.rng[1]} s${x.uni?' / side':''}`:`${x.rng[0]}–${x.rng[1]}${x.uni?' / side':''}`;
      return `<div class="ex" data-ex="${e}"><span class="ab">${ex.length>1?'ABCDEFG'[bi]+(i+1):'ABCDEFG'[bi]}</span><div style="min-width:0"><div class="nm">${esc(x.n)}</div><div class="vr">${esc(x.lad?x.lad[lv(e)]:x.cue)}</div>${S0.test?'':`<div class="dots">${Array.from({length:r},(_,k)=>`<i class="${k<(done[e]||0)?'f':''}"></i>`).join('')}</div>`}
        ${ls==='up'?`<button class="lvup" data-lv="${e}|1">${ICON.up} Top of the range twice: move up a rung</button>`:ls==='down'?`<button class="lvup dn" data-lv="${e}|-1">${ICON.down} Under the range twice: step back a rung</button>`:''}</div>
        <div class="tg">${tg}${x.kind==='test'?`<small>${esc(testLast(e))}</small>`:sh.length?`<small>last ${sh.map(l=>l.reps??l.secs).join(' · ')}</small>`:''}</div></div>`}).join('')}</div>`).join('');
  el.innerHTML=`${head}<div class="title"><h1${S0.n.length>14||firstTest?' class="long"':''}>${esc(firstTest?'First monthly challenge':S0.n)}${DL&&!S0.test?' <span class="dl">Deload</span>':''}</h1><div class="ring" role="img" aria-label="${dn} of ${tot} sets done"><svg viewBox="0 0 70 70"><circle class="b" cx="35" cy="35" r="31"/><circle class="f" cx="35" cy="35" r="31" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg><b>${dn}/${tot}</b><small>sets</small></div></div>
    <div class="focus">${esc(firstTest?'Max push-ups, pull-ups, plank and squats against your 18 Nov test':S0.focus)}</div>
    <div class="chips"><span class="chip${!dn&&slotPassed()?'':' now'}">${slotOf(T)}${!dn&&slotPassed()&&!fin?' · slot passed, train when you can':''}</span><span class="chip"><b>${Math.round(tm.total/60)} min</b> planned</span>${S0.test?'<span class="chip">Max effort</span>':`<span class="chip">RIR <b>${DL?'3':PH.rir}</b></span>`}<span class="chip">${esc(PH.n)}</span></div>
    <button class="btn ${fin||dn>=tot?'':'pri '}start" id="woGo"${fin?' disabled aria-disabled="true"':''}>${fin?ICON.ok:ICON.play} ${fin?'Done for today':dn?'Continue session':S0.test?'Start the challenge':'Start session'}</button>${weekStrip()}${nudge}${rows}`;
  $('#woGo').addEventListener('click',()=>openSession());
  el.querySelectorAll('.lvup').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();const [e,d]=b.dataset.lv.split('|');setLevel(e,lv(e)+(+d))}));
  el.querySelectorAll('.ex').forEach(r=>r.addEventListener('click',()=>{const m=Object.entries(EX[r.dataset.ex].m).sort((a,b)=>b[1]-a[1])[0][0];selectMuscle(m)}))}
function setLevel(e,step){const x=EX[e];if(!x||!x.lad)return;S.lvl[e]=Math.max(0,Math.min(x.lad.length-1,step));persist();const h=HOST();h.toast&&h.toast(x.n+': '+x.lad[S.lvl[e]]);renderToday();renderStrength();if(SEL)selectMuscle(SEL)}
function preview(d){const id=sessionFor(d);return `<div class="blk"><div class="blk-h"><span class="k">Next · ${DOW[d.getDay()]} ${esc(SESS[id].n)}</span><span>${Math.round(timing(id,d,trainingWeek(d)).total/60)} min planned</span></div>`+blocksFor(id,d).flatMap(([ex,r])=>ex.map(e=>`<div class="ex pv"><span class="ab"></span><div style="min-width:0"><div class="nm">${esc(EX[e].n)}</div><div class="vr">${esc(EX[e].lad?EX[e].lad[lv(e,d)]:EX[e].cue)}</div></div><div class="tg">× ${r}</div></div>`)).join('')+'</div>'}
function slotPassed(){const n=today(),end=slotOf(T).split('–')[1];if(!end)return false;const [h,m]=end.split(':').map(Number);return n.getHours()*60+n.getMinutes()>h*60+m}
function testLast(e){const k={t_push:'push',t_pull:'pull',t_plank:'plank',t_squat:'squat'}[e];const ms=Object.keys(S.chal).sort().filter(m=>m<TK.slice(0,7)&&S.chal[m].d);const m=ms.at(-1);const v=m?S.chal[m][k]:BASE[k];return `${m?'last':'18 Nov'} ${v}${e==='t_plank'?' s':''}`}
function weekStrip(){return `<div class="week" role="list" aria-label="This week">${weekDays(T).map(({d,k,id})=>{const pre=d<START;const st=k===TK?'today':pre?'pre':!id?'rest':dayDone(S,k)?'done':k<TK?'miss':'';
    const code=id?{UA:'U·A',UB:'U·B',UC:'U·C',LA:'L·A',LB:'L·B',LC:'L·C',TEST:'Test',MAINT:'Keep'}[id]:pre?'–':'Rest';
    return `<div class="wd ${st}" role="listitem" aria-label="${DOW[d.getDay()]} ${id?SESS[id].n:pre?'before day 1':'rest'} ${st}"><span>${DOW[d.getDay()].slice(0,1)}</span><b>${code}</b><span class="st">${st==='done'?ICON.ok:st==='miss'?ICON.miss:st==='today'?ICON.dot:''}</span></div>`}).join('')}</div>`}

/* ---------- body map (hologram: plain blue; a clicked muscle is brighter blue) ---------- */
let H=null,SEL=null,holoP=null;
function levels(){return {}}
const fmt=v=>Math.round(v*2)/2;
function legend(){$('#woMapSub').textContent=SID?`Click a muscle to see its exercises. Green dot: today's targets. Numbers: sets this week.`:`Click a muscle to see its exercises. Blue dot: still recovering. Numbers: sets this week.`;
  $('#woLegend').innerHTML=Object.keys(MUSCLES).map(m=>`<button class="mchip ${TGT.has(m)||TGT2.has(m)?'tgt':REC[m].lvl>0.05?'rec':''}${SEL===m?' sel':''}" data-m="${m}" aria-pressed="${SEL===m}"><i></i>${esc(MUSCLES[m].n)} <b>${fmt(WK[m])}</b></button>`).join('');
  $('#woLegend').querySelectorAll('.mchip').forEach(b=>b.addEventListener('click',()=>selectMuscle(SEL===b.dataset.m?null:b.dataset.m)))}
function selectMuscle(m){SEL=m;H&&H.select(m);legend();const p=$('#woMpanel');H&&H.offset&&H.offset(m?0.16:0);if(!m){p.classList.remove('on');return}
  const r=RANGE[m],wk=WK[m],pl=PLAN[m],max=Math.max(r[1],pl)*1.05,rec=REC[m],ex=exercisesFor(m);
  const recTxt=rec.h>200?'Not trained yet this plan':rec.h<48?`Trained ${Math.round(rec.h)} h ago · ${Math.round(100-rec.lvl*100)}% recovered`:`Fully recovered (${Math.round(rec.h/24)} days)`;
  p.innerHTML=`<button class="mclose" aria-label="Close">${ICON.x}</button><span class="k">${TGT.has(m)?'Today’s target':'Muscle'}</span><h3>${esc(MUSCLES[m].full)}</h3>
    <div class="row"><span>Sets this week</span><b>${fmt(wk)} of ${fmt(pl)} planned</b></div><div class="mbar" aria-hidden="true"><s style="left:${r[0]/max*100}%;width:${(r[1]-r[0])/max*100}%"></s><i style="width:${Math.min(100,wk/max*100)}%"></i></div>
    <div class="row"><span>Target range</span><b>${r[0]}–${r[1]} sets</b></div><div class="row"><span>Recovery</span><span style="color:var(--ink)">${recTxt}</span></div>
    <span class="k" style="display:block;margin-top:10px">Exercises and your rung</span><ul>${ex.map(e=>{const n=EX[e].n,st=lv(e),v=EX[e].lad[st],rest=v.startsWith(n)?v.slice(n.length).replace(/^[,\s]+/,''):v;
      return `<li><span class="ln">${esc(n)}${rest?` <span style="color:var(--i3)">· ${esc(rest)}</span>`:''}</span><span class="rung"><button data-lv="${e}|-1" aria-label="${esc(n)}: one rung easier"${st<=0?' disabled':''}>${ICON.prev}</button><b class="num">${st+1}/${EX[e].lad.length}</b><button data-lv="${e}|1" aria-label="${esc(n)}: one rung harder"${st>=EX[e].lad.length-1?' disabled':''}>${ICON.next}</button></span></li>`}).join('')}</ul>`;
  p.classList.add('on');p.querySelector('.mclose').addEventListener('click',()=>selectMuscle(null));
  p.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>{const [e,d]=b.dataset.lv.split('|');setLevel(e,lv(e)+(+d))}))}
async function holo(){const st=$('#woStage');
  try{const {Holo}=await import('./holo.js');H=new Holo(st,{});await H.init()}catch(e){console.warn('Body map: 3D is off on this device.',e);H=null;
    st.insertAdjacentHTML('beforeend',`<div class="nogl"><img src="${silhouette('front')}" alt="Body map, front"><img src="${silhouette('back')}" alt="Body map, back"></div>`);
    st.classList.add('flat');const hn=$('#woHint');if(hn)hn.textContent='3D is off. Tap a muscle name below.';
    $('#woVF').addEventListener('click',()=>{st.classList.remove('backv');pressed('F')});$('#woVB').addEventListener('click',()=>{st.classList.add('backv');pressed('B')});return}
  H.setMuscles(levels(),SEL);H.onPick(m=>{selectMuscle(m);$('#woHint').style.opacity=0});
  $('#woVF').addEventListener('click',()=>{H.view('front');pressed('F')});$('#woVB').addEventListener('click',()=>{H.view('back');pressed('B')});
  watchVisible()}
const pressed=w=>{$('#woVF').setAttribute('aria-pressed',w==='F');$('#woVB').setAttribute('aria-pressed',w==='B')};
/* the 3D loop runs only while the Workout page (or its session) is on screen */
function watchVisible(){const upd=()=>{if(!H)return;const on=document.body.classList.contains('page-wo')||$('#woSess').classList.contains('on');H.paused=!on};
  const mo=new MutationObserver(upd);mo.observe(document.body,{attributes:true,attributeFilter:['class']});mo.observe($('#woSess'),{attributes:true,attributeFilter:['class']});upd()}

/* ---------- strength ---------- */
function spark(vals){if(vals.length<2)return'';const lo=Math.min(...vals),hi=Math.max(...vals),r=hi-lo||1;const P=vals.map((v,i)=>[i/(vals.length-1)*80+2,22-(v-lo)/r*18]);
  return `<svg viewBox="0 0 84 26" aria-hidden="true"><path d="${P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}"/><circle cx="${P.at(-1)[0]}" cy="${P.at(-1)[1]}" r="2"/></svg>`}
function renderStrength(){const lifts=['pullup','dpush','bss','lat'];
  const row=e=>{const x=EX[e],ses={};for(const l of S.logs)if(l.e===e)ses[l.d]=Math.max(ses[l.d]||0,l.reps??l.secs??0);const ks=Object.keys(ses).sort(),vals=ks.slice(-12).map(k=>ses[k]),best=pb(S,e),last=vals.at(-1);
    const isPB=best&&ks.length>1&&best.d===ks.at(-1)&&best.d!==ks[0];
    return `<div class="lift"><div style="min-width:0"><div class="nm">${esc(x.n)}${isPB?'<span class="pb">New best</span>':''}</div><div class="vr">${esc(x.lad[lv(e)])}</div></div>${spark(vals)}<div class="v">${last??'–'}<small>best ${best?best.v:'–'}</small></div></div>`};
  const ms=Object.keys(S.chal).filter(m=>S.chal[m]&&S.chal[m].d).sort(),cur=ms.at(-1),prev=ms.at(-2),C=cur?S.chal[cur]:null,P=prev?S.chal[prev]:BASE;
  const nextTest=[...Array(40).keys()].map(i=>addD(T,i)).find(d=>sessionFor(d)==='TEST');
  const cell=(k,lab,u='')=>{const v=C?C[k]:null,p=P?parseInt(String(P[k])):null;const dlt=v!=null&&p!=null&&!isNaN(p)?v-p:null;return `<div><b>${v??'–'}${u}</b><span>${lab}</span>${dlt!=null?` <em${dlt===0?' style="color:var(--i3)"':dlt<0?' style="color:var(--warn)"':''}>${dlt>0?'+':''}${dlt===0?'same':dlt}</em>`:''}</div>`};
  const when=sessionFor(T)==='TEST'?(C&&C.d===TK?' · done today':' · today'):nextTest?' · next '+fmtD(nextTest):' · challenges pause for the exam months';
  $('#woStr').innerHTML=`<div class="hd"><div><h2>Strength</h2><p class="sub">Best working-set reps in each session</p></div></div>${lifts.map(row).join('')}
    <div class="hd" style="margin-top:14px"><div><h2>Monthly challenge</h2><p class="sub">${C?`${MON[+cur.slice(5)-1]} vs ${prev?MON[+prev.slice(5)-1]:'start (18 Nov)'}`:'Starting test, 18 Nov'}${when}</p></div></div>
    <div class="chal">${C?cell('push','push-ups')+cell('pull','pull-ups')+cell('plank','plank',' s')+cell('squat','squats'):`<div><b>${BASE.push}</b><span>push-ups</span></div><div><b>${BASE.pull}</b><span>pull-ups</span></div><div><b>${BASE.plank} s</b><span>plank</span></div><div><b>${BASE.squat}</b><span>squats</span></div>`}</div>`}

/* ---------- body: weight, BMI, tape, face checklist, photos ---------- */
const FACE=[['water','Water'],['salt','Low salt'],['sleep','Sleep on time'],['skin','Skincare']];
let bodyForm=null,cmpOn=false,cmpA=null,cmpB=null;
function months(){return [...new Set(Object.keys(PHOTOS).map(k=>k.slice(0,7)))].sort()}
function renderBody(){const W=S.weights.slice().sort((a,b)=>a.d<b.d?-1:1),last=W.at(-1),first=W[0],bmi=last?(last.w/1.83/1.83):0;
  const two=W.filter(x=>x.d>ymd(addD(T,-15))),gain=two.length>=2?two.at(-1).w-two[0].w:null;
  const note=gain==null?'Weigh in every Monday morning, before breakfast.':gain<0.1?`<b>No gain in 2 weeks.</b> Add about 300 kcal a day (a glass of milk and a handful of peanuts).`:`Last 2 weeks: +${(gain/2).toFixed(2)} kg a week. <b>On track</b> for a lean gain.`;
  const vals=W.slice(-14).map(x=>x.w),lo=Math.min(...vals)-0.2,hi=Math.max(...vals)+0.2,P=vals.map((v,i)=>[i/(vals.length-1||1)*300,52-(v-lo)/(hi-lo)*46]);
  const tp=S.tape.slice().sort((a,b)=>a.d<b.d?-1:1),tl=tp.at(-1);
  const tc=(k,l)=>{const v=tl&&tl[k]!=null?tl[k]:null,f=tp.find(x=>x[k]!=null),dv=v!=null&&f&&f!==tl?v-f[k]:null;return `<div>${l}<b>${v??'–'}</b><em>${dv!=null?((dv>=0?'+':'')+dv.toFixed(1)+' cm'):v!=null?'cm':'monthly'}</em></div>`};
  const face=S.face[TK]||[],ms=months(),pm=ms.at(-1),mk=TK.slice(0,7);
  const tile=v=>{const src=pm&&PHOTOS[photoKey(pm,v)];return `<button class="ph${src?' has':''}" data-ph="${v}" aria-label="${v} photo${src?', '+MON[+pm.slice(5)-1]+'. Tap to replace this month':'. Tap to add'}"><img src="${src||silhouette(v)}" alt="" draggable="false"><span>${v[0].toUpperCase()+v.slice(1)} · ${src?MON[+pm.slice(5)-1]:'add'}</span></button>`};
  const fronts=ms.filter(m=>PHOTOS[m]);if(cmpOn&&fronts.length<2)cmpOn=false;if(!fronts.includes(cmpA))cmpA=fronts[0];if(!fronts.includes(cmpB))cmpB=fronts.at(-1);
  const opt=s=>fronts.map(m=>`<option value="${m}"${m===s?' selected':''}>${MON[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join('');
  $('#woBody').innerHTML=`<div class="hd"><div><h2>Body</h2><p class="sub">Weekly weigh-in · 183 cm</p></div><span class="sp"></span><div class="wbb"><button class="btn ghost wsm" data-bf="w" aria-expanded="${bodyForm==='w'}">Log weight</button><button class="btn ghost wsm" data-bf="t" aria-expanded="${bodyForm==='t'}">Tape</button></div></div>
    ${bodyForm==='w'?`<form class="bform" data-f="w"><label>Weight today (kg)<input name="w" type="number" step="0.1" min="30" max="150" inputmode="decimal" required value="${(S.weights.find(x=>x.d===TK)||{}).w??''}"></label><button class="btn pri wsm" type="submit">Save</button><button class="btn ghost wsm" type="button" data-bf="">Cancel</button></form>`:''}
    ${bodyForm==='t'?`<form class="bform" data-f="t">${['waist','arm','chest','neck'].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} (cm)<input name="${k}" type="number" step="0.5" min="10" max="200" inputmode="decimal" value="${tl&&tl.d===TK&&tl[k]!=null?tl[k]:''}"></label>`).join('')}<button class="btn pri wsm" type="submit">Save</button><button class="btn ghost wsm" type="button" data-bf="">Cancel</button></form>`:''}
    <div class="bstats"><div><b>${last?last.w:'–'}</b><span>kg now</span></div><div><b>${last&&first&&W.length>1?((last.w-first.w>=0?'+':'')+(last.w-first.w).toFixed(1)):'–'}</b><span>${first&&W.length>1?'kg since '+fmtK(first.d):'kg change'}</span></div><div><b>${bmi?bmi.toFixed(1):'–'}</b><span>BMI</span></div></div>
    ${P.length<2?'':`<svg class="wchart" viewBox="0 0 300 56" preserveAspectRatio="none" aria-label="Weight trend"><defs><linearGradient id="woWg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9fe3ff" stop-opacity=".22"/><stop offset="1" stop-color="#9fe3ff" stop-opacity="0"/></linearGradient></defs>
      <path class="a" d="M0 56 ${P.map(p=>'L'+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')} L300 56Z"/><path class="l" d="${P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}"/></svg>`}
    <p class="note">${note}</p>
    <div class="tape">${tc('waist','Waist')}${tc('arm','Arm')}${tc('chest','Chest')}${tc('neck','Neck')}</div>
    <div class="face" role="group" aria-label="Face today"><span class="k">Face today</span>${FACE.map(([k,n])=>`<button data-face="${k}" aria-pressed="${face.includes(k)}"><i></i>${n}</button>`).join('')}</div>
    <div class="phh"><span class="k">Photos${pm?' · '+MON[+pm.slice(5)-1]+' '+pm.slice(0,4):''}</span><span class="sp"></span>${fronts.length>=2?`<button class="btn ghost wsm" id="woCmpBtn" aria-pressed="${cmpOn}">${cmpOn?'Show photos':'Compare months'}</button>`:''}</div>
    ${cmpOn?`<div class="cmp" style="--x:50%"><img src="${PHOTOS[cmpA]}" alt="Front photo, ${cmpA}"><img class="after" src="${PHOTOS[cmpB]}" alt="Front photo, ${cmpB}"><i class="hdl"></i><span class="lbl a">${MON[+cmpA.slice(5)-1]}</span><span class="lbl b">${MON[+cmpB.slice(5)-1]}</span></div>
      <input class="cmpr" type="range" min="0" max="100" value="50" aria-label="Slide between the two photos"><div class="cmpc">Compare <select data-c="a" aria-label="Before">${opt(cmpA)}</select> with <select data-c="b" aria-label="After">${opt(cmpB)}</select></div>`
      :`<div class="photos">${['front','side','back'].map(tile).join('')}</div><p class="note wsm">${pm===mk?'This month is in. Same spot, same light next month.':'Add this month’s photos: same spot, same light, once a month.'}</p>`}
    <input type="file" accept="image/*" id="woPhIn" hidden>`;
  const B=$('#woBody');
  B.querySelectorAll('[data-bf]').forEach(b=>b.addEventListener('click',()=>{bodyForm=b.dataset.bf&&bodyForm!==b.dataset.bf?b.dataset.bf:null;renderBody();const i=B.querySelector('.bform input');i&&i.focus()}));
  const f=B.querySelector('.bform');f&&f.addEventListener('submit',ev=>{ev.preventDefault();const fd=new FormData(f);
    if(f.dataset.f==='w'){const v=parseFloat(fd.get('w'));if(!(v>30&&v<150))return;S.weights=S.weights.filter(x=>x.d!==TK);S.weights.push({d:TK,w:Math.round(v*10)/10})}
    else{const o={d:TK};let ok=0;for(const k of ['waist','arm','chest','neck']){const v=parseFloat(fd.get(k));if(v>0){o[k]=v;ok=1}}if(!ok)return;const prev=S.tape.filter(x=>x.d!==TK).sort((a,b)=>a.d<b.d?-1:1).at(-1)||{};
      for(const k of ['waist','arm','chest','neck'])if(o[k]==null&&prev[k]!=null)o[k]=prev[k];S.tape=S.tape.filter(x=>x.d!==TK);S.tape.push(o)}
    persist();bodyForm=null;renderBody()});
  B.querySelectorAll('[data-face]').forEach(b=>b.addEventListener('click',()=>{const a=S.face[TK]=S.face[TK]||[],k=b.dataset.face,i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.push(k);persist();b.setAttribute('aria-pressed',i<0)}));
  let view='front';const inp=$('#woPhIn');
  B.querySelectorAll('[data-ph]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.ph;inp.click()}));
  inp.addEventListener('change',()=>{const fl=inp.files[0];if(!fl)return;const img=new Image(),u=URL.createObjectURL(fl);
    img.onload=()=>{const sc=Math.min(1,600/img.height),cv=document.createElement('canvas');cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      const key=photoKey(mk,view),prev=PHOTOS[key];PHOTOS[key]=cv.toDataURL('image/jpeg',.72);
      if(!savePhotos(PHOTOS)){if(prev)PHOTOS[key]=prev;else delete PHOTOS[key];const h=HOST();h.toast&&h.toast('Storage is full, so the photo was not saved. Make a backup, then try a smaller picture.')}
      URL.revokeObjectURL(u);renderBody()};img.onerror=()=>URL.revokeObjectURL(u);img.src=u;inp.value=''});
  const cb=$('#woCmpBtn');cb&&cb.addEventListener('click',()=>{cmpOn=!cmpOn;renderBody()});
  const rg=B.querySelector('.cmpr');rg&&rg.addEventListener('input',()=>B.querySelector('.cmp').style.setProperty('--x',rg.value+'%'));
  B.querySelectorAll('[data-c]').forEach(s=>s.addEventListener('change',()=>{if(s.dataset.c==='a')cmpA=s.value;else cmpB=s.value;renderBody()}))}

/* ---------- protein ---------- */
function renderProt(){const g=protein(S,TK),L=S.protein[TK]||[],cnt={};L.forEach(f=>cnt[f]=(cnt[f]||0)+1);
  $('#woProt').innerHTML=`<div class="hd"><div><h2>Protein today</h2><p class="sub">Tap what you ate. No soya.</p></div><span class="sp"></span><button class="btn ghost wsm" id="woPUndo" ${L.length?'':'disabled'}>Undo</button></div>
    <div class="pnum"><b class="num">${g}</b><span>of 110 g</span><span class="sp"></span><em style="color:${g>=110?'var(--acc)':'var(--i2)'}">${g>=110?'Target hit':(110-g)+' g to go'}</em></div>
    <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="110" aria-valuenow="${g}" aria-label="Protein today"><i style="width:${Math.min(100,g/110*100)}%"></i></div>
    <div class="foods">${FOODS.map(([id,n,p])=>`<button class="food" data-f="${id}">${esc(n)} <b>${p} g</b>${cnt[id]?`<span class="c">×${cnt[id]}</span>`:''}</button>`).join('')}</div>
    <p class="note wsm">About 2,700–2,800 kcal a day to gain. No rise in 2 weeks: add about 300.</p>`;
  $('#woProt').querySelectorAll('.food').forEach(b=>b.addEventListener('click',()=>{(S.protein[TK]||(S.protein[TK]=[])).push(b.dataset.f);persist();renderProt()}));
  const u=$('#woPUndo');u&&u.addEventListener('click',()=>{(S.protein[TK]||[]).pop();persist();renderProt()})}

/* ---------- session ---------- */
let sessOpen=false;
async function openSession(){if(!SID||sessOpen)return;sessOpen=true;try{await holoP}catch(e){}const m=await import('./session.js');
  m.start({S,T,TK,SID,H,save:persist,onFinish:dk=>{try{return !!(HOST().tickRoutine&&HOST().tickRoutine(dk))}catch(e){return false}},
    onExit:()=>{sessOpen=false;H&&H.mount($('#woStage'));H&&H.pose(null);H&&H.setMuscles(levels(),SEL);refresh()}})}

/* ---------- page ---------- */
const SKEL=`<div class="wrap">
  <div class="col"><section class="pl today" id="woToday" aria-label="Today's session"></section></div>
  <div class="col"><section class="pl holo" aria-label="Body map">
    <div class="hd"><div><h2>Body map</h2><p class="sub" id="woMapSub"></p></div><span class="sp"></span>
      <div class="seg" role="group" aria-label="View"><button id="woVF" aria-pressed="true">Front</button><button id="woVB" aria-pressed="false">Back</button></div></div>
    <div class="stage" id="woStage"><div class="glow"></div><div class="hint" id="woHint">Drag to turn. Scroll to zoom. Click a muscle.</div>
      <div class="mpanel" id="woMpanel" role="region" aria-live="polite"></div></div>
    <div class="legend" id="woLegend" role="group" aria-label="Muscles"></div></section></div>
  <div class="col">
    <section class="pl" id="woStr" aria-label="Strength and monthly challenge"></section>
    <section class="pl" id="woBody" aria-label="Body"></section>
    <section class="pl" id="woProt" aria-label="Protein today"></section></div></div>`;
function refresh(){state();const pl=$('#phaseLine');if(pl)pl.textContent=PH.n+'. '+PH.note;
  renderToday();legend();renderStrength();renderBody();renderProt();if(SEL)selectMuscle(SEL)}
let built=false;
export function render(){const root=$('#woRoot');if(!root)return;
  if(!built){built=true;root.innerHTML=SKEL;const pg=$('#woPage');pg.classList.add('enter');refresh();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{pg.classList.remove('enter');pg.querySelectorAll('.pl').forEach((p,i)=>{p.style.transitionDelay=(i*60)+'ms'})}));
    holoP=holo();return holoP}
  if(!sessOpen)refresh()}
/* test copies only (zz-*.html set window.__WO_TEST before the app loads); nothing here runs in the real app */
if(window.__WO_TEST)window.__wo={refresh,openSession,selectMuscle,get H(){return H},get S(){return S},holo:()=>holoP};
