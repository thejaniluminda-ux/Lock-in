/* Lock In · Shadow Protocol (Phase 1: engine, mode switch, Status home).
   Reads the app's existing data; never writes to it. Its own state: lockin-system-v1 (sleep and phone check-ins,
   seen rank, message counts, intervention log) and lockin-profile-v1 (his own words and target, typed in the app,
   never in this file). Mode lives in lockin-mode-v1. All three are lockin-* keys, so backup/restore includes them.
   XP is recalculated from the data every time (nothing is stored), so ticking then unticking gives exactly zero. */
(()=>{
'use strict';
const SK='lockin-system-v1',PK='lockin-profile-v1',MK='lockin-mode-v1';
const rd=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch(e){return d}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let SYS=Object.assign({v:1,sleep:{},phone:{},seenRank:null,started:null,msg:{},log:[],off:{}},rd(SK,{}));
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
const RANKS=[[1,'Unranked'],[5,'Initiate'],[10,'Operator'],[20,'Specialist'],[30,'Vanguard'],[40,'Phantom'],[50,'Sovereign'],[60,'Apex'],[75,'Singular']];
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
  if(type==='why'){if(M.why>=1)return null;M.why++}else if(M.n>=4)return null;else M.n++;logI('say:'+type);return text}
function bakuLine(){const tk=todayK(),y=dk(add(now(),-1)),Y=CS.days[y]||[],planned=Y.filter(study).length,done=Y.filter(e=>e.done&&study(e)).length;
  const y2=dk(add(now(),-2)),Y2=CS.days[y2]||[],missed2=Y2.filter(study).length>0&&!Y2.some(e=>e.done&&study(e));
  const cached=SYS.line&&SYS.line.d===tk?SYS.line:null;if(cached)return cached.text;let text=null;
  if(y>=dk(START)&&planned&&done===0){text=missed2?say('restart','Two days down. Restart small: 25 minutes on the most important block. Nothing else.'):say('missed',`Yesterday: 0 of ${planned}. Today: here is what is due.`);
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

/* ---------- render the Status page ---------- */
let box=null,lastHtml='';
function gate(){const tk=todayK(),m=nowMin(),L=(CS.days[tk]||[]).slice().sort((a,b)=>a.s-b.s),cur=L.find(e=>study(e)&&m>=e.s&&m<e.e),nx=L.find(e=>study(e)&&e.s>m);
  const b=cur||nx;if(!b)return `<div class="sh-gate"><div class="sh-k">No more study blocks today</div><p>Night review at 22:30. Lights out 22:45.</p></div>`;
  return `<div class="sh-gate${cur?' now':''}"><div class="sh-k">${cur?'Now':'Next'} · ${hm(b.s)}–${hm(b.e)}${b===mib(tk)?' · <span class="sh-gold">most important</span>':''}</div><h3>${esc2(b.title)}</h3>
    <p class="sh-if">If-then: when this block starts, the phone goes outside the door and I press Begin.</p>
    ${cur&&!b.done?`<button class="sh-btn" data-begin>Begin · 2 minutes is enough to start</button>`:''}${b.done?'<p class="sh-ok">Logged.</p>':''}</div>`}
function render(force){if(!box||!isShadow()||document.body.className.includes('page-'))return;
  const T=totals(),lv=levelOf(T.tot),rank=rankOf(lv.L),P=prof(),M=missions(),R=record(),line=bakuLine();
  const tr=['phy','chem'].map(trajectory);const SN={phy:'Physics',chem:'Chemistry'};
  const html=`<div class="sh-top"><div><div class="sh-k">${phase()}</div>
      <div class="sh-rank"><span>${rank}</span><b>Level ${lv.L}</b></div>
      <div class="sh-lv"><i style="transform:scaleX(${(lv.into/lv.need).toFixed(3)})"></i></div><div class="sh-k">${lv.into} / ${lv.need} XP to level ${lv.L+1} · today +${T.today} · this week ${T.week} (last week ${T.lastWeek})</div></div>
      <div class="sh-baku"><div class="sh-owl">${typeof bkSvg==='function'?bkSvg('sleepy'):''}</div>${line?`<p>${esc2(line)}</p>`:''}</div></div>
    ${checks()}
    <div class="sh-grid">
      <section class="sh-panel sh-mis"><h4>Today's missions</h4>${M.length?'':'<p class="sh-note">No missions. The exam is done.</p>'}${M.map(x=>`<div class="sh-m${x.done?' ok':''}${x.mib?' mib':''}"><i></i><div><span>${x.t}${x.prog?' · '+x.prog:''}</span><b>${esc2(x.s)}</b></div></div>`).join('')}</section>
      <section class="sh-panel">${gate()}</section>
      <section class="sh-panel sh-tr"><h4>Trajectory · classes</h4>${tr.map(t=>`<div class="sh-t ${t.state}"><div class="sh-tl"><span>${SN[t.sj]}</span><span>${t.done} / ${t.total}</span></div><div class="sh-bar"><i class="plan" style="transform:scaleX(${t.total?(t.due/t.total).toFixed(3):0})"></i><i class="done" style="transform:scaleX(${t.total?(t.done/t.total).toFixed(3):0})"></i></div><p>${esc2(t.msg)}</p></div>`).join('')}
        <p class="sh-note">Bright = done, faint = due by today. Pace uses your last 14 days, so two bad weeks change it a lot. No exam predictions here.</p></section>
      <section class="sh-panel sh-rec"><h4>The Record</h4>${R.length?R.slice(0,6).map(([n,s])=>`<div><b>${n}</b><span>${s}</span></div>`).join(''):'<p class="sh-note">Empty. Every finished block, session and re-test lands here as evidence.</p>'}</section>
      <section class="sh-panel sh-goal"><h4>Target</h4>
        <label>Course<input data-prof="course" value="${esc2(P.course)}" placeholder="Course"></label>
        <label>Faculty and university<input data-prof="faculty" value="${esc2(P.faculty)}" placeholder="Faculty, university"></label>
        <label>Z-score needed<input data-prof="z" value="${esc2(P.z)}" placeholder="Fill in from the UGC handbook" inputmode="decimal"></label>
        <details><summary>Your why (private, stays on this laptop)</summary><label>Why I started<textarea data-prof="why" rows="3">${esc2(P.why)}</textarea></label><label>Worst-day line<input data-prof="line" value="${esc2(P.line)}"></label></details></section>
    </div>`;
  if(html!==lastHtml||force){box.innerHTML=html;lastHtml=html}
  /* rank change: the one dramatic moment */
  if(SYS.seenRank&&SYS.seenRank!==rank&&RANKS.findIndex(r=>r[1]===rank)>RANKS.findIndex(r=>r[1]===SYS.seenRank))rankUp(rank,lv.L);
  if(SYS.seenRank!==rank){SYS.seenRank=rank;saveSys()}
  if(!SYS.started){SYS.started={d:todayK(),L:lv.L,xp:T.tot};saveSys();firstLaunch(lv.L,rank,T.tot)}}
function overlay(html,ms){const o=document.createElement('div');o.className='sh-ov';o.innerHTML=html;document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const close=()=>{o.classList.remove('on');setTimeout(()=>o.remove(),300)};o.addEventListener('click',close);if(ms)setTimeout(close,ms);return o}
function rankUp(rank,L){logI('rankup',{rank});overlay(`<div class="sh-rk"><div class="sh-ring"></div><div class="sh-k">Rank</div><h2>${rank.split('').map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('')}</h2><div class="sh-k">Level ${L}</div></div>`,2600)}
function firstLaunch(L,rank,xp){const days=Math.max(1,Math.round((now()-START)/864e5)+1);logI('first');
  overlay(`<div class="sh-first"><div class="sh-k">Shadow Protocol</div><p>Starting level calculated from ${days} day${days>1?'s':''} of history: ${xp} XP.</p><h2>${rank} · Level ${L}</h2><p class="sh-note">Normal mode is still there. The eye icon switches back.</p></div>`,0)}

/* ---------- sleep guard: first open after 23:00 in this mode, once a night ---------- */
function sleepGuard(){const m=nowMin();if(!isShadow()||!(m>=1380||m<270))return;const night=m<270?dk(add(now(),-1)):todayK();if(SYS.guard===night)return;SYS.guard=night;saveSys();
  logI('say:sleep');overlay(`<div class="sh-first"><div class="sh-k">${hm(m)}</div><h2>Sleep is part of the plan.</h2><p>Close it.</p></div>`,0)}

/* ---------- mode switch ---------- */
function setMode(on,animate){const h=document.documentElement;if(on===isShadow())return;
  const go2=()=>{h.classList.toggle('shadow',on);wr(MK,on?'shadow':'normal');const b=document.getElementById('modeBtn');if(b)b.setAttribute('aria-pressed',on);logI(on?'mode:shadow':'mode:normal');render(true);if(on)sleepGuard()};
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const s=document.createElement('div');s.className='sh-scan';document.body.appendChild(s);setTimeout(go2,260);setTimeout(()=>s.remove(),700)}else go2()}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const mb=e.target.closest('#modeBtn');if(mb){setMode(!isShadow(),true);return}
  if(!box||!box.contains(e.target))return;
  const s=e.target.closest('[data-sleep]');if(s){const[d,b]=s.dataset.sleep.split('|');SYS.sleep[d]={b,t:Date.now()};saveSys();logI('check:sleep',{b});render(true);return}
  const n=e.target.closest('[data-phn]');if(n){const[d,v]=n.dataset.phn.split('|');SYS.phone[d]={night:v==='1'};saveSys();logI('check:phone-night',{v});render(true);return}
  const pm=e.target.closest('[data-phm]');if(pm){const[d,v]=pm.dataset.phm.split('|');SYS.phone[d].morning=v==='1';saveSys();logI('check:phone-morning',{v});render(true);return}
  if(e.target.closest('[data-begin]')){logI('begin');try{(typeof vgo==='function'?vgo:go)('Focus');setTimeout(()=>{if(typeof fRun!=='undefined'&&!fRun&&fPhase==='focus')document.getElementById('fGo').click()},400)}catch(x){}}});
document.addEventListener('change',e=>{const f=e.target.closest('[data-prof]');if(!f||!box||!box.contains(f))return;const P=prof();P[f.dataset.prof]=f.value.trim();wr(PK,P)});

/* ---------- boot ---------- */
function boot(){const main=document.querySelector('main');if(!main)return;box=document.createElement('div');box.id='shx';box.setAttribute('aria-label','Shadow Protocol status');const top=main.querySelector(':scope>.top');top?top.after(box):main.prepend(box);
  const b=document.getElementById('modeBtn');if(b)b.setAttribute('aria-pressed',isShadow());
  render(true);sleepGuard();
  new MutationObserver(()=>render()).observe(document.body,{attributes:true,attributeFilter:['class']});
  const rows=document.getElementById('rows');if(rows)new MutationObserver(()=>render()).observe(rows,{childList:true});
  setInterval(()=>{if(!document.hidden)render()},30000)}
window.ShadowProtocol={totals,levelOf,rankOf,ledger,trajectory,XP,RANKS,setMode,render:()=>render(true)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
