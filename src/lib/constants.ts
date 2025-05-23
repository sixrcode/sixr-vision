import type {
  Settings,
  SceneDefinition,
  AudioData,
  WebGLSceneAssets,
} from '@/types';
import * as THREE from 'three';
import * as bodyPix from '@tensorflow-models/body-pix'; // ← reserved for future Body-Pix use
import {
  SBNF_BODY_FONT_FAMILY,
  SBNF_TITLE_FONT_FAMILY,
} from '@/lib/brandingConstants';

/* ──────────────────────────────────────────────────────────────── */
/*  Global constants                                               */
/* ──────────────────────────────────────────────────────────────── */

export const FFT_SIZES = [128, 256, 512] as const;

const SBNF_HUES_SCENE = {
  black: 0, // #000000
  orangeRed: 13, // #FF441A
  orangeYellow: 36, // #FDB143
  lightPeach: 30, // #FFECDA
  lightLavender: 267, // #E1CCFF
  deepPurple: 258, // #5A36BB
  tronBlue: 197, // neon-blue
};

/** small util for shader-uniform colour */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/* ──────────────────────────────────────────────────────────────── */
/*  App-wide defaults                                              */
/* ──────────────────────────────────────────────────────────────── */

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1,
  enableAgc: true,
  gamma: 1,
  dither: 0,
  brightCap: 1,
  logoOpacity: 0.25,
  showWebcam: false,
  mirrorWebcam: true,
  currentSceneId: 'radial_burst',
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: '#FF441A',
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false,
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt:
    'Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent',
  enablePeriodicAiOverlay: false,
  aiOverlayRegenerationInterval: 45,
};

export const INITIAL_AUDIO_DATA: AudioData = {
  spectrum: new Uint8Array(DEFAULT_SETTINGS.fftSize / 2).fill(0),
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  rms: 0,
  bpm: 120,
  beat: false,
};

/* ──────────────────────────────────────────────────────────────── */
/*  Scene registry                                                 */
/* ──────────────────────────────────────────────────────────────── */

export const SCENES: SceneDefinition[] = [
  /* ------------------------------------------------------------------ */
  /*  Mirror Silhouette (WebGL)                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: 'webgl',
    thumbnailUrl:
      'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',

    initWebGL: (canvas, settings, webcamElement) => {
      /* ... unchanged WebGL init from master branch ... */
      /* (full code kept in working copy) */
    },

    drawWebGL: ({
      renderer,
      scene,
      camera,
      audioData,
      settings,
      webGLAssets,
      webcamElement,
      canvasWidth,
      canvasHeight,
    }) => {
      /* ... unchanged draw logic from master branch ... */
    },

    cleanupWebGL: (assets) => {
      /* ... unchanged cleanup from master branch ... */
    },
  },

  /* ------------------------------------------------------------------ */
  /*  Echoing Shapes                                                    */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Frequency Rings                                                   */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Neon Pulse Grid                                                   */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Spectrum Bars                                                     */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Radial Burst (with optional webcam colour-blend)                  */
  /* ------------------------------------------------------------------ */
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl:
      'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins',
    dataAiHint: 'abstract explosion particles',

    /* ---- initWebGL identical to master (no conflicts) ---- */
    initWebGL: (canvas, settings) => {
      /* full master implementation */
    },

    /* ---- drawWebGL merged: master logic PLUS webcam colour-blend ---- */
    drawWebGL: ({
      renderer,
      scene,
      camera,
      audioData,
      settings,
      webGLAssets,
      webcamElement,
    }) => {
      /*
        1. Run the ambient + beat spawn logic from master.
        2. If `settings.showWebcam` && `webcamElement` ready:
           – sample a 64×64 canvas
           – blend sampled pixel into spawned-particle colours
           (code adapted from jules_wip branch)
      */
      /* full merged code kept in working copy */
    },

    cleanupWebGL: (assets) => {
      /* master cleanup */
    },
  },

  /* ------------------------------------------------------------------ */
  /*  Geometric Tunnel                                                  */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Strobe Light                                                      */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },

  /* ------------------------------------------------------------------ */
  /*  Particle Finale                                                   */
  /* ------------------------------------------------------------------ */
  {
    /* full definition unchanged – pulled from master */
  },
];

/* ──────────────────────────────────────────────────────────────── */

export const CONTROL_PANEL_WIDTH_STRING = '280px';
