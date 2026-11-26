import {shapes,dShape,field,BONES} from './body.js';
/* mesh builder shared by the worker and the screenshot mode */
export function build(h){
  const S=shapes(),F=(x,y,z)=>field(S,x,y,z);
  const x0=-0.6,y0=-0.01,z0=-0.2,X1=0.6,Y1=1.84,Z1=0.24;
  const nx=Math.ceil((X1-x0)/h)+1,ny=Math.ceil((Y1-y0)/h)+1,nz=Math.ceil((Z1-z0)/h)+1;
  /* coarse pass (4 fine cells per coarse cell) */
  const C=4,cx=Math.ceil(nx/C)+1,cy=Math.ceil(ny/C)+1,cz=Math.ceil(nz/C)+1,cv=new Float32Array(cx*cy*cz),H=h*C;
  for(let k=0;k<cz;k++)for(let j=0;j<cy;j++)for(let i=0;i<cx;i++)cv[i+cx*(j+cy*k)]=F(x0+i*H,y0+j*H,z0+k*H);
  const band=H*1.8,near=new Uint8Array(cx*cy*cz);
  for(let k=0;k<cz-1;k++)for(let j=0;j<cy-1;j++)for(let i=0;i<cx-1;i++){let m=1e9;for(let c=0;c<8;c++){const v=Math.abs(cv[(i+(c&1))+cx*((j+(c>>1&1))+cy*(k+(c>>2&1)))]);if(v<m)m=v}if(m<band)near[i+cx*(j+cy*k)]=1}
  /* fine values: exact near the surface, trilinear from the coarse grid elsewhere (only the sign matters there) */
  const N=nx*ny*nz,v=new Float32Array(N);
  for(let k=0;k<nz;k++){const ck=Math.min(cz-2,(k/C)|0),fk=k/C-ck;for(let j=0;j<ny;j++){const cj=Math.min(cy-2,(j/C)|0),fj=j/C-cj;for(let i=0;i<nx;i++){const ci=Math.min(cx-2,(i/C)|0),fi=i/C-ci,o=i+nx*(j+ny*k);
    if(near[ci+cx*(cj+cy*ck)])v[o]=F(x0+i*h,y0+j*h,z0+k*h);
    else{const g=(a,b,c)=>cv[(ci+a)+cx*((cj+b)+cy*(ck+c))];v[o]=((g(0,0,0)*(1-fi)+g(1,0,0)*fi)*(1-fj)+(g(0,1,0)*(1-fi)+g(1,1,0)*fi)*fj)*(1-fk)+((g(0,0,1)*(1-fi)+g(1,0,1)*fi)*(1-fj)+(g(0,1,1)*(1-fi)+g(1,1,1)*fi)*fj)*fk}}}}
  /* surface nets: one vertex per cell that crosses the surface */
  const cell=new Int32Array(N).fill(-1),P=[];const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const off=c=>[(c&1),(c>>1)&1,(c>>2)&1];const corner=[0,1,2,3,4,5,6,7].map(off);
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const o=i+nx*(j+ny*k);let mask=0;const g=[];
    for(let c=0;c<8;c++){const[a,b,d]=corner[c];const val=v[o+a+nx*(b+ny*d)];g.push(val);if(val<0)mask|=1<<c}
    if(mask===0||mask===255)continue;let sx=0,sy=0,sz=0,n=0;
    for(const[a,b]of E){const ga=g[a],gb=g[b];if((ga<0)===(gb<0))continue;const t=ga/(ga-gb),A=corner[a],Bc=corner[b];sx+=A[0]+(Bc[0]-A[0])*t;sy+=A[1]+(Bc[1]-A[1])*t;sz+=A[2]+(Bc[2]-A[2])*t;n++}
    cell[o]=P.length/3;P.push(x0+(i+sx/n)*h,y0+(j+sy/n)*h,z0+(k+sz/n)*h)}
  const I=[];
  for(let k=1;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const o=i+nx*(j+ny*k),a=v[o]<0;
    /* edge along x to (i+1,j,k): quad of cells around it */
    {const b=v[o+1]<0;if(a!==b){const q=[cell[o],cell[o-nx],cell[o-nx-nx*ny],cell[o-nx*ny]];if(q.every(x=>x>=0))a?I.push(q[0],q[1],q[2],q[0],q[2],q[3]):I.push(q[0],q[3],q[2],q[0],q[2],q[1])}}
    {const b=v[o+nx]<0;if(a!==b){const q=[cell[o],cell[o-nx*ny],cell[o-1-nx*ny],cell[o-1]];if(q.every(x=>x>=0))a?I.push(q[0],q[1],q[2],q[0],q[2],q[3]):I.push(q[0],q[3],q[2],q[0],q[2],q[1])}}
    {const b=v[o+nx*ny]<0;if(a!==b){const q=[cell[o],cell[o-1],cell[o-1-nx],cell[o-nx]];if(q.every(x=>x>=0))a?I.push(q[0],q[1],q[2],q[0],q[2],q[3]):I.push(q[0],q[3],q[2],q[0],q[2],q[1])}}}
  /* per vertex: smooth normal from the field, muscle region, two bone weights */
  const nv=P.length/3,pos=new Float32Array(P),nor=new Float32Array(nv*3),reg=new Float32Array(nv),si=new Uint16Array(nv*4),sw=new Float32Array(nv*4),e=h*0.5;
  const nb=BONES.length;
  for(let q=0;q<nv;q++){const x=pos[q*3],y=pos[q*3+1],z=pos[q*3+2];
    let gx=F(x+e,y,z)-F(x-e,y,z),gy=F(x,y+e,z)-F(x,y-e,z),gz=F(x,y,z+e)-F(x,y,z-e);const l=Math.hypot(gx,gy,gz)||1;nor[q*3]=gx/l;nor[q*3+1]=gy/l;nor[q*3+2]=gz/l;
    let best=1e9,r=0;const bd=new Array(nb).fill(1e9);
    for(const s of S){const d=dShape(s,x,y,z);if(d<best){best=d;r=s.reg}if(d<bd[s.bone])bd[s.bone]=d}
    reg[q]=r;let b1=0,b2=-1;for(let b=1;b<nb;b++)if(bd[b]<bd[b1])b1=b;for(let b=0;b<nb;b++)if(b!==b1&&(b2<0||bd[b]<bd[b2]))b2=b;
    const w2=Math.exp(-(bd[b2]-bd[b1])/0.03),s2=w2/(1+w2);si[q*4]=b1;si[q*4+1]=b2;sw[q*4]=1-s2;sw[q*4+1]=s2}
  return{pos,nor,reg,si,sw,idx:new Uint32Array(I),nv,nt:I.length/3,grid:[nx,ny,nz]}}
