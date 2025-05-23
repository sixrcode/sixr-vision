
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

  const { scenes, currentScene } = useScene(); // Use currentScene from context
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);

  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);
  const previousSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string }) | null>(null);

  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);

  const [canvasKey, setCanvasKey] = useState(0);
  const prevRendererTypeRef = useRef<string | undefined>(undefined);

  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to manage canvasKey for re-mounting on renderer type switch
  useEffect(() => {
    const activeSceneRendererType = currentScene?.rendererType || '2d';

    if (prevRendererTypeRef.current !== undefined && prevRendererTypeRef.current !== activeSceneRendererType) {
      console.log(`[VisualizerView CanvasKey Effect] Renderer type changing from ${prevRendererTypeRef.current} to ${activeSceneRendererType}. Remounting canvases by incrementing canvasKey.`);
      setCanvasKey(key => key + 1);
    }
    if(currentScene){ // Initialize prevRendererTypeRef on first meaningful render with a scene
        prevRendererTypeRef.current = activeSceneRendererType;
    }
  }, [currentScene]);


  // Effect for WebGL initialization and cleanup
  useEffect(() => {
    setLastError(null); // Clear previous errors on scene/canvas/webcam change
    const canvas = canvasRef.current;
    const sceneDefinition = currentScene; // Use scene from context

    console.log(`[WebGL/CanvasKey Effect] Running. Scene: ${sceneDefinition?.id}, RendererType: ${sceneDefinition?.rendererType}, CanvasKey: ${canvasKey}, Webcam: ${webcamElement ? 'Available' : 'Not Available'}`);

    if (!canvas) {
      console.log("[WebGL/CanvasKey Effect] Main canvas missing, ensuring cleanup.");
      if (webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Disposing main WebGL renderer due to missing canvas.");
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
      if (previousSceneWebGLAssetsRef.current?.sceneId) {
        const prevSceneToClean = scenes.find(s => s.id === previousSceneWebGLAssetsRef.current?.sceneId);
         if (prevSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up previous (transition) WebGL scene assets ${prevSceneToClean.id}.`);
          prevSceneToClean.cleanupWebGL(previousSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
      }
      previousSceneWebGLAssetsRef.current = null;
      return;
    }

    if (sceneDefinition?.rendererType === 'webgl') {
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
        // Ensure existing renderer is using the current canvas if canvasKey changed
        if (webGLRendererRef.current.domElement !== canvas) {
            console.log("[WebGL/CanvasKey Effect] WebGLRenderer exists, but canvas changed. Re-attaching renderer.");
            // This scenario is complex; ideally, dispose old & create new or re-init renderer with new canvas.
            // For simplicity of this step, we assume if canvasKey changes, a new renderer is made if one wasn't already.
            // If renderer exists and canvas changes, we might need to dispose/recreate it.
            // The logic above already handles creating if it's null.
            // If it's not null but the canvas is different, it implies the old one should have been disposed.
        }
        webGLRendererRef.current.setSize(canvas.width, canvas.height); // Ensure size is up-to-date
        webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
      }


      // Cleanup previous scene's WebGL assets if different
      if (currentSceneWebGLAssetsRef.current?.sceneId && currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id) {
        const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneDefToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up previous WebGL scene assets: ${prevSceneDefToClean.id}`);
          prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
        currentSceneWebGLAssetsRef.current = null;
      }
      
      if (sceneDefinition.initWebGL && 
        (!currentSceneWebGLAssetsRef.current || currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id ||
         (sceneDefinition.id === 'mirror_silhouette' && currentSceneWebGLAssetsRef.current.webcamElement !== webcamElement))
      ) {
        try {
          console.log(`[WebGL/CanvasKey Effect] Calling initWebGL for ${sceneDefinition.id} (Webcam: ${webcamElement ? 'Passed' : 'Not Passed'})`);
          const initializedAssets = sceneDefinition.initWebGL(canvas, settingsRef.current, webcamElement);
          currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id, webcamElement };
          console.log(`[WebGL/CanvasKey Effect] initWebGL for ${sceneDefinition.id} successful.`);
        } catch (e) {
          console.error(`[WebGL/CanvasKey Effect] Error during WebGL initialization for scene ${sceneDefinition.id}:`, e);
          setLastError(e instanceof Error ? e.message : String(e));
          currentSceneWebGLAssetsRef.current = null;
        }
      }
    } else { // Scene is 2D or undefined
      // Cleanup any existing WebGL resources if switching from WebGL to 2D
      if (webGLRendererRef.current) {
        console.log("[WebGL/CanvasKey Effect] Disposing WebGL renderer as switching to 2D scene or no scene.");
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevWebGLSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevWebGLSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up WebGL scene assets for ${prevWebGLSceneToClean.id} as switching to 2D.`);
          prevWebGLSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
        currentSceneWebGLAssetsRef.current = null;
      }
      if (previousSceneWebGLAssetsRef.current?.sceneId) {
         const prevSceneToClean = scenes.find(s => s.id === previousSceneWebGLAssetsRef.current?.sceneId);
         if (prevSceneToClean?.cleanupWebGL) {
          console.log(`[WebGL/CanvasKey Effect] Cleaning up previous (transition) WebGL scene assets ${prevSceneToClean.id}.`);
          prevSceneToClean.cleanupWebGL(previousSceneWebGLAssetsRef.current as Omit<WebGLSceneAssets, 'renderer'>);
        }
         previousSceneWebGLAssetsRef.current = null;
      }
    }

  }, [currentScene, canvasKey, webcamElement, scenes]); // settingsRef removed to avoid re-init on all settings change


  useEffect(() => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && currentSettings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.onload = () => { aiOverlayImageRef.current = img; };
      img.onerror = () => { console.error("VisualizerView: Failed to load AI overlay image."); aiOverlayImageRef.current = null; };
      img.src = currentSettings.aiGeneratedOverlayUri;
    } else {
      aiOverlayImageRef.current = null;
    }
  }, [settingsRef.current.enableAiOverlay, settingsRef.current.aiGeneratedOverlayUri]);


  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    // Check intended renderer type based on settings, not just currentScene state
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
  }, [scenes, settingsRef]); // settingsRef is stable

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
    const spectrum = currentAudioData.spectrum || INITIAL_AUDIO_DATA.spectrum;
    const canvas = overlayCtx.canvas;
    overlayCtx.font = `12px ${SBNF_BODY_FONT_FAMILY}`;
    const currentFgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || 'white';
    overlayCtx.fillStyle = currentFgColor;

    overlayCtx.textAlign = 'left';
    overlayCtx.fillText(`FPS: ${fps}`, 10, 20);

    overlayCtx.textAlign = 'right';
    const lineSpacing = 14;
    let currentY = 20;
    
    // console.log(`VisualizerView - AudioData: RMS: ${currentAudioData.rms.toFixed(3)} Beat: ${currentAudioData.beat} Bass: ${currentAudioData.bassEnergy.toFixed(3)} Mid: ${currentAudioData.midEnergy.toFixed(3)} Treble: ${currentAudioData.trebleEnergy.toFixed(3)} BPM: ${currentAudioData.bpm} Spectrum Sum: ${currentAudioData.spectrum.reduce((s,v)=>s+v,0)} First 5 bins: ${Array.from(currentAudioData.spectrum.slice(0,5))}`);

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

  }, [fps, currentScene, audioDataRef]);

  const drawErrorState = useCallback((targetCtx: CanvasRenderingContext2D | null) => {
    if (!targetCtx || !lastError) return;
    const canvas = targetCtx.canvas;
    targetCtx.clearRect(0, 0, canvas.width, canvas.height);
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

  // This drawSceneAndOverlays function is the heart of the rendering logic.
  // It decides whether to use 2D or WebGL rendering based on the currentScene.
  const drawSceneAndOverlays = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current;
    const activeSceneDefinition = currentScene; // Use scene from context
    const currentSettingsVal = settingsRef.current;
    const currentAudioDataVal = audioDataRef.current;

    if (!mainCanvas || !overlayCv) return;
    
    const overlayCtx = getOverlay2DContext();
    if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
    } else {
        console.warn("[DrawLoop] Could not get overlay 2D context.");
    }

    if (currentSettingsVal.panicMode) {
      if (lastError && overlayCtx) drawErrorState(overlayCtx); // Draw error on overlay if panic AND error
      if (webGLRendererRef.current && activeSceneDefinition?.rendererType === 'webgl') {
        const panicColor = new THREE.Color(0x000000);
        webGLRendererRef.current.setClearColor(panicColor, 1);
        webGLRendererRef.current.clear();
      } else {
        const mainCtx = get2DContext();
        if(mainCtx) {
          mainCtx.fillStyle = 'black';
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
        }
      }
      return;
    }

    if (lastError) {
      if (overlayCtx) drawErrorState(overlayCtx);
      // Main canvas clear for error state (important to prevent context conflicts on next scene)
      if (activeSceneDefinition?.rendererType === 'webgl' && webGLRendererRef.current) {
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
        const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
      } else { // Also clear if it was a 2D scene that errored or if no scene type known
        const mainCtx = get2DContext(); // This get2DContext now checks intended type
        if (mainCtx) {
          const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
          mainCtx.fillStyle = bgColor;
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
        }
      }
      return;
    }

    // Main scene rendering
    if (activeSceneDefinition?.rendererType === 'webgl') {
      if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === activeSceneDefinition.id && activeSceneDefinition.drawWebGL) {
        const { scene, camera, ...assets } = currentSceneWebGLAssetsRef.current;
        if (scene && camera) {
          activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene, camera, audioData: currentAudioDataVal, settings: currentSettingsVal,
            webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement
          });
          webGLRendererRef.current.render(scene, camera);
        } else if (overlayCtx) {
          overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
          overlayCtx.textAlign = 'center';
          overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
          overlayCtx.fillText(`WebGL scene '${activeSceneDefinition.name}' assets loading...`, mainCanvas.width / 2, mainCanvas.height / 2);
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
    } else if (activeSceneDefinition?.rendererType === '2d' || !activeSceneDefinition) { // 2D scene or no scene selected
      const mainCtx = get2DContext(); // This will return null if the *intended* scene is WebGL, preventing conflict.
      if (mainCtx) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (activeSceneDefinition?.draw) {
          // 2D Scene Transition Logic
          if (isTransitioning2D && previousScene2DRef.current?.draw && activeSceneDefinition.rendererType === '2d' && currentSettingsVal.sceneTransitionActive) {
            const elapsedTime = performance.now() - transition2DStartTimeRef.current;
            const progress = Math.min(1, elapsedTime / currentSettingsVal.sceneTransitionDuration);
            
            const prevSceneObj = scenes.find(s => s.id === previousScene2DRef.current?.id);
            if (prevSceneObj?.draw) drawPrimarySceneContent(mainCtx, prevSceneObj, 1 - progress);
            
            drawPrimarySceneContent(mainCtx, activeSceneDefinition, progress);
            if (progress >= 1) setIsTransitioning2D(false);
          } else {
            drawPrimarySceneContent(mainCtx, activeSceneDefinition);
          }
        } else if (overlayCtx) { // Draw placeholder on overlay if mainCtx is for 2D but no draw function
          const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
          mainCtx.fillStyle = bgColor; // Still clear main canvas
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
          overlayCtx.textAlign = 'center';
          overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
          overlayCtx.fillText(activeSceneDefinition ? `Scene '${activeSceneDefinition.name}' (2D) missing draw function` : 'No scene selected or scene loading...', mainCanvas.width / 2, mainCanvas.height / 2);
        }
      } else if (overlayCtx && activeSceneDefinition?.rendererType !== 'webgl') {
        // This case handles if get2DContext() returned null because the canvas was busy or another error,
        // but a 2D scene was intended. We draw a fallback message on the overlay.
        overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
        overlayCtx.textAlign = 'center';
        overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        overlayCtx.fillText('Error: Could not get 2D drawing context for main canvas.', mainCanvas.width / 2, mainCanvas.height / 2);
      }
    }

    // Draw 2D overlays on the separate overlay canvas
    if (overlayCtx && !currentSettingsVal.panicMode && !lastError) {
        drawAiGeneratedOverlay2D(overlayCtx);
        if (currentSceneWebGLAssetsRef.current?.vinesData?.activeVines && activeSceneDefinition?.rendererType === 'webgl') {
            drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
        }
        drawDebugInfo(overlayCtx);
    }
  }, [
    currentScene, 
    get2DContext, getOverlay2DContext, drawErrorState, drawPrimarySceneContent,
    drawAiGeneratedOverlay2D, drawDebugInfo, drawProceduralVinesOnOverlay,
    isTransitioning2D, webcamElement, settingsRef, audioDataRef, lastError, scenes // Added scenes
  ]);


  const drawLoop = useCallback(() => {
    updateFps();
    drawSceneAndOverlays(); // Call the main drawing orchestrator
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [updateFps, drawSceneAndOverlays]);

  useEffect(() => {
    console.log("[DrawLoop Effect] Setting up main animation loop.");
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        console.log("[DrawLoop Effect - CLEANUP] Cancelling main animation loop. ID:", animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]); // Now depends on the stable drawLoop

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
  }, [canvasKey]); // Only re-observe on canvasKey change

  // Handle 2D scene transitions
  useEffect(() => {
    if (currentScene?.rendererType === '2d') {
        const activeSceneDefinition = currentScene;
        if (previousScene2DRef.current && 
            previousScene2DRef.current.id !== activeSceneDefinition.id && 
            settingsRef.current.sceneTransitionActive && 
            settingsRef.current.sceneTransitionDuration > 0) {
            setIsTransitioning2D(true);
            transition2DStartTimeRef.current = performance.now();
        } else {
            setIsTransitioning2D(false);
        }
        previousScene2DRef.current = activeSceneDefinition;
    } else {
        // If switching away from 2D or to a non-2D scene, ensure transition state is reset
        setIsTransitioning2D(false);
        previousScene2DRef.current = null;
    }
  }, [currentScene, settingsRef.current.sceneTransitionActive, settingsRef.current.sceneTransitionDuration]);


  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={`main-canvas-${canvasKey}`} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={`overlay-canvas-${canvasKey}`} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

    