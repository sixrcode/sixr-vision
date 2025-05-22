
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
  showWebcam: false, // Defaulting to false, user must enable via UI
  mirrorWebcam: true, // Defaulting mirror to true as per earlier request
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
  enableAiOverlay: false, // Defaulting AI Overlay to off initially
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent",
  enablePeriodicAiOverlay: false,
  aiOverlayRegenerationInterval: 45, // Default to 45 seconds
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
  black: 0,           // #000000
  orangeRed: 13,      // #FF441A
  orangeYellow: 36,   // #FDB143
  lightPeach: 30,     // #FFECDA (foreground)
  lightLavender: 267, // #E1CCFF
  deepPurple: 258,    // #5A36BB (background)
  // Tron-like additions for specific scenes
  tronBlue: 197,      // A bright cyan/blue for Tron-like effects
};


export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
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

        if (canvasAspect > camAspect) { // Canvas is wider than camera view
            sourceHeight = camHeight;
            sourceWidth = camHeight * canvasAspect;
            sourceX = (camWidth - sourceWidth) / 2;
            sourceY = 0;
            destHeight = height;
            destWidth = height * camAspect;
        } else { // Canvas is taller or same aspect as camera view
            sourceWidth = camWidth;
            sourceHeight = camWidth / canvasAspect;
            sourceY = (camHeight - sourceHeight) / 2;
            sourceX = 0;
            destWidth = width;
            destHeight = width / camAspect;
        }
        
        const drawX = (width - destWidth) / 2;
        const drawY = (height - destHeight) / 2;

        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        const webcamOpacity = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.globalAlpha = webcamOpacity;
        ctx.drawImage(webcamFeed, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, destWidth, destHeight);
        ctx.restore();

        ctx.globalCompositeOperation = 'difference';
        const baseAccentHue = SBNF_HUES_SCENE.orangeYellow; 
        const energyColor = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now() / 80) % 360;

        const differenceAlpha = Math.min(1, (0.95 + audioData.rms * 0.1 + (audioData.beat ? 0.05 : 0)) * settings.brightCap);
        ctx.fillStyle = `hsla(${energyColor}, 90%, 70%, ${differenceAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

        if (audioData.trebleEnergy > 0.15 && settings.brightCap > 0.1) {
            ctx.save();
            if (settings.mirrorWebcam) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = audioData.trebleEnergy * 0.5 * settings.brightCap;
            ctx.filter = `blur(${2 + audioData.trebleEnergy * 4}px) brightness(1.3)`;
            ctx.drawImage(webcamFeed, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, destWidth, destHeight);
            ctx.filter = 'none';
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
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
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.deepPurple}, 56%, 8%, ${fadeAlpha * 0.8})`; 
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
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.deepPurple}, 56%, 6%, ${fadeAlpha})`; 
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
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.deepPurple}, 56%, 5%, ${fadeAlpha})`; 
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
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = `hsla(${SBNF_HUES_SCENE.lightPeach}, 100%, 93%, 0.2)`;
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
        const saturation = 90 + normalizedValue * 10; 
        const lightness = 45 + normalizedValue * 40 + (settings.gamma - 1) * 25 + (audioData.beat ? 5 : 0);
        
        ctx.fillStyle = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(90, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.25, barHeight); 

        if (normalizedValue > 0.20) { 
          ctx.fillStyle = `hsla(${(hue + 40) % 360}, ${Math.min(100, saturation + 10)}%, ${Math.min(95, lightness + 40)}%, 0.8)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.05, barWidth - 0.25, barHeight * 0.30); 
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
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.22 : 0.17; 
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE.black}, 0%, 0%, ${fadeAlpha})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      const sbnfHuesCycle = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 12;
        ctx.strokeStyle = `hsla(${SBNF_HUES_SCENE.lightPeach}, 100%, 93%, 0.12)`;
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
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins', 
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // Use SBNF black

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 10; 

      const numSegments = 25; 
      const segmentSpacing = 8; 
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      
      const geometry = new THREE.TorusGeometry(12, 0.15, 8, 50); 

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ 
          wireframe: true,
          color: new THREE.Color().setHSL(SBNF_HUES_SCENE.tronBlue/360, 1.0, 0.6) 
        }); 
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = -i * segmentSpacing;
        segment.rotation.x = Math.PI / 2; 
        scene.add(segment);
        segments.push(segment);
      }
      
      return { renderer, scene, camera, segments, tunnelLength, segmentSpacing, lastFrameTime: performance.now() };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.segments ) return;

      const { segments, tunnelLength, segmentSpacing } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      const travelSpeedBase = 15;
      const travelSpeed = (travelSpeedBase + audioData.rms * 40 + audioData.bpm * 0.15) * deltaTime;
      camera.position.z -= travelSpeed;

      const tronHues = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender];
      const color = new THREE.Color();

      segments.forEach((segment, i) => {
        if (segment.position.z > camera.position.z + segmentSpacing * 2) { 
          segment.position.z -= tunnelLength;
        }

        const scaleFactorBase = 0.9 + Math.sin(currentTime * 0.0015 + i * 0.6) * 0.15;
        const scaleFactorAudio = audioData.bassEnergy * 0.6 + (audioData.beat ? 0.35 : 0);
        segment.scale.setScalar(Math.max(0.5, scaleFactorBase + scaleFactorAudio));

        const hueIndex = Math.floor( (i + currentTime * 0.0001 * (50 + audioData.midEnergy * 100) ) % tronHues.length);
        const baseHue = tronHues[hueIndex];
        const hue = (baseHue + audioData.trebleEnergy * 120) % 360;
        const lightness = 0.5 + audioData.rms * 0.4 + (audioData.beat ? 0.2 : 0) + settings.brightCap * 0.1;
        color.setHSL(hue / 360, 0.9, Math.min(0.85, lightness)); 
        
        if (segment.material instanceof THREE.MeshBasicMaterial) {
            segment.material.color = color;
            segment.material.opacity = 0.6 + audioData.rms * 0.4; 
            segment.material.transparent = true;
        }
        
        segment.rotation.z += (audioData.trebleEnergy * 0.015 + 0.0005 + audioData.bpm * 0.00001) * (i % 2 === 0 ? 1 : -1.2);
      });

      camera.fov = 70 - audioData.rms * 25; 
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
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins',
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
      renderer.setClearColor(0x000000, 0); 

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 60; 

      const PARTICLE_COUNT = 80000; // Further increased particle count
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
        size: 1.5, // Slightly larger base size
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
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
      particleMaterial.opacity = Math.min(0.95, effectiveBrightCap * 0.85 * (0.4 + audioData.rms * 0.6));
      particleMaterial.size = Math.max(0.15, (0.25 + effectiveBrightCap * (audioData.rms * 4.0 + audioData.bassEnergy * 3.5 + audioData.trebleEnergy * 1.5)));

      const color = new THREE.Color();
      const dragFactor = 0.96; 
      const positionResetThreshold = 120; 
      const movementMultiplier = 35; 
      const gravityToCenter = 0.05 + audioData.midEnergy * 0.20; 
      const beatRefractoryPeriod = 50; 

      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
        webGLAssets.lastBeatTime = currentTime;
        const burstStrength = 18.0 + audioData.bassEnergy * 35.0 + audioData.rms * 30.0;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          positions[i3] = (Math.random() - 0.5) * 1.0; 
          positions[i3 + 1] = (Math.random() - 0.5) * 1.0;
          positions[i3 + 2] = (Math.random() - 0.5) * 1.0;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1); 
          const speed = Math.random() * burstStrength;

          velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
          velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
          velocities[i3 + 2] = speed * Math.cos(phi);

          const burstHueIndex = (i + Math.floor(currentTime / 20)) % sbnfHues.length;
          const hueLightness = 0.7 + Math.random() * 0.25 + audioData.trebleEnergy * 0.1;
          color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.95, hueLightness) );
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
            const attractionForce = gravityToCenter / (distSqToCenter * 0.03 + 0.03); 
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

        if (distSqFromOrigin > positionResetThreshold * positionResetThreshold || (speedSq < 0.0001 && distSqFromOrigin > 10)) {
            positions[i3] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
            velocities[i3] = (Math.random() - 0.5) * 0.25; 
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.25;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.25;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y += 0.0010 * (1 + audioData.trebleEnergy * 4.0);
      particles.rotation.x += 0.0007 * (1 + audioData.midEnergy * 4.0);
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
        if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        if (webGLAssets.scene && webGLAssets.particles) {
          webGLAssets.scene.remove(webGLAssets.particles);
        }
        if (webGLAssets.segments && webGLAssets.scene) { // For geometric_tunnel cleanup
            webGLAssets.segments.forEach((segment: THREE.Mesh) => {
              if (segment.geometry) segment.geometry.dispose();
              if (segment.material) (segment.material as THREE.Material).dispose();
              webGLAssets.scene.remove(segment);
            });
            webGLAssets.segments = [];
          }
        webGLAssets.velocities = null;
      }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
