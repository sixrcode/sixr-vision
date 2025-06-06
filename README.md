# SIXR Vision

**Project Overview:** SIXR Vision is an **audio-reactive** XR storytelling application developed by the SIXR Lab, which empowers inclusive XR experiences by and for BIPOC, women, and LGBTQ+ creators.  The app generates real-time visualizations driven by live music and AI, suitable for live performances and immersive events.  In its metadata the project is described as an “Audio-Reactive Visualizer with AI Features, themed for SBNF 2025”, reflecting its role in the Seattle BIPOC festival (Cosmic Grapevines theme).  SIXR Vision combines live audio analysis, webcam input, and AI-based creativity tools to let users craft dynamic, music-synchronized graphics and environments that highlight diverse narratives.

## Features

* **Audio-Reactive Visualization:**  Audio input (via Web Audio / FFT analysis) feeds into geometry, color, and particle effects, creating visuals that pulse and morph with the music. Users can adjust gain, AGC, and FFT size (128/256/512) to tune sensitivity and resolution.
* **AI-Powered Scene Selection:**  The app integrates Google’s Gemini AI (via the GenKit library) to analyze the music’s bass, mid, and treble energy and BPM.  It then **recommends or auto-loads** the most fitting visual scene for the track. This smart preset chooser makes it easy to find on-theme visuals without manual guesswork.
* **Interactive Camera Layer:**  Users can enable a live camera feed with mirror toggling and motion sensitivity.  Optionally, an AI segmentation model can isolate performers from the background for crisp visual effects.  This lets the performer become part of the scene (for example, glowing silhouettes or particle effects keyed to human motion).
* **Built-in Scenes & Branding:**  A registry of built-in scenes (e.g. Spectrum Bars, Radial Burst, Mirror Silhouette, Particle Finale, and an optional Spline Hero) are provided.  The system cross-fades between scenes by BPM or manual cues.  Custom SIXR branding (logo shimmer, rotating watermark, and beat-flash outline) is overlaid on the visuals for a cohesive event look.
* **AI Creative Kit:**  Users can generate color palettes and textures with AI.  The *Palette Genie* tool produces harmonious HSB color sets, and a style-transfer shader can apply artistic textures.  Even procedural assets (3D meshes or images) can be generated from text prompts or audio cues, enabling rapid creative exploration.
* **User Interface:**  A responsive control panel (built with React/Next.js) offers sliders for audio gain, brightness, gamma, and more.  Preset thumbnails let users preview scenes.  Keyboard shortcuts (1-9 for presets, **P** to panic/blackout, **L** to toggle logo blackout, *Ctrl+Z* to undo) and a JSON-based cue list player provide quick control.
* **Remote Control API:**  A WebSocket/OSC interface mirrors the UI commands (`/preset`, `/gain`, `/panic`, etc.). This lets external devices (tablets, lighting consoles, etc.) trigger changes in the show.
* **Lighting Integration (Art-Net):**  Audio signals are sent to stage lighting via Art-Net DMX.  For example, the music beat controls DMX channel 1 and audio RMS (overall level) controls channel 2. Lighting consoles can also send return signals to flip scenes.
* **Performance Watchdog:**  A built-in monitor tracks rendering frame rate.  If performance drops below \~50 FPS for 2 seconds, the system automatically halves the FFT resolution and silences heavy shaders. This adaptive mechanism keeps visuals smooth under load.
* **Safety & Logging:**  The app includes photosensitive-flash protection (to avoid harmful high-frequency flashes).  It also logs rehearsal data in IndexedDB (exportable to CSV) and can overlay a real-time frame-time heatmap for performance debugging.

## Technology Stack

* **Frontend:** Next.js (React, TypeScript) for the web interface, with Tailwind CSS and custom fonts (Poppins, Data70, Torus) for styling.  UI components use Radix UI and Geist for consistency, and icons from Lucide React.  Recharts is used for visualizing data like audio waveforms or logs.
* **Graphics/Audio:**  Uses the Web Audio API (FFT, energy analysis) for audio-reactive inputs, and Three.js/WebGL for 3D effects in some scenes.  (p5.js was part of the initial design for audio capture.)  Webcam input is handled via HTML5 media APIs, with optional ML segmentation.
* **AI/ML:** Google’s Gemini language model is accessed through the GenKit library (@genkit-ai/googleai) for tasks like scene suggestion and asset generation (e.g. style transfer, color palettes).
* **Backend / Database:** Firebase is used for authentication and data storage.  The project is structured for Firebase Hosting / Functions (the default starter reads as a “NextJS starter in Firebase Studio”).  Development uses the Firebase emulators for Auth and Firestore (as shown in the Nix config with `services = ["auth", "firestore"]`).
* **Development:** The codebase uses a Nix development environment (Node.js 20 and related packages).  Development scripts (via `npm run dev`) start the Next.js server.  GitHub Actions or the Firebase CLI can be used for deployment.

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

   * Copy `.env.example` or create a `.env.local` file with your Firebase config variables (API keys, project ID, etc.) and any AI API keys (e.g. Google Cloud keys for Gemini/GenKit) as needed.
   * (If using Nix: run `nix develop` to enter the environment with Node.js v20.)
4. **Start development server:**

   ```bash
   npm run dev
   ```

   This runs the app (by default on `localhost:9002`).  Ensure any required services (like Firestore emulator or a Firebase project) are running.

## Usage

* **Access the app:** Open your browser to [http://localhost:9002](http://localhost:9002) (or the configured host/port).  You should see the SIXR Vision interface with a visualizer canvas and side control panel.
* **Audio input:** Play music on your device or enable microphone input. The visuals will react to the audio. Adjust sliders (gain, AGC, etc.) to tune the responsiveness.
* **Webcam:** Click the camera toggle to enable your webcam. Allow browser permission. Use **Mirror** toggle to flip the feed. Motion in front of the camera will influence certain scenes.
* **Presets:** Click on scene thumbnails or press number keys **1–9** to load built-in scenes. Scenes cross-fade automatically on beat (if sync is enabled). Press **P** to blackout (panic mode), and **L** to toggle the SIXR logo blackout.
* **AI tools:** Use the Palette Genie and other creative tools in the panel to generate colors or art assets (these may require AI API keys). For example, try the SBNF-themed prompt to generate cosmic vine imagery.
* **Remote control:** The app listens for WebSocket/OSC commands. You can send commands like `{"route":"/preset","value":"radial_burst"}` to change scenes remotely. (An Art-Net lighting console can send/receive as well.)
* **Performance monitoring:** If you experience frame drops, note the on-screen FPS display or heatmap. The watchdog will self-adjust settings to try to recover smoothness. Use the IndexedDB logs (downloadable CSV) to review performance over time.

## Contributing & Community

We welcome contributions to SIXR Vision! To contribute, first **open an issue** to discuss major changes or features. For code contributions, **fork the repository** and submit a pull request with your changes. Please write clear commit messages and include any relevant tests or documentation. We also appreciate help with testing on different platforms (browsers, devices).

We strongly encourage an **inclusive, respectful community**. SIXR Vision is meant to support diverse creators: contributions from BIPOC, women, LGBTQ+ creators, and all underrepresented groups are especially valued. Our conduct guidelines require everyone to be professional and courteous—abusive or discriminatory language will not be tolerated. Please ensure your suggestions and code uphold accessibility and diversity: for example, consider colorblind-friendly palettes, legible text, and respectful representations.  Before submitting large changes, feel free to open an issue or discussion thread to get feedback.

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
