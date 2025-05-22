
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';

/**
 * @fileOverview The main component responsible for rendering the visualizer canvas.
 * It manages the animation loop, scene transitions, webcam feed integration,
 * and overlaying branding elements.
 */

/**
 * VisualizerView component.
 * Handles the main canvas rendering loop, drawing the current scene,
 * managing scene transitions, and integrating webcam and AI overlays.
 * Also displays FPS and audio data for debugging if not in panic mode.
 * @returns {JSX.Element} The VisualizerView component.
 */
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
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10; // Warn if FPS drops by this much

  // Effect to handle scene transitions
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

  // Effect to load AI-generated overlay image
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

  const updateFps = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    frameCountRef.current++;
    if (delta >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }
  }, []);

  // Periodic FPS logging
  useEffect(() => {
    const fpsLogInterval = setInterval(() => {
      if (!settings.panicMode && fps > 0) { // Only log if FPS is calculated and not in panic
        console.log(`[Performance Monitor] Current FPS: ${fps}`);
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - fps > fpsDropThreshold)) {
          console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${fps}`);
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5000); // Log every 5 seconds

    return () => {
      clearInterval(fpsLogInterval);
    };
  }, [fps, settings.panicMode, fpsDropThreshold]);


  const drawPrimarySceneContent = useCallback((ctx: CanvasRenderingContext2D) => {
    if (isTransitioning && previousSceneRef.current && currentScene) {
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
    } else if (currentScene) {
      ctx.globalAlpha = 1;
      currentScene.draw(ctx, audioData, settings, webcamElement ?? undefined);
    } else {
      ctx.fillStyle = 'hsl(var(--background-hsl))';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
      ctx.textAlign = 'center';
      ctx.font = '20px var(--font-poppins)';
      ctx.fillText('No scene selected', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }, [audioData, currentScene, settings, webcamElement, isTransitioning, setIsTransitioning]);

  const drawAiGeneratedOverlay = useCallback((ctx: CanvasRenderingContext2D) => {
    if (settings.enableAiOverlay && aiOverlayImageRef.current) {
      const originalAlpha = ctx.globalAlpha;
      const originalCompositeOperation = ctx.globalCompositeOperation;

      ctx.globalAlpha = settings.aiOverlayOpacity;
      ctx.globalCompositeOperation = settings.aiOverlayBlendMode;
      ctx.drawImage(aiOverlayImageRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
      // console.log('AI Overlay Drawn');

      ctx.globalAlpha = originalAlpha;
      ctx.globalCompositeOperation = originalCompositeOperation;
    }
  }, [settings.enableAiOverlay, settings.aiOverlayOpacity, settings.aiOverlayBlendMode]);

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.font = '12px var(--font-geist-mono, monospace)'; // Added monospace fallback
    ctx.fillStyle = 'hsl(var(--foreground-hsl))';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    const spectrumSum = audioData.spectrum.reduce((a, b) => a + b, 0);
    const firstFiveBins = Array.from(audioData.spectrum.slice(0,5));

    console.log(
        'VisualizerView - AudioData:',
        'RMS:', audioData.rms.toFixed(3),
        'Beat:', audioData.beat,
        'Bass:', audioData.bassEnergy.toFixed(3),
        'Mid:', audioData.midEnergy.toFixed(3),
        'Treble:', audioData.trebleEnergy.toFixed(3),
        'BPM:', audioData.bpm,
        'Spectrum Sum:', spectrumSum,
        'First 5 bins:', firstFiveBins
    );

    ctx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    ctx.fillText(`RMS: ${audioData.rms.toFixed(3)}`, ctx.canvas.width - 10, currentY);
    currentY += lineSpacing;
    ctx.fillText(`Beat: ${audioData.beat}`, ctx.canvas.width - 10, currentY);
    currentY += lineSpacing;
    ctx.fillText(`Bass: ${audioData.bassEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY);
    currentY += lineSpacing;
    ctx.fillText(`Mid: ${audioData.midEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY);
    currentY += lineSpacing;
    ctx.fillText(`Treble: ${audioData.trebleEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY);
    currentY += lineSpacing;
    ctx.fillText(`BPM: ${audioData.bpm}`, ctx.canvas.width - 10, currentY);
  }, [fps, audioData]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'hsl(var(--background-hsl))';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '14px var(--font-poppins, sans-serif)'; // Added sans-serif fallback

    let errorColor = 'red'; 
    const computedStyle = getComputedStyle(ctx.canvas); // Use ctx.canvas
    const destructiveColor = computedStyle.getPropertyValue('--destructive').trim();
    if (destructiveColor) {
        errorColor = destructiveColor;
    }
    ctx.fillStyle = errorColor;

    ctx.textAlign = 'center';
    const title = 'Visualizer Error (see console):';
    const lines = [title];
    const errorMessageLines = [];
    const maxTextWidth = ctx.canvas.width * 0.9;
    let currentLine = "";
    (lastError || "Unknown error").split(" ").forEach(word => {
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
    let startY = ctx.canvas.height / 2 - totalHeight / 2;
    allLines.forEach((line, index) => {
        ctx.fillText(line, ctx.canvas.width / 2, startY + (index * lineHeight));
    });
  }, [lastError]);

  const drawSceneAndOverlays = useCallback((ctx: CanvasRenderingContext2D) => {
    drawPrimarySceneContent(ctx);
    if (lastError) return; 
    drawAiGeneratedOverlay(ctx);
    // Only draw debug info if not in panic mode and if there's no error
    if (!settings.panicMode && !lastError) {
      drawDebugInfo(ctx);
    }
  }, [drawPrimarySceneContent, drawAiGeneratedOverlay, drawDebugInfo, lastError, settings.panicMode]);


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

    updateFps();

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (lastError && !settings.panicMode) {
        drawErrorState(ctx);
      } else if (settings.panicMode) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (lastError) setLastError(null); 
      } else {
         if (lastError) setLastError(null); 
        drawSceneAndOverlays(ctx);
      }

    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) {
        setLastError(errorMessage);
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [settings.panicMode, lastError, updateFps, drawSceneAndOverlays, drawErrorState, setLastError]);

  // Effect to handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        });
        resizeObserver.observe(parent);
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        return () => resizeObserver.disconnect();
      }
    }
  }, []);

  // Effect to start and stop the main animation loop
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
    </div>
  );
}

