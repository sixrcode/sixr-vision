
import type * as THREE from 'three';

export type LogoAnimationType = 'none' | 'solid' | 'blink' | 'pulse' | 'rainbowCycle';

export type LogoAnimationSettings = {
  type: LogoAnimationType;
  speed: number;
  color: string;
};

export type WebGLSceneAssets = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // Allow Orthographic for 2D-like planes
  renderer: THREE.WebGLRenderer;
  [key: string]: any; // For scene-specific assets like particle systems, materials, video textures
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
    webcamFeed?: HTMLVideoElement
  ) => void;
  // For WebGL scenes
  initWebGL?: (
    canvas: HTMLCanvasElement,
    settings: Settings,
    webcamElement?: HTMLVideoElement // Optional webcam element for scenes that need it
  ) => WebGLSceneAssets;
  drawWebGL?: (params: {
    renderer: THREE.WebGLRenderer; // Main renderer instance
    scene: THREE.Scene; // Scene-specific THREE.Scene
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // Scene-specific THREE.Camera
    audioData: AudioData;
    settings: Settings;
    webGLAssets: any; // Assets returned by initWebGL
    canvasWidth: number;
    canvasHeight: number;
    webcamElement?: HTMLVideoElement; // Pass webcam element to draw loop if needed
  }) => void;
  cleanupWebGL?: (webGLAssets: WebGLSceneAssets) => void; // To dispose of scene-specific WebGL resources
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
  aiOverlayRegenerationInterval: number; // in seconds
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
  timestamp: number;
  event: string;
  details: Record<string, any>;
};

export const VALID_BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over', 'source-in', 'source-out', 'source-atop',
  'destination-over', 'destination-in', 'destination-out', 'destination-atop',
  'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken',
  'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];
