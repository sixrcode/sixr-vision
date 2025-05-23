
"use client";

import type { ReactNode } from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
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

  const { scenes, currentScene } = useScene(); // Central source of truth for current scene

  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string; webcamElement?: HTMLVideoElement | null; }) | null>(null);
  
  const [canvasKey, setCanvasKey] = useState(0);
  const prevRendererTypeRef = useRef<string | undefined>(undefined);
  const isCanvasResettingRef = useRef(false);
  const canvasContextTypeRef = useRef<'none' | '2d' | 'webgl'>('none');
  const webGLInitFrameRequestRef = useRef<number | null>(null);


  // FPS Counter state
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to manage canvasKey for re-mounting on renderer type switch
  useEffect(() => {
    const activeSceneRendererType = currentScene?.rendererType || '2d';
    if (prevRendererTypeRef.current !== undefined && prevRendererTypeRef.current !== activeSceneRendererType) {
      console.log(`[CanvasKey Effect] Renderer type changed from ${prevRendererTypeRef.current} to ${activeSceneRendererType}. Updating canvasKey.`);
      isCanvasResettingRef.current = true;
      canvasContextTypeRef.current = 'none'; // Mark new canvas as unclaimed
      setCanvasKey(key => key + 1);
    }
    prevRendererTypeRef.current = activeSceneRendererType;
  }, [currentScene]);


  // Effect for WebGL initialization and cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    const sceneDefinition = currentScene; // Use currentScene from context
    let localRendererCreated = false;

    if (webGLInitFrameRequestRef.current) {
      cancelAnimationFrame(webGLInitFrameRequestRef.current);
      webGLInitFrameRequestRef.current = null;
    }

    if (!canvas || !sceneDefinition) {
      console.log("[WebGL Effect] No canvas or scene definition, cleaning up WebGL.");
      if (webGLRendererRef.current) {
        console.log("[WebGL Effect] Disposing existing WebGLRenderer.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL Effect] Cleaning up WebGL assets for previous scene: ${prevSceneToClean.id}`);
          prevSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      canvasContextTypeRef.current = 'none';
      setLastError(null); // Clear any previous error
      return;
    }
    
    setLastError(null); // Clear errors at the start of processing a scene change or canvas key change

    if (sceneDefinition.rendererType === 'webgl') {
      // Defer renderer creation to next animation frame to ensure canvas is ready
      webGLInitFrameRequestRef.current = requestAnimationFrame(() => {
        if (canvasContextTypeRef.current !== 'none' && canvasContextTypeRef.current !== 'webgl') {
            console.error(`[WebGL Effect - Deferred] Canvas context already claimed as ${canvasContextTypeRef.current} before WebGL init for scene ${sceneDefinition.id}. Aborting WebGL init.`);
            setLastError(`Context conflict: Canvas already ${canvasContextTypeRef.current} before WebGL for ${sceneDefinition.id}`);
            isCanvasResettingRef.current = false; // Allow draw loop to proceed (likely showing error on overlay)
            return;
        }

        if (!webGLRendererRef.current || webGLRendererRef.current.domElement !== canvas) {
          if (webGLRendererRef.current) {
            console.log("[WebGL Effect - Deferred] Disposing old WebGLRenderer (canvas instance changed).");
            webGLRendererRef.current.dispose();
            webGLRendererRef.current = null;
          }
          console.log("[WebGL Effect - Deferred] Creating new WebGLRenderer instance for scene:", sceneDefinition.id);
          try {
            webGLRendererRef.current = new THREE.WebGLRenderer({
              canvas,
              alpha: true,
              antialias: false,
              powerPreference: 'high-performance'
            });
            localRendererCreated = true;
            webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
            webGLRendererRef.current.setSize(canvas.width, canvas.height);
            canvasContextTypeRef.current = 'webgl';
          } catch (e) {
            console.error("[WebGL Effect - Deferred] Error creating WebGLRenderer:", e);
            setLastError(e instanceof Error ? `WebGL Init Error: ${e.message}` : String(e));
            if (webGLRendererRef.current) { webGLRendererRef.current.dispose(); webGLRendererRef.current = null; }
            canvasContextTypeRef.current = 'error'; // Mark context as errored
            isCanvasResettingRef.current = false;
            return;
          }
        } else {
            // Ensure existing renderer is sized correctly if canvas dimensions changed without key change (less likely now)
            if (webGLRendererRef.current.domElement.width !== canvas.width || webGLRendererRef.current.domElement.height !== canvas.height) {
                webGLRendererRef.current.setSize(canvas.width, canvas.height);
            }
        }

        // Cleanup previous scene's WebGL assets IF the scene ID has changed
        if (currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id) {
          const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
          if (prevSceneDefToClean?.cleanupWebGL) {
            console.log(`[WebGL Effect - Deferred] Cleaning WebGL assets for previous scene: ${prevSceneDefToClean.id}`);
            prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
          }
          currentSceneWebGLAssetsRef.current = null;
        }

        // Initialize new scene's WebGL assets if not already done or if webcamElement changed
        if (sceneDefinition.initWebGL && 
            (!currentSceneWebGLAssetsRef.current || 
             currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id ||
             currentSceneWebGLAssetsRef.current.webcamElement !== webcamElement // Re-init if webcam status changes for scenes that use it
            )
        ) {
          console.log(`[WebGL Effect - Deferred] Initializing WebGL assets for scene: ${sceneDefinition.id}`);
          try {
            const initializedAssets = sceneDefinition.initWebGL(canvas, settingsRef.current, webcamElement);
            currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id, webcamElement };
          } catch (e) {
            console.error(`[WebGL Effect - Deferred] Error during WebGL asset initialization for scene ${sceneDefinition.id}:`, e);
            setLastError(e instanceof Error ? `Scene ${sceneDefinition.id} WebGL Init Error: ${e.message}` : String(e));
            currentSceneWebGLAssetsRef.current = null; // Ensure assets are cleared on error
            canvasContextTypeRef.current = 'error';
          }
        }
        isCanvasResettingRef.current = false; // Allow draw loop to proceed normally
      });

    } else { // Scene is 2D or undefined
      if (webGLRendererRef.current) {
        console.log("[WebGL Effect] Scene is 2D/undefined. Disposing existing WebGLRenderer.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevWebGLSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevWebGLSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL Effect] Cleaning up WebGL assets for previous scene (switching to 2D): ${prevWebGLSceneToClean.id}`);
          prevWebGLSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      canvasContextTypeRef.current = 'none'; // Or '2d' if get2DContext successfully claims it later
      isCanvasResettingRef.current = false;
    }

    return () => {
      if (webGLInitFrameRequestRef.current) {
        cancelAnimationFrame(webGLInitFrameRequestRef.current);
        webGLInitFrameRequestRef.current = null;
      }
      // Do not dispose renderer here if it was created by this effect iteration AND canvasKey hasn't changed
      // This cleanup is more about effects from *previous* renders of this hook.
      // The global unmount cleanup handles the final renderer disposal.
      if (localRendererCreated && webGLRendererRef.current && webGLRendererRef.current.domElement !== canvasRef.current) {
         // This means a new canvas came in, so the old renderer on old canvas should be disposed
         console.log("[WebGL Effect Cleanup] Disposing renderer for a canvas that is no longer current.");
         webGLRendererRef.current.dispose();
         webGLRendererRef.current = null;
      }
    };
  }, [currentScene, scenes, canvasKey, webcamElement]); // settingsRef is a ref, stable.

  // Final cleanup for the renderer on component unmount
  useEffect(() => {
    return () => {
      console.log("[VisualizerView Unmount] Disposing WebGLRenderer and cleaning scene assets.");
      if (webGLRendererRef.current) {
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const sceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (sceneToClean?.cleanupWebGL) {
          sceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (fpsLogIntervalRef.current) {
        clearInterval(fpsLogIntervalRef.current);
      }
    };
  }, [scenes]); // scenes is stable unless dynamically registered, which is rare.


  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    if (isCanvasResettingRef.current) {
      console.log("[get2DContext] Canvas is resetting, returning null.");
      return null;
    }
    const intendedSceneDef = scenes.find(s => s.id === settingsRef.current.currentSceneId);
    if (intendedSceneDef?.rendererType === 'webgl' && canvasContextTypeRef.current !== '2d') {
        // If intended is WebGL, and context isn't already (erroneously) 2D, don't allow 2D.
        console.log("[get2DContext] Intended scene is WebGL, disallowing 2D context acquisition on main canvas.");
        return null;
    }
    if (canvasContextTypeRef.current === 'webgl' && intendedSceneDef?.rendererType !== 'webgl') {
        console.warn("[get2DContext] Attempting to get 2D context, but canvasContextTypeRef is 'webgl'. This might indicate a problem if not during a type switch.");
        // This case should be rare if canvasKey logic works for type switches.
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      const ctx = canvas.getContext('2d');
      if (ctx && canvasContextTypeRef.current !== '2d') {
        console.log("[get2DContext] Successfully got 2D context. Setting canvasContextTypeRef to '2d'.");
        canvasContextTypeRef.current = '2d';
      }
      return ctx;
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for main canvas:", e);
      setLastError("Error acquiring 2D context for main canvas.");
      canvasContextTypeRef.current = 'error';
      return null;
    }
  }, [scenes]); // settingsRef is stable

  const getOverlay2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d', { alpha: true });
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for overlay canvas:", e);
      // Don't set main lastError for overlay context issues, as it might hide critical main canvas errors
      // Consider a separate error state for overlay if necessary.
      return null;
    }
  }, []);

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
    if (sceneToDraw.draw) {
      ctx.save();
      ctx.globalAlpha = alpha;
      sceneToDraw.draw(ctx, audioDataRef.current, settingsRef.current, webcamElement);
      ctx.restore();
    }
  }, [webcamElement]); // audioDataRef, settingsRef are refs

  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && currentSettings.aiGeneratedOverlayUri) {
      let isStillMounted = true;
      const img = new Image();
      img.onload = () => { 
        if (isStillMounted) aiOverlayImageRef.current = img; 
      };
      img.onerror = () => { 
        if (isStillMounted) {
          console.error("VisualizerView: Failed to load AI overlay image."); 
          aiOverlayImageRef.current = null; 
        }
      };
      img.src = currentSettings.aiGeneratedOverlayUri;
      return () => { isStillMounted = false; }
    } else {
      aiOverlayImageRef.current = null;
    }
  }, [settings.enableAiOverlay, settings.aiGeneratedOverlayUri]); // Use direct settings here

  const drawAiGeneratedOverlay2D = useCallback((overlayCtx: CanvasRenderingContext2D | null) => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && aiOverlayImageRef.current && overlayCtx) {
      // console.log(`AI Overlay Drawn with blend mode: ${currentSettings.aiOverlayBlendMode} and opacity: ${currentSettings.aiOverlayOpacity}`);
      const originalAlpha = overlayCtx.globalAlpha;
      const originalCompositeOperation = overlayCtx.globalCompositeOperation;
      overlayCtx.globalAlpha = currentSettings.aiOverlayOpacity;
      overlayCtx.globalCompositeOperation = currentSettings.aiOverlayBlendMode;
      overlayCtx.drawImage(aiOverlayImageRef.current, 0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
      overlayCtx.globalAlpha = originalAlpha;
      overlayCtx.globalCompositeOperation = originalCompositeOperation;
    }
  }, []); // settingsRef is a ref

  const drawProceduralVinesOnOverlay = useCallback((overlayCtx: CanvasRenderingContext2D | null, vines?: ProceduralVine[]) => {
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
        const alphaMatch = strokeColor.match(/,(?:\s*([0-9.]+)\))/);
        if (alphaMatch && alphaMatch[1]) {
            strokeColor = strokeColor.replace(alphaMatch[0], `, ${vine.opacity.toFixed(2)})`);
        } else { 
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

  const drawDebugInfo = useCallback((overlayCtx: CanvasRenderingContext2D | null) => {
    if (!overlayCtx) return;
    const currentAudioData = audioDataRef.current || INITIAL_AUDIO_DATA;
    const spectrumForLog = currentAudioData.spectrum || INITIAL_AUDIO_DATA.spectrum;
    const spectrumSumForLog = spectrumForLog.reduce((s, v) => s + v, 0);
    const canvas = overlayCtx.canvas;
    overlayCtx.font = `12px ${SBNF_BODY_FONT_FAMILY}`;
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    overlayCtx.fillStyle = currentFgColor;

    overlayCtx.textAlign = 'left';
    overlayCtx.fillText(`FPS: ${fps}`, 10, 20);
    overlayCtx.fillText(`Scene: ${currentScene?.id || 'None'} (${currentScene?.rendererType || 'N/A'}) Key: ${canvasKey}`, 10, 34);
    overlayCtx.fillText(`CtxType: ${canvasContextTypeRef.current} Resetting: ${isCanvasResettingRef.current}`, 10, 48);


    overlayCtx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    overlayCtx.fillText(`RMS: ${currentAudioData.rms.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Beat: ${currentAudioData.beat ? 'YES' : 'NO'}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Bass: ${currentAudioData.bassEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Mid: ${currentAudioData.midEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Treble: ${currentAudioData.trebleEnergy.toFixed(3)}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`BPM: ${currentAudioData.bpm}`, canvas.width - 10, currentY); currentY += lineSpacing;
    overlayCtx.fillText(`Spectrum Sum: ${spectrumSumForLog}`, canvas.width - 10, currentY);
    const firstFiveBinsText = Array.from(spectrumForLog.slice(0,5)).join(',');
    overlayCtx.fillText(`Raw Bins (5): ${firstFiveBinsText}`, canvas.width - 10, currentY + lineSpacing);
  }, [fps, currentScene, canvasKey]); // audioDataRef is ref

  const drawErrorState = useCallback((targetCtx: CanvasRenderingContext2D | null, errorToDraw: string | null) => {
    if (!targetCtx || !errorToDraw) return;
    const canvas = targetCtx.canvas;
    targetCtx.clearRect(0, 0, canvas.width, canvas.height);
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
    targetCtx.fillStyle = bgColor;
    targetCtx.fillRect(0, 0, canvas.width, canvas.height);
    targetCtx.font = `bold 16px ${SBNF_BODY_FONT_FAMILY}`;
    const errorColorVal = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
    targetCtx.fillStyle = errorColorVal;
    targetCtx.textAlign = 'center';
    targetCtx.fillText('Visualizer Error:', canvas.width / 2, canvas.height / 2 - 20);
    targetCtx.font = `14px ${SBNF_BODY_FONT_FAMILY}`;
    const lines = errorToDraw.split('\n');
    lines.forEach((line, index) => {
      targetCtx.fillText(line, canvas.width / 2, canvas.height / 2 + (index * 18));
    });
  }, []); 

  // For 2D scene transitions
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);
  const previousScene2DRef = useRef<SceneDefinition | null>(null);

  const drawSceneAndOverlays = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current;
    if (!mainCanvas || !overlayCv) return;

    const currentSettings = settingsRef.current;
    const currentAudioData = audioDataRef.current;
    
    const intendedSceneDefinition = scenes.find(s => s.id === currentSettings.currentSceneId);
    const intendedRendererType = intendedSceneDefinition?.rendererType || '2d';
    
    // console.log(`[DrawLoop] Scene: ${currentScene?.id}, Intended: ${intendedSceneDefinition?.id} (${intendedRendererType}), Resetting: ${isCanvasResettingRef.current}, CtxType: ${canvasContextTypeRef.current}`);

    const overlayCtx = getOverlay2DContext();
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
    }

    if (lastError && overlayCtx) {
      drawErrorState(overlayCtx, lastError);
      if (intendedRendererType === 'webgl' && webGLRendererRef.current) {
         const errorBgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
         const errorBgColorThree = new THREE.Color(errorBgColorString ? `hsl(${errorBgColorString})` : '#000000');
         webGLRendererRef.current.setClearColor(errorBgColorThree, 1);
         webGLRendererRef.current.clear();
      }
      return; // Stop further drawing if there's a persistent error
    }

    if (currentSettings.panicMode) {
      if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height); // Clear any lingering debug info too
      if (webGLRendererRef.current && (intendedRendererType === 'webgl' || canvasContextTypeRef.current === 'webgl')) {
          const panicColor = new THREE.Color(0x000000);
          webGLRendererRef.current.setClearColor(panicColor, 1);
          webGLRendererRef.current.clear();
          webGLRendererRef.current.renderLists.dispose(); // Force clear render state
      } else { // Handles 2D panic or if WebGL renderer isn't ready
          const mainCtx = get2DContext();
          if (mainCtx) {
              mainCtx.fillStyle = 'black';
              mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          }
      }
      return;
    }
    
    if (isCanvasResettingRef.current) {
        // console.log("[DrawLoop] Canvas is resetting, skipping main canvas draw operations.");
        if (overlayCtx) drawDebugInfo(overlayCtx); // Still draw debug on overlay
        return;
    }

    if (intendedRendererType === 'webgl') {
      if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === intendedSceneDefinition?.id && intendedSceneDefinition?.drawWebGL) {
        const { scene, camera, ...assets } = currentSceneWebGLAssetsRef.current;
        if (scene && camera) {
          intendedSceneDefinition.drawWebGL({
              renderer: webGLRendererRef.current,
              scene, camera, audioData: currentAudioData, settings: currentSettings,
              webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement
          });
          webGLRendererRef.current.render(scene, camera);
        } else {
          // console.warn(`[DrawLoop] WebGL scene ${intendedSceneDefinition.id} assets missing scene/camera.`);
          const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
          const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
          webGLRendererRef.current.setClearColor(bgColorThree, 1);
          webGLRendererRef.current.clear();
        }
      } else {
        // console.log(`[DrawLoop] WebGL intended, but renderer or assets not ready for ${intendedSceneDefinition?.id}. Clearing.`);
        if (webGLRendererRef.current) {
            const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
            const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
            webGLRendererRef.current.setClearColor(bgColorThree, 1);
            webGLRendererRef.current.clear();
        }
        if (overlayCtx && intendedSceneDefinition) {
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText(webGLRendererRef.current ? `WebGL scene '${intendedSceneDefinition.name}' assets loading...` : 'Initializing WebGL renderer for scene...', mainCanvas.width / 2, mainCanvas.height / 2);
        }
      }
    } else { // Intended is '2d' or undefined
      const mainCtx = get2DContext();
      if (mainCtx) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (intendedSceneDefinition?.draw) {
          if (isTransitioning2D && previousScene2DRef.current?.draw && intendedSceneDefinition.rendererType === '2d' && currentSettings.sceneTransitionActive) {
            const elapsedTime = performance.now() - transition2DStartTimeRef.current;
            const progress = Math.min(1, elapsedTime / currentSettings.sceneTransitionDuration);
            drawPrimarySceneContent(mainCtx, previousScene2DRef.current, 1 - progress);
            drawPrimarySceneContent(mainCtx, intendedSceneDefinition, progress);
            if (progress >= 1) setIsTransitioning2D(false);
          } else {
            drawPrimarySceneContent(mainCtx, intendedSceneDefinition);
          }
        } else if (overlayCtx) { // If no draw function for a 2D scene or scene is undefined
          const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
          mainCtx.fillStyle = bgColor;
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
          overlayCtx.textAlign = 'center';
          overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
          overlayCtx.fillText(intendedSceneDefinition ? `Scene '${intendedSceneDefinition.name}' (2D) has no draw function.` : 'No scene selected or scene is invalid.', mainCanvas.width / 2, mainCanvas.height / 2);
        }
      } else if (overlayCtx && intendedRendererType !== 'webgl') {
          overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
          overlayCtx.textAlign = 'center';
          overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
          overlayCtx.fillText('Error: Main canvas 2D context unavailable for 2D scene.', mainCanvas.width / 2, mainCanvas.height / 2);
      }
    }

    // Draw overlays on the overlay canvas
    if (overlayCtx && !currentSettings.panicMode && !lastError) { // Ensure error state doesn't draw overlays
      drawAiGeneratedOverlay2D(overlayCtx);
      if (intendedRendererType === 'webgl' && currentSceneWebGLAssetsRef.current?.vinesData?.activeVines) {
        drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
      }
      drawDebugInfo(overlayCtx);
    }
  }, [
    currentScene, scenes, // currentScene is from context, scenes is stable
    get2DContext, getOverlay2DContext, drawErrorState, drawPrimarySceneContent,
    drawAiGeneratedOverlay2D, drawProceduralVinesOnOverlay, drawDebugInfo,
    isTransitioning2D, webcamElement, // settingsRef, audioDataRef are refs. lastError is state.
    lastError, fps // fps state for debug info
  ]);


  const drawLoop = useCallback(() => {
    updateFps();
    try {
      drawSceneAndOverlays();
    } catch (e) {
      console.error("Critical error in drawLoop:", e);
      setLastError(e instanceof Error ? `DrawLoop Error: ${e.message}` : String(e));
      // If drawLoop itself crashes, stop it to prevent spamming errors
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return; // Exit loop
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [updateFps, drawSceneAndOverlays]);

  useEffect(() => {
    console.log("[DrawLoop Effect] Setting up animation frame.");
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      console.log("[DrawLoop Effect] Cleaning up animation frame.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]);

  // Effect for resizing logic (both main and overlay canvas)
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
            console.log(`[Resize] Resizing main canvas to ${newWidth}x${newHeight}`);
            mainC.width = newWidth;
            mainC.height = newHeight;
          }
          if (overlayC.width !== newWidth || overlayC.height !== newHeight) {
            console.log(`[Resize] Resizing overlay canvas to ${newWidth}x${newHeight}`);
            overlayC.width = newWidth;
            overlayC.height = newHeight;
          }

          if (webGLRendererRef.current) {
            webGLRendererRef.current.setSize(newWidth, newHeight);
            const sceneAssets = currentSceneWebGLAssetsRef.current;
            if (sceneAssets?.camera) {
              const camera = sceneAssets.camera;
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = newWidth > 0 && newHeight > 0 ? newWidth / newHeight : 1;
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
                camera.aspect = initialWidth > 0 && initialHeight > 0 ? initialWidth / initialHeight : 1;
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
  }, [canvasKey]); // Re-run if canvasKey changes

  // Effect for handling 2D scene transitions
  useEffect(() => {
    const currentSettings = settingsRef.current;
    if (currentScene?.rendererType === '2d') {
        if (previousScene2DRef.current &&
            previousScene2DRef.current.id !== currentScene.id &&
            currentSettings.sceneTransitionActive &&
            currentSettings.sceneTransitionDuration > 0) {
            setIsTransitioning2D(true);
            transition2DStartTimeRef.current = performance.now();
        } else {
            setIsTransitioning2D(false);
        }
        previousScene2DRef.current = currentScene;
    } else {
        // If switching away from 2D or to a non-2D scene, ensure transition state is reset
        setIsTransitioning2D(false);
        previousScene2DRef.current = null;
    }
  }, [currentScene, settings.sceneTransitionActive, settings.sceneTransitionDuration]); // Use direct settings here


  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={`main-canvas-${canvasKey}`} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={`overlay-canvas-${canvasKey}`} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
