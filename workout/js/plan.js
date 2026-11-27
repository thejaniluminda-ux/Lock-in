/* Lock In Workout: the training plan as data.
   Everything the page, the session screen and the validator need comes from here.
   Timing model (seconds): a rep takes `tempo` s (3 s lowering + about 1 s up), every set adds SETUP s,
   a one-side exercise is done twice plus SWITCH s, holds take their seconds plus SETUP.
   Inside a superset: set A, TRANS s to move, set B, then the round rest. Between blocks BLOCK s. */
export const SETUP=8, SWITCH=10, TRANS=15, BLOCK=20, WARM=150, COOL=90, LIMIT=1800;

/* muscle groups shown on the hologram (keys match the 3D model's regions) */
export const MUSCLES={
  delt:{n:'Side delts',full:'Shoulders (side delts)',pri:1},
  back:{n:'Back and lats',full:'Upper back and lats',pri:2},
  chest:{n:'Chest',full:'Chest',pri:3},
  bi:{n:'Biceps',full:'Biceps',pri:3},
  tri:{n:'Triceps',full:'Triceps',pri:3},
  quad:{n:'Quads',full:'Quadriceps',pri:4},
  glute:{n:'Glutes',full:'Glutes',pri:4},
  ham:{n:'Hamstrings',full:'Hamstrings',pri:4},
  calf:{n:'Calves',full:'Calves',pri:5},
  core:{n:'Core',full:'Abs and obliques',pri:5},
  neck:{n:'Neck',full:'Neck',pri:5}
};
/* weekly hard-set targets (fractional: a helper muscle counts 0.5) */
export const RANGE={delt:[12,20],back:[12,20],chest:[10,20],bi:[10,20],tri:[8,20],quad:[10,20],glute:[10,20],ham:[8,20],calf:[8,16],core:[9,16],neck:[4,10]};

/* exercises. kind reps|hold, rng = target range (reps, or seconds for holds), tempo = seconds per rep,
   uni = one side at a time, m = muscles worked (1 = main, 0.5 = helper), lad = variation ladder (easy to hard),
   start = ladder step for week 1 from his tested numbers (18 Nov 2026) */
export const EX={
  pullup:{n:'Pull-ups',kind:'reps',rng:[5,8],tempo:4.5,m:{back:1,bi:0.5},start:0,
    lad:['Pull-ups, bodyweight','Pull-ups, 4-s lowering','Pull-ups + backpack (4 books)','Pull-ups + backpack (8 books)','Pull-ups + backpack (full)'],
    cue:'Dead hang, chest to the bar, slow controlled lowering.',why:'Lats and upper back: priority 2. You do 5 to 6 now.'},
  chinup:{n:'Chin-ups',kind:'reps',rng:[5,8],tempo:4.5,m:{back:1,bi:0.75},start:0,
    lad:['Chin-ups, bodyweight','Chin-ups, 4-s lowering','Chin-ups + backpack (4 books)','Chin-ups + backpack (8 books)'],
    cue:'Palms toward you, elbows down to your ribs.',why:'Second back day with more biceps.'},
  dpush:{n:'Decline push-ups',kind:'reps',rng:[10,15],tempo:4,m:{chest:1,tri:0.5},start:1,
    lad:['Decline push-ups (feet on chair)','Decline push-ups + backpack (4 books)','Decline push-ups + backpack (8 books)','Deficit decline push-ups + backpack (hands on books)','Archer decline push-ups'],
    cue:'Body in one line, chest to the floor, 3 seconds down.',why:'You do 22 now, so the backpack brings you into 10 to 15 and saves time.'},
  row:{n:'Backpack rows',kind:'reps',rng:[10,15],tempo:3.5,m:{back:1,bi:0.5},start:1,
    lad:['Backpack rows (6 books)','Backpack rows (10 books)','Backpack rows (full), 2-s squeeze','One-arm backpack rows (full)'],
    cue:'Hinge to 45 degrees, flat back, pull to your belly button.',why:'Horizontal pull: thickness for the upper back.'},
  row1:{n:'One-arm backpack rows',kind:'reps',rng:[10,15],tempo:3.5,uni:1,m:{back:1,bi:0.5},start:0,
    lad:['One-arm rows (backpack, 8 books)','One-arm rows (full backpack)','One-arm rows (full), 2-s squeeze','One-arm rows (full), 4-s lowering'],
    cue:'Free hand on the chair, elbow to your hip.',why:'One side at a time lets you load the full backpack.'},
  lat:{n:'Lateral raises',kind:'reps',rng:[12,20],tempo:3.2,m:{delt:1},start:0,
    lad:['Bottles, 1.5 L','Bottles, 2 L','Bottles, 2 L, 3-s lowering','One-arm backpack lateral, leaning away'],
    cue:'Lead with the elbows, stop at shoulder height, slow down.',why:'Side delts: priority 1. Trained on all 3 upper days.'},
  pike:{n:'Pike push-ups',kind:'reps',rng:[6,12],tempo:4,m:{delt:0.5,tri:0.5},start:1,
    lad:['Pike push-ups (feet on floor)','Feet-elevated pike (feet on chair)','Feet-elevated pike, deficit (hands on books)','Wall handstand push-up negatives','Wall handstand push-ups'],
    cue:'Hips high, head forward of your hands, elbows at 45 degrees.',why:'The overhead-press path you wanted, towards wall handstand push-ups.'},
  ytw:{n:'Prone Y-T-W raises',kind:'reps',rng:[8,12],tempo:3,m:{back:0.5,delt:0.25},start:0,
    lad:['Y-T-W, no weight','Y-T-W, 0.5 L bottles','Y-T-W, 1 L bottles','Y-T-W, 1.5 L bottles'],
    cue:'Face down, thumbs up, squeeze the shoulder blades for 1 second each letter.',why:'Rear shoulders and lower traps for posture.'},
  diamond:{n:'Diamond push-ups',kind:'reps',rng:[8,15],tempo:4,m:{tri:1,chest:0.5},start:0,
    lad:['Diamond push-ups','Decline diamond push-ups','Decline diamond + backpack (4 books)','Decline diamond + backpack (8 books)'],
    cue:'Hands together under your chest, elbows back along your ribs.',why:'Triceps are two thirds of your upper-arm size.'},
  curl:{n:'Backpack curls',kind:'reps',rng:[10,15],tempo:3,m:{bi:1},start:0,
    lad:['Backpack curls (6 books)','Backpack curls (10 books)','Backpack curls (full)','Backpack curls (full), 4-s lowering'],
    cue:'Elbows pinned, no swinging, 3 seconds down.',why:'Direct biceps work on top of the pulls.'},
  neck:{n:'Neck',kind:'reps',rng:[15,25],tempo:2.5,m:{neck:1},start:0,iso:{weeks:2,secs:60},
    lad:['Isometric holds, 4 directions x 15 s (weeks 1-2)','Neck curls and extensions (lying)','Curls, extensions and side raises','Same, hand resistance'],
    cue:'Gentle and slow. Never jerk the neck.',why:'You asked for neck work on upper days.'},
  bss:{n:'Bulgarian split squats',kind:'reps',rng:[8,12],tempo:4.5,uni:1,m:{quad:1,glute:1},start:1,
    lad:['Bulgarian split squats, bodyweight','Bulgarian split squats + backpack (8 books)','Bulgarian split squats + backpack (full)','Front-foot-elevated + backpack (full)'],
    cue:'Back foot on the chair, front shin vertical, knee to the floor.',why:'Bodyweight squats (20) are too easy to build your legs.'},
  hsq:{n:'Heels-elevated backpack squats',kind:'reps',rng:[10,15],tempo:4.5,m:{quad:1,glute:0.5},start:0,
    lad:['Heels on books, backpack (8 books)','Heels on books, backpack (full)','Same, 1-s pause at the bottom','Same, 4-s lowering'],
    cue:'Heels up on two books, chest tall, sit straight down.',why:'Quad-focused, easy to load with the backpack.'},
  slrdl:{n:'Single-leg RDL',kind:'reps',rng:[8,12],tempo:4,uni:1,m:{ham:1,glute:1},start:0,
    lad:['Single-leg RDL, bodyweight','Single-leg RDL + backpack (8 books)','Single-leg RDL + backpack (full)','Same, 4-s lowering'],
    cue:'Hinge at the hip, back flat, feel the back of the thigh stretch.',why:'Hamstrings and glutes, the back of your legs.'},
  tcurl:{n:'Towel leg curls',kind:'reps',rng:[8,12],tempo:4,m:{ham:1},start:0,
    lad:['Towel leg curls, two legs','Towel leg curls, 4-s out','Single-leg towel curls','Single-leg, 4-s out'],
    cue:'Heels on a towel, hips up, pull the heels in, slide out slowly.',why:'The only knee-flexion hamstring move you can do at home.'},
  calf:{n:'Single-leg calf raises',kind:'reps',rng:[10,15],tempo:3,uni:1,m:{calf:1},start:0,
    lad:['On a step, bodyweight','On a step, 2-s pause at the top','On a step + backpack','On a step + backpack, 2-s pause'],
    cue:'Full stretch at the bottom, pause at the top.',why:'Calves grow from slow, full-range reps.'},
  hollow:{n:'Hollow hold',kind:'hold',rng:[20,40],m:{core:1},start:0,
    lad:['Hollow hold, arms by your sides','Hollow hold, arms overhead','Hollow hold + flutter kicks finish'],
    cue:'Lower back pressed to the floor, breathe.',why:'Core strength for every other move.'},
  flutter:{n:'Flutter kicks',kind:'hold',rng:[30,45],m:{core:1},start:0,
    lad:['Flutter kicks, hands under hips','Flutter kicks, hands by your sides','Flutter kicks from a hollow hold'],
    cue:'Small fast kicks, lower back down.',why:'Follows the hollow hold, as agreed.'},
  splank:{n:'Side plank',kind:'hold',rng:[30,45],uni:1,m:{core:1},start:0,
    lad:['Side plank','Side plank, top leg raised','Side plank hip dips (10-15 per side)'],
    cue:'Straight line from head to heels, hips high.',why:'Obliques and waist strength. Hip dips are the level-up.'},
  legraise:{n:'Lying leg raises',kind:'reps',rng:[10,15],tempo:3.5,m:{core:1},start:0,
    lad:['Leg raises, hands under hips','Leg raises, 3-s lowering','Leg raises + hip lift at the top'],
    cue:'Straight legs, lower slowly, back stays down.',why:'Lower abs. No knee variations, as you asked.'}
};

/* sessions: blocks are supersets [[A,B],rounds,rest] or single [[A],rounds,rest]. Rests are short and timed. */
export const SESS={
  UA:{n:'Upper A',focus:'Pull + push, side delts',blocks:[[['pullup','dpush'],4,60],[['lat','row'],3,45],[['curl','neck'],2,20]]},
  LA:{n:'Lower A',focus:'Single-leg quads + hamstrings, core',blocks:[[['bss','tcurl'],3,60],[['calf','hollow'],3,30],[['splank'],2,30]]},
  UB:{n:'Upper B',focus:'Overhead + side delts, rear shoulders',blocks:[[['chinup','pike'],3,60],[['lat','ytw'],4,45],[['diamond','neck'],2,30]]},
  LB:{n:'Lower B',focus:'Squat + hinge, chest top-up',blocks:[[['hsq','slrdl'],3,60],[['calf','flutter'],3,30],[['dpush'],2,45]]},
  UC:{n:'Upper C',focus:'Pull + push, one-arm rows, arms',blocks:[[['pullup','dpush'],3,60],[['row','lat'],4,45],[['curl','diamond'],2,30]]},
  LC:{n:'Lower C',focus:'Single-leg legs, lower abs',blocks:[[['bss','tcurl'],4,60],[['calf','legraise'],3,30]]},
  TEST:{n:'Monthly challenge',focus:'Max push-ups, pull-ups, plank, squats',test:1,blocks:[[['t_push'],1,120],[['t_pull'],1,120],[['t_plank'],1,120],[['t_squat'],1,90]]},
  MAINT:{n:'Maintenance',focus:'Short sessions that keep your muscle',blocks:[[['pullup','dpush'],2,60],[['lat','bss'],2,45],[['hollow'],1,30]]}
};
EX.t_push={n:'Max decline push-ups',kind:'test',mode:'count',key:'push',secs:60,m:{chest:1,tri:0.5},cue:'One set, as many as you can with good form.'};
EX.t_pull={n:'Max pull-ups',kind:'test',mode:'count',key:'pull',secs:45,m:{back:1,bi:0.5},cue:'Dead hang every rep.'};
EX.t_plank={n:'Max plank',kind:'test',mode:'hold',key:'plank',secs:120,m:{core:1},cue:'Straight line. Stop when the hips drop.'};
EX.t_squat={n:'Max bodyweight squats',kind:'test',mode:'count',key:'squat',secs:60,m:{quad:1,glute:0.5},cue:'Thighs to parallel every rep.'};

/* week: Sun rest. Mon Upper A, Tue Lower A (11:45 slot), Wed Upper B, Thu Lower B, Fri Upper C, Sat Lower C.
   Upper body 3x and lower body 3x a week: every muscle is trained 3x. No "conditioning" days: the rope is the warm-up. */
export const WEEK=[null,'UA','LA','UB','LB','UC','LC'];
export const SLOT=d=>d.getDay()===2?'11:45–12:15':'17:15–17:45';
/* deloads line up with his study buffer weeks (Mon dates) */
export const DELOAD=['2026-12-07','2027-01-04','2027-02-01','2027-03-01','2027-03-29','2027-04-26'];
/* START = Day 1 of the study plan (restart from zero, Wed 25 Nov 2026): no session is planned, and no day counts as missed, before it.
   WSTART = training week 1 (Mon 16 Nov 2026, unchanged on purpose), so 25 Nov is training week 2 and neck isometrics run weeks 1-2. */
export const START=new Date(2026,10,25),WSTART=new Date(2026,10,16),MAINT_FROM=new Date(2027,6,1),EXAM=new Date(2027,7,3);
const k=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const mon=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
export const isDeload=d=>DELOAD.includes(k(mon(d)));
export const lastSat=d=>d.getDay()===6&&new Date(d.getFullYear(),d.getMonth(),d.getDate()+7).getMonth()!==d.getMonth();
export function phase(d){
  if(d>=MAINT_FROM)return{id:'maint',n:'Maintenance',rir:'2',note:'Exam months: keep the muscle, 3 short sessions a week.'};
  if(d<new Date(2027,0,1))return{id:'learn',n:'Learn the movements',rir:'2-3',note:'Perfect form, 3-second lowering, stop 2 to 3 reps short of failure.'};
  if(d<new Date(2027,4,1))return{id:'build',n:'Main build',rir:'1-2',note:'Stop 1 to 2 reps short of failure. Last set of isolation moves to 0 to 1.'};
  return{id:'keep',n:'Keep building',rir:'1-2',note:'Same as the build, around exam prep.'}}
/* the session for a date (null = rest) */
export function sessionFor(d){
  if(d<START)return null;
  if(d>=MAINT_FROM)return [1,3,5].includes(d.getDay())?'MAINT':null;
  if(d.getDay()===0)return null;
  if(lastSat(d))return 'TEST';
  return WEEK[d.getDay()]}
/* blocks for a date (deload: half the rounds, never below 1) */
export function blocksFor(id,d){const S=SESS[id];if(!S)return[];const dl=d&&isDeload(d)&&!S.test;return S.blocks.map(([ex,r,rest])=>[ex,dl?Math.max(1,Math.ceil(r/2)):r,rest])}

/* time for one set of an exercise (seconds), at the middle of its range */
export function setSecs(id,wk){const e=EX[id];if(!e)return 0;
  if(e.kind==='test')return e.secs+SETUP;
  if(id==='neck'&&wk!=null&&wk<=e.iso.weeks)return e.iso.secs+SETUP;
  const mid=(e.rng[0]+e.rng[1])/2;const one=e.kind==='hold'?mid:mid*e.tempo;
  return Math.round(e.uni?2*one+SWITCH+SETUP:one+SETUP)}
/* full timing table for a session */
export function timing(id,d,wk){const B=blocksFor(id,d),rows=[['Warm-up: 60 s rope, arm and hip circles, 1 easy ramp set',WARM]];
  B.forEach(([ex,r,rest],i)=>{const per=ex.reduce((a,e)=>a+setSecs(e,wk),0)+(ex.length-1)*TRANS+rest;rows.push([`${ex.map(e=>EX[e].n).join(' + ')} × ${r}`,per*r]);if(i<B.length-1)rows.push(['Move to the next block',BLOCK])});
  rows.push(['Cool-down: stretch the muscles you trained, slow breathing',COOL]);
  return{rows,total:rows.reduce((a,x)=>a+x[1],0)}}
/* weekly hard sets per muscle for a normal (non-deload) week */
export function weeklySets(d){const ref=d||new Date(2027,1,8);const out={};for(const m in MUSCLES)out[m]=0;const freq={};for(const m in MUSCLES)freq[m]=0;
  for(let i=1;i<=6;i++){const day=new Date(ref);day.setDate(ref.getDate()-((ref.getDay()+6)%7)+i-1);const id=sessionFor(day);if(!id||id==='TEST')continue;const hit={};
    for(const [ex,r] of blocksFor(id,null))for(const e of ex)for(const m in EX[e].m){out[m]+=EX[e].m[m]*r;if(EX[e].m[m]>=0.5)hit[m]=1}
    for(const m in hit)freq[m]++}
  return{sets:out,freq}}
/* week-1 starting levels (tested 18 Nov 2026) and the re-test */
/* the 18 Nov 2026 test: his starting numbers. Sat 28 Nov (last Saturday of November) is the first Monthly challenge against them. */
export const BASE={date:'2026-11-18',push:22,pull:'5-6',plank:50,squat:20};
export const PROG=[
  'Double progression: stay at one variation until every set hits the top of its range with clean 3-second lowering.',
  'Then move up one step on the ladder (harder variation or more books), and drop back to the bottom of the range.',
  'If reps fall below the bottom of the range for 2 sessions, step back down one rung.',
  'Effort: stop 1-2 reps short of failure (2-3 in Nov-Dec while learning). Last set of lateral raises, curls and calves can go to 0-1.',
  'Deload in each study buffer week: half the rounds, 3 reps in reserve. Sessions become about 15-20 minutes.',
  'Monthly challenge on the last Saturday re-tests push-ups, pull-ups, plank and squats against last month (the first one, Sat 28 Nov, against the 18 Nov test).'];
