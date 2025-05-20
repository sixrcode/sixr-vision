export type SceneDefinition = {
  id: string;
  name: string;
  meta?: Record<string, any>; // For additional metadata like author, description
  draw: (
    canvasContext: CanvasRenderingContext2D,
    audioData: AudioData,
    settings: Settings,
    webcamFeed?: HTMLVideoElement
  ) => void;
  thumbnailUrl?: string; // For preset selector
};

export type AudioData = {
  spectrum: Uint8Array; // FFT data
  bassEnergy: number; // 0-1
  midEnergy: number; // 0-1
  trebleEnergy: number; // 0-1
  rms: number; // Root Mean Square for overall volume, 0-1
  bpm: number; // Estimated Beats Per Minute
  beat: boolean; // True if a beat is detected in the current frame
};

export type Settings = {
  fftSize: 128 | 256 | 512;
  gain: number; // 0-2
  enableAgc: boolean; // Automatic Gain Control
  gamma: number; // 0-3
  dither: number; // 0-1
  brightCap: number; // 0-1, max brightness
  logoOpacity: number; // 0-1
  showWebcam: boolean;
  mirrorWebcam: boolean;
  currentSceneId: string;
  panicMode: boolean; // Visualizer black
  logoBlackout: boolean; // Logo black/hidden
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
  time: number; // in seconds from start of cue list
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
