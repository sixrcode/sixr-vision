
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY } from '@/lib/brandingConstants';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

/**
 * @fileOverview The main component responsible for rendering the visualizer canvas.
 * It manages the animation loop, scene transitions, webcam feed integration,
 * and overlaying branding elements. It supports both 2D Canvas and WebGL scenes.
 */

export function VisualizerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);


  const { audioData } = useAudioData();
  const { scenes } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(WebGLSceneAssets & { sceneId?: string }) | null>(null);
  const previousSceneWebGLAssetsRef = useRef<(WebGLSceneAssets & { sceneId?: string }) | null>(null);


  const previousScene2DRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string | undefined>(undefined);
  const [canvasKey, setCanvasKey] = useState(0);
  const prevRendererTypeRef = useRef<string | undefined>(undefined);


  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Effect to handle canvas re-keying when renderer type changes
  useEffect(() => {
    const currentSettings = settingsRef.current;
    const newSceneDefinition = scenes.find(s => s.id === currentSettings.currentSceneId) || null;
    const prevSceneDefinition = scenes.find(s => s.id === lastSceneIdRef.current) || null;
    
    const newRendererType = newSceneDefinition?.rendererType || '2d';
    const oldRendererType = prevRendererTypeRef.current;

    if (oldRendererType !== undefined && newRendererType !== oldRendererType) {
      console.log(`VisualizerView: Renderer type changing from ${oldRendererType} to ${newRendererType}. Remounting canvases. New CanvasKey: ${canvasKey + 1}`);
      
      if (oldRendererType === 'webgl' && prevSceneDefinition?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneDefinition.id} (renderer type switch)`);
        prevSceneDefinition.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current) { // Always clean current assets if canvas remounts
          console.log(`VisualizerView: Cleaning up current WebGL assets for scene: ${currentSceneWebGLAssetsRef.current.sceneId || 'unknown'} before canvas remount.`);
          const currentSceneDef = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
          currentSceneDef?.cleanupWebGL?.(currentSceneWebGLAssetsRef.current);
          currentSceneWebGLAssetsRef.current = null;
      }
      
      if (webGLRendererRef.current) {
        console.log("VisualizerView: Disposing main WebGL renderer due to renderer type switch.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      setCanvasKey(prevKey => prevKey + 1);
    } else if (newRendererType === 'webgl' && newSceneDefinition?.id !== lastSceneIdRef.current && prevSceneDefinition?.rendererType === 'webgl') {
      if (prevSceneDefinition?.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneDefinition.id} (WebGL to WebGL switch)`);
        prevSceneDefinition.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
    }
    
    if (newRendererType === '2d' && currentSettings.sceneTransitionActive && currentSettings.sceneTransitionDuration > 0 && prevSceneDefinition) {
        if (oldRendererType === '2d') {
            previousScene2DRef.current = prevSceneDefinition;
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

    lastSceneIdRef.current = currentSettings.currentSceneId;
    prevRendererTypeRef.current = newRendererType;

  }, [settingsRef.current.currentSceneId, scenes, canvasKey]);

  // Effect for WebGL Initialization and Cleanup
  useEffect(() => {
    const currentSettings = settingsRef.current;
    console.log(`[WebGL Init Effect] Running. Scene ID: ${currentSettings.currentSceneId}, CanvasKey: ${canvasKey}, Webcam: ${webcamElement ? 'present' : 'null'}`);
    const canvas = canvasRef.current;
    if (!canvas || !currentSettings.currentSceneId) {
      console.log("[WebGL Init Effect] Canvas or currentSceneId missing, aborting.");
      return;
    }

    const sceneDefinition = scenes.find(s => s.id === currentSettings.currentSceneId);
    if (!sceneDefinition) {
      console.log(`[WebGL Init Effect] Scene definition not found for ID: ${currentSettings.currentSceneId}, aborting.`);
      return;
    }

    if (sceneDefinition.rendererType === 'webgl' && sceneDefinition.initWebGL) {
      console.log(`[WebGL Init Effect] Initializing WebGL for scene: ${sceneDefinition.id}. Renderer: ${webGLRendererRef.current ? 'exists' : 'creating new'}`);
      
      if (!webGLRendererRef.current) {
         console.log("[WebGL Init Effect] Creating new WebGLRenderer instance.");
         webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } else if (webGLRendererRef.current.domElement !== canvas) {
            console.log("[WebGL Init Effect] WebGLRenderer exists, but canvas changed (new key). Disposing old, creating new.");
            webGLRendererRef.current.dispose();
            webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      }
      
      webGLRendererRef.current.setSize(canvas.width, canvas.height);
      webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);
      
      try {
        console.log(`[WebGL Init Effect] Calling initWebGL for ${sceneDefinition.id}`);
        // Clean up assets from a *different* WebGL scene before initializing new one
        if (currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id) {
            const oldSceneDef = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
            if (oldSceneDef?.cleanupWebGL) {
                console.log(`[WebGL Init Effect] Cleaning up assets from previous WebGL scene: ${oldSceneDef.id}`);
                oldSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current);
            }
        }
        const initializedAssets = sceneDefinition.initWebGL(canvas, currentSettings, webcamElement);
        currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id };
        previousSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id }; 
        console.log(`[WebGL Init Effect] initWebGL for ${sceneDefinition.id} successful.`);
        setLastError(null);
      } catch (e) {
        console.error(`[WebGL Init Effect] Error during WebGL initialization for scene ${sceneDefinition.id}:`, e);
        setLastError(e instanceof Error ? e.message : String(e));
        if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
        currentSceneWebGLAssetsRef.current = null;
        previousSceneWebGLAssetsRef.current = null;
      }
    } else if (sceneDefinition.rendererType !== 'webgl' && webGLRendererRef.current) {
      // Current scene is 2D, but a WebGL renderer exists (from a previous scene on the same canvasKey, or a bug)
      console.log(`[WebGL Init Effect] Current scene ${sceneDefinition.id} is 2D. Disposing existing WebGL context.`);
      const prevWebGLSceneDef = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId && s.rendererType === 'webgl');
      if (prevWebGLSceneDef?.cleanupWebGL && currentSceneWebGLAssetsRef.current) {
          console.log(`[WebGL Init Effect] Cleaning up assets for previous WebGL scene: ${prevWebGLSceneDef.id} before disposing renderer.`);
          prevWebGLSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current);
      }
      webGLRendererRef.current.dispose();
      webGLRendererRef.current = null;
      currentSceneWebGLAssetsRef.current = null;
      previousSceneWebGLAssetsRef.current = null;
    } else {
      console.log(`[WebGL Init Effect] Scene ${sceneDefinition.id} is 2D, or no WebGL init needed. Renderer: ${webGLRendererRef.current ? 'exists' : 'null'}`);
    }

    // Cleanup function for this effect
    return () => {
      console.log(`[WebGL Init Effect - CLEANUP] Running for effect instance tied to: Scene ID: ${currentSettings.currentSceneId}, CanvasKey: ${canvasKey}, Webcam: ${webcamElement ? 'present' : 'null'}`);
      // This cleanup should be for assets of the scene THIS effect instance initialized.
      // If canvasKey changes, the renderer and old assets are cleaned by the *other* effect or by the new run of *this* effect.
      // This specific cleanup primarily handles the case where this effect re-runs due to webcamElement change FOR THE SAME scene and canvasKey.
      if (sceneDefinition?.rendererType === 'webgl' && sceneDefinition.cleanupWebGL && currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId === sceneDefinition.id) {
        // Only clean if the assets are for the scene this effect instance was about.
        console.log(`[WebGL Init Effect - CLEANUP] Cleaning up WebGL assets for current scene: ${sceneDefinition.id} due to dependency change (e.g. webcam).`);
        sceneDefinition.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        currentSceneWebGLAssetsRef.current = null; 
      }
    };
  }, [settingsRef.current.currentSceneId, scenes, canvasKey, webcamElement]);

  useEffect(() => {
    if (settingsRef.current.enableAiOverlay && settingsRef.current.aiGeneratedOverlayUri) {
      const img = new Image();
      img.onload = () => { aiOverlayImageRef.current = img; };
      img.onerror = () => { console.error("VisualizerView: Failed to load AI overlay image."); aiOverlayImageRef.current = null; };
      img.src = settingsRef.current.aiGeneratedOverlayUri;
    } else {
      aiOverlayImageRef.current = null;
    }
  }, [settingsRef.current.enableAiOverlay, settingsRef.current.aiGeneratedOverlayUri]);

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
      if (!settingsRef.current.panicMode && fps > 0) {
        // console.log(`[Performance Monitor] Current FPS: ${fps}`); 
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - fps > 10)) {
           console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${fps}`);
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5000);
    return () => {
      if (fpsLogIntervalRef.current) clearInterval(fpsLogIntervalRef.current);
    };
  }, [fps]);

  const drawPrimarySceneContent = useCallback((
    ctx: CanvasRenderingContext2D,
    sceneToDraw: SceneDefinition,
    alpha: number = 1
  ) => {
    if (sceneToDraw.draw) {
      ctx.save();
      ctx.globalAlpha = alpha;
      sceneToDraw.draw(ctx, audioData, settingsRef.current, webcamElement);
      ctx.restore();
    }
  }, [audioData, webcamElement]);

  const drawAiGeneratedOverlay2D = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (settingsRef.current.enableAiOverlay && aiOverlayImageRef.current && ctx) {
      const originalAlpha = ctx.globalAlpha;
      const originalCompositeOperation = ctx.globalCompositeOperation;
      ctx.globalAlpha = settingsRef.current.aiOverlayOpacity;
      ctx.globalCompositeOperation = settingsRef.current.aiOverlayBlendMode;
      ctx.drawImage(aiOverlayImageRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = originalAlpha;
      ctx.globalCompositeOperation = originalCompositeOperation;
    }
  }, []);

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.font = `12px ${SBNF_BODY_FONT_FAMILY}`;
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;
    
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    ctx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    
    const spectrumData = audioData.spectrum || INITIAL_AUDIO_DATA.spectrum;
    const spectrumSum = spectrumData.reduce((s, v) => s + v, 0);

    ctx.fillText(`RMS: ${audioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Beat: ${audioData.beat ? 'YES' : 'NO'}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Bass: ${audioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Mid: ${audioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Treble: ${audioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`BPM: ${audioData.bpm}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Spectrum Sum: ${spectrumSum}`, canvas.width - 10, currentY);
  }, [fps, audioData]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColor;
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
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
    
    const currentSettingsVal = settingsRef.current;

    const activeSceneDefinition = scenes.find(s => s.id === currentSettingsVal.currentSceneId);
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';
    
    // console.log(`[DrawLoop] Frame. Scene: ${activeSceneDefinition?.id}, Renderer: ${intendedRendererType}, Panic: ${currentSettingsVal.panicMode}, Error: ${lastError}`);

    try {
      if (currentSettingsVal.panicMode) {
        if (intendedRendererType === 'webgl' && webGLRendererRef.current) {
          const panicColor = new THREE.Color(0x000000);
          webGLRendererRef.current.setClearColor(panicColor, 1);
          webGLRendererRef.current.clear();
        } else {
          const mainCtx = get2DContext();
          if (mainCtx) {
            mainCtx.fillStyle = 'black';
            mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          }
        }
        if (lastError) setLastError(null);
      } else if (intendedRendererType === 'webgl') {
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === activeSceneDefinition?.id && currentSceneWebGLAssetsRef.current?.scene && currentSceneWebGLAssetsRef.current?.camera && activeSceneDefinition?.drawWebGL) {
           activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: currentSceneWebGLAssetsRef.current.scene,
            camera: currentSceneWebGLAssetsRef.current.camera,
            audioData,
            settings: currentSettingsVal,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: mainCanvas.width,
            canvasHeight: mainCanvas.height,
            webcamElement,
          });
          webGLRendererRef.current.render(currentSceneWebGLAssetsRef.current.scene, currentSceneWebGLAssetsRef.current.camera);
          if (lastError) setLastError(null);
        } else if (webGLRendererRef.current) { 
             const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
             const bgColorThree = new THREE.Color(`hsl(${bgColorString})`);
             webGLRendererRef.current.setClearColor(bgColorThree, 1);
             webGLRendererRef.current.clear();
        }
      } else { // Intended renderer is 2D
        const mainCtx = get2DContext();
        if (mainCtx) { 
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height); 
            if (lastError) {
              drawErrorState(mainCtx);
            } else if (activeSceneDefinition && activeSceneDefinition.draw) {
              if (isTransitioning2D && previousScene2DRef.current?.draw && prevRendererTypeRef.current === '2d' && intendedRendererType === '2d' && currentSettingsVal.sceneTransitionActive) {
                const elapsedTime = performance.now() - transition2DStartTimeRef.current;
                const progress = Math.min(1, elapsedTime / currentSettingsVal.sceneTransitionDuration);
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
              mainCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
              mainCtx.fillText(activeSceneDefinition ? `Scene '${activeSceneDefinition.name}' has no 2D draw function` : 'No scene selected', mainCanvas.width / 2, mainCanvas.height / 2);
            }
        } else if (activeSceneDefinition?.draw) {
             if(!lastError) setLastError(`VisualizerView: Failed to get 2D context for 2D scene: ${activeSceneDefinition.id}.`);
        }
      }

      const overlayCtx = getOverlay2DContext();
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
        if (!currentSettingsVal.panicMode && !lastError) { 
          drawAiGeneratedOverlay2D(overlayCtx);
          drawDebugInfo(overlayCtx);
        } else if (currentSettingsVal.panicMode) {
           overlayCtx.fillStyle = 'black';
           overlayCtx.fillRect(0,0, overlayCv.width, overlayCv.height);
        }
      }

    } catch (error) {
      console.error("VisualizerView: Error in draw loop:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      const mainCtxForError = get2DContext(); 
      if (mainCtxForError) drawErrorState(mainCtxForError);
    }
  }, [
      scenes, audioData, isTransitioning2D, lastError, fps,
      get2DContext, getOverlay2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState, updateFps,
      webcamElement, setIsTransitioning2D 
  ]);


  useEffect(() => {
    if (prevRendererTypeRef.current === undefined && settingsRef.current.currentSceneId && scenes.length > 0) {
        const initialSceneDef = scenes.find(s => s.id === settingsRef.current.currentSceneId);
        if (initialSceneDef) {
            prevRendererTypeRef.current = initialSceneDef.rendererType || '2d';
            console.log(`VisualizerView: Initial prevRendererTypeRef set to ${prevRendererTypeRef.current} for scene ${initialSceneDef.id}`);
        }
    }

    if (animationFrameIdRef.current) { 
        cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]); 

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
        
        const initialWidth = parent.clientWidth;
        const initialHeight = parent.clientHeight;
        if(mainC.width !== initialWidth || mainC.height !== initialHeight) {
            mainC.width = initialWidth;
            mainC.height = initialHeight;
        }
        if(overlayC.width !== initialWidth || overlayC.height !== initialHeight) {
            overlayC.width = initialWidth;
            overlayC.height = initialHeight;
        }
        

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
  }, [canvasKey]); 

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={`main-canvas-${canvasKey}`} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={`overlay-canvas-${canvasKey}`} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

