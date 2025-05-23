# SIXR Vision

A **real-time, audio-reactive XR storytelling platform** that fuses live music, webcam input and generative-AI to create immersive visuals for concerts, festivals and workshops—born in the SIXR Lab to empower inclusive XR experiences for BIPOC, women and LGBTQ+ creators.  
The 2025 edition is themed **“Cosmic Grapevines”** for the Seattle BIPOC Nerd Festival (SBNF).

---

## Table of Contents
* [Project Overview](#project-overview)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Getting Started](#getting-started)  
  * [Prerequisites](#prerequisites) - [Installation](#installation) - [Running](#running-the-app) - [Genkit Dev](#genkit-dev-server)
* [Project Structure](#project-structure)
* [Code Architecture](#code-architecture)  
  * [Modular Structure](#modular-structure) - [Theming & Styling](#theming--styling) - [Type-Safe AI Flows](#type-safe-ai-flows) - [Refactor Targets](#refactor-targets)
* [Visualizer Engine](#visualizer-engine)  
  * [WebGL Pipeline](#webgl-pipeline) - [Scene Management](#scene-management) - [Audio Responsiveness](#audio-responsiveness) - [Webcam Integration](#webcam-integration) - [AI Visual Overlay Mixer](#ai-visual-overlay-mixer)
* [Configuration](#configuration)
* [Performance Considerations](#performance-considerations)
* [Risk & Mitigation](#risk--mitigation)
* [Roadmap & Gaps](#roadmap--gaps)
* [Contributing](#contributing)
* [License](#license)

---

## Project Overview
SIXR Vision turns **sound + camera + AI** into stage-ready visuals.  
It analyses live audio (FFT, beat, RMS), pipes those signals into WebGL shaders/meshes, layers optional webcam textures, and consults Google Gemini (via **Genkit**) to suggest scenes, generate colour palettes, or create overlay art that blends into the show.  
An adaptive performance watchdog keeps FPS high; remote-control APIs (WebSocket/OSC, Art-Net) let lighting consoles or tablets run the visuals; and a branding layer keeps SBNF identity front-and-centre.

---

## Features

| Category | Highlights |
|----------|------------|
| **Audio-Reactive Visuals** | FFT-driven geometry, particle fields, spectrum bars, radial bursts, mirror silhouette and more. |
| **WebGL-Only Engine** | All scenes run in Three.js; legacy 2-D canvas paths were removed for simplicity & performance. |
| **AI Toolkit (Genkit + Gemini 1.5 Flash)** | Scene recommendations • Harmonious-palette generator • Text-to-image overlay creator • (Planned) style-transfer shader |
| **AI Visual Overlay Mixer** | AI-art over *any* scene; controls: opacity slider + blend-mode selector (`normal`, `add`, `multiply`, `screen`). |
| **Webcam Integration** | Cam as texture / silhouette feed; mirror toggle; motion & segmentation hooks for scenes (see below). |
| **Interactive Control Panel** | shadcn / Radix UI sliders & switches; keyboard shortcuts (1-5 presets, `P` panic, `L` logo). |
| **Remote / Lighting I/O** | WebSocket & OSC mirror UI; optional Art-Net channels for beat & RMS to DMX fixtures. |
| **Performance Monitor** | FPS counter, heat-map overlay, auto dial-down of shader complexity if frame-rate tanks. |
| **Accessibility & Branding** | WCAG-checked palette, “Skip to content”, keyboard nav; dynamic SBNF logo overlay. |

---

## Tech Stack
* **Frontend** Next.js (App Router) • React 18 • TypeScript  
* **Styling** Tailwind CSS • shadcn/ui • Lucide-React icons  
* **Graphics** Three.js + raw GLSL • Webcam via MediaDevices  
* **Audio** Web Audio API (FFT 128/256/512, RMS, beat-detect)  
* **AI Framework** Genkit (@genkit-ai/googleai) • Gemini 1.5 Flash  
* **State Mgmt** React Context (`SettingsProvider`, `SceneProvider`, `AudioDataProvider`) + TanStack Query  
* **Tooling** ESLint • Prettier • Vitest *(road-mapped)* • Nix dev-shell  
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
npm install                  # or: yarn
cp .env.example .env.local   # then edit values
