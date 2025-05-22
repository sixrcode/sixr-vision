
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';
import * as THREE from 'three';

/**
 * @fileOverview The main component responsible for rendering the visualizer canvas.
 * It manages the animation loop, scene transitions, webcam feed integration,
 * and overlaying branding elements. It now supports both 2D Canvas and WebGL scenes.
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
  const { currentScene, scenes } = useScene(); // Removed setCurrentSceneById as it's not used here
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const webGLSceneRef = useRef<THREE.Scene | null>(null); // Scene specific, managed by scene's init/cleanup
  const webGLCameraRef = useRef<THREE.PerspectiveCamera | null>(null); // Scene specific
  const currentSceneWebGLAssetsRef = useRef<any>(null); // Assets returned by scene's initWebGL

  // Scene transition refs
  const previousSceneRef = useRef<SceneDefinition | null>(null);
  const previousScene2DContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const previousSceneWebGLAssetsRef = useRef<any>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);

  // FPS Counter states
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10;


  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);


  // Effect for scene transitions
  useEffect(() => {
    if (settings.currentSceneId !== lastSceneIdRef.current && currentScene) {
      const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current);
      if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject) {
        // No transitions if switching between 2D and WebGL, or if one of them doesn't support its renderer type
        const isCrossRendererTransition = prevSceneObject.rendererType !== currentScene.rendererType ||
                                         (prevSceneObject.rendererType === '2d' && !prevSceneObject.draw) ||
                                         (currentScene.rendererType === '2d' && !currentScene.draw) ||
                                         (prevSceneObject.rendererType === 'webgl' && !prevSceneObject.drawWebGL) ||
                                         (currentScene.rendererType === 'webgl' && !currentScene.drawWebGL);

        if (isCrossRendererTransition) {
          previousSceneRef.current = null;
          setIsTransitioning(false);
          if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
            prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
          }
          previousSceneWebGLAssetsRef.current = null;

        } else {
          previousSceneRef.current = prevSceneObject;
          if (prevSceneObject.rendererType === '2d') {
            // For 2D, we might need to snapshot the canvas content if complex, or just re-draw
            // For simplicity, we'll rely on re-drawing.
          } else if (prevSceneObject.rendererType === 'webgl') {
            // For WebGL, we keep the previous assets until transition ends
            previousSceneWebGLAssetsRef.current = currentSceneWebGLAssetsRef.current;
          }
          setIsTransitioning(true);
          transitionStartTimeRef.current = performance.now();
        }
      } else {
        previousSceneRef.current = null;
        setIsTransitioning(false);
         if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
            prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
          }
        previousSceneWebGLAssetsRef.current = null;
      }
      lastSceneIdRef.current = settings.currentSceneId;
    }
  }, [settings.currentSceneId, settings.sceneTransitionActive, settings.sceneTransitionDuration, scenes, currentScene]);


  // Effect to setup/cleanup WebGL context when scene changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cleanup previous scene's WebGL assets if it was a WebGL scene
    // This needs to be distinct from previousSceneRef for transitions
    const oldSceneDef = scenes.find(s => s.id === lastSceneIdRef.current);
    if (currentSceneWebGLAssetsRef.current && oldSceneDef?.rendererType === 'webgl' && oldSceneDef?.cleanupWebGL) {
        if (oldSceneDef.id !== currentScene?.id || currentScene?.rendererType !== 'webgl') {
             console.log(`Cleaning up WebGL assets for old scene: ${oldSceneDef.id}`);
             oldSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current);
             currentSceneWebGLAssetsRef.current = null;
        }
    }
     // Cleanup main WebGL renderer if switching away from WebGL or unmounting
    if (webGLRendererRef.current && (currentScene?.rendererType !== 'webgl' || !currentScene) ) {
      console.log("Disposing main WebGL renderer and scene refs");
      webGLRendererRef.current.dispose();
      webGLRendererRef.current = null;
      webGLSceneRef.current = null; // These are scene-specific, will be set by initWebGL
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
    }


    if (currentScene && currentScene.rendererType === 'webgl' && currentScene.initWebGL) {
      console.log(`Initializing WebGL for scene: ${currentScene.id}`);
      const { renderer, scene, camera, ...assets } = currentScene.initWebGL(canvas, settings);
      webGLRendererRef.current = renderer;
      webGLSceneRef.current = scene;
      webGLCameraRef.current = camera;
      currentSceneWebGLAssetsRef.current = assets;
      lastSceneIdRef.current = currentScene.id; // Update lastSceneIdRef here too
    }

    return () => {
      // This is the main component unmount cleanup
      if (currentSceneWebGLAssetsRef.current && currentScene?.cleanupWebGL) {
        console.log(`Final cleanup of WebGL assets for scene: ${currentScene.id} on unmount`);
        currentScene.cleanupWebGL(currentSceneWebGLAssetsRef.current);
      }
      if (webGLRendererRef.current) {
        console.log("Disposing main WebGL renderer on VisualizerView unmount");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
    };
  }, [currentScene, settings, scenes]); // Removed lastSceneIdRef from deps to avoid loop

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
      const currentFps = frameCountRef.current;
      setFps(currentFps);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;

      if (!settings.panicMode && currentFps > 0) {
        console.log(`[Performance Monitor] Current FPS: ${currentFps}`);
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - currentFps > fpsDropThreshold)) {
          console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${currentFps}`);
        }
        lastLoggedFpsRef.current = currentFps;
      }
    }
  }, [settings.panicMode]);

  const drawPrimary2DSceneContent = useCallback((
    ctx: CanvasRenderingContext2D,
    sceneToDraw: SceneDefinition,
    alpha: number = 1
  ) => {
    if (sceneToDraw.draw) {
      ctx.save();
      ctx.globalAlpha = alpha;
      sceneToDraw.draw(ctx, audioData, settings, webcamElement ?? undefined);
      ctx.restore();
    }
  }, [audioData, settings, webcamElement]);

  const drawAiGeneratedOverlay = useCallback((ctx: CanvasRenderingContext2D) => {
    if (settings.enableAiOverlay && aiOverlayImageRef.current && ctx) {
      const originalAlpha = ctx.globalAlpha;
      const originalCompositeOperation = ctx.globalCompositeOperation;
      ctx.globalAlpha = settings.aiOverlayOpacity;
      ctx.globalCompositeOperation = settings.aiOverlayBlendMode;
      ctx.drawImage(aiOverlayImageRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = originalAlpha;
      ctx.globalCompositeOperation = originalCompositeOperation;
    }
  }, [settings.enableAiOverlay, settings.aiOverlayOpacity, settings.aiOverlayBlendMode]);

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!ctx) return;
    ctx.font = '12px var(--font-geist-mono, monospace)';
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
    ctx.fillText(`RMS: ${audioData.rms.toFixed(3)}`, ctx.canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Beat: ${audioData.beat}`, ctx.canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Bass: ${audioData.bassEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Mid: ${audioData.midEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Treble: ${audioData.trebleEnergy.toFixed(3)}`, ctx.canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`BPM: ${audioData.bpm}`, ctx.canvas.width - 10, currentY);
  }, [fps, audioData]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = 'hsl(var(--background-hsl))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px var(--font-poppins, sans-serif)';
    let errorColor = 'red'; 
    const computedStyle = getComputedStyle(canvas);
    const destructiveColor = computedStyle.getPropertyValue('--destructive').trim();
    if (destructiveColor) errorColor = destructiveColor;
    ctx.fillStyle = errorColor;
    ctx.textAlign = 'center';
    const title = 'Visualizer Error (see console):';
    const lines = [title];
    const errorMessageLines = [];
    const maxTextWidth = canvas.width * 0.9;
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
    let startY = canvas.height / 2 - totalHeight / 2;
    allLines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
    });
  }, [lastError]);

  const drawLoop = useCallback(() => {
    animationFrameIdRef.current = null; 
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
      return;
    }
    updateFps();

    try {
      if (settings.panicMode) {
        const ctx = get2DContext();
        if (ctx) {
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (webGLRendererRef.current) {
          webGLRendererRef.current.setClearColor(0x000000, 1);
          webGLRendererRef.current.clear();
        }
        if (lastError) setLastError(null);
      } else if (currentScene?.rendererType === 'webgl') {
        if (webGLRendererRef.current && webGLSceneRef.current && webGLCameraRef.current && currentScene.drawWebGL) {
          // For WebGL, clear is usually handled by the renderer or scene background
          currentScene.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: webGLSceneRef.current,
            camera: webGLCameraRef.current,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
          });
          webGLRendererRef.current.render(webGLSceneRef.current, webGLCameraRef.current);
          // AI overlay on top of WebGL would need a second canvas or render-to-texture, skipping for now
          // Debug info also skipped for WebGL scenes for simplicity
        } else {
           // Fallback or show loading if WebGL context not ready
          const ctx = get2DContext();
          if (ctx) {
            ctx.fillStyle = 'hsl(var(--background-hsl))';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
            ctx.textAlign = 'center';
            ctx.font = '20px var(--font-poppins)';
            ctx.fillText(currentScene.initWebGL ? 'Initializing WebGL scene...' : 'WebGL scene not fully configured', canvas.width / 2, canvas.height / 2);
          }
        }
        if (lastError) setLastError(null);
      } else { // 2D Canvas rendering path
        const ctx = get2DContext();
        if (!ctx) {
          setLastError("Failed to get 2D context. Visualizer cannot draw.");
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
           if (lastError) {
             drawErrorState(ctx);
           } else if (currentScene && currentScene.draw) {
            if (isTransitioning && previousSceneRef.current && previousSceneRef.current.draw) {
              const elapsedTime = performance.now() - transitionStartTimeRef.current;
              const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);
              drawPrimary2DSceneContent(ctx, previousSceneRef.current, 1 - progress);
              drawPrimary2DSceneContent(ctx, currentScene, progress);
              if (progress >= 1) setIsTransitioning(false);
            } else {
              drawPrimary2DSceneContent(ctx, currentScene);
            }
            drawAiGeneratedOverlay(ctx);
            if (!settings.panicMode) drawDebugInfo(ctx);
          } else {
            ctx.fillStyle = 'hsl(var(--background-hsl))';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
            ctx.textAlign = 'center';
            ctx.font = '20px var(--font-poppins)';
            ctx.fillText('No scene selected or scene has no draw function', canvas.width / 2, canvas.height / 2);
          }
        }
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [
      settings, audioData, currentScene, 
      isTransitioning, setIsTransitioning, 
      lastError, setLastError, 
      get2DContext, drawPrimary2DSceneContent, drawAiGeneratedOverlay, drawDebugInfo, drawErrorState, updateFps
  ]);

  // Effect to handle canvas resizing for both 2D and WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          const newWidth = parent.clientWidth;
          const newHeight = parent.clientHeight;
          canvas.width = newWidth;
          canvas.height = newHeight;
          if (webGLRendererRef.current && webGLCameraRef.current) {
            webGLRendererRef.current.setSize(newWidth, newHeight);
            webGLCameraRef.current.aspect = newWidth / newHeight;
            webGLCameraRef.current.updateProjectionMatrix();
          }
        });
        resizeObserver.observe(parent);
        // Initial size set
        const newWidth = parent.clientWidth;
        const newHeight = parent.clientHeight;
        canvas.width = newWidth;
        canvas.height = newHeight;
         if (webGLRendererRef.current && webGLCameraRef.current) {
            webGLRendererRef.current.setSize(newWidth, newHeight);
            webGLCameraRef.current.aspect = newWidth / newHeight;
            webGLCameraRef.current.updateProjectionMatrix();
          }
        return () => resizeObserver.disconnect();
      }
    }
  }, []); // Runs once on mount

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
