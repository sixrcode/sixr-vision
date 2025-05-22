
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

const PARTICLE_FINALE_NUM_PARTICLES = 30000; // Number of particles for WebGL scene

// SBNF Palette Hues (approximate for dynamic coloring)
// Deep Purple: 258, Lavender: 267, Mustard Gold: 36-45, Orange-Red: 13, Cream: 30
const SBNF_HUES_SCENE = [258, 267, 40, 13, 30];


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
        
        let destWidth = width;
        let destHeight = height;
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = camWidth;
        let sourceHeight = camHeight;

        const canvasAspect = width / height;
        const camAspect = camWidth / camHeight;

        if (canvasAspect > camAspect) { // Canvas is wider than camera view
            // Fit by height, crop horizontally
            destHeight = height;
            destWidth = height * camAspect; // Scale width to maintain camera aspect
            sourceHeight = camHeight;
            sourceWidth = camWidth; // Use full camera width
             // Center the scaled image if needed, though for cover usually we draw full destWidth/Height
        } else { // Canvas is taller or same aspect as camera view
            // Fit by width, crop vertically
            destWidth = width;
            destHeight = width / camAspect; // Scale height to maintain camera aspect
            sourceWidth = camWidth; // Use full camera width
            sourceHeight = camHeight;
        }
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        // Calculate source cropping for "cover" effect
        if (canvasAspect > camAspect) { // Canvas wider than cam: crop cam horizontally
            sourceHeight = camHeight;
            sourceWidth = camHeight * canvasAspect;
            sourceX = (camWidth - sourceWidth) / 2;
            sourceY = 0;
        } else { // Canvas taller than cam (or same aspect): crop cam vertically
            sourceWidth = camWidth;
            sourceHeight = camWidth / canvasAspect;
            sourceX = 0;
            sourceY = (camHeight - sourceHeight) / 2;
        }
        
        // Draw webcam feed (cropped to fill canvas)
        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.drawImage(webcamFeed, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        ctx.restore();

        // Difference blend for silhouette effect
        ctx.globalCompositeOperation = 'difference';
        const baseAccentHue = SBNF_HUES_SCENE[2]; // Mustard Gold
        const energyColor = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now()/80) % 360;

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
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE[0]}, 56%, 15%, ${fadeAlpha})`; // SBNF Deep Purple base fade
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.015) {
        const numShapes = 5 + Math.floor(audioData.rms * 30 + audioData.bassEnergy * 25); // Increased particle count
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (8 + audioData.bassEnergy * 200 + Math.random() * 80); // More reactive size
          const size = Math.max(4, sizeBase * settings.brightCap * (0.3 + audioData.midEnergy * 0.7));
          
          const x = Math.random() * width;
          const y = Math.random() * height;
          
          const hueOptions = [SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[0]]; // Lavender, Gold, Orange-Red, Purple
          const hue = (hueOptions[i % hueOptions.length] + (audioData.beat ? 40 : 0) + (performance.now()/70))%360 ; // Faster hue shift
          const alpha = (0.3 + audioData.trebleEnergy * 0.8 + audioData.rms * 0.7) * settings.brightCap; // More reactive alpha

          ctx.fillStyle = `hsla(${hue}, ${90 + Math.random()*10}%, ${65 + Math.random()*20 + audioData.rms*25}%, ${Math.min(1, alpha * 1.4)})`; // Brighter
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / (500 - audioData.bpm * 1.8) + i*0.6) * (audioData.trebleEnergy * 0.9 + 0.3) ); // Faster rotation

          const shapeType = Math.random();
          if (shapeType < 0.35) { // More circles
            ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
          } else if (shapeType < 0.7) { // More squares
            ctx.fillRect(-size / 2, -size / 2, size, size);
          } else { // Triangles
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45; // Slightly smaller max radius for better definition
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.20 : 0.15;

      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE[0]}, 56%, 10%, ${fadeAlpha})`; // Darker Purple, slightly faster fade
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1]]; // Orange-Red, Gold, Lavender
      const numSteps = 6 + Math.floor(audioData.rms * 20); // More steps for complexity

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.01) continue; // Slightly higher threshold

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (600 / (speedFactor * 0.6 + 0.4)); // Faster base speed, more responsive to gain
            const ringProgress = (time + j * (0.6 / numSteps) * (i + 1.2)) % 1; // Faster propagation

            const radius = ringProgress * maxRingRadius * (0.15 + energy * 0.85); // More dynamic radius
            if (radius < 1.5) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 3.5; // More intense alpha
            if (alpha <= 0.01) continue;

            const thickness = (2.0 + energy * 30 + (audioData.beat ? 8.0 : 0)) * settings.brightCap; // Thicker, more beat-reactive
            const hue = (baseHues[i] + ringProgress * 60 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 70 + (audioData.beat ? 35 : 0)) % 360; // Wider hue variation

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${98 + energy*2}%, ${70 + energy*20}%, ${Math.min(1, alpha)})`; // More saturated, brighter
            ctx.lineWidth = Math.max(1.5, thickness); // Ensure min thickness
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
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE[0]}, 56%, 8%, ${fadeAlpha})`; // Very dark purple base
      ctx.fillRect(0, 0, width, height);

      const gridSize = 6 + Math.floor(audioData.rms * 18); // Fewer, larger cells
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.3; // Larger base radius

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 2.5 : 1.0; // Stronger beat emphasis
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.15 + audioData.rms * 0.85 + audioData.bassEnergy * 0.5); // More reactive radius
          if (radius < 1.5) continue;

          const hueOptions = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[4]]; // SBNF Palette + Cream
          const baseHue = hueOptions[ (i*gridSize + j + Math.floor(performance.now()/400)) % hueOptions.length ]; // Slightly faster hue shift
          const hue = (baseHue + energy * 80 + (audioData.beat ? 40:0) ) % 360; // Wider hue shift
          const lightness = 55 + energy * 30; // Brighter base lightness
          const alpha = 0.35 + energy * 0.65; // More solid base alpha

          // Outer glow
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 6 + energy * 12, 0, Math.PI * 2); // Larger, softer glow
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 25}%, ${alpha * 0.6 * settings.brightCap})`;
          ctx.fill();

          // Inner core
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap * 1.2})`; // More opaque core
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
      ctx.fillRect(0,0,width,height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);


      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px var(--font-poppins)`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.2)'; // Ensure --muted-foreground-hsl-raw exists or use a fallback
        ctx.lineWidth = 1;
        for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - (height * 0.05), barWidth -2, (height * 0.05));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const hueCycle = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[0]]; // Orange-Red, Gold, Lavender, Deep Purple

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = Math.max(1, normalizedValue * height * effectiveBrightCap * 1.3); // Taller bars
        const hueIndex = Math.floor((i / audioData.spectrum.length) * hueCycle.length);
        const baseHue = hueCycle[hueIndex % hueCycle.length];
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 30 : 0) + performance.now()/100) % 360; // Added slow hue shift
        const saturation = 95 + normalizedValue * 5; // More saturated
        const lightness = 50 + normalizedValue * 35 + (settings.gamma - 1) * 20; // Brighter

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${Math.min(95, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.5, barHeight); // Thinner gap between bars

        if (normalizedValue > 0.25) { 
          ctx.fillStyle = `hsla(${(hue + 35) % 360}, ${saturation + 5}%, ${Math.min(98, lightness + 35)}%, 0.75)`; // More prominent highlight
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
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.20 : 0.15; // Slightly faster fade
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE[0]}, 56%, 8%, ${fadeAlpha})`; // Darker SBNF Purple background
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      const sbnfHuesCycle = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[4]]; // Orange-Red, Gold, Lavender, Cream

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px var(--font-poppins)`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10; 
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.15)'; 
        ctx.lineWidth = 1.0;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.02) + (i * Math.min(width, height) * 0.04);
          ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 70 + Math.floor(audioData.rms * 180); // More ambient particles
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2200) * (i%2 === 0 ? 1.2 : -1.2); // Slightly faster rotation
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.35); // More reactive radius
        const currentRadius = maxRadius * (0.1 + energy * 0.9); // More impact from energy
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.8 + energy * 5.0) * settings.brightCap; // Larger particles, more energy sensitive
        const hue = (sbnfHuesCycle[i % sbnfHuesCycle.length] + energy * 60 + (audioData.beat ? 35 : 0) + performance.now()/90) % 360; // Faster hue cycle
        ctx.fillStyle = `hsla(${hue}, ${95 + energy*5}%, ${65 + energy*25}%, ${0.4 + energy * 0.6})`; // Brighter, more opaque
        ctx.beginPath(); ctx.arc(x,y,particleSize,0, Math.PI*2); ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 180 + Math.floor(audioData.rms * 400 + audioData.bassEnergy * 350); // More burst particles
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.9) + (audioData.bassEnergy * Math.min(width,height) * 0.45);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random()); // Wider spread
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random());
          const size = (3.0 + Math.random() * 12 * (audioData.rms + audioData.bassEnergy)) * settings.brightCap; // Larger burst particles
          const hue = (sbnfHuesCycle[ (i + Math.floor(audioData.bassEnergy*15)) % sbnfHuesCycle.length ] + (Math.random() * 60 - 30)) % 360; // Wider hue variation for beat
          ctx.fillStyle = `hsla(${hue}, 100%, ${75 + audioData.trebleEnergy * 15}%, ${0.8 + audioData.midEnergy * 0.2})`; // More vibrant beat particles
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins',
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.35 : 0.30; // Darker, faster fade
      ctx.fillStyle = `hsla(${SBNF_HUES_SCENE[0]}, 56%, 6%, ${fadeAlpha})`; 
      ctx.fillRect(0, 0, width, height);

      const numLayers = 8 + Math.floor(audioData.rms * 20); // More layers for density
      const sbnfCycleHues = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[0], SBNF_HUES_SCENE[4]]; // Full SBNF Cycle

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1200 - audioData.bpm * 5.5); // Faster base speed, more BPM influence
        const depthProgress = ((i / numLayers) + timeFactor * (0.08 + audioData.rms * 0.8 + audioData.bassEnergy * 0.5)) % 1; // More reactive speed
        const scale = depthProgress * depthProgress * depthProgress; // Steeper perspective
        if (scale < 0.0005 || scale > 1) continue;

        const shapeWidth = width * scale * (0.25 + audioData.bassEnergy * 0.8); // More reactive size
        const shapeHeight = height * scale * (0.25 + audioData.midEnergy * 0.8);
        const alpha = (1 - depthProgress) * (0.25 + audioData.trebleEnergy * 0.75) * settings.brightCap * 2.5; // More reactive alpha
        if (alpha <= 0.005) continue;

        const hue = (sbnfCycleHues[i % sbnfCycleHues.length] + depthProgress * 200 + audioData.rms * 150 + performance.now()/180) % 360; // Faster hue cycle
        ctx.strokeStyle = `hsla(${hue}, 100%, ${70 + depthProgress * 20}%, ${alpha})`; // More saturated, brighter
        ctx.lineWidth = Math.max(1.0, (1 - depthProgress) * (15 + (audioData.beat ? 10.0 : 0)) * settings.brightCap); // Thicker lines, more beat emphasis

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.05) * 0.5; // Increased rotation speed
        ctx.rotate( depthProgress * Math.PI * 1.8 + timeFactor * rotationSpeed + Math.sin(timeFactor*0.6 + i*0.4) * 0.25); // More wobble

        const shapeTypeIndex = (i + Math.floor(timeFactor*3.0)) % 5; // More shape variety cycle
        if (shapeTypeIndex === 0) {
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (shapeTypeIndex === 1) {
            ctx.beginPath(); ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (shapeTypeIndex === 2) { 
            ctx.beginPath(); for(let k=0; k < 6; k++) { ctx.lineTo( (shapeWidth/2) * Math.cos(k * Math.PI / 3), (shapeHeight/2) * Math.sin(k * Math.PI / 3) ); } ctx.closePath(); ctx.stroke();
        } else if (shapeTypeIndex === 3) { 
            ctx.beginPath(); ctx.moveTo(0, -shapeHeight/1.5); ctx.lineTo(shapeWidth/1.7, shapeHeight/3); ctx.lineTo(-shapeWidth/1.7, shapeHeight/3); ctx.closePath(); ctx.stroke(); // Sharper triangle
        } else { 
            ctx.beginPath(); ctx.moveTo(0, -shapeHeight/1.8); ctx.lineTo(shapeWidth/1.8, 0); ctx.lineTo(0, shapeHeight/1.8); ctx.lineTo(-shapeWidth/1.8, 0); ctx.closePath(); ctx.stroke(); // Sharper diamond
        }
        ctx.restore();
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
        const hueOptions = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[4]]; // SBNF: Orange-Red, Gold, Lavender, Cream
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now()/30)%360; // Very fast hue cycle
        ctx.fillStyle = `hsla(${hue}, 100%, ${90 + Math.random() * 10}%, ${Math.min(1, settings.brightCap * 1.2)})`; // Brighter flash
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', // SBNF Gold on Purple
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 50; // Adjusted for better view
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true }); // alpha: true for transparency
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const positions = new Float32Array(PARTICLE_FINALE_NUM_PARTICLES * 3);
      const colors = new Float32Array(PARTICLE_FINALE_NUM_PARTICLES * 3);
      const velocities = new Float32Array(PARTICLE_FINALE_NUM_PARTICLES * 3); 
      // SBNF Hues: Orange-Red (13), Gold (40), Lavender (267), Cream (30), Deep Purple (258)
      const sbnfHuesForFinale = [SBNF_HUES_SCENE[3], SBNF_HUES_SCENE[2], SBNF_HUES_SCENE[1], SBNF_HUES_SCENE[4], SBNF_HUES_SCENE[0]]; 

      const color = new THREE.Color();

      for (let i = 0; i < PARTICLE_FINALE_NUM_PARTICLES; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 0.05; // Start very near center
        positions[i3 + 1] = (Math.random() - 0.5) * 0.05;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.05;

        velocities[i3] = (Math.random() - 0.5) * 0.1; 
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
        
        color.setHSL(sbnfHuesForFinale[i % sbnfHuesForFinale.length] / 360, 0.95, 0.6 + Math.random()*0.1); // Slightly varied lightness
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const particleMaterial = new THREE.PointsMaterial({
        size: 1.0, // Slightly larger base size
        vertexColors: true,
        transparent: true,
        opacity: 0.75, // Slightly less opaque base
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Important for additive blending
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);
      
      return { scene, camera, renderer, particles, particleMaterial, particleGeometry, sbnfHues: sbnfHuesForFinale, velocities, lastBeatTime: 0, lastFrameTime: performance.now() };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.velocities || !webGLAssets.particleGeometry) return;

      const { particles, particleMaterial, particleGeometry, sbnfHues, velocities } = webGLAssets;
      const positions = particleGeometry.attributes.position.array as Float32Array;
      const colorsAttribute = particleGeometry.attributes.color.array as Float32Array;
      
      const currentTime = performance.now();
      if (webGLAssets.lastFrameTime === undefined) webGLAssets.lastFrameTime = currentTime - 16; 
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; 
      webGLAssets.lastFrameTime = currentTime;

      const effectiveBrightCap = Math.max(0.1, settings.brightCap); 
      particleMaterial.opacity = Math.min(1.0, effectiveBrightCap * 0.85 * (0.25 + audioData.rms * 0.75)); // More RMS influence
      particleMaterial.size = Math.max(0.15, (0.25 + effectiveBrightCap * (audioData.rms * 3.0 + audioData.bassEnergy * 2.5))); // More reactive size
      
      const color = new THREE.Color();
      const dragFactor = 0.96; // Slightly less drag for longer trails
      const positionResetThreshold = 90; // Wider bounds before reset
      const movementMultiplier = 25; // Faster particle movement

      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > 70) ) { 
        webGLAssets.lastBeatTime = currentTime;
        const burstStrength = 10.0 + audioData.bassEnergy * 25.0 + audioData.rms * 20.0; // Stronger bursts

        for (let i = 0; i < PARTICLE_FINALE_NUM_PARTICLES; i++) {
          const i3 = i * 3;
          
          positions[i3] = (Math.random() - 0.5) * 1.5; 
          positions[i3 + 1] = (Math.random() - 0.5) * 1.5;
          positions[i3 + 2] = (Math.random() - 0.5) * 1.5;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1); 
          const speed = Math.random() * burstStrength;
          
          velocities[i3]     = speed * Math.sin(phi) * Math.cos(theta);
          velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
          velocities[i3 + 2] = speed * Math.cos(phi);

          const burstHueIndex = (i + Math.floor(currentTime/30)) % sbnfHues.length; // Faster hue cycling on burst
          color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, 0.7 + Math.random() * 0.25); // Brighter, more varied burst colors
          colorsAttribute[i3] = color.r;
          colorsAttribute[i3 + 1] = color.g;
          colorsAttribute[i3 + 2] = color.b;
        }
        particleGeometry.attributes.color.needsUpdate = true;
      }

      // Gravity/Attraction towards center
      const gravity = 0.05 + audioData.midEnergy * 0.2; 

      for (let i = 0; i < PARTICLE_FINALE_NUM_PARTICLES; i++) {
        const i3 = i * 3;

        // Apply attraction to center
        const dx = -positions[i3];
        const dy = -positions[i3+1];
        const dz = -positions[i3+2];
        const distSqToCenter = dx*dx + dy*dy + dz*dz;
        if (distSqToCenter > 1) { // Apply only if not too close to center
            const distToCenter = Math.sqrt(distSqToCenter);
            const attractionForce = gravity / (distSqToCenter * 0.1 + 0.1); // Softened attraction
            velocities[i3]     += (dx / distToCenter) * attractionForce * deltaTime;
            velocities[i3 + 1] += (dy / distToCenter) * attractionForce * deltaTime;
            velocities[i3 + 2] += (dz / distToCenter) * attractionForce * deltaTime;
        }


        positions[i3]     += velocities[i3] * deltaTime * movementMultiplier; 
        positions[i3 + 1] += velocities[i3 + 1] * deltaTime * movementMultiplier;
        positions[i3 + 2] += velocities[i3 + 2] * deltaTime * movementMultiplier;

        velocities[i3]     *= dragFactor;
        velocities[i3 + 1] *= dragFactor;
        velocities[i3 + 2] *= dragFactor;

        const distSq = positions[i3]**2 + positions[i3+1]**2 + positions[i3+2]**2;
        const speedSq = velocities[i3]**2 + velocities[i3+1]**2 + velocities[i3+2]**2;

        if (distSq > positionResetThreshold * positionResetThreshold || (speedSq < 0.005 && distSq > 10)) { // Reset if too far or too slow when away from center
            positions[i3] = (Math.random() - 0.5) * 0.1; 
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
            velocities[i3] = (Math.random() - 0.5) * 0.15; // Slightly higher base random velocity
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.15;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.15;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      
      particles.rotation.y += 0.0005 * (1 + audioData.trebleEnergy * 3.0); // More rotation based on treble
      particles.rotation.x += 0.0003 * (1 + audioData.midEnergy * 3.0);  // More rotation based on mid
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
        if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        if (webGLAssets.scene && webGLAssets.particles) {
            webGLAssets.scene.remove(webGLAssets.particles);
        }
        // Note: renderer, scene, camera are disposed by VisualizerView
      }
    },
  },
];

// SBNF Specific font family constants
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), monospace"; 
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";

export const CONTROL_PANEL_WIDTH_STRING = "280px";

