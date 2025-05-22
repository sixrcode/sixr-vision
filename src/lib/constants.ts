

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
  showWebcam: false, // Will be turned on by ControlPanelView's useEffect on load
  mirrorWebcam: true, 
  currentSceneId: 'radial_burst', // Default scene
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: 'rgb(235, 26, 115)', // Corresponds to SIXR_X_COLOR
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false, 
  selectedAudioInputDeviceId: undefined, 

  // AI Visual Overlay Mixer Defaults
  enableAiOverlay: false, // Will be enabled by AiVisualOverlayMixer after initial generation
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "bioluminescent cosmic vines connecting distant stars, transparent background",
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
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    thumbnailUrl: 'https://placehold.co/120x80/4a044e/f0abfc.png?text=Mirror',
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0,0,width,height);

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;

        let sx = 0, sy = 0, sWidth = camWidth, sHeight = camHeight;
        let dx = 0, dy = 0, dWidth = width, dHeight = height;

        const canvasAspect = width / height;
        const videoAspect = camWidth / camHeight;

        if (videoAspect > canvasAspect) { // Video is wider than canvas -> fit height, crop width (cover)
            sHeight = camHeight;
            sWidth = camHeight * canvasAspect;
            sx = (camWidth - sWidth) / 2;
        } else { // Video is taller or same aspect as canvas -> fit width, crop height (cover)
            sWidth = camWidth;
            sHeight = camWidth / canvasAspect;
            sy = (camHeight - sHeight) / 2;
        }
        dx = 0;
        dy = 0;
        dWidth = width;
        dHeight = height;
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));
        ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        ctx.restore(); 

        ctx.globalCompositeOperation = 'difference';
        const energyColor = (audioData.bassEnergy * 180 + audioData.midEnergy * 120 + audioData.trebleEnergy * 60 + performance.now()/50) % 360;
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
            ctx.drawImage(webcamFeed, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            ctx.filter = 'none';
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
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
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    thumbnailUrl: 'https://placehold.co/120x80/4f46e5/a5b4fc.png?text=Echoes',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.05 : 0.03})`;
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.03) {
        const numShapes = 8 + Math.floor(audioData.rms * 25 + audioData.bassEnergy * 18);
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (20 + audioData.bassEnergy * 180 + Math.random() * 80);
          const size = sizeBase * settings.brightCap * (0.4 + audioData.midEnergy * 0.6);
          if (size < 5) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 15 + i * 30 + audioData.midEnergy * 200) % 360;
          const alpha = (0.4 + audioData.trebleEnergy * 0.8 + audioData.rms * 0.6) * settings.brightCap;

          ctx.fillStyle = `hsla(${hue}, 100%, ${65 + Math.random()*25}%, ${Math.min(1, alpha * 1.3)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 600 + i) * (audioData.trebleEnergy * 0.8 + 0.2) );

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
    id: 'frequency_rings',
    name: 'Frequency Rings',
    thumbnailUrl: 'https://placehold.co/120x80/083344/67e8f9.png?text=Rings',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.50;

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.12 : 0.08})`;
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; // Bass=Red-ish, Mid=Green-ish, Treble=Blue-ish
      const numSteps = 8 + Math.floor(audioData.rms * 10); 

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.003) continue;

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (700 / (speedFactor * 0.7 + 0.3)); 
            const ringProgress = (time + j * (0.7 / numSteps) * (i + 1.5)) % 1; 

            const radius = ringProgress * maxRingRadius * (0.3 + energy * 0.7); 
            if (radius < 1.5) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 2.8; 
            if (alpha <= 0.005) continue;

            const thickness = (3 + energy * 22 + (audioData.beat ? 6.0 : 0)) * settings.brightCap; 
            const hue = (baseHues[i] + ringProgress * 60 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 60 + (audioData.beat ? 25 : 0)) % 360;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${100}%, ${70 + energy*10}%, ${Math.min(1, alpha)})`;
            ctx.lineWidth = Math.max(1.8, thickness); 
            ctx.stroke();
        }
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    thumbnailUrl: 'https://placehold.co/120x80/1e1b4b/a5b4fc.png?text=Grid',
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.3 : 0.25})`; 
      ctx.fillRect(0, 0, width, height);

      const gridSize = 10 + Math.floor(audioData.rms * 15); 
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.4; 

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255; 

          const beatFactor = audioData.beat ? 2.2 : 1.0; 
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;
          
          const radius = maxRadius * energy * settings.brightCap * (0.3 + audioData.rms * 0.75 + audioData.bassEnergy * 0.4);
          if (radius < 2.0) continue; 

          const hue = (energy * 140 + 160 + (performance.now()/60)*10 + (audioData.beat ? 25:0) ) % 360;
          const lightness = 50 + energy * 25; 
          const alpha = 0.4 + energy * 0.6; 

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 5 + energy * 8, 0, Math.PI * 2); 
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 18}%, ${alpha * 0.5 * settings.brightCap})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap * 1.1})`; 
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    thumbnailUrl: 'https://placehold.co/120x80/134e4a/5eead4.png?text=Bars',
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))'; // Solid background
      ctx.fillRect(0,0,width,height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      // Slightly more tolerant silence check
      const isAudioSilent = audioData.rms < 0.005 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.8);


      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl), 0.2)';
        ctx.lineWidth = 1;
        for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - (height * 0.05), barWidth -2, (height * 0.05)); // Draw tiny placeholder bars
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      // Ensure brightCap doesn't make visuals disappear if set to 0
      const effectiveBrightCap = Math.max(0.05, settings.brightCap); 

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        // Scale barHeight more effectively with brightCap and ensure a minimum visibility
        const barHeight = Math.max(1, normalizedValue * height * effectiveBrightCap * 1.2); 
        const hue = (i / audioData.spectrum.length) * 140 + 160 + (audioData.beat ? 40 : 0);
        const saturation = 80 + normalizedValue * 20;
        const lightness = 40 + normalizedValue * 40;

        ctx.fillStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1.2, barHeight);

        // Highlight effect for stronger signals
        if (normalizedValue > 0.3) { 
          ctx.fillStyle = `hsla(${(hue + 30) % 360}, ${saturation + 10}%, ${lightness + 28}%, 0.6)`;
          // Make highlight taller and slightly offset for more pop
          ctx.fillRect(i * barWidth, height - barHeight * 1.1, barWidth - 1.2, barHeight * 0.2); 
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    thumbnailUrl: 'https://placehold.co/120x80/7c2d12/fdba74.png?text=Burst',
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      // Slightly faster fade for more distinct bursts
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.12})`; 
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 12;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl), 0.15)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.012) + (i * Math.min(width, height) * 0.05);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 60 + Math.floor(audioData.rms * 120);
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2800) * (i%2 === 0 ? 1 : -1);
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.1 + audioData.midEnergy * 0.3);
        const currentRadius = maxRadius * (0.25 + energy * 0.75);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.5 + energy * 4.0) * settings.brightCap;
        const hue = (20 + audioData.bassEnergy * 50 + energy * 70 + (audioData.beat ? 35 : 0)) % 360;
        ctx.fillStyle = `hsla(${hue}, ${90 + energy*10}%, ${60 + energy*25}%, ${0.45 + energy * 0.55})`;
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 150 + Math.floor(audioData.rms * 350 + audioData.bassEnergy * 300);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.75) + (audioData.bassEnergy * Math.min(width,height) * 0.4);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.9);
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.9);
          const size = (3.0 + Math.random() * 10 * (audioData.rms + audioData.bassEnergy * 0.9)) * settings.brightCap;
          const hue = (audioData.bassEnergy * 80 + (Math.random() * 50 - 25) + 360) % 360; 
          ctx.fillStyle = `hsla(${hue}, 100%, ${70 + audioData.trebleEnergy * 25}%, ${0.75 + audioData.midEnergy * 0.25})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    thumbnailUrl: 'https://placehold.co/120x80/311b92/b39ddb.png?text=Tunnel',
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.4 : 0.3})`;
      ctx.fillRect(0, 0, width, height);

      const numLayers = 15 + Math.floor(audioData.rms * 18); 
      
      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1500 - audioData.bpm * 7.5); 
        const depthProgress = ((i / numLayers) + timeFactor * (0.1 + audioData.rms * 0.65 + audioData.bassEnergy * 0.4)) % 1;

        const scale = depthProgress;
        if (scale < 0.0003 || scale > 1) continue; 

        const shapeWidth = width * scale * (0.3 + audioData.bassEnergy * 0.7);
        const shapeHeight = height * scale * (0.3 + audioData.midEnergy * 0.7);
        
        const alpha = (1 - depthProgress) * (0.4 + audioData.trebleEnergy * 0.6) * settings.brightCap * 2.2;
        if (alpha <= 0.002) continue; 

        const hue = (depthProgress * 200 + 140 + audioData.rms * 140 + performance.now()/200) % 360;

        ctx.strokeStyle = `hsla(${hue}, 98%, ${65 + depthProgress * 15}%, ${alpha})`;
        ctx.lineWidth = Math.max(1.2, (1 - depthProgress) * (12 + (audioData.beat ? 7.5 : 0)) * settings.brightCap);

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.2) * 0.4; 
        ctx.rotate( depthProgress * Math.PI * 1.4 + timeFactor * rotationSpeed );

        const shapeTypeIndex = (i + Math.floor(timeFactor*2.5)) % 4; 
        if (shapeTypeIndex === 0) { 
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (shapeTypeIndex === 1) { 
            ctx.beginPath();
            ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (shapeTypeIndex === 2) { 
            ctx.beginPath();
            for(let k=0; k < 6; k++) {
                 ctx.lineTo( (shapeWidth/2) * Math.cos(k * Math.PI / 3), (shapeHeight/2) * Math.sin(k * Math.PI / 3) );
            }
            ctx.closePath();
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
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/f1f5f9/1e293b.png?text=Strobe',
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      if (audioData.beat) {
        const flashOpacity = settings.brightCap; 
        if (flashOpacity > 0.01) { 
            const hue = (performance.now() / 50) % 360; 
            ctx.fillStyle = `hsla(${hue}, 80%, 90%, ${flashOpacity})`;
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = `hsl(var(--background-hsl))`;
            ctx.fillRect(0, 0, width, height);
        }
      } else {
        ctx.fillStyle = `hsl(var(--background-hsl))`;
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80/701a75/fdba74.png?text=Finale', // Updated hint
    dataAiHint: 'grand particle explosion confetti fireworks', // More descriptive
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      // Slower fade for more prominent trails
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.12})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      // Increased base and capped max for more particles
      const MAX_AMBIENT_PARTICLES = 500; // Was 250
      const MAX_BURST_PARTICLES = 1200;  // Was 700

      // Ambient particles reacting to overall RMS and mid/treble energy
      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 100 + Math.floor(audioData.rms * 250 + audioData.midEnergy * 150 + audioData.trebleEnergy * 100));
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.85 + 0.20) { // Higher chance to draw ambient particles
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (1.5 + Math.random() * 5.0 * (audioData.midEnergy + audioData.trebleEnergy * 0.8)) * settings.brightCap;
          const hue = (150 + Math.random() * 360 + audioData.trebleEnergy * 120 + performance.now()/100) % 360; 
          const lightness = 65 + Math.random() * 25;
          const alpha = (0.3 + Math.random() * 0.7 * (audioData.rms + 0.15)) * settings.brightCap * 1.4; 
          ctx.fillStyle = `hsla(${hue}, 98%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Beat-triggered bursts, more particles and more reactive
      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 300 + Math.floor(audioData.bassEnergy * 700 + audioData.rms * 500)); // Increased multipliers
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.80 * (0.3 + audioData.bassEnergy * 0.6 + audioData.rms * 0.5); // Wider bursts
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.8 + 0.7); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.8 + 0.7);
          const size = (3.0 + Math.random() * 15.0 * (audioData.bassEnergy * 1.5 + audioData.rms * 1.2)) * settings.brightCap; // Larger potential size

          const hue = ((audioData.bassEnergy * 100) + (Math.random() * 80) - 40 + 360 + performance.now()/60) % 360; // More dynamic hue
          const lightness = 70 + Math.random() * 20; // Brighter
          const alpha = (0.80 + Math.random() * 0.25) * settings.brightCap * 1.2; 

          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, size), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

    