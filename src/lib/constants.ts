
import type { Settings, SceneDefinition, AudioData } from '@/types';
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
  showWebcam: false, // Defaulting to false, user must enable
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

const PARTICLE_FINALE_NUM_PARTICLES = 10000; // Number of particles for WebGL scene

export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror', // SBNF Colors
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0,0,width,height);

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;
        const canvasAspect = width / height;
        const camAspect = camWidth / camHeight;

        let sx = 0, sy = 0, sWidth = camWidth, sHeight = camHeight;

        if (canvasAspect > camAspect) { // Canvas is wider than video: fit height, crop width
            sHeight = camHeight;
            sWidth = camHeight * canvasAspect;
            sx = (camWidth - sWidth) / 2;
        } else { // Canvas is taller or same aspect: fit width, crop height
            sWidth = camWidth;
            sHeight = camWidth / canvasAspect;
            sy = (camHeight - sHeight) / 2;
        }
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, 0, 0, width, height);
        ctx.restore();

        ctx.globalCompositeOperation = 'difference';
        const baseAccentHue = 36; 
        const energyColor = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now()/80) % 360;

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
            ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, 0, 0, width, height);
            ctx.filter = 'none';
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        if (!settings.showWebcam) {
          ctx.fillText('Webcam not enabled for this scene', width / 2, height / 2);
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes', 
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.08 : 0.05})`; // use raw HSL
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.02) {
        const numShapes = 5 + Math.floor(audioData.rms * 20 + audioData.bassEnergy * 15);
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (15 + audioData.bassEnergy * 150 + Math.random() * 60);
          const size = sizeBase * settings.brightCap * (0.3 + audioData.midEnergy * 0.7);
          if (size < 4) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Light Lavender (267)
          const hueOptions = [13, 36, 267, 258]; // SBNF palette, added Deep Purple
          const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + (audioData.beat ? 15 : 0) + (performance.now()/100))%360 ;
          const alpha = (0.3 + audioData.trebleEnergy * 0.7 + audioData.rms * 0.5) * settings.brightCap;

          ctx.fillStyle = `hsla(${hue}, ${80 + Math.random()*20}%, ${60 + Math.random()*20 + audioData.rms*15}%, ${Math.min(1, alpha * 1.2)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / (500 - audioData.bpm * 1.5) + i) * (audioData.trebleEnergy * 0.7 + 0.3) );

          const shapeType = Math.random();
          if (shapeType < 0.4) {
            ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
          } else if (shapeType < 0.8) {
            ctx.fillRect(-size / 2, -size / 2, size, size);
          } else {
            ctx.beginPath(); ctx.moveTo(0, -size/1.8); ctx.lineTo(size/2 * 0.866, size/3.6); ctx.lineTo(-size/2 * 0.866, size/3.6); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      }
    },
  },
   {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45;

      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1})`; // use raw HSL
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267)
      const baseHues = [13, 36, 267]; 
      const numSteps = 6 + Math.floor(audioData.rms * 12);

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.005) continue;

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (800 / (speedFactor * 0.6 + 0.4));
            const ringProgress = (time + j * (0.6 / numSteps) * (i + 1.2)) % 1;

            const radius = ringProgress * maxRingRadius * (0.25 + energy * 0.75);
            if (radius < 1) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 2.5;
            if (alpha <= 0.01) continue;

            const thickness = (2 + energy * 20 + (audioData.beat ? 5.0 : 0)) * settings.brightCap;
            const hue = (baseHues[i] + ringProgress * 40 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 50 + (audioData.beat ? 20 : 0)) % 360;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${90 + energy*10}%, ${65 + energy*15}%, ${Math.min(1, alpha)})`;
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
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid',
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.28 : 0.22})`; // use raw HSL
      ctx.fillRect(0, 0, width, height);

      const gridSize = 8 + Math.floor(audioData.rms * 12);
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.5;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 2.0 : 1.0;
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.25 + audioData.rms * 0.7 + audioData.bassEnergy * 0.35);
          if (radius < 1.5) continue;

          const hueOptions = [13, 36, 267, 258]; // SBNF Palette
          const baseHue = hueOptions[ (i*gridSize + j) % hueOptions.length ];
          const hue = (baseHue + energy * 60 + (performance.now()/70)*10 + (audioData.beat ? 20:0) ) % 360;
          const lightness = 45 + energy * 30;
          const alpha = 0.35 + energy * 0.65;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 4 + energy * 7, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 15}%, ${alpha * 0.45 * settings.brightCap})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap * 1.0})`;
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars', 
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))'; 
      ctx.fillRect(0,0,width,height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.2)'; // use raw HSL
        ctx.lineWidth = 1;
        for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - (height * 0.05), barWidth -2, (height * 0.05));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const hueCycle = [13, 36, 267, 258]; // SBNF Palette

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = Math.max(1, normalizedValue * height * effectiveBrightCap * 1.1);
        const hueIndex = Math.floor((i / audioData.spectrum.length) * hueCycle.length);
        const baseHue = hueCycle[hueIndex % hueCycle.length];
        const hue = (baseHue + normalizedValue * 30 + (audioData.beat ? 20 : 0)) % 360;
        const saturation = 85 + normalizedValue * 15;
        const lightness = 40 + normalizedValue * 35 + (settings.gamma - 1) * 10; // Gamma influence

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${Math.min(90, lightness)}%)`; // Cap lightness
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1.2, barHeight);

        if (normalizedValue > 0.35) {
          ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${saturation + 10}%, ${Math.min(95, lightness + 25)}%, 0.65)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.05, barWidth - 1.2, barHeight * 0.25);
        }
      });
    },
  },
   {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst',
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.15})`; // use raw HSL
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      const sbnfHues = [13, 36, 267, 258, 337]; // Added SBNF pink/magenta

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.15)'; // use raw HSL
        ctx.lineWidth = 1.0;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.01) + (i * Math.min(width, height) * 0.04);
          ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 50 + Math.floor(audioData.rms * 100);
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 3000) * (i%2 === 0 ? 1 : -1);
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.25);
        const currentRadius = maxRadius * (0.2 + energy * 0.8);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.2 + energy * 3.5) * settings.brightCap;
        const hue = (sbnfHues[i % sbnfHues.length] + energy * 40 + (audioData.beat ? 25 : 0)) % 360;
        ctx.fillStyle = `hsla(${hue}, ${85 + energy*15}%, ${55 + energy*25}%, ${0.4 + energy * 0.6})`;
        ctx.beginPath(); ctx.arc(x,y,particleSize,0, Math.PI*2); ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 120 + Math.floor(audioData.rms * 300 + audioData.bassEnergy * 250);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.7) + (audioData.bassEnergy * Math.min(width,height) * 0.35);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.8);
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.8);
          const size = (2.5 + Math.random() * 8 * (audioData.rms + audioData.bassEnergy * 0.8)) * settings.brightCap;
          const hue = (sbnfHues[ (i + Math.floor(audioData.bassEnergy*10)) % sbnfHues.length ] + (Math.random() * 40 - 20)) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${65 + audioData.trebleEnergy * 20}%, ${0.7 + audioData.midEnergy * 0.3})`;
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel',
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.35 : 0.28})`; // use raw HSL
      ctx.fillRect(0, 0, width, height);

      const numLayers = 12 + Math.floor(audioData.rms * 15);
      const sbnfHues = [13, 36, 267, 258, 337]; // SBNF Palette + Pink/Magenta

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1600 - audioData.bpm * 7.0);
        const depthProgress = ((i / numLayers) + timeFactor * (0.08 + audioData.rms * 0.6 + audioData.bassEnergy * 0.35)) % 1;
        const scale = depthProgress;
        if (scale < 0.0005 || scale > 1) continue;

        const shapeWidth = width * scale * (0.25 + audioData.bassEnergy * 0.65);
        const shapeHeight = height * scale * (0.25 + audioData.midEnergy * 0.65);
        const alpha = (1 - depthProgress) * (0.35 + audioData.trebleEnergy * 0.65) * settings.brightCap * 2.0;
        if (alpha <= 0.005) continue;

        const hue = (sbnfHues[i % sbnfHues.length] + depthProgress * 150 + audioData.rms * 100 + performance.now()/250) % 360;
        ctx.strokeStyle = `hsla(${hue}, 95%, ${60 + depthProgress * 20}%, ${alpha})`;
        ctx.lineWidth = Math.max(1.0, (1 - depthProgress) * (10 + (audioData.beat ? 6.5 : 0)) * settings.brightCap);

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.15) * 0.35;
        ctx.rotate( depthProgress * Math.PI * 1.3 + timeFactor * rotationSpeed );

        const shapeTypeIndex = (i + Math.floor(timeFactor*2.0)) % 4;
        if (shapeTypeIndex === 0) {
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (shapeTypeIndex === 1) {
            ctx.beginPath(); ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (shapeTypeIndex === 2) {
            ctx.beginPath(); for(let k=0; k < 6; k++) { ctx.lineTo( (shapeWidth/2) * Math.cos(k * Math.PI / 3), (shapeHeight/2) * Math.sin(k * Math.PI / 3) ); } ctx.closePath(); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.moveTo(0, -shapeHeight/2); ctx.lineTo(shapeWidth/2, shapeHeight/2); ctx.lineTo(-shapeWidth/2, shapeHeight/2); ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe',
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [13, 36, 267, 258, 337]; // SBNF Palette
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now()/50)%360;
        ctx.fillStyle = `hsla(${hue}, 100%, ${85 + Math.random() * 15}%, ${settings.brightCap})`;
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale',
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 50; // Adjusted for better view
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true }); // alpha: true for transparency
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(PARTICLE_FINALE_NUM_PARTICLES * 3);
      const colors = new Float32Array(PARTICLE_FINALE_NUM_PARTICLES * 3);
      const sbnfHues = [13, 36, 267, 258, 337]; // SBNF Palette
      const baseColor = new THREE.Color();

      for (let i = 0; i < PARTICLE_FINALE_NUM_PARTICLES; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100; // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100; // y
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100; // z

        baseColor.setHSL(sbnfHues[i % sbnfHues.length] / 360, 0.9, 0.6);
        colors[i * 3] = baseColor.r;
        colors[i * 3 + 1] = baseColor.g;
        colors[i * 3 + 2] = baseColor.b;
      }
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);
      
      return { scene, camera, renderer, particles, particleMaterial, particleGeometry, sbnfHues };
    },
    drawWebGL: ({ scene, camera, renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.particles) return;

      const { particles, particleMaterial, particleGeometry, sbnfHues } = webGLAssets;
      const positions = particleGeometry.attributes.position.array as Float32Array;
      const colors = particleGeometry.attributes.color.array as Float32Array;
      const time = performance.now() * 0.0005;

      // Update particle material based on settings
      particleMaterial.opacity = Math.max(0.1, settings.brightCap * 0.7 * (0.5 + audioData.rms * 0.5));
      particleMaterial.size = 0.3 + settings.brightCap * (audioData.rms * 1.5 + audioData.bassEnergy * 1.0);
      
      const baseColor = new THREE.Color();

      for (let i = 0; i < PARTICLE_FINALE_NUM_PARTICLES; i++) {
        // Simple movement: expand/contract with RMS, spin with time
        const i3 = i * 3;
        const initialX = (Math.random() - 0.5) * 100; // Re-randomize for more dynamic feel or use stored initial positions
        const initialY = (Math.random() - 0.5) * 100;
        
        // Make particles react more to beat
        let scaleFactor = 1.0 + audioData.rms * 2.0;
        if (audioData.beat) {
          scaleFactor += audioData.bassEnergy * 5.0 * Math.random();
           // Flash color on beat
          baseColor.setHSL((sbnfHues[i % sbnfHues.length] + 30) / 360, 1.0, 0.7 + Math.random()*0.2);
        } else {
          baseColor.setHSL(sbnfHues[i % sbnfHues.length] / 360, 0.9, 0.5 + audioData.midEnergy * 0.3);
        }
        colors[i3] = baseColor.r;
        colors[i3 + 1] = baseColor.g;
        colors[i3 + 2] = baseColor.b;

        positions[i3] = initialX * Math.cos(time * 0.2 + i*0.1) * scaleFactor;
        positions[i3+1] = initialY * Math.sin(time * 0.2 + i*0.1) * scaleFactor;
        // positions[i3+2] = initialZ * scaleFactor; // if you want z-depth movement
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particles.rotation.y = time * 0.1;
      particles.rotation.x = time * 0.05;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
        if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        if (webGLAssets.scene) { // Remove particles from scene
            if (webGLAssets.particles) webGLAssets.scene.remove(webGLAssets.particles);
        }
        // Note: renderer, scene, camera are managed by VisualizerView
      }
    },
    // Original 2D draw function (will not be called if rendererType is 'webgl')
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1})`; // use raw HSL
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const MAX_AMBIENT_PARTICLES = 15000; // Increased cap
      const MAX_BURST_PARTICLES = 30000; // Increased cap
      const sbnfHues = [13, 36, 267, 258, 337]; 

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 250 + Math.floor(audioData.rms * 600 + audioData.midEnergy * 400 + audioData.trebleEnergy * 250));
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.9 + 0.25) { // Increased probability
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (1.5 + Math.random() * 5.5 * (audioData.midEnergy + audioData.trebleEnergy * 0.8)) * settings.brightCap;
          const hue = (sbnfHues[i % sbnfHues.length] + Math.random() * 70 - 35 + performance.now()/100) % 360; // Faster cycle
          const lightness = 65 + Math.random() * 25;
          const alpha = (0.35 + Math.random() * 0.7 * (audioData.rms + 0.15)) * settings.brightCap * 1.4; // Brighter alpha
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 800 + Math.floor(audioData.bassEnergy * 1800 + audioData.rms * 1200)); // More particles on beat
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.85 * (0.3 + audioData.bassEnergy * 0.6 + audioData.rms * 0.5); // Wider burst
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.8 + 0.7);
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.8 + 0.7);
          const size = (2.5 + Math.random() * 15.0 * (audioData.bassEnergy * 1.4 + audioData.rms * 1.2)) * settings.brightCap; // Larger particles
          const hue = (sbnfHues[ (i + Math.floor(audioData.bassEnergy*15)) % sbnfHues.length ] + (Math.random() * 80) - 40 + performance.now()/60) % 360; // Wider hue variance, faster cycle
          const lightness = 70 + Math.random() * 25; // Brighter
          const alpha = (0.8 + Math.random() * 0.25) * settings.brightCap * 1.2; // More opaque
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath(); ctx.arc(x, y, Math.max(1.0, size), 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
];

// SBNF Specific font family constants
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), monospace";
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";


export const CONTROL_PANEL_WIDTH_STRING = "280px";
