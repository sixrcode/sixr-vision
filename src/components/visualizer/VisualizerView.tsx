
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
  const [lastError, setLastError] = useState<string | null>(null);

  const drawLoop = useCallback(() => {
    animationFrameIdRef.current = null; // Prepare for the next frame request

    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context from canvas.");
      setLastError("Failed to get 2D context. Visualizer cannot draw.");
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas at the start

      if (lastError && !settings.panicMode) { // Display last error if present and not in panic mode
        ctx.fillStyle = 'hsl(var(--background))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px var(--font-geist-sans)';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        
        const title = 'Visualizer Error (see console):';
        const lines = [title];
        const errorMessageLines = [];
        const maxTextWidth = canvas.width * 0.9;
        let currentLine = "";

        lastError.split(" ").forEach(word => {
            if (ctx.measureText(currentLine + word).width > maxTextWidth && currentLine.length > 0) {
                errorMessageLines.push(currentLine.trim());
                currentLine = word + " ";
            } else {
                currentLine += word + " ";
            }
        });
        errorMessageLines.push(currentLine.trim());
        
        const allLines = [...lines, ...errorMessageLines];
        const lineHeight = 20;
        const totalHeight = allLines.length * lineHeight;
        let startY = canvas.height / 2 - totalHeight / 2;

        allLines.forEach((line, index) => {
            ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
        });

      } else if (settings.panicMode) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (lastError) setLastError(null); // Clear error if panic mode is on
      } else if (currentScene) {
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
        if (lastError) setLastError(null); // Clear error if drawing succeeded
      } else {
        // Fallback if no scene is active
        ctx.fillStyle = 'hsl(var(--background))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '20px var(--font-geist-sans)';
        ctx.fillText('No scene selected', canvas.width / 2, canvas.height / 2);
        if (lastError) setLastError(null); // Clear error if fallback is shown
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Avoid flooding state updates if the error persists every frame
      if (errorMessage !== lastError) {
        setLastError(errorMessage);
      }
      // Error will be drawn on the next frame if lastError state is set
    }

    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [audioData, currentScene, settings, webcamElement, lastError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
          // Force a redraw if an error was being displayed, as canvas size change clears it
          if(lastError) {
            setLastError(prev => prev ? prev + " " : "Canvas resized."); // Trigger re-render of error
          }
        });
        resizeObserver.observe(parent);
        
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        return () => resizeObserver.disconnect();
      }
    }
  }, [lastError]); // Include lastError to re-setup observer if error state changes.

  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
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
