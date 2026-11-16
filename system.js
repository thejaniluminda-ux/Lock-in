/* Lock In · Shadow Protocol (Phase 1: engine, mode switch, Signal home).
   Reads the app's existing data; never writes to it. Its own state: lockin-system-v1 (sleep and phone check-ins,
   seen rank, message counts, intervention log) and lockin-profile-v1 (his own words and target, typed in the app,
   never in this file). Mode lives in lockin-mode-v1. All three are lockin-* keys, so backup/restore includes them.
   XP is recalculated from the data every time (nothing is stored), so ticking then unticking gives exactly zero. */
(()=>{
'use strict';
const SK='lockin-system-v1',PK='lockin-profile-v1',MK='lockin-mode-v1';
const rd=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch(e){return d}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let SYS=Object.assign({v:1,sleep:{},phone:{},seenRank:null,seenL:null,started:null,msg:{},log:[],off:{},ses:{},radio:{},mbSnap:{},mbFix:{},misSeen:{}},rd(SK,{}));
const saveSys=()=>{if(SYS.log.length>400)SYS.log=SYS.log.slice(-400);wr(SK,SYS)};
const prof=()=>Object.assign({why:'',line:'',course:'',faculty:'',z:''},rd(PK,{}));
const p2=n=>String(n).padStart(2,'0'),dk=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const esc2=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const M3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=m=>`${p2(Math.floor(m/60)%24)}:${p2(m%60)}`;
const now=()=>new Date(),nowMin=()=>{const n=now();return n.getHours()*60+n.getMinutes()},todayK=()=>dk(now());
const isShadow=()=>document.documentElement.classList.contains('shadow');
const logI=(type,extra)=>{SYS.log.push(Object.assign({type,t:Date.now()},extra||{}));saveSys()};

/* ---------- XP engine (design section D). Every number below is the design table. ---------- */
const XP={blockPerMin:1/6,dayCapMin:480,mib:20,focusPerMin:0.6,question:3,retest:12,mastered:30,paper:120,mock:60,workout:30,mini:15,review:10,sleep:15,confused:8};
const RANKS=[[1,'Dormant'],[2,'Stirring'],[3,'Watcher'],[4,'Seeker'],[5,'Initiate'],[10,'Operator'],[20,'Specialist'],[30,'Vanguard'],[40,'Phantom'],[50,'Sovereign'],[60,'Apex'],[75,'Singular']];
const study=e=>e&&e.kind!=='life'&&e.kind!=='review';
/* most important block: a paper beats a class beats a unit study block; then the longest; then the earliest */
function mib(day){const w=e=>e.kind==='paper'?3:e.kind==='class'?2:e.unit?1:0;
  return (CS.days[day]||[]).filter(e=>study(e)&&w(e)>0).sort((a,b)=>(w(b)-w(a))||((b.e-b.s)-(a.e-a.s))||a.s-b.s)[0]||null}
function ledger(){const ev=[],put=(cat,d,x,why)=>{if(x>0)ev.push({cat,d,x,why})},tk=todayK(),st=dk(START);
  for(const d in CS.days){if(d>tk||d<st)continue;let m=0;
    for(const e of CS.days[d])if(e.done&&study(e)){const take=Math.min(e.e-e.s,XP.dayCapMin-m);if(take>0){m+=take;put('blocks',d,take*XP.blockPerMin)}}
    const b=mib(d);if(b&&b.done)put('mib',d,XP.mib)}
  for(const d in (FO.log||{}))if(d<=tk)put('focus',d,(FO.log[d].min||0)*XP.focusPerMin);
  const seen=new Set();for(const q of [...qlGet()].reverse()){if(seen.has(q.id))continue;seen.add(q.id);put('questions',dk(new Date(q.t)),XP.question)}
  const mocks={};for(const q of qlGet())if(q.mock)mocks[q.t]=1;for(const t in mocks)put('mocks',dk(new Date(+t)),XP.mock);
  for(const m of MB){const d=m.at||tk;put('retests',d,(m.st||0)*XP.retest);if(m.ok)put('mastered',d,XP.mastered)}
  for(const k in (PP.score||{})){const l=(PP.log||[]).find(x=>x.k===k);put('papers',l&&l.t?String(l.t).slice(0,10):tk,XP.paper)}
  const W=rd('lockin-workout-v1',{extra:{}});for(const d in (W.extra||{})){const x=W.extra[d];if(x&&x.done!=null&&d<=tk)put('workouts',d,x.mini?XP.mini:XP.workout)}
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('lockin-review-')){const d=k.slice(14);if(d<=tk)put('reviews',d,XP.review)}}
  for(const d in SYS.sleep)if(['early','ontime'].includes(SYS.sleep[d].b))put('sleep',d,XP.sleep);
  for(const c of CF)if(c.ok)put('confused',c.d||tk,XP.confused);
  return ev}
function levelOf(xp){let L=1,c=0;while(c+300+30*L<=xp){c+=300+30*L;L++}return{L,into:xp-c,need:300+30*L}}
const rankOf=L=>RANKS.filter(r=>L>=r[0]).at(-1)[1];
function totals(){const ev=ledger(),tot=ev.reduce((a,e)=>a+e.x,0),tk=todayK(),mon=dk(add(now(),-((now().getDay()+6)%7))),lastMon=dk(add(now(),-((now().getDay()+6)%7)-7));
  const sum=f=>Math.round(ev.filter(f).reduce((a,e)=>a+e.x,0));
  return{tot:Math.round(tot),today:sum(e=>e.d===tk),week:sum(e=>e.d>=mon),lastWeek:sum(e=>e.d>=lastMon&&e.d<mon),ev}}

/* ---------- Trajectory: plan pace vs current pace for classes (design C). Honest both ways, never an exam prediction. ---------- */
function trajectory(sj){const tk=todayK(),from14=dk(add(now(),-14));let total=0,due=0,done=0,due14=0,done14=0,last=null;
  for(const d of Object.keys(CS.days).sort())for(const e of CS.days[d]){if(e.kind!=='class'||e.subj!==sj||e.fixed)continue;total++;last=d;if(d<=tk){due++;if(e.done)done++;if(d>from14){due14++;if(e.done)done14++}}}
  const daysIn=Math.max(0,Math.round((now()-START)/864e5));
  if(daysIn<7)return{sj,total,due,done,last,msg:`Needs 7 days of data (day ${daysIn+1}). Plan: ${due} of ${total} classes due so far.`,state:'wait'};
  const rate=done14/14;if(rate<=0)return{sj,total,due,done,last,msg:`No classes ticked in 14 days. At zero pace, nothing finishes.`,state:'behind'};
  const fin=add(now(),Math.ceil((total-done)/rate)),lastD=new Date(last+'T00:00'),gap=Math.round((fin-lastD)/864e5);
  return{sj,total,due,done,last,fin,gap,state:gap>3?'behind':gap<-3?'ahead':'on',msg:`At this pace: ${fin.getDate()} ${M3[fin.getMonth()]}. Plan: ${lastD.getDate()} ${M3[lastD.getMonth()]}. ${gap>3?gap+' days late.':gap<-3?(-gap)+' days early.':'On plan.'}`}}

/* ---------- The Record: identity evidence from real data (design C) ---------- */
function record(){const R=[],tk=todayK();let blocks=0,classes=0;for(const d in CS.days)if(d<=tk)for(const e of CS.days[d])if(e.done&&study(e)){blocks++;if(e.kind==='class')classes++}
  const W=rd('lockin-workout-v1',{extra:{}}),wo=Object.values(W.extra||{}).filter(x=>x&&x.done!=null).length;
  const sleepOk=Object.values(SYS.sleep).filter(s=>['early','ontime'].includes(s.b)).length,phoneOk=Object.values(SYS.phone).filter(p=>p.night&&p.morning===true).length;
  const ONE={'focus sessions':'focus session','classes':'class','study blocks':'study block','nights':'night','mistakes':'mistake','past-paper questions':'past-paper question','full papers':'full paper','workouts':'workout'};
  const fx=(n,s)=>{if(n<=0)return;if(n===1)for(const k in ONE)if(s.startsWith(k)){s=ONE[k]+s.slice(k.length);break}R.push([n,s])};
  fx(FO.sessions||0,'focus sessions finished');fx(classes,'classes completed');fx(blocks,'study blocks done');fx(sleepOk,'nights asleep by 23:30');fx(phoneOk,'nights the phone stayed out');
  fx(MB.filter(m=>m.ok).length,'mistakes fixed for good');fx(new Set(qlGet().map(q=>q.id)).size,'past-paper questions done');fx(Object.keys(PP.score||{}).length,'full papers marked');fx(wo,'workouts finished');
  return R}

/* ---------- Missions: three a day, from today's routine (design E) ---------- */
function missions(){const tk=todayK(),L=CS.days[tk]||[],out=[],b=mib(tk);if(new Date(tk+"T00:00")>EXAM_END)return out;
  if(b)out.push({t:'Most important block',s:b.title,done:!!b.done,mib:1});
  try{let best=null;for(const sj of ['chem','phy']){const last=mqLast();for(const g of mqGroups(sj)){const m=mqMast(sj,g,last),gain=g.per*(1-m.m);if(!best||gain>best.gain)best={sj,g,gain}}}
    if(best){const ids=new Set(mqQs(best.sj,best.g).map(q=>q.id)),n=new Set(qlGet().filter(q=>ids.has(q.id)&&dk(new Date(q.t))===tk).map(q=>q.id)).size;
      out.push({t:'Practice',s:`Log 10 ${MQN[best.g.k]||best.g.k} questions (Papers)`,done:n>=10,prog:Math.min(n,10)+'/10'})}}catch(e){}
  const wo=L.find(e=>e.title==='Workout'),W=rd('lockin-workout-v1',{extra:{}}),woDone=(W.extra[tk]&&W.extra[tk].done!=null)||(wo&&wo.done);
  if(wo)out.push({t:'Body',s:`Workout at ${hm(wo.s)}`,done:!!woDone});
  else out.push({t:'Sleep',s:'Asleep by 23:30 tonight (answer tomorrow morning)',done:false});
  return out.slice(0,3)}

/* ---------- Baku the analyst: few words, rate-limited (max 4 lines a day, his own line max once a day) ---------- */
function say(type,text){if(SYS.off[type])return null;const tk=todayK(),M=SYS.msg[tk]||(SYS.msg={[tk]:{n:0,why:0}})[tk];
  if(type==='why'){if(M.why>=1)return null;M.why++}else if(M.n>=4)return null;else M.n++;logI('say:'+type);(SYS.radio[tk]||(SYS.radio[tk]=[])).push({t:hm(nowMin()),text});SYS.lastSay=Date.now();saveSys();return text}
/* first day he actually used the app: earliest of first Shadow launch, any ticked block, focus log, logged question */
function firstUse(){let f=SYS.started&&SYS.started.d||todayK();const st=dk(START),lo=d=>{if(d&&d>=st&&d<f)f=d};
  for(const d in CS.days)if(CS.days[d].some(e=>e.done&&study(e)))lo(d);for(const d in (FO.log||{}))if((FO.log[d].min||0)>0)lo(d);
  for(const q of qlGet())lo(dk(new Date(q.t)));return f}
/* a missed day = he was already using the app, study was planned, nothing was done */
const missedDay=(d,fu)=>{const L=CS.days[d]||[];return d>=fu&&L.filter(study).length>0&&!L.some(e=>e.done&&study(e))};
function bakuLine(){const tk=todayK(),y=dk(add(now(),-1)),Y=CS.days[y]||[],planned=Y.filter(study).length,fu=firstUse();
  const y2=dk(add(now(),-2)),inFirstWeek=(new Date(tk+'T00:00')-new Date(fu+'T00:00'))/864e5<7,missed2=!inFirstWeek&&missedDay(y2,fu);
  const cached=SYS.line&&SYS.line.d===tk?SYS.line:null;if(cached)return cached.text;let text=null;
  if(missedDay(y,fu)){text=missed2?say('restart','Two days down. Restart small: 25 minutes on the most important block. Nothing else.'):say('missed',`Yesterday: 0 of ${planned}. Today: here is what is due.`);
    const P=prof();if(P.line){const w=say('why',P.line);if(w)text=(text?text+' ':'')+'“'+w+'”'}}
  else if(now()>=EXAM)text=null;
  else{const b=mib(tk);const ok=Object.values(SYS.sleep).slice(-4).filter(s=>['early','ontime'].includes(s.b)).length;
    text=say('wake',b?`Day ${dayNo()}. Today: ${b.title.replace(/^[^:]*: /,'')}. That's the one.`:`Day ${dayNo()}. No study blocks today.`)}
  SYS.line={d:tk,text};saveSys();return text}
const EXAM_END=new Date(2027,7,28);
const phase=()=>{const n=now(),t=new Date(todayK()+"T00:00");if(t>EXAM_END)return "Exam over · the record stands";if(n>=EXAM)return "Exam period · day "+(Math.round((t-EXAM)/864e5)+1)+" of 26";return `Day ${dayNo()} of ${daysTotal()} · ${Math.ceil((EXAM-n)/864e5)} days to the exam`};
const dayNo=()=>Math.max(1,Math.round((new Date(todayK()+'T00:00')-START)/864e5)+1);
const daysTotal=()=>Math.round((EXAM-START)/864e5);

/* ---------- check-ins: sleep time (morning), phone out (22:30), confirmed next morning ---------- */
const SLEEP=[['early','Before 23:00'],['ontime','23:00–23:30'],['late','23:30–00:30'],['vlate','00:30–02:00'],['xlate','After 02:00']];
function checks(){const m=nowMin(),tk=todayK(),y=dk(add(now(),-1)),out=[];
  if(m>=240&&m<840&&y>=dk(add(START,-1))&&!SYS.sleep[y])out.push(`<div class="sh-chk"><b>What time did you fall asleep last night?</b><div class="sh-opts">${SLEEP.map(([k,t])=>`<button data-sleep="${y}|${k}">${t}</button>`).join('')}</div></div>`);
  if(m>=240&&m<840&&SYS.phone[y]&&SYS.phone[y].night&&SYS.phone[y].morning===undefined)out.push(`<div class="sh-chk"><b>Did the phone stay out of the room all night?</b><div class="sh-opts"><button data-phm="${y}|1">Yes</button><button data-phm="${y}|0">No</button></div></div>`);
  if(m>=1350&&!SYS.phone[tk])out.push(`<div class="sh-chk"><b>22:30. Phone out of the room for the night?</b><div class="sh-opts"><button data-phn="${tk}|1">Done, it's out</button><button data-phn="${tk}|0">Not tonight</button></div></div>`);
  return out.join('')}


/* =====================================================================================
   SIGNAL interface (approved design A v3). Accent green only for what matters now:
   the current block, today's missions and XP gained. Everything else neutral grey.
   ===================================================================================== */
const R_M=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const svgI=p=>`<svg viewBox="0 0 24 24">${p}</svg>`;
const ICO={full:svgI('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),x:svgI('<path d="M6 6l12 12M18 6 6 18"/>'),plus:svgI('<path d="M12 5v14M5 12h14"/>'),minus:svgI('<path d="M5 12h14"/>'),
  fit:svgI('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),all:svgI('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')};
const DOW3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const segHtml=(n,f)=>Array.from({length:n},(_,i)=>`<i class="${i<f?'f':''}"></i>`).join('');
const fmH=m=>`${Math.floor(m/60)}:${p2(Math.round(m)%60)}`;
const nextRank=L=>RANKS.find(r=>r[0]>L)||[99,''];
const rankNo=r=>RANKS.findIndex(x=>x[1]===r)+1;

/* ---------- verified focus sessions with their finish time (forward-only: the app stores daily totals) ---------- */
function logSessions(){const tk=todayK(),t=(FO.log||{})[tk];if(!t)return false;const L=SYS.ses[tk]||(SYS.ses[tk]=[]),have=L.length,got=t.n||0;if(got<=have)return false;
  const recMin=L.reduce((a,x)=>a+x[1],0),per=Math.max(1,Math.round(((t.min||0)-recMin)/(got-have)));for(let i=have;i<got;i++)L.push([nowMin(),per]);
  const ks=Object.keys(SYS.ses).sort();while(ks.length>21)delete SYS.ses[ks.shift()];saveSys();return true}
const cumAt=(d,t)=>(SYS.ses[d]||[]).filter(x=>x[0]<=t).reduce((a,x)=>a+x[1],0);
function shadow(){const tk=todayK(),from=dk(add(now(),-7));
  const days=Object.keys(SYS.ses).filter(d=>d<tk&&d>=from&&SYS.ses[d].length).map(d=>({d,tot:cumAt(d,1440)})).sort((a,b)=>b.tot-a.tot).slice(0,3).map(x=>x.d);
  const at=t=>days.length?Math.round(days.reduce((a,d)=>a+cumAt(d,t),0)/days.length):null;
  const right=d=>new Set(qlGet().filter(q=>q.r==='ok'&&dk(new Date(q.t))===d).map(q=>q.id)).size;
  const fixedToday=Math.max(0,MB.reduce((a,m)=>a+(m.st||0)+(m.ok?1:0),0)-(SYS.mbSnap[tk]??0));
  const avg=f=>days.length?Math.round(days.reduce((a,d)=>a+f(d),0)/days.length):null;
  return{days,at,you:cumAt(tk,nowMin()),youTot:((FO.log||{})[tk]||{}).min||0,right:right(tk),shRight:avg(right),fixed:fixedToday,shFixed:avg(d=>SYS.mbFix[d]||0)}}
function snapMB(){const tk=todayK(),sum=MB.reduce((a,m)=>a+(m.st||0)+(m.ok?1:0),0);if(SYS.mbSnap[tk]==null){SYS.mbSnap[tk]=sum;saveSys()}const f=sum-SYS.mbSnap[tk];if(SYS.mbFix[tk]!==f){SYS.mbFix[tk]=f;saveSys()}}

/* ---------- the plan as a graph: real dependencies from the scheduler ---------- */
const isNode=e=>e&&(e.kind==='class'||e.kind==='paper'||(e.kind==='study'&&(e.unit||e.subj==='maths')));
let GALL=null,GSIG='';
function graphAll(){const sig=Object.keys(CS.days).length+'|'+todayK();if(GALL&&GSIG===sig)return GALL;GSIG=sig;
  const list=[];for(const d of Object.keys(CS.days).sort())for(const e of CS.days[d])if(isNode(e))list.push(Object.assign({},e,{date:d,key:d+'#'+e.s}));
  list.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.s-b.s);const byIid={};list.forEach((n,i)=>{n.i=i;if(n.iid)byIid[n.iid]=n});
  const lastClass=(n,f)=>{for(let j=n.i-1;j>=0;j--){const p=list[j];if(p.kind==='class'&&f(p))return p}return null};
  for(const n of list){n.par=[];n.lab={};
    if(n.deps&&n.deps.length){for(const id of n.deps){const p=byIid[id];if(p&&p.i<n.i){n.par.push(p.i);if(p.unit!==n.unit)n.lab[p.i]='builds on'}}}
    else if(n.kind==='class'&&n.subj==='maths'){const p=lastClass(n,p=>p.subj==='maths');if(p)n.par.push(p.i)}
    if(n.kind==='study'){const p=n.unit?lastClass(n,p=>p.unit===n.unit):lastClass(n,p=>p.subj==='maths');if(p){n.par.push(p.i);n.lab[p.i]=n.cons?'consolidate':/^(ප්‍රශ්න|පැරණි)/.test(n.title)?'practice':''}}
    if(/සම්මන්ත්‍රණය/.test(n.title))for(const pi of n.par)n.lab[pi]='unlocks'}
  list.forEach(n=>n.kids=[]);list.forEach(n=>n.par.forEach(pi=>list[pi].kids.push(n.i)));return GALL=list}
function liveDone(n){const L=CS.days[n.date]||[];const e=L.find(x=>x.s===n.s&&x.title===n.title);return !!(e&&e.done)}
function nodeState(n,X){const tk=todayK();if(X&&n.i===X.i)return 'act';if(liveDone(n))return 'done';
  if(n.date<tk||(n.date===tk&&n.e<=nowMin()))return 'miss';const G=graphAll();if(n.par.some(pi=>{const p=G[pi];return !liveDone(p)&&(p.date<tk||(p.date===tk&&p.e<=nowMin()))}))return 'lock';return ''}
function focusNode(){const G=graphAll(),tk=todayK(),m=nowMin(),T=G.filter(n=>n.date===tk);
  return T.find(n=>m>=n.s&&m<n.e&&!liveDone(n))||T.find(n=>n.s>=m&&!liveDone(n))||T.find(n=>!liveDone(n))||G.find(n=>n.date>tk)||null}
const dLab=d=>{const x=new Date(d+'T00:00');return `${DOW3[x.getDay()]} ${x.getDate()}`};
function nodeMeta(n,st){const tk=todayK();const day=n.date===tk?'':dLab(n.date).split(' ')[0]+' ';return `${day}${hm(n.s)}${st==='act'?' · now':st==='miss'?' · missed':''}`}
/* home graph: the current block's chain (2 back, 3 forward) plus today's other blocks */
function homeGraph(maxS=5){const G=graphAll(),X=focusNode();if(!X)return{X:null,cols:[],nodes:[]};const tk=todayK(),pick=new Map(),addN=(n,p)=>{if(n&&!pick.has(n.i)&&pick.size<11)pick.set(n.i,p)};
  addN(X,0);X.par.forEach(pi=>{addN(G[pi],1);G[pi].par.slice(0,1).forEach(pp=>addN(G[pp],3))});
  let c=X;for(let k=0;k<3&&c;k++){const kid=c.kids.map(i=>G[i]).sort((a,b)=>a.i-b.i)[0];addN(kid,2);c=kid}
  G.filter(n=>n.date===tk).forEach(n=>{addN(n,4);n.par.slice(0,1).forEach(pi=>addN(G[pi],5))});
  const slot=n=>n.date===tk?(n.s>=1020?tk+'~2':tk+'~1'):n.date;let nodes=[...pick.keys()].map(i=>G[i]);
  let slots=[...new Set(nodes.map(slot))].sort();const xs=slots.indexOf(slot(X));if(slots.length>maxS){const st=Math.max(0,Math.min(xs-1,slots.length-maxS));slots=slots.slice(st,st+maxS)}
  nodes=nodes.filter(n=>slots.includes(slot(n))).sort((a,b)=>a.i-b.i);const grid={},row={};
  for(const n of nodes){const c=slots.indexOf(slot(n));let r=n.par.map(pi=>row[pi]).find(r=>r!=null&&!grid[c+'_'+r]);if(r==null){r=0;while(grid[c+'_'+r])r++}if(r>3)continue;grid[c+'_'+r]=1;row[n.i]=r;n._c=c;n._r=r}
  nodes=nodes.filter(n=>row[n.i]!=null);
  const cols=slots.map(s=>s===tk+'~1'?'Today':s===tk+'~2'?'Tonight':dLab(s));return{X,cols,nodes,rows:Math.max(1,...nodes.map(n=>n._r+1))}}

/* ---------- box, panels ---------- */
let box=null;const PSIG={};
function setPanel(id,html){const el=box&&box.querySelector('#'+id);if(!el)return;if(PSIG[id]!==html){el.innerHTML=html;PSIG[id]=html;return true}return false}
function shell(){box.innerHTML=`<div class="sx-bar"><div class="sx-crumb">Shadow Protocol / <b>Home</b></div><span class="sx-sp"></span>
    <button class="sx-pill sx-tgt" data-target title="Your target (private)"></button><div class="sx-pill" id="sxDay"></div><div class="sx-pill" id="sxExam"></div><div class="sx-pill"><b id="sxClk"></b></div></div>
  <div class="sx-grid"><div class="sx-col"><section class="sx-pl sx-rk" id="sxRank"></section><section class="sx-pl sx-mis" id="sxMis"></section></div>
    <section class="sx-pl sx-bp"><div class="sx-ph"><div><h3>Blueprint</h3><p>What today builds on, and what it unlocks</p></div><span class="sx-sp"></span><span class="sx-pill sx-unit" id="sxUnit"></span><button class="sx-ib" data-bpopen aria-label="Open the full blueprint">${ICO.full}</button></div>
      <div class="sx-graph" id="sxGraph"><div class="sx-cols" id="sxCols"></div><svg id="sxG"></svg></div>
      <div class="sx-leg"><span><i class="n"></i>now</span><span><i></i>done</span><span><i class="d"></i>ahead</span><span>Hatched = waiting on a missed block</span></div></section>
    <div class="sx-col"><section class="sx-pl" id="sxMast"></section><section class="sx-pl sx-radio" id="sxRadio"></section></div></div>`;for(const k in PSIG)delete PSIG[k]}
function rankHtml(T,lv,rank){const [nl,nr]=nextRank(lv.L),S=shadow(),seg=14,f=Math.floor(lv.into/lv.need*seg);
  let race;if(!S.days.length)race=`<div class="sx-g"><b class="num">${fmH(S.youTot)}</b><span>verified today</span></div><p class="sx-cap">Your shadow is built from your own timed Focus sessions. It appears after your first full day of them.</p>`;
  else{const g=S.you-S.at(nowMin()),W=260,x=t=>((t-360)/(1380-360)*W).toFixed(1),mx=Math.max(60,S.at(1380),S.you)*1.1,y=v=>(38-(v/mx)*36).toFixed(1);
    const pts=t0=>{const o=[];for(let t=360;t<=t0;t+=30)o.push(t);o.push(t0);return o};
    const yl=pts(Math.min(nowMin(),1380)).map((t,i)=>(i?'L':'M')+x(t)+' '+y(cumAt(todayK(),t))).join(' '),sl=pts(1380).map((t,i)=>(i?'L':'M')+x(t)+' '+y(S.at(t))).join(' ');
    race=`<div class="sx-g"><b class="num">${g>=0?'+':'−'}${fmH(Math.abs(g))}</b><span>${g>=0?'ahead of':'behind'} your shadow</span></div>
      <svg viewBox="0 0 ${W} 40" preserveAspectRatio="none"><path class="sl" d="${sl}"/><path class="yl" d="${yl}"/></svg>
      <div class="sx-who"><span>You <b>${fmH(S.you)} h</b></span><span>Shadow <b>${fmH(S.at(nowMin()))} h</b></span></div>`}
  return `<div class="sx-lvl"><b id="sxLvN">${lv.L}</b><div><span>${rank}</span><small>Level ${lv.L} · next rank ${nr} at level ${nl}</small></div></div>
    <div class="sx-segs" id="sxXp">${segHtml(seg,f)}</div><div class="sx-xpr"><span><b>${lv.into}</b> / ${lv.need} XP</span><em>+${T.today} today</em></div>
    <div class="sx-sr"><div class="sx-t"><span>Shadow race</span><small>finished Focus sessions only</small></div>${race}
      <div class="sx-sec"><span>Right answers <b>${S.right}</b>${S.shRight!=null?' vs '+S.shRight:''}</span><span>Mistakes fixed <b>${S.fixed}</b>${S.shFixed!=null?' vs '+S.shFixed:''}</span></div></div>`}
function misHtml(){const M=missions(),tk=todayK(),m=nowMin(),b=mib(tk);if(!M.length)return `<div class="sx-ph"><div><h3>Today's missions</h3><p>The exam is done. Nothing left to prove here.</p></div></div>`;
  const xp=x=>x.mib?XP.mib:x.t==='Practice'?30:x.t==='Body'?XP.workout:XP.sleep;
  return `<div class="sx-ph"><div><h3>Today's missions</h3><p>${M.length} missions · +${M.reduce((a,x)=>a+xp(x),0)} XP available</p></div></div>`+M.map((x,i)=>{let n=8,f=0,a='0',bb='1',r='';
    if(x.mib&&b){n=5;const tot=b.e-b.s,el=x.done?tot:Math.max(0,Math.min(tot,m-b.s));f=Math.floor(el/tot*n);a=fmH(el);bb=fmH(tot)+' h';r=x.done?'Done':m>=b.s&&m<b.e?'Now':hm(b.s)}
    else if(x.prog){n=10;f=parseInt(x.prog);a=String(f);bb='10';r=x.done?'Done':`${10-f} to go`}
    else{f=x.done?n:0;a=x.done?'1':'0';r=x.done?'Done':x.s.match(/\d\d:\d\d/)?.[0]||''}
    const cur=x.mib&&b&&!x.done&&m>=b.s&&m<b.e;
    return `<div class="sx-m${x.done?' ok':i===0?' mib':''}"><div class="sx-mt"><span class="k">${x.t}</span><span class="x">+${xp(x)} XP</span></div><div class="tt${/[\u0D80-\u0DFF]/.test(x.s)?' si':''}">${esc2(x.s)}</div>
      <div class="cnt"><span><b>${a}</b> of ${bb}</span><span>${cur?'<button class="sx-go" data-begin>Begin</button>':r}</span></div><div class="sx-segs sm">${segHtml(n,f)}</div></div>`}).join('')}
function mastHtml(){let G=[];try{const last=mqLast();for(const sj of ['chem','phy'])for(const g of mqGroups(sj)){const m=mqMast(sj,g,last);G.push({k:g.k,n:m.n,m:m.m,gain:g.per*(1-m.m)})}}catch(e){}
  if(!G.length)return `<div class="sx-ph"><div><h3>Mastery</h3><p>Weights file not loaded yet</p></div></div>`;
  const tried=G.filter(g=>g.n>0).sort((a,b)=>a.m-b.m),weak=tried.slice(0,3);for(const g of G.filter(g=>!g.n).sort((a,b)=>b.gain-a.gain))if(weak.length<3)weak.push(g);
  const C=52,rnd=s=>{let x=Math.sin(s)*1e4;return x-Math.floor(x)};let dots='';
  G.forEach((g,i)=>{const a=rnd(i+3)*Math.PI*2,r=g.n?8+(1-g.m)*40:46,X=C+r*Math.cos(a),Y=C+r*Math.sin(a),w=weak.includes(g);dots+=w?`<circle cx="${X}" cy="${Y}" r="4.5" fill="none" stroke="#eceeec" stroke-width="1.2"/><circle cx="${X}" cy="${Y}" r="1.8" fill="#eceeec"/>`:`<circle cx="${X}" cy="${Y}" r="1.8" fill="rgba(236,238,236,${g.n?.6:.25})"/>`});
  return `<div class="sx-ph"><div><h3>Mastery</h3><p>Paper I units · closer to the centre = stronger</p></div></div>
    <div class="sx-rad"><svg viewBox="0 0 104 104"><defs><linearGradient id="sxSw" gradientUnits="userSpaceOnUse" x1="52" y1="52" x2="104" y2="52"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      ${[50,34,18].map(r=>`<circle cx="52" cy="52" r="${r}" fill="none" stroke="rgba(255,255,255,.08)"/>`).join('')}${dots}<g class="sx-sweep"><path d="M52 52 L102 52 A50 50 0 0 0 ${52+50*Math.cos(-.7)} ${52+50*Math.sin(-.7)} Z" fill="url(#sxSw)"/></g></svg>
      <div class="sx-weak"><div class="h">Weakest now</div>${weak.map(g=>`<div><span>${esc2(MQN[g.k]||g.k)}</span><span>${g.n?Math.round(g.m*100)+'%':'untried'}</span></div>`).join('')}</div></div>`}
function radioHtml(){bakuLine();const L=(SYS.radio[todayK()]||[]).slice(-3),n=(SYS.msg[todayK()]||{n:0}).n;
  return `<div class="sx-who2"><div class="av">${typeof bkSvg==='function'?bkSvg('sleepy'):''}</div><div><b>Baku · race engineer</b><small>${n} of 4 messages today</small></div></div>
    <canvas class="sx-wave" id="sxWave"></canvas><div class="sx-tx">${L.length?L.map(l=>`<div><span>${l.t}</span>${esc2(l.text)}</div>`).join(''):'<div class="q">Radio quiet. Nothing to report yet.</div>'}</div>
    <div class="sx-ask">${checks()}</div>`}
/* ---------- home graph drawing ---------- */
let HG=null,flowRaf=0;
function drawGraph(force){const g=box&&box.querySelector('#sxGraph');if(!g||!g.clientWidth)return;const H0=homeGraph(Math.max(3,Math.min(5,Math.floor(g.clientWidth/135))));
  const sig=g.clientWidth+'x'+g.clientHeight+'|'+H0.nodes.map(n=>n.i+':'+nodeState(n,H0.X)).join(',');if(!force&&HG&&HG.sig===sig)return;HG={sig,...H0};
  const unit=H0.X?(H0.X.unit?(String(H0.X.sub||'').split(',')[0]||H0.X.unit):''):'';box.querySelector('#sxUnit').textContent=H0.X?`${SUBJ[H0.X.subj]||''}${H0.X.unit?' · '+unit:''}`:'Nothing scheduled';
  const W=g.clientWidth,H=g.clientHeight,nc=Math.max(1,H0.cols.length),cw=W/nc,rows=HG.rows||1,rh=Math.min(130,(H-60)/Math.max(rows,1)),off=Math.max(34,(H-rh*(rows-1)-80)/2);
  box.querySelector('#sxCols').style.gridTemplateColumns=`repeat(${nc},1fr)`;box.querySelector('#sxCols').innerHTML=H0.cols.map(c=>`<span class="${c==='Today'?'today':''}">${c}</span>`).join('');
  g.querySelectorAll('.sx-nd').forEach(n=>n.remove());const pos={};
  for(const n of H0.nodes){const st=nodeState(n,H0.X),el=document.createElement('div');el.className='sx-nd '+st;el.dataset.i=n.i;const x=n._c*cw+8,y=off+n._r*rh;pos[n.i]=el;
    el.style.left=x+'px';el.style.top=y+'px';el.style.width=(cw-14)+'px';
    el.innerHTML=`<span class="sxp sxl"></span><span class="sxp sxr"></span><small><span>${nodeMeta(n,st)}</span>${st==='done'?'<i>✓</i>':''}</small><b class="si">${esc2(n.title)}</b>${st==='act'?`<div class="pb"><i style="width:${Math.round(Math.max(0,Math.min(1,(nowMin()-n.s)/(n.e-n.s)))*100)}%"></i></div>`:''}`;g.appendChild(el)}
  const gr=g.getBoundingClientRect();let h='',flowI=-1,k=0;
  for(const n of H0.nodes)for(const pi of n.par){if(!pos[pi])continue;const A=pos[pi].getBoundingClientRect(),B=pos[n.i].getBoundingClientRect();let d,x1,y1,x2,y2;
    if(B.left<A.right+10){x1=A.left+A.width/2-gr.left;y1=A.bottom-gr.top;x2=B.left+B.width/2-gr.left;y2=B.top-gr.top;if(y2<y1){y1=A.top-gr.top;y2=B.bottom-gr.top}d=`M${x1} ${y1} C${x1} ${(y1+y2)/2} ${x2} ${(y1+y2)/2} ${x2} ${y2}`}
    else{x1=A.right-gr.left;y1=A.top+A.height/2-gr.top;x2=B.left-gr.left;y2=B.top+B.height/2-gr.top;const dx=Math.max(30,(x2-x1)/2);d=`M${x1} ${y1} C${x1+dx} ${y1} ${x2-dx} ${y2} ${x2} ${y2}`}
    const P=graphAll()[pi],cls=H0.X&&pi===H0.X.i?'now':liveDone(P)&&(liveDone(n)||n.i===H0.X?.i)?'dn':'fut';if(cls==='now'&&flowI<0)flowI=k;
    h+=`<path id="sxE${k}" class="sx-edge ${cls}" d="${d}"/>`;const lab=n.lab[pi];if(lab){const mx=(x1+x2)/2,my=(y1+y2)/2,w=lab.length*6.4+12;h+=`<rect class="sx-elb" x="${mx-w/2}" y="${my-9}" width="${w}" height="18" rx="5"/><text class="sx-elt" x="${mx}" y="${my+4}" text-anchor="middle">${lab}</text>`}k++}
  box.querySelector('#sxG').innerHTML=h+'<circle id="sxFlow" class="sx-flow" r="3"/>';flow(flowI)}
function flow(i){cancelAnimationFrame(flowRaf);const p=box.querySelector('#sxE'+i),c=box.querySelector('#sxFlow');if(!p||!c){c&&c.setAttribute('r',0);return}const L=p.getTotalLength();let t=0;
  const f=()=>{t=(t+.005)%1;const pt=p.getPointAtLength(t*L);c.setAttribute('cx',pt.x);c.setAttribute('cy',pt.y);if(!R_M()&&isShadow()&&!document.body.className.includes('page-'))flowRaf=requestAnimationFrame(f)};f()}
let wt=0,waveRaf=0;function wave(){cancelAnimationFrame(waveRaf);const c=box&&box.querySelector('#sxWave');if(!c||!c.clientWidth)return;const g=c.getContext('2d');if(c.width!==c.clientWidth*2){c.width=c.clientWidth*2;c.height=60}
  const talk=Date.now()-(SYS.lastSay||0)<6000;wt+=.1;g.clearRect(0,0,c.width,c.height);const n=48,w=c.width/n;
  for(let i=0;i<n;i++){const a=talk?.2+.8*Math.abs(Math.sin(wt*1.6+i*.55)*Math.cos(wt*.6+i*.21)):.08+.05*Math.sin(wt*.5+i*.4);g.fillStyle=`rgba(236,238,236,${.25+a*.55})`;const h=a*52;g.fillRect(i*w+1,30-h/2,w-3,h)}
  if(!R_M()&&isShadow()&&!document.body.className.includes('page-'))waveRaf=requestAnimationFrame(wave)}

/* ---------- render ---------- */
const onHome=()=>isShadow()&&!/\bpage-/.test(document.body.className);
function render(force){if(!box||!isShadow()||!onHome())return;if(force||!box.querySelector('.sx-grid'))shell();
  const T=totals(),lv=levelOf(T.tot),rank=rankOf(lv.L),P=prof();
  box.querySelector('#sxDay').innerHTML=new Date(todayK()+'T00:00')>EXAM_END?'Exam over':now()>=EXAM?`Exam day <b>${Math.round((new Date(todayK()+'T00:00')-EXAM)/864e5)+1}</b> / 26`:`Day <b>${dayNo()}</b> / ${daysTotal()}`;
  box.querySelector('#sxExam').innerHTML=now()<EXAM?`A/L in <b>${Math.ceil((EXAM-now())/864e5)}</b> days`:'A/L';box.querySelector('#sxClk').textContent=hm(nowMin());
  box.querySelector('.sx-tgt').innerHTML=P.course?`Target <b>${esc2(P.course)}</b>${P.z?' · Z '+esc2(P.z):' · Z —'}`:'Set your target';
  setPanel('sxRank',rankHtml(T,lv,rank));setPanel('sxMis',misHtml());setPanel('sxMast',mastHtml());if(setPanel('sxRadio',radioHtml()))wave();
  requestAnimationFrame(()=>{drawGraph(force);if(!waveRaf)wave()});events(T,lv,rank)}
/* ---------- moments: mission complete, level-up, rank-up, first launch ---------- */
let queued=[];
function events(T,lv,rank){const tk=todayK(),M=missions(),seen=SYS.misSeen[tk]||(SYS.misSeen[tk]=[]);let ch=false;
  M.forEach((x,i)=>{const id=x.t;if(x.done&&!seen.includes(id)){seen.push(id);ch=true;if(SYS.started)queued.push(d=>missionMoment(i,x,d))}});
  if(!SYS.started){SYS.started={d:tk,L:lv.L,xp:T.tot};SYS.seenL=lv.L;SYS.seenRank=rank;ch=true;queued.push(d=>firstLaunch(lv.L,rank,T.tot,d))}
  else if(SYS.seenL==null){SYS.seenL=lv.L;ch=true}
  else if(lv.L>SYS.seenL){const up=rank!==SYS.seenRank;const from=SYS.seenL;SYS.seenL=lv.L;SYS.seenRank=rank;ch=true;logI(up?'rankup':'levelup',{L:lv.L,rank});queued.push(d=>lvSeq(up,from,lv,rank,d))}
  else if(lv.L<SYS.seenL){SYS.seenL=lv.L;ch=true}
  if(ch)saveSys();playQueue()}
let playing=false;function playQueue(){if(playing||!queued.length||!onHome())return;playing=true;const f=queued.shift();f(()=>{playing=false;setTimeout(playQueue,300)})}
function toast(t,s){const d=document.createElement('div');d.className='sx-toast';d.innerHTML=`<i>✓</i><div><b>${t}</b><small>${s}</small></div>`;document.body.appendChild(d);setTimeout(()=>d.remove(),2900)}
function missionMoment(i,x,done){const ms=box.querySelectorAll('.sx-m'),m=ms[i],xp=box.querySelector('#sxXp');logI('mission',{t:x.t});
  if(x.mib)say('mission','Most important block done. That was the one that counted.');
  const fin=()=>{toast('Mission complete',`${x.t} · +${x.mib?XP.mib:x.t==='Body'?XP.workout:30} XP`);setTimeout(done,600)};
  if(!m||!xp||R_M()){fin();return}const a=m.querySelector('.x').getBoundingClientRect(),b=xp.getBoundingClientRect(),c=document.createElement('div');c.className='sx-chip';c.textContent=m.querySelector('.x').textContent;
  c.style.left=(a.left+a.width/2)+'px';c.style.top=(a.top+a.height/2)+'px';document.body.appendChild(c);
  c.animate([{transform:'translate(-50%,-50%)'},{transform:`translate(calc(${b.left+b.width/2-a.left-a.width/2}px - 50%),calc(${b.top+b.height/2-a.top-a.height/2}px - 50%)) scale(.7)`,opacity:.2}],{duration:800,easing:'cubic-bezier(.6,0,.2,1)'}).onfinish=()=>{c.remove();xp.querySelectorAll('i').forEach(s=>{if(s.classList.contains('f')){s.classList.add('pop');setTimeout(()=>s.classList.remove('pop'),300)}});fin()}}
/* level-up (short) and rank-up (the real moment): one frame clock, under 3 s, click / Esc / Space skips */
function lvSeq(rankUp,from,lv,rank,done){done=done||(()=>{});const o=document.createElement('div');o.className='sx-lv'+(rankUp?' rk':'');const n=48,C=220;let segs='';
  for(let i=0;i<n;i++){const a0=(i/n*360-90+1.6)*Math.PI/180,a1=((i+1)/n*360-90-1.6)*Math.PI/180,r1=210,r2=194;segs+=`<path d="M${C+r1*Math.cos(a0)} ${C+r1*Math.sin(a0)} A${r1} ${r1} 0 0 1 ${C+r1*Math.cos(a1)} ${C+r1*Math.sin(a1)} L${C+r2*Math.cos(a1)} ${C+r2*Math.sin(a1)} A${r2} ${r2} 0 0 0 ${C+r2*Math.cos(a0)} ${C+r2*Math.sin(a0)}Z" fill="rgba(255,255,255,.07)"/>`}
  const [nl,nr]=nextRank(lv.L);
  o.innerHTML=`<div class="sxl-bg"></div><canvas></canvas><div class="sxl-c"><div class="sxl-flash"></div><div class="sxl-shock"></div><div class="sxl-shock"></div><svg class="sxl-ring" viewBox="0 0 440 440">${segs}</svg>
    <div class="sxl-in"><small>${rankUp?'New rank':'Level up'}</small><div class="sxl-odo"><div>${from}<br>${lv.L}</div></div>${rankUp?`<div class="sxl-rkn">${esc2(rank.toUpperCase())}</div><div class="sxl-nx">Rank ${rankNo(rank)} of ${RANKS.length} · next: ${nr} at level ${nl}</div>`:`<div class="sxl-nx">Level ${lv.L} · ${lv.need-lv.into} XP to the next</div>`}</div></div><div class="sxl-skip">Click or press Esc to skip</div>`;
  document.body.appendChild(o);const q=s=>o.querySelector(s),qa=s=>[...o.querySelectorAll(s)],P=qa('svg.sxl-ring path'),odo=q('.sxl-odo div'),bg=q('.sxl-bg'),lab=q('.sxl-in small'),nx=q('.sxl-nx'),rkn=q('.sxl-rkn'),fl=q('.sxl-flash'),sh=qa('.sxl-shock'),cv=q('canvas'),g=cv.getContext('2d');
  cv.width=innerWidth;cv.height=innerHeight;const cx=cv.width/2,cy=cv.height/2;let ps=null;const RM=R_M(),T=RM?1400:rankUp?2800:1700,ring=rankUp?550:420,hit=150+ring,cl=v=>Math.max(0,Math.min(1,v)),eo=v=>1-Math.pow(1-v,3);
  let fin=false,t0=performance.now(),filled=0;
  const end=()=>{if(fin)return;fin=true;removeEventListener('keydown',key);o.style.transition='opacity .22s';o.style.opacity=0;setTimeout(()=>{o.remove();done()},230)};
  const key=e=>{if(e.key==='Escape'||e.key===' '){e.preventDefault();end()}};addEventListener('keydown',key);o.addEventListener('click',end);
  const frame=nw=>{if(fin)return;const t=RM?T:nw-t0;bg.style.opacity=cl(t/200);lab.style.opacity=cl((t-120)/300);
    const want=RM?n:Math.floor(cl((t-150)/ring)*n);for(;filled<want;filled++){P[filled].setAttribute('fill','#7dffa8');P[filled].style.filter='drop-shadow(0 0 5px #7dffa8)'}
    odo.style.transform=`translateY(${-140*eo(cl((t-hit)/500))}px)`;
    if(rankUp){const tf=(t-hit)/650;fl.style.opacity=RM?0:tf<0||tf>1?0:tf<.25?tf/.25:1-(tf-.25)/.75;fl.style.transform=`scale(${.6+.5*cl(tf)})`;
      sh.forEach((s,i)=>{const ts=(t-hit-i*140)/900;s.style.opacity=RM||ts<0||ts>1?0:.9*(1-ts);s.style.transform=`scale(${1+(3+1.5*i)*eo(cl(ts))})`});
      const tr=cl((t-950)/700);rkn.style.opacity=tr;rkn.style.letterSpacing=(0.9-0.64*eo(tr))+'em';rkn.style.textIndent=rkn.style.letterSpacing;rkn.style.filter=`blur(${8*(1-tr)}px)`;rkn.style.setProperty('--sx',(-200+400*cl((t-1450)/800))+'%');nx.style.opacity=cl((t-hit-650)/400);
      if(!RM&&t>=hit&&!ps)ps=Array.from({length:150},()=>{const a=Math.random()*Math.PI*2,v=4+Math.random()*9;return{x:cx+Math.cos(a)*205,y:cy+Math.sin(a)*205,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1}});
      if(ps){g.clearRect(0,0,cv.width,cv.height);for(const p of ps){if(p.l<=0)continue;p.x+=p.vx;p.y+=p.vy;p.vx*=.95;p.vy*=.95;p.l-=.018;g.fillStyle=`rgba(${p.l>.6?'220,255,232':'125,255,168'},${p.l})`;g.fillRect(p.x,p.y,2.2,2.2)}}}
    else{const ts=(t-hit)/700;sh[0].style.opacity=RM||ts<0||ts>1?0:.6*(1-ts);sh[0].style.transform=`scale(${1+1.6*eo(cl(ts))})`;nx.style.opacity=cl((t-hit-250)/400)}
    if(RM){setTimeout(end,T);return}if(t>=T-250){end();return}requestAnimationFrame(frame)};requestAnimationFrame(frame)}
function firstLaunch(L,rank,xp,done){const days=Math.max(1,Math.round((new Date(todayK()+'T00:00')-START)/864e5)+1);logI('first');
  overlay(`<div class="sh-first"><div class="sh-k">Shadow Protocol</div><p>Starting level from ${days} day${days>1?'s':''} of your real history: ${xp} XP.</p><h2>${rank} · Level ${L}</h2><p class="sh-note">Normal mode is still there. The eye icon switches back.</p></div>`,0,done)}
function overlay(html,ms,done){const o=document.createElement('div');o.className='sh-ov';o.innerHTML=html;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  let c=false;const close=()=>{if(c)return;c=true;o.classList.remove('on');setTimeout(()=>{o.remove();done&&done()},300)};o.addEventListener('click',close);if(ms)setTimeout(close,ms);return o}

/* ---------- blueprint full screen: every class, recording and study block, 2 days back to 8 ahead ---------- */
let V={x:0,y:0,k:1},bpEl=null,WW=0,WH=0,FN=[];
const GX=150,DW=232,NW=184,NH=74;
function buildFull(){const G=graphAll(),tk=todayK(),X=focusNode(),d0=dk(add(now(),-2)),d1=dk(add(now(),8)),days=[];for(let i=-2;i<=8;i++)days.push(dk(add(now(),i)));
  const lanes=[['phy','Physics'],['chem','Chemistry'],['maths','Maths'],['paper','Papers']];const nodes=G.filter(n=>n.date>=d0&&n.date<=d1);const rowOf={},cells={};let y=70;const laneY=[];
  for(const [sj,name] of lanes){const L=nodes.filter(n=>(n.subj||'paper')===sj||(sj==='paper'&&n.kind==='paper'));if(!L.length)continue;let maxR=0;
    for(const n of L){const c=days.indexOf(n.date);let r=n.par.map(pi=>rowOf[pi]).find(r=>r!=null&&!cells[sj+c+'_'+r]);if(r==null){r=0;while(cells[sj+c+'_'+r])r++}cells[sj+c+'_'+r]=1;rowOf[n.i]=r;n._fx=GX+c*DW+20;n._fy=y+r*96;maxR=Math.max(maxR,r)}
    laneY.push([name,y]);y+=(maxR+1)*96+56}
  FN=nodes;WW=GX+days.length*DW+60;WH=y+20;return{days,laneY,X,nodes}}
function openFull(){if(bpEl)return;const src=box.querySelector('.sx-bp').getBoundingClientRect(),W=innerWidth,H=innerHeight,F=buildFull(),tk=todayK();
  const o=document.createElement('div');o.className='sx-bpf';bpEl=o;o.setAttribute('role','dialog');o.setAttribute('aria-label','Full blueprint');
  const clip=r=>{o.style.setProperty('--ct',r.top+'px');o.style.setProperty('--cl',r.left+'px');o.style.setProperty('--cr',(W-r.right)+'px');o.style.setProperty('--cb',(H-r.bottom)+'px');o.style.setProperty('--cr2','18px')};clip(src);
  const ids=new Set(F.nodes.map(n=>n.i));let e='';
  for(const n of F.nodes)for(const pi of n.par){if(!ids.has(pi))continue;const A=graphAll()[pi],ax=A._fx,ay=A._fy,bx=n._fx,by=n._fy;let d,x1,y1,x2,y2;
    if(bx<=ax){x1=ax+NW/2;y1=ay+(by>ay?NH:0);x2=bx+NW/2;y2=by+(by>ay?0:NH);const s=by>ay?1:-1;d=`M${x1} ${y1} C${x1} ${y1+30*s} ${x2} ${y2-30*s} ${x2} ${y2}`}
    else{x1=ax+NW;y1=ay+NH/2;x2=bx;y2=by+NH/2;const dx=Math.max(30,(x2-x1)/2);d=`M${x1} ${y1} C${x1+dx} ${y1} ${x2-dx} ${y2} ${x2} ${y2}`}
    const cls=F.X&&pi===F.X.i?'now':liveDone(A)&&liveDone(n)?'dn':'fut';e+=`<path class="sx-edge ${cls}" d="${d}"/>`;const lab=n.lab[pi];if(lab){const mx=(x1+x2)/2,my=(y1+y2)/2,w=lab.length*6.4+12;e+=`<rect class="sx-elb" style="fill:#0a0b0a" x="${mx-w/2}" y="${my-9}" width="${w}" height="18" rx="5"/><text class="sx-elt" x="${mx}" y="${my+4}" text-anchor="middle">${lab}</text>`}}
  let h=`<div class="sxb-hd"><div><h3>Blueprint</h3><p>${dLab(F.days[0])} – ${dLab(F.days.at(-1))} · every class, recording and study block, in the order it builds</p></div><span class="sx-sp"></span>
    <button class="sx-ib" data-z="out" aria-label="Zoom out">${ICO.minus}</button><span class="sxb-zm" id="sxZ">100%</span><button class="sx-ib" data-z="in" aria-label="Zoom in">${ICO.plus}</button><button class="sx-ib" data-z="now" aria-label="Centre on the current block">${ICO.fit}</button><button class="sx-ib" data-z="all" aria-label="Show the whole blueprint">${ICO.all}</button><button class="sx-ib" data-z="close" aria-label="Close (Esc)">${ICO.x}</button></div>
    <div class="sxb-vp" id="sxVp"><div class="sxb-world" id="sxW" style="width:${WW}px;height:${WH}px">`;
  F.days.forEach((d,i)=>h+=`<div class="sxb-dcol${d===tk?' today':''}" style="left:${GX+i*DW}px;width:${DW}px;height:${WH}px"></div>`);
  F.laneY.forEach(([n,y],i)=>h+=i?`<div class="sxb-lane" style="top:${y-30}px;width:${WW}px"></div>`:'');
  h+=`<svg style="position:absolute;inset:0;width:${WW}px;height:${WH}px;overflow:visible">${e}</svg>`;
  for(const n of F.nodes){const st=nodeState(n,F.X);h+=`<div class="sx-nd ${st}" style="left:${n._fx}px;top:${n._fy}px;width:${NW}px;height:${NH}px"><span class="sxp sxl"></span><span class="sxp sxr"></span><small><span>${n.date===tk?'Today ':dLab(n.date)+' · '}${hm(n.s)}${st==='act'?' · now':st==='miss'?' · missed':''}</span>${st==='done'?'<i>✓</i>':''}</small><b class="si">${esc2(n.title)}</b></div>`}
  h+=`</div><div class="sxb-rx" id="sxRx">${F.days.map(d=>`<span class="${d===tk?'today':''}">${d===tk?'<span class="sxb-lg">Today · </span>':''}${dLab(d)}</span>`).join('')}</div><div class="sxb-ry" id="sxRy">${F.laneY.map(([n])=>`<span>${n}</span>`).join('')}</div>
    <div class="sxb-hint">Drag to move · scroll or + / − to zoom · Esc to close</div></div>`;
  o.innerHTML=h;document.body.appendChild(o);o._lanes=F.laneY;centreNow(false);logI('blueprint:open');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{['--ct','--cl','--cr','--cb'].forEach(p=>o.style.setProperty(p,'0px'));o.style.setProperty('--cr2','0px');o.classList.add('open')}));
  const vp=o.querySelector('#sxVp');let drag=null;
  vp.addEventListener('pointerdown',ev=>{drag={x:ev.clientX,y:ev.clientY,vx:V.x,vy:V.y};vp.setPointerCapture(ev.pointerId);vp.classList.add('sxb-drag')});
  vp.addEventListener('pointermove',ev=>{if(!drag)return;V.x=drag.vx+ev.clientX-drag.x;V.y=drag.vy+ev.clientY-drag.y;apply()});
  vp.addEventListener('pointerup',()=>{drag=null;vp.classList.remove('sxb-drag')});
  vp.addEventListener('wheel',ev=>{ev.preventDefault();const r=vp.getBoundingClientRect();zoomAt(ev.clientX-r.left,ev.clientY-r.top,Math.exp(-ev.deltaY*.0015))},{passive:false});
  o.querySelector('.sxb-hd').addEventListener('click',ev=>{const z=ev.target.closest('[data-z]')?.dataset.z;if(z==='in')zoomC(1.25);if(z==='out')zoomC(.8);if(z==='now')centreNow(true);if(z==='all')fitAll(true);if(z==='close')closeFull()})}
const vpEl=()=>bpEl&&bpEl.querySelector('#sxVp');
const fitK=()=>{const vp=vpEl();return Math.min(vp.clientWidth/WW,(vp.clientHeight-30)/WH)*.97};
function clampV(){const vp=vpEl(),W=vp.clientWidth,H=vp.clientHeight,w=WW*V.k,h=WH*V.k,m=80;V.x=w<=W?(W-w)/2:Math.min(m,Math.max(W-w-m,V.x));V.y=h<=H-30?(H-h)/2+10:Math.min(m,Math.max(H-h-m,V.y))}
function apply(anim){const w=bpEl&&bpEl.querySelector('#sxW');if(!w)return;clampV();w.classList.toggle('ov',V.k<.8);w.classList.toggle('tiny',V.k<.45);w.style.setProperty('--k',V.k);bpEl.querySelector('#sxRx').classList.toggle('short',V.k<.6);
  const tr=anim&&!R_M()?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';w.style.transition=tr;w.style.transform=`translate(${V.x}px,${V.y}px) scale(${V.k})`;
  [...bpEl.querySelectorAll('#sxRx>span')].forEach((s,i)=>{s.style.transition=tr;s.style.transform=`translateX(${V.x+(GX+i*DW+10)*V.k}px)`});
  [...bpEl.querySelectorAll('#sxRy>span')].forEach((s,i)=>{s.style.transition=tr;s.style.transform=`translateY(${V.y+(bpEl._lanes[i][1]-34)*V.k}px)`});bpEl.querySelector('#sxZ').textContent=Math.round(V.k*100)+'%'}
function zoomAt(px,py,f){const k=Math.min(2.2,Math.max(fitK(),V.k*f));V.x=px-(px-V.x)*k/V.k;V.y=py-(py-V.y)*k/V.k;V.k=k;apply()}
function zoomC(f){const vp=vpEl();zoomAt(vp.clientWidth/2,vp.clientHeight/2,f);apply(true)}
function fitAll(anim){V.k=fitK();clampV();apply(anim)}
function centreNow(anim){const vp=vpEl(),n=FN.find(n=>nodeState(n,focusNode())==='act')||FN.find(n=>n.date===todayK())||FN[0];V.k=1;if(n){V.x=vp.clientWidth*.42-(n._fx+NW/2);V.y=vp.clientHeight/2-(n._fy+NH/2)}apply(anim)}
function closeFull(){if(!bpEl)return;const o=bpEl,src=box.querySelector('.sx-bp').getBoundingClientRect(),W=innerWidth,H=innerHeight;o.classList.remove('open');
  o.style.setProperty('--ct',src.top+'px');o.style.setProperty('--cl',src.left+'px');o.style.setProperty('--cr',(W-src.right)+'px');o.style.setProperty('--cb',(H-src.bottom)+'px');o.style.setProperty('--cr2','18px');
  setTimeout(()=>{o.remove();bpEl=null},R_M()?0:520)}

/* ---------- target popover (his own words; stays in this browser) ---------- */
function targetPop(){if(document.querySelector('.sx-pop'))return;const P=prof(),o=document.createElement('div');o.className='sx-pop';
  o.innerHTML=`<div class="card2"><h3>Target</h3><p class="sx-cap">Private. Stays in this browser and in your backups, never online.</p>
    <label>Course<input data-prof="course" value="${esc2(P.course)}" placeholder="Course"></label><label>Faculty and university<input data-prof="faculty" value="${esc2(P.faculty)}" placeholder="Faculty, university"></label>
    <label>Z-score needed<input data-prof="z" value="${esc2(P.z)}" placeholder="Fill in from the UGC handbook" inputmode="decimal"></label>
    <label>Why I started<textarea data-prof="why" rows="3">${esc2(P.why)}</textarea></label><label>Worst-day line<input data-prof="line" value="${esc2(P.line)}"></label>
    <button class="sx-go" data-popclose>Done</button></div>`;document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-popclose]')){o.remove();render()}})}

/* ---------- sleep guard: first open after 23:00 in this mode, once a night ---------- */
function sleepGuard(){const m=nowMin();if(!isShadow()||!(m>=1380||m<270))return;const night=m<270?dk(add(now(),-1)):todayK();if(SYS.guard===night)return;SYS.guard=night;saveSys();
  logI('say:sleep');overlay(`<div class="sh-first"><div class="sh-k">${hm(m)}</div><h2>Sleep is part of the plan.</h2><p>Close it.</p></div>`,0)}

/* ---------- mode switch ---------- */
function fonts(){if(document.getElementById('sxFonts'))return;const l=document.createElement('link');l.id='sxFonts';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500&display=swap';document.head.appendChild(l)}
function setMode(on,animate){const h=document.documentElement;if(on===isShadow())return;if(on)fonts();
  const go2=()=>{h.classList.toggle('shadow',on);wr(MK,on?'shadow':'normal');const b=document.getElementById('modeBtn');if(b)b.setAttribute('aria-pressed',on);logI(on?'mode:shadow':'mode:normal');if(!on&&bpEl){bpEl.remove();bpEl=null}render(true);if(on)sleepGuard()};
  if(animate&&!R_M()){const s=document.createElement('div');s.className='sh-scan';document.body.appendChild(s);setTimeout(go2,260);setTimeout(()=>s.remove(),700)}else go2()}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const mb=e.target.closest('#modeBtn');if(mb){setMode(!isShadow(),true);return}
  if(e.target.closest('[data-target]')){targetPop();return}
  if(!box||!box.contains(e.target))return;
  if(e.target.closest('[data-bpopen]')){openFull();return}
  const s=e.target.closest('[data-sleep]');if(s){const[d,b]=s.dataset.sleep.split('|');SYS.sleep[d]={b,t:Date.now()};saveSys();logI('check:sleep',{b});render();return}
  const n=e.target.closest('[data-phn]');if(n){const[d,v]=n.dataset.phn.split('|');SYS.phone[d]={night:v==='1'};saveSys();logI('check:phone-night',{v});render();return}
  const pm=e.target.closest('[data-phm]');if(pm){const[d,v]=pm.dataset.phm.split('|');SYS.phone[d].morning=v==='1';saveSys();logI('check:phone-morning',{v});render();return}
  if(e.target.closest('[data-begin]')||e.target.closest('.sx-nd.act')){logI('begin');try{(typeof vgo==='function'?vgo:go)('Focus');setTimeout(()=>{if(typeof fRun!=='undefined'&&!fRun&&fPhase==='focus')document.getElementById('fGo').click()},400)}catch(x){}}});
document.addEventListener('change',e=>{const f=e.target.closest('[data-prof]');if(!f)return;const P=prof();P[f.dataset.prof]=f.value.trim();wr(PK,P)});
addEventListener('keydown',e=>{if(!bpEl)return;if(e.key==='Escape')closeFull();if(e.key==='+'||e.key==='=')zoomC(1.25);if(e.key==='-')zoomC(.8);const m={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]}[e.key];if(m){V.x+=m[0];V.y+=m[1];apply(true)}});
let rsT=0;addEventListener('resize',()=>{clearTimeout(rsT);rsT=setTimeout(()=>{if(onHome())drawGraph(true);if(bpEl)apply()},120)});

/* ---------- boot ---------- */
function boot(){const main=document.querySelector('main');if(!main)return;if(isShadow())fonts();box=document.createElement('div');box.id='shx';box.setAttribute('aria-label','Shadow Protocol home');const top=main.querySelector(':scope>.top');top?top.after(box):main.prepend(box);
  const b=document.getElementById('modeBtn');if(b)b.setAttribute('aria-pressed',isShadow());
  render(true);sleepGuard();
  new MutationObserver(()=>{if(onHome()){if(!box.querySelector('.sx-grid'))render(true);else{render();drawGraph(true);wave()}}}).observe(document.body,{attributes:true,attributeFilter:['class']});
  const rows=document.getElementById('rows');if(rows)new MutationObserver(()=>render()).observe(rows,{childList:true,subtree:true,attributes:true});
  setInterval(()=>{if(logSessions()&&onHome())render()},15000);logSessions();snapMB();setInterval(()=>{snapMB();if(!document.hidden)render()},20000);
  /* tests and the demo button need a way to fire moments by hand */
  window.ShadowProtocol={totals,levelOf,rankOf,ledger,trajectory,XP,RANKS,setMode,render:()=>render(true),openFull,closeFull,fitAll,zoomC,graphAll,homeGraph,shadow,logSessions,lvSeq:(u)=>{const T=totals(),lv=levelOf(T.tot);lvSeq(!!u,Math.max(1,lv.L-1),lv,rankOf(lv.L))}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
