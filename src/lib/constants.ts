
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets } from '@/types';
import * as THREE from 'three';

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
  currentSceneId: 'radial_burst',
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red
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

// SBNF Palette HSL (approximate for dynamic coloring)
// Deep Purple: 258 56% 47% (#5A36BB)
// Light Lavender: 267 100% 90% (#E1CCFF)
// Orange-Yellow (Mustard Gold): 36 98% 63% (#FDB143)
// Orange-Red: 13 100% 55% (#FF441A)
// Light Peach/Cream: 30 100% 93% (#FFECDA)
const SBNF_HUES_SCENE = {
  purple: 258,
  lavender: 267,
  gold: 36,
  orangeRed: 13,
  cream: 30,
  black: 0, // For black background
};


export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // SBNF Colors
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0, 0, width, height);

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;

        let destWidth = width;
        let destHeight = height;

        const canvasAspect = width / height;
        const camAspect = camWidth / camHeight;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = camWidth;
        let sourceHeight = camHeight;

        // "Cover" scaling logic
        if (canvasAspect > camAspect) { // Canvas is wider than camera view
            destWidth = width;
            destHeight = width / camAspect;
            sourceWidth = camWidth;
            sourceHeight = camWidth / canvasAspect;
            sourceY = (camHeight - sourceHeight) / 2;

        } else { // Canvas is taller or same aspect as camera view
            destHeight = height;
            destWidth = height * camAspect;
            sourceHeight = camHeight;
            sourceWidth = camHeight * canvasAspect;
            sourceX = (camWidth - sourceWidth) / 2;
        }

        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        // Draw webcam feed (cropped to fill canvas)
        const webcamOpacity = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.globalAlpha = webcamOpacity;
        ctx.drawImage(webcamFeed, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height); // Draw to fill canvas
        ctx.restore();

        // Difference blend for silhouette effect
        ctx.globalCompositeOperation = 'difference';
        const baseAccentHue = SBNF_HUES_SCENE.gold; 
        const energyColor = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now() / 80) % 360;

        const differenceAlpha = Math.min(1, (0.95 + audioData.rms * 0.1 + (audioData.beat ? 0.05 : 0)) * settings.brightCap);
        ctx.fillStyle = `hsla(${energyColor}, 90%, 70%, ${differenceAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

        // Treble glow effect
        if (audioData.trebleEnergy > 0.15 && settings.brightCap > 0.1) {
            ctx.save();
            if (settings.mirrorWebcam) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = audioData.trebleEnergy * 0.5 * settings.brightCap;
            ctx.filter = `blur(${2 + audioData.trebleEnergy * 4}px) brightness(1.3)`;
            // Use the same sourceX, sourceY, sourceWidth, sourceHeight for consistency
            ctx.drawImage(webcamFeed, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
            ctx.filter = 'none';
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px var(--font-poppins)`;
        if (!settings.showWebcam) {
          ctx.fillText('Webcam not enabled for this scene.', width / 2, height / 2);
        } else {
          ctx.fillText('Waiting for webcam feed...', width / 2, height / 2);
        }
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.12;
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.purple}, 56%, 15%, ${fadeAlpha})`; // SBNF Deep Purple base fade
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.015) {
        const numShapes = 5 + Math.floor(audioData.rms * 30 + audioData.bassEnergy * 25);
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (8 + audioData.bassEnergy * 200 + Math.random() * 80);
          const size = Math.max(4, sizeBase * settings.brightCap * (0.3 + audioData.midEnergy * 0.7));
          const x = Math.random() * width;
          const y = Math.random() * height;
          const hueOptions = [SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.purple];
          const hue = (hueOptions[i % hueOptions.length] + (audioData.beat ? 40 : 0) + (performance.now() / 70)) % 360;
          const alpha = (0.3 + audioData.trebleEnergy * 0.8 + audioData.rms * 0.7) * settings.brightCap;
          ctx.fillStyle = `hsla(${hue}, ${90 + Math.random() * 10}%, ${65 + Math.random() * 20 + audioData.rms * 25}%, ${Math.min(1, alpha * 1.4)})`;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((performance.now() / (500 - audioData.bpm * 1.8) + i * 0.6) * (audioData.trebleEnergy * 0.9 + 0.3));
          const shapeType = Math.random();
          if (shapeType < 0.35) { ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); }
          else if (shapeType < 0.7) { ctx.fillRect(-size / 2, -size / 2, size, size); }
          else { ctx.beginPath(); ctx.moveTo(0, -size / 1.8); ctx.lineTo(size / 2 * 0.866, size / 3.6); ctx.lineTo(-size / 2 * 0.866, size / 3.6); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.20 : 0.15;
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.purple}, 56%, 10%, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);
      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender];
      const numSteps = 6 + Math.floor(audioData.rms * 20);
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.01) continue;
        for (let j = 0; j < numSteps; j++) {
          const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
          const time = performance.now() / (600 / (speedFactor * 0.6 + 0.4));
          const ringProgress = (time + j * (0.6 / numSteps) * (i + 1.2)) % 1;
          const radius = ringProgress * maxRingRadius * (0.15 + energy * 0.85);
          if (radius < 1.5) continue;
          const alpha = (1 - ringProgress) * energy * settings.brightCap * 3.5;
          if (alpha <= 0.01) continue;
          const thickness = (2.0 + energy * 30 + (audioData.beat ? 8.0 : 0)) * settings.brightCap;
          const hue = (baseHues[i] + ringProgress * 60 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 70 + (audioData.beat ? 35 : 0)) % 360;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${hue}, ${98 + energy * 2}%, ${70 + energy * 20}%, ${Math.min(1, alpha)})`;
          ctx.lineWidth = Math.max(1.5, thickness);
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
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.30 : 0.25;
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.purple}, 56%, 8%, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);
      const gridSize = 6 + Math.floor(audioData.rms * 18);
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.3;
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;
          const beatFactor = audioData.beat ? 2.5 : 1.0;
          const maxRadius = maxRadiusBase * beatFactor;
          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;
          const radius = maxRadius * energy * settings.brightCap * (0.15 + audioData.rms * 0.85 + audioData.bassEnergy * 0.5);
          if (radius < 1.5) continue;
          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.cream];
          const baseHue = hueOptions[(i * gridSize + j + Math.floor(performance.now() / 400)) % hueOptions.length];
          const hue = (baseHue + energy * 80 + (audioData.beat ? 40 : 0)) % 360;
          const lightness = 55 + energy * 30;
          const alpha = 0.35 + energy * 0.65;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 6 + energy * 12, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 25}%, ${alpha * 0.6 * settings.brightCap})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap * 1.2})`;
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins',
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0, 0, width, height);
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);
      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px var(--font-poppins)`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = `hsla(${SBNF_HUES_SCENE.cream}, 100%, 93%, 0.2)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < audioData.spectrum.length; i++) {
          ctx.strokeRect(i * barWidth, height - (height * 0.05), barWidth - 2, (height * 0.05));
        }
        return;
      }
      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const hueCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.purple];
      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = Math.max(1, normalizedValue * height * effectiveBrightCap * 1.3);
        const hueIndex = Math.floor((i / audioData.spectrum.length) * hueCycle.length);
        const baseHue = hueCycle[hueIndex % hueCycle.length];
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 30 : 0) + performance.now() / 100) % 360;
        const saturation = 95 + normalizedValue * 5;
        const lightness = 50 + normalizedValue * 35 + (settings.gamma - 1) * 20;
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${Math.min(95, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.5, barHeight);
        if (normalizedValue > 0.25) {
          ctx.fillStyle = `hsla(${(hue + 35) % 360}, ${saturation + 5}%, ${Math.min(98, lightness + 35)}%, 0.75)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.1, barWidth - 0.5, barHeight * 0.35);
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins',
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.20 : 0.15;
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.purple}, 56%, 8%, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      const sbnfHuesCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.cream];
      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px var(--font-poppins)`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10;
        ctx.strokeStyle = `hsla(${SBNF_HUES_SCENE.cream}, 100%, 93%, 0.15)`;
        ctx.lineWidth = 1.0;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.02) + (i * Math.min(width, height) * 0.04);
          ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }
      const numStaticParticles = 70 + Math.floor(audioData.rms * 180);
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2200) * (i % 2 === 0 ? 1.2 : -1.2);
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.35);
        const currentRadius = maxRadius * (0.1 + energy * 0.9);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.8 + energy * 5.0) * settings.brightCap;
        const hue = (sbnfHuesCycle[i % sbnfHuesCycle.length] + energy * 60 + (audioData.beat ? 35 : 0) + performance.now() / 90) % 360;
        ctx.fillStyle = `hsla(${hue}, ${95 + energy * 5}%, ${65 + energy * 25}%, ${0.4 + energy * 0.6})`;
        ctx.beginPath(); ctx.arc(x, y, particleSize, 0, Math.PI * 2); ctx.fill();
      }
      if (audioData.beat) {
        const particleCount = 180 + Math.floor(audioData.rms * 400 + audioData.bassEnergy * 350);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.9) + (audioData.bassEnergy * Math.min(width, height) * 0.45);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random());
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random());
          const size = (3.0 + Math.random() * 12 * (audioData.rms + audioData.bassEnergy)) * settings.brightCap;
          const hue = (sbnfHuesCycle[(i + Math.floor(audioData.bassEnergy * 15)) % sbnfHuesCycle.length] + (Math.random() * 60 - 30)) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${75 + audioData.trebleEnergy * 15}%, ${0.8 + audioData.midEnergy * 0.2})`;
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins',
    dataAiHint: 'geometric tunnel flight',
    initWebGL: (canvas, settings) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 5;

      const numSegments = 30;
      const segmentSpacing = 5;
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      const segmentData = [];

      const geometry = new THREE.TorusGeometry(10, 0.5, 8, 20); // Ring shape

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true });
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = -i * segmentSpacing;
        segment.rotation.x = Math.PI / 2; // Orient rings correctly
        scene.add(segment);
        segments.push(segment);
        segmentData.push({ initialZ: segment.position.z });
      }
      
      return { renderer, scene, camera, segments, segmentData, tunnelLength, segmentSpacing, lastFrameTime: performance.now() };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.segments || !webGLAssets.segmentData) return;

      const { segments, segmentData, tunnelLength, segmentSpacing } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      const travelSpeed = (10 + audioData.rms * 30 + audioData.bpm * 0.1) * deltaTime;
      camera.position.z -= travelSpeed;


      const sbnfHuesCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.purple, SBNF_HUES_SCENE.cream];
      const color = new THREE.Color();

      segments.forEach((segment, i) => {
        // Recycle segments
        if (segment.position.z > camera.position.z + segmentSpacing) {
          segment.position.z -= tunnelLength;
        }

        // Audio reactivity
        const scaleFactor = 0.8 + Math.sin(currentTime * 0.002 + i * 0.5) * 0.2 + audioData.bassEnergy * 0.5 + (audioData.beat ? 0.3 : 0);
        segment.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const hue = (sbnfHuesCycle[i % sbnfHuesCycle.length] + (segment.position.z * 0.1) + currentTime * 0.02 + audioData.midEnergy * 180) % 360;
        color.setHSL(hue / 360, 0.8 + audioData.trebleEnergy * 0.2, 0.4 + audioData.rms * 0.3 + settings.brightCap * 0.2);
        (segment.material as THREE.MeshBasicMaterial).color = color;
        (segment.material as THREE.MeshBasicMaterial).opacity = 0.5 + audioData.rms * 0.5;
        (segment.material as THREE.MeshBasicMaterial).transparent = true;


        segment.rotation.z += (audioData.trebleEnergy * 0.01 + 0.001) * (i % 2 === 0 ? 1 : -1);
      });

      camera.fov = 75 - audioData.rms * 20;
      camera.updateProjectionMatrix();
      
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.segments) {
        webGLAssets.segments.forEach((segment: THREE.Mesh) => {
          if (segment.geometry) segment.geometry.dispose();
          if (segment.material) (segment.material as THREE.Material).dispose();
          if (webGLAssets.scene) webGLAssets.scene.remove(segment);
        });
        webGLAssets.segments = [];
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins',
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.cream];
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now() / 30) % 360;
        ctx.fillStyle = `hsla(${hue}, 100%, ${90 + Math.random() * 10}%, ${Math.min(1, settings.brightCap * 1.2)})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = 'hsl(var(--background-hsl))';
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins',
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 50;

      const PARTICLE_COUNT = 30000; // Increased from previous version
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const sbnfHuesForFinale = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.gold, SBNF_HUES_SCENE.lavender, SBNF_HUES_SCENE.cream, SBNF_HUES_SCENE.purple];
      const color = new THREE.Color();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 0.1; // Start near center
        positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

        velocities[i3] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

        color.setHSL(sbnfHuesForFinale[i % sbnfHuesForFinale.length] / 360, 0.95, 0.6 + Math.random() * 0.1);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 1.0,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      return { renderer, scene, camera, particles, particleMaterial, particleGeometry, sbnfHues: sbnfHuesForFinale, velocities, lastBeatTime: 0, lastFrameTime: performance.now() };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.velocities || !webGLAssets.particleGeometry) return;

      const { particles, particleMaterial, particleGeometry, sbnfHues, velocities } = webGLAssets;
      const positions = particleGeometry.attributes.position.array as Float32Array;
      const colorsAttribute = particleGeometry.attributes.color.array as Float32Array;
      const PARTICLE_COUNT = positions.length / 3;


      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      particleMaterial.opacity = Math.min(1.0, effectiveBrightCap * 0.9 * (0.3 + audioData.rms * 0.7)); // More responsive opacity
      particleMaterial.size = Math.max(0.2, (0.3 + effectiveBrightCap * (audioData.rms * 3.5 + audioData.bassEnergy * 3.0))); // More dynamic size

      const color = new THREE.Color();
      const dragFactor = 0.95; // slightly less drag
      const positionResetThreshold = 100; // Wider bounds
      const movementMultiplier = 30; // Faster overall movement
      const gravity = 0.03 + audioData.midEnergy * 0.15; // Softer gravity

      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > 60)) { // Slightly shorter refractory
        webGLAssets.lastBeatTime = currentTime;
        const burstStrength = 15.0 + audioData.bassEnergy * 30.0 + audioData.rms * 25.0; // Even stronger bursts

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          positions[i3] = (Math.random() - 0.5) * 0.5; // Start slightly more spread
          positions[i3 + 1] = (Math.random() - 0.5) * 0.5;
          positions[i3 + 2] = (Math.random() - 0.5) * 0.5;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = Math.random() * burstStrength;

          velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
          velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
          velocities[i3 + 2] = speed * Math.cos(phi);

          const burstHueIndex = (i + Math.floor(currentTime / 25)) % sbnfHues.length; // Very fast hue cycling on burst
          color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, 0.75 + Math.random() * 0.2); // Brighter burst colors
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
        if (distSqToCenter > 0.1) { // Softer check
            const distToCenter = Math.sqrt(distSqToCenter);
            const attractionForce = gravity / (distSqToCenter * 0.05 + 0.05); // More responsive attraction
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

        const distSq = positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2;
        const speedSq = velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2;

        if (distSq > positionResetThreshold * positionResetThreshold || (speedSq < 0.001 && distSq > 5)) { // Reset if very slow and far
            positions[i3] = (Math.random() - 0.5) * 0.05; // Reset closer to center
            positions[i3 + 1] = (Math.random() - 0.5) * 0.05;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.05;
            velocities[i3] = (Math.random() - 0.5) * 0.2; // Slightly higher base random velocity
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.2;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;

      particles.rotation.y += 0.0008 * (1 + audioData.trebleEnergy * 3.5); // More rotation
      particles.rotation.x += 0.0005 * (1 + audioData.midEnergy * 3.5);
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
        if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        if (webGLAssets.scene && webGLAssets.particles) {
          webGLAssets.scene.remove(webGLAssets.particles);
        }
      }
    },
  },
];

// SBNF Specific font family constants
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), var(--font-geist-mono), monospace";
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";

export const CONTROL_PANEL_WIDTH_STRING = "280px";
