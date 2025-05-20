
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
  showWebcam: false, // Webcam OFF by default, controlled by dedicated toggle or main power button
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
  aiOverlayPrompt: 'vibrant abstract energy', 
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

        if (normalizedValue > 0.3) { 
          ctx.fillStyle = `hsla(${(hue + 20) % 360}, ${saturation + 10}%, ${lightness + 20}%, 0.4)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.1, barWidth - 2, barHeight * 0.2); 
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
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.12})`; // Slightly faster fade
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

      const numStaticParticles = 40 + Math.floor(audioData.rms * 80); // Increased static particles
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 3500) * (i%2 === 0 ? 1 : -1); 
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.1 + audioData.midEnergy * 0.25);  // Slightly larger base
        const currentRadius = maxRadius * (0.25 + energy * 0.75);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1 + energy * 3) * settings.brightCap; // More size variation
        const hue = 170 + energy * 90 + (audioData.beat ? 25 : 0); 
        ctx.fillStyle = `hsla(${hue % 360}, ${90 + energy*10}%, ${60 + energy*20}%, ${0.35 + energy * 0.6})`; // Brighter
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 100 + Math.floor(audioData.rms * 250 + audioData.bassEnergy * 200); // More particles on beat
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.65) + (audioData.bassEnergy * Math.min(width,height) * 0.30); 
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.7); 
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.7);
          const size = (2.5 + Math.random() * 8 * (audioData.rms + audioData.bassEnergy * 0.7)) * settings.brightCap; // Larger beat particles
          const hue = ((audioData.bassEnergy * 70) + (Math.random() * 30 - 15) + 360) % 360; // Bass drives hue more
          ctx.fillStyle = `hsla(${hue}, 100%, ${70 + audioData.trebleEnergy * 25}%, ${0.75 + audioData.midEnergy * 0.25})`; // Brighter and more opaque
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

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;
        
        const canvasAspect = width / height;
        const camAspect = camWidth / camHeight;

        let sx = 0, sy = 0, sWidth = camWidth, sHeight = camHeight;
        let dx = 0, dy = 0, dWidth = width, dHeight = height;

        if (camAspect > canvasAspect) { // Webcam is wider than canvas: fit height, crop width
            sHeight = camHeight;
            sWidth = camHeight * canvasAspect;
            sx = (camWidth - sWidth) / 2;
        } else { // Webcam is taller or same aspect as canvas: fit width, crop height
            sWidth = camWidth;
            sHeight = camWidth / canvasAspect;
            sy = (camHeight - sHeight) / 2;
        }
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        // Draw the base webcam image for the difference operation
        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        
        ctx.restore(); 
        
        // Apply difference blend for silhouette
        ctx.globalCompositeOperation = 'difference';
        const energyColor = (audioData.bassEnergy * 180 + audioData.midEnergy * 120 + audioData.trebleEnergy * 60 + performance.now()/50) % 360;
        const differenceAlpha = Math.min(1, (0.95 + audioData.rms * 0.1 + (audioData.beat ? 0.05 : 0)) * settings.brightCap);
        ctx.fillStyle = `hsla(${energyColor}, 90%, 70%, ${differenceAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over'; // Reset blend mode

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
            ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            ctx.filter = 'none';
            ctx.restore(); 
        }
        ctx.globalAlpha = 1.0; // Reset global alpha

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        if (!settings.showWebcam) {
          ctx.fillText('Webcam not enabled for this scene', width / 2, height / 2);
        } else {
          ctx.fillText('Waiting for webcam feed...', width / 2, height / 2);
        }
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/f472b6.png?text=Finale',
    dataAiHint: 'particle fireworks bright',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.10})`; // Slightly faster fade
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      const MAX_AMBIENT_PARTICLES = 80; // Capped for performance
      const MAX_BURST_PARTICLES = 200; // Capped for performance

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 25 + Math.floor(audioData.rms * 60)); // Reduced base, kept multiplier
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.7 + 0.05) { // Slightly higher chance
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (0.7 + Math.random() * 3.0 * (audioData.midEnergy + audioData.trebleEnergy * 0.5)) * settings.brightCap; // More variation
          const hue = (140 + Math.random() * 230 + audioData.trebleEnergy * 70 + performance.now()/170) % 360; 
          const lightness = 50 + Math.random() * 25; 
          const alpha = (0.1 + Math.random() * 0.45 * audioData.rms) * settings.brightCap;
          ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 80 + Math.floor(audioData.bassEnergy * 100 + audioData.rms * 70)); // Reduced multipliers
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.55 * (0.35 + audioData.bassEnergy * 0.3 + audioData.rms * 0.25); // Slightly larger radius
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.7 + 0.25); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.7 + 0.25);
          const size = (1.5 + Math.random() * 7.0 * (audioData.bassEnergy * 1.1 + audioData.rms * 0.8)) * settings.brightCap; // More size impact

          const hue = ((audioData.bassEnergy * 60) + (Math.random() * 100) - 40 + 360 + performance.now()/90) % 360; // Wider hue range
          const lightness = 55 + Math.random() * 20; 
          const alpha = (0.55 + Math.random() * 0.4) * settings.brightCap;

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
      ctx.fillStyle = `hsla(var(--background), 0.4)`; // Slightly slower fade for more persistence
      ctx.fillRect(0, 0, width, height);

      const gridSize = 7 + Math.floor(audioData.rms * 10); // Slightly fewer cells for larger pulses
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.6; 

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 1.75 : 1.0; // Stronger beat emphasis
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.3 + audioData.rms * 0.6 + audioData.bassEnergy * 0.3); // Bass influence
          if (radius < 1.5) continue; 

          const hue = (energy * 120 + 180 + (performance.now()/80)*8 + (audioData.beat ? 15:0) ) % 360; 
          const lightness = 40 + energy * 25; 
          const alpha = 0.3 + energy * 0.7; 

          // Outer glow
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 3 + energy * 5, 0, Math.PI * 2); 
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness + 10}%, ${alpha * 0.4 * settings.brightCap})`;
          ctx.fill();

          // Inner core
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
      const maxRingRadius = Math.min(width, height) * 0.45; // Slightly larger

      ctx.fillStyle = `hsla(var(--background), 0.18)`; // Slower fade for more prominent rings
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; // Bass:Red, Mid:Green, Treble:Blue
      const numSteps = 5 + Math.floor(audioData.rms * 5); // More steps

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.01) continue; 

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (1000 / (speedFactor * 0.7 + 0.3)); // Faster base speed
            const ringProgress = (time + j * (0.5 / numSteps) * (i + 1.2)) % 1; // Staggering

            const radius = ringProgress * maxRingRadius * (0.4 + energy * 0.6); 
            if (radius < 1) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 2.0; // More opaque
            if (alpha <= 0.01) continue;

            const thickness = (2.0 + energy * 15 + (audioData.beat ? 4.0 : 0)) * settings.brightCap; // Thicker lines
            const hue = (baseHues[i] + ringProgress * 40 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 40 + (audioData.beat ? 15 : 0)) % 360; 

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${95 + energy*5}%, ${60 + energy*15}%, ${Math.min(1, alpha)})`; 
            ctx.lineWidth = Math.max(1, thickness);
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

      if (audioData.beat && audioData.rms > 0.035) { // Slightly lower RMS threshold
        const intensity = Math.min(1, (0.5 + audioData.rms * 0.7 + audioData.bassEnergy * 0.5) * settings.brightCap); // Stronger intensity
        const hue = (audioData.bassEnergy * 120 + audioData.midEnergy * 40 + performance.now()/70) % 360; 
        const saturation = 30 + audioData.trebleEnergy * 70; // More saturation range
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${75 + audioData.rms * 15}%, ${intensity})`; 
        ctx.fillRect(0, 0, width, height);

         // Add a secondary, slightly offset color flash for more visual complexity
         if (Math.random() < 0.35) { 
            ctx.fillStyle = `hsla(${(hue + 160 + Math.random()*60-30)%360}, ${saturation*0.8}%, 92%, ${intensity * 0.6})`; 
            ctx.fillRect(0, 0, width, height);
         }

      } else {
        ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.12})`; 
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

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.07 : 0.05})`; // Slower fade for more echoes
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.07) { // Lower RMS threshold for more activity
        const numShapes = 3 + Math.floor(audioData.rms * 12 + audioData.bassEnergy * 8); // More shapes
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (10 + audioData.bassEnergy * 130 + Math.random() * 50); // Larger base size
          const size = sizeBase * settings.brightCap * (0.4 + audioData.midEnergy * 0.6);
          if (size < 3) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 12 + i * 30 + audioData.midEnergy * 150) % 360; 
          const alpha = (0.25 + audioData.trebleEnergy * 0.8 + audioData.rms * 0.4) * settings.brightCap; // More alpha range

          ctx.fillStyle = `hsla(${hue}, 95%, ${55 + Math.random()*15}%, ${Math.min(1, alpha)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 800 + i) * (audioData.trebleEnergy * 0.6 + 0.1) ); // Faster rotation

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

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.5 : 0.4})`; // Slightly faster fade
      ctx.fillRect(0, 0, width, height);

      const numLayers = 10 + Math.floor(audioData.rms * 10); // More layers
      const maxDepth = Math.min(width, height) * 2.0; // Deeper tunnel effect

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1800 - audioData.bpm * 7.0); // More BPM influence
        const depthProgress = ((i / numLayers) + timeFactor * (0.1 + audioData.rms * 0.5 + audioData.bassEnergy * 0.3)) % 1; 

        const scale = depthProgress;
        if (scale < 0.001 || scale > 1) continue; 

        const shapeWidth = width * scale * (0.3 + audioData.bassEnergy * 0.7); // More bass impact on width
        const shapeHeight = height * scale * (0.3 + audioData.midEnergy * 0.7); // More mid impact on height

        const alpha = (1 - depthProgress) * (0.3 + audioData.trebleEnergy * 0.7) * settings.brightCap * 1.8; 
        if (alpha <= 0.005) continue;

        const hue = (depthProgress * 180 + 160 + audioData.rms * 120 + performance.now()/250) % 360; 

        ctx.strokeStyle = `hsla(${hue}, 90%, ${55 + depthProgress * 15}%, ${alpha})`; 
        ctx.lineWidth = Math.max(0.8, (1 - depthProgress) * (8 + (audioData.beat ? 5.5 : 0)) * settings.brightCap); // Thicker lines on beat

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.3) * 0.3; // More reactive rotation
        ctx.rotate( depthProgress * Math.PI * 1.2 + timeFactor * rotationSpeed ); 
        
        // Vary shapes more distinctly
        if (i % 4 === 0) {
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (i % 4 === 1) {
            ctx.beginPath();
            ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (i % 4 === 2) {
            ctx.beginPath();
            for(let k=0; k < 6; k++) { // Hexagon
                 ctx.lineTo( (shapeWidth/2) * Math.cos(k * Math.PI / 3), (shapeHeight/2) * Math.sin(k * Math.PI / 3) );
            }
            ctx.closePath();
            ctx.stroke();
        } else { // Triangle
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

    

