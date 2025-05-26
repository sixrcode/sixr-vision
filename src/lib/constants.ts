
/* eslint-disable react-hooks/exhaustive-deps */
// This top-level comment can be removed or updated if not needed for client components.
// 'use client'; // This directive is usually for components, not utility/constant files.

import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// =========================
// SBNF Color Palette (HSL)
// =========================
// These hues map directly to the official SBNF branding colours.
// Keep them *integer* values (degrees) so they’re easy to reference
// in shaders and utilities. The `as const` assertion guarantees the
// literal values stay readonly and enables better type‑safety.

export const SBNF_HUES_SCENE = {
  /** Pure black – #000000 */
  black: 0,
  /** Vibrant orange‑red – #FF441A */
  orangeRed: 13,
  /** Mustard gold – #FDB143 */
  orangeYellow: 36,
  /** Cream / light peach – #FFECDA */
  lightPeach: 30,
  /** Light lavender – #E1CCFF */
  lightLavender: 267,
  /** Deep purple – #5A36BB */
  deepPurple: 258,
  /** Tron‑style cyan‑blue accent */
  tronBlue: 197,
  /** Optional neon pink accent */
  tronPink: 337,
} as const;

// -----------------------------------------------------------------------------
// hslToRgb
// -----------------------------------------------------------------------------
/**
 * Convert an HSL colour (using percentage saturation & lightness) to an RGB
 * triplet in the 0‑1 float range – perfect for THREE.js uniforms.
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // Normalise percentages to [0,1]
  s /= 100;
  l /= 100;

  // Helper lambdas based on the GLSL formula for HSL → RGB
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [f(0), f(8), f(4)]; // [R, G, B]
}



// Helper function to generate a simple noise texture for WebGL scenes
// Used by Mirror Silhouette for its nebula fill effect.
export function generateNoiseTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const data = new Uint8Array(4 * size); // RGBA
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
// --- noise value for this pixel --------------------------------------------
const x = (i % width) / width;          // Normalised x ∈ [0,1]
const y = Math.floor(i / width) / height; // Normalised y ∈ [0,1]

// Lightweight 4-octave pseudo-noise (sine + cosine)
let v = 0;
for (let o = 0; o < 4; o++) {           // 4 octaves
  const freq = 2 ** o;                  // 1,2,4,8
  const amp  = 0.5 ** o;                // 1,½,¼,⅛
  v += Math.sin(x * Math.PI * freq * 5 + Math.random() * 0.2) * amp;
  v += Math.cos(y * Math.PI * freq * 7 + Math.random() * 0.3) * amp;
}

// Bring v from roughly [-1,1] → [0,1] and bias a touch brighter
v = (v * 0.67 + 1) * 0.5;              // ≈ (v/1.5 + 1) / 2

// Map to 0-255 with a slight bias toward the bright end (75-255)
const value = Math.floor(v * 180) + 75;
data[stride]     = value;  // R
// G & B are written just after this fragment

    data[stride + 1] = value; // G
    data[stride + 2] = value; // B
    data[stride + 3] = 255;   // A (fully opaque)
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}


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
    type: 'pulse', // Default logo animation
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red, for solid/blink animations

  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500, // Default 500ms crossfade
  sceneTransitionActive: true,
  monitorAudio: false, // Audio monitoring off by default (feedback risk)
  selectedAudioInputDeviceId: undefined, // Use system default mic initially
  enableAiOverlay: false, // AI overlay off by default
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  // SBNF-themed default prompt
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent",
  enablePeriodicAiOverlay: false,            // periodic AI-overlay updates off by default
  aiOverlayRegenerationInterval: 45,         // interval in seconds

};

export const INITIAL_AUDIO_DATA: AudioData = {
  spectrum: new Uint8Array(DEFAULT_SETTINGS.fftSize / 2).fill(0),
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  rms: 0,
  bpm: 120, // A common starting BPM
  beat: false,
};

export const SCENES: SceneDefinition[] = [
// Reordered based on typical energy/complexity progression

  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    displayLabel: 'MIRROR',
    rendererType: 'webgl',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`, // SBNF Deep Purple, Light Peach
dataAiHint: 'webcam silhouette performer',
initWebGL: (canvas, settings, webcamElement?) => {
  const scene = new THREE.Scene();
  // Orthographic camera is better for full-screen shader effects on a plane

      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

const webGLAssets: Partial<WebGLSceneAssets> & {
  lastCanvasWidth?: number;
  lastCanvasHeight?: number;
  noiseTexture?: THREE.DataTexture;
  vinesData?: {
    activeVines: ProceduralVine[];
    nextVineId: number;
    lastSpawnTime: number;
    spawnCooldown: number;
    maxVines: number;
  };
  GRAPE_COUNT?: number;
  lastGrapeSpawnTime?: number;
  tempColor?: THREE.Color;
  lastFrameTimeWebGL?: number;
  grapeGeometry?: THREE.BufferGeometry;
  grapeMaterial?: THREE.PointsMaterial;
  grapePositions?: Float32Array;
  grapeColors?: Float32Array;
  grapeTargetSizes?: Float32Array;
  grapeCurrentSizes?: Float32Array;
  grapeLifetimes?: Float32Array;
  grapeSpawnTimes?: Float32Array;
} = {

        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
// -----------------------------------------------------------------------------
// Assets initialisation (conflict-free version)
// -----------------------------------------------------------------------------
const webGLAssets: Partial<WebGLSceneAssets> & {
  lastCanvasWidth?: number;
  lastCanvasHeight?: number;
  noiseTexture?: THREE.DataTexture;
  vinesData?: {
    activeVines: ProceduralVine[];
    nextVineId: number;
    lastSpawnTime: number;
    spawnCooldown: number;
    maxVines: number;
  };
  grapesData?: {
    activeGrapes: any[];
    nextGrapeId: number;
    lastGrapeSpawnTime: number;
    spawnCooldown: number;
    maxGrapes: number;
    grapeGeometry: THREE.BufferGeometry;
    grapeBaseMaterial: THREE.PointsMaterial;
    GRAPE_PARTICLE_COUNT_PER_CLUSTER: number;
  };
  tempColor?: THREE.Color;
  lastFrameTimeWebGL?: number;
} = {
  scene,
  camera,
  lastCanvasWidth: 0,
  lastCanvasHeight: 0,

  // Nebula/background noise texture
  noiseTexture: generateNoiseTexture(256, 256),

  // Data-driven procedural vines (2-D overlay)
  vinesData: {
    activeVines: [] as ProceduralVine[],
    nextVineId: 0,
    lastSpawnTime: 0,
    spawnCooldown: 200, // ms
    maxVines: 15,
  },

  // Beat-spawned “grape” particle clusters
  grapesData: {
    activeGrapes: [],
    nextGrapeId: 0,
    lastGrapeSpawnTime: 0,
    spawnCooldown: 150,       // ms
    maxGrapes: 50,            // Max visible at once
    grapeGeometry: new THREE.BufferGeometry(),
    grapeBaseMaterial: new THREE.PointsMaterial({
      size: 10,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    }),
    GRAPE_PARTICLE_COUNT_PER_CLUSTER: 200,
  },

  tempColor: new THREE.Color(),
  lastFrameTimeWebGL: performance.now(),
};

// -----------------------------------------------------------------------------
// Initialise webcam-dependent resources when stream is ready
// -----------------------------------------------------------------------------
if (
  webcamElement &&
  webcamElement.readyState >= HTMLMediaElement.HAVE_METADATA &&
  webcamElement.videoWidth  > 0 &&
  webcamElement.videoHeight > 0
) {
  /* …existing webcam initialisation logic… */
}

        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        // Fresnel + Noise Fill Shader
        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            noiseTexture: { value: webGLAssets.noiseTexture },
            time: { value: 0.0 },
            rimColor: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 0.9, 0.7) },
            fillColor1: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.7, 0.4) },
            fillColor2: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.tronBlue / 360, 0.8, 0.5) },
            opacityFactor: { value: 0.8 },
            mirrorX_bool: { value: settings.mirrorWebcam },
            resolution: { value: new THREE.Vector2(canvas.width, canvas.height) }
          },
          vertexShader: `
            varying vec2 vUv;
            uniform bool mirrorX_bool;
            void main() {
              vUv = uv;
              if (mirrorX_bool) {
                vUv.x = 1.0 - vUv.x;
              }
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D webcamTexture;
            uniform sampler2D noiseTexture;
            uniform float time;
            uniform vec3 rimColor;
            uniform vec3 fillColor1;
            uniform vec3 fillColor2;
            uniform float opacityFactor;
            uniform vec2 resolution;
            varying vec2 vUv;

            float fresnel(vec2 texCoord, float rimWidth) {
              vec2 centeredCoord = texCoord * 2.0 - 1.0; // -1 to 1
              float distFromEdge = 1.0 - length(centeredCoord);
              return smoothstep(0.0, rimWidth, distFromEdge);
            }
// -----------------------------------------------------------------------------
// Silhouette shader (merged & conflict-free)
// -----------------------------------------------------------------------------
const vertexShader = `
  varying vec2 vUv;
  uniform bool mirrorX_bool;

  void main() {
    vUv = uv;
    if (mirrorX_bool) {
      vUv.x = 1.0 - vUv.x;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D webcamTexture;
  uniform sampler2D noiseTexture;

  uniform vec3  rimColor;
  uniform vec3  fillColor1;
  uniform vec3  fillColor2;

  uniform float opacityFactor;
  uniform float time;
  uniform vec2  resolution;

  varying vec2 vUv;

  // Fresnel helper
  float fresnel(in vec2 uv, float rimWidth) {
    vec2 centered = uv * 2.0 - 1.0;          // –1 .. 1
    float dist     = 1.0 - length(centered);  // distance to edge
    return smoothstep(0.0, rimWidth, dist);
  }

  float luma(in vec3 c) {                    // perceptual luma
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    /* ----------------------------------------------------------
       1. Early-out checkerboard discard for a cheap 2× save
    ---------------------------------------------------------- */
    if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

    /* ----------------------------------------------------------
       2. Silhouette mask (based on webcam luma)
    ---------------------------------------------------------- */
    vec4 webcamCol   = texture2D(webcamTexture, vUv);
    float mask       = smoothstep(0.35, 0.65, luma(webcamCol.rgb)) * webcamCol.a;  // softer edges

    /* ----------------------------------------------------------
       3. Rim / nebula fill
    ---------------------------------------------------------- */
    float rim        = fresnel(vUv, 0.15);
    vec3  rimCol     = rimColor * rim * (1.0 + mask * 1.5);

    vec2  noiseUv    = vUv + vec2(time * 0.02, time * 0.01);
    vec3  noiseCol   = texture2D(noiseTexture, noiseUv).rgb;
    vec3  nebulaFill = mix(fillColor1, fillColor2, noiseCol.r)
                       * (0.5 + noiseCol.g * 0.5);

    vec3  inside     = mix(vec3(0.0), nebulaFill, mask * 0.9);

    /* ----------------------------------------------------------
       4. Compose & premultiply
    ---------------------------------------------------------- */
    vec3  finalRgb   = inside + rimCol;
    float finalA     = opacityFactor
                     * (mask + rim * 0.3)     // compensate checker discard
                     * 1.85;

    gl_FragColor     = vec4(finalRgb * finalA, clamp(finalA, 0.0, 1.0));
  }
`;

// -----------------------------------------------------------------------------
// Shader material
// -----------------------------------------------------------------------------
const shaderMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    webcamTexture : { value: videoTexture },
    noiseTexture  : { value: webGLAssets.noiseTexture },
    rimColor      : { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.98, 0.63) },
    fillColor1    : { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple   / 360, 0.56, 0.30) },
    fillColor2    : { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender/ 360, 1.00, 0.50) },
    opacityFactor : { value: 1.0 },
    mirrorX_bool  : { value: settings.mirrorWebcam },
    time          : { value: 0.0 },
    resolution    : { value: new THREE.Vector2(canvas.width, canvas.height) },
  },
  transparent : true,
  blending    : THREE.AdditiveBlending,
  depthWrite  : false,
});

          depthWrite: false,
        });

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.videoTexture = videoTexture;
        webGLAssets.planeMesh = planeMesh;
        webGLAssets.shaderMaterial = shaderMaterial;
      }

// -----------------------------------------------------------------------------
// Grape-particle setup  (merged Last-Stable ✚ master)
// -----------------------------------------------------------------------------

// 1. Ensure a grapesData container exists on webGLAssets
webGLAssets.grapesData ??= {
  /* runtime bookkeeping ---------------------------------------------------- */
  activeGrapes:      [],          // live-grape metadata
  nextGrapeId:       0,
  lastGrapeSpawnTime: 0,
  spawnCooldown:     150,         // ms between spawns
  maxGrapes:         50,

  /* GPU resources ---------------------------------------------------------- */
  grapeGeometry:     new THREE.BufferGeometry(),
  grapeBaseMaterial: new THREE.PointsMaterial({
    size:            10,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.8,
    blending:        THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite:      false,
  }),

  /* constants -------------------------------------------------------------- */
  GRAPE_PARTICLE_COUNT_PER_CLUSTER: 200,
};

// 2. Create / (re)initialise GPU attribute buffers
const COUNT = webGLAssets.grapesData.GRAPE_PARTICLE_COUNT_PER_CLUSTER;
const positions   = new Float32Array(COUNT * 3);
const colors      = new Float32Array(COUNT * 3);
const sizes       = new Float32Array(COUNT);         // current size (GPU side)
const lifetimes   = new Float32Array(COUNT);         // remaining lifetime (CPU side)
const spawnTimes  = new Float32Array(COUNT);         // absolute spawn-time ms
const targetSizes = new Float32Array(COUNT);         // size goal per pop

for (let i = 0; i < COUNT; i++) {
  // Start “dead”, scattered off-screen
  positions[i * 3 + 0] = (Math.random() - 0.5) * canvas.width;
  positions[i * 3 + 1] = (Math.random() - 0.5) * canvas.height;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  lifetimes[i] = 0;
  sizes[i]     = 0;
}

const g = webGLAssets.grapesData.grapeGeometry;
g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
g.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

// 3. Stash CPU-side arrays for update logic elsewhere
Object.assign(webGLAssets, {
  grapePositions:   positions,
  grapeColors:      colors,
  grapeCurrentSizes:sizes,
  grapeTargetSizes: targetSizes,
  grapeLifetimes:   lifetimes,
  grapeSpawnTimes:  spawnTimes,
});

        }
        webGLAssets.grapesData.grapeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

/* -------------------------------------------------------------------------- */
/*  🍇  Grape-particle mesh creation – merged (Last-Stable ✚ master)          */
/* -------------------------------------------------------------------------- */

//
//  The geometry, material and CPU-side buffers were initialised a few lines
//  above (see previous merge).  Here we only have to build the THREE.Points
//  instance once and keep a reference to it.
//

if (
  webGLAssets.grapesData?.grapeGeometry &&
  webGLAssets.grapesData?.grapeBaseMaterial &&
  !webGLAssets.grapesData.mesh               // create exactly once
) {
  const grapes = new THREE.Points(
    webGLAssets.grapesData.grapeGeometry,
    webGLAssets.grapesData.grapeBaseMaterial,
  );

  scene.add(grapes);

  // Modern handle (used elsewhere in master branch)
  webGLAssets.grapesData.mesh = grapes;

  // Legacy handles retained for code that still expects them (stable branch)
  webGLAssets.grapes          = grapes;
  webGLAssets.grapeGeometry   = webGLAssets.grapesData.grapeGeometry;
  webGLAssets.grapeMaterial   = webGLAssets.grapesData.grapeBaseMaterial;
}

/* ---------- fallback background colour if no webcam initialised ---------- */

if (
  !webcamElement ||
  webcamElement.readyState < HTMLMediaElement.HAVE_METADATA
) {
  webGLAssets.bgColor = new THREE.Color().setHSL(
    SBNF_HUES_SCENE.deepPurple / 360,
    0.56,
    0.47,
  );
}

return webGLAssets as WebGLSceneAssets;

        }
      } else {
         // Fallback if webcam/shader material didn't initialize: clear to SBNF Purple
        renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47), 1);
        renderer.clear();
      }

// -----------------------------------------------------------------------------
//  🌿  Procedural-vine spawning  (merged)
// -----------------------------------------------------------------------------
const vinesData = webGLAssets.vinesData;

if (vinesData && vinesData.activeVines) {
  const { activeVines, spawnCooldown, maxVines } = vinesData;

  // Spawn only when mid-band energy is strong enough and cooldown elapsed
  if (
    audioData.midEnergy > 0.3 &&
    currentTime - vinesData.lastSpawnTime > spawnCooldown &&
    activeVines.length < maxVines
  ) {
    vinesData.lastSpawnTime = currentTime;

    /* ------------------------------------------------------------ *
     *  Choose an edge to sprout from                               *
     * ------------------------------------------------------------ */
    const edge = Math.floor(Math.random() * 4);
    let startX = 0,
      startY = 0,
      startAngle = 0;

    if (edge === 0) {
      // Left
      startX = 0;
      startY = Math.random() * canvasHeight;
      startAngle = 0;
    } else if (edge === 1) {
      // Right
      startX = canvasWidth;
      startY = Math.random() * canvasHeight;
      startAngle = Math.PI;
    } else if (edge === 2) {
      // Top
      startX = Math.random() * canvasWidth;
      startY = 0;
      startAngle = Math.PI / 2;
    } else {
      // Bottom
      startX = Math.random() * canvasWidth;
      startY = canvasHeight;
      startAngle = -Math.PI / 2;
    }

    /* ------------------------------------------------------------ *
     *  Build the new vine object (union of both code paths)        *
     * ------------------------------------------------------------ */
    const newVine: ProceduralVine = {
      id: ++vinesData.nextVineId,
      points: [{ x: startX, y: startY }],
      color: `hsla(${
        SBNF_HUES_SCENE.lightLavender + Math.random() * 40 - 20
      }, 80%, 70%, 0.7)`,
      opacity: 0.6 + Math.random() * 0.3,
      currentLength: 0,
      maxLength: 60 + Math.random() * 120,          // total segments
      spawnTime: currentTime,
      lifetime: 4000 + Math.random() * 5000,        // ms
      thickness: 1.5 + Math.random() * 2,
      curlFactor: 0.04 + Math.random() * 0.08,
      angle: startAngle + (Math.random() - 0.5) * (Math.PI / 3.5),
      speed: 0.6 + Math.random() * 1.2,             // used by master update loop
      startX,                                       // retained for completeness
      startY,
    };

    activeVines.push(newVine);
  }
}

        }

        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
// -----------------------------------------------------------------------------
//  🌿 Vine grow / fade update  (merged)
// -----------------------------------------------------------------------------
if (vinesData && vinesData.activeVines) {
  const { activeVines } = vinesData;

  for (let i = activeVines.length - 1; i >= 0; i--) {
    const vine = activeVines[i];
    const age        = currentTime - vine.spawnTime;
    const lifeRatio  = age / vine.lifetime;

    /* -------------------------------------------------- *
     *  Cull old or invisible vines                       *
     * -------------------------------------------------- */
    if (lifeRatio >= 1 || vine.opacity <= 0.01) {
      activeVines.splice(i, 1);
      continue;
    }

    /* -------------------------------------------------- *
     *  Opacity fades out over lifetime (linear-ish)      *
     * -------------------------------------------------- */
    vine.opacity = (1.0 - lifeRatio) * 0.9; // 0.9 keeps them slightly brighter

    /* -------------------------------------------------- *
     *  Grow the spline while we still can                *
     * -------------------------------------------------- */
    if (vine.currentLength < vine.maxLength) {
      const last = vine.points[vine.points.length - 1];

      // ✨ Blend both curvature formulas from the two branches
      const t = currentTime * 0.001;
      const angleChange =
        (Math.sin(t * vine.curlFactor + vine.id * 0.5) +
         Math.sin(t * 0.3 + vine.id) +
         Math.sin(t * 1.1 * vine.curlFactor + vine.id) +
         Math.sin(t * 2.1 * vine.curlFactor + vine.id * 0.3)) *
        0.09;          // scaled down so motion isn’t too wild

      vine.angle += angleChange;

      const segLen =
        // use .speed if it exists (master), else fall back to stable’s growSpeed
        (vine.speed ?? (2 + audioData.midEnergy * 3)) *
        (1 + audioData.midEnergy * 0.5);

      const newX = last.x + Math.cos(vine.angle) * segLen;
      const newY = last.y + Math.sin(vine.angle) * segLen;

      // Keep the vine inside the view-box.  Comment this block out if you
      // prefer the “trail off-screen” behaviour from *master*.
      if (newX >= 0 && newX <= canvasWidth && newY >= 0 && newY <= canvasHeight) {
        vine.points.push({ x: newX, y: newY });
        vine.currentLength++;
      } else {
        vine.currentLength = vine.maxLength; // stop further growth
      }
    }
  }
}

// -----------------------------------------------------------------------------
//  🍇  Grape-particle clean-up  (same for both branches)
// -----------------------------------------------------------------------------
if (webGLAssets.grapesData) {
  if (webGLAssets.grapesData.mesh)   webGLAssets.scene?.remove(webGLAssets.grapesData.mesh);
  if (webGLAssets.grapesData.grapeGeometry)     webGLAssets.grapesData.grapeGeometry.dispose();
  if (webGLAssets.grapesData.grapeBaseMaterial) webGLAssets.grapesData.grapeBaseMaterial.dispose();
  webGLAssets.grapesData.activeGrapes = [];
}

// -----------------------------------------------------------------------------
//  🧹  Generic WebGL asset disposal
// -----------------------------------------------------------------------------
if (webGLAssets.videoTexture)        webGLAssets.videoTexture.dispose();
if (webGLAssets.planeMesh?.geometry) webGLAssets.planeMesh.geometry.dispose();
if (webGLAssets.planeMesh?.material)
  (webGLAssets.planeMesh.material as THREE.ShaderMaterial).dispose();
if (webGLAssets.shaderMaterial)      webGLAssets.shaderMaterial.dispose();
if (webGLAssets.noiseTexture)        webGLAssets.noiseTexture.dispose();

// Vines array reset so future draws start fresh
if (webGLAssets.vinesData) webGLAssets.vinesData.activeVines = [];

      }
      // Vines are 2D, handled by overlay canvas, no specific WebGL cleanup here for them.
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    displayLabel: 'ECHO',
rendererType: 'webgl',
dataAiHint: 'glowing geometric shapes audio pulse',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeYellow.toString(16)}.png`, // SBNF Black BG, Orange-Yellow text

    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

initWebGL: (canvas, settings) => {
  /* ---------- basic scene / camera ---------- */
  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    canvas.width  / -2,
    canvas.width  /  2,
    canvas.height /  2,
    canvas.height / -2,
    1,
    1000
  );
  camera.position.z = 10;

  /* ---------- star-field full-screen quad ---------- */
  const starfieldGeometry  = new THREE.PlaneGeometry(2, 2);
  const starfieldMaterial  = new THREE.ShaderMaterial({
    vertexShader:   `varying vec2 vUv;
                     void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,

    fragmentShader: `
      uniform vec2  u_resolution_star;
      uniform float u_time_star;
      varying vec2  vUv;

      float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      float noise(vec2 p){
        vec2  i = floor(p);
        vec2  f = fract(p); f = f*f*(3. - 2.*f);
        return mix( mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), f.x),
                    mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }

      void main(){
        vec2  uv   = gl_FragCoord.xy / u_resolution_star.xy;
        float n    = noise(uv*200. + u_time_star*0.01);
        float star = smoothstep(0.95,0.97,n);
        float tw   = sin(u_time_star*2. + uv.x*100. + uv.y*50.)*0.5 + 0.5;
        star      *= 0.4 + tw*0.3;                 // subtle twinkle
        gl_FragColor = vec4(vec3(star*0.6), star*0.4);
      }`,

    uniforms: {
      u_resolution_star: { value: new THREE.Vector2(canvas.width, canvas.height) },
      u_time_star:       { value: 0.0 },
    },
    transparent: true,
    depthWrite : false,
  });

  const starfieldMesh = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
  starfieldMesh.renderOrder = -1;               // draw first (background)
  scene.add(starfieldMesh);

  /* ---------- instanced shape geometries ---------- */
  const MAX_SHAPE_INSTANCES = 50;

  const circleGeometry   = new THREE.CircleGeometry(0.5, 32);
  const squareGeometry   = new THREE.PlaneGeometry(1, 1);

  const triShape = new THREE.Shape();
  triShape.moveTo(-0.5, -0.433);
  triShape.lineTo( 0.5, -0.433);
  triShape.lineTo( 0.0,  0.433);
  triShape.closePath();
  const triangleGeometry = new THREE.ShapeGeometry(triShape);

  /* ---------- single instanced material (vertex-color) ---------- */
  const instancedMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent : true,
    blending    : THREE.AdditiveBlending,
    depthWrite  : false,
  });

  const circleInstancedMesh   = new THREE.InstancedMesh(circleGeometry,   instancedMaterial, MAX_SHAPE_INSTANCES);
  const squareInstancedMesh   = new THREE.InstancedMesh(squareGeometry,   instancedMaterial, MAX_SHAPE_INSTANCES);
  const triangleInstancedMesh = new THREE.InstancedMesh(triangleGeometry, instancedMaterial, MAX_SHAPE_INSTANCES);
  scene.add(circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh);

  /* ---------- asset bundle returned to renderer ---------- */
  const webGLAssets: Partial<WebGLSceneAssets> = {
    /* scene graph */
    scene,
    camera,

    /* starfield */
    starfieldMesh,
    starfieldMaterial,

    /* instanced shapes */
    circleInstancedMesh,
    squareInstancedMesh,
    triangleInstancedMesh,

    /* shared resources for cleanup */
    instancedMaterial,
    circleGeometry,
    squareGeometry,
    triangleGeometry,

    /* runtime helpers */
    activeInstances : [] as any[],
    nextInstanceId  : 0,
    maxShapeInstances: MAX_SHAPE_INSTANCES,
    dummy           : new THREE.Object3D(),
    tempColor       : new THREE.Color(),

    /* spawning / timing */
    lastSpawnTime   : 0,
    spawnCooldown   : 100,              // ms
    lastFrameTimeWebGL: performance.now(),

    /* clear colour */
    bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.03),
  };

  return webGLAssets as WebGLSceneAssets;
},

        }
      });

      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.activeInstances || !webGLAssets.starfieldMaterial || !webGLAssets.bgColor ||
          !webGLAssets.circleInstancedMesh || !webGLAssets.squareInstancedMesh || !webGLAssets.triangleInstancedMesh ||
          !webGLAssets.dummy || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

      const {
        starfieldMaterial, starfieldMesh,
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
        activeInstances, MAX_SHAPE_INSTANCES,
        dummy, tempColor, bgColor, spawnCooldown,
        lastFrameTimeWebGL
      } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;
      const hueTimeShift = (currentTime / 20000) * 360;

      // Update starfield
      starfieldMaterial.uniforms.u_time_star.value = currentTime * 0.001;
      if (starfieldMaterial.uniforms.u_resolution_star) starfieldMaterial.uniforms.u_resolution_star.value.set(canvasWidth, canvasHeight);

      renderer?.setClearColor((bgColor as THREE.Color).getHex(), 1.0);

      const spawnCondition = (audioData.beat && (currentTime - (webGLAssets.lastSpawnTimeShape || 0) > spawnCooldown / 2)) ||
                             (audioData.rms > 0.1 && (currentTime - (webGLAssets.lastSpawnTimeShape || 0) > spawnCooldown));

      if (spawnCondition && activeInstances.length < MAX_SHAPE_INSTANCES! * 3) {
        webGLAssets.lastSpawnTimeShape = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.5);

        for (let k = 0; k < numToSpawn; k++) {
          if (activeInstances.length >= MAX_SHAPE_INSTANCES! * 3) break;

          const shapeTypes = ['circle', 'square', 'triangle'];
          const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

          const initialScale = (canvasWidth / 25) * (0.3 + audioData.bassEnergy * 0.5) * Math.max(0.1, settings.brightCap);
          if (initialScale < 2) continue;

          const sbnfGrapeHues = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.tronBlue];
          let huePicker = Math.random();
          let selectedBaseHue;
          if (huePicker < 0.4) selectedBaseHue = SBNF_HUES_SCENE.deepPurple;
          else if (huePicker < 0.7) selectedBaseHue = SBNF_HUES_SCENE.lightLavender;
          else if (huePicker < 0.85) selectedBaseHue = SBNF_HUES_SCENE.orangeYellow;
          else selectedBaseHue = sbnfGrapeHues[Math.floor(Math.random() * 2) + 3]; // orangeRed or tronBlue

          const finalHue = (selectedBaseHue + audioData.trebleEnergy * 30 + hueTimeShift) % 360;
          const [r,g,bVal] = hslToRgb(finalHue, 80 + audioData.trebleEnergy * 20, 60 + audioData.midEnergy * 15);

          activeInstances.push({
            id: Math.random(), type: shapeType,
            x: (Math.random() - 0.5) * canvasWidth * 0.9,
            y: (Math.random() - 0.5) * canvasHeight * 0.9,
            z: (Math.random() - 0.5) * 5,
            initialScale,
            maxScale: initialScale * (1.5 + audioData.rms * 2.5),
            currentScale: initialScale * 0.1,
            color: new THREE.Color(r, g, bVal),
            currentOpacity: Math.min(0.85, 0.5 + audioData.rms * 0.5) * settings.brightCap,
            lifetime: 1.2 + Math.random() * 1.3, // seconds
            spawnTime: currentTime,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.002 * (1 + audioData.trebleEnergy),
            initialLifetime: 1.2 + Math.random() * 1.3, // Store initial for fade calculation
          });
        }
      }

      let circleIdx = 0, squareIdx = 0, triangleIdx = 0;
// ── update / cull active instances ────────────────────────────────────────────
for (let i = activeInstances.length - 1; i >= 0; i--) {
  const inst       = activeInstances[i];
  const ageMs      = currentTime - inst.spawnTime;
  const lifeRatio  = ageMs / inst.initialLifetime;   // both are ms

  /* ----- cull when lifetime exceeded --------------------------------------- */
  if (lifeRatio >= 1) {
    activeInstances.splice(i, 1);
    continue;
  }

  /* ----- scale animation: grow (first 30 %) then shrink -------------------- */
  const growDuration = inst.initialLifetime * 0.30;  // 30 % of total life
  if (ageMs < growDuration) {
    const g = ageMs / growDuration;
    inst.currentScale = inst.initialScale +
                        (inst.maxScale - inst.initialScale) * g;
  } else {
    const s = (ageMs - growDuration) / (inst.initialLifetime - growDuration);
    inst.currentScale = inst.maxScale * (1 - s);
  }
  inst.currentScale = Math.max(0.01, inst.currentScale);   // clamp

  /* ----- rotation & opacity ------------------------------------------------ */
  inst.rotation += inst.rotationSpeed * deltaTime * 60;
  const currentOpacity = inst.currentOpacity * (1 - lifeRatio);

  /* ----- build matrix & colour -------------------------------------------- */
  dummy.position.set(inst.x, inst.y, inst.z);
  dummy.rotation.z = inst.rotation;
  dummy.scale.set(inst.currentScale, inst.currentScale, inst.currentScale);
  dummy.updateMatrix();

  tempColor.copy(inst.color).multiplyScalar(currentOpacity);

  /* ----- write to the correct instanced mesh ------------------------------ */
  let mesh: THREE.InstancedMesh | undefined;
  let idx  = 0;
  switch (inst.type) {
    case 'circle':
      if (circleIdx < maxShapeInstances) { mesh = circleInstancedMesh; idx = circleIdx++; }
      break;
    case 'square':
      if (squareIdx < maxShapeInstances) { mesh = squareInstancedMesh; idx = squareIdx++; }
      break;
    case 'triangle':
      if (triangleIdx < maxShapeInstances) { mesh = triangleInstancedMesh; idx = triangleIdx++; }
      break;
  }

  if (mesh) {
    mesh.setMatrixAt(idx, dummy.matrix);
    mesh.setColorAt(idx, tempColor);
  }
}

/* update draw counts & mark instance attributes dirty */
circleInstancedMesh.count     = circleIdx;
squareInstancedMesh.count     = squareIdx;
triangleInstancedMesh.count   = triangleIdx;

[circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh].forEach(m => {
  if (m.count) {
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }
});

        }
        instance.currentScale = Math.max(0.01, instance.currentScale);

        instance.rotation += instance.rotationSpeed * deltaTime * 60;
        const finalOpacity = instance.currentOpacity * (1.0 - lifeProgress) * 0.85; // Slightly reduced max opacity for additive

/* ────────────────────────────────────────────────────────────────────────── */
/* draw/update every instance                                                */
/* ────────────────────────────────────────────────────────────────────────── */

let circleIdx   = 0;
let squareIdx   = 0;
let triangleIdx = 0;

for (let i = activeInstances.length - 1; i >= 0; i--) {
  const inst       = activeInstances[i];
  const ageMs      = currentTime - inst.spawnTime;
  const lifeRatio  = ageMs / inst.initialLifetime;        // 0-1

  /* ––– remove when done ––– */
  if (lifeRatio >= 1) {
    activeInstances.splice(i, 1);
    continue;
  }

  /* ––– animation: rotation, scale “pop”, opacity fade ––– */
  inst.rotation += inst.rotationSpeed * (1 + audioData.midEnergy * 0.8);
  const scaleProgress  = Math.sin(lifeRatio * Math.PI);         // pop-in/out
  const currentScale   = inst.initialScale +
                         (inst.maxScale - inst.initialScale) * scaleProgress;
  const currentOpacity = inst.currentOpacity * (1 - lifeRatio ** 2); // eased

  /* ––– build transform matrix ––– */
  dummy.position.set(inst.x, inst.y, inst.z);
  dummy.rotation.z = inst.rotation;
  dummy.scale.set(currentScale, currentScale, currentScale);
  dummy.updateMatrix();

  /* ––– colour with premultiplied opacity ––– */
  tempColor.copy(inst.color).multiplyScalar(currentOpacity);

  /* ––– push into correct instanced mesh ––– */
  let mesh: THREE.InstancedMesh | undefined;
  let idx  = 0;

  if (inst.type === 'circle' && circleIdx < maxShapeInstances) {
    mesh = circleInstancedMesh; idx = circleIdx++;
  } else if (inst.type === 'square' && squareIdx < maxShapeInstances) {
    mesh = squareInstancedMesh; idx = squareIdx++;
  } else if (inst.type === 'triangle' && triangleIdx < maxShapeInstances) {
    mesh = triangleInstancedMesh; idx = triangleIdx++;
  } else {
    // ran out of slots for this shape type – drop the instance
    activeInstances.splice(i, 1);
    continue;
  }

  mesh!.setMatrixAt(idx, dummy.matrix);
  mesh!.setColorAt(idx, tempColor);
}

/* update counts & flag instance data dirty */
circleInstancedMesh.count   = circleIdx;
squareInstancedMesh.count   = squareIdx;
triangleInstancedMesh.count = triangleIdx;

[circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh].forEach(m => {
  if (m.count) {
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }
});

      }
      webGLAssets.activeInstances = newActiveInstances;

      circleInstancedMesh!.count = circleIdx;
      squareInstancedMesh!.count = squareIdx;
      triangleInstancedMesh!.count = triangleIdx;

      if (circleIdx > 0) { circleInstancedMesh!.instanceMatrix.needsUpdate = true; circleInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (squareIdx > 0) { squareInstancedMesh!.instanceMatrix.needsUpdate = true; squareInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (triangleIdx > 0) { triangleInstancedMesh!.instanceMatrix.needsUpdate = true; triangleInstancedMesh!.instanceColor!.needsUpdate = true; }

      // console.log('[Echoing Shapes] Active Instances:', activeInstances.length, 'CircleIdx:', circleIdx, 'SquareIdx:', squareIdx, 'TriangleIdx:', triangleIdx);
      // console.log('[Echoing Shapes] Counts - Circles:', circleInstancedMesh.count, 'Squares:', squareInstancedMesh.count, 'Triangles:', triangleInstancedMesh.count);
    },
    cleanupWebGL: (webGLAssets) => {
cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets) return;

  const scene = webGLAssets.scene as THREE.Scene | undefined;

  /* ── starfield quad ─────────────────────────────────────────── */
  if (webGLAssets.starfieldMesh) {
    scene?.remove(webGLAssets.starfieldMesh);
    webGLAssets.starfieldMesh.geometry?.dispose();
  }
  webGLAssets.starfieldMaterial?.dispose();

  /* ── instanced-shape meshes ─────────────────────────────────── */
  ([
    webGLAssets.circleInstancedMesh,
    webGLAssets.squareInstancedMesh,
    webGLAssets.triangleInstancedMesh
  ] as (THREE.InstancedMesh | undefined)[]).forEach(mesh => {
    if (!mesh) return;
    scene?.remove(mesh);

    // dispose() exists on InstancedMesh in newer Three builds; call if present
    (mesh as any).dispose?.();

    // always dispose geometry + material for older builds
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      (mesh.material as THREE.Material)?.dispose();
    }
  });

  /* ── shared geometries / materials created in init ──────────── */
  webGLAssets.instancedMaterial?.dispose();
  webGLAssets.circleGeometry?.dispose();
  webGLAssets.squareGeometry?.dispose();
  webGLAssets.triangleGeometry?.dispose();

  /* ── bookkeeping ────────────────────────────────────────────── */
  if (webGLAssets.activeInstances) webGLAssets.activeInstances.length = 0;
}

    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    displayLabel: 'RINGS',
    rendererType: 'webgl',
{
  id: 'frequency_rings',
  name: 'Frequency Rings',
  displayLabel: 'RINGS',
  rendererType: 'webgl',

  /* visual metadata */
  dataAiHint : 'concentric rings audio frequency',
  thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`, // SBNF Deep-Purple bg, Tron-Blue text

  /* ───────────────────────────── init ───────────────────────────── */
  initWebGL: (canvas, _settings) => {
    const scene   = new THREE.Scene();
    const camera  = new THREE.OrthographicCamera(
      canvas.width  / -2,
      canvas.width  /  2,
      canvas.height /  2,
      canvas.height / -2,
      1,
      1000
    );
    camera.position.z = 1;

    // single thin ring reused for every instance
    const ringGeometry = new THREE.RingGeometry(0.48, 0.5, 64);

    return {
      scene,
      camera,
      ringGeometry,
      activeRings     : [] as RingInstance[],
      lastSpawnTimes  : { bass: 0, mid: 0, treble: 0 },
      spawnCooldown   : 50,   // ms between spawns of the same band
      maxRingsPerBand : 15,
      tempColor       : new THREE.Color()
    } as WebGLSceneAssets & {
      ringGeometry   : THREE.RingGeometry;
      activeRings    : RingInstance[];
      lastSpawnTimes : Record<'bass'|'mid'|'treble', number>;
      spawnCooldown  : number;
      maxRingsPerBand: number;
      tempColor      : THREE.Color;
    };

    // helper type
    type RingInstance = {
      mesh          : THREE.Mesh;
      spawnTime     : number;
      lifetime      : number;
      initialOpacity: number;
      maxScale      : number;
      band          : 'bass' | 'mid' | 'treble';
    };
  },

  /* ──────────────────────────── draw ────────────────────────────── */
  drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth }) => {
    const now = performance.now();
    const {
      scene,
      ringGeometry,
      activeRings,
      lastSpawnTimes,
      spawnCooldown,
      maxRingsPerBand,
      tempColor
    } = webGLAssets;

    /* background clear (SBNF black w/ slight trail) */
    renderer.setClearColor(
      new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02),
      0.15
    );

    /* palette per band */
    const RING_COLOURS = {
      bass   : new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeRed     / 360, 0.95, 0.60),
      mid    : new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow  / 360, 0.90, 0.65),
      treble : new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 0.85, 0.70)
    } as const;

    /* spawn helper */
    const trySpawn = (band: keyof typeof RING_COLOURS, energy: number) => {
      if (
        energy > 0.08 &&
        now - lastSpawnTimes[band] > spawnCooldown &&
        activeRings.filter(r => r.band === band).length < maxRingsPerBand
      ) {
        lastSpawnTimes[band] = now;

        const mat = new THREE.MeshBasicMaterial({
          color       : RING_COLOURS[band].clone().multiplyScalar(0.5 + energy * 0.8),
          opacity     : Math.min(0.9, 0.4 + energy * 0.6),
          transparent : true,
          side        : THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(ringGeometry, mat);
        mesh.scale.set(canvasWidth * 0.03, canvasWidth * 0.03, 1); // start tiny
        scene.add(mesh);

        activeRings.push({
          mesh,
          spawnTime     : now,
          lifetime      : 800 + energy * 1200,
          initialOpacity: mat.opacity,
          maxScale      : canvasWidth * (0.7 + energy * 0.5),
          band
        });
      }
    };

    trySpawn('bass'  , audioData.bassEnergy  );
    trySpawn('mid'   , audioData.midEnergy   );
    trySpawn('treble', audioData.trebleEnergy);

    /* animate + cull */
    for (let i = activeRings.length - 1; i >= 0; --i) {
      const r   = activeRings[i];
      const age = now - r.spawnTime;
      const t   = Math.min(1, age / r.lifetime);

      if (t >= 1) {
        scene.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        activeRings.splice(i, 1);
        continue;
      }

      const scale = canvasWidth * 0.03 + t * r.maxScale;
      r.mesh.scale.set(scale, scale, 1);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity =
        r.initialOpacity * (1 - Math.pow(t, 1.5)) * settings.brightCap;
    }
  },

  /* ────────────────────────── cleanup ───────────────────────────── */
  cleanupWebGL: (webGLAssets) => {
    webGLAssets.activeRings?.forEach(r => {
      webGLAssets.scene?.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    });
    webGLAssets.activeRings = [];
    webGLAssets.ringGeometry?.dispose();
  }
},

      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.activeRings?.forEach(ring => {
        webGLAssets.scene?.remove(ring.mesh);
        ring.mesh.material.dispose();
      });
      webGLAssets.activeRings = [];
      webGLAssets.ringGeometry?.dispose(); // Dispose shared geometry
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    displayLabel: 'GRID',
    rendererType: 'webgl',
{
  id           : 'grid_pulse',
  name         : 'Grid Pulse',
  displayLabel : 'GRID',
  rendererType : 'webgl',

  /* quick meta ---------------------------------------------------- */
  dataAiHint  : 'neon grid pulse',
  thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.lightLavender.toString(16)}/${SBNF_HUES_SCENE.deepPurple.toString(16)}.png`, // lavender BG, deep-purple text

  /* ───────────────────────── init ──────────────────────────────── */
  initWebGL: (canvas) => {
    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      canvas.width  / -2,
      canvas.width  /  2,
      canvas.height /  2,
      canvas.height / -2,
      1,
      1000
    );
    camera.position.z = 1;

    /* grid geometry ------------------------------------------------ */
    const GRID_SIZE_X = 16;
    const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1;
    const totalCells  = GRID_SIZE_X * GRID_SIZE_Y;

    const cellW = canvas.width  / GRID_SIZE_X;
    const cellH = canvas.height / GRID_SIZE_Y;

    // each cell is 90 % of its slot → nice gutters between tiles
    const cellGeometry = new THREE.PlaneGeometry(cellW * 0.9, cellH * 0.9);
    const cellMaterial = new THREE.MeshBasicMaterial({
      vertexColors : true,
      transparent  : true,
      opacity      : 0.8,
      blending     : THREE.AdditiveBlending,
      depthWrite   : false,
    });
    const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
    scene.add(instancedMesh);

    /* per-cell state ---------------------------------------------- */
    const dummy      = new THREE.Object3D();
    const dimBlack   = new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.05);
    const cellStates: {
      currentColor : THREE.Color;
      targetColor  : THREE.Color;
      currentScale : number;
    }[] = [];

    for (let y = 0; y < GRID_SIZE_Y; y++) {
      for (let x = 0; x < GRID_SIZE_X; x++) {
        const idx = y * GRID_SIZE_X + x;

        dummy.position.set(
          (x - GRID_SIZE_X / 2 + 0.5) * cellW,
          (y - GRID_SIZE_Y / 2 + 0.5) * cellH,
          0
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(idx, dummy.matrix);
        instancedMesh.setColorAt(idx, dimBlack);

        cellStates.push({
          currentColor: dimBlack.clone(),
          targetColor : dimBlack.clone(),
          currentScale: 1,
        });
      }
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor!.needsUpdate = true;

    return {
      scene,
      camera,
      instancedMesh,
      GRID_SIZE_X,
      GRID_SIZE_Y,
      totalCells,
      cellW,
      cellH,
      cellStates,
      dummy,
      tempColor: new THREE.Color(),
      bgColor  : new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02),
    } as WebGLSceneAssets;
  },

  /* ───────────────────────── draw ──────────────────────────────── */
  drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
    if (!webGLAssets) return;

    const {
      instancedMesh,
      GRID_SIZE_X,
      GRID_SIZE_Y,
      totalCells,
      cellStates,
      dummy,
      tempColor,
      bgColor,
    } = webGLAssets as any;

    /* clear -------------------------------------------------------- */
    renderer.setClearColor(bgColor.getHex(), 0.18);

    /* audio + colour palettes ------------------------------------- */
    const spectrum        = audioData.spectrum;
    const spectrumLength  = spectrum.length;
    const PALETTE         = [
      SBNF_HUES_SCENE.orangeRed,
      SBNF_HUES_SCENE.orangeYellow,
      SBNF_HUES_SCENE.lightLavender,
      SBNF_HUES_SCENE.tronBlue,
    ];

    const now = performance.now();

    for (let y = 0; y < GRID_SIZE_Y; y++) {
      for (let x = 0; x < GRID_SIZE_X; x++) {
        const idx       = y * GRID_SIZE_X + x;
        const specIdx   = Math.floor((idx / totalCells) * spectrumLength);
        const energy    = (spectrum[specIdx] || 0) / 255;

        const cell      = cellStates[idx];

        /* ----- colour target ------------------------------------- */
        const baseHue   = PALETTE[(x + y + Math.floor(now / 4000)) % PALETTE.length];
        const hueShift  = (now / 14000) * 360;
        const hue       = (baseHue + energy * 40 + (audioData.beat ? 20 : 0) + hueShift) % 360;
        const sat       = 70 + energy * 25;
        const light     = 15 + energy * 60 * settings.brightCap;
        const [r, g, b] = hslToRgb(hue, sat, light);

        cell.targetColor.setRGB(r, g, b);
        cell.currentColor.lerp(cell.targetColor, 0.15);
        instancedMesh.setColorAt(idx, cell.currentColor);

        /* ----- scale (pulse) ------------------------------------- */
        const scaleGoal = 1 + energy * 0.1 * (audioData.beat ? 1.4 : 1) * audioData.rms;
        cell.currentScale = cell.currentScale * 0.9 + scaleGoal * 0.1;

        instancedMesh.getMatrixAt(idx, dummy.matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
        dummy.scale.set(cell.currentScale, cell.currentScale, 1);
        dummy.position.copy(pos);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(idx, dummy.matrix);
      }
    }

    instancedMesh.instanceColor!.needsUpdate  = true;
    instancedMesh.instanceMatrix.needsUpdate  = true;
  },

  /* ──────────────────────── cleanup ────────────────────────────── */
  cleanupWebGL: (assets) => {
    if (!assets?.instancedMesh) return;
    assets.scene?.remove(assets.instancedMesh);
    assets.instancedMesh.geometry.dispose();
    (assets.instancedMesh.material as THREE.Material).dispose();
    assets.cellStates = [];
  },
},

    },
  },
   {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    displayLabel: 'BARS',
    rendererType: 'webgl',
dataAiHint  : 'audio spectrum analysis',
thumbnailUrl: 'https://placehold.co/80x60/5A36BB/FDB143.png?text=BARS&font=poppins', // SBNF Deep-Purple BG, Mustard-Gold text

    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

// ---------------------------------------------------------------------------
//  BARS  – frequency-spectrum visualiser
// ---------------------------------------------------------------------------
thumbnailUrl: 'https://placehold.co/80x60/5A36BB/FDB143.png?text=BARS&font=poppins', // Deep-Purple BG, Mustard-Gold text
dataAiHint   : 'audio spectrum analysis',

initWebGL: (canvas, settings) => {
  const scene   = new THREE.Scene();
  const camera  = new THREE.OrthographicCamera(
    canvas.width  / -2, canvas.width  / 2,
    canvas.height /  2, canvas.height / -2,
    1, 1000
  );
  camera.position.z = 1;

  // ── bar layout ───────────────────────────────────────────────────────────
  const numBars          = Math.floor((settings.fftSize / 2) * 0.8);   // use ~80 % of FFT bins
  const barPlusGapWidth  = (canvas.width * 0.95) / numBars;            // 5 % side-padding
  const barActualWidth   = barPlusGapWidth * 0.75;                     // leave 25 % gap

  // geometry + material for instancing
  const barGeometry  = new THREE.PlaneGeometry(barActualWidth, 1);     // unit-height; scaled per-frame
  const barMaterial  = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
  scene.add(instancedMesh);

  // place zero-height bars along the bottom
  const dummy      = new THREE.Object3D();
  const initialCol = new THREE.Color(SBNF_HUES_SCENE.deepPurple);
  for (let i = 0; i < numBars; i++) {
    const x = (i - (numBars - 1) / 2) * barPlusGapWidth;
    dummy.position.set(x, -canvas.height / 2 + 0.5, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
    instancedMesh.setColorAt(i, initialCol);
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor!.needsUpdate = true;

  return {
    scene,
    camera,
    instancedMesh,
    // helpers for draw / cleanup
    numBars,
    barWidth      : barPlusGapWidth,
    barActualWidth,
    barGeometry,
    barMaterial,
    dummy         : new THREE.Object3D(),
    tempColor     : new THREE.Color(),
    bgColor       : new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47),
    lastFrameTimeWebGL: performance.now(),
  } as WebGLSceneAssets;
},

drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
  if (!webGLAssets?.instancedMesh) return;

  const {
    instancedMesh,
    numBars,
    barWidth,
    dummy,
    tempColor,
    bgColor,
  } = webGLAssets as any;

  const now = performance.now();
  webGLAssets.lastFrameTimeWebGL = now;

  // clear
  renderer?.setClearColor(bgColor.getHex(), 1);

  // helpers
  const spectrum            = audioData.spectrum;
  const effectiveBrightCap  = Math.max(0.05, settings.brightCap);
  const SBNF_BAR_HUES       = [
    SBNF_HUES_SCENE.orangeRed,
    SBNF_HUES_SCENE.orangeYellow,
    SBNF_HUES_SCENE.lightLavender,
    SBNF_HUES_SCENE.deepPurple,
    SBNF_HUES_SCENE.tronBlue,
  ];
  const sumSpectrum         = spectrum.reduce((s, v) => s + v, 0);
  const audioSilent         = audioData.rms < 0.01 && sumSpectrum < numBars * 0.5;

  for (let i = 0; i < numBars; i++) {
    if (i >= spectrum.length) continue;

    // height
    const value     = audioSilent ? 0.001 : (spectrum[i] || 0) / 255;
    const barHeight = Math.max(
      1,
      value * canvasHeight * effectiveBrightCap *
        (0.5 + audioData.rms * 0.5 + (audioData.beat ? 0.2 : 0))
    );

    // transform
    const x = (i - (numBars - 1) / 2) * barWidth;
    dummy.position.set(x, barHeight / 2 - canvasHeight / 2, 0);
    dummy.scale.set(1, barHeight, 1);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);

    // colour
    const hueIndex  = Math.floor((i / numBars) * SBNF_BAR_HUES.length);
    const baseHue   = SBNF_BAR_HUES[hueIndex];
    const hueShift  = (now / 15000) * 360;
    const hue       = (baseHue + value * 35 + (audioData.beat ? 20 : 0) + hueShift) % 360;
    const sat       = 65 + value * 35;
    const light     = 35 + value * 40 + (audioData.beat ? 10 : 0);
    const [r, g, b] = hslToRgb(hue, Math.min(100, sat), Math.min(75, light));
    tempColor.setRGB(r, g, b);
    instancedMesh.setColorAt(i, tempColor);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor!.needsUpdate = true;
},

cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets?.instancedMesh) return;
  const mesh = webGLAssets.instancedMesh as THREE.InstancedMesh;
  (mesh.geometry as THREE.BufferGeometry).dispose();
  (mesh.material as THREE.Material | THREE.Material[]).dispose();
  (webGLAssets.scene as THREE.Scene)?.remove(mesh);

  webGLAssets.barGeometry?.dispose?.();
  webGLAssets.barMaterial?.dispose?.();
},

    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    displayLabel: 'BURST',
    rendererType: 'webgl',
// ---------------------------------------------------------------------------
//  BURST  – particle-explosion scene
// ---------------------------------------------------------------------------
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png?text=BURST`,
dataAiHint  : 'particle explosion audio beat',

initWebGL: (canvas, settings) => {
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
  camera.position.z = 300;                             // slightly wider view than the old 200

  const PARTICLE_COUNT = 4000; // (was 5000 in an earlier draft)

  // … rest of initialisation …
},

      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
// --- particle attribute buffers ------------------------------------------------
const spawnTimes       = new Float32Array(PARTICLE_COUNT);  // track birth-times
const lifetimes        = new Float32Array(PARTICLE_COUNT);  // remaining lifetime
const initialLifetimes = new Float32Array(PARTICLE_COUNT);  // store original lifetime

for (let i = 0; i < PARTICLE_COUNT; i++) {
  lifetimes[i]        = 0;
  initialLifetimes[i] = 0;
  spawnTimes[i]       = 0;

  // park particle far off-screen until it’s needed
  const pIdx = i * 3;
  positions[pIdx + 0] = 0;
  positions[pIdx + 1] = 100000;
  positions[pIdx + 2] = 0;
}


      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
const particleMaterial = new THREE.PointsMaterial({
  size: 3,                       // default point size (from master)
  vertexColors: true,            // use per-particle colors
  transparent: true,
  opacity: 0.85,                 // keep explicit opacity control
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,         // correct perspective attenuation
  depthWrite: false              // don’t write to the depth buffer
});

      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

// ──────────────────────────────────────────────────────────────────────────────
//  ✨  Radial-Burst WebGL assets  ✨
// ──────────────────────────────────────────────────────────────────────────────
const webGLAssets: Partial<WebGLSceneAssets> & {
  /** raw buffers we mutate every frame */
  positions: Float32Array;
  colors: Float32Array;
  velocities: Float32Array;
  lifetimes: Float32Array;
  initialLifetimes: Float32Array;   // master-only, preserved for fade maths
  spawnTimes: Float32Array;         // stable-only, preserved for analytics / fx

  /** bookkeeping */
  PARTICLE_COUNT: number;
  lastBeatTime: number;             // unified name (aka lastBeatSpawnTime)
  lastAmbientSpawnTime: number;
  lastFrameTimeWebGL: number;

  /** scratch helpers */
  tempColor: THREE.Color;
  bgColor: THREE.Color;
} = {
  // scene graph
  scene,
  camera,
  particles,

  // geometry & material handles (master naming style)
  particleMaterial: material,
  particleGeometry: geometry,

  // shared typed-arrays
  positions,
  colors,
  velocities,
  lifetimes,
  initialLifetimes,   // << new in stable branch; now kept
  spawnTimes,         // << new in master branch; now kept

  // config / state
  PARTICLE_COUNT,
  lastBeatTime: 0,    // formerly lastBeatSpawnTime
  lastAmbientSpawnTime: 0,
  lastFrameTimeWebGL: performance.now(),

  // helpers
  tempColor: new THREE.Color(),
  bgColor : new THREE.Color(SBNF_HUES_SCENE.black)
};

return webGLAssets as WebGLSceneAssets;

        }
      }

/*────────────────────────  AMBIENT PARTICLE SPAWN  ────────────────────────*/

// ❶  dynamic spawn-rate (kept from “Last-Stable” branch)
const ambientSpawnRate      = 30 + audioData.rms * 80;
const ambientSpawnInterval  = 1000 / Math.max(1, ambientSpawnRate);

// ❷  per-frame safety-cap (from “master” branch, but raised to 3 %)
const maxAmbientSpawnPerFrame = Math.floor(PARTICLE_COUNT * 0.03);

if (
  audioData.rms > 0.03 &&                                   // gate
  currentTime - webGLAssets.lastAmbientSpawnTime > ambientSpawnInterval
) {
  webGLAssets.lastAmbientSpawnTime = currentTime;

  let spawned = 0;
  for (let i = 0; i < PARTICLE_COUNT && spawned < maxAmbientSpawnPerFrame; i++) {
    if (lifetimes[i] > 0) continue;                          // skip live particles

    const pIdx = i * 3;
    /*  spawn at origin  */
    positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 0;

    /*  isotropic velocity, energy-scaled  */
    const phi   = Math.random() * Math.PI * 2;
    const theta = Math.acos(Math.random() * 2 - 1);
    const speed = 35 + audioData.rms * 120 * (Math.random() * 0.5 + 0.4);
    velocities[pIdx]     = Math.sin(theta) * Math.cos(phi) * speed;
    velocities[pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
    velocities[pIdx + 2] = Math.cos(theta) * speed;

    /*  lifetime bookkeeping  */
    initialLifetimes[i] = 1.5 + Math.random() * 1.5;  // from stable
    lifetimes[i]        = initialLifetimes[i];
    spawnTimes[i]       = currentTime;                // kept for analytics / fx

    /*  colour – SBNF ambient palette  */
    const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
    const [r, g, b] = hslToRgb(hue, 70 + Math.random() * 30, 40 + Math.random() * 20);
    tempColor.setRGB(r, g, b);
    colors[pIdx]     = tempColor.r;
    colors[pIdx + 1] = tempColor.g;
    colors[pIdx + 2] = tempColor.b;

    spawned++;
  }
}

/*────────────────────────  PARTICLE UPDATE & FADING  ──────────────────────*/

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const pIdx = i * 3;

  if (lifetimes[i] > 0) {
    /*  physics integration  */
    positions[pIdx]     += velocities[pIdx]     * deltaTime;
    positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
    positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

    velocities[pIdx]     *= dragFactor;
    velocities[pIdx + 1] *= dragFactor;
    velocities[pIdx + 2] *= dragFactor;

    /*  lifetime & fade  */
    lifetimes[i] -= deltaTime;
    const lifeRatio  = Math.max(0, lifetimes[i] / initialLifetimes[i]);
    const fade       = Math.pow(lifeRatio, 0.75);          // smoother ease-out
    colors[pIdx]     *= fade;
    colors[pIdx + 1] *= fade;
    colors[pIdx + 2] *= fade;

    /*  recycle when dead  */
    if (lifetimes[i] <= 0) {
      positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000;
    }
  } else {
    /*  make sure truly dead particles stay off-screen  */
    positions[pIdx + 1] = 100000;
  }
}

        }
      }

      webGLAssets.particleMaterial!.size = Math.max(1, 2.5 + settings.brightCap * 2.5 + audioData.rms * 4);
      webGLAssets.particleMaterial!.opacity = Math.min(0.9, 0.6 + settings.brightCap * 0.3 + audioData.rms * 0.3);
      particles!.geometry.attributes.position.needsUpdate = true;
      particles!.geometry.attributes.color.needsUpdate = true;

/* ────────────── PER-FRAME GPU BUFFERS & CAMERA TWEAK ────────────── */

{
  /* 1️⃣  mark particle attributes dirty so Three.js pushes them to the GPU */
  const g = (webGLAssets.geometry ?? webGLAssets.particleGeometry) as
            THREE.BufferGeometry | undefined;
  if (g?.attributes.position) (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  if (g?.attributes.color)    (g.attributes.color    as THREE.BufferAttribute).needsUpdate = true;

  /* 2️⃣  audio-reactive point-size / opacity (works for either material key) */
  const m = (webGLAssets.material ?? webGLAssets.particleMaterial) as
            THREE.PointsMaterial | undefined;
  if (m) {
    m.size    = (1.8 + audioData.rms * 3.5) * Math.max(0.1, settings.brightCap);
    m.opacity = Math.max(0.1, settings.brightCap * (0.35 + audioData.rms * 0.40));
  }

  /* 3️⃣  subtle zoom-in / FOV pump for extra punch (from master branch) */
  const cam = webGLAssets.camera as THREE.PerspectiveCamera | undefined;
  if (cam) {
    cam.position.z = 300 - audioData.rms * 120;
    cam.fov        = 75  - audioData.rms * 15;
    cam.updateProjectionMatrix();
  }
}

/* ───────────────────────── CLEAN-UP ROUTINE ─────────────────────── */

cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets) return;

  /* dispose whichever key happens to exist */
  (webGLAssets.geometry         as THREE.BufferGeometry | undefined)?.dispose();
  (webGLAssets.particleGeometry as THREE.BufferGeometry | undefined)?.dispose();

  (webGLAssets.material         as THREE.PointsMaterial | undefined)?.dispose();
  (webGLAssets.particleMaterial as THREE.PointsMaterial | undefined)?.dispose();

  /* ensure particle Points object is removed from the scene */
  const scene     = webGLAssets.scene     as THREE.Scene | undefined;
  const particles = webGLAssets.particles as THREE.Points | undefined;
  if (scene && particles) scene.remove(particles);
}

    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    displayLabel: 'TUNNEL',
    rendererType: 'webgl',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`, // SBNF Deep Purple BG, Orange-Red Text

    dataAiHint: 'geometric tunnel flight tron',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`, // SBNF Black, Tron Blue
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
// ---- Tunnel scene (merged) ------------------------------
const cameraFov = 70;
const camera = new THREE.PerspectiveCamera(
  cameraFov,
  canvas.width / canvas.height,
  0.1,
  2000
);
camera.position.z = 0;                        // start inside the tunnel

// Tunable tunnel parameters
const NUM_SEGMENTS     = 25;
const SEGMENT_SPACING  = 60;                  // distance between rings
const SEGMENT_RADIUS   = 25;                  // torus major-radius
const SEGMENT_TUBE     = 1.5;                 // torus tube-radius

// SBNF “Tron” hues to cycle through
const SBNF_TRON_HUES = [
  SBNF_HUES_SCENE.tronBlue,
  SBNF_HUES_SCENE.lightLavender,
  SBNF_HUES_SCENE.orangeRed,
  SBNF_HUES_SCENE.orangeYellow,
] as const;

// One shared torus geometry for all rings
const segmentGeometry = new THREE.TorusGeometry(
  SEGMENT_RADIUS,
  SEGMENT_TUBE,
  8,
  32
);

const tunnelSegments: THREE.Mesh[] = [];

for (let i = 0; i < NUM_SEGMENTS; i++) {
  const hue = SBNF_TRON_HUES[i % SBNF_TRON_HUES.length];
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setHSL(hue / 360, 0.9, 0.6),
    wireframe: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,        // keep that neon glow
  });

  const segment = new THREE.Mesh(segmentGeometry, material);
  segment.position.z = -i * SEGMENT_SPACING;
  segment.rotation.x = Math.PI / 2;          // consistently aligned
  tunnelSegments.push(segment);
  scene.add(segment);
}

// everything below (animation loop, cleanup, etc.) remains unchanged
//-------------------------------------------------------------

        scene.add(segment);
        tunnelSegments.push(segment);
      }

// ----------------------------------------------------------
//  TUNNEL  – WebGL scene definition (merged)
// ----------------------------------------------------------
initWebGL: (canvas, settings) => {
  const scene   = new THREE.Scene();
  const cameraFov = 70;
  const camera  = new THREE.PerspectiveCamera(cameraFov, canvas.width / canvas.height, 0.1, 2000);
  camera.position.z = 0;                     // we fly *through* the tunnel

  // --- tunnel geometry ------------------------------------
  const NUM_SEGMENTS    = 25;
  const SEGMENT_SPACING = 60;
  const SEGMENT_RADIUS  = 25;
  const SEGMENT_TUBE    = 1.5;

  const SBNF_TRON_HUES = [
    SBNF_HUES_SCENE.tronBlue,
    SBNF_HUES_SCENE.lightLavender,
    SBNF_HUES_SCENE.orangeRed,
    SBNF_HUES_SCENE.orangeYellow,
  ] as const;

  // one shared torus geometry (perf)
  const segmentGeometry = new THREE.TorusGeometry(
    SEGMENT_RADIUS, SEGMENT_TUBE, 8, 32
  );

  const tunnelSegments: THREE.Mesh[] = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const hue = SBNF_TRON_HUES[i % SBNF_TRON_HUES.length];
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hue / 360, 0.9, 0.6),
      wireframe: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const segment = new THREE.Mesh(segmentGeometry, material);
    segment.position.z = -i * SEGMENT_SPACING;
    segment.rotation.x = Math.PI / 2;        // clean, non-twisting tunnel
    tunnelSegments.push(segment);
    scene.add(segment);
  }

  return {
    scene,
    camera,
    tunnelSegments,
    NUM_SEGMENTS,
    SEGMENT_SPACING,
    cameraBaseFov: cameraFov,
    lastFrameTimeWebGL: performance.now(),
    tempColor: new THREE.Color(),
    sbnfTronHues: SBNF_TRON_HUES,
    bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
  } as WebGLSceneAssets & {
    tunnelSegments: THREE.Mesh[];
    NUM_SEGMENTS: number;
    SEGMENT_SPACING: number;
    cameraBaseFov: number;
    tempColor: THREE.Color;
    sbnfTronHues: readonly number[];
    lastFrameTimeWebGL: number;
    bgColor: THREE.Color;
  };
},

// ----------------------------------------------------------
//  Per-frame draw
// ----------------------------------------------------------
drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
  const now      = performance.now();
  const dt       = (now - webGLAssets.lastFrameTimeWebGL) / 1000;
  webGLAssets.lastFrameTimeWebGL = now;

  const {
    camera,
    tunnelSegments,
    NUM_SEGMENTS,
    SEGMENT_SPACING,
    cameraBaseFov,
    sbnfTronHues,
    tempColor,
    bgColor,
  } = webGLAssets;

  // background   ────────────────────────────────────────────
  renderer.setClearColor(bgColor, 1);        // jet-black tron backdrop

  // camera motion (fly forward)
  const speed = 35 + audioData.rms * 120 + audioData.bpm * 0.08;
  camera.position.z -= speed * dt;

  // update every ring
  tunnelSegments.forEach((seg, i) => {
    // recycle ring when behind camera
    if (seg.position.z > camera.position.z + SEGMENT_SPACING) {
      seg.position.z -= NUM_SEGMENTS * SEGMENT_SPACING;
      seg.material.color.setHSL(
        sbnfTronHues[Math.floor(Math.random() * sbnfTronHues.length)] / 360,
        0.9,
        0.6
      );
    }

    // subtle pulsating scale & colour
    const scale = 1 + Math.sin(now * 0.0012 + i * 0.6) * 0.12 + audioData.bassEnergy * 0.25;
    seg.scale.set(scale, scale, scale);

    const hueIdx = (Math.floor(now * 0.00015) + i) % sbnfTronHues.length;
    const hue    = sbnfTronHues[hueIdx];
    const sat    = 0.75 + audioData.midEnergy * 0.25;
    const lum    = Math.min(0.75, 0.5 + audioData.trebleEnergy * 0.25 + (audioData.beat && i % 4 === 0 ? 0.15 : 0));
    seg.material.color.setHSL(hue / 360, sat, lum);
    (seg.material as THREE.MeshBasicMaterial).opacity = Math.min(
      0.85,
      0.6 + audioData.rms * 0.4 * settings.brightCap
    );

    // slight spin
    seg.rotation.z += (audioData.trebleEnergy * 0.02 + 0.0005 + audioData.bpm * 0.000015)
                      * (i % 2 === 0 ? 1.1 : -1.3) * dt * 60;
  });

  // camera FOV pulse
  (camera as THREE.PerspectiveCamera).fov =
    cameraBaseFov - audioData.rms * 30 * settings.gamma + (audioData.beat ? 6 : 0);
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
},

// ----------------------------------------------------------
//  Cleanup
// ----------------------------------------------------------
cleanupWebGL: (webGLAssets) => {
  webGLAssets.tunnelSegments?.forEach(seg => {
    seg.geometry.dispose();
    seg.material.dispose();
    webGLAssets.scene?.remove(seg);
  });
  webGLAssets.tunnelSegments = [];
},

    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    displayLabel: 'STROBE',
    rendererType: 'webgl',
dataAiHint: 'flashing light beat strobe',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`, // SBNF Black BG, Light Peach Text

    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({
// --- STROBE scene (merged) ----------------------------------------------------
dataAiHint: 'flashing light beat strobe',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`, // SBNF Black BG, Light Peach Text

initWebGL: (canvas, settings) => {
  const scene   = new THREE.Scene();
  const camera  = new THREE.OrthographicCamera(
    canvas.width / -2, canvas.width / 2,
    canvas.height / 2, canvas.height / -2,
    1, 1000
  );
  camera.position.z = 1;

  // Full-screen plane that we tint/flash.
  const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(SBNF_HUES_SCENE.black), // start fully black
    transparent: true,
    opacity: 1.0,
  });
  const flashPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  scene.add(flashPlane);

  return {
    scene,
    camera,
    flashPlane,
    planeMaterial,
    tempColor: new THREE.Color(),
    bgColor:  new THREE.Color(SBNF_HUES_SCENE.black),
    lastFlashTime: 0,
    flashActive:   false,
    flashDuration: 60,            // ms the flash stays fully lit
    lastFrameTimeWebGL: performance.now(),
  } as WebGLSceneAssets & {
    flashPlane: THREE.Mesh,
    planeMaterial: THREE.MeshBasicMaterial,
    tempColor: THREE.Color,
    bgColor: THREE.Color,
    lastFlashTime: number,
    flashActive: boolean,
    flashDuration: number,
    lastFrameTimeWebGL: number,
  };
},

drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
  if (
    !webGLAssets ||
    !webGLAssets.flashPlane ||
    !webGLAssets.planeMaterial ||
    !webGLAssets.tempColor ||
    !webGLAssets.bgColor
  ) return;

  const { planeMaterial, tempColor, bgColor } = webGLAssets;
  const currentTime = performance.now();

  // Only clear when the flash plane is faded out
  if (!webGLAssets.flashActive) {
    renderer.setClearColor(bgColor.getHex(), 1.0);
  }

  // ---------- Trigger a new flash on beat ----------
  if (
    audioData.beat &&
    settings.brightCap > 0.01 &&
    currentTime - webGLAssets.lastFlashTime > webGLAssets.flashDuration
  ) {
    webGLAssets.flashActive   = true;
    webGLAssets.lastFlashTime = currentTime;

    const hueOptions = [
      SBNF_HUES_SCENE.orangeRed,
      SBNF_HUES_SCENE.orangeYellow,
      SBNF_HUES_SCENE.lightLavender,
      SBNF_HUES_SCENE.lightPeach,
    ];
    const hue       = hueOptions[Math.floor(Math.random() * hueOptions.length)];
    const lightness = 70 + Math.random() * 25;
    const [r, g, b] = hslToRgb(hue, 100, lightness);

    tempColor.setRGB(r, g, b);
    planeMaterial.color.copy(tempColor);
    planeMaterial.opacity = Math.min(1, settings.brightCap);
  }

  // ---------- Fade the flash out ----------
  if (webGLAssets.flashActive) {
    const elapsed   = currentTime - webGLAssets.lastFlashTime;
    const progress  = elapsed / webGLAssets.flashDuration;

    if (progress >= 1) {
      webGLAssets.flashActive = false;
      planeMaterial.opacity   = 0;
    } else {
      planeMaterial.opacity = 1 - progress;
    }
  }
},

cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets) return;
  if (webGLAssets.flashPlane && webGLAssets.scene)
    (webGLAssets.scene as THREE.Scene).remove(webGLAssets.flashPlane);
  webGLAssets.planeMaterial?.dispose();
},

      }


      if (webGLAssets.flashActive) {
        if (currentTime - webGLAssets.lastFlashTime! > webGLAssets.flashDuration!) {
          webGLAssets.flashActive = false;
          planeMaterial!.color.setHSL(SBNF_HUES_SCENE.black / 360, 0, 0); // Return to black
          planeMaterial!.opacity = 1.0; // Ensure it's opaque black
        } else {
          // Optionally fade the flash color/opacity quickly during its short duration
          const timeSinceFlash = currentTime - webGLAssets.lastFlashTime!;
          const fadeRatio = 1.0 - Math.min(1.0, timeSinceFlash / webGLAssets.flashDuration!);
          planeMaterial!.opacity = settings.brightCap * fadeRatio;
        }
      } else if (audioData.beat && (currentTime - webGLAssets.lastFlashTime! > 100)) { // Cooldown
        webGLAssets.lastFlashTime = currentTime;
        webGLAssets.flashActive = true;
        const hue = (SBNF_HUES_SCENE.orangeYellow + Math.random() * 50 - 25) % 360; // SBNF Yellows/Oranges/Peaches
        tempColor!.setHSL(hue / 360, 0.95, 0.75); // Bright flash
        planeMaterial!.color.copy(tempColor!);
        planeMaterial!.opacity = settings.brightCap;
      }

      flashPlane!.visible = webGLAssets.flashActive; // Only visible during active flash
    },
    cleanupWebGL: (webGLAssets) => {
cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets) return;

  // Remove the flash plane from the scene and dispose of its geometry.
  if (webGLAssets.flashPlane) {
    if (webGLAssets.scene)
      (webGLAssets.scene as THREE.Scene).remove(webGLAssets.flashPlane as THREE.Mesh);
    if (webGLAssets.flashPlane.geometry)
      (webGLAssets.flashPlane.geometry as THREE.PlaneGeometry).dispose();
  }

  // Dispose of the plane material.
  (webGLAssets.planeMaterial as THREE.MeshBasicMaterial | undefined)?.dispose();
},

  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    displayLabel: 'FINALE',
    rendererType: 'webgl',
/*  ──  FINALE Scene  ──────────────────────────────────────────────────────────
 *  Big “closing-number” particle blast in SBNF colors.
 *  -------------------------------------------------------------------------- */

dataAiHint: 'cosmic explosion stars fireworks',
thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeYellow.toString(16)}.png`, // SBNF Black BG, Mustard-Gold text
initWebGL: (canvas, settings) => {
  const scene  = new THREE.Scene();

  // A slightly farther camera than before gives more head-room for big blasts.
  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
  camera.position.z = 350;

  /* …rest of the FINALE scene setup… */
}


      const PARTICLE_COUNT = 3000; // Reduced from 3500
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
// ── Buffers used by the particle system ────────────────────────────────────
const spawnTimes       = new Float32Array(PARTICLE_COUNT);       // Last-Stable
const initialLifetimes = new Float32Array(PARTICLE_COUNT);       // master (for fade-outs)

// Initialise all particles as “dead” and park them far away.
for (let i = 0; i < PARTICLE_COUNT; i++) {
  lifetimes[i]        = 0;
  initialLifetimes[i] = 0;
  const pIdx = i * 3;

  // Off-screen so nothing renders until we spawn it.
  positions[pIdx + 1] = 100000;
}


      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
const particleMaterial = new THREE.PointsMaterial({
  size: 2.0,          // compromise between 1.6 and 3.0
  vertexColors: true,
  transparent: true,
  opacity: 0.85,      // keeps master’s subtle fade
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
  depthWrite: false,
});

      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

// ── Finale scene ───────────────────────────────────────────────────────────────
return {
  /* core refs */
  scene,
  camera,                   // PerspectiveCamera created above
  particles,                // THREE.Points
  particleMaterial: material,
  particleGeometry: geometry,

  /* particle buffers */
  positions,
  colors,
  velocities,
  lifetimes,
  initialLifetimes,         // used for fade-outs
  PARTICLE_COUNT,

  /* runtime state */
  lastBeatTime: 0,
  lastFrameTimeWebGL: performance.now(),
  tempColor: new THREE.Color(),
  bgColor: new THREE.Color(SBNF_HUES_SCENE.black),

  /* extra flair */
  rotationSpeed: new THREE.Vector3(0.006, 0.008, 0.003), // subtle slow spin
} as WebGLSceneAssets;
},
drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
  if (!webGLAssets?.particles) return;

  const {
    particles,
    particleMaterial: material,
    particleGeometry: geometry,
    positions,
    colors,
    velocities,
    lifetimes,
    initialLifetimes,
    PARTICLE_COUNT,
    tempColor,
    rotationSpeed,
  } = webGLAssets as any;

  // ── timing ────────────────────────────────────────────────────────────────
  const now   = performance.now();
  const dtSec = (now - webGLAssets.lastFrameTimeWebGL) / 1_000;
  webGLAssets.lastFrameTimeWebGL = now;

  // ── clear / trails ────────────────────────────────────────────────────────
  renderer.setClearColor(
    new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.015),
    0.15,            // a little persistence for trails
  );

  // ── beat-burst spawn ──────────────────────────────────────────────────────
  const beatCooldown = 100;            // ms
  const dragFactor   = 0.968;
  const HUES         = [
    SBNF_HUES_SCENE.orangeRed,
    SBNF_HUES_SCENE.orangeYellow,
    SBNF_HUES_SCENE.lightPeach,
    SBNF_HUES_SCENE.lightLavender,
    SBNF_HUES_SCENE.deepPurple,
  ];

  if (audioData.beat && now - webGLAssets.lastBeatTime > beatCooldown) {
    webGLAssets.lastBeatTime = now;

    let spawned = 0;
    const toSpawn = Math.floor(PARTICLE_COUNT * 0.20); // ≤20 % each beat

    for (let i = 0; i < PARTICLE_COUNT && spawned < toSpawn; i++) {
      if (lifetimes[i] > 0) continue;               // skip “live” particles
      const idx = i * 3;

      // position (near centre)
      positions[idx + 0] = (Math.random() - 0.5) * 20;
      positions[idx + 1] = (Math.random() - 0.5) * 20;
      positions[idx + 2] = (Math.random() - 0.5) * 20;

      // velocity (uniform sphere)
      const φ   = Math.random() * Math.PI * 2;
      const θ   = Math.acos(Math.random() * 2 - 1);
      const vel = 180 + (audioData.rms + audioData.bassEnergy * 1.2) * 280 * (0.7 + Math.random() * 0.6);
      velocities[idx + 0] = Math.sin(θ) * Math.cos(φ) * vel;
      velocities[idx + 1] = Math.sin(θ) * Math.sin(φ) * vel;
      velocities[idx + 2] = Math.cos(θ) * vel;

      // lifetime & colour
      const life = 1.6 + Math.random() * 2.0;
      lifetimes[i]         = life;
      initialLifetimes[i]  = life;

      const hue       = HUES[Math.floor(Math.random() * HUES.length)];
      const lightness = Math.min(70, 50 + Math.random() * 20 + audioData.rms * 10);
      tempColor.setHSL(hue / 360, 0.9 + Math.random() * 0.1, lightness / 100);
      colors[idx + 0] = tempColor.r;
      colors[idx + 1] = tempColor.g;
      colors[idx + 2] = tempColor.b;

      spawned++;
    }
  }

  // ── simulate / fade ───────────────────────────────────────────────────────
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (lifetimes[i] <= 0) continue;
    const idx = i * 3;

    // integrate position
    positions[idx + 0] += velocities[idx + 0] * dtSec;
    positions[idx + 1] += velocities[idx + 1] * dtSec;
    positions[idx + 2] += velocities[idx + 2] * dtSec;
    velocities[idx + 0] *= dragFactor;
    velocities[idx + 1] *= dragFactor;
    velocities[idx + 2] *= dragFactor;

    // lifetime & fade
    lifetimes[i] -= dtSec;
    const lifeRatio = Math.max(0, lifetimes[i] / initialLifetimes[i]);
    const fade      = lifeRatio ** 0.6;
    colors[idx + 0] *= fade;
    colors[idx + 1] *= fade;
    colors[idx + 2] *= fade;

    // recycle dead particles
    if (lifetimes[i] <= 0) {
      positions[idx + 0] = positions[idx + 1] = positions[idx + 2] = 10_000;
      colors[idx + 0] = colors[idx + 1] = colors[idx + 2] = 0;
    }
  }

  // mark GPU buffers dirty
  (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  (geometry.attributes.color    as THREE.BufferAttribute).needsUpdate = true;

  // ── runtime visuals ───────────────────────────────────────────────────────
  material.size    = (1.6 + audioData.rms * 3.0) * Math.max(0.1, settings.brightCap);
  material.opacity = Math.max(0.1, settings.brightCap * (0.25 + audioData.rms * 0.4));

  // gentle global rotation
  particles.rotation.x += rotationSpeed.x * dtSec * (0.1 + audioData.midEnergy    * 0.4);
  particles.rotation.y += rotationSpeed.y * dtSec * (0.1 + audioData.trebleEnergy * 0.4);

  // very mild camera punch-in / FOV pulse
  const cam = webGLAssets.camera as THREE.PerspectiveCamera;
  cam.fov        = THREE.MathUtils.clamp(75 + audioData.rms * 1, 74, 76);
  cam.position.z = 300 - audioData.rms * 10;
  cam.updateProjectionMatrix();
},

        }
      }

      particles!.geometry.attributes.position.needsUpdate = true;
      particles!.geometry.attributes.color.needsUpdate = true;

      webGLAssets.particleMaterial!.size = Math.max(1.2, 2.8 + settings.brightCap * 2.8 + audioData.rms * 3.5); // Slightly adjusted size reactivity
      webGLAssets.particleMaterial!.opacity = Math.min(0.9, 0.55 + settings.brightCap * 0.35 + audioData.rms * 0.35); // Adjusted opacity

      const camera = webGLAssets.camera as THREE.PerspectiveCamera;
      const targetZ = 350 - audioData.rms * 80 - (audioData.beat ? 15 : 0); // Less drastic zoom
      camera.position.z += (targetZ - camera.position.z) * 0.06; // Smoother zoom
      const targetFov = 75 - audioData.rms * 12 - (audioData.beat ? 4 : 0); // Less drastic FOV change
      camera.fov += (targetFov - camera.fov) * 0.06;
      camera.updateProjectionMatrix();

      particles!.rotation.y += audioData.midEnergy * 0.0008 + 0.00015; // Slower rotation
      particles!.rotation.x += audioData.trebleEnergy * 0.0006 + 0.0001;
    },
    cleanupWebGL: (webGLAssets) => {
cleanupWebGL: (webGLAssets) => {
  if (!webGLAssets) return;

  // dispose geometry (new name first, fall back to legacy)
  (webGLAssets.particleGeometry as THREE.BufferGeometry | undefined)?.dispose?.();
  (webGLAssets.geometry         as THREE.BufferGeometry | undefined)?.dispose?.();

  // dispose material (new name first, fall back to legacy)
  (webGLAssets.particleMaterial as THREE.PointsMaterial  | undefined)?.dispose?.();
  (webGLAssets.material         as THREE.PointsMaterial  | undefined)?.dispose?.();

  // remove Points object from the scene
  if (webGLAssets.particles && webGLAssets.scene) {
    (webGLAssets.scene as THREE.Scene).remove(webGLAssets.particles as THREE.Points);
  }
},

    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
// Utility function to draw procedural vines on an overlay canvas
export function drawProceduralVines(
  ctx: CanvasRenderingContext2D,
  vines: ProceduralVine[]
) {
  if (!ctx || !vines || vines.length === 0) return;

  ctx.save();
  vines.forEach((vine) => {
    if (vine.points.length < 2 || vine.opacity <= 0.01) return;

    ctx.beginPath();
    ctx.moveTo(vine.points[0].x, vine.points[0].y);
    for (let i = 1; i < vine.points.length; i++) {
      ctx.lineTo(vine.points[i].x, vine.points[i].y);
    }

    // Ensure color string has alpha component if opacity is not 1
    let strokeColor = vine.color;
    if (vine.opacity < 1.0) {
      if (strokeColor.startsWith("hsl(")) {
        strokeColor = strokeColor
          .replace("hsl(", "hsla(")
          .replace(")", `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith("rgb(")) {
        strokeColor = strokeColor
          .replace("rgb(", "rgba(")
          .replace(")", `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith("#") && strokeColor.length === 7) {
        // hex color #RRGGBB
        const r = parseInt(strokeColor.slice(1, 3), 16);
        const g = parseInt(strokeColor.slice(3, 5), 16);
        const b = parseInt(strokeColor.slice(5, 7), 16);
        strokeColor = `rgba(${r}, ${g}, ${b}, ${vine.opacity.toFixed(2)})`;
      } else if (strokeColor.startsWith("#") && strokeColor.length === 4) {
        // short hex #RGB
        const r = parseInt(
          strokeColor.slice(1, 2) + strokeColor.slice(1, 2),
          16
        );
        const g = parseInt(
          strokeColor.slice(2, 3) + strokeColor.slice(2, 3),
          16
        );
        const b = parseInt(
          strokeColor.slice(3, 4) + strokeColor.slice(3, 4),
          16
        );
        strokeColor = `rgba(${r}, ${g}, ${b}, ${vine.opacity.toFixed(2)})`;
      }
      // Other color formats would need more sophisticated parsing or a library
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(0.5, vine.thickness);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  });
  ctx.restore();
}

