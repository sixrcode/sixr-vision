
"use client";

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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // Dedicated canvas for 2D overlays

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

  const { scenes } = useScene();
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);
  const previousSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);


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

  // Helper to get 2D context for the main canvas
  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for main canvas:", e);
      return null;
    }
  }, []);

  // Helper to get 2D context for the overlay canvas
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


  // Effect to handle WebGL initialization/cleanup and canvas re-keying
  useEffect(() => {
    const currentSettings = settingsRef.current;
    const newSceneDefinition = scenes.find(s => s.id === currentSettings.currentSceneId);
    const newRendererType = newSceneDefinition?.rendererType || '2d';
    const oldRendererType = prevRendererTypeRef.current;

    console.log(`[WebGL/CanvasKey Effect] Running. Scene: ${newSceneDefinition?.id}, NewType: ${newRendererType}, OldType: ${oldRendererType}, CanvasKey: ${canvasKey}`);

    if (oldRendererType !== undefined && newRendererType !== oldRendererType) {
      console.log(`[WebGL/CanvasKey Effect] Renderer type changing from ${oldRendererType} to ${newRendererType}. Remounting canvases.`);
      if (webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Disposing main WebGL renderer due to renderer type switch.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      // Clean up assets of the previous scene if it was WebGL
      if (currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId) {
          const prevSceneDef = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
          if (prevSceneDef?.cleanupWebGL && prevSceneDef.rendererType === 'webgl') {
              console.log(`[WebGL/CanvasKey Effect] Cleaning up assets for WebGL scene ${prevSceneDef.id} before canvas remount.`);
              prevSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
          }
      }
      currentSceneWebGLAssetsRef.current = null;
      setCanvasKey(prevKey => prevKey + 1); // This will trigger canvas re-mount and re-run this effect
      prevRendererTypeRef.current = newRendererType; // Update for the next comparison
      return; // Exit early as canvasKey change will re-trigger everything
    }

    const canvas = canvasRef.current;
    if (!canvas || !newSceneDefinition) {
      console.log("[WebGL/CanvasKey Effect] Main canvas or new scene definition missing, aborting further setup.");
      return;
    }

    // Initialize or reconfigure WebGL renderer if it's a WebGL scene
    if (newRendererType === 'webgl') {
      if (!webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Creating new WebGLRenderer instance.");
        webGLRendererRef.current = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance'
        });
      }
      webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
      webGLRendererRef.current.setSize(canvas.width, canvas.height);

      // Cleanup previous scene assets if switching between WebGL scenes
      if (currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId !== newSceneDefinition.id) {
        const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneDefToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up previous WebGL scene assets: ${prevSceneDefToClean.id}`);
          prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
      }

      // Initialize new WebGL scene's assets
      if (newSceneDefinition.initWebGL) {
        try {
          console.log(`[WebGL/CanvasKey Effect] Calling initWebGL for ${newSceneDefinition.id}`);
          const initializedAssets = newSceneDefinition.initWebGL(canvas, currentSettings, webcamElement);
          currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: newSceneDefinition.id };
          console.log(`[WebGL/CanvasKey Effect] initWebGL for ${newSceneDefinition.id} successful.`);
          if (lastError) setLastError(null);
        } catch (e) {
          console.error(`[WebGL/CanvasKey Effect] Error during WebGL initialization for scene ${newSceneDefinition.id}:`, e);
          setLastError(e instanceof Error ? e.message : String(e));
          if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
          currentSceneWebGLAssetsRef.current = null;
        }
      }
    } else { // New scene is 2D, cleanup WebGL resources if they exist
      if (currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId) {
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
    }

    // Handle 2D transitions setup (only between 2D scenes)
    const prevSceneDef = scenes.find(s => s.id === lastSceneIdRef.current) || null;
    if (newRendererType === '2d' && prevSceneDef?.rendererType === '2d' && currentSettings.sceneTransitionActive && currentSettings.sceneTransitionDuration > 0) {
      previousScene2DRef.current = prevSceneDef;
      setIsTransitioning2D(true);
      transition2DStartTimeRef.current = performance.now();
    } else {
      previousScene2DRef.current = null;
      setIsTransitioning2D(false);
    }

    lastSceneIdRef.current = currentSettings.currentSceneId;
    if (oldRendererType === undefined && newSceneDefinition) { // Initialize on first valid run
        prevRendererTypeRef.current = newRendererType;
    }


    return () => {
        // This cleanup is for the effect itself, not necessarily for the WebGL context if it's meant to persist across scene changes that don't change renderer type
        console.log(`[WebGL/CanvasKey Effect - CLEANUP] Scene ID: ${currentSettings.currentSceneId}`);
    };
  // Listen to currentSceneId, scenes list, canvasKey (for re-mounts), and webcamElement (for scenes that need it)
  }, [settingsRef.current.currentSceneId, scenes, canvasKey, webcamElement, lastError, get2DContext]);


  // Effect to load AI overlay image
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
        if (lastLoggedFpsRef.current > 0 && (fps < lastLoggedFpsRef.current - 10)) {
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
  }, [webcamElement]); // audioDataRef and settingsRef are stable

  const drawAiGeneratedOverlay2D = useCallback((ctx: CanvasRenderingContext2D | null) => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && aiOverlayImageRef.current && ctx) {
      const originalAlpha = ctx.globalAlpha;
      const originalCompositeOperation = ctx.globalCompositeOperation;
      ctx.globalAlpha = currentSettings.aiOverlayOpacity;
      ctx.globalCompositeOperation = currentSettings.aiOverlayBlendMode;
      ctx.drawImage(aiOverlayImageRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
      // console.log(`AI Overlay Drawn with blend mode: ${currentSettings.aiOverlayBlendMode}, opacity: ${currentSettings.aiOverlayOpacity}`);
      ctx.globalAlpha = originalAlpha;
      ctx.globalCompositeOperation = originalCompositeOperation;
    }
  }, []);

  const drawDebugInfo = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const currentAudioData = audioDataRef.current;
    const spectrum = currentAudioData.spectrum || INITIAL_AUDIO_DATA.spectrum;
    const canvas = ctx.canvas;
    ctx.font = `12px ${SBNF_BODY_FONT_FAMILY}`;
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    ctx.fillStyle = currentFgColor;

    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 10, 20);

    ctx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;

    const spectrumSum = spectrum.reduce((s, v) => s + v, 0);
    // console.log(`VisualizerView - AudioData: RMS: ${currentAudioData.rms.toFixed(3)} Beat: ${currentAudioData.beat} Bass: ${currentAudioData.bassEnergy.toFixed(3)} Mid: ${currentAudioData.midEnergy.toFixed(3)} Treble: ${currentAudioData.trebleEnergy.toFixed(3)} BPM: ${currentAudioData.bpm} Spectrum Sum: ${spectrumSum} First 5 bins: ${Array.from(spectrum.slice(0,5))}`);

    ctx.fillText(`RMS: ${currentAudioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Beat: ${currentAudioData.beat ? 'YES' : 'NO'}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Bass: ${currentAudioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Mid: ${currentAudioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Treble: ${currentAudioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`BPM: ${currentAudioData.bpm}`, canvas.width - 10, currentY); currentY += lineSpacing;
    ctx.fillText(`Spectrum Sum: ${spectrumSum}`, canvas.width - 10, currentY);

  }, [fps]);

  const drawErrorState = useCallback((ctx: CanvasRenderingContext2D | null) => {
    if (!ctx || !lastError) return;
    const canvas = ctx.canvas;
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColor;
    ctx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
    ctx.textAlign = 'center';

    const title = 'Visualizer Error:';
    const errorMessage = lastError;
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


  const drawSceneAndOverlays = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current; // Overlay canvas for 2D elements
    if (!mainCanvas || !overlayCv) return;

    const currentSettingsVal = settingsRef.current;
    const currentAudioData = audioDataRef.current;
    const activeSceneDefinition = scenes.find(s => s.id === currentSettingsVal.currentSceneId);
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';

    // console.log(`[DrawLoop] Frame. Scene: ${activeSceneDefinition?.id}, Renderer: ${intendedRendererType}, Panic: ${currentSettingsVal.panicMode}, Error: ${lastError}, WebGLRenderer: ${webGLRendererRef.current ? 'exists' : 'null'}, WebGLAssets: ${currentSceneWebGLAssetsRef.current ? 'exists' : 'null'}`);

    if (currentSettingsVal.panicMode) {
      if (lastError) setLastError(null);
      // Clear main canvas (2D or WebGL)
      if (webGLRendererRef.current && intendedRendererType === 'webgl') {
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
      // Clear overlay canvas
      const overlayCtx = getOverlay2DContext();
      if (overlayCtx) {
        overlayCtx.fillStyle = 'black';
        overlayCtx.fillRect(0, 0, overlayCv.width, overlayCv.height);
      }
      return; // Stop further drawing in panic mode
    }

    if (lastError) {
      const mainCtx = get2DContext();
      if (mainCtx) drawErrorState(mainCtx); // Draw error on main canvas
      const overlayCtx = getOverlay2DContext(); // Clear overlay canvas
      if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
      return;
    }

    // Main scene rendering
    if (intendedRendererType === 'webgl') {
      if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === activeSceneDefinition?.id && activeSceneDefinition?.drawWebGL) {
        const { scene, camera, ...assets } = currentSceneWebGLAssetsRef.current;
        activeSceneDefinition.drawWebGL({
          renderer: webGLRendererRef.current, // Passed from VisualizerView's shared renderer
          scene, camera, audioData: currentAudioData, settings: currentSettingsVal,
          webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement,
        });
        webGLRendererRef.current.render(scene, camera);
      } else if (webGLRendererRef.current) { // WebGL scene intended, but assets not ready or mismatch
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim() || '270 50% 10%';
        const bgColorThree = new THREE.Color(`hsl(${bgColorString})`);
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
      }
    } else { // Intended renderer is 2D
      const mainCtx = get2DContext();
      if (mainCtx) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (activeSceneDefinition?.draw) {
          if (isTransitioning2D && previousScene2DRef.current?.draw && prevRendererTypeRef.current === '2d' && currentSettingsVal.sceneTransitionActive) {
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
      } else if (activeSceneDefinition?.draw && !lastError) {
        setLastError(`VisualizerView: Failed to get 2D context for 2D scene: ${activeSceneDefinition.id}.`);
      }
    }

    // Draw 2D overlays (AI overlay, debug info, vines) on the separate overlay canvas
    const overlayCtx = getOverlay2DContext();
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
      if (!currentSettingsVal.panicMode && !lastError) {
        drawAiGeneratedOverlay2D(overlayCtx);
        // Draw procedural vines if the current scene (WebGL or 2D) provides them and they are meant for the overlay
        if (currentSceneWebGLAssetsRef.current?.vinesData?.activeVines) {
            drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
        }
        drawDebugInfo(overlayCtx);
      }
    }
  }, [
      scenes, isTransitioning2D, lastError, fps, get2DContext, getOverlay2DContext,
      drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState,
      webcamElement, setIsTransitioning2D // audioDataRef and settingsRef are accessed via .current, so not direct dependencies for this callback
  ]);

  // Main draw loop management
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
        console.log("[DrawLoop Effect - CLEANUP] Cancelling main animation loop.");
        animationFrameIdRef.current = null;
      }
    };
  }, [updateFps, drawSceneAndOverlays]); // Re-run if these stable callbacks change (should not happen often)


  // Effect for resizing canvases
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

          if (webGLRendererRef.current) {
            webGLRendererRef.current.setSize(newWidth, newHeight);
            const sceneAssets = currentSceneWebGLAssetsRef.current;
            if (sceneAssets?.camera) {
              const camera = sceneAssets.camera;
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = newWidth / newHeight;
              } else if (camera instanceof THREE.OrthographicCamera) {
                // Adjust ortho camera based on new dimensions
                const aspect = newWidth / newHeight;
                const camHeight = camera.top - camera.bottom; // Maintain current ortho height
                const camWidth = camHeight * aspect;
                camera.left = -camWidth / 2;
                camera.right = camWidth / 2;
                // camera.top and camera.bottom remain the same unless explicit zoom is needed
              }
              camera.updateProjectionMatrix();
            }
          }
        });
        resizeObserver.observe(parent);

        // Initial size setting
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

        if (webGLRendererRef.current) {
            webGLRendererRef.current.setSize(initialWidth, initialHeight);
            const sceneAssets = currentSceneWebGLAssetsRef.current;
            if (sceneAssets?.camera) {
                const camera = sceneAssets.camera;
                if (camera instanceof THREE.PerspectiveCamera) {
                    camera.aspect = initialWidth / initialHeight;
                } else if (camera instanceof THREE.OrthographicCamera) {
                    const aspect = initialWidth / initialHeight;
                    const camHeight = camera.top - camera.bottom;
                    const camWidth = camHeight * aspect;
                    camera.left = -camWidth / 2;
                    camera.right = camWidth / 2;
                }
                camera.updateProjectionMatrix();
            }
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, [canvasKey]); // Re-run when canvasKey changes (i.e., canvas is re-mounted)


  const drawProceduralVinesOnOverlay = useCallback((ctx: CanvasRenderingContext2D, vines?: ProceduralVine[]) => {
    if (!ctx || !vines || vines.length === 0) return;

    vines.forEach(vine => {
      if (vine.points.length < 2 || vine.opacity <= 0.01) return;

      ctx.beginPath();
      ctx.moveTo(vine.points[0].x, vine.points[0].y);
      for (let i = 1; i < vine.points.length; i++) {
        ctx.lineTo(vine.points[i].x, vine.points[i].y);
      }
      // Ensure color has an alpha component for hsla/rgba, otherwise this replace might fail
      let strokeColor = vine.color;
      if (strokeColor.startsWith('hsl(') || strokeColor.startsWith('rgb(')) {
        strokeColor = strokeColor.replace(/(\bhsla?\b|\brgba?\b)\(([^,\)]+),([^,\)]+),([^,\)]+)(?:,[^,\)]+)?\)/, (match, p1, p2, p3, p4) => {
          return `${p1.replace('a','')}a(${p2},${p3},${p4},${vine.opacity.toFixed(2)})`;
        });
      } else { // Fallback if it's a named color or hex, just apply global alpha (less ideal for per-vine opacity)
        ctx.globalAlpha = vine.opacity;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(0.5, vine.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1.0; // Reset global alpha
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
