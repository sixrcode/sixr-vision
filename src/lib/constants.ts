
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: true,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false,
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // SBNF default
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
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent",
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

// SBNF Palette HSL (from the branding guide)
const SBNF_HUES_SCENE = {
  black: 0,
  orangeRed: 13,
  orangeYellow: 36,
  lightPeach: 30,
  lightLavender: 267,
  deepPurple: 258,
  tronBlue: 197,
};

// Helper to convert HSL to RGB (for shader uniforms)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)]; // R, G, B
}


export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(
        canvas.width / -2, canvas.width / 2,
        canvas.height / 2, canvas.height / -2,
        1, 1000
      );
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); // Transparent clear color

      let videoTexture: THREE.VideoTexture | null = null;
      let planeMesh: THREE.Mesh | null = null;
      let shaderMaterial: THREE.ShaderMaterial | null = null;

      if (webcamElement && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        
        shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColorVec3: { value: new THREE.Color(0xffffff) },
            opacityFactor: { value: 1.0 },
            mirrorX_bool: { value: false },
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
            uniform vec3 dynamicColorVec3;
            uniform float opacityFactor;
            varying vec2 vUv;

            void main() {
              vec4 texColor = texture2D(webcamTexture, vUv);
              if (texColor.a < 0.1) discard; // Basic alpha check

              vec3 diff = abs(texColor.rgb - dynamicColorVec3);
              // Apply gamma correction and brightness cap (opacityFactor)
              float gamma = ${settings.gamma.toFixed(2)};
              vec3 correctedDiff = pow(diff, vec3(1.0/gamma));
              
              gl_FragColor = vec4(correctedDiff, texColor.a * opacityFactor);
            }
          `,
          transparent: true,
        });

        planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
      } else {
         // Fallback: clear to a themed background color if webcam not ready
        const bgColorArray = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 8); // Darker background
        renderer.setClearColor(new THREE.Color(bgColorArray[0], bgColorArray[1], bgColorArray[2]), 1);
      }
      
      return { renderer, scene, camera, videoTexture, planeMesh, shaderMaterial };
    },
    drawWebGL: ({ scene, camera, audioData, settings, webGLAssets, webcamElement }) => {
      if (!webGLAssets || !webGLAssets.shaderMaterial || !webGLAssets.planeMesh) {
        // If webcam wasn't ready at init, or some other issue, ensure we clear to avoid stale frames
        if (webGLAssets.renderer) {
            const bgColorArray = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 8);
            webGLAssets.renderer.setClearColor(new THREE.Color(bgColorArray[0], bgColorArray[1], bgColorArray[2]), 1);
            webGLAssets.renderer.clear();
        }
        return;
      }

      const { videoTexture, planeMesh, shaderMaterial } = webGLAssets;

      if (settings.showWebcam && videoTexture && webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0) {
        videoTexture.needsUpdate = true;
        planeMesh.visible = true;
      } else {
        planeMesh.visible = false;
         // Fallback: clear to a themed background color if webcam becomes unavailable
        const bgColorArray = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 8);
        webGLAssets.renderer.setClearColor(new THREE.Color(bgColorArray[0], bgColorArray[1], bgColorArray[2]), 1);
        webGLAssets.renderer.clear(); // Clear the scene
        return; // Don't render the plane if no webcam
      }

      const baseAccentHue = SBNF_HUES_SCENE.orangeYellow;
      const energyColorHue = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now() / 80) % 360;
      const [r, g, b] = hslToRgb(energyColorHue, 90, 70);
      shaderMaterial.uniforms.dynamicColorVec3.value.setRGB(r, g, b);

      const opacity = Math.min(1.0, (0.85 + audioData.rms * 0.15) * settings.brightCap);
      shaderMaterial.uniforms.opacityFactor.value = opacity;
      shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
      
      // Ensure renderer clear color is transparent if the plane is visible
      webGLAssets.renderer.setClearColor(0x000000, 0); 

    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
        if (webGLAssets.planeMesh && webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
        if (webGLAssets.scene && webGLAssets.planeMesh) webGLAssets.scene.remove(webGLAssets.planeMesh);
      }
    },
  },
  // ... other scenes remain the same for now ...
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.12;
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 8);
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha * 0.8})`; 
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.01) { 
        const numShapes = 3 + Math.floor(audioData.rms * 25 + audioData.bassEnergy * 20 + audioData.midEnergy * 15); 
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (5 + audioData.bassEnergy * 150 + Math.random() * 60);
          const size = Math.max(3, sizeBase * settings.brightCap * (0.2 + audioData.midEnergy * 0.8));
          const x = Math.random() * width;
          const y = Math.random() * height;
          
          const hueOptions = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.deepPurple];
          const hueShift = (audioData.beat ? 45 : 0) + (performance.now() / 60) + (audioData.trebleEnergy * 90);
          const hue = (hueOptions[i % hueOptions.length] + hueShift) % 360;
          
          const alpha = (0.25 + audioData.trebleEnergy * 0.7 + audioData.rms * 0.6) * settings.brightCap;
          const lightness = 60 + Math.random() * 15 + audioData.rms * 20 + (audioData.beat ? 10 : 0);
          const saturation = 85 + Math.random() * 15;

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${Math.min(90, lightness)}%, ${Math.min(0.9, alpha * 1.5)})`;
          
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((performance.now() / (600 - audioData.bpm * 2.0) + i * 0.7) * (audioData.midEnergy * 1.0 + 0.2));
          
          const shapeType = (i + Math.floor(performance.now()/1000)) % 3; 
          if (shapeType === 0) { ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); }
          else if (shapeType === 1) { ctx.fillRect(-size / 2, -size / 2, size, size); }
          else { ctx.beginPath(); ctx.moveTo(0, -size / 1.7); ctx.lineTo(size / 2 * 0.9, size / 3.4); ctx.lineTo(-size / 2 * 0.9, size / 3.4); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
    },
  },
   {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Rings&font=poppins',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.48; 
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.22 : 0.18;
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 6);
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha})`; 
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
      const numSteps = 5 + Math.floor(audioData.rms * 25);

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.005) continue;

        for (let j = 0; j < numSteps; j++) {
          const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
          const time = performance.now() / (500 / (speedFactor * 0.5 + 0.5)); 
          const ringProgress = (time + j * (0.55 / numSteps) * (i + 1.1)) % 1;
          const radius = ringProgress * maxRingRadius * (0.1 + energy * 0.9);
          if (radius < 1.0) continue;

          const alpha = (1 - ringProgress) * energy * settings.brightCap * 4.0 * (0.5 + audioData.rms * 0.5); 
          if (alpha <= 0.005) continue;
          
          const baseThickness = 1.5 + energy * 35 + (audioData.beat ? 10.0 : 0);
          const thickness = Math.max(1.0, baseThickness * settings.brightCap * (0.5 + audioData.rms * 0.5));
          
          const spectrumValue = audioData.spectrum[(i * 10 + j * 2) % audioData.spectrum.length] / 255;
          const hue = (baseHues[i] + ringProgress * 70 + spectrumValue * 80 + (audioData.beat ? 40 : 0) + performance.now()/200) % 360;
          const saturation = 90 + energy * 10;
          const lightness = 65 + energy * 25 + (audioData.beat ? 10 : 0);

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${hue}, ${Math.min(100, saturation)}%, ${Math.min(95, lightness)}%, ${Math.min(1, alpha)})`;
          ctx.lineWidth = thickness;
          ctx.stroke();
        }
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', 
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.33 : 0.28;
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 5);
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha})`; 
      ctx.fillRect(0, 0, width, height);

      const gridSize = 5 + Math.floor(audioData.rms * 22 + audioData.midEnergy * 10); 
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.2; 

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j + Math.floor(performance.now()/500)) % audioData.spectrum.length; 
          const energy = audioData.spectrum[spectrumIndex] / 255;
          const beatFactor = audioData.beat ? 2.8 : 1.0; 
          const maxRadius = maxRadiusBase * beatFactor;
          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;
          
          const radius = maxRadius * energy * settings.brightCap * (0.1 + audioData.rms * 0.9 + audioData.bassEnergy * 0.6);
          if (radius < 1.0) continue;

          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
          const baseHue = hueOptions[(i * gridSize + j + Math.floor(performance.now() / 300)) % hueOptions.length];
          const hue = (baseHue + energy * 90 + (audioData.beat ? 50 : 0) + audioData.trebleEnergy * 60) % 360;
          const lightness = 50 + energy * 35 + (audioData.beat ? 10 : 0);
          const alpha = 0.3 + energy * 0.7;
          const effectiveAlpha = alpha * settings.brightCap * 1.3;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 8 + energy * 15, 0, Math.PI * 2); 
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 30}%, ${effectiveAlpha * 0.5})`;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${Math.min(90, lightness)}%, ${Math.min(1, effectiveAlpha)})`;
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF Colors
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); // Using SBNF Deep Purple
      ctx.fillStyle = `rgb(${bgR*255}, ${bgG*255}, ${bgB*255})`;
      ctx.fillRect(0, 0, width, height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);

      if (isAudioSilent) {
        const [fgR, fgG, fgB] = hslToRgb(SBNF_HUES_SCENE.lightPeach, 100, 70); // Muted version of Light Peach
        ctx.fillStyle = `rgb(${fgR*255}, ${fgG*255}, ${fgB*255})`;
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        const [barSR, barSG, barSB] = hslToRgb(SBNF_HUES_SCENE.lightPeach, 100, 93);
        ctx.strokeStyle = `rgba(${barSR*255}, ${barSG*255}, ${barSB*255}, 0.2)`;
        ctx.lineWidth = 1;
        for (let k = 0; k < audioData.spectrum.length; k++) {
          ctx.strokeRect(k * barWidth, height - (height * 0.05), barWidth - 1, (height * 0.05));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const hueCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
      
      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeightBase = normalizedValue * height * effectiveBrightCap * 1.4; 
        const barHeight = Math.max(0.5, barHeightBase * (0.5 + audioData.rms * 0.5 + (audioData.beat ? 0.2 : 0) ) ); 
        
        const hueIndex = Math.floor((i / audioData.spectrum.length) * hueCycle.length);
        const baseHue = hueCycle[hueIndex % hueCycle.length];
        const hue = (baseHue + normalizedValue * 60 + (audioData.beat ? 35 : 0) + performance.now() / 80) % 360; 
        const saturation = 85 + normalizedValue * 20; // Increased saturation reactiveness
        const lightness = 50 + normalizedValue * 40 + (settings.gamma - 1) * 25 + (audioData.beat ? 10 : 0); // Beat makes it brighter
        
        ctx.fillStyle = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(90, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.25, barHeight); 

        if (normalizedValue > 0.20) { 
          ctx.fillStyle = `hsla(${(hue + 40) % 360}, ${Math.min(100, saturation + 15)}%, ${Math.min(95, lightness + 45)}%, 0.85)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.05, barWidth - 0.25, barHeight * 0.30); 
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Colors
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.22 : 0.17; 
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      const sbnfHuesCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];

      if (isAudioSilent) {
        const [fgR, fgG, fgB] = hslToRgb(SBNF_HUES_SCENE.lightPeach, 100, 70);
        ctx.fillStyle = `rgb(${fgR*255}, ${fgG*255}, ${fgB*255})`;
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 12;
        const [cirR, cirG, cirB] = hslToRgb(SBNF_HUES_SCENE.lightPeach, 100, 93);
        ctx.strokeStyle = `rgba(${cirR*255}, ${cirG*255}, ${cirB*255}, 0.12)`;
        ctx.lineWidth = 0.75;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.015) + (i * Math.min(width, height) * 0.035);
          ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 80 + Math.floor(audioData.rms * 220 + audioData.trebleEnergy * 50); 
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2000) * (i % 2 === 0 ? 1.3 : -1.3); 
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.07 + audioData.midEnergy * 0.38 + audioData.bassEnergy * 0.1);
        const currentRadius = maxRadius * (0.08 + energy * 0.92); 
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.5 + energy * 6.0 + audioData.rms * 2.0) * settings.brightCap; 
        const hue = (sbnfHuesCycle[i % sbnfHuesCycle.length] + energy * 70 + (audioData.beat ? 40 : 0) + performance.now() / 70) % 360; 
        ctx.fillStyle = `hsla(${hue}, ${90 + energy * 10}%, ${60 + energy * 30 + (audioData.beat ? 5:0)}%, ${0.35 + energy * 0.65 + audioData.rms * 0.2})`;
        ctx.beginPath(); ctx.arc(x, y, particleSize, 0, Math.PI * 2); ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 200 + Math.floor(audioData.rms * 450 + audioData.bassEnergy * 400); 
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 1.0) + (audioData.bassEnergy * Math.min(width, height) * 0.5); 
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.5); 
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.5);
          const size = (2.5 + Math.random() * 15 * (audioData.rms + audioData.bassEnergy * 1.2)) * settings.brightCap; 
          const baseHue = sbnfHuesCycle[(i + Math.floor(audioData.bassEnergy * 20)) % sbnfHuesCycle.length];
          const hue = (baseHue + (Math.random() * 70 - 35) + audioData.trebleEnergy * 30) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${70 + audioData.trebleEnergy * 20}%, ${0.75 + audioData.midEnergy * 0.25})`; 
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Colors
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now() / 25) % 360; 
        const lightness = 85 + Math.random() * 15; 
        ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, settings.brightCap * 1.3)})`; 
        ctx.fillRect(0, 0, width, height);
      } else {
        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
        ctx.fillStyle = `rgb(${bgR*255}, ${bgG*255}, ${bgB*255})`;
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', // SBNF Colors
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); 

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 60; 

      const PARTICLE_COUNT = 100000; // Increased particle count
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); 
      const sbnfHuesForFinale = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.deepPurple];
      const color = new THREE.Color();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 0.2;
        positions[i3 + 1] = (Math.random() - 0.5) * 0.2;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.2;

        velocities[i3] = (Math.random() - 0.5) * 0.15;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.15;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.15;
        
        color.setHSL(sbnfHuesForFinale[i % sbnfHuesForFinale.length] / 360, 0.9 + Math.random()*0.1, 0.55 + Math.random() * 0.15);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 1.8, // Slightly larger base size
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending, 
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);
      
      const webGLAssets: WebGLSceneAssets = {
        renderer, scene, camera, particles, particleMaterial, particleGeometry, 
        sbnfHues: sbnfHuesForFinale, velocities, 
        lastBeatTime: 0, lastFrameTime: performance.now()
      };
      return webGLAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.velocities || !webGLAssets.particleGeometry || !webGLAssets.sbnfHues) return;

      const { particles, particleMaterial, particleGeometry, sbnfHues, velocities } = webGLAssets;
      const positions = particleGeometry.attributes.position.array as Float32Array;
      const colorsAttribute = particleGeometry.attributes.color.array as Float32Array;
      const PARTICLE_COUNT = positions.length / 3;

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0; 
      webGLAssets.lastFrameTime = currentTime;

      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      particleMaterial.opacity = Math.min(0.95, effectiveBrightCap * 0.9 * (0.45 + audioData.rms * 0.55));
      particleMaterial.size = Math.max(0.2, (0.3 + effectiveBrightCap * (audioData.rms * 4.5 + audioData.bassEnergy * 4.0 + audioData.trebleEnergy * 2.0)));

      const color = new THREE.Color();
      const dragFactor = 0.95; 
      const positionResetThreshold = 130; 
      const movementMultiplier = 40; 
      const gravityToCenter = 0.04 + audioData.midEnergy * 0.18; 
      const beatRefractoryPeriod = 40; 

      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
        webGLAssets.lastBeatTime = currentTime;
        const burstStrength = 20.0 + audioData.bassEnergy * 40.0 + audioData.rms * 35.0;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          positions[i3] = (Math.random() - 0.5) * 0.8; 
          positions[i3 + 1] = (Math.random() - 0.5) * 0.8;
          positions[i3 + 2] = (Math.random() - 0.5) * 0.8;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1); 
          const speed = Math.random() * burstStrength;

          velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
          velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
          velocities[i3 + 2] = speed * Math.cos(phi);

          const burstHueIndex = (i + Math.floor(currentTime / 15)) % sbnfHues.length;
          const hueLightness = 0.75 + Math.random() * 0.2 + audioData.trebleEnergy * 0.15;
          color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.98, hueLightness) );
          colorsAttribute[i3] = color.r;
          colorsAttribute[i3 + 1] = color.g;
          colorsAttribute[i3 + 2] = color.b;
        }
        particleGeometry.attributes.color.needsUpdate = true;
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const dx = -positions[i3];
        const dy = -positions[i3 + 1];
        const dz = -positions[i3 + 2];
        const distSqToCenter = dx * dx + dy * dy + dz * dz;
        
        if (distSqToCenter > 0.01) { 
            const distToCenter = Math.sqrt(distSqToCenter);
            const attractionForce = gravityToCenter / (distSqToCenter * 0.025 + 0.025); 
            velocities[i3] += (dx / distToCenter) * attractionForce * deltaTime;
            velocities[i3 + 1] += (dy / distToCenter) * attractionForce * deltaTime;
            velocities[i3 + 2] += (dz / distToCenter) * attractionForce * deltaTime;
        }

        positions[i3] += velocities[i3] * deltaTime * movementMultiplier;
        positions[i3 + 1] += velocities[i3 + 1] * deltaTime * movementMultiplier;
        positions[i3 + 2] += velocities[i3 + 2] * deltaTime * movementMultiplier;

        velocities[i3] *= dragFactor;
        velocities[i3 + 1] *= dragFactor;
        velocities[i3 + 2] *= dragFactor;

        const distSqFromOrigin = positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2;
        const speedSq = velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2;

        if (distSqFromOrigin > positionResetThreshold * positionResetThreshold || (speedSq < 0.00005 && distSqFromOrigin > 15)) {
            positions[i3] = (Math.random() - 0.5) * 0.05;
            positions[i3 + 1] = (Math.random() - 0.5) * 0.05;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.05;
            velocities[i3] = (Math.random() - 0.5) * 0.3; 
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y += 0.0012 * (1 + audioData.trebleEnergy * 4.5);
      particles.rotation.x += 0.0008 * (1 + audioData.midEnergy * 4.5);
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
        if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        if (webGLAssets.scene && webGLAssets.particles) {
          webGLAssets.scene.remove(webGLAssets.particles);
        }
        webGLAssets.velocities = null;
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins', // SBNF Colors
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR,bgG,bgB), 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 10; 

      const numSegments = 25; 
      const segmentSpacing = 8; 
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      
      const geometry = new THREE.TorusGeometry(12, 0.15, 8, 50); 
      const tronBlueHSL = SBNF_HUES_SCENE.tronBlue;

      for (let i = 0; i < numSegments; i++) {
        const [r,g,bVal] = hslToRgb(tronBlueHSL, 100, 60);
        const material = new THREE.MeshBasicMaterial({ 
          wireframe: true,
          color: new THREE.Color(r,g,bVal)
        }); 
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = -i * segmentSpacing;
        segment.rotation.x = Math.PI / 2; 
        scene.add(segment);
        segments.push(segment);
      }
      
      return { renderer, scene, camera, segments, tunnelLength, segmentSpacing, lastFrameTime: performance.now(), sbnfHues: [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender] };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.segments || !webGLAssets.sbnfHues) return;

      const { segments, tunnelLength, segmentSpacing, sbnfHues } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      const travelSpeedBase = 15;
      const travelSpeed = (travelSpeedBase + audioData.rms * 40 + audioData.bpm * 0.15) * deltaTime;
      camera.position.z -= travelSpeed;

      const color = new THREE.Color();

      segments.forEach((segment, i) => {
        if (segment.position.z > camera.position.z + segmentSpacing * 2) { 
          segment.position.z -= tunnelLength;
        }

        const scaleFactorBase = 0.9 + Math.sin(currentTime * 0.0015 + i * 0.6) * 0.15;
        const scaleFactorAudio = audioData.bassEnergy * 0.6 + (audioData.beat ? 0.35 : 0);
        segment.scale.setScalar(Math.max(0.5, scaleFactorBase + scaleFactorAudio * settings.brightCap));

        const hueIndex = Math.floor( (i + currentTime * 0.0001 * (50 + audioData.midEnergy * 100) ) % sbnfHues.length);
        const baseHue = sbnfHues[hueIndex];
        const hue = (baseHue + audioData.trebleEnergy * 120) % 360;
        const lightness = 0.5 + audioData.rms * 0.4 + (audioData.beat ? 0.2 : 0) + settings.brightCap * 0.1;
        
        const [r,g,bVal] = hslToRgb(hue, 90, Math.min(0.85, lightness));
        color.setRGB(r,g,bVal);
        
        if (segment.material instanceof THREE.MeshBasicMaterial) {
            segment.material.color = color;
            segment.material.opacity = Math.min(1, 0.6 + audioData.rms * 0.4 + settings.brightCap * 0.2); 
            segment.material.transparent = true;
        }
        
        segment.rotation.z += (audioData.trebleEnergy * 0.015 + 0.0005 + audioData.bpm * 0.00001) * (i % 2 === 0 ? 1 : -1.2);
      });

      camera.fov = 70 - audioData.rms * 25 * settings.gamma; 
      camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.segments && webGLAssets.scene) {
        webGLAssets.segments.forEach((segment: THREE.Mesh) => {
          if (segment.geometry) segment.geometry.dispose();
          if (segment.material) (segment.material as THREE.Material).dispose();
          webGLAssets.scene.remove(segment);
        });
        webGLAssets.segments = [];
      }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
