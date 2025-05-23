
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
 * and overlaying branding elements. It supports both 2D Canvas and WebGL scenes.
 */

export function VisualizerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { scenes } = useScene(); // currentScene is derived, scenes is the full list
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<any>(null); // Holds assets from currentScene.initWebGL
  const previousSceneWebGLAssetsRef = useRef<any>(null); // For cleaning up previous WebGL scene assets

  // Scene transition refs (for 2D scenes)
  const previousScene2DRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);
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
    // Check if the canvas is already claimed by WebGL for this key
    if (webGLRendererRef.current && webGLRendererRef.current.domElement === canvas) {
        // console.warn("VisualizerView: Attempted to get 2D context on a canvas with active WebGL context.");
        return null;
    }
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context:", e);
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
    const prevRendererType = prevSceneObject?.rendererType || '2d';
    const newRendererType = newSceneDefinition?.rendererType || '2d';

    if (prevRendererType !== newRendererType) {
      console.log(`VisualizerView: Renderer type changed from ${prevRendererType} to ${newRendererType}. Remounting canvas.`);
      
      // Explicitly clean up previous WebGL assets if switching FROM WebGL
      if (prevRendererType === 'webgl' && prevSceneObject?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id} (due to renderer type switch)`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
      if (webGLRendererRef.current) {
        console.log("VisualizerView: Disposing main WebGL renderer due to renderer type switch.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      currentSceneWebGLAssetsRef.current = null; // Clear current assets too before re-key
      setCanvasKey(prevKey => prevKey + 1); // This will trigger re-mount and re-run of this effect
      lastSceneIdRef.current = settings.currentSceneId;
      return; 
    }

    // Handle 2D scene transitions (only if both old and new are 2D)
    if (newRendererType === '2d' && prevRendererType === '2d') {
        if (settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject && newSceneDefinition?.id !== prevSceneObject.id) {
            previousScene2DRef.current = prevSceneObject;
            setIsTransitioning2D(true);
            transition2DStartTimeRef.current = performance.now();
        } else {
            previousScene2DRef.current = null;
            setIsTransitioning2D(false);
        }
    } else { 
        previousScene2DRef.current = null;
        setIsTransitioning2D(false);
    }

    // WebGL Initialization / Cleanup Logic
    if (newSceneDefinition?.rendererType === 'webgl' && newSceneDefinition.initWebGL) {
      console.log(`VisualizerView: Initializing WebGL for scene: ${newSceneDefinition.id} (Canvas Key: ${canvasKey})`);
      
      // Clean up previous WebGL scene assets if it was different and also WebGL
      if (previousSceneWebGLAssetsRef.current && prevSceneObject?.id !== newSceneDefinition.id && prevSceneObject?.rendererType === 'webgl' && prevSceneObject.cleanupWebGL) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id}`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
      }
      
      if (!webGLRendererRef.current) {
        console.log("VisualizerView: Creating new WebGLRenderer instance for canvas key:", canvasKey);
        webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      }
      // Always ensure renderer is configured for the current canvas dimensions
      webGLRendererRef.current.setSize(canvas.width, canvas.height);
      webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);

      try {
        const initializedAssets = newSceneDefinition.initWebGL(canvas, settings, webcamElement);
        currentSceneWebGLAssetsRef.current = initializedAssets;
        previousSceneWebGLAssetsRef.current = initializedAssets; 
        setLastError(null);
      } catch (e) {
        console.error("VisualizerView: Error during WebGL initialization for scene:", newSceneDefinition.id, e);
        setLastError(e instanceof Error ? e.message : String(e));
        if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
        currentSceneWebGLAssetsRef.current = null;
        previousSceneWebGLAssetsRef.current = null;
      }
    } else { 
      // New scene is 2D or null, or no initWebGL function
      // Clean up previous WebGL scene assets if switching FROM WebGL to 2D
      if (prevRendererType === 'webgl' && prevSceneObject?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
         console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id} (switching to 2D/none)`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
      // Dispose of the shared WebGL renderer if no WebGL scene is active
      if (webGLRendererRef.current) {
        console.log("VisualizerView: Current scene is not WebGL. Disposing existing WebGL renderer for canvas key:", canvasKey);
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      currentSceneWebGLAssetsRef.current = null;
    }
    
    lastSceneIdRef.current = settings.currentSceneId;

    return () => {
      // This cleanup now focuses on the assets of the scene *that was just active*
      // It will run when settings.currentSceneId changes, or webcamElement changes, or the canvasKey changes (unmounting)
      const sceneToClean = scenes.find(s => s.id === lastSceneIdRef.current); // Use the ID that *was* active
      if (sceneToClean?.rendererType === 'webgl' && sceneToClean.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        // Use previousSceneWebGLAssetsRef because that holds the assets of the scene we are leaving
        console.log(`VisualizerView Effect Cleanup: Cleaning up WebGL assets for scene: ${sceneToClean.id}`);
        sceneToClean.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
    };
  }, [settings.currentSceneId, scenes, canvasKey, webcamElement, settings]); // Added settings for initWebGL context


  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.onload = () => { aiOverlayImageRef.current = img; };
      img.onerror = () => { console.error("VisualizerView: Failed to load AI overlay image."); aiOverlayImageRef.current = null; };
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
        console.log(`[Performance Monitor] Current FPS: ${fps}`);
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - fps > fpsDropThreshold)) {
           console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${fps}`);
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5000); // Log every 5 seconds
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
    ctx.font = `12px var(--font-geist-mono, monospace)`; // GeistMono is now disabled, uses fallback
    const currentFgColor = getComputedStyle(canvas).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;
    
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    const spectrumSample = Array.from(audioData.spectrum.slice(0,5));
    const spectrumSum = audioData.spectrum.reduce((s, v) => s + v, 0);
    // console.log(
    //     'VisualizerView - AudioData (from VisualizerView drawDebugInfo):',
    //     'RMS:', audioData.rms.toFixed(3),
    //     'Beat:', audioData.beat,
    //     'Bass:', audioData.bassEnergy.toFixed(3),
    //     'Mid:', audioData.midEnergy.toFixed(3),
    //     'Treble:', audioData.trebleEnergy.toFixed(3),
    //     'BPM:', audioData.bpm,
    //     'Spectrum Sum:', spectrumSum,
    //     'First 5 bins:', spectrumSample
    // );

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
    const bgColor = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const errorColor = getComputedStyle(canvas).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColor;
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`; // Using SBNF Body Font
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
    let startY = canvas.height / 2 - totalHeight / 2 + lineHeight / 2; // Centered
    
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
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';

    try {
      if (settings.panicMode) {
        if (webGLRendererRef.current && (intendedRendererType === 'webgl' || prevRendererTypeRef.current === 'webgl')) {
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
      } else if (intendedRendererType === 'webgl') {
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.scene && currentSceneWebGLAssetsRef.current.camera && activeSceneDefinition?.drawWebGL) {
           activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: currentSceneWebGLAssetsRef.current.scene,
            camera: currentSceneWebGLAssetsRef.current.camera,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            webcamElement,
          });
          webGLRendererRef.current.render(currentSceneWebGLAssetsRef.current.scene, currentSceneWebGLAssetsRef.current.camera);
          if (lastError) setLastError(null);
        } else if (webGLRendererRef.current) { 
            // WebGL scene is intended, but resources not fully ready, clear with its own renderer.
             const bgColorString = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#000000';
             webGLRendererRef.current.setClearColor(new THREE.Color(bgColorString).getHex(), 1);
             webGLRendererRef.current.clear();
             // No 2D context get here
        } else {
          // console.log("VisualizerView: WebGL renderer not ready for scene:", activeSceneDefinition?.id);
        }
      } else { // 2D Scene
        const ctx = get2DContext();
        if (!ctx && activeSceneDefinition && activeSceneDefinition.draw) {
            if(!lastError) setLastError("VisualizerView: Failed to get 2D context for 2D scene.");
            return; // Can't draw error if no context
        }

        if (ctx) { 
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            if (lastError) {
              drawErrorState(ctx);
            } else if (activeSceneDefinition && activeSceneDefinition.draw) {
              if (isTransitioning2D && previousScene2DRef.current && previousScene2DRef.current.draw) {
                const elapsedTime = performance.now() - transition2DStartTimeRef.current;
                const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);
                drawPrimarySceneContent(ctx, previousScene2DRef.current, 1 - progress);
                drawPrimarySceneContent(ctx, activeSceneDefinition, progress);
                if (progress >= 1) setIsTransitioning2D(false);
              } else {
                drawPrimarySceneContent(ctx, activeSceneDefinition);
              }
              drawAiGeneratedOverlay2D(ctx);
              if (!settings.panicMode) drawDebugInfo(ctx);
            } else {
              const bgColor = getComputedStyle(canvas).getPropertyValue('--background').trim() || 'black';
              ctx.fillStyle = bgColor;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              const fgColor = getComputedStyle(canvas).getPropertyValue('--muted-foreground').trim() || 'gray';
              ctx.fillStyle = fgColor;
              ctx.textAlign = 'center';
              ctx.font = `20px ${SBNF_BODY_FONT_FAMILY}`;
              ctx.fillText(activeSceneDefinition ? 'Scene has no draw function' : 'No scene selected', canvas.width / 2, canvas.height / 2);
            }
        }
      }
    } catch (error) {
      console.error("VisualizerView: Error in draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      const ctxForError = get2DContext(); // Attempt to get 2D context to draw error
      if (ctxForError) drawErrorState(ctxForError);
    }
    prevRendererTypeRef.current = intendedRendererType;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      settings, audioData, scenes, isTransitioning2D, lastError, fps,
      get2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState, updateFps,
      webcamElement
  ]);

  // Ref to store previous renderer type to manage transitions/cleanup
  const prevRendererTypeRef = useRef<string>(scenes.find(s => s.id === settings.currentSceneId)?.rendererType || '2d');
  useEffect(() => {
    prevRendererTypeRef.current = scenes.find(s => s.id === settings.currentSceneId)?.rendererType || '2d';
  }, [settings.currentSceneId, scenes]);


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
            if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.camera) {
              webGLRendererRef.current.setSize(newWidth, newHeight);
              const camera = currentSceneWebGLAssetsRef.current.camera;
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = newWidth / newHeight;
              } else if (camera instanceof THREE.OrthographicCamera) {
                camera.left = -newWidth / 2;
                camera.right = newWidth / 2;
                camera.top = newHeight / 2;
                camera.bottom = -newHeight / 2;
              }
              camera.updateProjectionMatrix();
            }
          }
        });
        resizeObserver.observe(parent);
        // Initial size set
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.camera) { 
            webGLRendererRef.current.setSize(canvas.width, canvas.height);
             const camera = currentSceneWebGLAssetsRef.current.camera;
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = canvas.width / canvas.height;
            } else if (camera instanceof THREE.OrthographicCamera) {
                camera.left = -canvas.width / 2;
                camera.right = canvas.width / 2;
                camera.top = canvas.height / 2;
                camera.bottom = -canvas.height / 2;
            }
            camera.updateProjectionMatrix();
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); // Re-run on canvas re-mount

  useEffect(() => {
    const activeScene = scenes.find(s => s.id === settings.currentSceneId);
    if (!animationFrameIdRef.current && !settings.panicMode && activeScene) { 
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
