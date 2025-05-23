
import type * as THREE from 'three';

export type LogoAnimationType = 'none' | 'solid' | 'blink' | 'pulse' | 'rainbowCycle';

export type LogoAnimationSettings = {
  type: LogoAnimationType;
  speed: number;
  color: string;
};

// Defines the assets specific to a WebGL scene, managed by VisualizerView
// and passed to the scene's drawWebGL function.
// The scene's initWebGL function is responsible for creating and returning these.
export type WebGLSceneAssets = {
  scene: THREE.Scene; // The specific Three.js scene for this preset
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // The camera for this preset
  // Note: The WebGLRenderer is managed globally by VisualizerView and passed to drawWebGL,
  // so individual scenes should not create or return their own renderer.

  // Scene-specific assets can be added here with a more specific type
  // if needed, or accessed via [key: string]: any;
  particles?: THREE.Points;
  particleMaterial?: THREE.PointsMaterial; // Or other material types
  particleGeometry?: THREE.BufferGeometry;
  positions?: Float32Array;
  colors?: Float32Array;
  velocities?: Float32Array;
  lifetimes?: Float32Array;
  PARTICLE_COUNT?: number;
  lastBeatTime?: number;
  lastAmbientSpawnTime?: number;
  lastFrameTimeWebGL?: number;
  tempColor?: THREE.Color;
  bgColor?: THREE.Color;
  rotationSpeed?: THREE.Vector3;

  // For webcam-based scenes like Mirror Silhouette
  videoTexture?: THREE.VideoTexture;
  planeMesh?: THREE.Mesh;
  shaderMaterial?: THREE.ShaderMaterial;

  // For Echoing Shapes
  geometries?: THREE.BufferGeometry[]; // Circle, Square, Triangle
  activeShapes?: Array<{
    mesh: THREE.Mesh;
    lifetime: number;
    initialScale: number;
    maxScale: number;
    currentOpacity: number;
    targetOpacity: number;
    rotationSpeed: number;
    spawnTime: number;
  }>;
  spawnCooldown?: number;
  lastSpawnTime?: number;

  // For Frequency Rings
  ringGeometry?: THREE.RingGeometry;
  activeBassRings?: Array<any>; // Consider defining a specific RingDataType
  activeMidRings?: Array<any>;
  activeTrebleRings?: Array<any>;

  // For Neon Pulse Grid and Spectrum Bars (using InstancedMesh)
  instancedMesh?: THREE.InstancedMesh;
  cellStates?: Array<{ // For Neon Pulse Grid
    targetHue: number;
    targetLightness: number;
    currentLightness: number;
    lastPulseTime: number;
  }>;
  GRID_SIZE_X?: number;
  GRID_SIZE_Y?: number;
  totalCells?: number;
  cellBaseWidth?: number; // Renamed from cellWidth for clarity
  cellBaseHeight?: number; // Renamed from cellHeight for clarity
  dummy?: THREE.Object3D; // For InstancedMesh matrix updates

  // For Spectrum Bars
  numBars?: number;
  // barBaseWidth is already defined above for Neon Pulse Grid, can be reused if same logic
  // barActualWidth is usually calculated dynamically

  // For Mirror Silhouette - Procedural Vines
  noiseTexture?: THREE.DataTexture;
  vinesData?: {
    activeVines: ProceduralVine[];
    nextVineId: number;
    lastSpawnTime: number;
    spawnCooldown: number;
    maxVines: number;
  };
  // For Mirror Silhouette - Grape Clusters
  grapeGeometry?: THREE.BufferGeometry;
  grapeMaterial?: THREE.PointsMaterial;
  grapes?: THREE.Points;
  grapePositions?: Float32Array;
  grapeColors?: Float32Array;
  grapeTargetSizes?: Float32Array;
  grapeCurrentSizes?: Float32Array;
  grapeLifetimes?: Float32Array;
  grapeSpawnTimes?: Float32Array;
  GRAPE_COUNT?: number;
  lastGrapeSpawnTime?: number;

  // Scene-specific flags for optimization or state
  lastCanvasWidth?: number;
  lastCanvasHeight?: number;
  sceneId?: string; // To ensure assets are for the correct scene during cleanup

  // Allow any other scene-specific assets
  [key: string]: any;
};


export type SceneDefinition = {
  id: string;
  name: string;
  meta?: Record<string, any>;
  rendererType?: '2d' | 'webgl'; // Default to '2d' if not specified
  // For 2D Canvas scenes
  draw?: (
    canvasContext: CanvasRenderingContext2D,
    audioData: AudioData,
    settings: Settings,
    webcamFeed?: HTMLVideoElement | null
  ) => void;
  // For WebGL scenes
  initWebGL?: (
    canvas: HTMLCanvasElement,
    settings: Settings,
    webcamElement?: HTMLVideoElement | null // Optional webcam element
  ) => Omit<WebGLSceneAssets, 'renderer'>; // Scenes should not return the renderer
  drawWebGL?: (params: {
    renderer: THREE.WebGLRenderer; // Passed in by VisualizerView
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    audioData: AudioData;
    settings: Settings;
    webGLAssets: WebGLSceneAssets; // Specific assets for this scene
    canvasWidth: number;
    canvasHeight: number;
    webcamElement?: HTMLVideoElement | null;
  }) => void;
  cleanupWebGL?: (webGLAssets: Omit<WebGLSceneAssets, 'renderer'>) => void; // To dispose of Three.js objects
  thumbnailUrl?: string;
  dataAiHint?: string;
};

export type AudioData = {
  spectrum: Uint8Array;
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  rms: number;
  bpm: number;
  beat: boolean;
};

export type Settings = {
  fftSize: 128 | 256 | 512;
  gain: number;
  enableAgc: boolean;
  gamma: number;
  dither: number;
  brightCap: number;
  logoOpacity: number;
  showWebcam: boolean;
  mirrorWebcam: boolean;
  currentSceneId: string;
  panicMode: boolean;
  logoBlackout: boolean;
  logoAnimationSettings: LogoAnimationSettings;
  lastAISuggestedAssetPrompt?: string;
  sceneTransitionDuration: number;
  sceneTransitionActive: boolean;
  monitorAudio: boolean;
  selectedAudioInputDeviceId?: string;
  enableAiOverlay: boolean;
  aiGeneratedOverlayUri: string | null;
  aiOverlayOpacity: number;
  aiOverlayBlendMode: GlobalCompositeOperation;
  aiOverlayPrompt: string;
  enablePeriodicAiOverlay: boolean;
  aiOverlayRegenerationInterval: number; // In seconds
};

export type PaletteGenieColor = {
  hue: number;
  saturation: number;
  brightness: number;
};

export type ProceduralAsset = {
  textureDataUri?: string;
  meshDataUri?: string;
};

export type Cue = {
  time: number;
  action: 'change_scene' | 'set_setting';
  payload: {
    sceneId?: string;
    settingKey?: keyof Settings;
    settingValue?: any;
  };
};

export type RehearsalLogEntry = {
  id?: number; // Optional: auto-generated by IndexedDB
  timestamp: number;
  event: string; // e.g., 'scene_change', 'setting_update', 'ai_overlay_generated'
  details: Record<string, any>; // e.g., { sceneId: '...', reason: '...' }
};


// Valid values for CanvasRenderingContext2D.globalCompositeOperation
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
export const VALID_BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over', 'source-in', 'source-out', 'source-atop',
  'destination-over', 'destination-in', 'destination-out', 'destination-atop',
  'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken',
  'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

// For Mirror Silhouette vines
export type VinePoint = { x: number; y: number };
export type ProceduralVine = {
  id: number;
  points: VinePoint[];
  color: string;
  opacity: number;
  currentLength: number;
  maxLength: number;
  spawnTime: number;
  lifetime: number;
  thickness: number;
  curlFactor: number;
  angle: number;
  startX: number;
  startY: number;
  speed: number;
};
