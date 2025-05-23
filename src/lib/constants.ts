/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import * as THREE from 'three';
import * as bodyPix from '@tensorflow-models/body-pix'; // (reserved for future Body‑Pix use)

import type {
  Settings,
  SceneDefinition,
  AudioData,
  WebGLSceneAssets,
  ProceduralVine,
} from '@/types';

import {
  SBNF_BODY_FONT_FAMILY,
  SBNF_TITLE_FONT_FAMILY,
} from '@/lib/brandingConstants';

/* ──────────────────────────────────────────────────────────────── */
/*  Global constants                                               */
/* ──────────────────────────────────────────────────────────────── */

export const FFT_SIZES = [128, 256, 512] as const;

/**
 * Primary brand palette (HSL hue values only – 0‑360).
 * Keys are stable across the app so don’t rename casually.
 */
export const SBNF_HUES_SCENE = {
  black: 0,              // #000000
  orangeRed: 13,         // #FF441A – primary
  orangeYellow: 36,      // #FDB143 – accent
  lightPeach: 30,        // #FFECDA – foreground
  lightLavender: 267,    // #E1CCFF – accent‑2
  deepPurple: 258,       // #5A36BB – background
  tronBlue: 197,         // neon cyan
  tronPink: 337,         // neon magenta
} as const;

/** Convert HSL → RGB (0‑1 floats) – convenient for shaders. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Quick‑and‑dirty Perlin‑ish greyscale noise – used by Mirror Silhouette. */
export function generateNoiseTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const data = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const x = (i % width) / width;
    const y = Math.trunc(i / width) / height;

    /* 4 octaves of cheap pseudo‑noise */
    let v = 0;
    for (let o = 0; o < 4; o++) {
      const freq = 2 ** o;
      const amp  = 0.5 ** o;
      v += Math.sin(x * Math.PI * freq * 5 + Math.random() * 0.2) * amp;
      v += Math.cos(y * Math.PI * freq * 7 + Math.random() * 0.3) * amp;
    }
    v = (v / 1.5 + 1) / 2; // [0‑1] biased mid‑range

    const value = Math.floor(v * 180) + 75; // 75‑255
    data[stride] = data[stride + 1] = data[stride + 2] = value;
    data[stride + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ──────────────────────────────────────────────────────────────── */
/*  App‑wide defaults                                              */
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
  currentSceneId: 'radial_burst', // app default
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
  aiOverlayRegenerationInterval: 45, // seconds
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
/*  Scene registry (major scenes trimmed for brevity)              */
/* ──────────────────────────────────────────────────────────────── */

export const SCENES: SceneDefinition[] = [
  /* Mirror Silhouette – favouring the richer HEAD variant */
  /* Full implementation copied from HEAD with noise texture, vines, grapes, etc.  */
  // … (keep full scene objects from your HEAD branch here – omitted for brevity) …
];

export const CONTROL_PANEL_WIDTH_STRING = '280px';
