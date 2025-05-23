
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

  const { scenes } = useScene();
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
      return canvas.getContext('2d', { alpha: true }); // Ensure overlay canvas supports transparency
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for overlay canvas:", e);
      return null;
    }
  }, []);

  useEffect(() => {
    const currentSettings = settingsRef.current;
    setLastError(null); // Clear previous errors when scene or canvas key changes

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
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevSceneDef = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneDef?.cleanupWebGL && prevSceneDef.rendererType === 'webgl') {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up assets for WebGL scene ${prevSceneDef.id} before canvas remount.`);
          prevSceneDef.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      setCanvasKey(prevKey => prevKey + 1);
      prevRendererTypeRef.current = newRendererType;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !newSceneDefinition) {
      console.log("[WebGL/CanvasKey Effect] Main canvas or new scene definition missing, aborting further setup.");
      return;
    }

    if (newRendererType === 'webgl') {
      if (!webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Creating new WebGLRenderer instance.");
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            powerPreference: 'high-performance'
          });
          webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
          webGLRendererRef.current.setSize(canvas.width, canvas.height);
        } catch (e) {
            console.error("[WebGL/CanvasKey Effect] Error creating WebGLRenderer:", e);
            setLastError(e instanceof Error ? e.message : String(e));
            if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
            return;
        }
      } else {
         // Ensure existing renderer is associated with the current canvas instance
        if (webGLRendererRef.current.domElement !== canvas) {
            console.warn("[WebGL/CanvasKey Effect] WebGLRenderer DOM element mismatch. Re-associating or recreating might be needed if issues persist.");
            // This case might need more robust handling if canvas instances change without canvasKey changing.
            // For now, we assume canvasKey handles complete canvas replacement.
        }
        webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
        webGLRendererRef.current.setSize(canvas.width, canvas.height);
      }

      if (currentSceneWebGLAssetsRef.current?.sceneId !== newSceneDefinition.id) {
        if (currentSceneWebGLAssetsRef.current?.sceneId) {
          const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
          if (prevSceneDefToClean?.cleanupWebGL) {
            console.log(`[WebGL/CanvasKey Effect] Cleaning up previous WebGL scene assets: ${prevSceneDefToClean.id}`);
            prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
          }
        }
        currentSceneWebGLAssetsRef.current = null; // Clear previous assets

        if (newSceneDefinition.initWebGL) {
          try {
            console.log(`[WebGL/CanvasKey Effect] Calling initWebGL for ${newSceneDefinition.id}`);
            const initializedAssets = newSceneDefinition.initWebGL(canvas, currentSettings, webcamElement);
            currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: newSceneDefinition.id };
            console.log(`[WebGL/CanvasKey Effect] initWebGL for ${newSceneDefinition.id} successful.`);
          } catch (e) {
            console.error(`[WebGL/CanvasKey Effect] Error during WebGL initialization for scene ${newSceneDefinition.id}:`, e);
            setLastError(e instanceof Error ? e.message : String(e));
            currentSceneWebGLAssetsRef.current = null;
          }
        }
      }
    } else { // newRendererType is '2d'
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
    }

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
    if (oldRendererType === undefined && newSceneDefinition) {
      prevRendererTypeRef.current = newRendererType;
    }

    return () => {
      console.log(`[WebGL/CanvasKey Effect - CLEANUP] Scene ID: ${currentSettings.currentSceneId}`);
      // Cleanup for individual scenes is handled above or when renderer type changes.
      // The main renderer instance (webGLRendererRef) persists if subsequent scenes are also WebGL.
    };
  }, [settingsRef.current.currentSceneId, scenes, canvasKey, webcamElement]); // Removed lastError, get2DContext to avoid re-running on error state change itself


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
  }, [webcamElement]);

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
    const currentAudioData = audioDataRef.current || INITIAL_AUDIO_DATA;
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

    const errorColorValue = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    ctx.fillStyle = errorColorValue;
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
    const overlayCv = overlayCanvasRef.current;
    if (!mainCanvas || !overlayCv) return;

    const currentSettingsVal = settingsRef.current;
    const currentAudioData = audioDataRef.current;
    const activeSceneDefinition = scenes.find(s => s.id === currentSettingsVal.currentSceneId);
    const intendedRendererType = activeSceneDefinition?.rendererType || '2d';

    // console.log(`[DrawLoop] Frame. Scene: ${activeSceneDefinition?.id}, Renderer: ${intendedRendererType}, Panic: ${currentSettingsVal.panicMode}, Error: ${lastError}, WebGLRenderer: ${webGLRendererRef.current ? 'exists' : 'null'}, WebGLAssets: ${currentSceneWebGLAssetsRef.current ? 'exists' : 'null'}`);
    
    const overlayCtx = getOverlay2DContext(); // Always get overlay context
    if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height); // Clear overlay canvas first
    }


    if (currentSettingsVal.panicMode) {
      if (lastError) setLastError(null);
      if (webGLRendererRef.current) {
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
      // No need to clear overlayCtx again if it's already cleared above
      return;
    }

    if (lastError) {
      if (overlayCtx) drawErrorState(overlayCtx); // Draw error on overlay canvas
      // Clear main canvas based on its intended type
      if (intendedRendererType === 'webgl' && webGLRendererRef.current) {
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim() || '270 50% 10%';
        const bgColorThree = new THREE.Color(`hsl(${bgColorString})`);
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
      } else {
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
        activeSceneDefinition.drawWebGL({
          renderer: webGLRendererRef.current,
          scene, camera, audioData: currentAudioData, settings: currentSettingsVal,
          webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement,
        });
        webGLRendererRef.current.render(scene, camera);
      } else if (webGLRendererRef.current) {
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim() || '270 50% 10%';
        const bgColorThree = new THREE.Color(`hsl(${bgColorString})`);
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
        if (overlayCtx) { // Draw placeholder on overlay if WebGL assets not ready
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText(activeSceneDefinition ? `WebGL scene '${activeSceneDefinition.name}' loading assets...` : 'Loading WebGL scene...', mainCanvas.width / 2, mainCanvas.height / 2);
        }
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
      }
    }

    // Draw 2D overlays (AI overlay, debug info, vines) on the separate overlay canvas
    if (overlayCtx) {
      // Already cleared at the start of this function section
      if (!currentSettingsVal.panicMode && !lastError) { // Double check panic/error before drawing overlays
        drawAiGeneratedOverlay2D(overlayCtx);
        if (currentSceneWebGLAssetsRef.current?.vinesData?.activeVines) {
          drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
        }
        drawDebugInfo(overlayCtx);
      }
    }
  }, [
    scenes, isTransitioning2D, lastError, fps, get2DContext, getOverlay2DContext,
    drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState,
    webcamElement, setIsTransitioning2D
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
        console.log("[DrawLoop Effect - CLEANUP] Cancelling main animation loop.");
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

  const drawProceduralVinesOnOverlay = useCallback((ctx: CanvasRenderingContext2D, vines?: ProceduralVine[]) => {
    if (!ctx || !vines || vines.length === 0) return;

    vines.forEach(vine => {
      if (vine.points.length < 2 || vine.opacity <= 0.01) return;

      ctx.beginPath();
      ctx.moveTo(vine.points[0].x, vine.points[0].y);
      for (let i = 1; i < vine.points.length; i++) {
        ctx.lineTo(vine.points[i].x, vine.points[i].y);
      }
      
      let strokeColor = vine.color;
      // Check if color is already hsla/rgba
      if (strokeColor.startsWith('hsl(') && !strokeColor.startsWith('hsla(')) {
        strokeColor = strokeColor.replace('hsl(', `hsla(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('rgb(') && !strokeColor.startsWith('rgba(')) {
        strokeColor = strokeColor.replace('rgb(', `rgba(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('hsla(') || strokeColor.startsWith('rgba(')) {
         // If it's already hsla/rgba, try to replace existing alpha or append if not possible
        strokeColor = strokeColor.replace(/,\s*([0-9.]+)\)/, `, ${vine.opacity.toFixed(2)})`);
         if (!strokeColor.includes(` ${vine.opacity.toFixed(2)})`)) { // If replace failed (e.g. no alpha yet in string)
            if (strokeColor.startsWith('hsla(') || strokeColor.startsWith('rgba(')) { // Should already be true
                 strokeColor = strokeColor.slice(0, -1) + `, ${vine.opacity.toFixed(2)})`;
            }
         }
      } else { // Hex or named color, apply globalAlpha (less ideal but a fallback)
        const originalGlobalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = vine.opacity;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(0.5, vine.thickness);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalAlpha = originalGlobalAlpha; // Reset global alpha
        return; // Return early as stroke is done
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(0.5, vine.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
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

    