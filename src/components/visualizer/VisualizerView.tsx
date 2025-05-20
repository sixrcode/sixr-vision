
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';

export function VisualizerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { currentScene, scenes } = useScene(); // Get all scenes for previousScene lookup
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // For scene transitions
  const previousSceneRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);

  useEffect(() => {
    if (settings.currentSceneId !== lastSceneIdRef.current) {
      if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0) {
        const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current);
        if (prevSceneObject) {
          previousSceneRef.current = prevSceneObject;
          setIsTransitioning(true);
          transitionStartTimeRef.current = performance.now();
        } else {
          // No valid previous scene, or duration is 0, so no transition
          previousSceneRef.current = null;
          setIsTransitioning(false);
        }
      } else {
        previousSceneRef.current = null;
        setIsTransitioning(false);
      }
      lastSceneIdRef.current = settings.currentSceneId;
    }
  }, [settings.currentSceneId, settings.sceneTransitionActive, settings.sceneTransitionDuration, scenes]);


  const drawLoop = useCallback(() => {
    animationFrameIdRef.current = null; 

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
      ctx.clearRect(0, 0, canvas.width, canvas.height); 

      if (lastError && !settings.panicMode) {
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
        if (lastError) setLastError(null);
      } else if (isTransitioning && previousSceneRef.current && currentScene) {
        const elapsedTime = performance.now() - transitionStartTimeRef.current;
        const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);

        // Draw previous scene with decreasing alpha
        ctx.globalAlpha = 1 - progress;
        previousSceneRef.current.draw(ctx, audioData, settings, webcamElement ?? undefined);
        
        // Draw current scene with increasing alpha
        ctx.globalAlpha = progress;
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
        
        ctx.globalAlpha = 1; // Reset global alpha

        if (progress >= 1) {
          setIsTransitioning(false);
          previousSceneRef.current = null;
        }
        if (lastError) setLastError(null);
      } else if (currentScene) {
        ctx.globalAlpha = 1; // Ensure alpha is reset if not transitioning
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
        if (lastError) setLastError(null);
      } else {
        ctx.fillStyle = 'hsl(var(--background))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '20px var(--font-geist-sans)';
        ctx.fillText('No scene selected', canvas.width / 2, canvas.height / 2);
        if (lastError) setLastError(null);
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) {
        setLastError(errorMessage);
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [audioData, currentScene, settings, webcamElement, lastError, isTransitioning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
          if(lastError) {
            setLastError(prev => prev ? prev + " " : "Canvas resized.");
          }
        });
        resizeObserver.observe(parent);
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        return () => resizeObserver.disconnect();
      }
    }
  }, [lastError]);

  useEffect(() => {
    // Initialize lastSceneIdRef on mount, primarily for the first transition detection
    lastSceneIdRef.current = settings.currentSceneId;

    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop, settings.currentSceneId]); // Add settings.currentSceneId for initial setup

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
