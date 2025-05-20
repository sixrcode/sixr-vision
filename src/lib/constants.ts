
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
    thumbnailUrl: 'https://placehold.co/120x80/1f2937/93c5fd.png',
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
      ctx.fillStyle = 'hsl(var(--primary))';
      audioData.spectrum.forEach((value, i) => {
        const barHeight = (value / 255) * height;
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
          const size = 1 + Math.random() * 4 * audioData.rms;

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
         ctx.arc(x,y,1,0, Math.PI*2);
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
        ctx.globalAlpha = 0.8 + audioData.rms * 0.2;
        ctx.drawImage(webcamFeed, x, y, drawWidth, drawHeight);
        ctx.restore();

        ctx.globalCompositeOperation = 'difference';
        const energyColor = Math.floor(audioData.bassEnergy * 100 + audioData.midEnergy * 80 + audioData.trebleEnergy * 75);
        ctx.fillStyle = `hsla(${energyColor % 360}, 70%, 50%, ${0.2 + audioData.rms * 0.3})`;
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
      
      // Slower fade for more prominent trails, adjust based on transition activity
      ctx.fillStyle = `hsla(var(--background), ${settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.05})`;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Ambient particles
      const ambientParticleCount = 50 + Math.floor(audioData.rms * 150); // Increased potential ambient count
      for (let i = 0; i < ambientParticleCount; i++) {
        if (Math.random() < audioData.rms * 0.7) { // Higher chance to spawn with higher RMS
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = 1 + Math.random() * 3 * (audioData.midEnergy + audioData.trebleEnergy * 0.5);
          // Wider hue range for variety, leaning towards blues/purples/pinks for ambient
          const hue = (180 + Math.random() * 180 + audioData.trebleEnergy * 40) % 360; 
          const lightness = 55 + Math.random() * 25; // Slightly brighter ambient
          const alpha = 0.15 + Math.random() * 0.4 * audioData.rms;
          ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`; // Slightly less saturation for ambient
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Beat-triggered burst
      if (audioData.beat) {
        const burstParticleCount = 150 + Math.floor(audioData.bassEnergy * 250 + audioData.rms * 150);
        for (let i = 0; i < burstParticleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * Math.min(width, height) * 0.55 * (0.6 + audioData.rms); 
          const x = centerX + Math.cos(angle) * radius * (Math.random() * 0.6 + 0.7); 
          const y = centerY + Math.sin(angle) * radius * (Math.random() * 0.6 + 0.7);
          const size = 2.5 + Math.random() * 7 * (audioData.bassEnergy + audioData.rms); // Larger burst particles
          
          // Colors more towards warm/fiery for a "finale" - Oranges, Reds, Yellows, Pinks
          const hue = ( (audioData.bassEnergy * 40) + (Math.random() * 60) - 20 + 360) % 360; 
          const lightness = 50 + Math.random() * 20; // Keep them vibrant
          const alpha = 0.65 + Math.random() * 0.35; // Brighter alpha for bursts
          
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
