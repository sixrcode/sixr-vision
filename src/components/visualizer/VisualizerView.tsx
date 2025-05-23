
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { scenes } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<WebGLSceneAssets | null>(null);
  const previousSceneWebGLAssetsRef = useRef<WebGLSceneAssets | null>(null);

  const previousScene2DRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);
  const [canvasKey, setCanvasKey] = useState(0);

  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10;
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevRendererTypeRef = useRef<string | undefined>(undefined);

  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (webGLRendererRef.current && webGLRendererRef.current.domElement === canvas) {
      return null;
    }
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for main canvas:", e);
      return null;
    }
  }, []);

  const getOverlay2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for overlay canvas:", e);
      return null;
    }
  }, []);

  useEffect(() => {
    const newSceneDefinition = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current) || null;
    const newRendererType = newSceneDefinition?.rendererType || '2d';

    if (prevRendererTypeRef.current !== newRendererType) {
      console.log(`VisualizerView: Renderer type changed from ${prevRendererTypeRef.current} to ${newRendererType}. Remounting main canvas and overlay canvas.`);
      
      if (prevRendererTypeRef.current === 'webgl' && prevSceneObject?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id} (renderer type switch)`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current && newSceneDefinition?.cleanupWebGL) {
        newSceneDefinition.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        currentSceneWebGLAssetsRef.current = null;
      }
      
      if (webGLRendererRef.current) {
        console.log("VisualizerView: Disposing main WebGL renderer due to renderer type switch.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      setCanvasKey(prevKey => prevKey + 1); // This will remount both canvases
      
    } else if (newSceneDefinition?.id !== lastSceneIdRef.current) { // Scene changed but renderer type is the same
       if (newRendererType === '2d' && settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 && prevSceneObject) {
        previousScene2DRef.current = prevSceneObject;
        setIsTransitioning2D(true);
        transition2DStartTimeRef.current = performance.now();
      } else {
        previousScene2DRef.current = null;
        setIsTransitioning2D(false);
      }
      // Cleanup old WebGL scene if switching to another WebGL scene
      if (newRendererType === 'webgl' && prevSceneObject?.rendererType === 'webgl' && prevSceneObject.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id} (same renderer type switch)`);
        prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
    }
    
    lastSceneIdRef.current = settings.currentSceneId;
    prevRendererTypeRef.current = newRendererType;

  }, [settings.currentSceneId, scenes, settings.sceneTransitionActive, settings.sceneTransitionDuration]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !settings.currentSceneId) return;

    const sceneDefinition = scenes.find(s => s.id === settings.currentSceneId);
    if (!sceneDefinition) return;

    if (sceneDefinition.rendererType === 'webgl' && sceneDefinition.initWebGL) {
        console.log(`VisualizerView: Initializing WebGL for scene: ${sceneDefinition.id} (Canvas Key: ${canvasKey})`);
        
        // Ensure existing renderer is disposed if we are re-initializing WebGL for a *new* scene
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.scene !== sceneDefinition.id) {
             if (currentSceneWebGLAssetsRef.current && sceneDefinition.cleanupWebGL) { // Ensure previous scene's assets are cleaned
                console.log("VisualizerView: Cleaning up previous WebGL scene assets before new init.");
                sceneDefinition.cleanupWebGL(currentSceneWebGLAssetsRef.current);
             }
        }
        
        if (!webGLRendererRef.current) {
            console.log("VisualizerView: Creating new WebGLRenderer instance for canvas key:", canvasKey);
            webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        }
        webGLRendererRef.current.setSize(canvas.width, canvas.height);
        webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);

        try {
            const initializedAssets = sceneDefinition.initWebGL(canvas, settings, webcamElement);
            currentSceneWebGLAssetsRef.current = initializedAssets;
            previousSceneWebGLAssetsRef.current = initializedAssets; // Keep for potential transitions or cleanup
            setLastError(null);
        } catch (e) {
            console.error("VisualizerView: Error during WebGL initialization for scene:", sceneDefinition.id, e);
            setLastError(e instanceof Error ? e.message : String(e));
            if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
            currentSceneWebGLAssetsRef.current = null;
            previousSceneWebGLAssetsRef.current = null;
        }
    } else if (webGLRendererRef.current) { // Current scene is 2D, but WebGL renderer exists from previous scene
        console.log("VisualizerView: Current scene is not WebGL. Disposing existing WebGL context for canvas key:", canvasKey);
        const prevWebGLScene = scenes.find(s => s.id === lastSceneIdRef.current && s.rendererType === 'webgl');
        if (prevWebGLScene?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
            prevWebGLScene.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        }
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
        currentSceneWebGLAssetsRef.current = null;
        previousSceneWebGLAssetsRef.current = null;
    }

    return () => {
      const sceneToClean = scenes.find(s => s.id === settings.currentSceneId); // Use currentSceneId for cleanup consistency
      if (sceneToClean?.rendererType === 'webgl' && sceneToClean.cleanupWebGL && currentSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView Effect Cleanup: Cleaning up WebGL assets for current scene: ${sceneToClean.id}`);
        sceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        currentSceneWebGLAssetsRef.current = null; // Nullify after cleanup
      }
      // Do not nullify webGLRendererRef here, it's managed by the canvasKey/sceneType change effect
    };
  }, [settings.currentSceneId, scenes, canvasKey, webcamElement, settings]);


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
        // console.log(`[Performance Monitor] Current FPS: ${fps}`);
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
      console.log('AI Overlay Drawn with blend mode:', settings.aiOverlayBlendMode);
    }
  }, [settings.enableAiOverlay, settings.aiOverlayOpacity, settings.aiOverlayBlendMode]);

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.font = `12px var(--font-geist-mono, monospace)`; // GeistMono is commented out, will use fallback
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;
    
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    ctx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    const spectrumSum = audioData.spectrum.reduce((s, v) => s + v, 0);
    // console.log(`VisualizerView - AudioData: RMS: ${audioData.rms.toFixed(3)} Beat: ${audioData.beat} Bass: ${audioData.bassEnergy.toFixed(3)} Mid: ${audioData.midEnergy.toFixed(3)} Treble: ${audioData.trebleEnergy.toFixed(3)} BPM: ${audioData.bpm} Spectrum Sum: ${spectrumSum} First 5 bins: ${Array.from(audioData.spectrum.slice(0,5))}`);

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
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColor;
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`; // Poppins or fallback
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
    updateFps();

    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current;
    if (!mainCanvas || !overlayCv) return;
    
    const activeSceneDefinition = scenes.find(s => s.id === settings.currentSceneId);
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';

    try {
      if (settings.panicMode) {
        if (intendedRendererType === 'webgl' && webGLRendererRef.current) {
          webGLRendererRef.current.setClearColor(0x000000, 1);
          webGLRendererRef.current.clear();
        } else { // 2D or WebGL not ready
          const mainCtx = get2DContext();
          if (mainCtx) {
            mainCtx.fillStyle = 'black';
            mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          }
        }
        if (lastError) setLastError(null);
      } else if (intendedRendererType === 'webgl') {
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.scene && currentSceneWebGLAssetsRef.current?.camera && activeSceneDefinition?.drawWebGL) {
           activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: currentSceneWebGLAssetsRef.current.scene,
            camera: currentSceneWebGLAssetsRef.current.camera,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: mainCanvas.width,
            canvasHeight: mainCanvas.height,
            webcamElement,
          });
          webGLRendererRef.current.render(currentSceneWebGLAssetsRef.current.scene, currentSceneWebGLAssetsRef.current.camera);
          if (lastError) setLastError(null);
        } else if (webGLRendererRef.current) { 
             const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#000000';
             webGLRendererRef.current.setClearColor(new THREE.Color(bgColorString).getHex(), 1);
             webGLRendererRef.current.clear();
        }
      } else { // Intended renderer is 2D
        const mainCtx = get2DContext();
        if (mainCtx) { 
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height); 
            if (lastError) {
              drawErrorState(mainCtx);
            } else if (activeSceneDefinition && activeSceneDefinition.draw) {
              if (isTransitioning2D && previousScene2DRef.current && previousScene2DRef.current.draw) {
                const elapsedTime = performance.now() - transition2DStartTimeRef.current;
                const progress = Math.min(1, elapsedTime / settings.sceneTransitionDuration);
                drawPrimarySceneContent(mainCtx, previousScene2DRef.current, 1 - progress);
                drawPrimarySceneContent(mainCtx, activeSceneDefinition, progress);
                if (progress >= 1) setIsTransitioning2D(false);
              } else {
                drawPrimarySceneContent(mainCtx, activeSceneDefinition);
              }
            } else {
              const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
              mainCtx.fillStyle = bgColor;
              mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
              const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
              mainCtx.fillStyle = fgColor;
              mainCtx.textAlign = 'center';
              mainCtx.font = `20px ${SBNF_BODY_FONT_FAMILY}`;
              mainCtx.fillText(activeSceneDefinition ? 'Scene has no draw function' : 'No scene selected', mainCanvas.width / 2, mainCanvas.height / 2);
            }
        } else if (activeSceneDefinition && activeSceneDefinition.draw) {
             if(!lastError) setLastError("VisualizerView: Failed to get 2D context for main canvas for 2D scene.");
        }
      }

      const overlayCtx = getOverlay2DContext();
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
        if (!settings.panicMode && !lastError && intendedRendererType !== 'webgl') { 
          drawAiGeneratedOverlay2D(overlayCtx);
          drawDebugInfo(overlayCtx);
        } else if (!settings.panicMode && !lastError && intendedRendererType === 'webgl') {
          // For WebGL scenes, overlays are drawn on the separate canvas
          drawAiGeneratedOverlay2D(overlayCtx); 
          // Debug info could still be drawn here if desired, but for now it's off for WebGL scenes by design
        } else if (settings.panicMode) {
           overlayCtx.fillStyle = 'black';
           overlayCtx.fillRect(0,0, overlayCv.width, overlayCv.height);
        }
      }

    } catch (error) {
      console.error("VisualizerView: Error in draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      const mainCtxForError = get2DContext(); // Try to get 2D context for error drawing
      if (mainCtxForError) drawErrorState(mainCtxForError);
    }
  }, [
      settings, audioData, scenes, isTransitioning2D, lastError, fps,
      get2DContext, getOverlay2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState, updateFps,
      webcamElement
  ]);


  useEffect(() => {
    const mainC = canvasRef.current;
    const overlayC = overlayCanvasRef.current;

    if (mainC && overlayC) {
      const parent = mainC.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          const newWidth = parent.clientWidth;
          const newHeight = parent.clientHeight;

          if(mainC.width !== newWidth || mainC.height !== newHeight) {
            mainC.width = newWidth;
            mainC.height = newHeight;
          }
          if(overlayC.width !== newWidth || overlayC.height !== newHeight) {
            overlayC.width = newWidth;
            overlayC.height = newHeight;
          }
          
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
        });
        resizeObserver.observe(parent);
        
        // Initial size set
        const initialWidth = parent.clientWidth;
        const initialHeight = parent.clientHeight;
        mainC.width = initialWidth;
        mainC.height = initialHeight;
        overlayC.width = initialWidth;
        overlayC.height = initialHeight;

        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.camera) { 
            webGLRendererRef.current.setSize(initialWidth, initialHeight);
             const camera = currentSceneWebGLAssetsRef.current.camera;
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = initialWidth / initialHeight;
            } else if (camera instanceof THREE.OrthographicCamera) {
                camera.left = -initialWidth / 2;
                camera.right = initialWidth / 2;
                camera.top = initialHeight / 2;
                camera.bottom = -initialHeight / 2;
            }
            camera.updateProjectionMatrix();
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); // Re-run on canvasKey change

  useEffect(() => {
    const activeScene = scenes.find(s => s.id === settings.currentSceneId);
    if (prevRendererTypeRef.current === undefined && activeScene) {
        prevRendererTypeRef.current = activeScene.rendererType || '2d';
    }

    if (!animationFrameIdRef.current) { 
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]); // Draw loop is now memoized and depends on other factors.

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={canvasKey} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={canvasKey + '_overlay'} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
