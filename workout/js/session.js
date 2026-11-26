/* The session screen: warm-up -> sets (hologram demonstrates, reps stepper or hold countdown) -> timed rests
   -> cool-down -> complete. Logs go to lockin-workout-v1 in the {d,e,set,reps,secs,t} shape. Every spoken line goes through narrator.js speak(). */
import {EX as EX0,SESS,blocksFor,timing,WARM,COOL,TRANS,WSTART,isDeload,phase as phaseOf} from './plan.js';
/* exercise table for this session: in training weeks 1-2 the neck work is isometric holds (4 x 15 s) */
let EX=EX0;
import {lastSession,pb,ymd,mondayOf} from './data.js';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
/* the muscles the shown exercise trains glow green on the hologram (main brighter, helpers softer) */
/* equipment for the shown level: backpack worn (or held for rows and curls), books under the hands */
const kitFor=(S,e)=>{const x=EX[e]||{},step=x.lad?x.lad[S.lvl[e]??x.start??0]:'';return{pack:/backpack/i.test(step)?(['row','row1','curl'].includes(e)?'hands':'back'):null,handBooks:/hands on books/i.test(step)}};
const glowFor=e=>({});
const mmss=s=>{s=Math.max(0,Math.round(s));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const ICON={pause:'<svg viewBox="0 0 16 16"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',play:'<svg viewBox="0 0 16 16"><path d="M5 3.5v9l7-4.5z"/></svg>',back:'<svg viewBox="0 0 16 16"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',next:'<svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',redo:'<svg viewBox="0 0 16 16"><path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10"/></svg>',skip:'<svg viewBox="0 0 16 16"><path d="M4 3.5l5 4.5-5 4.5M11.5 3.5v9"/></svg>',ok:'<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  vol:'<svg viewBox="0 0 16 16"><path d="M3 6h2.5L9 3.5v9L5.5 10H3zM11.5 5.5a3.5 3.5 0 0 1 0 5"/></svg>',mute:'<svg viewBox="0 0 16 16"><path d="M3 6h2.5L9 3.5v9L5.5 10H3zM11.5 6l3 4M14.5 6l-3 4"/></svg>',x:'<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>'};
/* voice: Coach (plain) or Baku (cold, deep, slow; the Shadow-mode voice). The player lives in narrator.js. */
import {V,saveV,say as voice,stop as hush,setMuted,speakable,ID} from './narrator.js';
export {speakable};
const COACH=()=>V.who!=='baku';
export function start(o){const {S,T,TK,SID,H}=o,el=document.getElementById('woSess');if(!SID){return}
  {const wk=Math.floor((mondayOf(T)-mondayOf(WSTART))/6048e5)+1,n=EX0.neck;EX=n.iso&&wk<=n.iso.weeks?{...EX0,neck:{...n,kind:'hold',rng:[n.iso.secs,n.iso.secs],cue:'Push your head gently into your hand: front, back, left, right, 15 seconds each.'}}:EX0}
  const S0=SESS[SID],B=blocksFor(SID,T),plan=timing(SID,T).total;
  /* the queue of steps */
  const Q=[{k:'warm',secs:WARM}];B.forEach(([ex,r,rest],bi)=>{for(let i=1;i<=r;i++)ex.forEach((e,j)=>{const last=j===ex.length-1;Q.push({k:'set',e,set:i,of:r,block:bi,pair:ex,rest:last?(i===r&&bi===B.length-1?0:rest):TRANS})})});Q.push({k:'cool',secs:COOL});
  let at=0,phase='work',left=0,run=false,started=Date.now(),paused=0,pauseAt=0,iv=null,reps=0,logs=[],pbs=[];
  /* coming back to a half-done session: carry today's logged sets and resume at the first set not logged yet */
  {const prev=S.logs.filter(l=>l.d===TK);if(prev.length){const has=new Set(prev.map(l=>l.e+'#'+l.set));const i=Q.findIndex(q=>q.k==='set'&&!has.has(q.e+'#'+q.set));logs=prev.slice();at=i<0?Q.length-1:i}}
  const sets=Q.filter(q=>q.k==='set').length;
  el.innerHTML=`<div class="s-top"><h1 id="sName"></h1><button class="btn ghost" id="sVoice" aria-label="Voice"></button><div class="seg" role="group" aria-label="Narrator"><button data-v="coach">Coach</button><button data-v="baku">Baku</button></div><button class="btn ghost" id="sClose" aria-label="Close session">${ICON.x}</button></div>
    <div class="s-sub"><span id="sWhere"></span><span class="sp" style="flex:1"></span><span class="num" id="sTime"></span></div><div class="segs" id="sSegs">${Q.filter(q=>q.k==='set').map(()=>'<i></i>').join('')}</div>
    <div class="s-main"><div class="s-stage" id="sStage"><div class="tag" id="sTag"></div><div class="cue" id="sCue"></div><div class="restov" id="sRest"><span class="k" id="sRestK">Rest</span><div class="big num" id="sRestN">0:00</div><span id="sRestNx" style="color:var(--i2)"></span><button class="btn" id="sRestSkip" style="margin-top:10px">${ICON.skip} <span id="sRestSk">Skip rest</span></button></div></div>
      <div class="s-side"><div class="s-card" id="sMain"></div><div class="s-card"><div class="ctl"><button class="btn pri done" id="sDone">${ICON.ok} Done set</button><button class="btn" id="sBack">${ICON.back} Back</button><button class="btn" id="sRedo">${ICON.redo} Restart</button><button class="btn" id="sPause">${ICON.pause} Pause</button><button class="btn" id="sNext">${ICON.next} Next</button></div></div>
        <div class="s-card upnext" id="sUp"></div><div class="s-card splan" id="sPlan"></div></div></div>`;
  el.classList.add('on');document.body.style.overflow='hidden';
  if(H){H.inSession=true;H.mount(el.querySelector('#sStage'));H.ctl.autoRotate=false;H.setMuscles({},null)}else el.querySelector('#sStage').insertAdjacentHTML('afterbegin','<div class="nogl"><p>3D is off on this device. Follow the cue below.</p></div>');
  const $=s=>el.querySelector(s);
  /* ---- narrator moments (all speech goes through narrator.js voice()) ----
     pend = lines waiting to be said before the next announcement (the verdict on the set just done, hold.end).
     Mid-set and last-reps cues are timers from the set announcement; any button press cancels them. */
  let pend=[],restLen=0,cueT=[],cueTok=0;
  function clearCues(){cueTok++;cueT.forEach(clearTimeout);cueT=[]}
  function announce(q,x,rng){clearCues();
    if(x.kind==='test'){voice(COACH()?[...pend,['dynamic',[ID.name(q.e)]],['moment','test.go']]:[...pend,['dynamic',[ID.name(q.e)]],['moment','workout.begin']]);pend=[];return}
    const cue=COACH()&&q.set===1?x.cue:'';
    const kind=x.kind==='reps'?'reps':x.mode==='count'?'count':x.mode==='hold'?'max':'hold',cueId=ID.cue(q.e==='neck'&&x.kind==='hold'?'neck-iso':q.e);
    voice(COACH()?[...pend,['dynamic',[ID.name(q.e),ID.set(q.set,q.of),ID.range(x.rng[0],x.rng[1],kind)]],...(cue?[['dynamic',[cueId]]]:[])]:[...pend,['dynamic',[ID.name(q.e),ID.set(q.set,q.of)]],['moment','workout.begin']]);pend=[];
    if(COACH()&&x.kind==='reps'){const per=(x.rng[0]+x.rng[1])/2*x.tempo*(x.uni?2:1)*1000,lead=2500+(cue.length*65),my=cueTok;
      const at1=(id,ms)=>cueT.push(setTimeout(()=>{if(my===cueTok&&!pauseAt&&phase==='work'&&cur()===q)voice([['moment',id]])},ms));
      at1('set.mid',lead+per*0.5);at1('set.last',lead+per*0.85)}}
  /* the verdict on a finished set, said before the rest line */
  function verdict(q,x,v,bestBefore){const sh=shadowOf(q),sv=sh?(sh.reps??sh.secs):null;let m;
    if(x.kind==='test'){const tb=testBest(x);m=tb&&v>tb.v?'test.record':'after.ok'}else if(bestBefore&&v>bestBefore.v)m='after.best';else if(sv!=null&&v>sv)m='after.beat';else if(sv!=null&&v<sv)m='after.rough';else m='after.ok';
    pend=[...pend,...(COACH()?[['moment',m]]:m==='after.rough'?[['moment','workout.again']]:[])];if(window.__WO_TEST)(window.__woVerdicts||(window.__woVerdicts=[])).push(m)}
  const vbtn=()=>{$('#sVoice').innerHTML=(V.on?ICON.vol:ICON.mute)+(V.on?' Voice on':' Muted');el.querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===V.who))};vbtn();
  $('#sVoice').addEventListener('click',()=>{setMuted(V.on);vbtn();if(!V.on)clearCues()});
  el.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{V.who=b.dataset.v;saveV();vbtn();voice([['dynamic',[ID.go()]]])}));
  const elapsed=()=>((pauseAt||Date.now())-started-paused)/1000;
  /* flip digits */
  const flipHTML=s=>{const t=mmss(s).padStart(5,'0');return `<div class="flip" aria-hidden="true">${[...t].map(c=>c===':'?'<span class="colon">:</span>':`<div class="fd" data-d="${c}"><div class="h t"><span>${c}</span></div><div class="h b"><span>${c}</span></div></div>`).join('')}</div>`};
  const flipSet=(root,s)=>{const t=mmss(s).padStart(5,'0').replace(':','');root.querySelectorAll('.fd').forEach((d,i)=>{const c=t[i];if(d.dataset.d===c)return;const old=d.dataset.d;d.dataset.d=c;d.querySelector('.t span').textContent=c;d.querySelector('.b span').textContent=c;
      const f=document.createElement('div');f.className='fl';f.innerHTML=`<span>${old}</span>`;d.appendChild(f);requestAnimationFrame(()=>d.classList.add('go'));setTimeout(()=>{f.remove();d.classList.remove('go')},280)})};
  function cur(){return Q[at]}
  function nextSet(i){for(let j=i+1;j<Q.length;j++)if(Q[j].k==='set')return Q[j];return null}
  function shadowOf(q){return lastSession(S,q.e,TK).find(l=>l.set===q.set)}
  function render(){const q=cur(),segs=el.querySelectorAll('#sSegs i');let si=0;Q.forEach((x,i)=>{if(x.k!=='set')return;segs[si].className=i<at?'f':i===at?'n':'';si++});
    $('#sTime').textContent=`${mmss(elapsed())} / ${mmss(plan)}`;
    if(q.k==='warm'||q.k==='cool'){$('#sName').textContent=q.k==='warm'?'Warm-up':'Cool-down';$('#sWhere').textContent=q.k==='warm'?'60 s rope · arm and hip circles · 1 easy ramp set':'Stretch the muscles you trained · slow breathing';
      $('#sTag').innerHTML='';$('#sCue').textContent=q.k==='warm'?'Easy pace. You should feel warm, not tired.':'In through the nose, long breath out.';
      $('#sMain').innerHTML=`<span class="k">${q.k==='warm'?'Warm-up':'Cool-down'}</span>${flipHTML(left)}<div class="flab">${run?'counting down':'press Start'}</div>`;
      $('#sDone').innerHTML=`${ICON.ok} ${run?'Finish now':'Start'}`;H&&(H.pose(null),H.setMuscles({},null));upNext();return}
    const x=EX[q.e],sh=shadowOf(q),best=x.kind==='test'?testBest(x):pb(S,q.e),lv=S.lvl[q.e]??x.start??0;
    $('#sName').textContent=x.n;$('#sWhere').innerHTML=`${S0.test?'Test':q.pair.length>1?'Superset '+'ABCDEFG'[q.block]+' with '+esc(EX[q.pair.find(e=>e!==q.e)].n):'Block '+'ABCDEFG'[q.block]} · <b class="num" style="color:var(--ink)">set ${q.set} of ${q.of}</b>`;
    $('#sCue').textContent=x.cue;$('#sTag').innerHTML=x.lad?`<span class="chip">${esc(x.lad[lv])}</span>`:'';
    const cnt=x.kind==='reps'||x.mode==='count';
    if(cnt){if(phase==='work'&&!reps)reps=x.kind==='test'?(lastTest(x)||1):sh?(sh.reps??x.rng[0]):x.rng[0];
      const isPB=best&&reps>best.v;
      $('#sMain').innerHTML=`<span class="k">${x.kind==='test'?'Max reps · as many as you can with good form':`Target ${x.rng[0]}–${x.rng[1]} reps${x.uni?' each side':''} · RIR ${phaseRir()}`}</span>
        <div class="step"><button id="sMinus" aria-label="One less">−</button><output class="num" id="sReps" aria-live="polite">${reps}</output><button id="sPlus" aria-label="One more">+</button></div>
        <div class="flab">reps done${isPB?' · <span class="pb">New best</span>':''}</div>
        <div class="shadow"><span>${x.kind==='test'?'Last test':'Shadow (last session)'}</span><b>${x.kind==='test'?(lastTest(x)!=null?lastTest(x)+' reps':'no record yet'):sh?(sh.reps)+' reps':'no record yet'}</b></div><div class="shadow" style="border:0;margin:0;padding:0"><span>Best ever</span><b>${best?best.v:'–'}</b></div>`;
      $('#sMinus').addEventListener('click',()=>{reps=Math.max(0,reps-1);render()});$('#sPlus').addEventListener('click',()=>{reps++;render()});
      $('#sDone').innerHTML=`${ICON.ok} Done set`}
    else{const up=x.mode==='hold',tgt=up?0:Math.round((x.rng[0]+x.rng[1])/2);if(!up&&!run&&phase==='work'&&left<=0)left=tgt;
      $('#sMain').innerHTML=`<span class="k">${up?'Max hold · stop when your hips drop':'Hold '+(x.rng[0]===x.rng[1]?x.rng[0]:x.rng[0]+'–'+x.rng[1])+' s'+(x.uni?' each side':'')}</span>${flipHTML(left)}<div class="flab">${run?(up?'timing':'holding'):'press Start when you are in position'}</div>
        <div class="shadow"><span>${up?'Last test':'Shadow (last session)'}</span><b>${up?(lastTest(x)!=null?lastTest(x)+' s':'no record yet'):sh?(sh.secs??sh.reps)+(sh.secs?' s':''):'no record yet'}</b></div>`;
      $('#sDone').innerHTML=run?`${ICON.ok} Done`:`${ICON.play} Start hold`}
    H&&(H.pose(q.e,kitFor(S,q.e)),H.setMuscles(glowFor(q.e),null));upNext()}
  /* last month's challenge result (or the 18 Nov starting test) for a test exercise */
  function testBest(x){let v=null;for(const m in S.chal){const c=parseInt(S.chal[m][x.key]);if(!isNaN(c)&&(v==null||c>v))v=c}const b=parseInt({push:22,pull:6,plank:50,squat:20}[x.key]);if(v==null||b>v)v=b;return v==null?null:{v}}
  function lastTest(x){const ms=Object.keys(S.chal).sort().filter(m=>m<TK.slice(0,7)),c=ms.length?S.chal[ms.at(-1)]:{push:22,pull:6,plank:50,squat:20};const v=c&&c[x.key];return v==null?null:parseInt(v)}
  /* reps in reserve: same rule as the Today card (deload 3, otherwise the phase's value) */
  function phaseRir(){return SESS[SID].test?'0':isDeload(T)?'3':phaseOf(T).rir}
  function upNext(){const q=cur(),n=q.k==='set'?nextSet(at):null;const nx=q.k==='cool'?null:n||(at<Q.length-1?Q[at+1]:null);
    planCard();
    $('#sUp').innerHTML=nx?`<div><div class="k">Up next</div><b>${nx.k==='set'?esc(EX[nx.e].n)+' · set '+nx.set:nx.k==='cool'?'Cool-down':'Warm-up'}</b>${q.k==='set'&&q.rest?`<div style="font-size:12.5px;color:var(--i3)">after ${q.rest===TRANS?'a 15 s switch':q.rest+' s rest'}</div>`:''}</div>`:`<div><div class="k">Last step</div><b>Finish and save</b></div>`}
  function tick(){if(!run)return;const q=cur();const upH=q.k==='set'&&phase!=='rest'&&EX[q.e].mode==='hold';left+=upH?0.25:-0.25;
    if(upH){const root=$('#sMain');if(root.querySelector('.fd'))flipSet(root,left);$('#sTime').textContent=`${mmss(elapsed())} / ${mmss(plan)}`;return}
    if(phase==='rest'){flipSet($('#sRest'),left);$('#sRestN').textContent=mmss(left);if(COACH()&&restLen>=20&&left<=10.05&&left>9.8)voice([['moment','rest.ten']]);if(restLen!==TRANS&&left<=3.05&&left>2.8)voice([['dynamic',[ID.countdown()]]]);if(left<=0){run=false;restEnd()}return}
    const root=$('#sMain');if(root.querySelector('.fd'))flipSet(root,left);$('#sTime').textContent=`${mmss(elapsed())} / ${mmss(plan)}`;
    if(q.k==='set'&&COACH()&&EX[q.e].kind!=='test'){const tg=Math.round((EX[q.e].rng[0]+EX[q.e].rng[1])/2);if(tg>=20&&left<=tg/2+.05&&left>tg/2-.2)voice([['moment','set.mid']]);if(tg>=20&&left<=10.05&&left>9.8)voice([['moment','hold.ten']])}
    if(q.k!=='set'&&left<=0){run=false;advance();return}
    if(q.k==='set'&&left<=0){run=false;pend=COACH()?[['moment','hold.end']]:[];logHold(q,EX[q.e].kind==='test'?EX[q.e].secs:Math.round((EX[q.e].rng[0]+EX[q.e].rng[1])/2));afterSet(q)}}
  function timer(){clearInterval(iv);iv=setInterval(tick,250)}
  function planCard(){const L='ABCDEFG';let h='<div class="k">This session</div>';
    B.forEach(([ex],bi)=>{const its=Q.map((x,i)=>[x,i]).filter(([x])=>x.k==='set'&&x.block===bi);const now=its.some(([,i])=>i===at),fin=its.every(([,i])=>i<at);
      const got=ex.map(e=>logs.filter(l=>l.e===e).map(l=>l.reps!=null?l.reps:l.secs+'s'));
      h+=`<div class="sp-row${now?' now':''}${fin?' fin':''}"><span class="sp-l">${L[bi]}</span><div class="sp-b"><div class="sp-n">${ex.map(e=>esc(EX[e].n)).join(' + ')}</div><div class="sp-d">${its.map(([,i])=>`<i class="${i<at?'f':i===at?'n':''}"></i>`).join('')}${got.some(g=>g.length)?`<span class="sp-g">${got.map(g=>g.join(' ')).filter(Boolean).join(' / ')}</span>`:''}</div></div></div>`});
    $('#sPlan').innerHTML=h}
  function logSet(q,v){const x=EX[q.e];const b=pb(S,q.e);clearCues();verdict(q,x,v,b);const l={d:TK,e:q.e,set:q.set,reps:x.kind==='reps'||x.mode==='count'?v:null,secs:x.kind==='reps'||x.mode==='count'?null:v,t:Date.now()};S.logs.push(l);logs.push(l);if(b&&v>b.v)pbs.push(x.n);o.save(S)}
  function logHold(q,v){logSet(q,v)}
  function afterSet(q){burst();if(q.rest){phase='rest';left=q.rest;run=true;const n=nextSet(at);$('#sRest').classList.add('on');restLabel(q.rest);$('#sRestNx').textContent=n?'Next: '+EX[n.e].n+' · set '+n.set:'';$('#sRestN').textContent=mmss(left);
      restLen=q.rest;const nm=n?EX[n.e].n:'';voice(COACH()?[...pend,q.rest===TRANS?['dynamic',[n?ID.switchTo(n.e):{say:''}]]:['moment','rest.breathe',{secs:q.rest}]]:[...pend,q.rest===TRANS?['dynamic',[n?ID.name(n.e):{say:''}]]:['moment','workout.rest',{secs:q.rest}]]);pend=[];H&&n&&(H.pose(n.e,kitFor(S,n.e)),H.setMuscles(glowFor(n.e),null));timer()}else advance()}
  function restLabel(r){const mv=r===TRANS;$('#sRestK').textContent=mv?'Switch exercise':'Rest';$('#sRestSk').textContent='Skip';$('#sDone').disabled=true;$('#sDone').innerHTML=`${ICON.pause} ${mv?'Switching':'Resting'}`}
  function restEnd(){$('#sRest').classList.remove('on');$('#sDone').disabled=false;phase='work';advance()}
  function advance(){if(at>=Q.length-1){finish();return}at++;reps=0;left=0;phase='work';const q=cur();clearCues();if(q.k==='cool'){left=q.secs;voice([...pend,['dynamic',[{say:COACH()?'Cool-down. Stretch what you trained and slow your breathing.':'Cool-down. Ninety seconds.'}]]]);pend=[]}if(q.k==='set'){const x=EX[q.e];announce(q,x,x.kind==='reps'?`${x.rng[0]} to ${x.rng[1]} reps`:x.mode==='count'?'as many as you can':x.mode==='hold'?'hold as long as you can':(x.rng[0]===x.rng[1]?`hold ${x.rng[0]} seconds`:`hold ${x.rng[0]} to ${x.rng[1]} seconds`))}render()}
  $('#sDone').addEventListener('click',()=>{const q=cur();if(phase==='rest')return;
    if(q.k!=='set'){if(!run){left=left||q.secs;run=true;timer();if(q.k==='warm'&&COACH())voice([['moment','session.start',{session:SID}]]);render()}else{run=false;advance()}return}
    const x=EX[q.e];if(x.kind==='reps'||x.mode==='count'){logSet(q,reps);afterSet(q)}
    else if(!run){run=true;left=x.mode==='hold'?0:(left||Math.round((x.rng[0]+x.rng[1])/2));voice([['dynamic',[ID.countdown(),ID.go()]]]);timer();render()}
    else{run=false;const held=x.mode==='hold'?Math.round(left):Math.round((x.rng[0]+x.rng[1])/2-left);if(held<3){left=x.mode==='hold'?0:Math.round((x.rng[0]+x.rng[1])/2);render();return}logSet(q,held);afterSet(q)}});
  $('#sPause').addEventListener('click',()=>{clearCues();if(pauseAt){paused+=Date.now()-pauseAt;pauseAt=0;run=true;timer();$('#sPause').innerHTML=ICON.pause+' Pause'}else{pauseAt=Date.now();run=false;$('#sPause').innerHTML=ICON.play+' Resume'}});
  $('#sRedo').addEventListener('click',()=>{clearCues();const q=cur();run=false;left=q.k==='set'?0:q.secs;reps=0;render()});
  $('#sNext').addEventListener('click',()=>{if(phase==='rest'){run=false;restEnd();return}run=false;advance()});
  $('#sBack').addEventListener('click',()=>{clearCues();if(at>0){run=false;$('#sRest').classList.remove('on');$('#sDone').disabled=false;phase='work';at--;reps=0;left=0;render()}});
  $('#sRestSkip').addEventListener('click',()=>{run=false;restEnd()});
  $('#sClose').addEventListener('click',()=>close());
  const onKey=e=>{if(e.key==='Escape')close();if(e.key===' '&&e.target===document.body){e.preventDefault();$('#sDone').click()}};document.addEventListener('keydown',onKey);
  function close(){clearInterval(iv);clearCues();if(H){H.inSession=false;H.pose(null);H.frame(null)}hush();el.classList.remove('on');document.body.style.overflow='';document.removeEventListener('keydown',onKey);o.onExit&&o.onExit()}
  function burst(){const st=$('#sStage');const b=document.createElement('div');b.className='burst';b.innerHTML=Array.from({length:14},(_,i)=>{const a=i/14*6.283;return `<i style="position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:var(--acc);opacity:.9;transform:translate(-50%,-50%);animation:bp 600ms var(--ease) forwards;--x:${Math.cos(a)*120}px;--y:${Math.sin(a)*120}px"></i>`}).join('');st.appendChild(b);setTimeout(()=>b.remove(),700)}
  if(!document.getElementById('bpKF')){const st=document.createElement('style');st.id='bpKF';st.textContent='@keyframes bp{to{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(.4);opacity:0}}';document.head.appendChild(st)}
  function finish(){clearInterval(iv);const min=Math.max(1,Math.round(elapsed()/60));S.extra[TK]=Object.assign(S.extra[TK]||{},{done:min});
    if(S0.test){const c={d:TK};for(const l of logs){const x=EX[l.e];if(x&&x.key)c[x.key]=Math.max(c[x.key]||0,l.reps??l.secs??0)}if(Object.keys(c).length>1){const m=TK.slice(0,7),old=S.chal[m];if(old&&!old.d)c.pre=old;/* numbers typed in on the old page that month have no date: kept inside the new entry */S.chal[m]=old&&old.d?Object.assign(old,c):c}}o.save(S);const ticked=o.onFinish?o.onFinish(TK):false;
    const tot=logs.reduce((a,l)=>a+(l.reps||0),0),beat=logs.filter(l=>{const p=lastSession(S,l.e,TK).find(x=>x.set===l.set);return p&&(l.reps??l.secs)>(p.reps??p.secs)}).length;
    clearCues();voice(COACH()?[...pend,['moment','session.done',{min}]]:[...pend,['moment','workout.done']]);pend=[];showDone({min,sets:logs.length||sets,tot,beat,pbs,ticked})}
  function showDone(r){const d=document.getElementById('woDone');d.innerHTML=`<div class="done-c"><span class="k">Workout complete</span><h2>${esc(S0.n)} done</h2><p style="color:var(--i2);margin:0">Saved. ${r.ticked?'The Workout block in today’s routine is ticked.':'There is no Workout block in today’s routine to tick.'}</p>
      <div class="done-g"><div><b>${r.min}</b><span>${r.min===1?'minute':'minutes'}</span></div><div><b>${r.sets}</b><span>sets</span></div><div><b>${r.tot}</b><span>reps</span></div><div><b>${r.beat}</b><span>sets better than last time</span></div></div>
      ${r.pbs.length?`<div class="pbl">${[...new Set(r.pbs)].map(n=>`<span class="chip now"><span class="pb">New best</span> ${esc(n)}</span>`).join('')}</div>`:''}<button class="btn pri" id="dOk" style="min-width:200px">Back to Workout</button></div>`;
    d.classList.add('on');d.querySelector('#dOk').addEventListener('click',()=>{d.classList.remove('on');close()});d.querySelector('#dOk').focus()}
  render()}
