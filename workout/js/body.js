/* The hologram body: an original anatomical figure built from smooth shapes (our own asset, no licence needed).
   Units are metres, y up, the figure faces +z, 183 cm tall. Every shape belongs to a bone (for animation) and a
   region (for muscle selection). The mesh is made from this in a worker (surface nets) and skinned to the bones. */
export const REGIONS=['none','delt','chest','back','back','bi','tri','core','core','quad','ham','glute','calf','neck','none','none'];
/* region index -> plan muscle key (index 4 = traps/upper back, 8 = obliques, 14 = forearm, 15 = head) */
export const R={none:0,delt:1,chest:2,lat:3,trap:4,bi:5,tri:6,abs:7,obl:8,quad:9,ham:10,glute:11,calf:12,neck:13,fore:14,head:15};

/* bones: [name, parent, joint position (rest pose, world)] */
export const BONES=[
  ['hips',-1,[0,0.95,0]],['spine',0,[0,1.06,0]],['chest',1,[0,1.24,0]],['neck',2,[0,1.49,-0.005]],['head',3,[0,1.6,0]],
  ['shoulderL',2,[0.185,1.445,-0.005]],['elbowL',5,[0.33,1.185,-0.01]],['wristL',6,[0.455,0.955,0.02]],
  ['shoulderR',2,[-0.185,1.445,-0.005]],['elbowR',8,[-0.33,1.185,-0.01]],['wristR',9,[-0.455,0.955,0.02]],
  ['hipL',0,[0.092,0.925,0]],['kneeL',11,[0.104,0.505,0.012]],['ankleL',12,[0.112,0.085,-0.02]],
  ['hipR',0,[-0.092,0.925,0]],['kneeR',14,[-0.104,0.505,0.012]],['ankleR',15,[-0.112,0.085,-0.02]]];
export const B=Object.fromEntries(BONES.map((b,i)=>[b[0],i]));

const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
/* shape list: cap = round cone a->b with radii r1,r2; ell = ellipsoid centre c, radii e. k = blend into the body */
export function shapes(){
  const S=[],cap=(a,b,r1,r2,bone,reg,k=0.022)=>S.push({t:0,a,b,r1,r2,bone,reg,k}),ell=(c,e,bone,reg,k=0.022)=>S.push({t:1,c,e,bone,reg,k});
  const P=Object.fromEntries(BONES.map(b=>[b[0],b[2]]));
  /* head and neck */
  ell([0,1.712,0.006],[0.073,0.104,0.09],B.head,R.head,0.03);
  cap([0,1.66,0.03],[0,1.625,0.052],0.052,0.038,B.head,R.head,0.03);
  cap([0,1.49,-0.01],[0,1.645,0.0],0.066,0.054,B.neck,R.neck,0.03);
  for(const s of [1,-1]){cap([0.03*s,1.625,0.025],[0.014*s,1.505,0.058],0.019,0.017,B.neck,R.neck,0.012)}
  /* torso base */
  ell([0,1.315,-0.005],[0.165,0.185,0.105],B.chest,R.none,0.04);
  ell([0,1.105,0.004],[0.118,0.15,0.09],B.spine,R.none,0.05);
  ell([0,1.405,-0.012],[0.178,0.085,0.094],B.chest,R.none,0.04);
  ell([0,0.955,-0.008],[0.138,0.09,0.094],B.hips,R.none,0.05);
  for(const s of [1,-1]){
    /* traps and upper back */
    cap([0.03*s,1.575,-0.035],[0.165*s,1.47,-0.025],0.046,0.03,B.chest,R.trap,0.022);
    ell([0.07*s,1.39,-0.078],[0.075,0.09,0.042],B.chest,R.trap,0.02);
    /* chest */
    cap([0.022*s,1.335,0.074],[0.16*s,1.395,0.04],0.048,0.032,B.chest,R.chest,0.03);
    cap([0.03*s,1.38,0.07],[0.15*s,1.41,0.045],0.038,0.028,B.chest,R.chest,0.03);
    /* lats */
    cap([0.15*s,1.355,-0.035],[0.075*s,1.115,-0.055],0.06,0.03,B.chest,R.lat,0.03);
    /* side and front delts */
    ell([0.226*s,1.408,0.0],[0.06,0.098,0.068],B['shoulder'+(s>0?'L':'R')],R.delt,0.026);
    /* obliques */
    ell([0.106*s,1.095,0.03],[0.036,0.095,0.055],B.spine,R.obl,0.024);
    /* glutes */
    ell([0.068*s,0.905,-0.056],[0.074,0.082,0.05],B.hips,R.glute,0.028);
    const L=s>0?'L':'R',sh=P['shoulder'+L],el=P['elbow'+L],wr=P['wrist'+L],hi=P['hip'+L],kn=P['knee'+L],an=P['ankle'+L];
    /* arm */
    cap(sh,el,0.056,0.041,B['shoulder'+L],R.none,0.03);
    cap(add(lerp(sh,el,0.22),[0,0,0.03]),add(lerp(sh,el,0.86),[0,0,0.026]),0.049,0.033,B['shoulder'+L],R.bi,0.014);
    cap(add(lerp(sh,el,0.12),[0,0,-0.032]),add(lerp(sh,el,0.82),[0,0,-0.03]),0.052,0.031,B['shoulder'+L],R.tri,0.014);
    cap(el,wr,0.045,0.029,B['elbow'+L],R.fore,0.02);
    cap(add(lerp(el,wr,0.08),[0,0,0.012]),add(lerp(el,wr,0.55),[0,0,0.01]),0.047,0.028,B['elbow'+L],R.fore,0.014);
    const hand=add(wr,mul(sub(wr,el),0.6));
    cap(wr,hand,0.027,0.022,B['wrist'+L],R.none,0.012);
    /* leg */
    cap(hi,kn,0.082,0.052,B['hip'+L],R.none,0.035);
    cap(add(lerp(hi,kn,0.12),[0.006*s,0,0.036]),add(lerp(hi,kn,0.9),[0,0,0.03]),0.074,0.044,B['hip'+L],R.quad,0.016);
    cap(add(lerp(hi,kn,0.1),[0,0,-0.03]),add(lerp(hi,kn,0.85),[0,0,-0.032]),0.066,0.04,B['hip'+L],R.ham,0.016);
    cap(add(lerp(hi,kn,0.18),[-0.035*s,0,0]),add(lerp(hi,kn,0.7),[-0.02*s,0,0.0]),0.05,0.03,B['hip'+L],R.quad,0.02);
    cap(kn,an,0.046,0.03,B['knee'+L],R.none,0.03);
    cap(add(lerp(kn,an,0.1),[0,0,-0.03]),add(lerp(kn,an,0.55),[0,0,-0.022]),0.052,0.027,B['knee'+L],R.calf,0.014);
    cap(an,[an[0]+0.004*s,0.025,0.15],0.036,0.024,B['ankle'+L],R.none,0.02);
    ell([an[0],0.045,-0.02],[0.032,0.03,0.04],B['ankle'+L],R.none,0.02);
  }
  /* abs on top */
  for(const s of [1,-1])for(const [yy,zz] of [[1.205,0.083],[1.13,0.083],[1.055,0.078]])ell([0.034*s,yy,zz],[0.031,0.034,0.02],B.spine,R.abs,0.014);
  ell([0,0.99,0.062],[0.055,0.05,0.022],B.spine,R.abs,0.02);
  return S}

/* signed distance to one shape */
export function dShape(s,x,y,z){
  if(s.t===1){const ex=(x-s.c[0])/s.e[0],ey=(y-s.c[1])/s.e[1],ez=(z-s.c[2])/s.e[2];const k0=Math.sqrt(ex*ex+ey*ey+ez*ez);
    const k1=Math.sqrt(ex*ex/(s.e[0]*s.e[0])+ey*ey/(s.e[1]*s.e[1])+ez*ez/(s.e[2]*s.e[2]));return k1>1e-9?k0*(k0-1)/k1:-Math.min(s.e[0],s.e[1],s.e[2])}
  /* round cone (capsule with two radii) */
  const ax=s.b[0]-s.a[0],ay=s.b[1]-s.a[1],az=s.b[2]-s.a[2],px=x-s.a[0],py=y-s.a[1],pz=z-s.a[2];
  const l2=ax*ax+ay*ay+az*az;let h=(px*ax+py*ay+pz*az)/l2;h=h<0?0:h>1?1:h;
  const qx=px-ax*h,qy=py-ay*h,qz=pz-az*h;return Math.sqrt(qx*qx+qy*qy+qz*qz)-(s.r1+(s.r2-s.r1)*h)}
/* smooth union distance at a point */
export function field(S,x,y,z){let d=1e9;for(const s of S){const e=dShape(s,x,y,z);if(e<0.25)d=smin(d,e,s.k);else if(e<d)d=e}return d}
export function smin(a,b,k){if(a>=1e8)return b;const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*0.25}
