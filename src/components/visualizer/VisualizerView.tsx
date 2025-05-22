
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
  const webGLCameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const currentSceneWebGLAssetsRef = useRef<any>(null); // Holds assets from currentScene.initWebGL

  // Scene transition refs
  const previousScene2DRef = useRef<SceneDefinition | null>(null); // For 2D->2D transitions
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
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("Error getting 2D context (possibly due to existing WebGL context):", e);
      return null;
    }
  }, []);


  // Effect for scene changes, canvas re-keying, and WebGL context setup/cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let newSceneDefinition = scenes.find(s => s.id === settings.currentSceneId) || null;
    let previousSceneDefinition = scenes.find(s => s.id === lastSceneIdRef.current) || null;

    // Handle canvas re-keying if renderer type changes
    if (newSceneDefinition && previousSceneDefinition && 
        (previousSceneDefinition.rendererType || '2d') !== (newSceneDefinition.rendererType || '2d')) {
      console.log(`Renderer type changed from ${previousSceneDefinition.rendererType || '2d'} to ${newSceneDefinition.rendererType || '2d'}. Remounting canvas.`);
      setCanvasKey(prevKey => prevKey + 1);
      // When canvas re-keys, this effect will run again with the new canvas.
      // For WebGL, the old renderer/scene is disposed in the cleanup of *this* effect instance.
      // For 2D, there's less explicit disposal needed for the context itself.
      lastSceneIdRef.current = settings.currentSceneId; // Update lastSceneIdRef immediately
      return; // Return early, effect will re-run due to canvasKey change
    }
    
    // Handle 2D scene transitions
    if (newSceneDefinition?.rendererType !== 'webgl' && previousSceneDefinition?.rendererType !== 'webgl') {
        if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && previousSceneDefinition && newSceneDefinition?.id !== previousSceneDefinition.id) {
            previousScene2DRef.current = previousSceneDefinition;
            setIsTransitioning(true);
            transitionStartTimeRef.current = performance.now();
        } else {
            previousScene2DRef.current = null;
            setIsTransitioning(false);
        }
    } else { // If either new or old scene is WebGL, disable 2D transition logic
        previousScene2DRef.current = null;
        setIsTransitioning(false);
    }


    // WebGL Initialization / Cleanup Logic
    let sceneSpecificAssetsToCleanup: WebGLSceneAssets | undefined;
    let rendererForThisEffectInstance: THREE.WebGLRenderer | null = null; // To manage renderer lifecycle locally

    if (newSceneDefinition?.rendererType === 'webgl' && newSceneDefinition.initWebGL) {
      console.log(`Initializing WebGL for scene: ${newSceneDefinition.id} (Canvas Key: ${canvasKey})`);
      // Ensure any existing WebGL resources (from a previous WebGL scene on the same canvas key) are disposed
      if (webGLRendererRef.current) {
        console.log("Disposing previous WebGL renderer before new init.");
        webGLRendererRef.current.dispose();
      }

      try {
        // Pass webcamElement only if the scene might need it (e.g., mirror_silhouette)
        const initializedAssets = newSceneDefinition.initWebGL(canvas, settings, webcamElement ?? undefined);
        
        webGLRendererRef.current = initializedAssets.renderer;
        webGLSceneRef.current = initializedAssets.scene;
        webGLCameraRef.current = initializedAssets.camera;
        currentSceneWebGLAssetsRef.current = initializedAssets; // Store all returned assets
        
        sceneSpecificAssetsToCleanup = initializedAssets; // For this effect's cleanup
        rendererForThisEffectInstance = initializedAssets.renderer; // For this effect's cleanup

        setLastError(null);
      } catch (e) {
        console.error("Error during WebGL initialization for scene:", newSceneDefinition.id, e);
        setLastError(e instanceof Error ? e.message : String(e));
        if (webGLRendererRef.current) webGLRendererRef.current.dispose(); // Clean up partially created renderer
        webGLRendererRef.current = null;
        webGLSceneRef.current = null;
        webGLCameraRef.current = null;
        currentSceneWebGLAssetsRef.current = null;
      }
    } else {
      // If the new scene is not WebGL, or has no init, ensure any old WebGL renderer is disposed
      if (webGLRendererRef.current) {
        console.log("Current scene is not WebGL. Disposing existing WebGL renderer.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      webGLSceneRef.current = null;
      webGLCameraRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
    }
    
    lastSceneIdRef.current = settings.currentSceneId;

    return () => {
      // This cleanup runs when currentScene, settings, canvasKey, or webcamElement changes.
      // It should clean up the resources for the scene that *was* current *before* this effect re-ran.
      if (sceneSpecificAssetsToCleanup && newSceneDefinition?.cleanupWebGL && newSceneDefinition.rendererType === 'webgl') {
        console.log(`Effect cleanup: Cleaning up WebGL assets for scene: ${newSceneDefinition.id}`);
        newSceneDefinition.cleanupWebGL(sceneSpecificAssetsToCleanup);
      }
      if (rendererForThisEffectInstance) { // Clean up renderer created *by this specific effect instance*
        console.log(`Effect cleanup: Disposing renderer instance for scene: ${newSceneDefinition?.id}`);
        rendererForThisEffectInstance.dispose();
      }
      // If the main refs point to the renderer this effect instance created, nullify them
      // This is tricky because another effect instance might have already set them.
      // The main part of the effect should handle nullifying these refs if the *new* scene is not WebGL.
    };
  }, [currentScene, settings, scenes, canvasKey, webcamElement]); // Key dependencies including webcamElement for mirror_silhouette

  // Effect to load AI overlay image
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

  // FPS calculation logic
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

  // Periodic FPS logging
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

  // Helper for drawing 2D scene content with alpha for transitions
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

  // Helper for drawing AI overlay on 2D canvas
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

  // Helper for drawing debug info on 2D canvas
  const drawDebugInfo2D = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.font = '12px var(--font-geist-mono, monospace)';
    const currentFgColor = getComputedStyle(canvas).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;
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
  }, [fps, audioData]);

  // Helper for drawing error state on 2D canvas
  const drawErrorState2D = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
    let errorColor = getComputedStyle(canvas).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColor;
    ctx.textAlign = 'center';
    // ... (error message formatting logic remains the same) ...
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
    animationFrameIdRef.current = requestAnimationFrame(drawLoop); // Request next frame first
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    updateFps();

    try {
      const activeScene = scenes.find(s => s.id === settings.currentSceneId);

      if (settings.panicMode) {
        if (activeScene?.rendererType === 'webgl' && webGLRendererRef.current) {
          webGLRendererRef.current.setClearColor(0x000000, 1);
          webGLRendererRef.current.clear();
        } else {
          const ctx = get2DContext();
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
        if (lastError) setLastError(null); // Clear error in panic mode
      } else if (activeScene?.rendererType === 'webgl') {
        if (webGLRendererRef.current && webGLSceneRef.current && webGLCameraRef.current && activeScene.drawWebGL) {
          activeScene.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: webGLSceneRef.current,
            camera: webGLCameraRef.current,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            webcamElement: webcamElement ?? undefined,
          });
          webGLRendererRef.current.render(webGLSceneRef.current, webGLCameraRef.current);
          // AI Overlay and Debug Info are not drawn over WebGL scenes in this setup
          if (lastError) setLastError(null); // Clear error if WebGL rendering succeeded
        } else {
          // WebGL scene active but resources not ready, clear with default background.
          // This ensures canvas doesn't retain old 2D context if WebGL init is pending/failed.
          if (webGLRendererRef.current) {
             const bgColor = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#000000';
             webGLRendererRef.current.setClearColor(new THREE.Color(bgColor).getHex(), 1);
             webGLRendererRef.current.clear();
          }
        }
      } else { // 2D Scene
        const ctx = get2DContext();
        if (!ctx) {
          if(!lastError) setLastError("Failed to get 2D context for 2D scene.");
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear for 2D scenes
           if (lastError) {
             drawErrorState2D(ctx);
           } else if (activeScene && activeScene.draw) {
            if (isTransitioning && previousScene2DRef.current && previousScene2DRef.current.draw) {
              const elapsedTime = performance.now() - transitionStartTimeRef.current;
              const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);
              drawPrimary2DSceneContent(ctx, previousScene2DRef.current, 1 - progress);
              drawPrimary2DSceneContent(ctx, activeScene, progress);
              if (progress >= 1) setIsTransitioning(false);
            } else {
              drawPrimary2DSceneContent(ctx, activeScene);
            }
            drawAiGeneratedOverlay2D(ctx); // Draw AI overlay for 2D scenes
            if (!settings.panicMode) drawDebugInfo2D(ctx); // Draw debug info for 2D scenes
          } else { // No active 2D scene or scene has no draw function
            ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--muted-foreground').trim() || 'gray';
            ctx.textAlign = 'center';
            ctx.font = `20px ${SBNF_BODY_FONT_FAMILY}`;
            ctx.fillText(activeScene ? 'Scene has no draw function' : 'No scene selected', canvas.width / 2, canvas.height / 2);
          }
        }
      }
    } catch (error) {
      console.error("Error in visualizer draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      const ctxForError = get2DContext(); // Attempt to get 2D context to draw error
      if (ctxForError) drawErrorState2D(ctxForError);
    }
  }, [
      settings, audioData, currentScene, scenes, // scenes used to find activeScene in drawLoop
      isTransitioning, setIsTransitioning,
      lastError, setLastError,
      get2DContext, drawPrimary2DSceneContent, drawAiGeneratedOverlay2D, drawDebugInfo2D, drawErrorState2D, updateFps,
      webcamElement // Added as drawWebGL might need it
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
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); // Re-run on canvas re-mount

  // Main animation loop start/stop
  useEffect(() => {
    if (!animationFrameIdRef.current && !settings.panicMode) { 
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
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
