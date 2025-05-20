"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';

export function VisualizerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { currentScene } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);


  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx) {
      if (settings.panicMode) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (currentScene) {
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
      } else {
        // Fallback if no scene is active
        ctx.fillStyle = 'hsl(var(--background))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '20px var(--font-geist-sans)';
        ctx.fillText('No scene selected', canvas.width / 2, canvas.height / 2);
      }
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [audioData, currentScene, settings, webcamElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Ensure canvas fills parent container (main flex-1 area)
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        });
        resizeObserver.observe(parent);
        
        // Initial size
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        return () => resizeObserver.disconnect();
      }
    }
  }, []);

  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [drawLoop]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
      {/* Performance/Debug overlays can be added here */}
    </div>
  );
}
