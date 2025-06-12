
# SIXR Vision

**Project Overview:** SIXR Vision is an **audio-reactive** XR storytelling application developed by the SIXR Lab, which empowers inclusive XR experiences by and for BIPOC, women, and LGBTQ+ creators.  The app generates real-time visualizations driven by live music and AI, suitable for live performances and immersive events.  In its metadata the project is described as an “Audio-Reactive Visualizer with AI Features, themed for SBNF 2025”, reflecting its role in the Seattle BIPOC festival (Cosmic Grapevines theme).  SIXR Vision combines live audio analysis, webcam input, and AI-based creativity tools to let users craft dynamic, music-synchronized graphics and environments that highlight diverse narratives.

## Core Features:

- Audio-Reactive Pipeline: Web Audio API (FFT, energy analysis) → Gain / AGC → Spectrum vectors feed geometry, colour shifts, and particle emitters.
- AI Preset Chooser: Gemini inspects bass / mid / treble energy + BPM and recommends—or auto-loads—the most fitting scene.
- Interactive Cam Layer: Lazy `getUserMedia`, mirror toggle, motion-energy scalar; optional AI segmentation for crisp performer cut-outs.
- SIXR Branding Stack: • Boot-logo shimmer • 15 % rotating watermark (SIXR + partners) • Centre “S I X R” type—stroke & glow track RMS • Beat-flash logo outline.
- Preset Registry: Scenes registered via `registerScene(id,meta,drawFn)`; built-ins: Spectrum Bars, Radial Burst, Mirror Silhouette, Particle Finale, Echoing Shapes, Frequency Rings, Strobe Light, Geometric Tunnel. Morphing engine cross-fades by BPM or operator cue.
- AI Creative Kit: Palette Genie (harmonious HSB sets) · optional Style-Transfer shader (planned) · Procedural Assets (texture/mesh previews from prompt).
- React Control Panel: Sliders (FFT bins, Gain/AGC, Gamma, Dither, Bright-Cap, Logo-Opacity) · Preset thumbnails · Hotkeys 1-9, P panic-black, L logo-black, Ctrl Z undo (planned) · JSON cue-list player (planned).
- WebSocket / OSC API: Same commands as panel (`/preset`, `/gain`, `/panic`)—tablet or lighting desk can run the show (planned).
- Art-Net Bridge: Beat envelope → DMX ch-1, RMS → ch-2; consoles can flip scenes via return channel (planned).
- Adaptive Watchdog: ML predictor + live FPS monitor; if < 50 fps for 2 s, halves FFT bins & mutes heavy shaders (planned).
- QA & Safety: Photosensitive-flash guard (> 3 Hz / > 20 cd Δ) (planned)
- QA & Safety: IndexedDB rehearsal log (CSV export)
- QA & Safety: Real-time frame-time heat-map overlay (planned)

## Visualizer Presets In-Depth

Here's a closer look at the visual experiences offered by the built-in presets:

### 1. Spectrum Bars (`spectrum_bars`)
*Description:* Watch as the raw energy of your audio is translated into a dynamic cityscape of light. Each bar represents a distinct frequency band, pulsing and stretching in perfect sync with the music's heartbeat – from the deepest bass rumbles to the highest cymbal shimmers. It's a classic, hypnotic visualization of sound made tangible, with colors that shift and intensify with the mood of the audio, often painting a vibrant, SBNF-themed palette across the screen.

### 2. Radial Burst (`radial_burst`)
*Description:* Feel the music explode outwards from a central cosmic core! With every beat, a nova of radiant particles erupts, painting the void with trails of light. Low frequencies create powerful shockwaves of particles, while higher tones scatter like stardust. The intensity and color of the bursts are deeply tied to the audio, creating an immersive, energetic bloom of audiovisual power, often reflecting the "Cosmic Grapevines" theme with rich purples, oranges, and stellar yellows.

### 3. Echoing Shapes (`echoing_shapes`)
*Description:* Dive into a mesmerizing dance of emergent geometry against a backdrop of subtly twinkling stars. Simple shapes – circles, squares, triangles – materialize from the ether, pulsing with the rhythm and glowing with vibrant, shifting colors inspired by the "Cosmic Grapevines" theme. Each beat sends out new forms that scale and fade, creating a layered, hypnotic tapestry that elegantly reflects the music's structure and energy.

### 4. Particle Finale (`particle_finale`)
*Description:* Brace yourself for a grand spectacle of cosmic fireworks! This preset unleashes a dense, swirling galaxy of particles that react dramatically to every nuance of the sound. Beats trigger explosive bursts, scattering particles across the screen like a stellar cataclysm, while sustained notes can create flowing nebulae of light. It's an intense, full-screen celebration of sound and motion, perfect for climactic moments, with colors that flare and shimmer through the SBNF palette.

### 5. Neon Pulse Grid (`neon_pulse_grid`)
*Description:* Step into a retro-futuristic landscape of pure energy. A vast grid of neon cells comes alive, each one pulsing and glowing in response to different frequencies. Bass notes send deep, resonant waves across the grid, mids create shimmering, interconnected patterns, and trebles make individual cells scintillate with sharp light. The grid itself forms an electrifying, digital soundscape, often bathed in cool blues, lavenders, and accented with fiery SBNF oranges.

### 6. Mirror Silhouette (`mirror_silhouette`)
*Description:* Become part of the art with this interactive preset. If your webcam is active, your silhouette is transformed into a captivating visual element, outlined by a shifting rim light or filled with a dynamic, nebula-like texture that responds to the music. The background might feature procedurally generated "Cosmic Grapevines" that gently grow or grape-like particles that cluster and pulse with the audio, creating a personal, expressive experience where your movement and the music intertwine.

### 7. Frequency Rings (`frequency_rings`)
*Description:* Witness sound rippling outwards like cosmic waves across a dark, starlit void. Concentric rings expand from the center, their color, thickness, and intensity driven by different audio frequencies. Deep bass notes create wide, powerful rings in rich SBNF purples or reds, mids generate vibrant circles of orange and yellow, and trebles send out delicate, shimmering ripples of lavender or blue. It's a beautifully minimalist yet impactful representation of sound's pervasive energy.

### 8. Strobe Light (`strobe_light`)
*Description:* Prepare for an intense, rhythmic experience. With every detected beat, the entire screen erupts in a powerful flash of light, its color often shifting with the audio's character – perhaps a sharp white, a vibrant SBNF orange, or a cool lavender. This preset delivers a raw, energetic punch, ideal for high-energy music and creating a classic, pulsating club-like atmosphere. *(Use with caution if sensitive to flashing lights).*

### 9. Geometric Tunnel (`geometric_tunnel`)
*Description:* Embark on an exhilarating flight through an ever-shifting geometric wormhole. Rings and angular shapes, illuminated in vibrant neon hues from the SBNF palette, rush towards you, their forms and colors pulsing and twisting in sync with the music. The speed of your journey accelerates with the audio's intensity, and the camera's field of view might expand or contract with the beat, creating a thrilling, immersive voyage into a dynamic, digital dimension.

## Technology Stack

* **Frontend:** Next.js (React, TypeScript) for the web interface. State management is handled primarily by **Zustand**, providing a lean and efficient way to manage global and local component states. Styling uses Tailwind CSS and custom fonts (primarily Poppins, with system fallbacks; thematic fonts like Data70 for titles). UI components leverage ShadCN UI (built on Radix UI primitives) for consistency, with icons from Lucide React. Recharts is used for visualizing data like audio waveforms or logs.
* **Graphics/Audio:**  Uses the Web Audio API (FFT, energy analysis) for audio-reactive inputs, and Three.js/WebGL for 3D effects in all scenes. Webcam input is handled via HTML5 media APIs, with optional ML segmentation (planned).
* **AI/ML:** Google’s Gemini language model is accessed through the GenKit library (@genkit-ai/googleai) for tasks like scene suggestion and asset generation (e.g., style transfer (planned), color palettes, procedural asset image previews).
* **Backend / Database:** Firebase is used for authentication (planned) and data storage (e.g., IndexedDB for client-side rehearsal logs). The project is structured for Firebase Hosting / Functions. Development can use Firebase emulators for Auth and Firestore if backend features are added.
* **Development:** The codebase uses a Nix development environment (Node.js 20 and related packages). Development scripts (via `npm run dev`) start the Next.js server. GitHub Actions or the Firebase CLI can be used for deployment.

## Style Guidelines:

- Buttons · active sliders · focus rings
- Hover states · progress bars
- Canvas & panel backdrop
- Typeface — Poppins (primary sans-serif), Data70 (titles)
- Icons — minimalist geometric line set (Lucide React)
- Layout — split-screen: full-bleed visualizer + ~280-320 px control panel
- Motion — 200 ms ease-out fades & slides; spring easing on slider thumbs

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/sixrcode/sixr-vision.git
   cd sixr-vision
   ```
2. **Install dependencies:**

   ```bash
   npm install
   ```
3. **Environment setup:**

   * Copy `.env.example` or create a `.env.local` file.
   * Add your `GOOGLE_API_KEY="YOUR_KEY_HERE"` to this file. This is required for AI features.
   * Add any other Firebase config variables (API keys, project ID, etc.) if you integrate Firebase backend services.
   * (If using Nix: run `nix develop` to enter the environment with Node.js v20.)
4. **Start development server:**

   ```bash
   npm run dev
   ```

   This runs the app (by default on `localhost:9002`). Ensure any required services (like Firestore emulator or a Firebase project) are running if you've configured them.

## Usage

* **Access the app:** Open your browser to [http://localhost:9002](http://localhost:9002) (or the configured host/port). You should see the SIXR Vision interface with a visualizer canvas and side control panel.
* **Audio input:** Play music on your device or enable microphone input via the mic icon in the control panel header. The visuals will react to the audio. Adjust sliders (gain, AGC, etc.) in the "Audio Engine" section to tune the responsiveness.
* **Webcam:** Click the camera icon in the control panel header to enable your webcam. Allow browser permission. Use the **Mirror** toggle in "Webcam Layer" controls to flip the feed. Motion in front of the camera will influence certain scenes (e.g., Mirror Silhouette).
* **Presets:** Click on scene thumbnails or press number keys **1–9** to load built-in scenes (see "Visualizer Presets In-Depth" for descriptions). Scenes cross-fade automatically if "Enable Scene Transitions" is active. Press **P** to blackout (panic mode), and **L** to toggle the SIXR logo blackout.
* **AI tools:** Explore the "AI: ..." sections in the control panel. Use the Palette Genie, Procedural Assets generator, or let the AI suggest scenes. These may require a valid `GOOGLE_API_KEY`. For example, try the SBNF-themed prompt "Cosmic Grapevines" for procedural assets.
* **Remote control:** (Planned Feature) The app will listen for WebSocket/OSC commands. You'll be able to send commands like `{"route":"/preset","value":"radial_burst"}` to change scenes remotely. (An Art-Net lighting console will be able to send/receive as well.)
* **Performance monitoring:** (Planned Feature) If you experience frame drops, an on-screen FPS display or heatmap will be available. A watchdog will attempt to self-adjust settings to recover smoothness. Use the IndexedDB logs (downloadable CSV from "System & Safety") to review performance over time.

## Contributing & Community

We welcome contributions to SIXR Vision! To contribute, first **open an issue** to discuss major changes or features. For code contributions, **fork the repository** and submit a pull request with your changes. Please write clear commit messages and include any relevant tests or documentation. We also appreciate help with testing on different platforms (browsers, devices).

We strongly encourage an **inclusive, respectful community**. SIXR Vision is meant to support diverse creators: contributions from BIPOC, women, LGBTQ+ creators, and all underrepresented groups are especially valued. Our conduct guidelines require everyone to be professional and courteous—abusive or discriminatory language will not be tolerated. Please ensure your suggestions and code uphold accessibility and diversity: for example, consider colorblind-friendly palettes, legible text, and respectful representations. Before submitting large changes, feel free to open an issue or discussion thread to get feedback.

By contributing, you agree to follow a standard [Contributor Covenant](https://www.contributor-covenant.org/)–style Code of Conduct: communicate clearly, credit others’ work, and be patient during reviews. We will merge pull requests once they meet quality standards and align with the project vision.

## License

MIT License

Copyright (c) [Year] [Full Name of Copyright Holder / SIXR Lab]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
