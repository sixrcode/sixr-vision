# SIXR Vision

A **real-time, audio-reactive XR storytelling platform** that fuses live music, webcam input and generative AI to create immersive visuals for concerts, festivals and workshops—born in the SIXR Lab to empower inclusive XR experiences for BIPOC, women and LGBTQ+ creators. The 2025 edition is themed **“Cosmic Grapevines”** for the Seattle BIPOC Nerd Festival (SBNF).

---

## Table of Contents

* [Project Overview](#project-overview)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Getting Started](#getting-started)

  * [Prerequisites](#prerequisites)
  * [Installation](#installation)
  * [Running the App](#running-the-app)
  * [Genkit Dev Server](#genkit-dev-server)
* [Project Structure](#project-structure)
* [Code Architecture](#code-architecture)

  * [Modular Structure](#modular-structure)
  * [Theming & Styling](#theming--styling)
  * [Type-Safe AI Flows](#type-safe-ai-flows)
  * [Refactor Targets](#refactor-targets)
* [Visualizer Engine](#visualizer-engine)

  * [WebGL Pipeline](#webgl-pipeline)
  * [Scene Management](#scene-management)
  * [Audio Responsiveness](#audio-responsiveness)
  * [Webcam Integration](#webcam-integration)
  * [AI Visual Overlay Mixer](#ai-visual-overlay-mixer)
* [Configuration](#configuration)
* [Performance Considerations](#performance-considerations)
* [Risk & Mitigation](#risk--mitigation)
* [Roadmap & Gaps](#roadmap--gaps)
* [Contributing](#contributing)
* [License](#license)

---

## Project Overview

SIXR Vision turns **sound + camera + AI** into stage-ready visuals.
It analyses live audio (FFT, beat, RMS), pipes those signals into WebGL shaders/meshes, layers optional webcam textures, and consults Google Gemini (via **Genkit**) to suggest scenes, generate color palettes, or create overlay art that blends into the show.
An adaptive performance watchdog keeps FPS high; remote-control APIs (WebSocket/OSC, Art-Net) let lighting consoles or tablets run the visuals; and a branding layer keeps SBNF identity front-and-center.

---

## Features

| Category                                   | Highlights                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audio-Reactive Visuals**                 | FFT-driven geometry, particle fields, shaders, spectrum bars, radial bursts, mirror silhouette and more.                                                                                       |
| **WebGL-Only Engine**                      | All scenes run in Three.js; legacy 2-D canvas paths were removed for simplicity & performance.                                                                                                 |
| **AI Toolkit (Genkit + Gemini 1.5 Flash)** | • Scene recommendations<br>• Harmonious palette generator<br>• Text-to-image overlay creator<br>• (Planned) style-transfer shader                                                              |
| **AI Visual Overlay Mixer**                | Place AI-generated art over *any* scene. Controls: opacity slider + blend-mode selector (`source-over`, `add`, `multiply`, `screen`; others fall back to normal until custom GLSL is written). |
| **Webcam Integration**                     | Use cam as texture / silhouette feed; mirror toggle; (road-mapped) pose & background segmentation.                                                                                             |
| **Interactive Control Panel**              | ShadCN / Radix UI sliders, switches, dropdowns; keyboard shortcuts (1-5 presets, **P** panic blackout, **L** logo toggle).                                                                     |
| **Remote / Lighting I/O**                  | WebSocket & OSC mirrors UI; optional Art-Net channels for beat & RMS to DMX fixtures.                                                                                                          |
| **Performance Monitor**                    | FPS counter, heat-map overlay, auto-dial-down of shader complexity if frame-rate tanks.                                                                                                        |
| **Accessibility & Branding**               | WCAG-checked palette, “Skip to content”, keyboard nav; dynamic SBNF logo overlay.                                                                                                              |

---

## Tech Stack

* **Frontend** Next.js (App Router) • React 18 • TypeScript
* **Styling** TailwindCSS • shadcn/ui • Lucide React icons
* **Graphics** Three.js + raw GLSL • Webcam via MediaDevices
* **Audio** Web Audio API (FFT 128/256/512, RMS, beat detect)
* **AI Framework** Genkit (via @genkit-ai/googleai) • Gemini 1.5 Flash
* **State Mgmt** React Context API (`SettingsProvider`, `SceneProvider`, `AudioDataProvider`) + TanStack Query
* **Tooling** ESLint • Prettier • Vitest (road-mapped) • Nix dev-shell
* **Deploy** Vercel (recommended) or Firebase Hosting/Functions

---

## Getting Started

### Prerequisites

* Git • Node ≥ 20 • npm or yarn
* Google AI / Gemini API key

### Installation

```bash
git clone https://github.com/sixrcode/sixr-vision.git
cd sixr-vision
npm install            # or: yarn
cp .env.example .env.local  # then edit values
```

### Running the App

```bash
npm run dev           # Next.js on http://localhost:9002
```

### Genkit Dev Server

```bash
npm run genkit:dev    # typically http://localhost:4000
```

---

## Project Structure

```
src/
  app/             # Next.js pages & layouts
  components/
    control-panel/
    visualizer/
    ui/            # generic shadcn components
  ai/
    genkit.ts
    flows/         # prompt & schema-typed Genkit flows
  providers/       # React context
  hooks/
  lib/             # brandingConstants.ts, helpers
public/             # static assets
docs/               # blueprint, design notes
```

---

## Code Architecture

### Modular Structure

* **Layout entry** (`src/app/layout.tsx`) injects global fonts/styles & wraps providers.
* **SceneProvider** registers new scenes with `initWebGL / drawWebGL / cleanupWebGL` hooks.
* **SettingsProvider** holds UI state (AI overlay URI, blend mode, branding toggles).

### Theming & Styling

Central color & font vars live in `brandingConstants.ts` (SBNF orange / purple palette). Tailwind’s content paths keep CSS bundles lean; Google Fonts loaded via `next/font`.

### Type-Safe AI Flows

Each Genkit flow declares `z.object({...})` schemas for inputs/outputs → compile-time safety. Prompt templates embed context (scene name, audio features) plus `defaultSafetySettings`.

### Refactor Targets

* **DRY safety settings** – move duplicated `defaultSafetySettings` arrays to `src/ai/sharedConstants.ts`.
* **Prompt constants** – extract multiline prompt strings to `prompts.ts` (easier i18n).

---

## Visualizer Engine

### WebGL Pipeline

Three.js renderer → render-target chain → post-FX. Legacy canvas paths removed.

### Scene Management

`SceneProvider` stores definitions & active ID; smooth cross-fades handled in `VisualizerView`.

### Audio Responsiveness

`AudioDataProvider` exposes beat, RMS, spectrum arrays. Scenes map those to shader uniforms / mesh transforms.

### Webcam Integration

`WebcamFeed` grabs MediaStream; video texture passed to scenes (mirror toggle).

### AI Visual Overlay Mixer

* Renders AI-generated image texture on a full-screen quad above the main scene.
* UI sliders: **Opacity** (0-1) & **Blend Mode**. Supported modes: `normal`, `add`, `multiply`, `screen`. Others fall back to normal unless a custom GLSL blend shader is supplied.

---

## Configuration

Create `.env.local`:

```env
GOOGLE_API_KEY="your-gemini-key"
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
```

All adjustable runtime options (scene, gain, blend-mode, branding) live in React context and persist in `localStorage`.

---

## Performance Considerations

| Risk                        | Mitigation                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Unbounded AI-cache maps** | Add LRU/TTL eviction (high-priority).                                                      |
| **Shader or mesh leaks**    | Call `texture.dispose()` / `geometry.dispose()` in every `cleanupWebGL`.                   |
| **Frame-rate dips**         | Implement “Adaptive Performance Watchdog” → lower particle count / FFT size automatically. |
| **AI latency spikes**       | Display progress spinner; fallback to last-good overlay if timeout.                        |

---

## Risk & Mitigation

* **Security** Store API keys in env; add strict CSP; run CodeQL.
* **AI Bias** User feedback button → regenerate; periodic prompt review.
* **Accessibility** WCAG contrast audit; full keyboard nav; ARIA labels.
* **Photosensitive Safety** Add max-flash guard (< 3 Hz, brightness clamp).

---

## Roadmap & Gaps

1. **High-priority**  implement cache-key fix, FPS watchdog, eviction.
2. **Mid-term**  Art-Net DMX out → stage lights, style-transfer shader, ML pose.
3. **Foundational**  CI/CD, Vitest + Playwright, full docs wiki, i18n.

Open issues track each item; see [`docs/blueprint.md`](docs/blueprint.md) for the long-form vision.

---

## Contributing

We ❤️ community help—especially from under-represented creators.

1. Fork ➜ `git checkout -b feat/my-idea`
2. `npm run lint && npm run typecheck` (fix warnings)
3. Add/adjust tests (Vitest coming soon).
4. Commit with conventional message (`feat: add nebula scene`).
5. Open PR; fill template; be kind & inclusive.

All contributors must follow our **Code of Conduct** (Contributor Covenant).

---

## License

*Pending — will adopt MIT or Apache-2.0 once legal review is complete.*
