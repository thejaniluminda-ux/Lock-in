/* Builds the hologram body mesh off the main thread (see mesh.js). */
import {build} from './mesh.js';
self.onmessage=e=>{const t0=performance.now();const out=build(e.data&&e.data.h||0.0075);out.ms=Math.round(performance.now()-t0);
  self.postMessage(out,[out.pos.buffer,out.nor.buffer,out.reg.buffer,out.si.buffer,out.sw.buffer,out.idx.buffer])};
