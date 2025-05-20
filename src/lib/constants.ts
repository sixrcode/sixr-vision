
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
  showWebcam: false, // Webcam OFF by default, user explicitly enables via header toggle
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
  aiOverlayPrompt: "Bioluminescent grapevine floating in space, star clusters on its branches, transparent background",
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
    thumbnailUrl: 'https://placehold.co/120x80/4a044e/f0abfc.png?text=Mirror', // Dark purple bg, light pink text
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0,0,width,height);

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;
        const camAspect = camWidth / camHeight;
        const canvasAspect = width / height;

        let sx = 0, sy = 0, sWidth = camWidth, sHeight = camHeight;
        let dx = 0, dy = 0, dWidth = width, dHeight = height;

        if (camAspect > canvasAspect) {
          // Webcam is wider than canvas, fit to canvas height, crop width
          sHeight = camHeight;
          sWidth = camHeight * canvasAspect;
          sx = (camWidth - sWidth) / 2;
        } else {
          // Webcam is taller than canvas (or same aspect), fit to canvas width, crop height
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

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.07 : 0.04})`; // Slower fade for more trails
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.05) { // More sensitive to trigger
        const numShapes = 5 + Math.floor(audioData.rms * 18 + audioData.bassEnergy * 12); // Slightly more shapes
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (15 + audioData.bassEnergy * 150 + Math.random() * 60); // Larger base size
          const size = sizeBase * settings.brightCap * (0.3 + audioData.midEnergy * 0.7);
          if (size < 4) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 10 + i * 35 + audioData.midEnergy * 180) % 360;
          const alpha = (0.3 + audioData.trebleEnergy * 0.9 + audioData.rms * 0.5) * settings.brightCap;

          ctx.fillStyle = `hsla(${hue}, 100%, ${60 + Math.random()*20}%, ${Math.min(1, alpha * 1.2)})`; // Brighter, more saturated
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 700 + i) * (audioData.trebleEnergy * 0.7 + 0.15) );

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
    thumbnailUrl: 'https://placehold.co/120x80/083344/67e8f9.png?text=Rings', // Dark cyan bg, light cyan text
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.48; // Slightly larger max radius

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1})`; // Slower fade
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; // Bass: Red/Orange, Mid: Green/Cyan, Treble: Blue/Purple
      const numSteps = 6 + Math.floor(audioData.rms * 7); // More steps for denser look

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.005) continue;

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (800 / (speedFactor * 0.8 + 0.2)); // Faster movement
            const ringProgress = (time + j * (0.6 / numSteps) * (i + 1.3)) % 1;

            const radius = ringProgress * maxRingRadius * (0.35 + energy * 0.65);
            if (radius < 1) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 2.5; // Brighter alpha
            if (alpha <= 0.01) continue;

            const thickness = (2.5 + energy * 18 + (audioData.beat ? 5.0 : 0)) * settings.brightCap; // Thicker lines
            const hue = (baseHues[i] + ringProgress * 50 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 50 + (audioData.beat ? 20 : 0)) % 360;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${100}%, ${65 + energy*15}%, ${Math.min(1, alpha)})`; // More saturation
            ctx.lineWidth = Math.max(1.5, thickness); // Min thickness increased
            ctx.stroke();
        }
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    thumbnailUrl: 'https://placehold.co/120x80/1e1b4b/a5b4fc.png?text=Grid', // Dark indigo bg, light indigo text
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.35 : 0.3})`; // slightly faster fade
      ctx.fillRect(0, 0, width, height);

      const gridSize = 8 + Math.floor(audioData.rms * 12); // More dynamic grid size
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.5;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 1.9 : 1.0; // Stronger beat reaction
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.25 + audioData.rms * 0.7 + audioData.bassEnergy * 0.35); // Adjusted energy influence
          if (radius < 1.8) continue;

          const hue = (energy * 130 + 170 + (performance.now()/70)*9 + (audioData.beat ? 20:0) ) % 360; // More dynamic hue
          const lightness = 45 + energy * 30; // Brighter
          const alpha = 0.35 + energy * 0.65; // Slightly more opaque base

          // Outer glow
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 4 + energy * 6, 0, Math.PI * 2); // Larger glow
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 15}%, ${alpha * 0.45 * settings.brightCap})`; // Brighter glow
          ctx.fill();

          // Inner core
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha * settings.brightCap})`; // Brighter core
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    thumbnailUrl: 'https://placehold.co/120x80/134e4a/5eead4.png?text=Bars', // Dark teal bg, light teal text
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.9 : 0.85})`; // Slower fade
      ctx.fillRect(0,0,width,height);

      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5);

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);

        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl), 0.2)';
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
        const hue = (i / audioData.spectrum.length) * 130 + 170 + (audioData.beat ? 35 : 0); // Wider hue range
        const saturation = 75 + normalizedValue * 25; // More saturated
        const lightness = 35 + normalizedValue * 45; // Brighter overall

        ctx.fillStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1.5, barHeight); // Slightly thinner gap

        if (normalizedValue > 0.25) { // Lower threshold for glow
          ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${saturation + 15}%, ${lightness + 25}%, 0.45)`; // Brighter, more prominent glow
          ctx.fillRect(i * barWidth, height - barHeight * 1.12, barWidth - 1.5, barHeight * 0.22); // Larger glow
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    thumbnailUrl: 'https://placehold.co/120x80/7c2d12/fdba74.png?text=Burst', // Dark orange bg, light orange text
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.12 : 0.08})`; 
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10; 
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl), 0.18)';
        ctx.lineWidth = 1.5; 
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.015) + (i * Math.min(width, height) * 0.055);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 50 + Math.floor(audioData.rms * 100); 
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 3000) * (i%2 === 0 ? 1 : -1);
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.12 + audioData.midEnergy * 0.28); 
        const currentRadius = maxRadius * (0.2 + energy * 0.8);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.2 + energy * 3.5) * settings.brightCap; 
        const hue = (10 + audioData.bassEnergy * 60 + energy * 60 + (audioData.beat ? 30 : 0)) % 360; // Shifted hue base
        ctx.fillStyle = `hsla(${hue}, ${95 + energy*5}%, ${65 + energy*20}%, ${0.4 + energy * 0.6})`; 
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 120 + Math.floor(audioData.rms * 300 + audioData.bassEnergy * 250); 
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.7) + (audioData.bassEnergy * Math.min(width,height) * 0.35);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.8);
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.8);
          const size = (2.8 + Math.random() * 9 * (audioData.rms + audioData.bassEnergy * 0.8)) * settings.brightCap; 
          const hue = (audioData.bassEnergy * 90 + (Math.random() * 40 - 20) + 360) % 360; 
          ctx.fillStyle = `hsla(${hue}, 100%, ${75 + audioData.trebleEnergy * 20}%, ${0.8 + audioData.midEnergy * 0.2})`; 
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
    thumbnailUrl: 'https://placehold.co/120x80/311b92/b39ddb.png?text=Tunnel', // Deep purple bg, light purple text
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.45 : 0.35})`; // Slightly slower fade
      ctx.fillRect(0, 0, width, height);

      const numLayers = 12 + Math.floor(audioData.rms * 15); // More layers
      const maxDepth = Math.min(width, height) * 2.2; // Deeper tunnel

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1600 - audioData.bpm * 8.0); // Faster base speed, more bpm influence
        const depthProgress = ((i / numLayers) + timeFactor * (0.08 + audioData.rms * 0.6 + audioData.bassEnergy * 0.35)) % 1;

        const scale = depthProgress;
        if (scale < 0.0005 || scale > 1) continue;

        const shapeWidth = width * scale * (0.25 + audioData.bassEnergy * 0.75); // Bass influences width more
        const shapeHeight = height * scale * (0.25 + audioData.midEnergy * 0.75); // Mid influences height more

        const alpha = (1 - depthProgress) * (0.35 + audioData.trebleEnergy * 0.65) * settings.brightCap * 2.0; // Treble influences alpha
        if (alpha <= 0.003) continue;

        const hue = (depthProgress * 190 + 150 + audioData.rms * 130 + performance.now()/220) % 360; // More dynamic hue

        ctx.strokeStyle = `hsla(${hue}, 95%, ${60 + depthProgress * 20}%, ${alpha})`; // Brighter, more saturated
        ctx.lineWidth = Math.max(1.0, (1 - depthProgress) * (10 + (audioData.beat ? 6.5 : 0)) * settings.brightCap); // Thicker lines on beat

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.25) * 0.35; // More sensitive rotation
        ctx.rotate( depthProgress * Math.PI * 1.3 + timeFactor * rotationSpeed );

        const shapeTypeIndex = (i + Math.floor(timeFactor*2)) % 4; // Cycle through shapes over time
        if (shapeTypeIndex === 0) {
             ctx.strokeRect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
        } else if (shapeTypeIndex === 1) {
            ctx.beginPath();
            ctx.ellipse(0,0, shapeWidth/2, shapeHeight/2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (shapeTypeIndex === 2) {
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
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/f1f5f9/1e293b.png?text=Strobe', // Light gray bg, dark slate text
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      if (audioData.beat && audioData.rms > 0.03) {
        const intensity = Math.min(1, (0.45 + audioData.rms * 0.8 + audioData.bassEnergy * 0.6) * settings.brightCap);
        const hue = (audioData.bassEnergy * 130 + audioData.midEnergy * 50 + performance.now()/60) % 360;
        const saturation = 35 + audioData.trebleEnergy * 65;
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${80 + audioData.rms * 10}%, ${intensity * 1.1})`;

         if (Math.random() < 0.4) {
            ctx.fillStyle = `hsla(${(hue + 150 + Math.random()*70-35)%360}, ${saturation*0.75}%, 95%, ${intensity * 0.65})`;
            ctx.fillRect(0, 0, width, height);
         } else {
            ctx.fillRect(0, 0, width, height);
         }

      } else {
        // Fill with fully opaque background color when no beat
        ctx.fillStyle = `hsl(var(--background-hsl))`;
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80/701a75/fdf4ff.png?text=Finale', // Dark magenta bg, very light pink text
    dataAiHint: 'grand particle explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      const MAX_AMBIENT_PARTICLES = 60; 
      const MAX_BURST_PARTICLES = 180; 

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 25 + Math.floor(audioData.rms * 50)); 
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.7 + 0.05) { 
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (0.7 + Math.random() * 3.0 * (audioData.midEnergy + audioData.trebleEnergy * 0.5)) * settings.brightCap; 
          const hue = (120 + Math.random() * 260 + audioData.trebleEnergy * 70 + performance.now()/160) % 360; 
          const lightness = 50 + Math.random() * 20; 
          const alpha = (0.1 + Math.random() * 0.4 * audioData.rms) * settings.brightCap * 1.1; 
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 60 + Math.floor(audioData.bassEnergy * 90 + audioData.rms * 70)); 
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.55 * (0.25 + audioData.bassEnergy * 0.3 + audioData.rms * 0.25);
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.7 + 0.25);
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.7 + 0.25);
          const size = (1.5 + Math.random() * 7.0 * (audioData.bassEnergy * 1.1 + audioData.rms * 0.8)) * settings.brightCap; 

          const hue = ((audioData.bassEnergy * 60) + (Math.random() * 100) - 40 + 360 + performance.now()/90) % 360; 
          const lightness = 55 + Math.random() * 20; 
          const alpha = (0.55 + Math.random() * 0.35) * settings.brightCap * 1.05; 

          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

    