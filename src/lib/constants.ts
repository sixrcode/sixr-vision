
import type { Settings, SceneDefinition, AudioData } from '@/types';

export const FFT_SIZES = [128, 256, 512] as const;

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0, // Manual gain, used if AGC is off
  enableAgc: true, // AGC is now on by default
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: true, // Webcam now on by default
  mirrorWebcam: false,
  currentSceneId: 'radial_burst',
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // Default animation type
    speed: 1, // Default speed
    color: 'rgb(235, 26, 115)',
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500, // Default 0.5 second transition
  sceneTransitionActive: true, // Transitions are active by default

  // AI Visual Overlay Mixer Defaults
  enableAiOverlay: false,
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay', // A common blending mode for overlays
  aiOverlayPrompt: 'vibrant abstract energy', // Default starter prompt for auto-generation
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
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/7dd3fc.png?text=Bars',
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const bgBrightness = 5 + audioData.rms * 10;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 1 : 0.9})`;
      ctx.fillRect(0,0,width,height);

      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5);

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);

        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.2)';
        ctx.lineWidth = 1;
        for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - height * 0.3, barWidth -2, height * 0.3);
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = normalizedValue * height * settings.brightCap;
        const hue = (i / audioData.spectrum.length) * 120 + 180 + (audioData.beat ? 30 : 0); 
        const saturation = 70 + normalizedValue * 30; 
        const lightness = 30 + normalizedValue * 45; 

        ctx.fillStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);

        if (normalizedValue > 0.3) { // Lowered threshold for "glow"
          ctx.fillStyle = `hsla(${(hue + 20) % 360}, ${saturation + 10}%, ${lightness + 20}%, 0.4)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.1, barWidth - 2, barHeight * 0.2); // Top glow
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/facc15.png?text=Burst',
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.2 : 0.1})`; // Slightly faster fade for trails
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 8; 
        ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.15)'; 
        ctx.lineWidth = 1;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.02) + (i * Math.min(width, height) * 0.05);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 40 + Math.floor(audioData.rms * 60); 
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 4000) * (i%2 === 0 ? 1 : -1); 
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.2); 
        const currentRadius = maxRadius * (0.2 + energy * 0.8);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (0.8 + energy * 2.5) * settings.brightCap; 
        const hue = 180 + energy * 80 + (audioData.beat ? 20 : 0); 
        ctx.fillStyle = `hsla(${hue % 360}, ${90 + energy*10}%, ${55 + energy*25}%, ${0.3 + energy * 0.6})`;
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 80 + Math.floor(audioData.rms * 200 + audioData.bassEnergy * 150); 
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.6) + (audioData.bassEnergy * Math.min(width,height) * 0.25); 
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.6); 
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.6);
          const size = (2 + Math.random() * 7 * (audioData.rms + audioData.bassEnergy * 0.6)) * settings.brightCap; 
          const hueBase = (audioData.bassEnergy * 60); // Shift towards orange/red for bass beats
          const hue = (hueBase + Math.random()*40 - 20 + performance.now()/50) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${65 + audioData.trebleEnergy * 30}%, ${0.7 + audioData.midEnergy * 0.3})`; 
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
   {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/a78bfa.png?text=Mirror',
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0,0,width,height);

      if (webcamFeed && settings.showWebcam) {
        if (webcamFeed.videoWidth === 0 || webcamFeed.videoHeight === 0) {
          ctx.fillStyle = 'hsl(var(--muted-foreground))';
          ctx.textAlign = 'center';
          ctx.font = '16px var(--font-geist-sans)';
          ctx.fillText('Waiting for webcam dimensions...', width / 2, height / 2);
          return;
        }

        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;
        const camAspect = camWidth / camHeight;
        const canvasAspect = width / height;

        let drawWidth, drawHeight, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight;

        // Calculate "cover" scaling
        if (canvasAspect > camAspect) { // Canvas is wider than cam: fit height, crop width
            sHeight = camHeight;
            sWidth = sHeight * canvasAspect;
            sx = (camWidth - sWidth) / 2;
            sy = 0;
            dWidth = width;
            dHeight = height;
            dx = 0;
            dy = 0;
        } else { // Canvas is taller or same aspect as cam: fit width, crop height
            sWidth = camWidth;
            sHeight = sWidth / canvasAspect;
            sx = 0;
            sy = (camHeight - sHeight) / 2;
            dWidth = width;
            dHeight = height;
            dx = 0;
            dy = 0;
        }
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15)); // Slightly higher base alpha
        ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        ctx.restore(); 

        ctx.globalCompositeOperation = 'difference';
        const energyColor = (audioData.bassEnergy * 180 + audioData.midEnergy * 120 + audioData.trebleEnergy * 60 + performance.now()/50) % 360;
        const differenceAlpha = Math.min(1, (0.95 + audioData.rms * 0.1 + (audioData.beat ? 0.05 : 0)) * settings.brightCap); // Stronger difference
        ctx.fillStyle = `hsla(${energyColor}, 90%, 70%, ${differenceAlpha})`;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        if (audioData.trebleEnergy > 0.15 && settings.brightCap > 0.1) {
            ctx.save();
            if (settings.mirrorWebcam) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }
            ctx.globalCompositeOperation = 'lighter'; // Use 'lighter' for a better glow
            ctx.globalAlpha = audioData.trebleEnergy * 0.5 * settings.brightCap; // Slightly reduced alpha for subtlety
            ctx.filter = `blur(${2 + audioData.trebleEnergy * 4}px) brightness(1.3)`; // Slightly reduced blur
            ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            ctx.filter = 'none';
            ctx.restore(); // Restore composite operation and alpha implicitly
        }

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Webcam not enabled or available for this scene', width / 2, height / 2);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/f472b6.png?text=Finale',
    dataAiHint: 'particle fireworks explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.12})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const MAX_AMBIENT_PARTICLES = 120; 
      const MAX_BURST_PARTICLES = 300;  

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 50 + Math.floor(audioData.rms * 100)); 
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.7 + 0.05) { 
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (0.7 + Math.random() * 3.0 * (audioData.midEnergy + audioData.trebleEnergy * 0.5)) * settings.brightCap;
          const hue = (150 + Math.random() * 220 + audioData.trebleEnergy * 60 + performance.now()/160) % 360; 
          const lightness = 50 + Math.random() * 25; 
          const alpha = (0.1 + Math.random() * 0.45 * audioData.rms) * settings.brightCap;
          ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 150 + Math.floor(audioData.bassEnergy * 150 + audioData.rms * 100)); 
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.55 * (0.4 + audioData.bassEnergy * 0.4 + audioData.rms * 0.25);
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.7 + 0.4); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.7 + 0.4);
          const size = (1.5 + Math.random() * 7.0 * (audioData.bassEnergy * 1.1 + audioData.rms * 0.8)) * settings.brightCap; 

          const hue = ((audioData.bassEnergy * 50) + (Math.random() * 90) - 35 + 360 + performance.now()/90) % 360; 
          const lightness = 55 + Math.random() * 20;
          const alpha = (0.55 + Math.random() * 0.35) * settings.brightCap; 

          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/fb923c.png?text=Grid',
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), 0.5)`; 
      ctx.fillRect(0, 0, width, height);

      const gridSize = 8 + Math.floor(audioData.rms * 8); 
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.7; 

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 1.6 : 1.0; 
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.35 + audioData.rms * 0.55 + audioData.bassEnergy * 0.25);
          if (radius < 1.2) continue; 

          const hue = (energy * 110 + 190 + (performance.now()/90)*8) % 360; 
          const lightness = 35 + energy * 30; 
          const alpha = 0.25 + energy * 0.65; 

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 2.5 + energy * 4.5, 0, Math.PI * 2); 
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness + 8}%, ${alpha * 0.35 * settings.brightCap})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha * settings.brightCap})`;
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    thumbnailUrl: 'https://placehold.co/120x80/000000/4ade80.png?text=Rings',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.42; 

      ctx.fillStyle = `hsla(var(--background), 0.22)`; 
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; 
      const numSteps = 4 + Math.floor(audioData.rms * 4); 

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.015) continue; 

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (1100 / (speedFactor * 0.65 + 0.25)); 
            const ringProgress = (time + j * (0.45 / numSteps) * (i + 1)) % 1;

            const radius = ringProgress * maxRingRadius * (0.35 + energy * 0.55); 
            if (radius < 0.8) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 1.8; 
            if (alpha <= 0.008) continue;

            const thickness = (1.8 + energy * 13 + (audioData.beat ? 3.5 : 0)) * settings.brightCap; 
            const hue = (baseHues[i] + ringProgress * 35 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 35 + (audioData.beat ? 12 : 0)) % 360; 

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${90 + energy*8}%, ${55 + energy*18}%, ${Math.min(1, alpha)})`; 
            ctx.lineWidth = Math.max(0.8, thickness);
            ctx.stroke();
        }
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/e5e5e5/171717.png?text=Strobe',
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      if (audioData.beat && audioData.rms > 0.04) { 
        const intensity = Math.min(1, (0.45 + audioData.rms * 0.65 + audioData.bassEnergy * 0.45) * settings.brightCap);
        const hue = (audioData.bassEnergy * 110 + audioData.midEnergy * 35 + performance.now()/75) % 360; 
        const saturation = 25 + audioData.trebleEnergy * 65; 
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${70 + audioData.rms * 18}%, ${intensity})`; 
        ctx.fillRect(0, 0, width, height);

         if (Math.random() < 0.3) { 
            ctx.fillStyle = `hsla(${(hue + 180 + Math.random()*50-25)%360}, ${saturation}%, 90%, ${intensity * 0.55})`; 
            ctx.fillRect(0, 0, width, height);
         }

      } else {
        ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.2 : 0.15})`; 
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    thumbnailUrl: 'https://placehold.co/120x80/4f46e5/a5b4fc.png?text=Echo',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.09 : 0.06})`; 
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.08) { 
        const numShapes = 2 + Math.floor(audioData.rms * 10 + audioData.bassEnergy * 6); 
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (8 + audioData.bassEnergy * 110 + Math.random() * 45); 
          const size = sizeBase * settings.brightCap * (0.35 + audioData.midEnergy * 0.55);
          if (size < 2.5) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 13 + i * 35 + audioData.midEnergy * 140) % 360; 
          const alpha = (0.2 + audioData.trebleEnergy * 0.75 + audioData.rms * 0.35) * settings.brightCap; 

          ctx.fillStyle = `hsla(${hue}, 95%, ${50 + Math.random()*18}%, ${Math.min(1, alpha)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 850 + i) * (audioData.trebleEnergy * 0.55 + 0.08) ); 

          const shapeType = Math.random();
          if (shapeType < 0.4) { 
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (shapeType < 0.8) { 
            ctx.fillRect(-size / 2, -size / 2, size, size);
          } else { 
            ctx.beginPath();
            ctx.moveTo(0, -size/1.8); 
            ctx.lineTo(size/2 * 0.866, size/3.6);
            ctx.lineTo(-size/2 * 0.866, size/3.6);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    thumbnailUrl: 'https://placehold.co/120x80/0f2027/203a43.png?text=Tunnel',
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.55 : 0.45})`; 
      ctx.fillRect(0, 0, width, height);

      const numLayers = 9 + Math.floor(audioData.rms * 9); 
      const maxDepth = Math.min(width, height) * 1.8; 

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1900 - audioData.bpm * 6.5); 
        const depthProgress = ((i / numLayers) + timeFactor * (0.08 + audioData.rms * 0.45 + audioData.bassEnergy * 0.25)) % 1; 

        const scale = depthProgress;
        if (scale < 0.0015 || scale > 1) continue; 

        const shapeWidth = width * scale * (0.25 + audioData.bassEnergy * 0.65); 
        const shapeHeight = height * scale * (0.25 + audioData.midEnergy * 0.65); 

        const alpha = (1 - depthProgress) * (0.25 + audioData.trebleEnergy * 0.65) * settings.brightCap * 1.6; 
        if (alpha <= 0.004) continue;

        const hue = (depthProgress * 170 + 170 + audioData.rms * 110 + performance.now()/260) % 360; 

        ctx.strokeStyle = `hsla(${hue}, 90%, ${50 + depthProgress * 18}%, ${alpha})`; 
        ctx.lineWidth = Math.max(0.7, (1 - depthProgress) * (7 + (audioData.beat ? 4.5 : 0)) * settings.brightCap); 

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.35) * 0.25; 
        ctx.rotate( depthProgress * Math.PI + timeFactor * rotationSpeed ); 
        
        if (i % 3 === 0) {
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (i % 3 === 1) {
            ctx.beginPath();
            ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -shapeHeight/2);
            ctx.lineTo(shapeWidth/2, shapeHeight/2);
            ctx.lineTo(-shapeWidth/2, shapeHeight/2);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

    