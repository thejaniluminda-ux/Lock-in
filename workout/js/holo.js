/* Hologram: the body as a see-through, rim-lit, blooming figure (Three.js r160, bundled locally).
   Features: particle assembly on entry, drag to rotate, wheel/pinch to zoom, click a muscle to select it,
   per-muscle glow (today's targets, recovery over 48 h, selection), exercise demonstration poses,
   a frame-rate meter, and a calm static mode under reduced motion or a weak GPU. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {BONES,B,REGIONS} from './body.js';
import {POSES,CAM,FIT} from './poses.js';
/* named body points used for contacts and props (model bone names) */
const PT={hands:['hand_l','hand_r'],toes:['ball_l','ball_r'],heels:['foot_l','foot_r'],elbows:['lowerarm_l','lowerarm_r'],elbowL:['lowerarm_l'],footL:['foot_l'],toeL:['ball_l'],toeR:['ball_r'],chest:['spine_03'],back:['spine_02'],pelvis:['pelvis']};
import {loadModel,follow,curl} from './model.js';

const VERT=`attribute float aRegion;uniform float uLvl[16];uniform vec3 uCol[16];uniform float uSelA[16];varying vec3 vN;varying vec3 vV;varying vec3 vP;varying float vWy;varying float vLvl;varying vec3 vCol;varying float vSel;
#include <common>
#include <skinning_pars_vertex>
void main(){
#include <skinbase_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <defaultnormal_vertex>
#include <begin_vertex>
#include <skinning_vertex>
#include <project_vertex>
vN=normalize(transformedNormal);vV=-mvPosition.xyz;vP=position;vWy=(modelMatrix*vec4(transformed,1.0)).y;int r=int(aRegion+0.5);vLvl=uLvl[r];vCol=uCol[r]*uLvl[r];vSel=uSelA[r];}`;
const FRAG=`uniform float uTime;uniform float uFade;uniform float uScan;uniform float uLvl[16];uniform vec3 uCol[16];uniform float uSelA[16];uniform vec3 uBase;uniform float uMotion;
varying vec3 vN;varying vec3 vV;varying vec3 vP;varying float vWy;varying float vLvl;varying vec3 vCol;varying float vSel;
void main(){vec3 n=normalize(vN),v=normalize(vV);float ndv=abs(dot(n,v));float fres=pow(1.0-ndv,2.7);
float lvl=vLvl;vec3 rc=vLvl>0.001?vCol/vLvl:vec3(0.0);float sel=vSel;
float fib=0.5+0.5*sin(vP.y*360.0+sin(vP.x*55.0+vP.z*40.0)*2.6);float lines=smoothstep(0.9,1.0,fib);
float hl=step(0.86,fract(vP.y*150.0-uTime*0.5*uMotion))*0.07;
float scan=max(0.0,1.0-abs(vWy-uScan)/0.012)*(0.12+fres*0.5);
float edge=smoothstep(0.55,1.0,fres);
vec3 col=uBase*(0.018+fres*0.85+lines*0.2*fres+hl*0.5)+vec3(0.82,0.95,1.0)*pow(fres,4.5)*0.5;
col+=rc*lvl*(0.10+fres*0.85+lines*0.22);
col+=uBase*sel*(0.22+fres*1.1+lines*0.45+edge*0.25)*(0.82+0.18*sin(uTime*3.6));
col+=uBase*scan;
float back=gl_FrontFacing?1.0:0.13;vec3 c=col*back*uFade;gl_FragColor=vec4(c,min(1.0,max(c.r,max(c.g,c.b))));}`;
const PVERT=`attribute vec3 aStart;attribute float aSeed;uniform float uT;uniform float uTime;uniform float uSize;uniform float uMotion;varying float vA;varying float vSq;
void main(){float s=clamp((uT-aSeed*0.35)/0.65,0.0,1.0);s=s*s*(3.0-2.0*s);vec3 p=mix(aStart,position,s);
p+=vec3(sin(uTime*0.7+aSeed*40.0),cos(uTime*0.5+aSeed*31.0),sin(uTime*0.6+aSeed*17.0))*0.004*uMotion*s;
vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;vSq=step(0.7,aSeed);
gl_PointSize=uSize*(0.6+aSeed*0.9)*(1.0+(1.0-s)*1.4)/max(0.4,-mv.z);vA=mix(0.9,0.22+0.25*sin(uTime*1.3+aSeed*50.0)*uMotion,s);}`;
const PFRAG=`uniform vec3 uBase;uniform float uFade;varying float vA;varying float vSq;
void main(){vec2 c=gl_PointCoord-0.5;float d=vSq>0.5?max(abs(c.x),abs(c.y)):length(c);if(d>0.5)discard;float a=vA*(1.0-smoothstep(0.25,0.5,d));vec3 cc=uBase*1.4*a*uFade;gl_FragColor=vec4(cc,min(1.0,max(cc.r,max(cc.g,cc.b))));}`;

export class Holo{
  constructor(el,o={}){this.el=el;this.o=o;this.levels={};this.sel=null;this.cb=null;this.frames=[];this.fps=0;this.mode='full';
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||!!o.reduced;this.poseId=null;this.poseT=0;this.ready=false;this.assembleT=this.reduced||(o.capture&&!o.assemble)?1:0;}
  async init(){
    const el=this.el,W=el.clientWidth||600,H=el.clientHeight||600;
    const r=this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:!!this.o.capture});
    r.setPixelRatio(Math.min(devicePixelRatio||1,1.5));r.setSize(W,H);r.setClearColor(0x000000,0);el.appendChild(r.domElement);r.domElement.className='holo-cv';
    this.scene=new THREE.Scene();this.cam=new THREE.PerspectiveCamera(30,W/H,0.05,20);this.cam.position.set(0,1.15,3.55);
    const c=this.ctl=new OrbitControls(this.cam,r.domElement);c.target.set(0,1.0,0);c.enableDamping=true;c.dampingFactor=0.08;c.enablePan=false;
    c.minDistance=1.6;c.maxDistance=6;c.minPolarAngle=0.55;c.maxPolarAngle=2.35;c.rotateSpeed=0.7;c.autoRotate=!this.reduced;c.autoRotateSpeed=0.55;c.update();
    this.fitStand();c.addEventListener('start',()=>{c.autoRotate=false;clearTimeout(this.arT)});c.addEventListener('end',()=>{if(!this.reduced)this.arT=setTimeout(()=>c.autoRotate=!this.poseId,6000)});
    if(this.reduced)c.addEventListener('change',()=>this.render());
    /* driver skeleton: poses.js turns these joints; the visible body follows them */
    const bones=BONES.map(([n])=>{const b=new THREE.Bone();b.name=n;return b});
    BONES.forEach(([n,p,pos],i)=>{const par=p<0?null:BONES[p][2];bones[i].position.set(pos[0]-(par?par[0]:0),pos[1]-(par?par[1]:0),pos[2]-(par?par[2]:0));if(p>=0)bones[p].add(bones[i])});
    this.bones=bones;this.rig=new THREE.Group();this.rig.add(bones[0]);this.scene.add(this.rig);
    this.u={uTime:{value:0},uFade:{value:this.assembleT>=1?1:0},uScan:{value:-1},uLvl:{value:new Array(16).fill(0)},uCol:{value:Array.from({length:16},()=>new THREE.Color(0x9fe3ff))},uSelA:{value:new Array(16).fill(0)},uBase:{value:new THREE.Color(0x5fb8ff)},uMotion:{value:this.reduced?0:1}};
    const LIGHT={blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor};this.LIGHT=LIGHT;
    const m=new THREE.ShaderMaterial({uniforms:this.u,vertexShader:VERT,fragmentShader:FRAG,transparent:true,...LIGHT,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
    /* the body: the real human model (CC0), or our own generated body if it can't load */
    let data=null;
    if(!this.o.procedural){try{const md=this.md=await loadModel(new URL('../assets/model/male.gltf',import.meta.url).href);
      md.sk.material=m;md.sk.frustumCulled=false;this.mesh=md.sk;this.geo=md.geo;this.rig.add(md.root);follow(md,bones);md.sk.skeleton.update();const sp=new Float32Array(md.nv*3),vv=new THREE.Vector3();for(let i=0;i<md.nv;i++){md.sk.getVertexPosition(i,vv);vv.applyMatrix4(md.sk.matrixWorld);sp[i*3]=vv.x;sp[i*3+1]=vv.y;sp[i*3+2]=vv.z}data={pos:sp,nv:md.nv,ms:md.ms}}catch(e){console.warn('Hologram model not loaded, using the generated body.',e);this.md=null}}
    if(!data){data=this.o.data||(this.o.sync?await import('./mesh.js').then(mm=>{const t0=performance.now();const d=mm.build(this.o.h||0.0075);d.ms=Math.round(performance.now()-t0);return d}):null)||await new Promise((res,rej)=>{const w=new Worker(new URL('./body-worker.js',import.meta.url),{type:'module'});w.onmessage=e=>{res(e.data);w.terminate()};w.onerror=rej;w.postMessage({h:this.o.h||0.0075})});
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(data.nor,3));
      g.setAttribute('aRegion',new THREE.BufferAttribute(data.reg,1));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(data.sw,4));
      g.setIndex(new THREE.BufferAttribute(data.idx,1));g.computeBoundingSphere();this.geo=g;
      const mesh=this.mesh=new THREE.SkinnedMesh(g,m);mesh.add(bones[0]);mesh.bind(new THREE.Skeleton(bones));mesh.frustumCulled=false;this.rig.add(mesh)}
    this.buildMs=data.ms;this.verts=data.nv;
    /* particles that assemble into the body, then sparkle */
    const n=Math.min(9000,data.nv),tp=new Float32Array(n*3),st=new Float32Array(n*3),sd=new Float32Array(n);const step=data.nv/n;
    for(let i=0;i<n;i++){const q=Math.floor(i*step)*3;tp[i*3]=data.pos[q];tp[i*3+1]=data.pos[q+1];tp[i*3+2]=data.pos[q+2];const a=Math.random()*6.283,rr=0.6+Math.random()*1.6;
      st[i*3]=Math.cos(a)*rr;st[i*3+1]=data.pos[q+1]+(Math.random()-0.5)*0.9;st[i*3+2]=Math.sin(a)*rr*0.6-0.2;sd[i]=Math.random()}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(tp,3));pg.setAttribute('aStart',new THREE.BufferAttribute(st,3));pg.setAttribute('aSeed',new THREE.BufferAttribute(sd,1));
    this.pu={uT:{value:this.assembleT},uTime:this.u.uTime,uSize:{value:5.5*r.getPixelRatio()},uBase:this.u.uBase,uFade:{value:1},uMotion:this.u.uMotion};
    this.pts=new THREE.Points(pg,new THREE.ShaderMaterial({uniforms:this.pu,vertexShader:PVERT,fragmentShader:PFRAG,transparent:true,...this.LIGHT,depthWrite:false,depthTest:false}));
    this.pts.frustumCulled=false;this.rig.add(this.pts);
    /* platform rings under the feet */
    const ring=new THREE.Group();for(const [rad,op] of [[0.42,0.5],[0.56,0.28],[0.72,0.14]]){const geo=new THREE.RingGeometry(rad,rad+0.004,96);const mm=new THREE.MeshBasicMaterial({color:0x5fb8ff,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});const me=new THREE.Mesh(geo,mm);me.rotation.x=-Math.PI/2;ring.add(me)}
    const disc=new THREE.Mesh(new THREE.CircleGeometry(0.42,64),new THREE.MeshBasicMaterial({color:0x2a6fb0,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false}));disc.rotation.x=-Math.PI/2;ring.add(disc);ring.position.y=0.003;this.ring=ring;this.mkProps();this.scene.add(ring);
    /* bloom */
    this.comp=new EffectComposer(r);this.comp.addPass(new RenderPass(this.scene,this.cam));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(W/2,H/2),0.6,0.5,0.12);this.comp.addPass(this.bloom);this.comp.addPass(new OutputPass());
    /* picking: click (not drag) selects the muscle under the pointer */
    let down=null;r.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,performance.now()];if(this.assembleT<1)this.assembleT=0.999});
    r.domElement.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down[0],e.clientY-down[1]);if(moved<5&&performance.now()-down[2]<500)this.pick(e);down=null});
    new ResizeObserver(()=>this.resize()).observe(el);this.ready=true;this.t0=performance.now();this.last=this.t0;this.apply();
    if(this.reduced){this.render()}else this.loop();return this}
  resize(){if(!this.renderer)return;const W=this.el.clientWidth,H=this.el.clientHeight;if(!W||!H)return;this.cam.aspect=W/H;this.cam.updateProjectionMatrix();if(!this.inSession)this.fitStand();this.renderer.setSize(W,H);this.comp.setSize(W,H);this.bloom.resolution.set(W/2,H/2);this.applyOff();this.render()}
  /* body map framing: the whole standing body, head to feet and the floor ring, fits the stage at any size (25 Nov fix: feet were cut at 1366) */
  fitStand(){const W=this.el.clientWidth||600,H=this.el.clientHeight||600,a=W/H,t=Math.tan(this.cam.fov*Math.PI/360),d=Math.min(this.ctl.maxDistance,Math.max(1.02/t,0.62/(t*a)));
    const tg=this.ctl.target,dir=this.cam.position.clone().sub(tg).normalize();tg.set(0,0.9,0);this.cam.position.copy(tg).addScaledVector(dir,d);this.ctl.update()}
  offset(f){this.offT=f;if(this.reduced||this.o.capture){this.offX=f;this.applyOff();this.render()}}
  applyOff(){if(!this.renderer)return;const W=this.el.clientWidth,H=this.el.clientHeight;if(this.offX)this.cam.setViewOffset(W,H,W*this.offX,0,W,H);else this.cam.clearViewOffset()}
  mount(el){if(this.el===el)return;this.el=el;el.appendChild(this.renderer.domElement);this.resize()}
  /* muscle state: levels = {key:{lvl,col}}, sel = key */
  setMuscles(levels,sel){this.levels=levels||{};this.sel=sel===undefined?this.sel:sel;this.apply()}
  select(key){this.sel=key;this.apply()}
  apply(){if(!this.u)return;REGIONS.forEach((k,i)=>{const L=this.levels[k];this.u.uLvl.value[i]=L?L.lvl:0;this.u.uCol.value[i].set(L&&L.col||0x9fe3ff);this.u.uSelA.value[i]=this.sel&&k===this.sel?1:0});if(this.reduced)this.render()}
  onPick(cb){this.cb=cb}
  pick(e){const rc=new THREE.Raycaster(),rect=this.renderer.domElement.getBoundingClientRect();
    rc.setFromCamera(new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1),this.cam);
    this.mesh.updateMatrixWorld(true);if(this.mesh.computeBoundingSphere)this.mesh.computeBoundingSphere();const hit=rc.intersectObject(this.mesh,false)[0];let key=null;
    if(hit){const a=this.geo.attributes.aRegion,f=hit.face;const cnt={};for(const v of [f.a,f.b,f.c]){const k=REGIONS[Math.round(a.getX(v))];cnt[k]=(cnt[k]||0)+1}key=Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x])[0];if(key==='none')key=null}
    this.sel=key;this.apply();this.cb&&this.cb(key)}
  view(side){/* front | back */const d=this.cam.position.distanceTo(this.ctl.target);const a=side==='back'?Math.PI:0;this.ctl.autoRotate=false;this.tween={from:this.ctl.getAzimuthalAngle(),to:a,t:0,d};if(this.reduced||this.o.capture){this.tween=null;this.setAz(a);this.render()}}
  setAz(a){const t=this.ctl.target,d=this.cam.position.distanceTo(t),pol=this.ctl.getPolarAngle();this.cam.position.set(t.x+d*Math.sin(pol)*Math.sin(a),t.y+d*Math.cos(pol),t.z+d*Math.sin(pol)*Math.cos(a));this.ctl.update()}
  /* exercise demonstration: id from POSES, or null for the standing pose */
  frame(id){const c=CAM[id]||CAM._;const cz=c.z||0;this.ctl.target.set(0,c.y,cz);const pol=Math.PI/2-(c.el||0.08);const p=this.cam.position;p.set(c.d*Math.sin(pol)*Math.sin(c.az),c.y+c.d*Math.cos(pol),cz+c.d*Math.sin(pol)*Math.cos(c.az));this.ctl.update()}
  /* props (bar, chair, step, books, bottles) are placed where the body's hands and feet really are */
  mkProps(){this.pmat={line:new THREE.LineBasicMaterial({color:0x9fe3ff,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false}),
      fill:new THREE.MeshBasicMaterial({color:0x5fb8ff,transparent:true,opacity:0.06,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),
      solid:new THREE.MeshBasicMaterial({color:0xbfefff,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false})};
    this.propG=new THREE.Group();this.scene.add(this.propG);this.handProps=[]}
  boxProp(w,h,d,x,y,z){const g=new THREE.BoxGeometry(w,h,d),o=new THREE.Group();o.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),this.pmat.line));o.add(new THREE.Mesh(g,this.pmat.fill));o.position.set(x,y,z);return o}
  mpt(n,out=new THREE.Vector3()){const L=PT[n];out.set(0,0,0);const v=new THREE.Vector3();for(const b of L){this.md.M[b].getWorldPosition(v);out.add(v)}return out.multiplyScalar(1/L.length)}
  placeProps(id){const G=this.propG;while(G.children.length)G.remove(G.children[0]);this.handProps.forEach(o=>o.parent&&o.parent.remove(o));this.handProps=[];
    this.handPack=null;const F=id&&FIT[id];if(!F||!this.md)return;this.setPose(id,0.5);const v=new THREE.Vector3(),ex=this.ex||{};
    if(ex.handBooks)for(const b of ['hand_l','hand_r']){this.md.M[b].getWorldPosition(v);G.add(this.boxProp(0.17,0.05,0.24,v.x,0.025,v.z))}
    if(ex.pack==='back'){const pk=this.boxProp(0.3,0.4,0.15,0,0,0);pk.position.copy(this.md.packPos);pk.quaternion.copy(this.md.packQ);this.md.M.spine_03.add(pk);this.handProps.push(pk)}
    if(ex.pack==='hands'){this.handPack=this.boxProp(0.3,0.36,0.15,0,0,0);G.add(this.handPack);this.movePack()}
    for(const p of (F.props||[])){
      if(p.mat){this.mpt(p.mat,v);G.add(this.boxProp(0.36,0.008,0.34,0,0.004,v.z))}
      if(p.bar){this.mpt(p.bar,v);const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,1.1,12),this.pmat.solid);rod.rotation.z=Math.PI/2;rod.position.set(0,v.y+(p.dy||0),v.z);G.add(rod)}
      if(p.box){this.mpt(p.box,v);const top=Math.max(0.05,v.y-(p.gap??0.04));G.add(this.boxProp(p.w||0.45,top,p.d||0.38,p.cx??0,top/2,v.z+(p.dz||0)))}
      if(p.books)for(const b of ['foot_l','foot_r']){this.md.M[b].getWorldPosition(v);G.add(this.boxProp(0.13,p.books,0.21,v.x,p.books/2,v.z-0.01))}
      if(p.bottles)for(const b of ['hand_l','hand_r']){const bt=new THREE.Group(),g=new THREE.CylinderGeometry(0.038,0.038,p.bottles,14);
        bt.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,30),this.pmat.line));bt.add(new THREE.Mesh(g,this.pmat.fill));const hb=this.md.M[b];hb.add(bt);bt.position.set(0,0.085,0.0);bt.rotation.set(0,0,Math.PI/2);this.handProps.push(bt)}}}
  pose(id,ex){const key=JSON.stringify(ex||{});if(id&&id===this.poseId&&key===this.exKey)return;this.ex=ex||{};this.exKey=key;this.poseId=id&&POSES[id]?id:null;this.placeProps(this.poseId);this.poseT=this.o.capture&&this.poseId?(POSES[this.poseId].period||3.2)*0.5:0;if(this.inSession)this.frame(this.poseId);this.ctl.autoRotate=!this.poseId&&!this.reduced;if(!this.poseId)this.setPose(null);
    this.pu.uFade.value=this.poseId?0:1;this.pts.visible=!this.poseId;if(this.reduced){this.setPose(this.poseId,0.5);this.render()}}
  setPose(id,t){if(!id){this.applyPose(null,null,[]);return}const P=POSES[id](t),F=FIT[id],K=F&&F.ik;
    if(!K||!this.md){this.applyPose(id,P,[]);return}
    /* keep a second contact fixed (rear foot on the chair, feet on the box) by adjusting leg joints: Gauss-Newton, warm-started */
    const nv=K.vars.length,v=(this.ikV&&this.ikV.id===id?this.ikV.v.slice():new Array(nv).fill(0)),T=K.target,pv=new THREE.Vector3();
    const res=x=>{this.applyPose(id,P,x);this.mpt(K.pt,pv);const r=[];if(T.y!=null)r.push(pv.y-T.y);if(T.z!=null)r.push(pv.z-T.z);return r};
    for(let it=0;it<3;it++){const r0=res(v),m=r0.length;if(Math.hypot(...r0)<0.004)break;const Jc=[];
      for(let j=0;j<nv;j++){const w=v.slice();w[j]+=0.03;const r1=res(w);Jc.push(r1.map((x,i)=>(x-r0[i])/0.03))}
      /* solve (J^T J + lambda I) d = -J^T r */
      const A=[...Array(nv)].map((_,a)=>[...Array(nv)].map((_,b)=>Jc[a].reduce((s,_,i)=>s+Jc[a][i]*Jc[b][i],0)+(a===b?1e-3:0))),g=[...Array(nv)].map((_,a)=>-Jc[a].reduce((s,x,i)=>s+x*r0[i],0));
      const d=nv===1?[g[0]/A[0][0]]:(()=>{const det=A[0][0]*A[1][1]-A[0][1]*A[1][0];return[(g[0]*A[1][1]-A[0][1]*g[1])/det,(A[0][0]*g[1]-g[0]*A[1][0])/det]})();
      for(let j=0;j<nv;j++)v[j]=Math.max(-1.2,Math.min(1.2,v[j]+d[j]))}
    this.ikV={id,v:v.slice()};res(v)}
  applyPose(id,P,x){this._ap=1;const bones=this.bones;bones.forEach(b=>b.rotation.set(0,0,0));this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);
    if(!id){this.follow();return}for(const k in P.b){const b=bones[B[k]];if(b)b.rotation.set(P.b[k][0]||0,P.b[k][1]||0,P.b[k][2]||0)}
    const K=FIT[id]&&FIT[id].ik;if(K)K.vars.forEach((js,j)=>js.forEach(n=>{bones[B[n]].rotation.x+=x[j]||0}));
    if(P.rot){this.rig.position.set(0,0.95,0);this.rig.rotation.set(P.rot[0]||0,P.rot[1]||0,P.rot[2]||0);const o=new THREE.Vector3(0,-0.95,0).applyEuler(this.rig.rotation);this.rig.position.add(o)}
    if(P.pos)this.rig.position.add(new THREE.Vector3(...P.pos));this.follow();this.fit(id);this.movePack()}
  /* contacts: turn the whole body (about the anchor) so the `level` point touches its height, then move it so the anchor touches its spot */
  fit(id){const F=FIT[id];if(!F||!this.md)return;const rig=this.rig,A=new THREE.Vector3(),Bp=new THREE.Vector3();rig.updateMatrixWorld(true);
    if(F.level){this.mpt(F.anchor.pt,A);this.mpt(F.level.pt,Bp);const d=Bp.sub(A),ty=F.level.y-F.anchor.y,ax=F.level.axis||'x';
      const r=ax==='x'?Math.hypot(d.y,d.z):Math.hypot(d.y,d.x);if(r>1e-4){const a=Math.acos(Math.max(-1,Math.min(1,ty/r)));
        const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));let th;
        if(ax==='x'){const ph=Math.atan2(d.z,d.y);const c1=wrap(a-ph),c2=wrap(-a-ph);th=Math.abs(c1)<Math.abs(c2)?c1:c2}
        else{const ph=Math.atan2(d.x,d.y);const c1=wrap(ph+a),c2=wrap(ph-a);th=Math.abs(c1)<Math.abs(c2)?c1:c2}
        const q=new THREE.Quaternion().setFromAxisAngle(ax==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),th);
        rig.quaternion.premultiply(q);rig.position.sub(A).applyQuaternion(q).add(A);rig.updateMatrixWorld(true)}}
    this.mpt(F.anchor.pt,A);rig.position.y+=F.anchor.y+(this.ex&&this.ex.handBooks&&F.anchor.pt==='hands'?0.05:0)-A.y;if(F.anchor.z!=null)rig.position.z+=F.anchor.z-A.z;rig.updateMatrixWorld(true);
    if(F.palms)for(const s of ['l','r']){const h=this.md.M['hand_'+s],c=this.md.M['middle_01_'+s],a=h.getWorldPosition(new THREE.Vector3()),cur=c.getWorldPosition(new THREE.Vector3()).sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(cur,new THREE.Vector3(0,-0.1,1).normalize());
      const wq=h.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);h.quaternion.copy(h.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));h.updateMatrixWorld(true)}}
  movePack(){if(!this.handPack||!this.md)return;const a=this.md.M.hand_l.getWorldPosition(new THREE.Vector3()),b=this.md.M.hand_r.getWorldPosition(new THREE.Vector3());this.handPack.position.copy(a.add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0,-0.17,this.poseId==='curl'?0.1:0))}
  follow(){if(this.md){this.rig.updateMatrixWorld(true);follow(this.md,this.bones);const F=this.poseId&&FIT[this.poseId];curl(this.md,F&&F.grip!=null?F.grip:0.35)}}
  replay(){if(this.reduced)return;this.assembleT=0;this.u.uFade.value=0}
  loop(){const tick=now=>{this.raf=requestAnimationFrame(tick);if(document.hidden||this.paused){this.last=now;return}const dt=Math.min(0.05,(now-this.last)/1000);this.last=now;
      this.frames.push(dt);if(this.frames.length>120)this.frames.shift();this.fps=Math.round(this.frames.length/this.frames.reduce((a,b)=>a+b,0));
      this.step(dt,now);this.renderFrame();this.guard()};this.raf=requestAnimationFrame(tick)}
  step(dt,now){const t=(now-this.t0)/1000;this.u.uTime.value=t;
    if(this.assembleT<1){this.assembleT=Math.min(1,this.assembleT+dt/1.9);this.pu.uT.value=this.assembleT;this.u.uFade.value=Math.min(1,Math.max(0,(this.assembleT-0.3)/0.6))}
    this.u.uScan.value=this.assembleT<1?this.assembleT*1.9:(t*0.45)%3.2-0.6;
    if(this.offT!=null&&this.offX!==this.offT){this.offX=(this.offX||0)+(this.offT-(this.offX||0))*Math.min(1,dt*7);if(Math.abs(this.offX-this.offT)<0.002)this.offX=this.offT;this.applyOff()}
    if(this.tween){const w=this.tween;w.t=Math.min(1,w.t+dt/0.7);let d=w.to-w.from;d=Math.atan2(Math.sin(d),Math.cos(d));const e=w.t<0.5?2*w.t*w.t:1-Math.pow(-2*w.t+2,2)/2;this.setAz(w.from+d*e);if(w.t>=1)this.tween=null}
    if(this.poseId){this.poseT+=dt;const per=POSES[this.poseId].period||3.2;this.setPose(this.poseId,(this.poseT%per)/per)}
    this.ring.rotation.y+=dt*0.1;this.ctl.update()}
  renderFrame(){if(this.mode==='lite')this.renderer.render(this.scene,this.cam);else this.comp.render()}
  /* re-entry guard: ctl.update() fires "change", which calls render() again under reduced motion (stack overflow fix, 25 Nov 2026) */
  render(){if(!this.ready||this._rnd)return;this._rnd=1;try{this.ctl.update();this.renderFrame()}finally{this._rnd=0}}
  /* weak GPU: after 2 s at under 40 fps drop the bloom; under 24 fps stop animating */
  guard(){if(this.o.noGuard||this.frames.length<120||this.checked)return;this.checked=true;if(this.fps<40){this.mode='lite';this.frames=[];this.checked=false;if(this.fps<24){this.reduced=true;cancelAnimationFrame(this.raf);this.u.uMotion.value=0;this.render()}}}
  stats(){return{fps:this.fps,mode:this.mode,reduced:this.reduced,verts:this.verts,buildMs:this.buildMs}}
}
