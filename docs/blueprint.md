# **App Name**: SIXR Vision

## Core Features:

- Audio-Reactive Pipeline: p5.AudioIn → Gain / AGC → FFT (128 ∣ 256 ∣ 512) Spectrum vectors feed geometry, colour shifts, and particle emitters.
- AI Preset Chooser: Gemini inspects bass / mid / treble energy + BPM and recommends—or auto-loads—the most fitting scene.
- Interactive Cam Layer: Lazy `getUserMedia`, mirror toggle, motion-energy scalar; optional AI segmentation for crisp performer cut-outs.
- SIXR Branding Stack: • Boot-logo shimmer • 15 % rotating watermark (SIXR + partners) • Centre “S I X R” type—stroke & glow track RMS • Beat-flash logo outline.
- Preset Registry: Scenes registered via `registerScene(id,meta,drawFn)`; built-ins: Spectrum Bars, Radial Burst, Mirror Silhouette, Particle Finale, optional Spline Hero. Morphing engine cross-fades by BPM or operator cue.
- AI Creative Kit: Palette Genie (harmonious HSB sets) · optional Style-Transfer shader · Procedural Assets (textures / meshes from prompt or audio).
- Svelte Panel: Sliders (FFT bins, Gain/AGC, Gamma, Dither, Bright-Cap, Logo-Opacity) · Preset thumbnails · Hotkeys 1-5, P panic-black, L logo-black, Ctrl Z undo · JSON cue-list player.
- WebSocket / OSC API: Same commands as panel (`/preset`, `/gain`, `/panic`)—tablet or lighting desk can run the show.
- Art-Net Bridge: Beat envelope → DMX ch-1, RMS → ch-2; consoles can flip scenes via return channel.
- Adaptive Watchdog: ML predictor + live FPS monitor; if < 50 fps for 2 s, halves FFT bins & mutes heavy shaders.
- QA & Safety: Photosensitive-flash guard (> 3 Hz / > 20 cd Δ)
- QA & Safety: IndexedDB rehearsal log (CSV export)
- QA & Safety: Real-time frame-time heat-map overlay

## Style Guidelines:

- Buttons · active sliders · focus rings
- Hover states · progress bars
- Canvas & panel backdrop
- Typeface — Inter / Poppins (sans-serif)
- Icons — minimalist geometric line set
- Layout — split-screen: full-bleed visualizer + 320 px control panel
- Motion — 200 ms ease-out fades & slides; spring easing on slider thumbs