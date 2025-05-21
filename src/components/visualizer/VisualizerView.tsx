
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
  const { currentScene, scenes } = useScene(); 
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  const previousSceneRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);

  // FPS Counter states
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (settings.currentSceneId !== lastSceneIdRef.current) {
      if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0) {
        const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current);
        if (prevSceneObject) {
          previousSceneRef.current = prevSceneObject;
          setIsTransitioning(true);
          transitionStartTimeRef.current = performance.now();
        } else {
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

  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.onload = () => {
        aiOverlayImageRef.current = img;
      };
      img.onerror = () => {
        console.error("Failed to load AI overlay image.");
        aiOverlayImageRef.current = null;
      };
      img.src = settings.aiGeneratedOverlayUri;
    } else {
      aiOverlayImageRef.current = null; 
    }
  }, [settings.enableAiOverlay, settings.aiGeneratedOverlayUri]);


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

    // FPS Calculation
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    frameCountRef.current++;
    if (delta >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }

    // DEBUG LOG: Check received audioData
    if (Math.random() < 0.05) { 
        const spectrumSum = audioData.spectrum.reduce((a,b) => a+b, 0);
        if (audioData.rms > 0.001 || spectrumSum > 0 || audioData.beat) { 
             console.log('VisualizerView - Received active audioData. RMS:', audioData.rms.toFixed(3), 'Beat:', audioData.beat, 'Spectrum Sum:', spectrumSum, 'First 5 bins:', audioData.spectrum.slice(0,5));
        }
    }


    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height); 

      if (lastError && !settings.panicMode) {
        ctx.fillStyle = 'hsl(var(--background-hsl))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px var(--font-geist-sans)';
        
        // Use themed destructive color for error text
        if (canvasRef.current) {
            const computedStyle = getComputedStyle(canvasRef.current);
            const destructiveColor = computedStyle.getPropertyValue('--destructive').trim();
            ctx.fillStyle = destructiveColor || 'red'; // Fallback to red
        } else {
            ctx.fillStyle = 'red'; // Fallback
        }

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

        ctx.globalAlpha = 1 - progress;
        previousSceneRef.current.draw(ctx, audioData, settings, webcamElement ?? undefined);
        
        ctx.globalAlpha = progress;
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
        
        ctx.globalAlpha = 1; 

        if (progress >= 1) {
          setIsTransitioning(false);
          previousSceneRef.current = null;
        }
        if (lastError) setLastError(null);
      } else if (currentScene) {
        ctx.globalAlpha = 1; 
        currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
        if (lastError) setLastError(null);
      } else {
        ctx.fillStyle = 'hsl(var(--background-hsl))';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
        ctx.textAlign = 'center';
        ctx.font = '20px var(--font-geist-sans)';
        ctx.fillText('No scene selected', canvas.width / 2, canvas.height / 2);
        if (lastError) setLastError(null);
      }

      if (settings.enableAiOverlay && aiOverlayImageRef.current && !settings.panicMode && !lastError) {
        const originalAlpha = ctx.globalAlpha;
        const originalCompositeOperation = ctx.globalCompositeOperation;

        ctx.globalAlpha = settings.aiOverlayOpacity;
        ctx.globalCompositeOperation = settings.aiOverlayBlendMode;
        ctx.drawImage(aiOverlayImageRef.current, 0, 0, canvas.width, canvas.height);
        // console.log('AI Overlay Drawn');

        ctx.globalAlpha = originalAlpha; 
        ctx.globalCompositeOperation = originalCompositeOperation; 
      }

      // Draw FPS counter
      if (!settings.panicMode && !lastError) {
        ctx.font = '12px var(--font-geist-sans)';
        ctx.fillStyle = 'hsl(var(--foreground))'; // Already using themed color
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${fps}`, 10, 20);
      }

    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) {
        setLastError(errorMessage);
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [audioData, currentScene, settings, webcamElement, lastError, isTransitioning, fps, scenes]); // Added scenes to deps

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
    lastSceneIdRef.current = settings.currentSceneId;
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop, settings.currentSceneId]); 

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
