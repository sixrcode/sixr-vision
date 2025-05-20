
"use client";

import { SixrLogo } from '@/components/icons/SixrLogo';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Define default letter colors (used when no animation overrides them or for 'none' type)
const sColorDefault = "rgb(254, 190, 15)";
const iColorDefault = "rgb(51, 197, 244)";
const xColorDefault = "rgb(235, 26, 115)";
const rColorDefault = "rgb(91, 185, 70)";
const torusFontFamily = "'Torus Variations', var(--font-geist-mono), monospace";

export function BrandingOverlay() {
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const [bootShimmer, setBootShimmer] = useState(true);
  const [blinkOn, setBlinkOn] = useState(true);

  const { logoOpacity, logoAnimationSettings } = settings;
  const { type: animType, speed: animSpeed, color: animColor } = logoAnimationSettings;

  useEffect(() => {
    const timer = setTimeout(() => setBootShimmer(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (animType === 'blink') {
      const blinkInterval = 1000 / animSpeed; // animSpeed is Hz-like
      intervalId = setInterval(() => {
        setBlinkOn(prev => !prev);
      }, blinkInterval / 2); // Toggle twice per cycle
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      setBlinkOn(true); // Reset blink state when effect changes
    };
  }, [animType, animSpeed]);

  if (settings.logoBlackout) {
    return null;
  }

  const rmsGlowIntensity = Math.min(1, audioData.rms * 2);
  const masterOpacity = logoOpacity;

  // Determine colors for the central text based on animation
  const sDisplayColor = (animType === 'solid' || (animType === 'blink' && blinkOn)) ? animColor : sColorDefault;
  const iDisplayColor = (animType === 'solid' || (animType === 'blink' && blinkOn)) ? animColor : iColorDefault;
  const xDisplayColor = (animType === 'solid' || (animType === 'blink' && blinkOn)) ? animColor : xColorDefault;
  const rDisplayColor = (animType === 'solid' || (animType === 'blink' && blinkOn)) ? animColor : rColorDefault;

  const centralTextBaseStyle: React.CSSProperties = {
    fontFamily: torusFontFamily,
    opacity: masterOpacity, // Base opacity
    transition: 'opacity 0.1s ease-in-out', // Smooth transitions for blink
  };

  const centralTextStyleS: React.CSSProperties = { ...centralTextBaseStyle, color: sDisplayColor };
  const centralTextStyleI: React.CSSProperties = { ...centralTextBaseStyle, color: iDisplayColor };
  const centralTextStyleX: React.CSSProperties = { ...centralTextBaseStyle, color: xDisplayColor };
  const centralTextStyleR: React.CSSProperties = { ...centralTextBaseStyle, color: rDisplayColor };

  if (animType === 'blink' && !blinkOn) {
    centralTextStyleS.opacity = 0;
    centralTextStyleI.opacity = 0;
    centralTextStyleX.opacity = 0;
    centralTextStyleR.opacity = 0;
  }
  
  const centralTextGlowColor = animType === 'solid' ? animColor : xColorDefault;
  const centralTextContainerStyle: React.CSSProperties = {
    textShadow: `
      0 0 ${5 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${10 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${15 * rmsGlowIntensity}px ${animType === 'solid' ? animColor.replace('rgb', 'rgba').replace(')', ', 0.7)') : xColorDefault.replace('rgb', 'rgba').replace(')', ', 0.7)')},
      0 0 ${20 * rmsGlowIntensity}px ${animType === 'solid' ? animColor.replace('rgb', 'rgba').replace(')', ', 0.5)') : xColorDefault.replace('rgb', 'rgba').replace(')', ', 0.5)')}
    `,
  };

  // Animation styles for pulse
  const pulseAnimationName = 'pulseAnimation';
  const pulseAnimationStyle: React.CSSProperties = animType === 'pulse' ? {
    animationName: pulseAnimationName,
    animationDuration: `${2 / animSpeed}s`, // Slower pulse for lower speed value
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  } : {};
  

  // Logo color override for solid/blink
  const logoColorOverride = (animType === 'solid' || (animType === 'blink' && blinkOn)) ? animColor : undefined;
  
  const logoWrapperBaseStyle: React.CSSProperties = {
    opacity: masterOpacity,
    transition: 'opacity 0.1s ease-in-out',
  };

  const rotatingWatermarkStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...pulseAnimationStyle};
  const beatFlashLogoStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...pulseAnimationStyle};

  if (animType === 'blink' && !blinkOn) {
    rotatingWatermarkStyle.opacity = 0;
    beatFlashLogoStyle.opacity = 0;
  }

  const beatFlashEffectStyle = audioData.beat ? {
    filter: `drop-shadow(0 0 5px ${animType === 'solid' ? animColor : xColorDefault}) drop-shadow(0 0 10px ${animType === 'solid' ? animColor : xColorDefault})`,
  } : {};


  return (
    <>
      <style>{`
        @keyframes ${pulseAnimationName} {
          0%, 100% { opacity: ${masterOpacity}; transform: scale(1); }
          50% { opacity: ${masterOpacity * 0.6}; transform: scale(0.95); }
        }
      `}</style>

      {/* Boot Logo Shimmer */}
      {bootShimmer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
          <SixrLogo className="w-32 h-auto opacity-50" />
        </div>
      )}

      {/* Rotating Watermark */}
      <div
        className={cn(
          "absolute top-4 right-4 pointer-events-none",
          animType !== 'pulse' && "transition-opacity duration-200 ease-out", 
          logoOpacity === 0 && "opacity-0"
        )}
        style={rotatingWatermarkStyle}
      >
        <SixrLogo 
          className="w-16 h-auto animate-[spin_20s_linear_infinite]" 
          colorOverride={logoColorOverride}
        />
      </div>

      {/* Centre SIXR Type */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none",
          animType !== 'pulse' && "transition-opacity duration-200 ease-out"
        )}
        style={animType === 'pulse' ? {...centralTextContainerStyle, ...pulseAnimationStyle } : centralTextContainerStyle}
      >
        <h1 className="text-6xl md:text-8xl font-bold">
          <span style={centralTextStyleS}>S</span>{' '}
          <span style={centralTextStyleI}>I</span>{' '}
          <span style={centralTextStyleX}>X</span>{' '}
          <span style={centralTextStyleR}>R</span>
        </h1>
      </div>
      
      {/* Beat-flash logo outline */}
       <div
        className={cn(
          "absolute bottom-4 left-4 pointer-events-none",
          animType !== 'pulse' && "transition-opacity duration-200 ease-out",
          logoOpacity === 0 && "opacity-0"
        )}
        style={{ ...beatFlashLogoStyle, ...beatFlashEffectStyle }}
      >
        <SixrLogo 
            className="w-20 h-auto" 
            colorOverride={logoColorOverride}
        />
      </div>
    </>
  );
}
