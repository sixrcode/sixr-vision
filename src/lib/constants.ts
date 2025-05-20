
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
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/7dd3fc.png?text=Bars', // Sky blue on dark blue/purple
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/facc15.png?text=Burst', // Amber on dark grey
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.2 : 0.15})`; // Slightly faster fade for trails
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const isAudioSilent = audioData.rms < 0.01 && audioData.spectrum.every(v => v < 5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 8; // Reduced slightly
        ctx.strokeStyle = 'hsla(var(--muted-foreground), 0.15)'; // Slightly more visible
        ctx.lineWidth = 1;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.02) + (i * Math.min(width, height) * 0.05);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      const numStaticParticles = 40 + Math.floor(audioData.rms * 60); // Increased density
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 4000) * (i%2 === 0 ? 1 : -1); // Slightly faster passive rotation
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.2); // More expansive
        const currentRadius = maxRadius * (0.2 + energy * 0.8);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (0.8 + energy * 2.5) * settings.brightCap; // Slightly larger particles
        const hue = 180 + energy * 80 + (audioData.beat ? 20 : 0); // Shift hue towards blue/purple, more reactive to beat
        ctx.fillStyle = `hsla(${hue % 360}, ${90 + energy*10}%, ${55 + energy*25}%, ${0.3 + energy * 0.6})`;
        ctx.beginPath();
        ctx.arc(x,y,particleSize,0, Math.PI*2);
        ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 80 + Math.floor(audioData.rms * 200 + audioData.bassEnergy * 150); // More particles on beat
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.6) + (audioData.bassEnergy * Math.min(width,height) * 0.25); // Wider spread
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.6); // More outward velocity
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.6);
          const size = (2 + Math.random() * 7 * (audioData.rms + audioData.bassEnergy * 0.6)) * settings.brightCap; // Larger beat particles
          const hueBase = 30 + (audioData.bassEnergy * 60); // Shift towards orange/red for bass beats
          const hue = (hueBase + Math.random()*40 - 20 + performance.now()/50) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${65 + audioData.trebleEnergy * 30}%, ${0.7 + audioData.midEnergy * 0.3})`; // Brighter and more opaque beat particles
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/a78bfa.png?text=Mirror', // Lavender on dark grey
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
        const camAspectRatio = camWidth / camHeight;
        const canvasAspectRatio = width / height;

        let drawWidth, drawHeight, dx, dy;

        if (canvasAspectRatio > camAspectRatio) {
            drawHeight = height;
            drawWidth = drawHeight * camAspectRatio;
            dx = (width - drawWidth) / 2;
            dy = 0;
        } else {
            drawWidth = width;
            drawHeight = drawWidth / camAspectRatio;
            dx = 0;
            dy = (height - drawHeight) / 2;
        }
        
        ctx.save();
        if (settings.mirrorWebcam) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
           // Adjust dx for mirroring if it's not 0
           if (dx !== 0 && canvasAspectRatio > camAspectRatio) dx = (width - drawWidth) / 2; // This needs to be re-calculated based on the non-mirrored origin
           // No change if dx is 0 (canvas is narrower or same aspect as cam)
        }

        ctx.globalAlpha = Math.max(0.1, settings.brightCap * (0.7 + audioData.rms * 0.3)); // Ensure webcam is somewhat visible
        ctx.drawImage(webcamFeed, dx, dy, drawWidth, drawHeight);
        ctx.restore(); 

        ctx.globalCompositeOperation = 'difference';
        const energyColor = (audioData.bassEnergy * 180 + audioData.midEnergy * 120 + audioData.trebleEnergy * 60 + performance.now()/50) % 360;
        const differenceAlpha = Math.min(1, (0.9 + audioData.rms * 0.2 + (audioData.beat ? 0.15 : 0)) * settings.brightCap);
        ctx.fillStyle = `hsla(${energyColor}, 90%, 70%, ${differenceAlpha})`; // Brighter, more saturated fill
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        if (audioData.trebleEnergy > 0.15 && settings.brightCap > 0.1) {
            ctx.save();
            if (settings.mirrorWebcam) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
              if (dx !== 0 && canvasAspectRatio > camAspectRatio) dx = (width - drawWidth) / 2;
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = audioData.trebleEnergy * 0.6 * settings.brightCap;
            ctx.filter = `blur(${3 + audioData.trebleEnergy * 5}px) brightness(1.4)`; // Stronger glow
            ctx.drawImage(webcamFeed, dx, dy, drawWidth, drawHeight);
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/f472b6.png?text=Finale', // Pink on dark grey
    dataAiHint: 'particle fireworks explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.1 : 0.08})`; // Slower fade for more trails
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const MAX_AMBIENT_PARTICLES = 150; // Increased cap
      const MAX_BURST_PARTICLES = 400;  // Increased cap

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 70 + Math.floor(audioData.rms * 150)); // More ambient particles
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.8 + 0.1) { // More likely to draw ambient particles
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (0.8 + Math.random() * 3.5 * (audioData.midEnergy + audioData.trebleEnergy * 0.6)) * settings.brightCap;
          const hue = (160 + Math.random() * 200 + audioData.trebleEnergy * 70 + performance.now()/150) % 360; // Wider hue range
          const lightness = 55 + Math.random() * 30; // Brighter
          const alpha = (0.15 + Math.random() * 0.5 * audioData.rms) * settings.brightCap;
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 200 + Math.floor(audioData.bassEnergy * 200 + audioData.rms * 150)); // More burst particles
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          // More explosive radius, less dependent on just RMS
          const radius = Math.random() * Math.min(width, height) * 0.60 * (0.5 + audioData.bassEnergy * 0.5 + audioData.rms * 0.3);
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.8 + 0.5); // More varied spread
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.8 + 0.5);
          const size = (2 + Math.random() * 8 * (audioData.bassEnergy * 1.2 + audioData.rms * 0.9)) * settings.brightCap; // Bigger particles

          const hue = ((audioData.bassEnergy * 60) + (Math.random() * 100) - 40 + 360 + performance.now()/80) % 360; // More varied beat hues
          const lightness = 60 + Math.random() * 25;
          const alpha = (0.6 + Math.random() * 0.4) * settings.brightCap; // More opaque

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
    thumbnailUrl: 'https://placehold.co/120x80/1a1a2e/fb923c.png?text=Grid', // Orange on dark
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background), 0.6)`; // Slightly slower fade for smoother pulse
      ctx.fillRect(0, 0, width, height);

      const gridSize = 10 + Math.floor(audioData.rms * 10); // Fewer cells for larger pulses
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.8; // Larger potential radius

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;

          const beatFactor = audioData.beat ? 1.8 : 1.0; // Stronger beat pulse
          const maxRadius = maxRadiusBase * beatFactor;

          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.4 + audioData.rms * 0.6 + audioData.bassEnergy * 0.3);
          if (radius < 1.5) continue; // Slightly larger min radius

          const hue = (energy * 120 + 200 + (performance.now()/80)*10) % 360; // Faster color cycle, more impact from energy
          const lightness = 40 + energy * 35; // Brighter potential
          const alpha = 0.3 + energy * 0.7; // More opaque

          // Outer glow
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 3 + energy * 5, 0, Math.PI * 2); // Larger glow
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 10}%, ${alpha * 0.4 * settings.brightCap})`;
          ctx.fill();

          // Inner core
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
    thumbnailUrl: 'https://placehold.co/120x80/000000/4ade80.png?text=Rings', // Green on black
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45; // Slightly smaller max to avoid edge clipping

      ctx.fillStyle = `hsla(var(--background), 0.25)`; // Slightly faster fade
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      const baseHues = [0, 120, 240]; 
      const numSteps = 5 + Math.floor(audioData.rms * 5); // More steps for more rings

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        if (energy < 0.02) continue; // Slightly higher threshold

        for (let j = 0; j < numSteps; j++) {
            const speedFactor = settings.enableAgc ? 1.0 : settings.gain;
            const time = performance.now() / (1200 / (speedFactor * 0.7 + 0.3)); // Faster overall pulse
            const ringProgress = (time + j * (0.5 / numSteps) * (i + 1)) % 1;

            const radius = ringProgress * maxRingRadius * (0.4 + energy * 0.6); // More reactive radius
            if (radius < 1) continue;

            const alpha = (1 - ringProgress) * energy * settings.brightCap * 2.0; // Potentially brighter
            if (alpha <= 0.01) continue;

            const thickness = (2 + energy * 15 + (audioData.beat ? 4 : 0)) * settings.brightCap; // Thicker rings, more beat reaction
            const hue = (baseHues[i] + ringProgress * 40 + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 40 + (audioData.beat ? 15 : 0)) % 360; // Beat hue shift

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue}, ${95 + energy*5}%, ${60 + energy*20}%, ${Math.min(1, alpha)})`; // More saturated, brighter
            ctx.lineWidth = Math.max(1, thickness);
            ctx.stroke();
        }
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/e5e5e5/171717.png?text=Strobe', // Light grey on dark grey
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      if (audioData.beat && audioData.rms > 0.05) { // Added RMS check to avoid strobing on tiny beats in silence
        const intensity = Math.min(1, (0.5 + audioData.rms * 0.7 + audioData.bassEnergy * 0.5) * settings.brightCap);
        const hue = (audioData.bassEnergy * 120 + audioData.midEnergy * 40 + performance.now()/70) % 360; // More color variation
        const saturation = 30 + audioData.trebleEnergy * 70; // More saturation based on treble
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${75 + audioData.rms * 20}%, ${intensity})`; // Slightly less max brightness for safety
        ctx.fillRect(0, 0, width, height);

         if (Math.random() < 0.35) { // Slightly higher chance of secondary flash
            ctx.fillStyle = `hsla(${(hue + 180 + Math.random()*60-30)%360}, ${saturation}%, 95%, ${intensity * 0.6})`; // Brighter secondary
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
    thumbnailUrl: 'https://placehold.co/120x80/4f46e5/a5b4fc.png?text=Echo', // Indigo on light indigo
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.1 : 0.07})`; // Even longer trails
      ctx.fillRect(0, 0, width, height);

      if (audioData.beat || audioData.rms > 0.1) { // Trigger on beat or sustained RMS
        const numShapes = 3 + Math.floor(audioData.rms * 12 + audioData.bassEnergy * 7); // More shapes
        for (let i = 0; i < numShapes; i++) {
          const sizeBase = (10 + audioData.bassEnergy * 120 + Math.random() * 50); // Larger base
          const size = sizeBase * settings.brightCap * (0.4 + audioData.midEnergy * 0.6);
          if (size < 3) continue;

          const x = Math.random() * width;
          const y = Math.random() * height;
          const hue = (performance.now() / 12 + i * 40 + audioData.midEnergy * 150) % 360; // Faster hue cycle
          const alpha = (0.25 + audioData.trebleEnergy * 0.8 + audioData.rms * 0.4) * settings.brightCap; // More alpha impact

          ctx.fillStyle = `hsla(${hue}, 100%, ${55 + Math.random()*20}%, ${Math.min(1, alpha)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 800 + i) * (audioData.trebleEnergy * 0.6 + 0.1) ); // Slightly faster rotation

          const shapeType = Math.random();
          if (shapeType < 0.4) { // Circle
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (shapeType < 0.8) { // Square
            ctx.fillRect(-size / 2, -size / 2, size, size);
          } else { // Triangle
            ctx.beginPath();
            ctx.moveTo(0, -size/1.8); // Adjusted for better centering
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
    thumbnailUrl: 'https://placehold.co/120x80/0f2027/203a43.png?text=Tunnel', // Dark blue gradient
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.6 : 0.5})`; // Slightly faster fade for tunnel clarity
      ctx.fillRect(0, 0, width, height);

      const numLayers = 10 + Math.floor(audioData.rms * 10); // More layers for density
      const maxDepth = Math.min(width, height) * 2.0; // Deeper tunnel illusion

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (2000 - audioData.bpm * 7); // Faster movement with BPM
        const depthProgress = ((i / numLayers) + timeFactor * (0.1 + audioData.rms * 0.5 + audioData.bassEnergy * 0.3)) % 1; // More reactive speed

        const scale = depthProgress;
        if (scale < 0.002 || scale > 1) continue; // Adjusted scale guard

        const shapeWidth = width * scale * (0.3 + audioData.bassEnergy * 0.7); // More bass impact on width
        const shapeHeight = height * scale * (0.3 + audioData.midEnergy * 0.7); // More mid impact on height

        const alpha = (1 - depthProgress) * (0.3 + audioData.trebleEnergy * 0.7) * settings.brightCap * 1.8; // Brighter alpha
        if (alpha <= 0.005) continue;

        const hue = (depthProgress * 180 + 180 + audioData.rms * 120 + performance.now()/250) % 360; // More dynamic hue

        ctx.strokeStyle = `hsla(${hue}, 95%, ${55 + depthProgress * 20}%, ${alpha})`; // Brighter, more saturated
        ctx.lineWidth = Math.max(0.8, (1 - depthProgress) * (8 + (audioData.beat ? 5 : 0)) * settings.brightCap); // Thicker lines, more beat reaction

        ctx.save();
        ctx.translate(centerX, centerY);
        const rotationSpeed = (audioData.trebleEnergy - 0.4) * 0.3; // More rotation
        ctx.rotate( depthProgress * Math.PI + timeFactor * rotationSpeed ); // Add base rotation + reactive rotation
        
        // Alternate shapes
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

