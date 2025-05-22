
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants'; // Corrected import path

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
  const { currentScene, scenes } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const webGLSceneRef = useRef<THREE.Scene | null>(null);
  const webGLCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const currentSceneWebGLAssetsRef = useRef<any>(null);
  const previousSceneWebGLAssetsRef = useRef<any>(null);


  // Scene transition refs
  const previousSceneRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);

  // Canvas key for forcing re-mount on renderer type change
  const [canvasKey, setCanvasKey] = useState(0);

  // FPS Counter states
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10;
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    if (currentScene?.rendererType === 'webgl') {
      // Do not attempt to get a 2D context if the current scene is WebGL
      return null;
    }
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("Error getting 2D context (possibly due to existing WebGL context):", e);
      return null;
    }
  }, [currentScene?.rendererType]);


  // Effect for scene transitions and canvas re-keying
  useEffect(() => {
    if (settings.currentSceneId !== lastSceneIdRef.current && currentScene) {
      const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current);

      if (prevSceneObject && currentScene && (prevSceneObject.rendererType || '2d') !== (currentScene.rendererType || '2d')) {
        console.log(`Renderer type changed from ${prevSceneObject.rendererType || '2d'} to ${currentScene.rendererType || '2d'}. Remounting canvas.`);
        setCanvasKey(prevKey => prevKey + 1); // Force re-mount of canvas
      }

      if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject) {
        const isCrossRendererTransition = (prevSceneObject.rendererType || '2d') !== (currentScene.rendererType || '2d') ||
                                         (prevSceneObject.rendererType !== 'webgl' && !prevSceneObject.draw) ||
                                         (currentScene.rendererType !== 'webgl' && !currentScene.draw);

        if (isCrossRendererTransition) {
          previousSceneRef.current = null;
          setIsTransitioning(false);
          if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
            console.log(`Cleaning up previous WebGL assets for scene: ${prevSceneObject.id} during cross-renderer transition.`);
            prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
          }
          previousSceneWebGLAssetsRef.current = null;
        } else if ((prevSceneObject.rendererType || '2d') === '2d' && (currentScene.rendererType || '2d') === '2d') {
          previousSceneRef.current = prevSceneObject;
          setIsTransitioning(true);
          transitionStartTimeRef.current = performance.now();
        } else { 
          previousSceneRef.current = null; 
          setIsTransitioning(false);
           if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
             console.log(`Cleaning up previous WebGL assets for scene: ${prevSceneObject.id} during same-renderer or non-2D transition.`);
            prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
          }
          previousSceneWebGLAssetsRef.current = null;
        }
      } else {
        previousSceneRef.current = null;
        setIsTransitioning(false);
         if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
           console.log(`Cleaning up previous WebGL assets for scene: ${prevSceneObject?.id} as transitions are inactive or no prevSceneObject.`);
           prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
         }
        previousSceneWebGLAssetsRef.current = null;
      }
      lastSceneIdRef.current = settings.currentSceneId;
    }
  }, [settings.currentSceneId, currentScene, scenes, settings.sceneTransitionActive, settings.sceneTransitionDuration]);


  // Effect to setup/cleanup WebGL context when scene changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cleanup logic for the PREVIOUS scene's WebGL assets if it was a WebGL scene
    if (previousSceneWebGLAssetsRef.current) {
        const prevSceneDef = scenes.find(s => s.id === lastSceneIdRef.current);
        if (prevSceneDef?.cleanupWebGL && prevSceneDef.rendererType === 'webgl') {
            console.log(`Effect cleanup: Cleaning up WebGL assets for previous scene: ${prevSceneDef.id}`);
            prevSceneDef.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        }
        previousSceneWebGLAssetsRef.current = null;
    }
    
    // Dispose main WebGL renderer if it exists from a *previous* WebGL scene
    if (webGLRendererRef.current) {
      console.log("Disposing existing main WebGL renderer before potential new init.");
      webGLRendererRef.current.dispose();
      webGLRendererRef.current = null;
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null; // Clear any old scene-specific assets
    }


    if (currentScene && (currentScene.rendererType === 'webgl') && currentScene.initWebGL) {
      console.log(`Initializing WebGL for scene: ${currentScene.id} on canvas (key: ${canvasKey})`);
      try {
        const { renderer, scene, camera, ...assets } = currentScene.initWebGL(canvas, settings);
        webGLRendererRef.current = renderer;
        webGLSceneRef.current = scene;
        webGLCameraRef.current = camera;
        currentSceneWebGLAssetsRef.current = assets;
        // Store these for potential cleanup when this scene becomes the "previous"
        previousSceneWebGLAssetsRef.current = { renderer, scene, camera, ...assets }; 
      } catch (e) {
        console.error("Error during WebGL initialization for scene:", currentScene.id, e);
        setLastError(e instanceof Error ? e.message : String(e));
        if (webGLRendererRef.current) {
          webGLRendererRef.current.dispose();
          webGLRendererRef.current = null;
        }
      }
    }

    return () => {
      // This cleanup runs when dependencies change (currentScene, canvasKey) OR on unmount
      // If the current scene *was* WebGL and is now changing, its specific assets need cleanup.
      // The main renderer is cleaned up at the start of this effect if it exists.
      if (currentSceneWebGLAssetsRef.current && currentScene?.cleanupWebGL && currentScene.rendererType === 'webgl') {
        console.log(`Effect cleanup: Cleaning up WebGL assets for current scene: ${currentScene.id} as it's being replaced or canvas re-keyed.`);
        currentScene.cleanupWebGL({ renderer: webGLRendererRef.current!, scene: webGLSceneRef.current!, camera: webGLCameraRef.current!, ...currentSceneWebGLAssetsRef.current });
      }
      currentSceneWebGLAssetsRef.current = null;
      // Don't nullify webGLRendererRef here, as it's managed at the start of the effect
    };
  }, [currentScene, settings, scenes, canvasKey]);

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
    if (delta >= 1000) { // Update FPS every second
      const currentFpsValue = frameCountRef.current;
      setFps(currentFpsValue);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (fpsLogIntervalRef.current) clearInterval(fpsLogIntervalRef.current);
    fpsLogIntervalRef.current = setInterval(() => {
      if (!settings.panicMode && fps > 0) {
        console.log(`[Performance Monitor] Current FPS: ${fps}`);
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - fps > fpsDropThreshold)) {
           console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${fps}`);
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5000);
    return () => {
      if (fpsLogIntervalRef.current) clearInterval(fpsLogIntervalRef.current);
    };
  }, [fps, settings.panicMode]);


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

  const drawAiGeneratedOverlay = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (settings.enableAiOverlay && aiOverlayImageRef.current && ctx) {
      const originalAlpha = ctx.globalAlpha;
      const originalCompositeOperation = ctx.globalCompositeOperation;
      ctx.globalAlpha = settings.aiOverlayOpacity;
      ctx.globalCompositeOperation = settings.aiOverlayBlendMode;
      ctx.drawImage(aiOverlayImageRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = originalAlpha;
      ctx.globalCompositeOperation = originalCompositeOperation;
    }
  }, [settings.enableAiOverlay, settings.aiOverlayOpacity, settings.aiOverlayBlendMode, aiOverlayImageRef]); // aiOverlayImageRef.current itself is not a stable dep

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx || (currentScene?.rendererType === 'webgl')) return;
    const canvas = ctx.canvas;
    ctx.font = '12px var(--font-geist-mono, monospace)'; // Using Geist Mono for better number alignment
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
    ctx.fillText(`RMS: ${audioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Beat: ${audioData.beat}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Bass: ${audioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Mid: ${audioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Treble: ${audioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`BPM: ${audioData.bpm}`, canvas.width - 10, currentY);
  }, [fps, audioData, currentScene?.rendererType]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = 'hsl(var(--background-hsl))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`; // Using Poppins for error message
    let errorColor = 'red';
    const computedStyle = getComputedStyle(canvas);
    const destructiveColorValue = computedStyle.getPropertyValue('--destructive').trim();
    if (destructiveColorValue) errorColor = destructiveColorValue;

    ctx.fillStyle = errorColor;
    ctx.textAlign = 'center';
    const title = 'Visualizer Error:';
    const errorMessage = lastError || "Unknown error occurred.";
    const lines = [title];

    const words = errorMessage.split(' ');
    let currentLine = "";
    for (const word of words) {
        const testLine = currentLine + word + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > canvas.width * 0.9 && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine.trim());

    const lineHeight = 20;
    const totalHeight = lines.length * lineHeight;
    let startY = canvas.height / 2 - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line) => {
        ctx.fillText(line, canvas.width / 2, startY);
        startY += lineHeight;
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
        if ((currentScene?.rendererType || '2d') === 'webgl' && webGLRendererRef.current) {
          webGLRendererRef.current.setClearColor(0x000000, 1);
          webGLRendererRef.current.clear();
        } else {
          const ctx = get2DContext();
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
        if (lastError) setLastError(null);
      } else if ((currentScene?.rendererType === 'webgl')) {
        if (webGLRendererRef.current && webGLSceneRef.current && webGLCameraRef.current && currentScene.drawWebGL) {
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
        } else {
          // If WebGL scene is active but resources aren't ready, simply clear to background
          // DO NOT attempt to get a 2D context here.
          if (webGLRendererRef.current) { // Only clear if renderer exists, even if scene/cam aren't fully ready
            webGLRendererRef.current.setClearColor(new THREE.Color(getComputedStyle(canvas).getPropertyValue('--background')).getHex(), 1);
            webGLRendererRef.current.clear();
          } else {
            // Fallback if even the renderer isn't ready - this might appear as a brief unstyled canvas
            // or previous frame until WebGL init kicks in.
          }
        }
        if (lastError && currentScene?.initWebGL) setLastError(null);
      } else { // This implies 2D scene or undefined scene (which defaults to 2D behavior)
        const ctx = get2DContext();
        if (!ctx) {
          if(!lastError) setLastError("Failed to get 2D context. Visualizer cannot draw.");
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
            ctx.font = `20px ${SBNF_BODY_FONT_FAMILY}`;
            ctx.fillText(currentScene ? 'Scene has no draw function' : 'No scene selected', canvas.width / 2, canvas.height / 2);
          }
        }
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      // Attempt to draw error state if possible
      if (currentScene?.rendererType !== 'webgl') {
        const ctx = get2DContext();
        if (ctx) drawErrorState(ctx);
      }
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [
      settings, audioData, currentScene,
      isTransitioning, setIsTransitioning,
      lastError, setLastError,
      get2DContext, drawPrimary2DSceneContent, drawAiGeneratedOverlay, drawDebugInfo, drawErrorState, updateFps,
      scenes // Added scenes to dependencies as it's used in various places like transition logic
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          const newWidth = parent.clientWidth;
          const newHeight = parent.clientHeight;
          if(canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            if (webGLRendererRef.current && webGLCameraRef.current) {
              webGLRendererRef.current.setSize(newWidth, newHeight);
              webGLCameraRef.current.aspect = newWidth / newHeight;
              webGLCameraRef.current.updateProjectionMatrix();
            }
          }
        });
        resizeObserver.observe(parent);

        const newWidth = parent.clientWidth;
        const newHeight = parent.clientHeight;
        if(canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            if (webGLRendererRef.current && webGLCameraRef.current) {
                webGLRendererRef.current.setSize(newWidth, newHeight);
                webGLCameraRef.current.aspect = newWidth / newHeight;
                webGLCameraRef.current.updateProjectionMatrix();
            }
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]);

  useEffect(() => {
    if (!animationFrameIdRef.current && !settings.panicMode) { // Only start if not in panic and not already running
      console.log("VisualizerView: Requesting initial drawLoop frame.");
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        console.log("VisualizerView: Cancelling drawLoop frame on effect cleanup. ID:", animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop, settings.panicMode]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" key={canvasKey} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

