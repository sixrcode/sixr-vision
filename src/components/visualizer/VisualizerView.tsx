
"use client";

import type { ReactNode } from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
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
  const audioDataRef = useRef(audioData);
  useEffect(() => {
    audioDataRef.current = audioData;
  }, [audioData]);

  const { scenes, currentScene } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);
  const previousSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);

  const previousScene2DRef = useRef<SceneDefinition | null>(null);
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);

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

    // Guard against trying to get 2D context for a canvas intended for WebGL
    const intendedSceneDef = scenes.find(s => s.id === settingsRef.current.currentSceneId);
    if (intendedSceneDef?.rendererType === 'webgl') {
      // console.warn("[VisualizerView get2DContext] Attempted to get 2D context for a WebGL-intended canvas. Aborting.");
      return null;
    }

    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for main canvas:", e);
      return null;
    }
  }, [scenes, settingsRef]);

  const getOverlay2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d', { alpha: true });
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for overlay canvas:", e);
      return null;
    }
  }, []);

  // Effect to manage canvasKey for re-mounting on renderer type switch
  useEffect(() => {
    const currentActualScene = scenes.find(s => s.id === settingsRef.current.currentSceneId);
    const currentActualRendererType = currentActualScene?.rendererType || '2d';

    if (prevRendererTypeRef.current !== undefined && prevRendererTypeRef.current !== currentActualRendererType) {
      console.log(`[VisualizerView CanvasKey Effect] Renderer type changing from ${prevRendererTypeRef.current} to ${currentActualRendererType}. Remounting canvases by incrementing canvasKey.`);
      setCanvasKey(key => key + 1);
    }
    prevRendererTypeRef.current = currentActualRendererType;
  }, [settingsRef.current.currentSceneId, scenes]);


  // Effect for WebGL initialization and cleanup based on currentScene, canvasKey, and webcamElement
  useEffect(() => {
    setLastError(null); // Clear previous errors when scene, canvas, or webcam changes
    const canvas = canvasRef.current;
    const sceneDefinition = currentScene; // Directly use currentScene from useScene() context

    console.log(`[WebGL/CanvasKey Effect] Running. Scene: ${sceneDefinition?.id}, RendererType: ${sceneDefinition?.rendererType}, CanvasKey: ${canvasKey}, Webcam: ${webcamElement ? 'Available' : 'Not Available'}`);

    if (!canvas || !sceneDefinition) {
      console.log("[WebGL/CanvasKey Effect] Main canvas or current scene definition missing, ensuring cleanup.");
      if (webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Disposing main WebGL renderer due to missing canvas/scene.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up assets for previous WebGL scene ${prevSceneToClean.id}.`);
          prevSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      return;
    }

    if (sceneDefinition.rendererType === 'webgl') {
      if (!webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Creating new WebGLRenderer instance.");
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            powerPreference: 'high-performance'
          });
        } catch (e) {
            console.error("[WebGL/CanvasKey Effect] Error creating WebGLRenderer:", e);
            setLastError(e instanceof Error ? e.message : String(e));
            if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
            return;
        }
      }
      webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
      webGLRendererRef.current.setSize(canvas.width, canvas.height);

      // Cleanup previous scene's WebGL assets if different
      if (currentSceneWebGLAssetsRef.current?.sceneId && currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id) {
        const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneDefToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up previous WebGL scene assets: ${prevSceneDefToClean.id}`);
          prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
        currentSceneWebGLAssetsRef.current = null;
      }
      
      // Initialize new scene's WebGL assets if not already initialized for this scene ID
      // OR if the webcamElement has changed and the scene uses it (e.g., mirror_silhouette)
      if (
        sceneDefinition.initWebGL && 
        (!currentSceneWebGLAssetsRef.current || currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id ||
         (sceneDefinition.id === 'mirror_silhouette' && currentSceneWebGLAssetsRef.current.webcamElement !== webcamElement)) // Specific check for webcam-dependent scene
      ) {
        try {
          console.log(`[WebGL/CanvasKey Effect] Calling initWebGL for ${sceneDefinition.id} (Webcam: ${webcamElement ? 'Passed' : 'Not Passed'})`);
          const initializedAssets = sceneDefinition.initWebGL(canvas, settingsRef.current, webcamElement); // Pass webcamElement
          currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id, webcamElement }; // Store webcamElement with assets for mirror_silhouette
          console.log(`[WebGL/CanvasKey Effect] initWebGL for ${sceneDefinition.id} successful.`);
        } catch (e) {
          console.error(`[WebGL/CanvasKey Effect] Error during WebGL initialization for scene ${sceneDefinition.id}:`, e);
          setLastError(e instanceof Error ? e.message : String(e));
          currentSceneWebGLAssetsRef.current = null;
        }
      }
    } else { // Scene is 2D
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevWebGLSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevWebGLSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up WebGL scene assets for ${prevWebGLSceneToClean.id} as switching to 2D.`);
          prevWebGLSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
      }
      if (webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Disposing WebGL renderer as switching to 2D scene.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      currentSceneWebGLAssetsRef.current = null;

      // Handle 2D scene transitions
      if (previousScene2DRef.current && previousScene2DRef.current.id !== sceneDefinition.id && settingsRef.current.sceneTransitionActive && settingsRef.current.sceneTransitionDuration > 0) {
        // Already have a previous 2D scene, new one is also 2D: Start transition
        setIsTransitioning2D(true);
        transition2DStartTimeRef.current = performance.now();
      } else {
        setIsTransitioning2D(false);
      }
      previousScene2DRef.current = sceneDefinition; // Store the new 2D scene as previous for the next transition
    }

    return () => {
      // Cleanup on effect re-run or component unmount.
      // Scene-specific cleanup is handled when sceneDefinition changes or canvasKey changes.
      // Global renderer cleanup is handled if switching from webgl to 2d, or on component unmount.
      // If canvasKey changes, the old renderer associated with the old canvas should be disposed.
      // This specific effect's cleanup is tricky because the renderer might be shared.
      // The more robust cleanup is handled when a new canvas is created (new canvasKey)
      // or when switching from WebGL to 2D.
      console.log(`[WebGL/CanvasKey Effect - CLEANUP] Running for scene: ${sceneDefinition?.id} with canvasKey: ${canvasKey}`);
    };
  }, [currentScene, canvasKey, webcamElement, scenes, settingsRef]);


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
      const currentSettings = settingsRef.current;
      if (!currentSettings.panicMode && fps > 0) {
        // console.log(`[Performance Monitor] Current FPS: ${fps}`);
        if (lastLoggedFpsRef.current > 0 && (fps < lastLoggedFpsRef.current - 10) && fps < 50) {
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
    const currentAudioData = audioDataRef.current;
    const currentSettings = settingsRef.current;
    if (sceneToDraw.draw) {
      ctx.save();
      ctx.globalAlpha = alpha;
      sceneToDraw.draw(ctx, currentAudioData, currentSettings, webcamElement);
      ctx.restore();
    }
  }, [webcamElement, settingsRef, audioDataRef]);

  const drawAiGeneratedOverlay2D = useCallback((overlayCtx: CanvasRenderingContext2D | null) => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && aiOverlayImageRef.current && overlayCtx) {
      const originalAlpha = overlayCtx.globalAlpha;
      const originalCompositeOperation = overlayCtx.globalCompositeOperation;
      overlayCtx.globalAlpha = currentSettings.aiOverlayOpacity;
      overlayCtx.globalCompositeOperation = currentSettings.aiOverlayBlendMode;
      overlayCtx.drawImage(aiOverlayImageRef.current, 0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
      // console.log(`AI Overlay Drawn with blend mode: ${currentSettings.aiOverlayBlendMode}, opacity: ${currentSettings.aiOverlayOpacity}`);
      overlayCtx.globalAlpha = originalAlpha;
      overlayCtx.globalCompositeOperation = originalCompositeOperation;
    }
  }, [settingsRef]);

  const drawDebugInfo = useCallback((overlayCtx: CanvasRenderingContext2D | null) => {
    if (!overlayCtx) return;
    const currentAudioData = audioDataRef.current || INITIAL_AUDIO_DATA;
    const spectrum = currentAudioData.spectrum || INITIAL_AUDIO_DATA.spectrum;
    const canvas = overlayCtx.canvas;
    overlayCtx.font = `12px ${SBNF_BODY_FONT_FAMILY}`; // Use SBNF Poppins
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    overlayCtx.fillStyle = currentFgColor;

    overlayCtx.textAlign = 'left';
    overlayCtx.fillText(`FPS: ${fps}`, 10, 20);

    overlayCtx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    const spectrumSum = spectrum.reduce((s, v) => s + v, 0);

    overlayCtx.fillText(`RMS: ${currentAudioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Beat: ${currentAudioData.beat ? 'YES' : 'NO'}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Bass: ${currentAudioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Mid: ${currentAudioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Treble: ${currentAudioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`BPM: ${currentAudioData.bpm}`, canvas.width - 10, currentY);
    if(currentScene?.id) {
        currentY += lineSpacing;
        overlayCtx.fillText(`Scene: ${currentScene.id} (${currentScene.rendererType})`, canvas.width - 10, currentY);
    }
    console.log(`VisualizerView - AudioData: RMS: ${currentAudioData.rms.toFixed(3)} Beat: ${currentAudioData.beat} Bass: ${currentAudioData.bassEnergy.toFixed(3)} Mid: ${currentAudioData.midEnergy.toFixed(3)} Treble: ${currentAudioData.trebleEnergy.toFixed(3)} BPM: ${currentAudioData.bpm} Spectrum Sum: ${spectrumSum} First 5 bins: ${Array.from(spectrum.slice(0,5))}`);

  }, [fps, currentScene, audioDataRef]);

  const drawErrorState = useCallback((targetCtx: CanvasRenderingContext2D | null) => {
    if (!targetCtx || !lastError) return;
    const canvas = targetCtx.canvas;
    targetCtx.clearRect(0, 0, canvas.width, canvas.height); // Clear the target canvas
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
    targetCtx.fillStyle = bgColor;
    targetCtx.fillRect(0, 0, canvas.width, canvas.height);
    targetCtx.font = `bold 16px ${SBNF_BODY_FONT_FAMILY}`;
    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    targetCtx.fillStyle = errorColor;
    targetCtx.textAlign = 'center';
    targetCtx.fillText('Visualizer Error:', canvas.width / 2, canvas.height / 2 - 20);
    targetCtx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
    const lines = lastError.split('\n');
    lines.forEach((line, index) => {
      targetCtx.fillText(line, canvas.width / 2, canvas.height / 2 + (index * 18));
    });
  }, [lastError]);


  const drawSceneAndOverlays = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current;

    if (!mainCanvas || !overlayCv) return;

    const currentSettingsVal = settingsRef.current;
    const currentAudioDataVal = audioDataRef.current;
    // Use currentScene from context directly as the source of truth
    const activeSceneDefinition = currentScene; 
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';

    // console.log(`[DrawLoop] Frame. Scene: ${activeSceneDefinition?.id}, Renderer: ${intendedRendererType}, Panic: ${currentSettingsVal.panicMode}, Error: ${lastError}, MainCanvas: ${mainCanvas ? 'OK':'null'}, OverlayCanvas: ${overlayCv ? 'OK':'null'}`);
    
    const overlayCtx = getOverlay2DContext();
    if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
    }

    if (currentSettingsVal.panicMode) {
      if (webGLRendererRef.current && intendedRendererType === 'webgl') { // Only clear WebGL if it's the intended type and renderer exists
        const panicColor = new THREE.Color(0x000000);
        webGLRendererRef.current.setClearColor(panicColor, 1);
        webGLRendererRef.current.clear();
      } else { // For 2D or if WebGL renderer isn't ready/intended
        const mainCtx = get2DContext(); 
        if(mainCtx) {
          mainCtx.fillStyle = 'black';
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
        }
      }
      if (lastError && overlayCtx) drawErrorState(overlayCtx); // Draw error on overlay if panic AND error
      return;
    }

    if (lastError) {
        if (overlayCtx) drawErrorState(overlayCtx); // Always draw error on overlay canvas
        // Main canvas clear for error state:
        if (intendedRendererType === 'webgl' && webGLRendererRef.current) {
          const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
          const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
          webGLRendererRef.current.setClearColor(bgColorThree, 1);
          webGLRendererRef.current.clear();
        } else if (intendedRendererType === '2d') {
          const mainCtx = get2DContext();
          if (mainCtx) {
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
            mainCtx.fillStyle = bgColor;
            mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          }
        }
        return;
    }

    // Main scene rendering
    if (intendedRendererType === 'webgl') {
      if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === activeSceneDefinition?.id && activeSceneDefinition?.drawWebGL) {
        const { scene, camera, ...assets } = currentSceneWebGLAssetsRef.current;
        if (scene && camera) { // Ensure scene and camera are available
          activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene, camera, audioData: currentAudioDataVal, settings: currentSettingsVal,
            webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement
          });
          webGLRendererRef.current.render(scene, camera);
        } else {
            // console.warn(`[DrawLoop] WebGL scene ${activeSceneDefinition?.id} assets missing scene/camera.`);
             if (overlayCtx) {
                overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
                overlayCtx.textAlign = 'center';
                overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
                overlayCtx.fillText(activeSceneDefinition ? `WebGL scene '${activeSceneDefinition.name}' assets loading...` : 'Loading WebGL scene...', mainCanvas.width / 2, mainCanvas.height / 2);
            }
        }
      } else if (webGLRendererRef.current) { // Renderer exists, but scene assets not ready or mismatched
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
        const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
        if (overlayCtx) {
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText(activeSceneDefinition ? `WebGL scene '${activeSceneDefinition.name}' loading...` : 'Loading WebGL scene...', mainCanvas.width / 2, mainCanvas.height / 2);
        }
      }
      // NO get2DContext() for canvasRef if WebGL is intended
    } else { // Intended renderer is 2D or scene is undefined
      const mainCtx = get2DContext(); 
      if (mainCtx) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (activeSceneDefinition?.draw) {
          if (isTransitioning2D && previousScene2DRef.current?.draw && activeSceneDefinition.rendererType === '2d' && currentSettingsVal.sceneTransitionActive) {
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
          if (overlayCtx) {
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText(activeSceneDefinition ? `Scene '${activeSceneDefinition.name}' (2D) missing draw function` : 'No scene selected or scene loading...', mainCanvas.width / 2, mainCanvas.height / 2);
          }
        }
      }
    }

    // Draw 2D overlays on the separate overlay canvas
    if (overlayCtx && !currentSettingsVal.panicMode && !lastError) {
        drawAiGeneratedOverlay2D(overlayCtx);
        if (currentSceneWebGLAssetsRef.current?.vinesData?.activeVines && intendedRendererType === 'webgl') {
            drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
        }
        drawDebugInfo(overlayCtx);
    }
  }, [
    currentScene, // Source of truth for current scene definition
    get2DContext, getOverlay2DContext, drawErrorState, drawPrimarySceneContent,
    drawAiGeneratedOverlay2D, drawDebugInfo, drawProceduralVinesOnOverlay,
    isTransitioning2D, webcamElement, settingsRef, audioDataRef, lastError // Other dependencies
  ]);


  useEffect(() => {
    console.log("[DrawLoop Effect] Setting up main animation loop.");
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    const loop = () => {
      updateFps();
      drawSceneAndOverlays();
      animationFrameIdRef.current = requestAnimationFrame(loop);
    };
    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        console.log("[DrawLoop Effect - CLEANUP] Cancelling main animation loop. ID:", animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [updateFps, drawSceneAndOverlays]);

  useEffect(() => {
    const mainC = canvasRef.current;
    const overlayC = overlayCanvasRef.current;

    if (mainC && overlayC) {
      const parent = mainC.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          const newWidth = parent.clientWidth;
          const newHeight = parent.clientHeight;

          if (mainC.width !== newWidth || mainC.height !== newHeight) {
            mainC.width = newWidth;
            mainC.height = newHeight;
          }
          if (overlayC.width !== newWidth || overlayC.height !== newHeight) {
            overlayC.width = newWidth;
            overlayC.height = newHeight;
          }

          if (webGLRendererRef.current) {
            webGLRendererRef.current.setSize(newWidth, newHeight);
            const sceneAssets = currentSceneWebGLAssetsRef.current; 
            if (sceneAssets?.camera) {
              const camera = sceneAssets.camera;
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = newWidth / newHeight;
              } else if (camera instanceof THREE.OrthographicCamera) {
                // Adjust orthographic camera projection for new size
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

        // Initial size setting
        const initialWidth = parent.clientWidth;
        const initialHeight = parent.clientHeight;
        if (mainC.width !== initialWidth || mainC.height !== initialHeight) {
          mainC.width = initialWidth;
          mainC.height = initialHeight;
        }
        if (overlayC.width !== initialWidth || overlayC.height !== initialHeight) {
          overlayC.width = initialWidth;
          overlayC.height = initialHeight;
        }

        if (webGLRendererRef.current) {
          webGLRendererRef.current.setSize(initialWidth, initialHeight);
          const sceneAssets = currentSceneWebGLAssetsRef.current;
          if (sceneAssets?.camera) {
            const camera = sceneAssets.camera;
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
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); 

  const drawProceduralVinesOnOverlay = useCallback((overlayCtx: CanvasRenderingContext2D, vines?: ProceduralVine[]) => {
    if (!overlayCtx || !vines || vines.length === 0) return;

    vines.forEach(vine => {
      if (vine.points.length < 2 || vine.opacity <= 0.01) return;

      overlayCtx.beginPath();
      overlayCtx.moveTo(vine.points[0].x, vine.points[0].y);
      for (let i = 1; i < vine.points.length; i++) {
        overlayCtx.lineTo(vine.points[i].x, vine.points[i].y);
      }
      
      let strokeColor = vine.color;
      if (strokeColor.startsWith('hsl(') && !strokeColor.startsWith('hsla(')) {
        strokeColor = strokeColor.replace('hsl(', `hsla(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('rgb(') && !strokeColor.startsWith('rgba(')) {
        strokeColor = strokeColor.replace('rgb(', `rgba(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('hsla(') || strokeColor.startsWith('rgba(')) {
        // Attempt to replace existing alpha if present
        const alphaMatch = strokeColor.match(/,(?:\s*([0-9.]+)\))/);
        if (alphaMatch && alphaMatch[1]) {
            strokeColor = strokeColor.replace(alphaMatch[0], `, ${vine.opacity.toFixed(2)})`);
        } else { // No alpha found, just append
            strokeColor = strokeColor.slice(0, -1) + `, ${vine.opacity.toFixed(2)})`;
        }
      } else { 
        const originalGlobalAlpha = overlayCtx.globalAlpha;
        overlayCtx.globalAlpha = vine.opacity;
        overlayCtx.strokeStyle = strokeColor;
        overlayCtx.lineWidth = Math.max(0.5, vine.thickness);
        overlayCtx.lineCap = 'round';
        overlayCtx.lineJoin = 'round';
        overlayCtx.stroke();
        overlayCtx.globalAlpha = originalGlobalAlpha; 
        return; 
      }
      
      overlayCtx.strokeStyle = strokeColor;
      overlayCtx.lineWidth = Math.max(0.5, vine.thickness);
      overlayCtx.lineCap = 'round';
      overlayCtx.lineJoin = 'round';
      overlayCtx.stroke();
    });
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={`main-canvas-${canvasKey}`} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={`overlay-canvas-${canvasKey}`} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

