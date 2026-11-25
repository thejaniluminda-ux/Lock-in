/* Lock In offline cache. Bump V when you upload a new index.html. */
const V='lockin-v63';
const CORE=['./','index.html','atom-story.js','dblock-story.js','qbank.js','weights.js','summaries.js','system.js','system.css','manifest.webmanifest','icon-192.png','icon-512.png',
  /* Workout page: loaded only when it opens, cached here so it works offline */
  'workout/assets/fonts/geist-mono.woff2','workout/assets/fonts/geist.woff2','workout/assets/model/male.bin','workout/assets/model/male.gltf','workout/assets/voice/manifest.json','workout/css/wo.css','workout/js/app.js','workout/js/body-worker.js','workout/js/body.js','workout/js/data.js','workout/js/holo.js','workout/js/mesh.js','workout/js/model.js','workout/js/narrator.js','workout/js/plan.js','workout/js/poses.js','workout/js/s2.js','workout/js/session.js','workout/js/voice.js','workout/vendor/addons/controls/OrbitControls.js','workout/vendor/addons/loaders/GLTFLoader.js','workout/vendor/addons/postprocessing/EffectComposer.js','workout/vendor/addons/postprocessing/MaskPass.js','workout/vendor/addons/postprocessing/OutputPass.js','workout/vendor/addons/postprocessing/Pass.js','workout/vendor/addons/postprocessing/RenderPass.js','workout/vendor/addons/postprocessing/ShaderPass.js','workout/vendor/addons/postprocessing/UnrealBloomPass.js','workout/vendor/addons/shaders/CopyShader.js','workout/vendor/addons/shaders/LuminosityHighPassShader.js','workout/vendor/addons/shaders/OutputShader.js','workout/vendor/addons/utils/BufferGeometryUtils.js','workout/vendor/three.module.min.js','workout/voice/lines.json','workout/voice/moments.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin&&(r.mode==='navigate'||u.pathname.endsWith('.html'))){
    /* app page: network first so updates arrive, cache when offline */
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));return}
  if(u.origin===location.origin||/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res})))}
});
