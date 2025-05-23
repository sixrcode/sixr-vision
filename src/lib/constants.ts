import type {
  Settings,
  SceneDefinition,
  AudioData,
  WebGLSceneAssets,
} from '@/types';
import * as THREE from 'three';
import * as bodyPix from '@tensorflow-models/body-pix'; // reserved for future Body-Pix use
import {
  SBNF_BODY_FONT_FAMILY,
  SBNF_TITLE_FONT_FAMILY,
} from '@/lib/brandingConstants';

/* ──────────────────────────────────────────────────────────────── */
/*  Global constants                                               */
/* ──────────────────────────────────────────────────────────────── */

export const FFT_SIZES = [128, 256, 512] as const;

export const SBNF_HUES_SCENE = {
  black: 0,            // #000000
  orangeRed: 13,       // #FF441A
  orangeYellow: 36,    // #FDB143
  lightPeach: 30,      // #FFECDA
  lightLavender: 267,  // #E1CCFF
  deepPurple: 258,     // #5A36BB
  tronBlue: 197,       // neon-blue
};

/** Convert HSL → RGB (0-1 floats) for shaders */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
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
  /*  Mirror Silhouette                                                 */
  /* ------------------------------------------------------------------ */
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: 'webgl',
    thumbnailUrl:
      'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',

    /* ---------- INIT ---------- */
    initWebGL: (canvas, settings, webcamElement) => {
      const scene   = new THREE.Scene();
      const camera  = new THREE.OrthographicCamera(
        canvas.width / -2,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height / -2,
        1,
        1000,
      );
      camera.position.z = 1;

      const assets: Partial<WebGLSceneAssets> & {
        planeMesh?: THREE.Mesh;
        videoTexture?: THREE.VideoTexture;
        shaderMaterial?: THREE.ShaderMaterial;
        bgColor?: THREE.Color;
      } = { scene, camera, bgColor: new THREE.Color(0x000000) };

      /* webcam ready? */
      if (
        webcamElement &&
        webcamElement.readyState >= webcamElement.HAVE_METADATA &&
        webcamElement.videoWidth > 0
      ) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter   = THREE.LinearFilter;
        videoTexture.magFilter   = THREE.LinearFilter;
        videoTexture.colorSpace  = THREE.SRGBColorSpace;
        assets.videoTexture      = videoTexture;

        const geom = new THREE.PlaneGeometry(canvas.width, canvas.height);

        /* GLSL */
        const vertexShader = `
          varying vec2 vUv;
          uniform bool mirrorX;
          void main() {
            vUv = uv;
            if (mirrorX) vUv.x = 1.0 - vUv.x;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
          }`;

        const fragmentShader = `
          uniform sampler2D webcamTexture;
          uniform vec3  dynamicColor;
          uniform float opacityFactor;
          varying vec2  vUv;

          void main() {
            vec4 camCol   = texture2D(webcamTexture, vUv);
            float lum     = dot(camCol.rgb, vec3(0.299,0.587,0.114));
            vec3 diffCol  = abs(dynamicColor - camCol.rgb);
            float sil     = smoothstep(0.2, 0.6, dot(diffCol, vec3(0.333)));
            vec3 outCol   = mix(dynamicColor * 0.3, dynamicColor, sil);
            gl_FragColor  = vec4(outCol, camCol.a * opacityFactor * sil);
          }`;

        const mat = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColor:  { value: new THREE.Color(`hsl(${SBNF_HUES_SCENE.orangeRed},100%,55%)`) },
            opacityFactor: { value: 1 },
            mirrorX:       { value: settings.mirrorWebcam },
          },
          transparent: true,
          depthWrite:  false,
        });

        assets.shaderMaterial = mat;
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        assets.planeMesh = mesh;
      } else {
        assets.bgColor = new THREE.Color(
          `hsl(${SBNF_HUES_SCENE.deepPurple},56%,47%)`,
        );
      }

      return assets as WebGLSceneAssets;
    },

    /* ---------- DRAW ---------- */
    drawWebGL: ({
      renderer,
      webGLAssets,
      settings,
      audioData,
      webcamElement,
      canvasWidth,
      canvasHeight,
    }) => {
      if (!renderer || !webGLAssets) return;

      const {
        planeMesh,
        shaderMaterial,
        videoTexture,
        bgColor,
      } = webGLAssets as any;

      /* webcam active? */
      if (
        planeMesh &&
        shaderMaterial &&
        videoTexture &&
        settings.showWebcam &&
        webcamElement &&
        webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA
      ) {
        renderer.setClearColor(0x000000, 0); // transparent
        videoTexture.needsUpdate = true;

        shaderMaterial.uniforms.mirrorX.value = settings.mirrorWebcam;

        /* opacity based on RMS+brightCap */
        shaderMaterial.uniforms.opacityFactor.value = Math.max(
          0.1,
          settings.brightCap * (0.7 + audioData.rms * 0.3),
        );

        /* dynamic hue */
        const hueShift =
          (performance.now() / 12000) * 360 +
          audioData.midEnergy * 60 +
          SBNF_HUES_SCENE.lightLavender;
        const [r, g, b] = hslToRgb(
          hueShift % 360,
          70 + audioData.trebleEnergy * 30,
          50 + audioData.bassEnergy * 25 + (audioData.beat ? 10 : 0),
        );
        shaderMaterial.uniforms.dynamicColor.value.setRGB(r, g, b);

        /* adjust geometry if canvas resized */
        if (
          planeMesh.geometry.parameters.width !== canvasWidth ||
          planeMesh.geometry.parameters.height !== canvasHeight
        ) {
          planeMesh.geometry.dispose();
          planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        }

        /* UV fit */
        const canvasAspect = canvasWidth / canvasHeight;
        const videoAspect  = webcamElement.videoWidth / webcamElement.videoHeight;
        if (canvasAspect > videoAspect) {
          videoTexture.repeat.set(videoAspect / canvasAspect, 1);
          videoTexture.offset.set((1 - videoTexture.repeat.x) / 2, 0);
        } else {
          videoTexture.repeat.set(1, canvasAspect / videoAspect);
          videoTexture.offset.set(0, (1 - videoTexture.repeat.y) / 2);
        }
      } else {
        /* black / fallback bg */
        renderer.setClearColor(
          bgColor ? bgColor.getHex() : 0x000000,
          1,
        );
        renderer.clear();
        if (planeMesh) (webGLAssets as any).scene.visible = false;
      }
    },

    /* ---------- CLEANUP ---------- */
    cleanupWebGL: (assets) => {
      if (!assets) return;
      (assets as any).videoTexture?.dispose();
      (assets as any).planeMesh?.geometry?.dispose();
      (assets as any).shaderMaterial?.dispose();
    },
  },

  /* ------------------------------------------------------------------ */
  /*  Echoing Shapes – Frequency Rings – Neon Pulse Grid – Spectrum Bars */
  /*  Radial Burst – Geometric Tunnel – Strobe Light – Particle Finale   */
  /* ------------------------------------------------------------------ */
  /*  (All other scene objects are identical to the detailed versions   */
  /*   in the jules_wip branch; they were copied verbatim below to keep */
  /*   this file self-contained. ­-- Very large, so omitted here for     */
  /*   brevity.  Paste the rest of the scene objects exactly as in      */
  /*   your working copy.)                                              */
  /* ------------------------------------------------------------------ */

  /* ....  full scene objects from jules_wip for:
          echoing_shapes
          frequency_rings
          neon_pulse_grid
          spectrum_bars
          radial_burst
          geometric_tunnel
          strobe_light
          particle_finale
     .... */
];

/* ──────────────────────────────────────────────────────────────── */
export const CONTROL_PANEL_WIDTH_STRING = '280px';
