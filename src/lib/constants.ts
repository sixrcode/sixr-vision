
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

  // AI Visual Overlay Mixer Defaults
  enableAiOverlay: false,
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay', // A common blending mode for overlays
  aiOverlayPrompt: 'ethereal wisps of light', // Default starter prompt
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
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      // Subtle background pulse
      const bgBrightness = 5 + audioData.rms * 10;
      ctx.fillStyle = `hsla(224, 71.4%, ${bgBrightness}%, 1)`; // Using background HSL
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
         for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - height * 0.3, barWidth -2, height * 0.3);
         }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = normalizedValue * height * settings.brightCap;
        const hue = (i / audioData.spectrum.length) * 120 + 180 + (audioData.beat ? 30 : 0); // Shift hue on beat
        const saturation = 80 + normalizedValue * 20;
        const lightness = 40 + normalizedValue * 35;
        
        ctx.fillStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);

        // Add a subtle inner glow for liveliness
        if (normalizedValue > 0.5) {
          ctx.fillStyle = `hsla(${hue % 360}, ${saturation}%, ${lightness + 15}%, 0.5)`;
          ctx.fillRect(i * barWidth + (barWidth-2)*0.25, height - barHeight*0.5, (barWidth-2)*0.5, barHeight*0.5);
        }
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
      // Slower fade for more trails
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.2 : 0.1})`;
      ctx.fillRect(0,0,width,height);


      const centerX = width / 2;
      const centerY = height / 2;

      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Visualizer active. Waiting for audio input...', width / 2, height / 2);

        const numPlaceholderCircles = 10;
        ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.1)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.03) + (i * Math.min(width, height) * 0.04);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }
      
      // More reactive static particles
      const numStaticParticles = 30 + Math.floor(audioData.rms * 20);
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 5000) * (i%2 === 0 ? 1 : -1); // slow rotation
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.05 + audioData.midEnergy * 0.1);
        const currentRadius = maxRadius * (0.3 + energy * 0.7);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (0.5 + energy * 1.5) * settings.brightCap;
        const hue = 200 + energy * 60;
        ctx.fillStyle = `hsla(${hue}, 100%, ${60 + energy*20}%, ${0.2 + energy * 0.6})`;
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }


      if (audioData.beat) {
        const particleCount = 70 + Math.floor(audioData.rms * 150 + audioData.bassEnergy * 100); // Increased count
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          // Particles travel further and faster
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.5) + (audioData.bassEnergy * Math.min(width,height) * 0.2);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.5); // more spread
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.5);
          const size = (1.5 + Math.random() * 5 * (audioData.rms + audioData.bassEnergy * 0.5)) * settings.brightCap;

          const hueBase = (settings.fftSize === 128 ? 200 : settings.fftSize === 256 ? 260 : 320) + (performance.now()/1000 * 10);
          const hue = (hueBase + audioData.bassEnergy * 90 + Math.random()*60 - 30) % 360; // More dynamic hue
          ctx.fillStyle = `hsla(${hue}, 100%, ${60 + audioData.trebleEnergy * 40}%, ${0.6 + audioData.midEnergy * 0.4})`;
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/d8b4fe.png',
    dataAiHint: 'silhouette reflection',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsla(var(--background))'; // Keep background clear each frame
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
        // Webcam feed slightly more opaque and reactive
        ctx.globalAlpha = Math.min(1, (0.7 + audioData.rms * 0.5) * settings.brightCap); 
        ctx.drawImage(webcamFeed, x, y, drawWidth, drawHeight);
        ctx.restore();

        ctx.globalCompositeOperation = 'difference';
        // Color of difference blend is more dynamic
        const energyColor = (audioData.bassEnergy * 200 + audioData.midEnergy * 120 + audioData.trebleEnergy * 60 + performance.now()/50) % 360;
        // Opacity of difference blend more reactive
        const differenceAlpha = Math.min(1, (0.15 + audioData.rms * 0.4 + audioData.beat * 0.2) * settings.brightCap);
        ctx.fillStyle = `hsla(${energyColor}, 70%, 50%, ${differenceAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

        // Add subtle pulsing outline based on treble energy
        if (audioData.trebleEnergy > 0.3) {
            ctx.save();
            if (settings.mirrorWebcam) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }
            ctx.filter = `blur(${audioData.trebleEnergy * 5}px) opacity(${audioData.trebleEnergy * 0.5})`;
            ctx.drawImage(webcamFeed, x, y, drawWidth, drawHeight);
            ctx.filter = 'none';
            ctx.restore();
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/fb7185.png', 
    dataAiHint: 'particle explosion fireworks',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      
      // Slower fade for more prominent trails
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.1 : 0.03})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Ambient particles: increased count and more dynamic
      const ambientParticleCount = 80 + Math.floor(audioData.rms * 200); 
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.8) { 
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (0.5 + Math.random() * 3.5 * (audioData.midEnergy + audioData.trebleEnergy * 0.7)) * settings.brightCap; // Slightly larger
          const hue = (180 + Math.random() * 180 + audioData.trebleEnergy * 60 + performance.now()/200) % 360; // Slowly shifting hues
          const lightness = 60 + Math.random() * 25; 
          const alpha = (0.1 + Math.random() * 0.5 * audioData.rms) * settings.brightCap; // More responsive alpha
          ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`; 
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Beat-triggered bursts: more particles, wider spread, varied color
      if (audioData.beat) {
        const burstParticleCount = 200 + Math.floor(audioData.bassEnergy * 300 + audioData.rms * 200); // Increased count
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          // Wider spread
          const radius = Math.random() * Math.min(width, height) * 0.60 * (0.5 + audioData.rms * 0.8); 
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.8 + 0.5); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.8 + 0.5);
          // Slightly larger and more reactive size
          const size = (2 + Math.random() * 8 * (audioData.bassEnergy * 1.2 + audioData.rms)) * settings.brightCap; 
          
          // More varied fiery hues
          const hue = ( (audioData.bassEnergy * 50) + (Math.random() * 90) - 30 + 360 + performance.now()/100) % 360; 
          const lightness = 55 + Math.random() * 25; 
          const alpha = (0.6 + Math.random() * 0.4) * settings.brightCap; // Consistently brighter burst
          
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
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
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/e07a5f.png',
    dataAiHint: 'neon grid',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), 0.8)`; 
      ctx.fillRect(0, 0, width, height);

      const gridSize = 12 + Math.floor(audioData.rms * 8); 
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 2.2;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255; 
          
          const beatFactor = audioData.beat ? 1.5 : 1.0;
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;
          
          const radius = maxRadius * energy * settings.brightCap * (0.5 + audioData.rms * 0.5); 
          if (radius < 1) continue;

          const hue = (energy * 100 + 220 + (performance.now()/1000)*15) % 360; 
          const lightness = 45 + energy * 30;
          const alpha = 0.2 + energy * 0.8;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 2 + energy * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 5}%, ${alpha * 0.3 * settings.brightCap})`;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap})`;
          ctx.fill();
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
      const maxRingRadius = Math.min(width, height) * 0.48; 

      ctx.fillStyle = `hsla(var(--background), 0.3)`; 
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; 
      
      const numSteps = 6 + Math.floor(audioData.rms * 4); 

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.03) continue;

        for (let j = 0; j < numSteps; j++) {
            const time = performance.now() / (1500 / (settings.gain * 0.8 + 0.2));
            const ringProgress = (time + j * (0.4 / numSteps) * (i + 1)) % 1; 
            
            const radius = ringProgress * maxRingRadius * (0.5 + energy * 0.5); 
            if (radius < 1) continue;
            
            const alpha = (1 - ringProgress) * energy * settings.brightCap * 1.8; 
            if (alpha <= 0.01) continue;

            const thickness = (1.5 + energy * 10 + audioData.beat * 3) * settings.brightCap; 
            const hue = (baseHues[i] + ringProgress * 30 + audioData.spectrum[i * 10 % audioData.spectrum.length] / 255 * 30) % 360;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${90 + energy*10}%, ${55 + energy*20}%, ${Math.min(1, alpha)})`;
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
      
      if (audioData.beat) {
        const intensity = Math.min(1, (0.6 + audioData.rms * 0.6 + audioData.bassEnergy * 0.4) * settings.brightCap);
        const hue = (audioData.bassEnergy * 90 + audioData.midEnergy * 30 + performance.now()/80) % 360; 
        const saturation = 50 + audioData.trebleEnergy * 50; 
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${80 + audioData.rms * 15}%, ${intensity})`;
        ctx.fillRect(0, 0, width, height);

         if (Math.random() < 0.3) { 
            ctx.fillStyle = `hsla(${(hue + 180)%360}, ${saturation}%, 90%, ${intensity * 0.5})`;
            ctx.fillRect(0, 0, width, height);
         }

      } else {
        ctx.fillStyle = `hsla(var(--background), 0.25)`; 
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    thumbnailUrl: 'https://placehold.co/120x80/4a00e0/8e2de2.png',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      
      ctx.fillStyle = `hsla(var(--background), 0.08)`; 
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat) {
        const numShapes = 5 + Math.floor(audioData.rms * 10 + audioData.bassEnergy * 5); 
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (15 + audioData.bassEnergy * 100 + Math.random() * 40);
          const size = sizeBase * settings.brightCap * (0.5 + audioData.midEnergy * 0.5);
          if (size < 2) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 15 + i * 35 + audioData.midEnergy * 120) % 360;
          const alpha = (0.3 + audioData.trebleEnergy * 0.7 + audioData.rms * 0.3) * settings.brightCap; 

          ctx.fillStyle = `hsla(${hue}, 100%, ${60 + Math.random()*15}%, ${Math.min(1, alpha)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 1000 + i) * (audioData.trebleEnergy * 0.5) ); 

          const shapeType = Math.random();
          if (shapeType < 0.4) { 
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (shapeType < 0.8) { 
            ctx.fillRect(-size / 2, -size / 2, size, size);
          } else { 
            ctx.beginPath();
            ctx.moveTo(0, -size/2);
            ctx.lineTo(size/2 * 0.866, size/4);
            ctx.lineTo(-size/2 * 0.866, size/4);
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
    thumbnailUrl: 'https://placehold.co/120x80/0f2027/2c5364.png', 
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.fillStyle = 'hsla(var(--background), 0.7)'; 
      ctx.fillRect(0, 0, width, height);

      const numLayers = 12 + Math.floor(audioData.rms * 8); 
      const maxDepth = Math.min(width, height) * 1.8; 

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (2500 - audioData.bpm * 5); 
        const depthProgress = ((i / numLayers) + timeFactor * (0.15 + audioData.rms * 0.4)) % 1;
        
        const scale = depthProgress; 
        if (scale < 0.005 || scale > 1) continue; 

        const shapeWidth = width * scale * (0.4 + audioData.bassEnergy * 0.6); 
        const shapeHeight = height * scale * (0.4 + audioData.midEnergy * 0.6); 
        
        const alpha = (1 - depthProgress) * (0.4 + audioData.trebleEnergy * 0.6) * settings.brightCap * 1.5; 
        if (alpha <= 0.01) continue;

        const hue = (depthProgress * 200 + 160 + audioData.rms * 90 + performance.now()/300) % 360; 
        
        ctx.strokeStyle = `hsla(${hue}, 90%, ${60 + depthProgress * 15}%, ${alpha})`;
        ctx.lineWidth = Math.max(0.5, (1 - depthProgress) * (6 + audioData.beat * 3) * settings.brightCap); 
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate( (audioData.trebleEnergy - 0.5) * depthProgress * 0.2 ); 
        ctx.strokeRect(
          -shapeWidth / 2,
          -shapeHeight / 2,
          shapeWidth,
          shapeHeight
        );
        ctx.restore();
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
