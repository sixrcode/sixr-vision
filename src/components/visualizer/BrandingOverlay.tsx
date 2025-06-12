
"use client";

import { SixrLogo } from '@/components/icons/SixrLogo';
import { useSettingsStore } from '@/store/settingsStore'; // MODIFIED: Import Zustand store
import { useAudioDataStore } from '@/store/audioDataStore'; // MODIFIED: Import Zustand store
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SIXR_S_COLOR, SIXR_I_COLOR, SIXR_X_COLOR, SIXR_R_COLOR, TORUS_FONT_FAMILY } from '@/lib/brandingConstants';


export function BrandingOverlay() {
  // MODIFIED: Use Zustand store selectors
  const logoOpacity = useSettingsStore(state => state.logoOpacity);
  const logoAnimationSettings = useSettingsStore(state => state.logoAnimationSettings);
  const logoBlackout = useSettingsStore(state => state.logoBlackout);
  const audioData = useAudioDataStore(state => state); // Get all audio data

  const [bootShimmer, setBootShimmer] = useState(true);
  const [showMainBranding, setShowMainBranding] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const [rainbowHue, setRainbowHue] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  const { type: animType, speed: animSpeed, color: animColor } = logoAnimationSettings;

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootShimmer(false);
      setShowMainBranding(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (animType === 'blink') {
      const blinkInterval = 1000 / animSpeed; // animSpeed is multiplier, higher is faster
      intervalId = setInterval(() => {
        setBlinkOn(prev => !prev);
      }, blinkInterval / 2); // Blink on for half interval, off for half
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      setBlinkOn(true); // Ensure it's on if animation changes
    };
  }, [animType, animSpeed]);

  useEffect(() => {
    if (animType === 'rainbowCycle') {
      let lastTime = performance.now();
      const animateHue = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        // animSpeed of 1 roughly cycles once per 6 seconds. Higher animSpeed increases cycle rate.
        const hueIncrement = (animSpeed / 5) * (360 / 60) * (deltaTime / (1000 / 60)); // Adjusted for reasonable speed
        setRainbowHue(prevHue => (prevHue + hueIncrement) % 360);
        animationFrameRef.current = requestAnimationFrame(animateHue);
      };
      animationFrameRef.current = requestAnimationFrame(animateHue);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animType, animSpeed]);


  if (logoBlackout) { // MODIFIED: Read directly from Zustand state
    return null;
  }

  const rmsGlowIntensity = Math.min(1, audioData.rms * 2); // Cap intensity
  const masterOpacity = logoOpacity;

  // Default letter colors
  let sDisplayColor = SIXR_S_COLOR;
  let iDisplayColor = SIXR_I_COLOR;
  let xDisplayColor = SIXR_X_COLOR;
  let rDisplayColor = SIXR_R_COLOR;
  let logoColorOverride: string | undefined = undefined;

  // Apply animation colors
  if (animType === 'solid') {
    logoColorOverride = animColor;
  } else if (animType === 'blink' && blinkOn) {
    logoColorOverride = animColor;
  } else if (animType === 'rainbowCycle') {
    logoColorOverride = `hsl(${rainbowHue}, 100%, 70%)`;
  }

  // If there's a color override for the entire logo (solid, blink, rainbow), apply it to all letters
  if (animType === 'solid' || (animType === 'blink' && blinkOn) || animType === 'rainbowCycle') {
    sDisplayColor = logoColorOverride!;
    iDisplayColor = logoColorOverride!;
    xDisplayColor = logoColorOverride!;
    rDisplayColor = logoColorOverride!;
  }
  
  const centralTextBaseStyle: React.CSSProperties = {
    fontFamily: TORUS_FONT_FAMILY,
    opacity: masterOpacity, // Base opacity
    transition: 'opacity 0.1s ease-in-out, color 0.05s linear', // Smooth transitions
  };

  // Individual letter styles for the central text
  const centralTextStyleS: React.CSSProperties = { ...centralTextBaseStyle, color: sDisplayColor };
  const centralTextStyleI: React.CSSProperties = { ...centralTextBaseStyle, color: iDisplayColor };
  const centralTextStyleX: React.CSSProperties = { ...centralTextBaseStyle, color: xDisplayColor };
  const centralTextStyleR: React.CSSProperties = { ...centralTextBaseStyle, color: rDisplayColor };

  // Handle blink animation opacity for central text
  if (animType === 'blink' && !blinkOn) {
    centralTextStyleS.opacity = 0;
    centralTextStyleI.opacity = 0;
    centralTextStyleX.opacity = 0;
    centralTextStyleR.opacity = 0;
  }
  
  // Determine glow color for central text, defaulting to X's color if not overridden
  let centralTextGlowColor = SIXR_X_COLOR; 
  if (animType === 'solid' || (animType === 'blink' && blinkOn)) {
    centralTextGlowColor = animColor;
  } else if (animType === 'rainbowCycle') {
     centralTextGlowColor = `hsl(${rainbowHue}, 100%, 80%)`; // Brighter for glow
  }

  const centralTextContainerStyle: React.CSSProperties = {
    textShadow: `
      0 0 ${5 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${10 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${15 * rmsGlowIntensity}px ${centralTextGlowColor.replace('rgb', 'rgba').replace(')', ', 0.7)')},
      0 0 ${20 * rmsGlowIntensity}px ${centralTextGlowColor.replace('rgb', 'rgba').replace(')', ', 0.5)')}
    `,
  };
  
  // CSS custom properties for pulse animation are set here, used by the Tailwind animation utility
  const pulseCustomProperties: React.CSSProperties = animType === 'pulse' ? {
    ['--logo-pulse-start-opacity' as string]: masterOpacity,
    ['--logo-pulse-mid-opacity' as string]: masterOpacity * 0.6,
    ['--logo-pulse-duration' as string]: `${2 / animSpeed}s`, // Pass duration via variable
  } : {};


  const logoWrapperBaseStyle: React.CSSProperties = {
    opacity: animType === 'pulse' ? undefined : masterOpacity, // Pulse animation handles its own opacity via CSS vars
    transition: 'opacity 0.3s ease-in-out, color 0.05s linear',
  };


  // Styles for rotating watermark and beat-flash logo
  const rotatingWatermarkStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...pulseCustomProperties};
  const beatFlashLogoStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...pulseCustomProperties};

  if (animType === 'blink' && !blinkOn) {
    rotatingWatermarkStyle.opacity = 0;
    beatFlashLogoStyle.opacity = 0;
  }

  // Determine glow color for beat flash, defaulting to X's color if not overridden
  let beatFlashGlowColor = SIXR_X_COLOR;
  if (animType === 'solid' || (animType === 'blink' && blinkOn)) {
    beatFlashGlowColor = animColor;
  } else if (animType === 'rainbowCycle') {
    beatFlashGlowColor = `hsl(${rainbowHue}, 100%, 80%)`;
  }

  const beatFlashEffectStyle = audioData.beat ? {
    filter: `drop-shadow(0 0 5px ${beatFlashGlowColor}) drop-shadow(0 0 10px ${beatFlashGlowColor})`,
  } : {};

  return (
    <>
      {bootShimmer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
          <SixrLogo className="w-32 h-auto opacity-50" />
        </div>
      )}

      {showMainBranding && (
        <>
          {/* Rotating Watermark Logo (Top Right) */}
          <div
            className={cn(
              "absolute top-4 right-4 pointer-events-none",
              animType === 'pulse' && 'animate-logo-pulse-effect',
              animType !== 'pulse' && logoOpacity === 0 && "opacity-0"
            )}
            style={rotatingWatermarkStyle}
          >
            <SixrLogo
              className="w-16 h-auto animate-[spin_20s_linear_infinite]"
              colorOverride={logoColorOverride}
            />
          </div>

          {/* Central "S I X R" Text */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none",
              animType === 'pulse' && 'animate-logo-pulse-effect'
            )}
            style={animType === 'pulse' ? {...centralTextContainerStyle, ...pulseCustomProperties } : centralTextContainerStyle}
          >
            <h1 className="text-6xl md:text-8xl font-bold" style={{ fontFamily: TORUS_FONT_FAMILY }}>
              <span style={centralTextStyleS}>S</span>{' '}
              <span style={centralTextStyleI}>I</span>{' '}
              <span style={centralTextStyleX}>X</span>{' '}
              <span style={centralTextStyleR}>R</span>
            </h1>
          </div>

           {/* Beat-Flash Logo (Bottom Left) */}
           <div
            className={cn(
              "absolute bottom-4 left-4 pointer-events-none",
              animType === 'pulse' && 'animate-logo-pulse-effect',
              animType !== 'pulse' && logoOpacity === 0 && "opacity-0"
            )}
            style={{ ...beatFlashLogoStyle, ...beatFlashEffectStyle, ...pulseCustomProperties }}
          >
            <SixrLogo
                className="w-20 h-auto"
                colorOverride={logoColorOverride}
            />
          </div>
        </>
      )}
    </>
  );
}
