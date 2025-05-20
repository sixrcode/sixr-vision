import type { Settings, SceneDefinition, AudioData } from '@/types';

export const FFT_SIZES = [128, 256, 512] as const;

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: false,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.15,
  showWebcam: false,
  mirrorWebcam: false,
  currentSceneId: 'spectrum_bars',
  panicMode: false,
  logoBlackout: false,
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
    thumbnailUrl: 'https://placehold.co/120x80.png?text=Spectrum',
    dataAiHint: 'abstract audio',
    draw: (ctx, audioData, _settings) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0,0,width,height);

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
    thumbnailUrl: 'https://placehold.co/120x80.png?text=Burst',
    dataAiHint: 'abstract explosion',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0,0,width,height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      if (audioData.beat) {
        const particleCount = 50 + Math.floor(audioData.rms * 100);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * audioData.rms * Math.min(width, height) * 0.4;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const size = 1 + Math.random() * 4 * audioData.rms;
          
          const hue = (settings.fftSize === 128 ? 200 : settings.fftSize === 256 ? 260 : 320) + audioData.bassEnergy * 60;
          ctx.fillStyle = `hsla(${hue}, 100%, ${50 + audioData.trebleEnergy * 50}%, ${0.5 + audioData.midEnergy * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
       // Persistent subtle effect
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
    thumbnailUrl: 'https://placehold.co/120x80.png?text=Mirror',
    dataAiHint: 'silhouette reflection',
    draw: (ctx, audioData, settings, webcamFeed) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'hsla(var(--background))';
      ctx.fillRect(0,0,width,height);
      
      if (webcamFeed && settings.showWebcam) {
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
        ctx.globalAlpha = 0.8 + audioData.rms * 0.2; // Modulate alpha slightly by RMS
        ctx.drawImage(webcamFeed, x, y, drawWidth, drawHeight);
        ctx.restore();

        // Add a silhouette effect based on energy
        ctx.globalCompositeOperation = 'difference';
        const energyColor = Math.floor(audioData.bassEnergy * 100 + audioData.midEnergy * 80 + audioData.trebleEnergy * 75);
        ctx.fillStyle = `hsla(${energyColor % 360}, 70%, 50%, ${0.2 + audioData.rms * 0.3})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '16px var(--font-geist-sans)';
        ctx.fillText('Webcam not enabled or available', width / 2, height / 2);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    thumbnailUrl: 'https://placehold.co/120x80.png?text=Finale',
    dataAiHint: 'fireworks celebration',
    draw: (ctx, audioData, _settings) => {
      const { width, height } = ctx.canvas;
      // Don't clear rect fully, let particles fade
      ctx.fillStyle = 'hsla(var(--background), 0.1)'; // Lower alpha for trails
      ctx.fillRect(0,0,width,height);

      const particleCount = 100 + Math.floor(audioData.rms * 400); // More particles for finale
      for (let i = 0; i < particleCount * audioData.rms; i++) { // Modulate by RMS
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 1 + Math.random() * 5 * (audioData.bassEnergy + audioData.midEnergy);
        const hue = (200 + Math.random() * 160 + audioData.trebleEnergy * 60) % 360; // Wider color range
        const lightness = 50 + Math.random() * 30 + audioData.rms * 20;
        ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${0.3 + Math.random() * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
];

export const CONTROL_PANEL_WIDTH = 320; // in pixels
