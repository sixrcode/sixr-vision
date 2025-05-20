
import type { Settings, SceneDefinition, AudioData } from '@/types';

export const FFT_SIZES = [128, 256, 512] as const;

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: false,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false,
  mirrorWebcam: false,
  currentSceneId: 'radial_burst',
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: 'rgb(235, 26, 115)',
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500, // Default 0.5 second transition
  sceneTransitionActive: true, // Transitions are active by default
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
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/00ffff.png',
    dataAiHint: 'audio spectrum',
    draw: (ctx, audioData, _settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0,0,width,height);

      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5);

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Waiting for audio input...', width / 2, height / 2);

        const barWidth = width / audioData.spectrum.length;
         ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.2)';
         ctx.lineWidth = 1;
         for(let i=0; i < audioData.spectrum.length; i++) { // Use current spectrum length
            ctx.strokeRect(i * barWidth, height - height * 0.3, barWidth -2, height * 0.3);
         }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      audioData.spectrum.forEach((value, i) => {
        const barHeight = (value / 255) * height * _settings.brightCap;
        const hue = (i / audioData.spectrum.length) * 120 + 180; // Blue to Green to Yellow
        ctx.fillStyle = `hsl(${hue}, 100%, ${50 + (value / 255) * 25}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/fde047.png',
    dataAiHint: 'abstract explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;

      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Visualizer active. Waiting for audio input...', width / 2, height / 2);

        const numPlaceholderCircles = 8;
        ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.15)';
        ctx.lineWidth = 2;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.05) + (i * Math.min(width, height) * 0.03);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      if (audioData.beat) {
        const particleCount = 50 + Math.floor(audioData.rms * 100);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * audioData.rms * Math.min(width, height) * 0.4;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const size = (1 + Math.random() * 4 * audioData.rms) * settings.brightCap;

          const hueBase = (settings.fftSize === 128 ? 200 : settings.fftSize === 256 ? 260 : 320);
          const hue = (hueBase + audioData.bassEnergy * 60) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${50 + audioData.trebleEnergy * 50}%, ${0.5 + audioData.midEnergy * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

       const numStaticParticles = 20;
       for (let i = 0; i < numStaticParticles; i++) {
         const angle = (i / numStaticParticles) * Math.PI * 2;
         const maxRadius = Math.min(width, height) * 0.1;
         const currentRadius = maxRadius * (0.5 + audioData.spectrum[i % audioData.spectrum.length]/510);
         const x = centerX + Math.cos(angle) * currentRadius;
         const y = centerY + Math.sin(angle) * currentRadius;
         ctx.fillStyle = `hsla(var(--accent-foreground), ${0.1 + audioData.spectrum[i % audioData.spectrum.length]/1020})`;
         ctx.beginPath();
         ctx.arc(x,y,1 * settings.brightCap,0, Math.PI*2);
         ctx.fill();
       }
    },
  },
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/d8b4fe.png',
    dataAiHint: 'silhouette reflection',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsla(var(--background))';
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
        const aspectRatio = camWidth / camHeight;
        let drawWidth = width;
        let drawHeight = width / aspectRatio;
        if (drawHeight > height) {
          drawHeight = height;
          drawWidth = height * aspectRatio;
        }
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.globalAlpha = (0.8 + audioData.rms * 0.2) * settings.brightCap;
        ctx.drawImage(webcamFeed, x, y, drawWidth, drawHeight);
        ctx.restore();

        ctx.globalCompositeOperation = 'difference';
        const energyColor = Math.floor(audioData.bassEnergy * 100 + audioData.midEnergy * 80 + audioData.trebleEnergy * 75);
        ctx.fillStyle = `hsla(${energyColor % 360}, 70%, 50%, ${(0.2 + audioData.rms * 0.3) * settings.brightCap})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/fb7185.png',
    dataAiHint: 'particle explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.05})`;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      const ambientParticleCount = 50 + Math.floor(audioData.rms * 150); 
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.7) { 
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (1 + Math.random() * 3 * (audioData.midEnergy + audioData.trebleEnergy * 0.5)) * settings.brightCap;
          const hue = (180 + Math.random() * 180 + audioData.trebleEnergy * 40) % 360; 
          const lightness = 55 + Math.random() * 25; 
          const alpha = (0.15 + Math.random() * 0.4 * audioData.rms) * settings.brightCap;
          ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`; 
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = 150 + Math.floor(audioData.bassEnergy * 250 + audioData.rms * 150);
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.55 * (0.6 + audioData.rms); 
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.6 + 0.7); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.6 + 0.7);
          const size = (2.5 + Math.random() * 7 * (audioData.bassEnergy + audioData.rms)) * settings.brightCap; 
          
          const hue = ( (audioData.bassEnergy * 40) + (Math.random() * 60) - 20 + 360) % 360; 
          const lightness = 50 + Math.random() * 20; 
          const alpha = (0.65 + Math.random() * 0.35) * settings.brightCap; 
          
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  // NEW PRESETS START HERE
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/e07a5f.png',
    dataAiHint: 'neon grid',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 10; // 10x10 grid
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadius = Math.min(cellWidth, cellHeight) / 2.5;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255; // 0-1

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;
          
          const radius = maxRadius * energy * settings.brightCap;
          const hue = (energy * 120 + 240) % 360; // Blues to Magentas
          const lightness = 50 + energy * 25;
          const alpha = 0.3 + energy * 0.7;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
          ctx.fill();

          // Optional: Add a border or center dot
          if (energy > 0.1) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 20}%, ${alpha * 0.5})`;
            ctx.fill();
          }
        }
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    thumbnailUrl: 'https://placehold.co/120x80/000000/00ff00.png',
    dataAiHint: 'frequency rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45;

      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const colors = [
        { h: 0, s: 100, l: 50 },   // Red for Bass
        { h: 120, s: 100, l: 50 }, // Green for Mid
        { h: 240, s: 100, l: 50 }, // Blue for Treble
      ];
      
      const numSteps = 5; // Number of rings per frequency band

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.05) continue;

        for (let j = 0; j < numSteps; j++) {
            const time = performance.now() / (2000 / (settings.gain + 0.5)); // Slower with less gain
            // Offset each ring in time to create expanding effect
            const ringProgress = (time + j * 0.3) % 1; 
            
            const radius = ringProgress * maxRingRadius;
            const alpha = (1 - ringProgress) * energy * settings.brightCap * 1.5;
            if (alpha <= 0) continue;

            const thickness = (2 + energy * 8) * settings.brightCap;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${colors[i].h}, ${colors[i].s}%, ${colors[i].l}%, ${Math.min(1, alpha)})`;
            ctx.lineWidth = Math.max(1, thickness);
            ctx.stroke();
        }
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/f1f1f1/111111.png',
    dataAiHint: 'strobe light',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      
      // Fade previous frame slightly, or clear if not beat
      if (audioData.beat) {
        const intensity = Math.min(1, (0.5 + audioData.rms * 0.8) * settings.brightCap);
        const hue = (audioData.bassEnergy * 60 + performance.now()/100) % 360; // Slightly changing color
        ctx.fillStyle = `hsla(${hue}, 80%, ${70 + audioData.rms * 20}%, ${intensity})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = `hsla(var(--background), 0.4)`; // Slower fade out
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    thumbnailUrl: 'https://placehold.co/120x80/4a00e0/8e2de2.png',
    dataAiHint: 'glowing orbs', // Re-using for simplicity, could be 'echoing shapes'
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.fillStyle = `hsla(var(--background), 0.1)`; // Slow fade for echoes
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat) {
        const numShapes = 3 + Math.floor(audioData.rms * 7);
        for (let i = 0; i < numShapes; i++) {
          const size = (20 + audioData.bassEnergy * 80 + Math.random() * 30) * settings.brightCap;
          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 20 + i * 30 + audioData.midEnergy * 90) % 360;
          const alpha = (0.4 + audioData.trebleEnergy * 0.6) * settings.brightCap;

          ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
          
          // Randomly choose a shape
          const shapeType = Math.random();
          if (shapeType < 0.5) { // Circle
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else { // Rectangle
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
          }
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    thumbnailUrl: 'https://placehold.co/120x80/0f2027/2c5364.png',
    dataAiHint: 'geometric tunnel',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0, 0, width, height);

      const numLayers = 10;
      const maxDepth = Math.min(width, height) * 1.5; // How far the tunnel "extends"

      for (let i = 0; i < numLayers; i++) {
        // Simulate depth and movement
        const timeFactor = performance.now() / 3000; // Adjust speed
        const depthProgress = ((i / numLayers) + timeFactor * (0.2 + audioData.rms * 0.3)) % 1;
        
        const scale = depthProgress; // Scale from 0 to 1
        if (scale < 0.01) continue; // Don't draw if too small

        const shapeWidth = width * scale * (0.5 + audioData.bassEnergy * 0.5);
        const shapeHeight = height * scale * (0.5 + audioData.midEnergy * 0.5);
        
        const alpha = (1 - depthProgress) * (0.5 + audioData.trebleEnergy * 0.5) * settings.brightCap;
        if (alpha <= 0) continue;

        const hue = (depthProgress * 180 + 180 + audioData.rms * 60) % 360; // Colors change with depth and energy
        
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha})`;
        ctx.lineWidth = Math.max(1, (1 - depthProgress) * 5 * settings.brightCap);
        
        ctx.strokeRect(
          centerX - shapeWidth / 2,
          centerY - shapeHeight / 2,
          shapeWidth,
          shapeHeight
        );
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";


