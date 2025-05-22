
import type { Settings, SceneDefinition, AudioData } from '@/types';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF "Cosmic Grapevines" Themed Defaults
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
    color: '#FF441A', // SBNF Orange-Red for solid/blink if used
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,

  // AI Visual Overlay Mixer Settings - SBNF Themed
  enableAiOverlay: false,
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

// SBNF Colors for Placeholders:
// BG: #5A36BB (Deep Purple), FG: #FFECDA (Light Peach/Cream)
// Accent1: #FF441A (Orange-Red), Accent2: #FDB143 (Orange-Yellow), Accent3: #E1CCFF (Light Lavender)
// Black: #000000

export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror',
    dataAiHint: 'silhouette reflection webcam',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0,0,width,height);

      if (webcamFeed && settings.showWebcam && webcamFeed.readyState >= webcamFeed.HAVE_METADATA && webcamFeed.videoWidth > 0 && webcamFeed.videoHeight > 0) {
        const camWidth = webcamFeed.videoWidth;
        const camHeight = webcamFeed.videoHeight;
        
        const canvasAspect = width / height;
        const videoAspect = camWidth / camHeight;
        let sx = 0, sy = 0, sWidth = camWidth, sHeight = camHeight;

        if (canvasAspect > videoAspect) { // Canvas is wider than video, fit to height
            sHeight = camHeight;
            sWidth = camHeight * canvasAspect;
            sx = (camWidth - sWidth) / 2;
        } else { // Canvas is taller or same aspect as video, fit to width
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
        // SBNF Base Hue: Orange-Yellow (36), Primary Orange-Red (13), Lavender (267)
        const sbnfHueOptions = [36, 13, 267];
        const baseAccentHue = sbnfHueOptions[Math.floor(Math.random() * sbnfHueOptions.length)];

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
        ctx.font = `16px ${getComputedStyle(ctx.canvas).fontFamily.split(',')[0].trim() || 'var(--font-poppins)'}`;
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes',
    dataAiHint: 'glowing orbs abstract shapes',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.08 : 0.05})`;
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
          const hueOptions = [13, 36, 267]; 
          const baseSBNFHue = hueOptions[(i + Math.floor(performance.now()/1000)) % hueOptions.length];
          const hue = (baseSBNFHue + audioData.trebleEnergy * 30 + Math.random()*20) % 360;
          const alpha = (0.3 + audioData.trebleEnergy * 0.7 + audioData.rms * 0.5) * settings.brightCap;

          ctx.fillStyle = `hsla(${hue}, ${80 + Math.random()*20}%, ${60 + Math.random()*20}%, ${Math.min(1, alpha * 1.2)})`;
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate( (performance.now() / 500 + i) * (audioData.trebleEnergy * 0.7 + 0.3) );

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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings',
    dataAiHint: 'frequency audio rings',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRingRadius = Math.min(width, height) * 0.45;

      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1})`;
      ctx.fillRect(0, 0, width, height);

      const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
      // SBNF Hues: Bass -> Orange-Red (13), Mid -> Orange-Yellow (36), Treble -> Lavender (267)
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
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid',
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.28 : 0.22})`;
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

          // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267), Deep Purple (258)
          const hueOptions = [13, 36, 267, 258]; 
          const baseSBNFHue = hueOptions[ (i*gridSize + j + Math.floor(performance.now()/2000)) % hueOptions.length ];
          const hue = (baseSBNFHue + energy * 60 + (performance.now()/70)*10 + (audioData.beat ? 20:0) ) % 360;
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars', // SBNF BG, Accent 2
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))'; // Solid background
      ctx.fillRect(0,0,width,height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);


      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${getComputedStyle(ctx.canvas).fontFamily.split(',')[0].trim() || 'var(--font-poppins)'}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);

        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.2)';
        ctx.lineWidth = 1;
        for(let i=0; i < audioData.spectrum.length; i++) {
            ctx.strokeRect(i * barWidth, height - (height * 0.05), barWidth -2, (height * 0.05));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap); 
      // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267), Deep Purple (258)
      const hueCycle = [13, 36, 267, 258];

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeight = Math.max(1, normalizedValue * height * effectiveBrightCap * 1.1);

        const hueIndex = Math.floor((i / audioData.spectrum.length) * hueCycle.length);
        const baseHue = hueCycle[(hueIndex + Math.floor(performance.now()/3000)) % hueCycle.length]; // Shift base hue over time
        const hue = (baseHue + normalizedValue * 30 + (audioData.beat ? 20 : 0)) % 360;

        const saturation = 85 + normalizedValue * 15;
        const lightness = 40 + normalizedValue * 35;

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1.2, barHeight);

        if (normalizedValue > 0.35) { // Add a brighter tip to taller bars
          ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${saturation + 10}%, ${lightness + 25}%, 0.65)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.05, barWidth - 1.2, barHeight * 0.25);
        }
      });
    },
  },
   {
    id: 'radial_burst',
    name: 'Radial Burst',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst', // SBNF Accent 1, Black
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.15})`;
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;
      // SBNF Hues for particles: Orange-Red (13), Orange-Yellow (36), Lavender (267), Deep Purple (258)
      const sbnfHues = [13, 36, 267, 258];

      if (isAudioSilent) {
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = `16px ${getComputedStyle(ctx.canvas).fontFamily.split(',')[0].trim() || 'var(--font-poppins)'}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl-raw), 0.15)';
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
        const hue = (sbnfHues[(i + Math.floor(performance.now()/2500)) % sbnfHues.length] + energy * 40 + (audioData.beat ? 25 : 0)) % 360;
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel', // SBNF BG, Accent 1
    dataAiHint: 'geometric tunnel flight',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.35 : 0.28})`;
      ctx.fillRect(0, 0, width, height);

      const numLayers = 12 + Math.floor(audioData.rms * 15);
      // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267), Deep Purple (258)
      const sbnfHues = [13, 36, 267, 258];

      for (let i = 0; i < numLayers; i++) {
        const timeFactor = performance.now() / (1600 - audioData.bpm * 7.0);
        const depthProgress = ((i / numLayers) + timeFactor * (0.08 + audioData.rms * 0.6 + audioData.bassEnergy * 0.35)) % 1;

        const scale = depthProgress;
        if (scale < 0.0005 || scale > 1) continue;

        const shapeWidth = width * scale * (0.25 + audioData.bassEnergy * 0.65);
        const shapeHeight = height * scale * (0.25 + audioData.midEnergy * 0.65);

        const alpha = (1 - depthProgress) * (0.35 + audioData.trebleEnergy * 0.65) * settings.brightCap * 2.0;
        if (alpha <= 0.005) continue;

        const hue = (sbnfHues[(i + Math.floor(performance.now()/1500)) % sbnfHues.length] + depthProgress * 150 + audioData.rms * 100 + performance.now()/250) % 360;

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
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe', // SBNF FG, Black
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267)
        const hueOptions = [13, 36, 267, 258, 30, 0]; // Added more SBNF accents for variety
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        ctx.fillStyle = `hsla(${hue}, 100%, ${85 + Math.random() * 15}%, ${settings.brightCap})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = 'hsl(var(--background-hsl))'; // Solid dark background
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale', // SBNF Accent 2, BG
    dataAiHint: 'grand particle explosion fireworks',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsla(var(--background-hsl-raw), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.12 : 0.08})`; // Faster fade for clarity
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const MAX_AMBIENT_PARTICLES = 2500; // Increased cap
      const MAX_BURST_PARTICLES = 5000;  // Increased cap
      // SBNF Hues: Orange-Red (13), Orange-Yellow (36), Lavender (267), Deep Purple (258)
      const sbnfHues = [13, 36, 267, 258, 330, 30]; // Added more SBNF accents

      const ambientParticleCount = Math.min(MAX_AMBIENT_PARTICLES, 200 + Math.floor(audioData.rms * 600 + audioData.midEnergy * 350 + audioData.trebleEnergy * 200)); // Increased multipliers
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.85 + 0.10) { // Slightly higher base chance
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = (1.5 + Math.random() * 5.5 * (audioData.midEnergy + audioData.trebleEnergy * 0.8)) * settings.brightCap; // Slightly larger
          const hue = (sbnfHues[(i + Math.floor(performance.now()/1000)) % sbnfHues.length] + Math.random() * 70 - 35 + performance.now()/100) % 360; // Faster hue cycle
          const lightness = 55 + Math.random() * 30; // Brighter range
          const alpha = (0.30 + Math.random() * 0.70 * (audioData.rms + 0.15)) * settings.brightCap * 1.4;
          ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
        }
      }

      if (audioData.beat) {
        const burstParticleCount = Math.min(MAX_BURST_PARTICLES, 700 + Math.floor(audioData.bassEnergy * 1800 + audioData.rms * 1200)); // Increased multipliers
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.80 * (0.30 + audioData.bassEnergy * 0.60 + audioData.rms * 0.50);
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.75 + 0.55);
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.75 + 0.55);
          const size = (2.5 + Math.random() * 15.0 * (audioData.bassEnergy * 1.4 + audioData.rms * 1.2)) * settings.brightCap; // Larger max size

          const hue = (sbnfHues[ (i + Math.floor(audioData.bassEnergy*15)) % sbnfHues.length ] + (Math.random() * 80) - 40 + performance.now()/60) % 360; // Wider hue variance, faster cycle
          const lightness = 70 + Math.random() * 25; // Brighter
          const alpha = (0.80 + Math.random() * 0.25) * settings.brightCap * 1.15; // More opaque

          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, alpha)})`;
          ctx.beginPath(); ctx.arc(x, y, Math.max(1.0, size), 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
