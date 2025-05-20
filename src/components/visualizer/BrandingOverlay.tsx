
"use client";

import { SixrLogo } from '@/components/icons/SixrLogo';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function BrandingOverlay() {
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const [bootShimmer, setBootShimmer] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBootShimmer(false), 2000); // Shimmer for 2s
    return () => clearTimeout(timer);
  }, []);

  if (settings.logoBlackout) {
    return null;
  }

  // Calculate glow based on RMS. Max glow at RMS >= 0.5
  const rmsGlowIntensity = Math.min(1, audioData.rms * 2); 
  const textStrokeGlowStyle = {
    // Opacity for WebkitTextStroke is reactive
    WebkitTextStroke: `1px hsla(var(--primary-foreground), ${0.2 + audioData.rms * 0.5 + rmsGlowIntensity * 0.3})`, 
    textShadow: `
      0 0 ${5 * rmsGlowIntensity}px hsl(var(--primary-foreground)),
      0 0 ${10 * rmsGlowIntensity}px hsl(var(--primary-foreground)),
      0 0 ${15 * rmsGlowIntensity}px hsl(var(--accent)),
      0 0 ${20 * rmsGlowIntensity}px hsl(var(--accent))
    `,
  };
  
  const logoOutlineFlashStyle = audioData.beat ? {
    filter: `drop-shadow(0 0 5px hsl(var(--primary))) drop-shadow(0 0 10px hsl(var(--primary)))`,
  } : {};


  return (
    <>
      {/* Boot Logo Shimmer */}
      {bootShimmer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
          <SixrLogo className="w-32 h-auto text-primary-foreground opacity-50" />
        </div>
      )}

      {/* Rotating Watermark */}
      <div
        className={cn(
          "absolute top-4 right-4 pointer-events-none transition-opacity duration-200 ease-out",
          settings.logoOpacity === 0 && "opacity-0"
        )}
        style={{ opacity: settings.logoOpacity }}
      >
        <SixrLogo className="w-16 h-auto text-muted-foreground animate-[spin_20s_linear_infinite]" />
      </div>

      {/* Centre SIXR Type */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1
          className="text-6xl md:text-8xl font-mono font-bold text-transparent transition-opacity duration-200 ease-out"
          style={{ ...textStrokeGlowStyle, opacity: settings.logoOpacity }}
        >
          S I X R
        </h1>
      </div>
      
      {/* Beat-flash logo outline (example: bottom left) */}
       <div
        className={cn(
          "absolute bottom-4 left-4 pointer-events-none transition-opacity duration-200 ease-out",
          settings.logoOpacity === 0 && "opacity-0"
        )}
        style={{ opacity: settings.logoOpacity, ...logoOutlineFlashStyle }}
      >
        <SixrLogo className="w-20 h-auto text-primary" />
      </div>
    </>
  );
}

