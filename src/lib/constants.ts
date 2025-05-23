
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets } from '@/types';
import * as THREE from 'three';
import * as bodyPix from '@tensorflow-models/body-pix'; // Added for BodyPix
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Palette HSL (from the branding guide)
const SBNF_HUES_SCENE = {
  black: 0, // #000000
  orangeRed: 13, // #FF441A
  orangeYellow: 36, // #FDB143
  lightPeach: 30, // #FFECDA
  lightLavender: 267, // #E1CCFF
  deepPurple: 258, // #5A36BB
  tronBlue: 197, // A common Tron-like blue
};

// Helper to convert HSL to RGB (for shader uniforms or direct color setting)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)]; // R, G, B
}

// SBNF "Cosmic Grapevines" Themed Defaults
export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: true,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false, // Default to off, user must enable
  mirrorWebcam: true, // Mirror by default when webcam is on
  currentSceneId: 'radial_burst', // Default to a more active scene
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // Default to pulse
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false, // Default AI Overlay to off initially
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF-themed default
  enablePeriodicAiOverlay: false, // Periodic updates off by default
  aiOverlayRegenerationInterval: 45, // Default interval for periodic updates
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

export const SCENES: SceneDefinition[] = [
  {
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      
      const webGLAssets: Partial<WebGLSceneAssets> & { 
        particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; 
        positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; 
        PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; 
        bgColor: THREE.Color; rotationSpeed: THREE.Vector3;
        webcamTexture?: THREE.VideoTexture;
        finaleSampleCanvas?: HTMLCanvasElement;
        finaleSampleCtx?: CanvasRenderingContext2D;
        finalePixelData?: Uint8ClampedArray;
      } = {
        scene, camera, particles, material, geometry,
        positions, colors, velocities, lifetimes, 
        PARTICLE_COUNT,
        lastBeatTime: 0,
        tempColor: new THREE.Color(), // Will be used for webcam color sampling
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        rotationSpeed: new THREE.Vector3(0.015, 0.02, 0.007), 
      };

      if (settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA) {
        webGLAssets.webcamTexture = new THREE.VideoTexture(webcamElement);
        webGLAssets.webcamTexture.minFilter = THREE.LinearFilter;
        webGLAssets.webcamTexture.magFilter = THREE.LinearFilter;

        const finaleSampleCanvas = document.createElement('canvas');
        finaleSampleCanvas.width = 64; 
        finaleSampleCanvas.height = 64;
        webGLAssets.finaleSampleCanvas = finaleSampleCanvas;
        webGLAssets.finaleSampleCtx = finaleSampleCanvas.getContext('2d', { willReadFrequently: true }) || undefined;
        if (webGLAssets.finaleSampleCtx) {
            webGLAssets.finalePixelData = webGLAssets.finaleSampleCtx.getImageData(0,0,64,64).data;
        }
      }

      return webGLAssets as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; webcamTexture?: THREE.VideoTexture; finaleSampleCanvas?: HTMLCanvasElement; finaleSampleCtx?: CanvasRenderingContext2D; finalePixelData?: Uint8ClampedArray; };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, webcamElement }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.lastFrameTime || !webGLAssets.tempColor) return; 
        const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed, webcamTexture, finaleSampleCanvas, finaleSampleCtx } = webGLAssets;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; 
        webGLAssets.lastFrameTime = currentTime;
    
        renderer.setClearColor(bgColor.getHex(), 0.08); 
        renderer.clear();

        const webcamActive = settings.showWebcam && webcamElement && webcamTexture && finaleSampleCanvas && finaleSampleCtx && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA;
        let colorsNeedUpdate = false;

        if (webcamActive) {
            webcamTexture.needsUpdate = true;
            const ctx = finaleSampleCtx;
            const canvas = finaleSampleCanvas;
            if (settings.mirrorWebcam) {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(webcamElement, -canvas.width, 0, canvas.width, canvas.height);
                ctx.restore();
            } else {
                ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);
            }
            webGLAssets.finalePixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        }
    
        const beatCooldown = 150; 
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
    
        if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawnThisBeat = Math.floor(PARTICLE_COUNT * (0.1 + audioData.bassEnergy * 0.25)); 
            particlesToSpawnThisBeat = Math.min(particlesToSpawnThisBeat, PARTICLE_COUNT * 0.25); 

            let spawnedCount = 0;
            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawnThisBeat; i++) {
                if (lifetimes[i] <= 0) { 
                    const pIdx = i * 3;
                    positions[pIdx] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 1] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 5;
    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); 
                    const speed = 150 + Math.random() * 180 + audioData.bassEnergy * 250 + audioData.rms * 120; 
                    velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [audioR, audioG, audioB] = hslToRgb(hue, 90 + Math.random() * 10, 50 + Math.random() * 20); 
                    let finalR = audioR, finalG = audioG, finalB = audioB;

                    if (webcamActive && webGLAssets.finalePixelData && finaleSampleCanvas) {
                        const randX = Math.floor(Math.random() * finaleSampleCanvas.width);
                        const randY = Math.floor(Math.random() * finaleSampleCanvas.height);
                        const pixelIndex = (randY * finaleSampleCanvas.width + randX) * 4;
                        const r_cam = webGLAssets.finalePixelData[pixelIndex] / 255;
                        const g_cam = webGLAssets.finalePixelData[pixelIndex + 1] / 255;
                        const b_cam = webGLAssets.finalePixelData[pixelIndex + 2] / 255;
                        finalR = (audioR + r_cam) / 2.0;
                        finalG = (audioG + g_cam) / 2.0;
                        finalB = (audioB + b_cam) / 2.0;
                    }
                    colors[pIdx] = finalR; colors[pIdx + 1] = finalG; colors[pIdx + 2] = finalB;
                    colorsNeedUpdate = true;
    
                    lifetimes[i] = 1.2 + Math.random() * 1.3; 
                    spawnedCount++;
                }
            }
        }
    
        const dragFactor = 0.96; 
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3;
                lifetimes[i] -= deltaTime;
                if (lifetimes[i] <= 0) {
                    positions[pIdx] = 10000; 
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
                    colorsNeedUpdate = true;
                    continue;
                }
    
                velocities[pIdx] *= dragFactor; 
                velocities[pIdx + 1] *= dragFactor; 
                velocities[pIdx + 2] *= dragFactor;
    
                positions[pIdx] += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;
                
                const lifeRatio = Math.max(0, lifetimes[i] / (1.2 + Math.random() * 1.3)); 
                colors[pIdx] *= lifeRatio; 
                colors[pIdx+1] *= lifeRatio; 
                colors[pIdx+2] *= lifeRatio;
                colorsNeedUpdate = true;
            }
        }
    
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (colorsNeedUpdate && geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
    
        material.size = (1.5 + audioData.rms * 3.0) * Math.max(0.1, settings.brightCap); 
        material.opacity = Math.max(0.1, settings.brightCap * (0.3 + audioData.rms * 0.5)); 

        if (particles && rotationSpeed) {
            particles.rotation.x += rotationSpeed.x * deltaTime * (0.3 + audioData.midEnergy * 0.7);
            particles.rotation.y += rotationSpeed.y * deltaTime * (0.3 + audioData.trebleEnergy * 0.7);
        }
        if(camera) camera.position.z = 400 + audioData.rms * 200; 
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) webGLAssets.geometry.dispose();
            if (webGLAssets.material) webGLAssets.material.dispose();
            if (webGLAssets.webcamTexture) webGLAssets.webcamTexture.dispose();
            // finaleSampleCanvas and finalePixelData are managed by JS garbage collection
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
