# Dynamic Audio-Reactive Visualizer with AI Scene Generation

## Introduction
Welcome to the Dynamic Audio-Reactive Visualizer! This web-based application generates captivating, real-time visualizations that respond to audio input. It leverages Artificial Intelligence through Google's Genkit framework to dynamically create and suggest scene elements, color palettes, and atmospheric effects, offering a unique and interactive visual experience.

Built with a modern tech stack including Next.js, TypeScript, and Three.js for WebGL rendering, this project aims to explore the synergy between audio, visuals, and AI.

## Features
*   **Real-time Audio Visualization:** Visuals dynamically react to music and sound.
*   **Dual Rendering Modes:** Choose between 2D Canvas for simpler graphics and WebGL (via Three.js) for immersive 3D scenes.
*   **AI-Powered Scene Intelligence:** Utilizes Genkit with Google AI models (Gemini 1.5 Flash) for:
    *   Generating visual assets from text prompts.
    *   Creating harmonious color palettes.
    *   Suggesting scene ambiances and elements.
    *   Proposing scenes based on audio analysis.
*   **Webcam Integration:** Incorporate your live webcam feed into the visualizations.
*   **AI Image Overlays:** Display AI-generated images as dynamic overlays on scenes with adjustable blend modes and opacity.
*   **Interactive Control Panel:** Easily adjust settings, select scenes, and interact with AI tools.
*   **Performance Monitoring:** Includes FPS counter and options for performance adjustments.
*   **Customizable Branding:** Option to add a branding overlay.

## Tech Stack
*   **Frontend:** Next.js (v14+ App Router), React, TypeScript
*   **Styling:** Tailwind CSS
*   **AI Framework:** Genkit (by Google)
*   **AI Model:** Google Gemini 1.5 Flash (via `@genkit-ai/googleai`)
*   **3D Graphics:** Three.js
*   **State Management:** React Context API (e.g., `SettingsProvider`, `AudioDataProvider`, `SceneProvider`)
*   **Data Fetching/Caching:** TanStack Query (formerly React Query)
*   **Linting/Formatting:** ESLint, Prettier (configured in `package.json`)
*   **Deployment:** Vercel (recommended for Next.js) or Firebase

## Getting Started

### Prerequisites
*   [Git](https://git-scm.com/)
*   [Node.js](https://nodejs.org/) (v20 or higher recommended, as per `package.json`'s `@types/node": "^20"`)
*   `npm` (comes with Node.js) or `yarn`
*   A Google AI API Key for Genkit integration. Ensure you have access to Google AI services.

### Installation
1.  **Clone the repository:**
    **Important:** Replace `<repository-url>` in the command below with the actual URL of this repository.
    ```bash
    git clone <repository-url>
    cd your-repository-name # Replace 'your-repository-name' with the actual folder name created by git clone
    ```
2.  **Install dependencies:**
    Using npm:
    ```bash
    npm install
    ```
    Or using yarn:
    ```bash
    yarn install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project by copying the example file (if one is provided, otherwise create it manually).
    Add your Google AI API Key:
    ```env
    # .env.local
    GOOGLE_API_KEY="YOUR_GOOGLE_AI_API_KEY"

    # Optional: Specify a different port for the Next.js app (defaults to 9002 as per package.json script)
    # PORT=9002
    ```
    Refer to the Configuration section for more details on environment variables.

### Running the Application
To start the Next.js development server:
```bash
npm run dev
```
The application will typically be available at `http://localhost:9002` (or the `PORT` you specified).

### Genkit Development Server
Genkit is a framework that helps you build, deploy, and manage AI applications. It runs its own development UI for testing and managing AI flows.
To start the Genkit development server:
```bash
npm run genkit:dev
```
This server runs separately (usually on `http://localhost:4000`) and is used for interacting with and testing your AI flows locally.

## Project Structure
*   `src/app/`: Main application pages (Next.js App Router).
*   `src/components/`: Reusable React components.
    *   `control-panel/`: UI for controlling visualizations and AI tools.
    *   `visualizer/`: Components for rendering visualizations (2D/WebGL).
    *   `ui/`: Generic UI elements (buttons, sliders, etc. - likely from a library like shadcn/ui given the file names).
*   `src/ai/`: AI-related logic, including Genkit flows.
    *   `genkit.ts`: Genkit initialization.
    *   `flows/`: Specific AI tasks (e.g., `generate-assets-from-prompt.ts`).
*   `src/lib/`: Utility functions and constants.
*   `src/providers/`: React Context providers for global state management.
*   `src/hooks/`: Custom React hooks.
*   `public/`: Static assets.
*   `docs/`: Project documentation (e.g., `blueprint.md`).
*   `pages/api/`: While Next.js traditionally uses this for API routes, Genkit operates its own server, so primary AI backend logic will be managed through Genkit flows rather than Next.js API routes in this directory.

## AI Integration
Genkit is an open-source framework by Google designed to help developers build production-ready AI-powered features and applications with Node.js/TypeScript.

### Genkit Setup
*   Initialized in `src/ai/genkit.ts`.
*   Uses the `@genkit-ai/googleai` plugin to connect to Google AI services.
*   Configured to use the `gemini-1.5-flash` model for efficient and powerful AI capabilities.

### AI Flows
*   Defined within the `src/ai/flows/` directory.
*   These flows define specific AI-driven actions within the application, such as:
*   `generate-assets-from-prompt.ts`: Generates visual assets (e.g., textures, sprites) based on user text prompts.
*   `generate-harmonious-palettes.ts`: Creates aesthetically pleasing color palettes.
*   `generate-scene-ambiance.ts`: Suggests or generates atmospheric elements (e.g., lighting, fog, mood) for scenes.
*   `suggest-scene-from-audio.ts`: Analyzes features of the audio input (e.g., tempo, genre, mood) to recommend suitable visual scenes.

## Visualizer
The core of the application, responsible for rendering the graphics.

### Rendering Modes (2D Canvas & WebGL)
*   The `VisualizerView.tsx` component dynamically switches between 2D Canvas and WebGL rendering.
*   Individual scenes specify their preferred renderer type (`rendererType: '2d' | 'webgl'`).
*   **Three.js** is employed for WebGL rendering, allowing for sophisticated 3D graphics and effects.

### Scene Management
*   The `SceneProvider` (React Context) manages the collection of available visual scenes and the currently active scene.
*   Scenes are modular, with dedicated functions for initialization (`init`, `initWebGL`), drawing (`draw`, `drawWebGL`), and cleanup (`cleanupWebGL` for WebGL contexts).
*   Smooth transitions between different scenes are supported.

### Audio Responsiveness
*   The `AudioDataProvider` (React Context) processes microphone or audio file input in real-time.
*   It provides crucial audio data like Root Mean Square (RMS) for volume, beat detection, and frequency spectrum analysis (e.g., bass, mid, treble).
*   Visualizations use this data to react dynamically, creating a tightly synchronized audio-visual experience.

### Webcam Integration
*   The `WebcamFeed.tsx` component facilitates access to the user's webcam.
*   The live webcam feed can be incorporated as a texture, background, or interactive element within visual scenes.

### AI Overlays
*   Supports displaying AI-generated images as overlays on top of the current visualizer scene (via `settings.aiGeneratedOverlayUri`).
*   Users can adjust blend modes and opacity for these overlays through the control panel.

## Configuration

### Environment Variables
*   Environment variables are managed using a `.env.local` file in the project root (for Next.js).
*   **Primary required variable:**
    ```env
    # .env.local
    GOOGLE_API_KEY="YOUR_GOOGLE_AI_API_KEY" # Your Google AI API Key for Genkit
    ```
*   It's good practice to create a `.env.example` file to list all required environment variables. (This task does not involve creating it, but it's a recommendation for the project).
*   Other optional variables (e.g., `PORT`) can also be defined here.

### Application Settings
*   Global application settings are managed via the `SettingsProvider` (React Context) and are configurable through the UI control panel.
*   These settings encompass parameters for:
    *   **Visuals:** Active scene, rendering mode (2D/WebGL), specific scene properties.
    *   **Audio Input:** Microphone sensitivity, beat detection thresholds, FFT smoothing.
    *   **AI Interactions:** Prompts for asset generation, selected AI overlays.
    *   **UI/Branding:** Theme options, visibility of branding elements.

## (Placeholder) Screenshots / Live Demo
*(This section can be updated with screenshots of the application in action or a link to a live demo once available.)*

## Contributing
We welcome contributions to enhance the Dynamic Audio-Reactive Visualizer! Please adhere to the following guidelines:
1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix (e.g., `git checkout -b feature/new-cool-scene` or `bugfix/fix-rendering-issue`).
3.  **Develop your changes.** Ensure your code aligns with the project's coding style and conventions.
4.  **Test your changes thoroughly.** (Details on running tests would go here if test scripts were defined in `package.json`).
5.  **Ensure code quality:**
    Run the linter and type checker to catch issues:
    ```bash
    npm run lint
    npm run typecheck
    ```
    Address any reported problems.
6.  **Commit your changes** with clear, descriptive commit messages.
7.  **Push your branch** to your fork.
8.  **Submit a pull request** to the main repository, providing a detailed description of your changes and why they are being made.

## License
This project is currently not licensed.

It is highly recommended to add an open-source license (e.g., MIT, Apache 2.0) to clarify how others can use, modify, and distribute this software.

## Future Enhancements / To-Do
*   Add a comprehensive suite of unit and integration tests.
*   Implement user authentication for saving preferences or AI-generated assets.
*   Expand the library of available scenes and visual effects.
*   Optimize performance for lower-end devices.
*   Formalize a deployment pipeline.
*   Add an `LICENSE` file.
