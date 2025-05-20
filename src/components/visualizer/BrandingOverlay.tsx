
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
  
  const sColor = "rgb(254, 190, 15)";
  const iColor = "rgb(51, 197, 244)";
  const xColor = "rgb(235, 26, 115)"; // Main brand accent / effect color
  const rColor = "rgb(91, 185, 70)";
  const torusFontFamily = "'Torus Variations', var(--font-geist-mono), monospace";

  useEffect(() => {
    const timer = setTimeout(() => setBootShimmer(false), 2000); // Shimmer for 2s
    return () => clearTimeout(timer);
  }, []);

  if (settings.logoBlackout) {
    return null;
  }

  const rmsGlowIntensity = Math.min(1, audioData.rms * 2); 
  
  const centralTextContainerStyle = {
    opacity: settings.logoOpacity,
    textShadow: `
      0 0 ${5 * rmsGlowIntensity}px ${xColor},
      0 0 ${10 * rmsGlowIntensity}px ${xColor},
      0 0 ${15 * rmsGlowIntensity}px rgba(235, 26, 115, 0.7),
      0 0 ${20 * rmsGlowIntensity}px rgba(235, 26, 115, 0.5)
    `,
    fontFamily: torusFontFamily,
  };
  
  const logoOutlineFlashStyle = audioData.beat ? {
    filter: `drop-shadow(0 0 5px ${xColor}) drop-shadow(0 0 10px ${xColor})`,
  } : {};


  return (
    <>
      {/* Boot Logo Shimmer */}
      {bootShimmer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
          <SixrLogo className="w-32 h-auto opacity-50" />
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
        <SixrLogo className="w-16 h-auto animate-[spin_20s_linear_infinite]" />
      </div>

      {/* Centre SIXR Type */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1
          className="text-6xl md:text-8xl font-bold" // Removed font-mono
          style={centralTextContainerStyle}
        >
          <span style={{ color: sColor }}>S</span>
          {' '}
          <span style={{ color: iColor }}>I</span>
          {' '}
          <span style={{ color: xColor }}>X</span>
          {' '}
          <span style={{ color: rColor }}>R</span>
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
        <SixrLogo className="w-20 h-auto" />
      </div>
    </>
  );
}
