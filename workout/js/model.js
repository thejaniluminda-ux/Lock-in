/* The real human body for the hologram: Quaternius "Universal Base Characters" Superhero male (CC0 1.0),
   textures stripped (assets/model/male.gltf + male.bin). This module
   1. loads it and keeps only the body mesh,
   2. paints muscle regions onto its vertices from the model's own skeleton (which bone a vertex follows
      and which side of that bone it sits on),
   3. makes it follow the simple driver skeleton that poses.js animates (each model bone is turned so it points
      the same way as the matching driver bone: works although the model rests in a T-pose). */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {R,BONES,B} from './body.js';

const V=(a)=>new THREE.Vector3(a[0],a[1],a[2]);
/* muscle region for a vertex at world rest position (x,y,z) that mostly follows bone `b` */
/* torso by position (bone borders on the torso are too blocky): front = chest / abs / obliques, back = traps / upper back and lats / glutes */
function torso(x,y,z,J){const ax=Math.abs(x),sh=J('upperarm_l'),front=z>(y>1.1?-0.012:-0.04);
  if(front){if(y>1.25)return ax>sh.x-0.025?R.delt:R.chest;if(y>1.0)return ax<0.075?R.abs:R.obl;return y>0.92&&ax<0.075?R.abs:R.none}
  if(y>1.38&&ax>sh.x-0.02)return R.delt;if(y>1.42&&ax<0.12)return R.trap;if(y>1.12)return R.lat;if(y>1.04&&ax>0.085)return R.lat;
  if(y<0.99&&y>0.76)return R.glute;return R.none}
function regionOf(b,x,y,z,J){const side=b.endsWith('_l')?1:b.endsWith('_r')?-1:0,ax=Math.abs(x);
  const base=b.replace(/_(l|r)$/,'');
  if(/^(index|middle|ring|pinky|thumb)/.test(base)||base==='hand'||base==='lowerarm')return R.fore;
  if(base==='Head')return R.head;
  if(base==='neck_01')return R.neck;
  if(base==='upperarm'){const s=J('upperarm_'+(side>0?'l':'r'));const along=Math.abs(x-s.x);if(along<0.1&&y>s.y-0.07)return R.delt;return z>s.z+0.005?R.bi:R.tri}
  if(base==='clavicle'||base==='pelvis'||base.startsWith('spine_'))return torso(x,y,z,J);
  if(base==='thigh'){const t=J('thigh_'+(side>0?'l':'r'));if(z<t.z-0.02&&y>t.y-0.14)return R.glute;return z>=t.z-0.005?R.quad:R.ham}
  if(base==='calf'){const c=J('calf_'+(side>0?'l':'r'));return z<c.z+0.0?R.calf:R.none}
  return R.none}

/* [model bone, model child it points at, driver joint from, driver joint to] in parent-first order */
const SEG=[['spine_01','spine_03','spine','chest'],['spine_03','neck_01','chest','neck'],['neck_01','Head','neck','head'],['Head','#top','head','#top'],
  ['upperarm_l','lowerarm_l','shoulderL','elbowL'],['lowerarm_l','hand_l','elbowL','wristL'],['hand_l','middle_01_l','wristL','#tipL'],
  ['upperarm_r','lowerarm_r','shoulderR','elbowR'],['lowerarm_r','hand_r','elbowR','wristR'],['hand_r','middle_01_r','wristR','#tipR'],
  ['thigh_l','calf_l','hipL','kneeL'],['calf_l','foot_l','kneeL','ankleL'],['foot_l','ball_l','ankleL','#toeL'],
  ['thigh_r','calf_r','hipR','kneeR'],['calf_r','foot_r','kneeR','ankleR'],['foot_r','ball_r','ankleR','#toeR']];
const P0=Object.fromEntries(BONES.map(b=>[b[0],b[2]]));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
/* virtual driver points: offsets in the driver bone's local frame (driver rest rotations are identity) */
const VIRT={'#tipL':['wristL',sub(P0.wristL,P0.elbowL).map(v=>v*0.62)],'#tipR':['wristR',sub(P0.wristR,P0.elbowR).map(v=>v*0.62)],
  '#toeL':['ankleL',[0.006,-0.06,0.16]],'#toeR':['ankleR',[-0.006,-0.06,0.16]],'#top':['head',[0,0.14,0.0]]};

export async function loadModel(url){const t0=performance.now();
  const gl=await new GLTFLoader().loadAsync(url);const root=gl.scene;let sk=null;
  root.traverse(o=>{if(o.isSkinnedMesh&&/SuperHero_Male/i.test(o.name))sk=o;else if(o.isMesh)o.visible=false});
  if(!sk)throw new Error('body mesh missing');root.updateMatrixWorld(true);
  const g=sk.geometry,pos=g.attributes.position,nv=pos.count,wp=new Float32Array(nv*3),v=new THREE.Vector3();
  for(let i=0;i<nv;i++){v.fromBufferAttribute(pos,i).applyMatrix4(sk.matrixWorld);wp[i*3]=v.x;wp[i*3+1]=v.y;wp[i*3+2]=v.z}
  const MB=sk.skeleton.bones,names=MB.map(b=>b.name),BW={};MB.forEach(b=>BW[b.name]=b.getWorldPosition(new THREE.Vector3()));
  const J=n=>BW[n]||new THREE.Vector3();const si=g.attributes.skinIndex,sw=g.attributes.skinWeight,reg=new Float32Array(nv);
  for(let i=0;i<nv;i++){let bi=0,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;bi=si.getComponent(i,k)}}reg[i]=regionOf(names[bi],wp[i*3],wp[i*3+1],wp[i*3+2],J)}
  g.setAttribute('aRegion',new THREE.BufferAttribute(reg,1));
  /* a tip point above the head for the head segment */
  const M={};MB.forEach(b=>M[b.name]=b);const top=new THREE.Object3D();M.Head.add(top);top.position.copy(M.Head.worldToLocal(J('Head').clone().add(new THREE.Vector3(0,0.14,0))));M['#top']=top;
  const rest={};for(const n in M)rest[n]=M[n].quaternion.clone();
  /* where a worn backpack sits: behind the upper back, kept in the upper-spine bone's frame so it moves with the torso */
  const sp=M.spine_03,packPos=sp.worldToLocal(new THREE.Vector3(0,J('spine_03').y-0.05,J('spine_03').z-0.165)),packQ=sp.getWorldQuaternion(new THREE.Quaternion()).invert();
  return{root,sk,geo:g,pos:wp,nv,M,rest,packPos,packQ,ms:Math.round(performance.now()-t0)}}

/* turn the model bones to follow the driver skeleton (driver bones live in the same world as the model) */
const q1=new THREE.Quaternion(),q2=new THREE.Quaternion(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3();
export function follow(md,drv){const M=md.M;for(const n in md.rest)M[n].quaternion.copy(md.rest[n]);md.root.updateMatrixWorld(true);
  const dp=(n,out)=>{if(n[0]==='#'){const [bn,off]=VIRT[n];return drv[B[bn]].localToWorld(out.set(off[0],off[1],off[2]))}return drv[B[n]].getWorldPosition(out)};
  for(const [mb,mc,df,dt] of SEG){const bone=M[mb],child=M[mc];if(!bone||!child)continue;
    bone.getWorldPosition(a);child.getWorldPosition(b);const cur=b.sub(a).normalize();
    dp(df,c);dp(dt,d);const tgt=d.sub(c).normalize();if(cur.lengthSq()<1e-8||tgt.lengthSq()<1e-8)continue;
    q1.setFromUnitVectors(cur,tgt);bone.getWorldQuaternion(q2).premultiply(q1);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(q1).invert().multiply(q2));bone.updateMatrixWorld(true)}}
/* fingers: curl toward the palm (local x axis on this rig). a = 0 open, about 0.35 relaxed, 1 a full grip */
const FING=['index','middle','ring','pinky'],CW=[0.75,0.95,0.7],qx=new THREE.Quaternion(),AX=new THREE.Vector3(1,0,0);
export function curl(md,a){if(!a)return;for(const s of ['l','r']){for(const f of FING)for(let j=1;j<=3;j++){const b=md.M[`${f}_0${j}_${s}`];if(b)b.quaternion.multiply(qx.setFromAxisAngle(AX,a*CW[j-1]))}
    for(let j=2;j<=3;j++){const b=md.M[`thumb_0${j}_${s}`];if(b)b.quaternion.multiply(qx.setFromAxisAngle(AX,a*0.45))}md.M['hand_'+s].updateMatrixWorld(true)}}
