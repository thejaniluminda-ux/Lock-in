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
const SJC={phy:'#5b9dff',chem:'#0d9488',maths:'#ff9f43',paper:'#c9c2b8'};
/* edge labels sit on the curve's midpoint and are dropped if they would touch any node */
const midOf=d=>{const v=d.match(/-?[\d.]+/g).map(Number);return[(v[0]+3*v[2]+3*v[4]+v[6])/8,(v[1]+3*v[3]+3*v[5]+v[7])/8]};
const hitsAny=(x,y,w,h,B)=>B.some(([bx,by,bw,bh])=>x<bx+bw&&x+w>bx&&y<by+bh&&y+h>by);
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
    <div class="sx-col"><section class="sx-pl" id="sxMast"></section><section class="sx-pl sx-rec" id="sxRec"></section><section class="sx-pl sx-radio" id="sxRadio"></section></div></div>`;for(const k in PSIG)delete PSIG[k]}
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
function recHtml(){const P=['nights asleep','focus session','class','nights the phone','mistake','past-paper','workout','study block','full paper'],R=record().sort((a,b)=>P.findIndex(p=>a[1].startsWith(p))-P.findIndex(p=>b[1].startsWith(p))).slice(0,3);
  return `<div class="sx-rh"><h3>The Record</h3><span>evidence, not promises</span></div>${R.length?`<div class="sx-rr">${R.map(([n,s])=>`<div><b class="num">${n}</b><span>${esc2(s)}</span></div>`).join('')}</div>`:'<p class="sx-cap">Empty for now. Finished sessions, early nights and fixed mistakes land here.</p>'}`}
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
    el.style.left=x+'px';el.style.top=y+'px';el.style.width=(cw-14)+'px';el.title=n.title;el.tabIndex=0;
    el.innerHTML=`<span class="sxp sxl"></span><span class="sxp sxr"></span><small><span>${nodeMeta(n,st)}</span>${st==='done'?'<i>✓</i>':''}</small><b class="si">${esc2(n.title)}</b>${st==='act'?`<div class="pb"><i style="width:${Math.round(Math.max(0,Math.min(1,(nowMin()-n.s)/(n.e-n.s)))*100)}%"></i></div>`:''}`;g.appendChild(el)}
  const gr=g.getBoundingClientRect();let h='',flowI=-1,k=0;const boxes=Object.values(pos).map(el=>{const b=el.getBoundingClientRect();return[b.left-gr.left,b.top-gr.top,b.width,b.height]});
  for(const n of H0.nodes)for(const pi of n.par){if(!pos[pi])continue;const A=pos[pi].getBoundingClientRect(),B=pos[n.i].getBoundingClientRect();let d,x1,y1,x2,y2;
    if(B.left<A.right+10){x1=A.left+A.width/2-gr.left;y1=A.bottom-gr.top;x2=B.left+B.width/2-gr.left;y2=B.top-gr.top;if(y2<y1){y1=A.top-gr.top;y2=B.bottom-gr.top}d=`M${x1} ${y1} C${x1} ${(y1+y2)/2} ${x2} ${(y1+y2)/2} ${x2} ${y2}`}
    else{x1=A.right-gr.left;y1=A.top+A.height/2-gr.top;x2=B.left-gr.left;y2=B.top+B.height/2-gr.top;const dx=Math.max(30,(x2-x1)/2);d=`M${x1} ${y1} C${x1+dx} ${y1} ${x2-dx} ${y2} ${x2} ${y2}`}
    const P=graphAll()[pi],cls=H0.X&&pi===H0.X.i?'now':liveDone(P)&&(liveDone(n)||n.i===H0.X?.i)?'dn':'fut';if(cls==='now'&&flowI<0)flowI=k;
    h+=`<path id="sxE${k}" class="sx-edge ${cls}" d="${d}"/>`;const lab=n.lab[pi];if(lab){const [mx,my]=midOf(d),w=lab.length*6.4+12;if(!hitsAny(mx-w/2-4,my-13,w+8,26,boxes))h+=`<rect class="sx-elb" x="${mx-w/2}" y="${my-9}" width="${w}" height="18" rx="5"/><text class="sx-elt" x="${mx}" y="${my+4}" text-anchor="middle">${lab}</text>`}k++}
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
  setPanel('sxRank',rankHtml(T,lv,rank));setPanel('sxMis',misHtml());setPanel('sxMast',mastHtml());setPanel('sxRec',recHtml());if(setPanel('sxRadio',radioHtml()))wave();
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
const GX=150,DW=232,NW=184,NH=70,RH=86;
function buildFull(){const G=graphAll(),tk=todayK(),X=focusNode(),d0=dk(add(now(),-2)),d1=dk(add(now(),8)),days=[];for(let i=-2;i<=8;i++)days.push(dk(add(now(),i)));
  const lanes=[['phy','Physics'],['chem','Chemistry'],['maths','Maths'],['paper','Papers']];const nodes=G.filter(n=>n.date>=d0&&n.date<=d1);const rowOf={},cells={};let y=70;const laneY=[];
  for(const [sj,name] of lanes){const L=nodes.filter(n=>(n.subj||'paper')===sj||(sj==='paper'&&n.kind==='paper'));if(!L.length)continue;let maxR=0;
    for(const n of L){const c=days.indexOf(n.date);let r=n.par.map(pi=>rowOf[pi]).find(r=>r!=null&&!cells[sj+c+'_'+r]);if(r==null){r=0;while(cells[sj+c+'_'+r])r++}cells[sj+c+'_'+r]=1;rowOf[n.i]=r;n._fx=GX+c*DW+20;n._fy=y+r*RH;maxR=Math.max(maxR,r)}
    laneY.push([name,y]);y+=(maxR+1)*RH+46}
  FN=nodes;WW=GX+days.length*DW+60;WH=y+20;return{days,laneY,X,nodes}}
function openFull(){if(bpEl)return;const src=box.querySelector('.sx-bp').getBoundingClientRect(),W=innerWidth,H=innerHeight,F=buildFull(),tk=todayK();
  const o=document.createElement('div');o.className='sx-bpf';bpEl=o;o.setAttribute('role','dialog');o.setAttribute('aria-label','Full blueprint');
  const clip=r=>{o.style.setProperty('--ct',r.top+'px');o.style.setProperty('--cl',r.left+'px');o.style.setProperty('--cr',(W-r.right)+'px');o.style.setProperty('--cb',(H-r.bottom)+'px');o.style.setProperty('--cr2','18px')};clip(src);
  const ids=new Set(F.nodes.map(n=>n.i));let e='';const boxes=F.nodes.map(n=>[n._fx,n._fy,NW,NH]);
  for(const n of F.nodes)for(const pi of n.par){if(!ids.has(pi))continue;const A=graphAll()[pi],ax=A._fx,ay=A._fy,bx=n._fx,by=n._fy;let d,x1,y1,x2,y2;
    if(bx<=ax){x1=ax+NW/2;y1=ay+(by>ay?NH:0);x2=bx+NW/2;y2=by+(by>ay?0:NH);const s=by>ay?1:-1;d=`M${x1} ${y1} C${x1} ${y1+30*s} ${x2} ${y2-30*s} ${x2} ${y2}`}
    else{x1=ax+NW;y1=ay+NH/2;x2=bx;y2=by+NH/2;const dx=Math.max(30,(x2-x1)/2);d=`M${x1} ${y1} C${x1+dx} ${y1} ${x2-dx} ${y2} ${x2} ${y2}`}
    const cls=F.X&&pi===F.X.i?'now':liveDone(A)&&liveDone(n)?'dn':'fut';e+=`<path class="sx-edge ${cls}" d="${d}"/>`;const lab=n.lab[pi];if(lab){const [mx,my]=midOf(d),w=lab.length*6.4+12;if(!hitsAny(mx-w/2-4,my-13,w+8,26,boxes))e+=`<rect class="sx-elb" style="fill:#0a0b0a" x="${mx-w/2}" y="${my-9}" width="${w}" height="18" rx="5"/><text class="sx-elt" x="${mx}" y="${my+4}" text-anchor="middle">${lab}</text>`}}
  let h=`<div class="sxb-hd"><div><h3>Blueprint</h3><p>${dLab(F.days[0])} – ${dLab(F.days.at(-1))} · every class, recording and study block, in the order it builds</p></div><span class="sx-sp"></span>
    <button class="sx-ib" data-z="out" aria-label="Zoom out">${ICO.minus}</button><span class="sxb-zm" id="sxZ">100%</span><button class="sx-ib" data-z="in" aria-label="Zoom in">${ICO.plus}</button><button class="sx-ib" data-z="now" aria-label="Centre on the current block">${ICO.fit}</button><button class="sx-ib" data-z="all" aria-label="Show the whole blueprint">${ICO.all}</button><button class="sx-ib" data-z="close" aria-label="Close (Esc)">${ICO.x}</button></div>
    <div class="sxb-vp" id="sxVp"><div class="sxb-world" id="sxW" style="width:${WW}px;height:${WH}px">`;
  F.days.forEach((d,i)=>h+=`<div class="sxb-dcol${d===tk?' today':''}" style="left:${GX+i*DW}px;width:${DW}px;height:${WH}px"></div>`);
  F.laneY.forEach(([n,y],i)=>h+=i?`<div class="sxb-lane" style="top:${y-30}px;width:${WW}px"></div>`:'');
  h+=`<svg style="position:absolute;inset:0;width:${WW}px;height:${WH}px;overflow:visible">${e}</svg>`;
  for(const n of F.nodes){const st=nodeState(n,F.X);h+=`<div class="sx-nd ${st}" data-i="${n.i}" title="${esc2(n.title)}" style="left:${n._fx}px;top:${n._fy}px;width:${NW}px;height:${NH}px;--sj:${SJC[n.kind==='paper'?'paper':n.subj]||'#8b928d'}"><em class="sxq">${dLab(n.date).split(' ')[0]} ${hm(n.s)}</em><span class="sxp sxl"></span><span class="sxp sxr"></span><small><span>${n.date===tk?'Today ':dLab(n.date)+' · '}${hm(n.s)}${st==='act'?' · now':st==='miss'?' · missed':''}</span>${st==='done'?'<i>✓</i>':''}</small><b class="si">${esc2(n.title)}</b></div>`}
  h+=`</div><div class="sxb-rx" id="sxRx">${F.days.map(d=>`<span class="${d===tk?'today':''}">${d===tk?'<span class="sxb-lg">Today · </span>':''}${dLab(d)}</span>`).join('')}</div><div class="sxb-ry" id="sxRy">${F.laneY.map(([n])=>`<span>${n}</span>`).join('')}</div>
    <div class="sxb-hint">Scroll or drag to move · Ctrl + scroll or + / − to zoom · click a block to read it · Esc to close</div><div class="sxb-sb" id="sxSb"><i></i></div></div>`;
  o.innerHTML=h;document.body.appendChild(o);o._lanes=F.laneY;centreNow(false);logI('blueprint:open');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{['--ct','--cl','--cr','--cb'].forEach(p=>o.style.setProperty(p,'0px'));o.style.setProperty('--cr2','0px');o.classList.add('open')}));
  const vp=o.querySelector('#sxVp');let drag=null;
  vp.addEventListener('pointerdown',ev=>{drag={x:ev.clientX,y:ev.clientY,vx:V.x,vy:V.y,t:ev.target,m:0};vp.setPointerCapture(ev.pointerId);vp.classList.add('sxb-drag')});
  vp.addEventListener('pointermove',ev=>{if(!drag)return;drag.m=Math.max(drag.m,Math.abs(ev.clientX-drag.x)+Math.abs(ev.clientY-drag.y));V.x=drag.vx+ev.clientX-drag.x;V.y=drag.vy+ev.clientY-drag.y;apply()});
  vp.addEventListener('pointerup',()=>{const d=drag;drag=null;vp.classList.remove('sxb-drag');if(d&&d.m<5){const nd=d.t.closest&&d.t.closest('.sx-nd');if(nd)nodeTip(+nd.dataset.i,nd)}});
  vp.addEventListener('wheel',ev=>{ev.preventDefault();const r=vp.getBoundingClientRect();if(ev.ctrlKey||ev.metaKey){zoomAt(ev.clientX-r.left,ev.clientY-r.top,Math.exp(-ev.deltaY*.0015));return}if(ev.shiftKey){V.x-=ev.deltaY}else{V.x-=ev.deltaX;V.y-=ev.deltaY}apply()},{passive:false});
  o.querySelector('.sxb-hd').addEventListener('click',ev=>{const z=ev.target.closest('[data-z]')?.dataset.z;if(z==='in')zoomC(1.25);if(z==='out')zoomC(.8);if(z==='now')centreNow(true);if(z==='all')fitAll(true);if(z==='close')closeFull()})}
const vpEl=()=>bpEl&&bpEl.querySelector('#sxVp');
const fitK=()=>{const vp=vpEl();return Math.min(vp.clientWidth/WW,(vp.clientHeight-30)/WH)*.97};
function clampV(){const vp=vpEl(),W=vp.clientWidth,H=vp.clientHeight,w=WW*V.k,h=WH*V.k,m=80;V.x=w<=W?(W-w)/2:Math.min(m,Math.max(W-w-m,V.x));V.y=h<=H-30?(H-h)/2+10:Math.min(m,Math.max(H-h-m,V.y))}
function apply(anim){const w=bpEl&&bpEl.querySelector('#sxW');if(!w)return;clampV();w.classList.toggle('ov',V.k<.75);w.classList.toggle('tiny',V.k<.45);w.style.setProperty('--k',V.k);bpEl.querySelector('#sxRx').classList.toggle('short',V.k<.6);
  const tr=anim&&!R_M()?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';w.style.transition=tr;w.style.transform=`translate(${V.x}px,${V.y}px) scale(${V.k})`;
  [...bpEl.querySelectorAll('#sxRx>span')].forEach((s,i)=>{s.style.transition=tr;s.style.transform=`translateX(${V.x+(GX+i*DW+10)*V.k}px)`});
  [...bpEl.querySelectorAll('#sxRy>span')].forEach((s,i)=>{s.style.transition=tr;s.style.transform=`translateY(${V.y+(bpEl._lanes[i][1]-34)*V.k}px)`});bpEl.querySelector('#sxZ').textContent=Math.round(V.k*100)+'%';
  const sb=bpEl.querySelector('#sxSb'),vp=vpEl(),H=WH*V.k,vh=vp.clientHeight;sb.style.display=H>vh+2?'block':'none';if(H>vh+2){const tr2=sb.clientHeight,th=Math.max(30,tr2*vh/H);sb.firstChild.style.height=th+'px';sb.firstChild.style.transform=`translateY(${(tr2-th)*Math.min(1,Math.max(0,(80-V.y)/(H-vh+160)))}px)`}}
function zoomAt(px,py,f){const k=Math.min(2.2,Math.max(fitK(),V.k*f));V.x=px-(px-V.x)*k/V.k;V.y=py-(py-V.y)*k/V.k;V.k=k;apply()}
function zoomC(f){const vp=vpEl();zoomAt(vp.clientWidth/2,vp.clientHeight/2,f);apply(true)}
function fitAll(anim){V.k=fitK();clampV();apply(anim)}
function centreNow(anim){const vp=vpEl(),n=FN.find(n=>nodeState(n,focusNode())==='act')||FN.find(n=>n.date===todayK())||FN[0];V.k=1;if(n){V.x=vp.clientWidth*.42-(n._fx+NW/2);V.y=Math.min(20,Math.max(vp.clientHeight-WH-20,vp.clientHeight-(n._fy+NH)-60))}apply(anim)}
function closeFull(){if(!bpEl)return;const o=bpEl,src=box.querySelector('.sx-bp').getBoundingClientRect(),W=innerWidth,H=innerHeight;o.classList.remove('open');
  o.style.setProperty('--ct',src.top+'px');o.style.setProperty('--cl',src.left+'px');o.style.setProperty('--cr',(W-src.right)+'px');o.style.setProperty('--cb',(H-src.bottom)+'px');o.style.setProperty('--cr2','18px');
  setTimeout(()=>{o.remove();bpEl=null},R_M()?0:520)}

/* ---------- node tip: the full title on click ---------- */
function nodeTip(i,el){document.querySelector('.sx-tip')?.remove();const n=graphAll()[i];if(!n)return;const st=nodeState(n,focusNode()),r=el.getBoundingClientRect(),t=document.createElement('div');t.className='sx-tip';
  t.innerHTML=`<small style="--sj:${SJC[n.kind==='paper'?'paper':n.subj]||'#8b928d'}"><i></i>${SUBJ[n.subj]||'Paper'} · ${n.date===todayK()?'Today':dLab(n.date)} · ${hm(n.s)}–${hm(n.e)}</small><b>${esc2(n.title)}</b>${n.sub?`<p>${esc2(n.sub)}</p>`:''}
    <span class="st">${{act:'Now',done:'Done',miss:'Missed',lock:'Waiting on a missed block','':'Ahead'}[st]}</span>${st==='act'?'<button class="sx-go" data-begin>Begin</button>':''}`;
  document.body.appendChild(t);const w=t.offsetWidth,hh=t.offsetHeight;t.style.left=Math.max(10,Math.min(innerWidth-w-10,r.left+r.width/2-w/2))+'px';t.style.top=(r.bottom+8+hh>innerHeight?r.top-hh-8:r.bottom+8)+'px';
  setTimeout(()=>{const off=ev=>{if(ev.target.closest&&ev.target.closest('[data-begin]'))return;if(!t.contains(ev.target)){t.remove();removeEventListener('pointerdown',off,true)}};addEventListener('pointerdown',off,true)},0)}
document.addEventListener('click',e=>{if(e.target.closest('.sx-tip [data-begin]')){document.querySelector('.sx-tip')?.remove();if(bpEl)closeFull();logI('begin');try{(typeof vgo==='function'?vgo:go)('Focus');setTimeout(()=>{if(typeof fRun!=='undefined'&&!fRun&&fPhase==='focus')document.getElementById('fGo').click()},400)}catch(x){}}});
addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.sx-tip')?.remove()},true);

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
  const nd=e.target.closest('.sx-nd');if(nd&&!e.target.closest('[data-begin]')){nodeTip(+nd.dataset.i,nd);return}
  if(e.target.closest('[data-begin]')){logI('begin');try{(typeof vgo==='function'?vgo:go)('Focus');setTimeout(()=>{if(typeof fRun!=='undefined'&&!fRun&&fPhase==='focus')document.getElementById('fGo').click()},400)}catch(x){}}});
document.addEventListener('change',e=>{const f=e.target.closest('[data-prof]');if(!f)return;const P=prof();P[f.dataset.prof]=f.value.trim();wr(PK,P)});
addEventListener('keydown',e=>{if(!bpEl)return;if(e.key==='Escape')closeFull();if(e.key==='+'||e.key==='=')zoomC(1.25);if(e.key==='-')zoomC(.8);const m={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]}[e.key];if(m){V.x+=m[0];V.y+=m[1];apply(true)}});
let rsT=0;addEventListener('resize',()=>{clearTimeout(rsT);rsT=setTimeout(()=>{if(onHome())drawGraph(true);if(bpEl)apply()},120)});

/* ===P2=== Phase 2: Focus, Calendar and Library redesigned for Shadow mode. The app's own controls, data and handlers
   stay in charge; Shadow mode lays them out again and adds panels that read the same data. Normal mode is untouched. */
const q1=s=>document.querySelector(s);
const P2={msel:{},tab:{},A:{n:0,sec:0},awayAt:0,prevPh:'',prevLeft:0,quitT:0,links:false,sig:''};
const pageOf=()=>{const c=document.body.className;return /\bpage-foc\b/.test(c)?'foc':/\bpage-cal\b/.test(c)?'cal':/\bpage-lib\b/.test(c)?'lib':''};
const goP=n=>{try{(typeof vgo==='function'?vgo:go)(n)}catch(e){}};
const PGN={foc:'Focus',cal:'Calendar',lib:'Library'};
const ssm=s=>{s=Math.max(0,Math.round(s));return `${Math.floor(s/60)}:${p2(s%60)}`};
const dayW=k=>{const x=new Date(k+'T00:00');return k===todayK()?'Today':DOW3[x.getDay()]+(Math.abs((x-new Date(todayK()+'T00:00'))/864e5)>6?' '+x.getDate():'')};

/* ---------- shared bar: crumb, page switcher, day / exam / clock ---------- */
function bars(){for(const[id,pg]of[['focPage','foc'],['calPage','cal'],['libPage','lib']]){const P=document.getElementById(id);if(!P||P.querySelector(':scope>.sx2-barw'))continue;
  const b=document.createElement('div');b.className='sx2-barw';b.innerHTML=`<div class="sx2-crumb">Shadow Protocol / <b>${PGN[pg]}</b></div><div class="sx2-seg" role="group" aria-label="Pages">${['foc','cal','lib'].map(k=>`<button type="button" data-sxgo="${PGN[k]}" aria-pressed="${k===pg}">${PGN[k]}</button>`).join('')}</div><span class="sx2-sp"></span><div class="sx2-pill" data-sxday></div><div class="sx2-pill" data-sxexam></div><div class="sx2-pill"><b class="num" data-sxclk></b></div>`;P.prepend(b)}
  barTick()}
function barTick(){const n=now();document.querySelectorAll('[data-sxday]').forEach(e=>e.innerHTML=`Day <b class="num">${dayNo()}</b> / ${daysTotal()}`);
  document.querySelectorAll('[data-sxexam]').forEach(e=>e.innerHTML=n<EXAM?`A/L in <b class="num">${Math.ceil((EXAM-n)/864e5)}</b> days`:'A/L');document.querySelectorAll('[data-sxclk]').forEach(e=>e.textContent=hm(nowMin()))}

/* ================= FOCUS ================= */
function focBuild(){const P=document.getElementById('focPage');if(!P||P.querySelector('#sxFoc'))return;const d=document.createElement('div');d.id='sxFoc';
  let tk='';for(let i=0;i<60;i++){const a=(i/60*360-90)*Math.PI/180,r1=188,r2=i%5?177:168;tk+=`<line class="t${i%5?'':' M'}" x1="${(200+r1*Math.cos(a)).toFixed(1)}" y1="${(200+r1*Math.sin(a)).toFixed(1)}" x2="${(200+r2*Math.cos(a)).toFixed(1)}" y2="${(200+r2*Math.sin(a)).toFixed(1)}"/>`}
  d.innerHTML=`<div class="sx2-col"><section class="sx2-pl sxf-blk"><div id="sxfBlk"></div>
      <form class="sxf-cf" id="sxfCf" autocomplete="off"><div class="lbl">Stuck on something? One line, then keep going.</div><div class="in"><input id="sxfCfIn" maxlength="300" placeholder="Your question" aria-label="Question you can't answer yet"><button class="sx2-btn sm" type="submit">Save</button></div><select id="sxfCfU" aria-label="Unit this question belongs to"></select><div id="sxfCfL"></div></form></section></div>
    <section class="sx2-pl sxf-dial" id="sxfDial"><div class="sxf-ban" id="sxfBan" role="status" hidden></div>
      <div class="sx2-seg" id="sxfModes" role="group" aria-label="Session length"><button type="button" data-m="pomo">25 / 5</button><button type="button" data-m="deep">50 / 10</button></div>
      <div class="sxf-face"><svg viewBox="0 0 400 400" id="sxfRing" aria-hidden="true">${tk}<circle cx="200" cy="200" r="152" fill="none" stroke="rgba(255,255,255,.05)"/></svg>
        <div class="sxf-in"><div class="st" id="sxfSt"></div><b class="num" id="sxfTm" aria-live="off"></b><div class="sub" id="sxfSub"></div><div class="sxf-dots" id="sxfDots"></div></div></div>
      <div class="sxf-brk">Stand up. Water. Eyes off the screen.</div>
      <div class="sxf-sj" id="sxfSj" role="group" aria-label="Studying">${['phy','chem','maths'].map(s=>`<button type="button" data-s="${s}" style="--sj:${SJC[s]}"><i></i>${SUBJ[s]}</button>`).join('')}</div>
      <div class="sxf-ctl"><button type="button" class="sx2-btn" id="sxfReset">Reset</button><button type="button" class="sx2-btn pri" id="sxfGo"></button><button type="button" class="sx2-btn" id="sxfQuit">Quit</button></div></section>
    <div class="sx2-col"><section class="sx2-pl sxf-race" id="sxfRace"></section><section class="sx2-pl sxf-side" id="sxfSide"></section></div>`;
  P.appendChild(d);
  d.querySelector('#sxfModes').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)document.querySelector(`#fModes [data-m="${b.dataset.m}"]`)?.click();focFull()});
  d.querySelector('#sxfSj').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b)document.querySelector(`#fSubj [data-s="${b.dataset.s}"]`)?.click();focFull()});
  d.querySelector('#sxfGo').addEventListener('click',()=>{q1('#fGo').click();focFull()});
  d.querySelector('#sxfReset').addEventListener('click',()=>{q1('#fReset').click();P2.A={n:0,sec:0};focFull()});
  d.querySelector('#sxfQuit').addEventListener('click',()=>{const k=q1('#fSkip');if(fPhase==='break'){k.click();focFull();return}
    if(!fRun&&fLeft>=fTotal)return;if(Date.now()-P2.quitT>4000){P2.quitT=Date.now();k.click();focFull();setTimeout(focFull,4100);return}P2.quitT=0;k.click();P2.A={n:0,sec:0};focFull()});
  d.querySelector('#sxfCf').addEventListener('submit',e=>{e.preventDefault();const i=d.querySelector('#sxfCfIn'),v=i.value.trim();if(!v)return;const u=d.querySelector('#sxfCfU').value;
    const su=q1('#cfUnit');if(su){su.value=u;su.dispatchEvent(new Event('change',{bubbles:true}))}q1('#cfIn').value=v;q1('#cfForm').requestSubmit();if(!q1('#cfIn').value){i.value='';cfListF()}else d.querySelector('#sxfCfU').focus()});
  d.querySelector('#sxfBan').addEventListener('click',e=>{if(e.target.closest('button'))e.currentTarget.hidden=true})}
function blockNow(){const tk=todayK(),m=nowMin(),L=(CS.days[tk]||[]).filter(isStudy).sort((a,b)=>a.s-b.s);const c=curBlock();if(c)return{b:c,cur:true};const n=L.find(e=>e.s>m);return n?{b:n,cur:false}:{b:null}}
function nodeOf(b){if(!b)return null;const tk=todayK();return graphAll().find(n=>n.date===tk&&n.s===b.s&&n.title===b.title)||null}
function chainOf(X){if(!X)return[];const G=graphAll(),out=[];const pre=X.par.map(i=>G[i]).filter(Boolean).slice(-2);pre.forEach(n=>out.push([n,'pre']));out.push([X,'now']);
  const same=G.filter(n=>n.i>X.i&&n.kind==='class'&&(X.unit?n.unit===X.unit:n.subj===X.subj&&!n.unit)).slice(0,2);same.forEach(n=>out.push([n,'']));
  const ids=new Set(out.map(([n])=>n.i));const un=G.find(n=>n.i>X.i&&n.kind==='class'&&X.unit&&n.unit&&n.unit!==X.unit&&!/x$/.test(n.unit)&&n.par.some(p=>ids.has(p)));if(un)out.push([un,'unl']);return out}
function focBlk(){const{b,cur}=blockNow(),el=q1('#sxfBlk');if(!el)return;
  if(!b){const m=nowMin(),L=(CS.days[todayK()]||[]).find(e=>m>=e.s&&m<e.e),t=L?L.title:'Free time',off=/off duty|free/i.test(t);el.innerHTML=`<div class="lbl">No study block now${L?' · '+hm(L.s)+'–'+hm(L.e):''}</div><h2 class="sxf-t">${esc2(t)}</h2><p class="sx2-cap">${off?'Rest is part of the plan. If you study anyway, pick a subject under the timer and it still counts.':'Pick a subject under the timer if you study anyway. It still counts.'}</p>`;return}
  const kind=b.kind==='class'?(b.fixed?'live class':'class'):b.kind==='paper'?'paper':b.cons?'consolidation':'study';
  const ch=chainOf(nodeOf(b)),tk=todayK();
  el.innerHTML=`<div class="lbl">${cur?'Current block':'Next block · starts '+hm(b.s)}</div><h2 class="sxf-t si">${esc2(b.title)}</h2><div class="sxf-tm num${cur?' on':''}">${hm(b.s)} – ${hm(b.e)}</div><div class="sx2-cap"><i class="sx2-dot" style="--sj:${SJC[b.subj]||'#8b928d'}"></i>${SUBJ[b.subj]||'Paper'} · ${kind}</div>
    ${ch.length>1?`<div class="lbl" style="margin-top:14px">Blueprint chain</div><div class="sxf-ch">${ch.map(([n,r])=>{const dn=liveDone(n),miss=!dn&&(n.date<tk||(n.date===tk&&n.e<=nowMin()))&&r!=='now';
      return `<div class="c ${r==='now'?'now':dn?'ok':miss?'miss':r==='unl'?'lock':''}"><span class="si">${esc2(n.title)}</span><small>${r==='now'?(cur?'now':hm(n.s)):r==='pre'?(dn?'done':miss?'missed':dayW(n.date)):r==='unl'?dayW(n.date)+' · unlocks':dayW(n.date)}</small></div>`}).join('')}</div>`:''}`}
function cfListF(){const el=q1('#sxfCfL');if(!el)return;const tk=todayK(),L=(typeof CF!=='undefined'?CF:[]).filter(x=>x.d===tk).slice(-3).reverse();
  el.innerHTML=L.map(x=>`<div class="q"><span class="num">${x.ok?'✓':'?'}</span><span>${esc2(x.q)}</span></div>`).join('');
  const s=q1('#sxfCfU'),src=q1('#cfUnit');if(s&&src&&document.activeElement!==s){s.innerHTML=src.innerHTML;s.value=src.value}}
function raceSvg(S,tk){const t0=360,t1=1380,X=t=>((t-t0)/(t1-t0)*260).toFixed(1),you=SYS.ses[tk]||[],m=nowMin();
  const shEnd=S.days.length?S.at(1440):0,vm=Math.max(60,shEnd,S.you+(fRun&&fPhase==='focus'?FMODES[fMode].f:0))*1.08,Y=v=>(80-v/vm*76).toFixed(1);
  let yp=`M${X(t0)} ${Y(0)}`,c=0;you.slice().sort((a,b)=>a[0]-b[0]).forEach(([t,v])=>{yp+=` L${X(t)} ${Y(c)} L${X(t)} ${Y(c+v)}`;c+=v});yp+=` L${X(Math.min(m,t1))} ${Y(c)}`;
  let sp='';if(S.days.length)for(let t=t0;t<=t1;t+=15)sp+=(sp?' L':'M')+X(t)+' '+Y(S.at(t));
  const pend=fRun&&fPhase==='focus'?`<path class="pend" d="M${X(m)} ${Y(c)} L${X(Math.min(t1,m+fLeft/60))} ${Y(c+FMODES[fMode].f)}"/>`:'';
  return `<svg viewBox="0 0 260 84" preserveAspectRatio="none" aria-hidden="true">${sp?`<path class="sl" d="${sp}"/>`:''}<path class="yl" d="${yp}"/>${pend}<line class="nl" x1="${X(m)}" x2="${X(m)}" y1="0" y2="84"/></svg>`}
function focRace(){const el=q1('#sxfRace');if(!el)return;const tk=todayK(),S=shadow(),m=nowMin(),sh=S.days.length?S.at(m):null,you=S.you;
  if(sh==null){el.innerHTML=`<div class="sx2-cap">Today vs your shadow · finished sessions only</div><div class="sxf-big num">${fmH(you)}</div><div class="sx2-cap">focused today</div>${you?raceSvg(S,tk):""}<p class="sxf-note">Your shadow forms from your best 3 of the last 7 days. Finish sessions today and tomorrow you race them.</p>`;return}
  const df=you-sh,f=FMODES[fMode].f;
  el.innerHTML=`<div class="sx2-cap">Today vs your shadow · finished sessions only</div><div class="sxf-big num">${df>=0?'+':'−'}${fmH(Math.abs(df))}</div><div class="sx2-cap">${df>0?'ahead':df<0?'behind':'level'}</div>${raceSvg(S,tk)}
    <div class="sx2-row"><span>You</span><b class="num">${fmH(you)} h</b></div><div class="sx2-row"><span>Shadow at ${hm(m)}</span><b class="num">${fmH(sh)} h</b></div>
    ${fRun&&fPhase==='focus'?`<p class="sxf-note">Finish this session and you are <b class="num">${df+f>=0?'+':'−'}${fmH(Math.abs(df+f))}</b>.</p>`:''}`}
function recallItem(){try{const due=mbDueNow();const L=due.length?due:MB.filter(m=>!m.ok);if(!L.length)return null;return L[Math.floor(Date.now()/36e5)%L.length]}catch(e){return null}}
function focSide(){const el=q1('#sxfSide');if(!el)return;const tk=todayK(),m=nowMin();
  if(fPhase==='break'){const{b,cur}=blockNow(),end=m+Math.ceil((fRun?(fEnd-Date.now())/1000:fLeft)/60),cont=b&&cur&&b.e>end+10,nb=cont?b:(CS.days[tk]||[]).filter(isStudy).sort((a,c)=>a.s-c.s).find(e=>e.s>=end-10&&e!==b),R=recallItem();
    el.innerHTML=`<div class="sx2-ph"><h3>Next session</h3><p>${hm(end)} · ${FMODES[fMode].f} minutes</p></div>${nb?`<div class="sxf-nx"><i class="sx2-dot" style="--sj:${SJC[nb.subj]||'#8b928d'}"></i><span class="si">${esc2(nb.title)}</span></div><p class="sx2-cap">${cont?'Same block, keep the thread.':'Starts '+hm(nb.s)+'.'}</p>`:'<p class="sx2-cap">Nothing else planned today. Pick a subject under the timer.</p>'}
      ${R?`<div class="sxf-rc"><div class="lbl">Recall while you rest</div><b>${SUBJ[R.s]||''} ${esc2(R.y||'')} · Q${esc2(R.q||'')}</b><span>${esc2(R.t||'')}</span><p>Last time: ${esc2(R.w||'wrong')}. Say the method out loud before the break ends.</p></div>`:''}`;return}
  const left=fRun?(fEnd-Date.now())/1000:fLeft,A=P2.A,line=(SYS.radio[tk]||[]).slice(-1)[0],day=(FO.log[tk]||{min:0}).min;
  el.innerHTML=`<div class="sx2-ph"><h3>This session</h3><p>What the system is watching</p></div>
    <div class="sx2-row"><span>Left the tab</span><b class="num${A.n?' warn':''}">${A.n?`${A.n} time${A.n>1?'s':''} · ${ssm(A.sec)}`:'0 times'}</b></div>
    <div class="sx2-row"><span>${fRun?'Break at':'Break after'}</span><b class="num">${fRun?hm(m+Math.ceil(left/60)):FMODES[fMode].f+' min'}</b></div>
    <div class="sx2-row"><span>Focused today</span><b class="num">${fmH(day)} h</b></div>
    ${line?`<div class="sxf-radio"><span class="num">${line.t}</span>${esc2(line.text)}</div>`:''}`}
function sesInfo(){const tk=todayK(),{b,cur}=blockNow(),done=(FO.log[tk]||{n:0}).n,per=FMODES[fMode].f+FMODES[fMode].b;
  if(b&&cur){const inB=(SYS.ses[tk]||[]).filter(x=>x[0]>b.s&&x[0]<=b.e).length,tot=Math.max(inB+1,Math.round((b.e-b.s)/per));return{n:inB+1,tot,done}}return{n:done+1,tot:0,done}}
function focFull(){const D=q1('#sxFoc');if(!D)return;const brk=fPhase==='break',I=sesInfo(),full=!fRun&&fLeft>=fTotal-.5;
  D.classList.toggle('brk',brk);D.classList.toggle('run',fRun);
  q1('#sxfSt').textContent=brk?`BREAK · ${FMODES[fMode].b} MIN`:full?'READY':!fRun?'PAUSED':`FOCUS · SESSION ${I.n}${I.tot?' OF '+I.tot:''}`;
  const m=nowMin(),left=fRun?(fEnd-Date.now())/1000:fLeft;q1('#sxfSub').textContent=brk?(fRun?`Back at ${hm(m+Math.ceil(left/60))}`:'Break paused'):fRun?`Break at ${hm(m+Math.ceil(left/60))}`:full?`${FMODES[fMode].f} minutes · press Lock in`:'Paused · the shadow does not wait';
  const fd=I.tot?I.n-1:I.done,nd=I.tot?Math.min(I.tot,12):Math.max(4,Math.ceil((I.done+1)/4)*4);q1('#sxfDots').innerHTML=Array.from({length:nd},(_,i)=>`<i class="${i<fd?'f':i===fd&&!brk&&fRun?'n':''}"></i>`).join('');q1('#sxfDots').title=I.tot?`Session ${I.n} of ${I.tot} in this block`:`${I.done} sessions today`;
  D.querySelectorAll('#sxfModes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===fMode));
  const sj=(typeof b2FSubj!=='undefined'&&b2FSubj)||(curBlock()||{}).subj;D.querySelectorAll('#sxfSj button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===sj));
  q1('#sxfGo').textContent=q1('#fGo').textContent;const qb=q1('#sxfQuit'),armed=Date.now()-P2.quitT<4000;
  qb.textContent=brk?'Skip break':armed?'Tap again to quit':'Quit';qb.classList.toggle('warn',armed&&!brk);qb.disabled=!brk&&full;q1('#sxfReset').disabled=full;
  focBlk();cfListF();focRace();focSide();focTick(true)}
function focTick(noFull){const D=q1('#sxFoc');if(!D)return;const left=fRun?Math.max(0,(fEnd-Date.now())/1000):fLeft,on=Math.round((fTotal?1-left/fTotal:0)*60);
  /* a new session starts: the time left jumped up or the phase changed */
  if(fPhase!==P2.prevPh||left>P2.prevLeft+2){if(fPhase==='focus')P2.A={n:0,sec:0};P2.prevPh=fPhase;if(!noFull){P2.prevLeft=left;focFull();return}}P2.prevLeft=left;
  const s=Math.round(left);q1('#sxfTm').textContent=`${p2(Math.floor(s/60))}:${p2(s%60)}`;
  const t=D.querySelectorAll('#sxfRing .t');if(+D.dataset.on!==on){D.dataset.on=on;t.forEach((l,i)=>l.classList.toggle('on',i<on))}
  const sig=[fPhase,fRun,fMode,(FO.log[todayK()]||{n:0}).n,nowMin()>>2].join('|');if(!noFull&&sig!==P2.sig){P2.sig=sig;focFull()}}
document.addEventListener('visibilitychange',()=>{if(typeof fRun==='undefined')return;
  if(document.hidden){if(fRun&&fPhase==='focus')P2.awayAt=Date.now();return}
  if(!P2.awayAt)return;const sec=(Date.now()-P2.awayAt)/1000;P2.awayAt=0;if(sec<3||!fRun||fPhase!=='focus')return;
  P2.A.n++;P2.A.sec+=sec;const tk=todayK(),a=SYS.away||(SYS.away={});a[tk]=[((a[tk]||[0,0])[0]+1),Math.round((a[tk]||[0,0])[1]+sec)];const ks=Object.keys(a).sort();while(ks.length>21)delete a[ks.shift()];saveSys();
  const B=q1('#sxfBan');if(B&&isShadow()){B.innerHTML=`<span>You left the tab for <b class="num">${ssm(sec)}</b>. The timer kept running; the shadow saw it.</span><button type="button" class="sx2-btn sm">Back to work</button>`;B.hidden=false;clearTimeout(P2.banT);P2.banT=setTimeout(()=>B.hidden=true,12000)}
  if(pageOf()==='foc')focFull()});

/* ================= CALENDAR ================= */
const CAL_SJ=['phy','chem','maths'];
function calPost(){if(!isShadow()||typeof curKeys==='undefined'||!curKeys.length)return;const tk=todayK(),m=nowMin(),X=focusNode();
  document.querySelectorAll('#cBody .col').forEach(col=>{const k=col.dataset.k,L=CS.days[k]||[],by=new Map(L.map(e=>[String(e.id),e]));
    const evs=[...col.querySelectorAll('.ev')].map(el=>({el,e:by.get(el.dataset.id)})).filter(x=>x.e).sort((a,b)=>a.e.s-b.e.s);
    let run=[];const flush=()=>{if(run.length>1){const f=run[0],l=run[run.length-1];f.el.style.height=Math.max(12,(l.e.e-f.e.s)/60*HH-2)+'px';f.el.classList.add('sx-merge');
        f.el.querySelector('.et').textContent=run.map(x=>x.e.title).join(' · ');f.el.title=run.map(x=>`${hm(x.e.s)}–${hm(x.e.e)} ${x.e.title}`).join('\n');run.slice(1).forEach(x=>x.el.classList.add('sx-hide'))}run=[]};
    for(const x of evs){const{el,e}=x,dur=e.e-e.s,full=/calc\(0%/.test(el.style.left)&&/calc\(100%/.test(el.style.width);
      el.classList.remove('sx-now','sx-miss','sx-tiny','sx-merge','sx-hide','sx-dim');
      if(dur<30){el.classList.add('sx-tiny');el.style.height=Math.max(12,dur/60*HH-2)+'px';el.title=`${hm(e.s)}–${hm(e.e)} ${e.title}`}
      if(X&&k===X.date&&e.s===X.s&&e.title===X.title&&m>=e.s&&m<e.e)el.classList.add('sx-now');
      if(!e.done&&isStudy(e)&&(k<tk||(k===tk&&e.e<=m)))el.classList.add('sx-miss');
      if(e.subj==='life'&&dur<30&&full){if(run.length&&run[run.length-1].e.e<e.s)flush();run.push(x)}else flush()}flush()});
  calSide();calLinks()}
function calSide(){const side=q1('#calPage .cside');if(!side)return;let box=side.querySelector('#sxCalSide');if(!box){box=document.createElement('div');box.id='sxCalSide';side.querySelector('.filt')?.before(box)}
  const keys=curKeys,tk=todayK(),hrs={phy:0,chem:0,maths:0};let st=0,sd=0,ch=0,cd=0,foc=0;
  for(const k of keys){for(const e of CS.days[k]||[]){if(!isStudy(e))continue;if(hrs[e.subj]!=null)hrs[e.subj]+=(e.e-e.s)/60;st++;if(e.done)sd++;if(e.kind==='class'){ch+=(e.e-e.s)/60;if(e.done)cd+=(e.e-e.s)/60}}foc+=((FO.log||{})[k]||{min:0}).min}
  const nf=x=>+x.toFixed(1);
  document.querySelectorAll('#calPage .filt label').forEach(l=>{const f=l.querySelector('input')?.dataset.f;let b=l.querySelector('.sx-h');if(!b){b=document.createElement('b');b.className='sx-h num';l.appendChild(b)}b.textContent=hrs[f]!=null?nf(hrs[f])+' h':''});
  const owe=[];for(const k in CS.days)for(const e of CS.days[k])if(e.cu&&!e.done)owe.push(e);const oh=owe.reduce((a,e)=>a+(e.e-e.s),0),due=owe.map(e=>e.cu.due).sort()[0],late=owe.filter(e=>e.date<tk).length;
  const wkLab=keys[0]<=tk&&tk<=keys[6]?'This week':'That week';
  box.innerHTML=`<section class="card sx2-cu"><h2>Catch-up owed</h2><div class="big num">${fmH(oh)}</div><p>${owe.length?`${owe.length} block${owe.length>1?'s':''} · due by ${fmtD(due)}${late?` · <b class="warn">${late} overdue</b>`:''}`:'Nothing owed. Keep it that way.'}</p></section>
    <section class="card sx2-wk"><h2>${wkLab}</h2><div class="sx2-row"><span>Blocks done</span><b class="num">${sd} / ${st}</b></div><div class="sx2-row"><span>Class hours</span><b class="num">${nf(cd)} / ${nf(ch)}</b></div><div class="sx2-row"><span>Focus, verified</span><b class="num">${fmH(foc)} h</b></div></section>`;
  const bar=q1('#calPage .cbar');if(bar&&!bar.querySelector('#sxLinks')){const b=document.createElement('button');b.id='sxLinks';b.type='button';b.className='tbtn sx2-only';bar.querySelector('#cFs')?.before(b);b.addEventListener('click',()=>{P2.links=!P2.links;calLinks()})}
  const lb=q1('#sxLinks');if(lb){lb.textContent=P2.links?'Hide links':'Links for the current block';lb.setAttribute('aria-pressed',P2.links)}}
function calLinks(){const cb=q1('#cBody');if(!cb)return;cb.querySelector('#sxLk')?.remove();cb.classList.toggle('sx-lk',P2.links);const lb=q1('#sxLinks');if(lb){lb.textContent=P2.links?'Hide links':'Links for the current block';lb.setAttribute('aria-pressed',P2.links)}
  if(!P2.links||!isShadow())return;const X=focusNode();if(!X)return;const G=graphAll(),S=new Set([X.i,...X.par,...X.kids]);X.kids.forEach(i=>G[i].kids.forEach(j=>{if(G[j].unit&&G[j].unit===G[i].unit)S.add(j)}));
  const elOf=n=>{if(!curKeys.includes(n.date))return null;return cb.querySelector(`.col[data-k="${n.date}"] .ev[data-id="${CSS.escape(String(n.id))}"]`)};
  const r0=cb.getBoundingClientRect();let h='';const lit=new Set();
  for(const i of S){const n=G[i];for(const pi of n.par){if(!S.has(pi))continue;const a=elOf(G[pi]),b=elOf(n);if(!a||!b)continue;lit.add(a);lit.add(b);const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
    const x1=ra.right-r0.left,y1=ra.top+Math.min(ra.height/2,18)-r0.top,x2=rb.left-r0.left,y2=rb.top+Math.min(rb.height/2,18)-r0.top,dx=Math.max(30,Math.abs(x2-x1)/2),on=pi===X.i||i===X.i;
    h+=`<path class="${on?'n':''}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1+dx).toFixed(1)} ${y1.toFixed(1)} ${(x2-dx).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/><circle class="${on?'n':''}" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3"/>`}}
  cb.querySelectorAll('.ev').forEach(e=>e.classList.toggle('sx-dim',!lit.has(e)));
  if(!h){toast&&toast('The current block has no links in this week.');return}
  cb.insertAdjacentHTML('beforeend',`<svg id="sxLk" aria-hidden="true">${h}</svg>`)}

/* ================= LIBRARY ================= */
const isX=u=>/x$/.test(u.k)&&u.k!=='redox';
function libUnit(u,tk,X){const bl=unitBlocks(u.k),d=bl.filter(e=>e.done).length,xs=CLASSES.filter(x=>isX(x)&&x.k.slice(0,-1)===u.k).flatMap(x=>unitBlocks(x.k)),xd=xs.filter(e=>e.done).length;
  const nx=bl.find(e=>!e.done&&e.date>=tk);let st='next';
  if(X&&X.date===tk&&X.unit===u.k)st='now';else if(bl.some(e=>e.date===tk&&!e.done))st='today';else if(bl.length&&d===bl.length)st='done';else if(!nx&&bl.length)st='late';else if(d||(bl[0]&&bl[0].date<tk))st='prog';
  return{u,bl,d,xs,xd,nx,st}}
const stLab=(I)=>({now:'NOW',today:'CLASS TODAY',prog:'IN PROGRESS',late:'OVERDUE',done:'DONE'})[I.st]||(I.nx?'NEXT '+fmtD(I.nx.date).toUpperCase():'NOT IN PLAN');
function libCard(I){const{u,bl,d,xs,xd}=I,nd=unitNeeds(u.k).filter(k=>UNIT_BY[k]),ul=unitUnlocks(u.k).filter(k=>!isX(UNIT_BY[k])),ok=k=>{const b=unitBlocks(k);return b.length&&b.every(e=>e.done)};
  return `<article class="sxl-card st-${I.st}" style="--sj:${SJC[u.subj]}"><button type="button" class="lb-main sxl-main" data-u="${u.k}" aria-expanded="false">
    <div class="t"><div><h4 class="si">${esc2(u.si)}</h4><div class="en"><i class="sx2-dot"></i>${esc2(u.en)}</div></div><span class="state num">${stLab(I)}</span></div>
    <div class="segs">${segHtml(Math.min(bl.length,30)||1,bl.length?Math.round(d/bl.length*Math.min(bl.length,30)):0)}</div>
    <div class="m"><span><b class="num">${d}</b> / ${bl.length} days</span>${xs.length?`<span>+ extras <b class="num">${xd}/${xs.length}</b></span>`:''}${u.tag?`<span>${esc2(u.tag)}</span>`:''}${cfOpen(u.k)?`<span class="cfq">? ${cfOpen(u.k)} open</span>`:''}</div>
    ${nd.length||ul.length?`<div class="dep">${nd.map(k=>`<span class="chip${ok(k)?' ok':''}">${ok(k)?'✓ ':''}needs ${esc2(UNIT_BY[k].en.replace(/ extras$/,''))}</span>`).join('')}${ul.slice(0,2).map(k=>`<span class="chip">unlocks ${esc2(UNIT_BY[k].en)}</span>`).join('')}</div>`:''}</button></article>`}
function libShadow(){const box=q1('#lbList');if(!box)return;const tk=todayK(),X=focusNode();let ok=lbOpen&&UNIT_BY[lbOpen];if(ok&&isX(UNIT_BY[lbOpen]))lbOpen=lbOpen.slice(0,-1);
  const I=CLASSES.filter(u=>u.subj===lbS&&!isX(u)).map(u=>libUnit(u,tk,X));
  if(lbOpen&&UNIT_BY[lbOpen]){box.innerHTML=libOpen(I.find(x=>x.u.k===lbOpen)||libUnit(UNIT_BY[lbOpen],tk,X),tk,X);return}
  const prog=I.filter(x=>['now','late','today','prog'].includes(x.st)).sort((a,b)=>['now','late','today','prog'].indexOf(a.st)-['now','late','today','prog'].indexOf(b.st)),nx=I.filter(x=>x.st==='next').sort((a,b)=>(a.nx?.date||'9')<(b.nx?.date||'9')?-1:1),dn=I.filter(x=>x.st==='done');
  box.innerHTML=`<div class="sxl-grid">${prog.length?`<div class="sxl-sect">In progress</div>${prog.map(libCard).join('')}`:''}${nx.length?`<div class="sxl-sect">Coming up</div>${nx.map(libCard).join('')}`:''}${dn.length?`<div class="sxl-sect">Done</div>${dn.map(libCard).join('')}`:''}</div>`}
function libOpen(I,tk,X){const{u,bl,d,xs,xd,nx}=I,k=u.k,rec=REC[u.rec||k]||'',S=(window.SUMMARY||{})[k],st=typeof STORY!=='undefined'&&STORY[k];
  const tabs=[['days','Days'],S?['sum','සාරාංශය']:null,st?['story','Story']:null,['fb','Formulas'],['qb','Past questions'],['cf','Confused'+(cfOpen(k)?' · '+cfOpen(k):'')]].filter(Boolean);
  let t=P2.tab[k]||'days';if(!tabs.some(x=>x[0]===t))t='days';
  const row=(e,i,first)=>{const now=X&&X.date===e.date&&X.s===e.s&&X.title===e.title,miss=!e.done&&e.date<tk;
    return `<div class="sxl-d${e.done?' ok':''}${now?' now':''}${e===first?' nx':''}${miss?' miss':''}"><span class="n num">${p2(i+1)}</span><b class="si">${esc2(e.title)}</b><span class="d num">${e.done?fmtD(e.date):now?'Now · '+hm(e.s):e.date===tk?'Today · '+hm(e.s):miss?fmtD(e.date)+' · missed':e===first?'Next · '+fmtD(e.date):fmtD(e.date)}</span><span class="tk" aria-label="${e.done?'done':'not done'}">${e.done?'✓':''}</span></div>`};
  const first=bl.find(e=>!e.done&&e.date>=tk&&!(X&&X.date===e.date&&X.s===e.s)),fx=xs.find(e=>!e.done&&e.date>=tk);
  let body='';if(t==='days')body=(bl.map((e,i)=>row(e,i,first)).join('')||'<p class="sx2-cap">No class days for this unit in the plan.</p>')+(xs.length?`<div class="sxl-xh">Extras · ${xd} of ${xs.length}</div>${xs.map((e,i)=>row(e,i,fx)).join('')}`:'');
  else if(t==='sum'){smOpen[k]=true;body=sumHtml(k)}else if(t==='story')body=storyHtml(k);else if(t==='fb')body=fbList(k)||'<p class="sx2-cap">No formulas listed for this unit yet.</p>';
  else if(t==='qb')body=qbList(k)||'<p class="sx2-cap">No tagged past questions for this unit yet.</p>';else body=cfList(k)||'<p class="sx2-cap">Nothing here. Questions you write in Focus land on this tab.</p>';
  const nd=unitNeeds(k).filter(x=>UNIT_BY[x]),ul=unitUnlocks(k).filter(x=>!isX(UNIT_BY[x]));
  return `<div class="sxl-open" style="--sj:${SJC[u.subj]}"><aside class="sx2-pl sxl-side"><button type="button" class="sx2-btn sm" data-sxback>← All units</button>
      <div class="sx2-cap" style="margin-top:14px"><i class="sx2-dot"></i>${SUBJ[u.subj]}${u.tag?' · '+esc2(u.tag):''}</div><h2 class="si">${esc2(u.si)}</h2><div class="en">${esc2(u.en)}</div>
      <div class="sxl-stat"><div><b class="num">${d}/${bl.length}</b><span>class days</span></div><div><b class="num">${nx?(nx.date===tk?hm(nx.s):fmtD(nx.date).split(' ').slice(0,2).join(' ')):'—'}</b><span>${nx&&nx.date===tk?'class today':'next class'}</span></div>${xs.length?`<div><b class="num">${xd}/${xs.length}</b><span>extras</span></div>`:''}<div><b class="num">${cfOpen(k)}</b><span>open questions</span></div></div>
      <p class="sx2-cap">Needs: ${nd.map(x=>esc2(UNIT_BY[x].en)).join(', ')||'nothing'}<br>Unlocks: ${ul.map(x=>esc2(UNIT_BY[x].en)).join(', ')||'nothing'}</p>
      ${rec?`<a class="sx2-btn sm sxl-rec" href="${rec}" target="_blank" rel="noopener">▶ Recordings</a>`:''}</aside>
    <section class="sx2-pl sxl-main2"><div class="sxl-tabs" role="tablist">${tabs.map(([v,n])=>`<button type="button" role="tab" data-sxt="${k}|${v}" aria-selected="${v===t}" class="${/[඀-෿]/.test(n)?'si':''}">${n}</button>`).join('')}</div><div class="sxl-body sxl-${t}">${body}</div></section></div>`}

function mapPost(){const svg=q1('#lmSvg');if(!svg)return;const X=focusNode(),tk=todayK();let cu=X&&X.date===tk&&X.unit?X.unit.replace(/x$/,''):null;
  const tiles=[...svg.querySelectorAll('.lm-tile')];if(!cu||!tiles.some(t=>t.dataset.k===cu))cu=(tiles.find(t=>t.classList.contains('lm-now'))||{dataset:{}}).dataset.k||null;
  tiles.forEach(t=>{const k=t.dataset.k;if(t.classList.contains('lm-now')&&k!==cu)t.classList.add('sx-calm');
    const xs=CLASSES.filter(x=>isX(x)&&x.k.slice(0,-1)===k).flatMap(x=>unitBlocks(x.k));const l2=t.querySelector('.lm-l2');if(xs.length&&l2&&!l2.dataset.x){l2.dataset.x=1;l2.textContent+=` · +extras ${xs.filter(e=>e.done).length}/${xs.length}`}});
  [...svg.querySelectorAll('g[pointer-events="none"]')].forEach(g=>{const r=g.querySelector('rect'),tx=g.querySelector('text');if(!r||!tx||!/You are here/.test(tx.textContent))return;
    const t=tiles.find(t=>{const p=t.querySelector('.lm-top');if(!p)return false;const b=p.getBBox();return Math.abs(b.x+b.width/2-(+r.getAttribute('x')+38))<2});
    if(!t||t.dataset.k!==cu){g.remove();return}r.setAttribute('fill','#7dffa8');g.querySelector('path')?.setAttribute('fill','#7dffa8');tx.setAttribute('fill','#07140c');tx.style.fontFamily='Geist,sans-serif'})}
/* ---------- wiring ---------- */
function p2wrap(){const w=(n,f)=>{const o=window[n];if(typeof o!=='function'||o.__sx)return;const g=function(){try{if(isShadow()&&n==='renderLibrary'&&lbV==='map'&&!P2.msel[lbS]){P2.msel[lbS]=1;const X=focusNode();if(X&&X.unit&&X.date===todayK())lmSel=X.unit.replace(/x$/,'')}}catch(e){}const r=o.apply(this,arguments);try{if(isShadow())f()}catch(e){console.error(e)}return r};g.__sx=1;window[n]=g};
  w('renderWeek',calPost);w('renderLibrary',()=>{if(lbV==='map')mapPost();else if(lbS!=='maths')libShadow()})}
function p2refresh(){bars();barTick();const pg=pageOf();if(!isShadow())return;
  if(pg==='foc'){focBuild();focFull()}if(pg==='cal'&&typeof renderWeek==='function')renderWeek();if(pg==='lib'&&typeof renderLibrary==='function')renderLibrary()}
function p2boot(){p2wrap();bars();focBuild();
  document.addEventListener('click',e=>{const g=e.target.closest('[data-sxgo]');if(g){goP(g.dataset.sxgo);return}
    const bk=e.target.closest('[data-sxback]');if(bk){lbOpen=null;renderLibrary();return}const t=e.target.closest('[data-sxt]');if(t){const[k,v]=t.dataset.sxt.split('|');P2.tab[k]=v;renderLibrary();q1('.sxl-tabs [aria-selected="true"]')?.focus()}});
  const sigC=()=>pageOf()+'|'+isShadow();let last=sigC();
  const mo=new MutationObserver(()=>{const s=sigC();if(s===last)return;const wasSh=last.endsWith('true');last=s;const pg=pageOf();
    if(isShadow()){if(pg)p2refresh();return}
    if(wasSh){q1('#sxLk')?.remove();q1('#cBody')?.classList.remove('sx-lk');try{renderWeek();renderLibrary()}catch(e){}}});
  mo.observe(document.body,{attributes:true,attributeFilter:['class']});mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  setInterval(()=>{if(!isShadow())return;const pg=pageOf();if(pg==='foc')focTick()},250);
  setInterval(()=>{if(!isShadow())return;barTick();const pg=pageOf();if(pg==='foc'){logSessions();focFull()}if(pg==='cal'&&P2.links)calLinks()},20000);
  if(isShadow())p2refresh()}
/* ===/P2=== */

/* ---------- boot ---------- */
function boot(){const main=document.querySelector('main');if(!main)return;if(isShadow())fonts();box=document.createElement('div');box.id='shx';box.setAttribute('aria-label','Shadow Protocol home');const top=main.querySelector(':scope>.top');top?top.after(box):main.prepend(box);
  const b=document.getElementById('modeBtn');if(b)b.setAttribute('aria-pressed',isShadow());
  render(true);sleepGuard();p2boot();
  new MutationObserver(()=>{if(onHome()){if(!box.querySelector('.sx-grid'))render(true);else{render();drawGraph(true);wave()}}}).observe(document.body,{attributes:true,attributeFilter:['class']});
  const rows=document.getElementById('rows');if(rows)new MutationObserver(()=>render()).observe(rows,{childList:true,subtree:true,attributes:true});
  setInterval(()=>{if(logSessions()&&onHome())render()},15000);logSessions();snapMB();setInterval(()=>{snapMB();if(!document.hidden)render()},20000);
  /* tests and the demo button need a way to fire moments by hand */
  window.ShadowProtocol={totals,levelOf,rankOf,ledger,trajectory,XP,RANKS,setMode,render:()=>render(true),openFull,closeFull,fitAll,zoomC,graphAll,homeGraph,shadow,logSessions,lvSeq:(u)=>{const T=totals(),lv=levelOf(T.tot);lvSeq(!!u,Math.max(1,lv.L-1),lv,rankOf(lv.L))}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
