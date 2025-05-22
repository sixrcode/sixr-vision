
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

/**
 * @fileOverview The main component responsible for rendering the visualizer canvas.
 * It manages the animation loop, scene transitions, webcam feed integration,
 * and overlaying branding elements. It now supports both 2D Canvas and WebGL scenes.
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
  const webGLCameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const currentSceneWebGLAssetsRef = useRef<any>(null);
  const previousSceneWebGLAssetsRef = useRef<any>(null); // For cleaning up previous WebGL scene assets

  // Scene transition refs
  const previousScene2DRef = useRef<SceneDefinition | null>(null);
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
    // Ensure no WebGL context is active on this canvas
    if (webGLRendererRef.current && webGLRendererRef.current.domElement === canvas) {
        console.warn("Attempted to get 2D context on a canvas with active WebGL context.");
        return null;
    }
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("Error getting 2D context:", e);
      return null;
    }
  }, []);

  // Scene initialization and cleanup effect (for both 2D and WebGL)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newSceneDefinition = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current) || null;

    // Canvas re-keying if renderer type fundamentally changes
    if (newSceneDefinition && prevSceneObject && (prevSceneObject.rendererType || '2d') !== (newSceneDefinition.rendererType || '2d')) {
      console.log(`Renderer type changed from ${prevSceneObject.rendererType || '2d'} to ${newSceneDefinition.rendererType || '2d'}. Remounting canvas.`);
      
      // Cleanup previous scene's WebGL assets if it was a WebGL scene
      if (prevSceneObject.rendererType === 'webgl' && prevSceneObject.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`Cleaning up WebGL assets for previous scene: ${prevSceneObject.id}`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
      }
      if (webGLRendererRef.current) {
        console.log("Disposing main WebGL renderer due to renderer type switch.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
      previousSceneWebGLAssetsRef.current = null;

      setCanvasKey(prevKey => prevKey + 1);
      lastSceneIdRef.current = settings.currentSceneId;
      return; // Return early, effect will re-run due to canvasKey change
    }

    // Handle 2D scene transitions (only if both old and new are 2D)
    if (newSceneDefinition?.rendererType !== 'webgl' && prevSceneObject?.rendererType !== 'webgl') {
        if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject && newSceneDefinition?.id !== prevSceneObject.id) {
            previousScene2DRef.current = prevSceneObject;
            setIsTransitioning(true);
            transitionStartTimeRef.current = performance.now();
        } else {
            previousScene2DRef.current = null;
            setIsTransitioning(false);
        }
    } else { // If either new or old scene is WebGL, disable 2D transition logic for now
        previousScene2DRef.current = null;
        setIsTransitioning(false);
    }

    // WebGL Initialization / Cleanup Logic
    if (newSceneDefinition?.rendererType === 'webgl' && newSceneDefinition.initWebGL) {
      console.log(`Initializing WebGL for scene: ${newSceneDefinition.id} (Canvas Key: ${canvasKey})`);
      
      // Clean up previous WebGL scene if it existed and was different
      if (previousSceneWebGLAssetsRef.current && prevSceneObject?.id !== newSceneDefinition.id && prevSceneObject?.cleanupWebGL && prevSceneObject?.rendererType === 'webgl') {
        console.log(`Cleaning up WebGL assets for previous scene: ${prevSceneObject.id}`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
      }

      // Dispose of the main renderer if it exists from a previous scene *on the same canvas key*
      // This should primarily happen if we are switching *between WebGL scenes*
      if (webGLRendererRef.current && prevSceneObject?.id !== newSceneDefinition.id) {
        console.log("Disposing existing WebGL renderer before new init.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null; // Nullify to ensure new one is created
      }
      
      // Only create a new renderer if one doesn't exist for the current canvas
      if (!webGLRendererRef.current) {
        webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        webGLRendererRef.current.setSize(canvas.width, canvas.height);
        webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);
      }


      try {
        const initializedAssets = newSceneDefinition.initWebGL(canvas, settings, webcamElement);
        
        // If the scene provides its own renderer (some advanced scenes might), use it. Otherwise, use the shared one.
        webGLSceneRef.current = initializedAssets.scene;
        webGLCameraRef.current = initializedAssets.camera;
        currentSceneWebGLAssetsRef.current = initializedAssets;
        previousSceneWebGLAssetsRef.current = initializedAssets; // Store for next cleanup

        setLastError(null);
      } catch (e) {
        console.error("Error during WebGL initialization for scene:", newSceneDefinition.id, e);
        setLastError(e instanceof Error ? e.message : String(e));
        if (webGLRendererRef.current) webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
        webGLSceneRef.current = null;
        webGLCameraRef.current = null;
        currentSceneWebGLAssetsRef.current = null;
        previousSceneWebGLAssetsRef.current = null;
      }
    } else {
      // If the new scene is not WebGL, ensure any old main WebGL renderer is disposed
      if (webGLRendererRef.current) {
        console.log("Current scene is not WebGL. Disposing existing WebGL renderer.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      // Also clean up any scene-specific WebGL assets from the previous scene
      if (previousSceneWebGLAssetsRef.current && prevSceneObject?.cleanupWebGL && prevSceneObject?.rendererType === 'webgl') {
         console.log(`Cleaning up WebGL assets for previous scene: ${prevSceneObject.id} (switching to 2D)`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
      }
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
      previousSceneWebGLAssetsRef.current = null;
    }
    
    lastSceneIdRef.current = settings.currentSceneId;

    return () => {
      // Cleanup for the *current* scene's assets when it's about to be replaced or on component unmount
      if (newSceneDefinition?.rendererType === 'webgl' && newSceneDefinition.cleanupWebGL && currentSceneWebGLAssetsRef.current) {
        console.log(`Effect cleanup: Cleaning up WebGL assets for current scene: ${newSceneDefinition.id}`);
        newSceneDefinition.cleanupWebGL(currentSceneWebGLAssetsRef.current);
      }
      // Note: The main webGLRendererRef itself is disposed of when switching renderer types or to a 2D scene.
    };
  }, [settings.currentSceneId, scenes, canvasKey, webcamElement, settings, get2DContext]);


  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.onload = () => { aiOverlayImageRef.current = img; };
      img.onerror = () => { console.error("Failed to load AI overlay image."); aiOverlayImageRef.current = null; };
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
        // console.log(`[Performance Monitor] Current FPS: ${fps}`); // Re-enabled for debugging
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

  const drawPrimarySceneContent = useCallback((
    ctx: CanvasRenderingContext2D,
    sceneToDraw: SceneDefinition,
    alpha: number = 1
  ) => {
    if (sceneToDraw.draw) {
      ctx.save();
      ctx.globalAlpha = alpha;
      sceneToDraw.draw(ctx, audioData, settings, webcamElement);
      ctx.restore();
    }
  }, [audioData, settings, webcamElement]);

  const drawAiGeneratedOverlay2D = useCallback((ctx: CanvasRenderingContext2D | null) => {
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

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.font = '12px var(--font-geist-mono, monospace)';
    const currentFgColor = getComputedStyle(canvas).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;
    
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    const spectrumSample = Array.from(audioData.spectrum.slice(0,5));
    const spectrumSum = audioData.spectrum.reduce((s, v) => s + v, 0);
    console.log(
        'VisualizerView - AudioData:',
        'RMS:', audioData.rms.toFixed(3),
        'Beat:', audioData.beat,
        'Bass:', audioData.bassEnergy.toFixed(3),
        'Mid:', audioData.midEnergy.toFixed(3),
        'Treble:', audioData.trebleEnergy.toFixed(3),
        'BPM:', audioData.bpm,
        'Spectrum Sum:', spectrumSum,
        'First 5 bins:', spectrumSample
    );

    ctx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    ctx.fillText(`RMS: ${audioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Beat: ${audioData.beat ? 'YES' : 'NO'}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Bass: ${audioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Mid: ${audioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Treble: ${audioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`BPM: ${audioData.bpm}`, canvas.width - 10, currentY);
  }, [fps, audioData]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
    let errorColor = getComputedStyle(canvas).getPropertyValue('--destructive').trim() || 'red';
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
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    updateFps();

    const activeSceneDefinition = scenes.find(s => s.id === settings.currentSceneId);

    try {
      if (settings.panicMode) {
        if (activeSceneDefinition?.rendererType === 'webgl' && webGLRendererRef.current) {
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
      } else if (activeSceneDefinition?.rendererType === 'webgl') {
        if (webGLRendererRef.current && webGLSceneRef.current && webGLCameraRef.current && currentSceneWebGLAssetsRef.current && activeSceneDefinition.drawWebGL) {
          activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current, // Pass the main renderer
            scene: webGLSceneRef.current,
            camera: webGLCameraRef.current,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            webcamElement: webcamElement,
          });
          webGLRendererRef.current.render(webGLSceneRef.current, webGLCameraRef.current);
          if (lastError) setLastError(null);
        } else {
           // WebGL scene is intended, but resources not ready, clear with its own renderer if possible
           if (webGLRendererRef.current) {
             const bgColorString = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#000000';
             webGLRendererRef.current.setClearColor(new THREE.Color(bgColorString).getHex(), 1);
             webGLRendererRef.current.clear();
           }
        }
      } else { // 2D Scene
        const ctx = get2DContext();
        if (!ctx && activeSceneDefinition && activeSceneDefinition.draw) {
            if(!lastError) setLastError("Failed to get 2D context for 2D scene.");
            // Attempt to draw error on a temporarily created 2D context if main one fails
            // This is a fallback, ideally get2DContext() should not fail for 2D scenes
            const tempCtx = canvas.getContext('2d');
            if (tempCtx) drawErrorState(tempCtx);
            return; // Exit drawLoop if context fails for a 2D scene
        }

        if (ctx) { // Proceed only if 2D context is available
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            if (lastError) {
              drawErrorState(ctx);
            } else if (activeSceneDefinition && activeSceneDefinition.draw) {
              if (isTransitioning && previousScene2DRef.current && previousScene2DRef.current.draw) {
                const elapsedTime = performance.now() - transitionStartTimeRef.current;
                const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);
                drawPrimarySceneContent(ctx, previousScene2DRef.current, 1 - progress);
                drawPrimarySceneContent(ctx, activeSceneDefinition, progress);
                if (progress >= 1) setIsTransitioning(false);
              } else {
                drawPrimarySceneContent(ctx, activeSceneDefinition);
              }
              drawAiGeneratedOverlay2D(ctx);
              if (!settings.panicMode) drawDebugInfo(ctx);
            } else {
              ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--muted-foreground').trim() || 'gray';
              ctx.textAlign = 'center';
              ctx.font = `20px ${SBNF_BODY_FONT_FAMILY}`;
              ctx.fillText(activeSceneDefinition ? 'Scene has no draw function' : 'No scene selected', canvas.width / 2, canvas.height / 2);
            }
        }
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      // Try to draw error on a 2D context
      const ctxForError = get2DContext();
      if (ctxForError) drawErrorState(ctxForError);
    }
  }, [
      settings, audioData, scenes, isTransitioning, lastError,
      get2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState, updateFps,
      webcamElement
  ]);

  // Canvas resize effect
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
              if (webGLCameraRef.current instanceof THREE.PerspectiveCamera) {
                webGLCameraRef.current.aspect = newWidth / newHeight;
              } else if (webGLCameraRef.current instanceof THREE.OrthographicCamera) {
                webGLCameraRef.current.left = -newWidth / 2;
                webGLCameraRef.current.right = newWidth / 2;
                webGLCameraRef.current.top = newHeight / 2;
                webGLCameraRef.current.bottom = -newHeight / 2;
              }
              webGLCameraRef.current.updateProjectionMatrix();
            }
          }
        });
        resizeObserver.observe(parent);
        // Initial size set
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        if (webGLRendererRef.current && webGLCameraRef.current) { // Also apply initial size to WebGL
            webGLRendererRef.current.setSize(canvas.width, canvas.height);
            if (webGLCameraRef.current instanceof THREE.PerspectiveCamera) {
                webGLCameraRef.current.aspect = canvas.width / canvas.height;
            } else if (webGLCameraRef.current instanceof THREE.OrthographicCamera) {
                webGLCameraRef.current.left = -canvas.width / 2;
                webGLCameraRef.current.right = canvas.width / 2;
                webGLCameraRef.current.top = canvas.height / 2;
                webGLCameraRef.current.bottom = -canvas.height / 2;
            }
            webGLCameraRef.current.updateProjectionMatrix();
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); // Re-run on canvas re-mount (renderer type switch)

  useEffect(() => {
    if (!animationFrameIdRef.current && !settings.panicMode && (scenes.find(s => s.id === settings.currentSceneId))) { 
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop, settings.panicMode, settings.currentSceneId, scenes]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" key={canvasKey} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
