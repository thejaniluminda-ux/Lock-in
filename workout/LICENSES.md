# Asset licences (Workout page)

| Asset | Where | Licence | Notes |
|---|---|---|---|
| Three.js r160 (`three.module.min.js`) | `vendor/` | MIT | Copied from cdnjs (three.js 0.160.0). Licence text in `vendor/LICENSE-three.txt`. |
| Three.js add-ons: OrbitControls, EffectComposer, RenderPass, ShaderPass, MaskPass, Pass, UnrealBloomPass, OutputPass, CopyShader, LuminosityHighPassShader, OutputShader, GLTFLoader, BufferGeometryUtils | `vendor/addons/` | MIT | Same project and version (three@0.160.0 via jsDelivr). Same licence file. |
| Geist and Geist Mono fonts | `assets/fonts/` | SIL Open Font License 1.1 | By Vercel. Licence text in `assets/fonts/OFL-geist.txt`. |
| 3D body model | `assets/model/male.gltf` + `male.bin` | CC0 1.0 (public domain) | "Superhero Male" from Quaternius, *Universal Base Characters* (free Standard version, quaternius.com / quaternius.itch.io). Licence text is in the pack: "CC0 1.0 Universal". Textures removed; only the body mesh and skeleton are used. Muscle zones and movement are added by `js/model.js`. |
| Backup body (used only if the model fails to load) | generated in `js/body.js` + `js/mesh.js` | Our own | Built from our own maths. |
| Exercise animations | `js/poses.js` | Our own | Hand-written joint angles. |
| Icons | inline SVG in the JS | Our own | Simple line paths. |
| Photo and flat body-map placeholders | `silhouette()` in `js/app.js` | Our own | Simple SVG paths. |

Nothing loads from the internet at run time. Everything above is bundled and cached by `sw.js` for offline use.
