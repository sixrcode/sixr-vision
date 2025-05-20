
"use client";

import { SixrLogo } from '@/components/icons/SixrLogo';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useEffect, useState, useMemo, useRef } from 'react';
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
  const [rainbowHue, setRainbowHue] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  const { logoOpacity, logoAnimationSettings } = settings;
  const { type: animType, speed: animSpeed, color: animColor } = logoAnimationSettings;

  useEffect(() => {
    const timer = setTimeout(() => setBootShimmer(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (animType === 'blink') {
      const blinkInterval = 1000 / animSpeed; 
      intervalId = setInterval(() => {
        setBlinkOn(prev => !prev);
      }, blinkInterval / 2); 
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      setBlinkOn(true); 
    };
  }, [animType, animSpeed]);

  useEffect(() => {
    if (animType === 'rainbowCycle') {
      let lastTime = performance.now();
      const animateHue = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        // Adjust hue increment based on speed and deltaTime for smoother animation
        // animSpeed is 0.2 to 3. A factor like 0.1 might be good to scale.
        // Hue increases by (animSpeed * scaleFactor * deltaTime / (1000/60)) degrees per frame roughly
        // Let's simplify: make speed influence degrees per second.
        // A speed of 1 could mean 360 degrees in 5 seconds (72 deg/sec).
        // A speed of 3 could mean 360 degrees in ~1.6 seconds (216 deg/sec).
        const hueIncrement = (animSpeed / 5) * (360 / 60) * (deltaTime / (1000/60)); // (speed_factor * deg_per_sec * time_elapsed_ratio)

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


  if (settings.logoBlackout) {
    return null;
  }

  const rmsGlowIntensity = Math.min(1, audioData.rms * 2);
  const masterOpacity = logoOpacity;

  let sDisplayColor = sColorDefault;
  let iDisplayColor = iColorDefault;
  let xDisplayColor = xColorDefault;
  let rDisplayColor = rColorDefault;
  let logoColorOverride: string | undefined = undefined;

  if (animType === 'solid') {
    sDisplayColor = iDisplayColor = xDisplayColor = rDisplayColor = animColor;
    logoColorOverride = animColor;
  } else if (animType === 'blink' && blinkOn) {
    sDisplayColor = iDisplayColor = xDisplayColor = rDisplayColor = animColor;
    logoColorOverride = animColor;
  } else if (animType === 'rainbowCycle') {
    const rainbowColorStr = `hsl(${rainbowHue}, 100%, 70%)`; // Use a brighter lightness for rainbow
    sDisplayColor = iDisplayColor = xDisplayColor = rDisplayColor = rainbowColorStr;
    logoColorOverride = rainbowColorStr;
  }
  

  const centralTextBaseStyle: React.CSSProperties = {
    fontFamily: torusFontFamily,
    opacity: masterOpacity, 
    transition: 'opacity 0.1s ease-in-out, color 0.05s linear', 
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
  
  let centralTextGlowColor = xColorDefault; // Default glow
  if (animType === 'solid' || (animType === 'blink' && blinkOn)) {
    centralTextGlowColor = animColor;
  } else if (animType === 'rainbowCycle') {
    centralTextGlowColor = `hsl(${rainbowHue}, 100%, 80%)`; // Lighter glow for rainbow
  }

  const centralTextContainerStyle: React.CSSProperties = {
    textShadow: `
      0 0 ${5 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${10 * rmsGlowIntensity}px ${centralTextGlowColor},
      0 0 ${15 * rmsGlowIntensity}px ${centralTextGlowColor.replace('rgb', 'rgba').replace(')', ', 0.7)')},
      0 0 ${20 * rmsGlowIntensity}px ${centralTextGlowColor.replace('rgb', 'rgba').replace(')', ', 0.5)')}
    `,
  };

  const pulseAnimationName = 'pulseAnimation';
  const pulseAnimationStyle: React.CSSProperties = animType === 'pulse' ? {
    animationName: pulseAnimationName,
    animationDuration: `${2 / animSpeed}s`, 
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  } : {};
  
  const logoWrapperBaseStyle: React.CSSProperties = {
    opacity: masterOpacity,
    transition: 'opacity 0.1s ease-in-out, color 0.05s linear',
  };

  const rotatingWatermarkStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...(animType === 'pulse' ? pulseAnimationStyle : {})};
  const beatFlashLogoStyle: React.CSSProperties = {...logoWrapperBaseStyle, ...(animType === 'pulse' ? pulseAnimationStyle : {})};

  if (animType === 'blink' && !blinkOn) {
    rotatingWatermarkStyle.opacity = 0;
    beatFlashLogoStyle.opacity = 0;
  }


  let beatFlashGlowColor = xColorDefault;
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
      <style>{`
        @keyframes ${pulseAnimationName} {
          0%, 100% { opacity: ${masterOpacity}; transform: scale(1); }
          50% { opacity: ${masterOpacity * 0.6}; transform: scale(0.95); }
        }
      `}</style>

      {bootShimmer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
          <SixrLogo className="w-32 h-auto opacity-50" />
        </div>
      )}

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
