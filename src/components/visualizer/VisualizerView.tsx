
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
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);


  // Effect for scene transitions and canvas re-keying
  useEffect(() => {
    if (settings.currentSceneId !== lastSceneIdRef.current && currentScene) {
      const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current);

      if (prevSceneObject && currentScene && prevSceneObject.rendererType !== currentScene.rendererType) {
        console.log(`Renderer type changed from ${prevSceneObject.rendererType || '2d'} to ${currentScene.rendererType || '2d'}. Remounting canvas.`);
        setCanvasKey(prevKey => prevKey + 1);
      }

      if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject) {
        const isCrossRendererTransition = (prevSceneObject.rendererType || '2d') !== (currentScene.rendererType || '2d') ||
                                         (prevSceneObject.rendererType !== 'webgl' && !prevSceneObject.draw) ||
                                         (currentScene.rendererType !== 'webgl' && !currentScene.draw);

        if (isCrossRendererTransition) {
          previousSceneRef.current = null;
          setIsTransitioning(false);
          if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL) {
            prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
          }
          previousSceneWebGLAssetsRef.current = null;
        } else if (prevSceneObject.rendererType !== 'webgl' && currentScene.rendererType !== 'webgl') { // Only 2D-to-2D transitions for now
          previousSceneRef.current = prevSceneObject;
          setIsTransitioning(true);
          transitionStartTimeRef.current = performance.now();
        } else {
          previousSceneRef.current = null;
          setIsTransitioning(false); // No transitions for WebGL or mixed for now
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

    const oldSceneDef = scenes.find(s => s.id === lastSceneIdRef.current && s.id !== currentScene?.id);
    if (currentSceneWebGLAssetsRef.current && oldSceneDef?.rendererType === 'webgl' && oldSceneDef?.cleanupWebGL) {
        if (oldSceneDef.id !== currentScene?.id || (currentScene?.rendererType || '2d') !== 'webgl') {
             console.log(`Cleaning up WebGL assets for old scene: ${oldSceneDef.id}`);
             oldSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current);
             currentSceneWebGLAssetsRef.current = null;
        }
    }

    if (webGLRendererRef.current && ((currentScene?.rendererType || '2d') !== 'webgl' || !currentScene) ) {
      console.log("Disposing main WebGL renderer and scene refs as scene is not WebGL or not current.");
      webGLRendererRef.current.dispose();
      webGLRendererRef.current = null;
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null; // Also clear assets here
    }


    if (currentScene && (currentScene.rendererType === 'webgl') && currentScene.initWebGL) {
      console.log(`Initializing WebGL for scene: ${currentScene.id} on canvas (key: ${canvasKey})`);
      try {
        const { renderer, scene, camera, ...assets } = currentScene.initWebGL(canvas, settings);
        webGLRendererRef.current = renderer;
        webGLSceneRef.current = scene;
        webGLCameraRef.current = camera;
        currentSceneWebGLAssetsRef.current = assets;
        // lastSceneIdRef.current = currentScene.id; // This ref is managed by the other effect
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
      // This cleanup runs if currentScene, settings, or scenes change, OR if the component unmounts
      // It's critical if the scene was WebGL and is now changing.
      if ((currentScene?.rendererType === 'webgl') && currentSceneWebGLAssetsRef.current && currentScene?.cleanupWebGL) {
        console.log(`Cleaning up WebGL assets for scene: ${currentScene.id} due to effect re-run or unmount`);
        currentScene.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        currentSceneWebGLAssetsRef.current = null;
      }
      // General renderer disposal if this effect cleans up and no new WebGL scene is set
      if (webGLRendererRef.current && ((currentScene?.rendererType || '2d') !== 'webgl' || !currentScene)) {
        console.log("Disposing main WebGL renderer on effect cleanup (VisualizerView).");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
        webGLSceneRef.current = null;
        webGLCameraRef.current = null;
      }
    };
  }, [currentScene, settings, scenes, canvasKey]); // Added canvasKey

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
  }, [settings.enableAiOverlay, settings.aiOverlayOpacity, settings.aiOverlayBlendMode, settings.aiGeneratedOverlayUri]); // Re-added aiGeneratedOverlayUri

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx || (currentScene?.rendererType === 'webgl')) return; // Hide for WebGL scenes
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
  }, [fps, audioData, currentScene?.rendererType]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = 'hsl(var(--background-hsl))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px var(--font-poppins, sans-serif)';
    let errorColor = 'red'; 
    const computedStyle = getComputedStyle(canvas);
    const destructiveColorValue = computedStyle.getPropertyValue('--destructive').trim();
    if (destructiveColorValue) errorColor = destructiveColorValue;
    
    ctx.fillStyle = errorColor;
    ctx.textAlign = 'center';
    const title = 'Visualizer Error:';
    const errorMessage = lastError || "Unknown error occurred.";
    const lines = [title];
    
    // Simple text wrapping
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
    let startY = canvas.height / 2 - totalHeight / 2 + lineHeight / 2; // Adjust for better vertical centering

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
          // AI overlay and Debug info on top of WebGL would need a second canvas or render-to-texture.
          // For now, these are skipped for WebGL scenes to keep it simple.
        } else {
          const ctx = get2DContext(); // Fallback if WebGL init failed or scene misconfigured
          if (ctx) {
            ctx.fillStyle = 'hsl(var(--background-hsl))';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
            ctx.textAlign = 'center';
            ctx.font = '20px var(--font-poppins)';
            ctx.fillText(currentScene.initWebGL ? 'Initializing WebGL scene...' : 'WebGL scene misconfigured', canvas.width / 2, canvas.height / 2);
          }
        }
        if (lastError && currentScene.initWebGL) setLastError(null); // Clear error if WebGL scene is valid
      } else { // 2D Canvas rendering path
        const ctx = get2DContext();
        if (!ctx) {
          setLastError("Failed to get 2D context. Visualizer cannot draw.");
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Ensure clear for 2D
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
            if (!settings.panicMode) drawDebugInfo(ctx); // Only draw debug for 2D scenes for now
          } else {
            ctx.fillStyle = 'hsl(var(--background-hsl))';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'hsl(var(--muted-foreground-hsl))';
            ctx.textAlign = 'center';
            ctx.font = '20px var(--font-poppins)';
            ctx.fillText(currentScene ? 'Scene has no draw function' : 'No scene selected', canvas.width / 2, canvas.height / 2);
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
      get2DContext, drawPrimary2DSceneContent, drawAiGeneratedOverlay, drawDebugInfo, drawErrorState, updateFps,
      canvasKey // Add canvasKey to dependencies of drawLoop
  ]);

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
  }, [canvasKey]); // Re-run resize observer setup if canvasKey changes

  useEffect(() => {
    // This effect should always try to start the loop if not already running.
    // The drawLoop itself will check conditions like canvas availability.
    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" key={canvasKey} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

