
import type * as THREE from 'three';

// Moved from src/types/index.ts

export type LogoAnimationType = 'none' | 'solid' | 'blink' | 'pulse' | 'rainbowCycle';

export type LogoAnimationSettings = {
  type: LogoAnimationType;
  speed: number;
  color: string;
};

// Define a specific type for the scene-specific assets to avoid 'any'
// This allows us to define common properties while also allowing for
// specific scene asset types to be added via intersection types if needed later,
// or by keeping this as a base with specific properties added as optional.
export type SceneSpecificAssets = Record<string, any>;

// Defines the assets specific to a WebGL scene, managed by VisualizerView
// and passed to the scene's drawWebGL function.
// The scene's initWebGL function is responsible for creating and returning these.
export type WebGLSceneAssets = {
  scene: THREE.Scene; // The specific Three.js scene for this preset
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // The camera for this preset
  // Note: The WebGLRenderer is managed globally by VisualizerView and passed to drawWebGL,
  // so individual scenes should not create or return their own renderer.

  // Scene-specific assets can be added here
  particles?: THREE.Points;
  particleMaterial?: THREE.PointsMaterial;
  particleGeometry?: THREE.BufferGeometry;
  positions?: Float32Array;
  colors?: Float32Array;
  velocities?: Float32Array;
  lifetimes?: Float32Array;
  initialLifetimes?: Float32Array; // For particle_finale to store initial lifetime
  PARTICLE_COUNT?: number;
  lastBeatTime?: number;
  lastAmbientSpawnTime?: number;
  lastFrameTimeWebGL?: number;
  tempColor?: THREE.Color;
  bgColor?: THREE.Color;
  rotationSpeed?: THREE.Vector3;

  // For webcam-based scenes like Mirror Silhouette
  videoTexture?: THREE.VideoTexture;
  planeMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  shaderMaterial?: THREE.ShaderMaterial;
  noiseTexture?: THREE.DataTexture; // For Fresnel/noise fill in Mirror Silhouette
  vinesData?: { // For Mirror Silhouette procedural vines
    activeVines: ProceduralVine[];
    nextVineId: number;
    lastSpawnTime: number;
    spawnCooldown: number;
    maxVines: number;
  };
  grapesData?: { // For Mirror Silhouette grape clusters
    activeGrapes: Array<{
      mesh: THREE.Points; // Changed from THREE.Mesh to THREE.Points for grapes
      spawnTime: number;
      lifetime: number;
      initialScale: number; // For individual grape scaling logic
      targetScale: number;
      initialColorHue: number;
      targetColorHue: number;
    }>;
    grapeGeometry?: THREE.BufferGeometry; // Shared geometry for grape particles
    grapeBaseMaterial?: THREE.PointsMaterial; // Shared base material for grapes
    nextGrapeId: number;
    lastGrapeSpawnTime: number;
    spawnCooldown: number;
    maxGrapes: number;
    GRAPE_PARTICLE_COUNT_PER_CLUSTER?: number; // If each "grape" is a cluster
  };


  // For Echoing Shapes (WebGL)
  circleGeometry?: THREE.CircleGeometry;
  squareGeometry?: THREE.PlaneGeometry;
  triangleGeometry?: THREE.ShapeGeometry;
  instancedMaterial?: THREE.MeshBasicMaterial; // Shared material if colors are per-instance
  circleInstancedMesh?: THREE.InstancedMesh;
  squareInstancedMesh?: THREE.InstancedMesh;
  triangleInstancedMesh?: THREE.InstancedMesh;
  activeInstances?: Array<{ // To track individual shape states for instancing
    matrix: THREE.Matrix4;
    color: THREE.Color;
    type: 'circle' | 'square' | 'triangle'; // Or number index
    lifetime: number;
    currentScale: number;
    maxScale: number;
    currentOpacity: number;
    targetOpacity: number;
    rotationSpeed: number;
    rotation: number;
    spawnTime: number;
    initialLifetime: number;
    id: number; // Unique ID for managing instances
  }>;
  nextInstanceId?: number;
  maxShapeInstances?: number; // Max instances per shape type for InstancedMesh


  // For Frequency Rings (WebGL) - using a specific type for activeRings elements
  // ringGeometry is now defined within initWebGL and reused
  activeRings?: Array<{ // Consolidated active rings
    mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    spawnTime: number;
    lifetime: number;
    initialOpacity: number;
    maxScale: number;
    band: 'bass' | 'mid' | 'treble';
  }>;
  // lastSpawnTimes and spawnCooldown can be part of webGLAssets if managed per scene
  // maxRingsPerBand could also be stored here

  // For Neon Pulse Grid and Spectrum Bars (using InstancedMesh)
  instancedMesh?: THREE.InstancedMesh; // Could be one for grid, one for bars if structure differs
  cellStates?: Array<{ // For Neon Pulse Grid
    targetHue: number;
    targetLightness: number;
    currentLightness: number;
    lastPulseTime: number;
  }>;
  GRID_SIZE_X?: number;
  GRID_SIZE_Y?: number;
  totalCells?: number;
  cellBaseWidth?: number;
  cellBaseHeight?: number;
  dummy?: THREE.Object3D; // For InstancedMesh matrix updates

  // For Spectrum Bars
  numBars?: number;
  // barBaseWidth renamed to cellBaseWidth above, can be reused or specific one added

  // For Geometric Tunnel
  tunnelSegments?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[];
  NUM_SEGMENTS?: number;
  SEGMENT_SPACING?: number;
  cameraBaseFov?: number;

  // Scene-specific flags for optimization or state
  lastCanvasWidth?: number;
  lastCanvasHeight?: number;
  sceneId?: string; // To ensure assets are for the correct scene during cleanup

  // Allow any other scene-specific assets
  [key: string]: SceneSpecificAssets[keyof SceneSpecificAssets]; // Use the defined type
};


export type SceneDefinition = {
  id: string;
  name: string;
  displayLabel?: string; // Added for concise button text
  meta?: Record<string, any>;
  rendererType?: '2d' | 'webgl'; // Default to '2d' if not specified
  // For 2D Canvas scenes (now largely obsolete but kept for structure)
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
    webcamElement?: HTMLVideoElement | null
  ) => Omit<WebGLSceneAssets, 'renderer'>; // Scenes should not return the renderer
  drawWebGL?: (params: {
    renderer: THREE.WebGLRenderer;
    audioData: AudioData;
    settings: Settings;
    webGLAssets: WebGLSceneAssets;
    canvasWidth: number;
    canvasHeight: number;
    webcamElement?: HTMLVideoElement | null; // Passed for scenes that might use it
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
  curlFactor: number; // Controls how much the vine curls
  angle: number; // Current direction of growth
  startX: number; // Initial X position
  startY: number; // Initial Y position
  speed: number; // Growth speed
};

// Valid values for CanvasRenderingContext2D.globalCompositeOperation
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
// Note: GlobalCompositeOperation is a built-in TypeScript type for canvas contexts.
// This array lists the valid string literals for that type.
export const VALID_BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over', 'source-in', 'source-out', 'source-atop',
  'destination-over', 'destination-in', 'destination-out', 'destination-atop',
  'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken',
  'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];
