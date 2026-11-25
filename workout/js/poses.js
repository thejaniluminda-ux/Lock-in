/* Demonstration poses for every exercise. Each returns bone rotations (radians, relative to the A-pose rest),
   an optional whole-body rotation around the hips and an offset, for a phase t in [0,1).
   Signs: shoulder z + raises the left arm sideways (- for the right); x - swings a limb forward;
   knee x + bends the knee; spine/chest x + bends the trunk forward; ankle x + points the toes. */
const D=Math.PI/180,w=t=>0.5-0.5*Math.cos(t*2*Math.PI);/* 0 -> 1 -> 0 */
const arms=(abd,flex=0,elb=0)=>({shoulderL:[-flex*D,0,abd*D],shoulderR:[-flex*D,0,-abd*D],elbowL:[-elb*D,0,0],elbowR:[-elb*D,0,0]});
const legs=(hip,knee,ank=0)=>({hipL:[-hip*D,0,0],hipR:[-hip*D,0,0],kneeL:[knee*D,0,0],kneeR:[knee*D,0,0],ankleL:[ank*D,0,0],ankleR:[ank*D,0,0]});
const M=(...o)=>Object.assign({},...o);
const prone=(s,lift=0)=>({rot:[(90)*D,0,0],pos:[0,-0.55+lift,0]});/* face down */
const supine=(lift=0)=>({rot:[-90*D,0,0],pos:[0,-0.72+lift,0]});/* face up */
export const POSES={
  pullup:{period:3.4,fn:t=>{const s=w(t);return{b:M(arms(160-142*s,0,10+150*s),legs(8,15))}}},
  chinup:{period:3.4,fn:t=>{const s=w(t);return{b:M(arms(160-138*s,20*s,10+148*s),legs(8,15))}}},
  dpush:{period:3.2,fn:t=>{const s=w(t);return Object.assign({b:M(arms(-14,88-35*s,85*s),{spine:[0,0,0],neck:[-12*D,0,0]})},{rot:[(96+5*s)*D,0,0],pos:[0,-0.22-0.07*s,0.08]})}},
  diamond:{period:3.2,fn:t=>{const s=w(t);return Object.assign({b:M(arms(-25,88-30*s,95*s),{neck:[-12*D,0,0]})},{rot:[(96+5*s)*D,0,0],pos:[0,-0.21-0.07*s,0.08]})}},
  row:{period:3.0,fn:t=>{const s=w(t);return{b:M({spine:[28*D,0,0],chest:[16*D,0,0]},arms(-20,48-55*s,95*s),legs(30,32)),pos:[0,-0.06,0]}}},
  row1:{period:3.0,fn:t=>{const s=w(t);return{b:M({spine:[30*D,0,0],chest:[18*D,0,0]},{shoulderL:[(-48+55*s)*D,0,-12*D],elbowL:[-95*s*D,0,0],shoulderR:[-70*D,0,-10*D],elbowR:[-20*D,0,0]},legs(28,30)),pos:[0,-0.06,0]}}},
  lat:{period:3.0,fn:t=>{const s=w(t);return{b:M(arms(-14+76*s,8,14),legs(0,4))}}},
  pike:{period:3.2,fn:t=>{const s=w(t);return{b:M(arms(150-10*s,-8,55*s),legs(95,0),{spine:[10*D,0,0]}),rot:[120*D,0,0],pos:[0,-0.04,0.25]}}},
  ytw:{period:4.5,fn:t=>{const ph=Math.floor(t*3),s=w((t*3)%1),abd=[135,90,70][ph],el=[0,0,80][ph];return Object.assign({b:ph===2?{shoulderL:[-(30+25*s)*D,0,48*D],shoulderR:[-(30+25*s)*D,0,-48*D],elbowL:[0,0,88*D],elbowR:[0,0,-88*D]}:M(arms(abd,35*s,el))},prone(),{pos:[0,-0.8,0]})}},
  curl:{period:3.0,fn:t=>{const s=w(t);return{b:M(arms(-20,0,10+125*s),legs(0,4))}}},
  neck:{period:3.4,fn:t=>{const s=w(t);return{b:M(arms(-12,0,0),{neck:[(-14+30*s)*D,0,0],head:[(-8+16*s)*D,0,0]})}}},
  bss:{period:3.6,fn:t=>{const s=w(t);return{b:M(arms(-10,10,10),{hipL:[(-20-55*s)*D,0,0],kneeL:[(10+80*s)*D,0,0],hipR:[(25+12*s)*D,0,0],kneeR:[(40+55*s)*D,0,0],spine:[8*s*D,0,0]}),pos:[0,-0.32*s,0]}}},
  hsq:{period:3.6,fn:t=>{const s=w(t);return{b:M(arms(-12,20+60*s,20),legs(95*s,120*s,-22*s),{spine:[22*s*D,0,0]}),pos:[0,-0.52*s+0.4*s*(1-s),-0.04*s]}}},
  slrdl:{period:3.6,fn:t=>{const s=w(t);return{b:M({spine:[5*s*D,0,0],chest:[3*s*D,0,0],neck:[-8*s*D,0,0],hipL:[-62*s*D,0,0],kneeL:[14*D,0,0],hipR:[6*s*D,0,0],kneeR:[4*D,0,0]},arms(-14,62*s,0)),rot:[62*s*D,0,0]}}},
  tcurl:{period:3.4,fn:t=>{const s=w(t);return Object.assign({b:M(arms(-30,0,0),legs(-10+45*s,30+80*s))},supine(0.2+0.06*s))}},
  calf:{period:2.6,fn:t=>{const s=w(t);return{b:M(arms(-12,0,0),{ankleL:[38*s*D,0,0],kneeR:[70*D,0,0],hipR:[0,0,0]}),pos:[0,0.12*s,0]}}},
  hollow:{period:4,fn:t=>{const s=w(t);return Object.assign({b:M(arms(165,-10,0),legs(9+2*s,0),{spine:[12*D,0,0],neck:[20*D,0,0]})},supine(0.17))}},
  flutter:{period:1.4,fn:t=>{const s=Math.sin(t*2*Math.PI);return Object.assign({b:M(arms(-20,0,0),{hipL:[(-22-14*s)*D,0,0],hipR:[(-22+14*s)*D,0,0],neck:[-18*D,0,0]})},supine(0.1))}},
  splank:{period:4,fn:t=>{const s=w(t);return{b:M({shoulderL:[0,0,55*D],elbowL:[-90*D,0,0],shoulderR:[0,0,28*D],elbowR:[-20*D,0,0]},legs(0,0)),rot:[0,0,-72*D],pos:[0.45,-0.53+0.04*s,0]}}},
  legraise:{period:3.2,fn:t=>{const s=w(t);return Object.assign({b:M(arms(-25,0,0),legs(10+80*s,0))},supine(0.08))}},
  t_push:{period:2.4,fn:t=>POSES.dpush.fn(t)},t_pull:{period:3,fn:t=>POSES.pullup.fn(t)},
  t_plank:{period:4,fn:t=>({b:M(arms(-30,88,90),{neck:[-12*D,0,0]}),rot:[84*D,0,0],pos:[0,-0.62,0.1]})},
  t_squat:{period:2.4,fn:t=>{const s=w(t);return{b:M(arms(-12,70*s,10),legs(90*s,110*s,-20*s),{spine:[20*s*D,0,0]}),pos:[0,-0.46*s+0.4*s*(1-s),0]}}}
};
for(const k in POSES){const p=POSES[k],f=p.fn;const g=t=>f(t);g.period=p.period;g.fn=f;POSES[k]=g}
/* camera framing per pose: y = look-at height, d = distance, az = side angle (radians, 0 = front) */
const SIDE=Math.PI/2*0.92,THREEQ=0.55;
export const CAM={_:{y:0.95,d:4.5,az:0.35},pullup:{y:1.5,d:6.1,az:0.45},chinup:{y:1.5,d:6.1,az:0.45},t_pull:{y:1.5,d:6.1,az:0.45},pike:{y:0.5,d:4.9,az:SIDE,z:0.28},
  dpush:{y:0.4,d:4.8,az:SIDE,z:-0.2,el:0.04},diamond:{y:0.4,d:4.8,az:SIDE,z:-0.2,el:0.04},t_push:{y:0.4,d:4.8,az:SIDE,z:-0.2,el:0.04},t_plank:{y:0.25,d:4.4,az:SIDE,el:0.03},
  row:{y:0.85,d:4.3,az:SIDE},row1:{y:0.85,d:4.3,az:SIDE},slrdl:{y:0.85,d:4.6,az:SIDE},bss:{y:0.8,d:4.7,az:SIDE,z:-0.1},hsq:{y:0.85,d:4.5,az:THREEQ},t_squat:{y:0.85,d:4.5,az:THREEQ},
  ytw:{y:0.12,d:4.3,az:Math.PI,el:0.5,z:0},hollow:{y:0.35,d:4.2,az:SIDE,el:0.1},flutter:{y:0.4,d:4.2,az:SIDE,el:0.1},legraise:{y:0.5,d:4.2,az:SIDE,el:0.1},tcurl:{y:0.35,d:4.2,az:SIDE,el:0.1},
  splank:{y:0.4,d:4.2,az:0.15,el:0.1},calf:{y:0.95,d:4.5,az:SIDE},lat:{y:0.95,d:4.5,az:0.25},curl:{y:0.95,d:4.5,az:SIDE*0.9},neck:{y:1.45,d:2.4,az:SIDE*0.8}};
/* contacts per exercise (metres, y up, figure faces +z):
   anchor = body point pinned to a spot every frame; level = second point brought to a height by turning the body;
   props = bar / box (chair, step) / books under heels / bottles in the hands, placed at the body's real contact points */
const STAND={anchor:{pt:'heels',y:0.087,z:-0.09}};
const HANG={anchor:{pt:'hands',y:2.4,z:0.06},grip:1,props:[{bar:'hands',dy:0.085}]};
const PUSH={anchor:{pt:'hands',y:0.07,z:0.5},level:{pt:'toes',y:0.5},palms:1,grip:0.12,props:[{box:'toes',gap:0.04,w:0.45,d:0.38}]};
export const FIT={pullup:HANG,chinup:HANG,t_pull:HANG,dpush:PUSH,diamond:PUSH,t_push:PUSH,
  pike:{anchor:{pt:'hands',y:0.07,z:0.7},level:{pt:'toes',y:0.5},palms:1,ik:{pt:'toes',target:{z:-0.55},vars:[['hipL','hipR']]},props:[{box:'toes',gap:0.04,w:0.45,d:0.38}]},
  t_plank:{anchor:{pt:'elbows',y:0.06},level:{pt:'toes',y:0.04}},
  splank:{anchor:{pt:'elbowL',y:0.06},level:{pt:'toeL',y:0.04,axis:'z'}},
  ytw:{anchor:{pt:'chest',y:0.14},level:{pt:'toes',y:0.04},grip:1,props:[{bottles:0.16}]},
  tcurl:{anchor:{pt:'chest',y:0.12},level:{pt:'heels',y:0.07},props:[{mat:'heels'}]},
  hollow:{anchor:{pt:'back',y:0.1}},flutter:{anchor:{pt:'pelvis',y:0.12}},legraise:{anchor:{pt:'pelvis',y:0.12}},
  lat:{...STAND,grip:1,props:[{bottles:0.22}]},curl:{...STAND,grip:1},neck:STAND,row:{...STAND,grip:1},row1:{...STAND,grip:1},t_squat:STAND,
  hsq:{anchor:{pt:'heels',y:0.137,z:-0.09},props:[{books:0.05}]},
  slrdl:{anchor:{pt:'footL',y:0.087,z:-0.09}},
  bss:{anchor:{pt:'footL',y:0.087,z:0.25},ik:{pt:'toeR',target:{y:0.44,z:-0.62},vars:[['hipR'],['kneeR']]},props:[{box:'toeR',gap:0.04,w:0.45,d:0.38}]},
  calf:{anchor:{pt:'toeL',y:0.15,z:0.12},props:[{box:'toeL',gap:0.03,w:0.5,d:0.3,dz:0.12}]}};
