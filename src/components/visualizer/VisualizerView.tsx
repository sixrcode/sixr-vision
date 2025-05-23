
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // For 2D overlays and debug info

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

  const { scenes, currentScene } = useScene(); // currentScene from context is the source of truth

  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<(Omit<WebGLSceneAssets, 'renderer'> & { sceneId?: string; webcamElement?: HTMLVideoElement | null; }) | null>(null);
  const prevRendererTypeRef = useRef<string | undefined>(undefined);
  const [canvasKey, setCanvasKey] = useState(0);

  // For 2D scene transitions
  const [isTransitioning2D, setIsTransitioning2D] = useState(false);
  const transition2DStartTimeRef = useRef<number>(0);
  const previousScene2DRef = useRef<SceneDefinition | null>(null);


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
      setCanvasKey(key => key + 1);
    }
    prevRendererTypeRef.current = activeSceneRendererType;
  }, [currentScene]);


  // Effect for WebGL initialization and cleanup
  useEffect(() => {
    setLastError(null); 
    const canvas = canvasRef.current;
    const sceneDefinition = currentScene; 

    if (!canvas) {
      if (webGLRendererRef.current) {
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneToClean?.cleanupWebGL) {
          prevSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
      }
      currentSceneWebGLAssetsRef.current = null;
      return;
    }

    if (sceneDefinition?.rendererType === 'webgl') {
      if (!webGLRendererRef.current || webGLRendererRef.current.domElement !== canvas) {
        if (webGLRendererRef.current) {
          webGLRendererRef.current.dispose();
        }
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
      webGLRendererRef.current.setSize(canvas.width, canvas.height);
      webGLRendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));

      if (currentSceneWebGLAssetsRef.current &&
         (currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id ||
          currentSceneWebGLAssetsRef.current.webcamElement !== webcamElement)
      ) {
        const prevSceneDefToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevSceneDefToClean?.cleanupWebGL) {
          prevSceneDefToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
        currentSceneWebGLAssetsRef.current = null;
      }

      if (sceneDefinition.initWebGL &&
        (!currentSceneWebGLAssetsRef.current || currentSceneWebGLAssetsRef.current.sceneId !== sceneDefinition.id || currentSceneWebGLAssetsRef.current.webcamElement !== webcamElement)
      ) {
        try {
          const initializedAssets = sceneDefinition.initWebGL(canvas, settingsRef.current, webcamElement);
          currentSceneWebGLAssetsRef.current = { ...initializedAssets, sceneId: sceneDefinition.id, webcamElement };
        } catch (e) {
          console.error(`[WebGL/CanvasKey Effect] Error during WebGL initialization for scene ${sceneDefinition.id}:`, e);
          setLastError(e instanceof Error ? e.message : String(e));
          currentSceneWebGLAssetsRef.current = null;
        }
      }
    } else { 
      if (currentSceneWebGLAssetsRef.current?.sceneId) {
        const prevWebGLSceneToClean = scenes.find(s => s.id === currentSceneWebGLAssetsRef.current?.sceneId);
        if (prevWebGLSceneToClean?.cleanupWebGL) {
          prevWebGLSceneToClean.cleanupWebGL(currentSceneWebGLAssetsRef.current);
        }
        currentSceneWebGLAssetsRef.current = null;
      }
      if (webGLRendererRef.current) {
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
    }

    return () => {
      if (webGLRendererRef.current && webGLRendererRef.current.domElement !== canvasRef.current) {
        webGLRendererRef.current.dispose();
        webGLRendererRef.current = null;
      }
    };
  }, [currentScene, scenes, canvasKey, webcamElement]);


  const get2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const intendedSceneDefinition = scenes.find(s => s.id === settingsRef.current.currentSceneId);
    if (intendedSceneDefinition?.rendererType === 'webgl') {
        return null; 
    }
    try {
      return canvas.getContext('2d');
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for main canvas:", e);
      setLastError("Error acquiring 2D context for main canvas.");
      return null;
    }
  }, [scenes]); 

  const getOverlay2DContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.getContext('2d', { alpha: true });
    } catch (e) {
      console.error("VisualizerView: Error getting 2D context for overlay canvas:", e);
      setLastError("Error acquiring 2D context for overlay canvas.");
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
  }, [webcamElement]); 

  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);
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


  const drawAiGeneratedOverlay2D = useCallback((overlayCtx: CanvasRenderingContext2D | null) => {
    const currentSettings = settingsRef.current;
    if (currentSettings.enableAiOverlay && aiOverlayImageRef.current && overlayCtx) {
      const originalAlpha = overlayCtx.globalAlpha;
      const originalCompositeOperation = overlayCtx.globalCompositeOperation;
      overlayCtx.globalAlpha = currentSettings.aiOverlayOpacity;
      overlayCtx.globalCompositeOperation = currentSettings.aiOverlayBlendMode;
      overlayCtx.drawImage(aiOverlayImageRef.current, 0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
      overlayCtx.globalAlpha = originalAlpha;
      overlayCtx.globalCompositeOperation = originalCompositeOperation;
    }
  }, []); 

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
      // Apply opacity to HSL or RGB color strings
      if (strokeColor.startsWith('hsl(') && !strokeColor.startsWith('hsla(')) {
        strokeColor = strokeColor.replace('hsl(', `hsla(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('rgb(') && !strokeColor.startsWith('rgba(')) {
        strokeColor = strokeColor.replace('rgb(', `rgba(`).replace(')', `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith('hsla(') || strokeColor.startsWith('rgba(')) {
        const alphaMatch = strokeColor.match(/,(?:\s*([0-9.]+)\))/);
        if (alphaMatch && alphaMatch[1]) {
            strokeColor = strokeColor.replace(alphaMatch[0], `, ${vine.opacity.toFixed(2)})`);
        } else { // If no alpha present, append it
            strokeColor = strokeColor.slice(0, -1) + `, ${vine.opacity.toFixed(2)})`;
        }
      } else { // Fallback for named colors or hex - use globalAlpha
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
    overlayCtx.fillText(`Scene: ${currentScene?.id || 'None'} (${currentScene?.rendererType || 'N/A'})`, 10, 34);

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
  }, [fps, currentScene]); 

  const drawErrorState = useCallback((targetCtx: CanvasRenderingContext2D | null, error: string | null) => {
    if (!targetCtx || !error) return;
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
    const lines = error.split('\n');
    lines.forEach((line, index) => {
      targetCtx.fillText(line, canvas.width / 2, canvas.height / 2 + (index * 18));
    });
  }, []); 

  const drawSceneAndOverlays = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const overlayCv = overlayCanvasRef.current;

    if (!mainCanvas || !overlayCv) {
      return;
    }
    
    const currentSettingsVal = settingsRef.current;
    const currentAudioDataVal = audioDataRef.current;
    const activeSceneDefinition = currentScene; 

    const overlayCtx = getOverlay2DContext();
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);
    }
    
    if (currentSettingsVal.panicMode) {
      if (lastError && overlayCtx) drawErrorState(overlayCtx, lastError);
      else if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCv.width, overlayCv.height);

      if (webGLRendererRef.current) {
          const panicColor = new THREE.Color(0x000000);
          webGLRendererRef.current.setClearColor(panicColor, 1);
          webGLRendererRef.current.clear();
      } else if (activeSceneDefinition?.rendererType !== 'webgl') { 
          const mainCtx = get2DContext();
          if (mainCtx) { 
              mainCtx.fillStyle = 'black';
              mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
          }
      }
      return;
    }

    if (lastError && overlayCtx) {
      drawErrorState(overlayCtx, lastError);
      if (activeSceneDefinition?.rendererType === 'webgl' && webGLRendererRef.current) {
        const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
        const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
        webGLRendererRef.current.setClearColor(bgColorThree, 1);
        webGLRendererRef.current.clear();
      } else if (activeSceneDefinition?.rendererType !== 'webgl') {
        const mainCtx = get2DContext();
        if (mainCtx) {
          const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
          mainCtx.fillStyle = bgColor;
          mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
        }
      }
      return;
    }

    if (activeSceneDefinition?.rendererType === 'webgl') {
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.sceneId === activeSceneDefinition.id && activeSceneDefinition.drawWebGL) {
            const { scene, camera, ...assets } = currentSceneWebGLAssetsRef.current;
            if (scene && camera) {
              activeSceneDefinition.drawWebGL({
                  renderer: webGLRendererRef.current,
                  scene, camera, audioData: currentAudioDataVal, settings: currentSettingsVal,
                  webGLAssets: assets, canvasWidth: mainCanvas.width, canvasHeight: mainCanvas.height, webcamElement
              });
            } else {
              const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
              const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
              if(webGLRendererRef.current) { 
                webGLRendererRef.current.setClearColor(bgColorThree, 1);
                webGLRendererRef.current.clear();
              }
            }
        } else if (webGLRendererRef.current) { 
            const bgColorString = getComputedStyle(document.documentElement).getPropertyValue('--background-hsl').trim();
            const bgColorThree = new THREE.Color(bgColorString ? `hsl(${bgColorString})` : '#000000');
            webGLRendererRef.current.setClearColor(bgColorThree, 1);
            webGLRendererRef.current.clear();
            if (overlayCtx) {
                overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
                overlayCtx.textAlign = 'center';
                overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
                overlayCtx.fillText(activeSceneDefinition ? `WebGL scene '${activeSceneDefinition.name}' loading assets...` : 'Loading WebGL scene...', mainCanvas.width / 2, mainCanvas.height / 2);
            }
        } else if (overlayCtx) { 
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText('Initializing WebGL renderer for scene...', mainCanvas.width / 2, mainCanvas.height / 2);
        }
    } else if (activeSceneDefinition?.rendererType === '2d' || !activeSceneDefinition) { 
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
            } else if (overlayCtx) { 
                const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || 'black';
                mainCtx.fillStyle = bgColor;
                mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

                overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || 'gray';
                overlayCtx.textAlign = 'center';
                overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
                overlayCtx.fillText(activeSceneDefinition ? `Scene '${activeSceneDefinition.name}' (2D) has no draw function.` : 'No scene selected.', mainCanvas.width / 2, mainCanvas.height / 2);
            }
        } else if (overlayCtx && activeSceneDefinition?.rendererType !== 'webgl') {
            overlayCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim() || 'red';
            overlayCtx.textAlign = 'center';
            overlayCtx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
            overlayCtx.fillText('Error: Could not get 2D context for main canvas. Intended 2D scene.', mainCanvas.width / 2, mainCanvas.height / 2);
        }
    }

    if (overlayCtx && !currentSettingsVal.panicMode && !lastError) {
        drawAiGeneratedOverlay2D(overlayCtx);
        if (activeSceneDefinition?.rendererType === 'webgl' && currentSceneWebGLAssetsRef.current?.vinesData?.activeVines) {
            drawProceduralVinesOnOverlay(overlayCtx, currentSceneWebGLAssetsRef.current.vinesData.activeVines);
        }
        drawDebugInfo(overlayCtx);
    }
  }, [
    currentScene, 
    scenes,
    get2DContext, getOverlay2DContext, drawErrorState, drawPrimarySceneContent,
    drawAiGeneratedOverlay2D, drawDebugInfo, drawProceduralVinesOnOverlay,
    isTransitioning2D, webcamElement, audioDataRef, lastError, 
    fps 
  ]);


  const drawLoop = useCallback(() => {
    updateFps();
    drawSceneAndOverlays(); 
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
  }, [updateFps, drawSceneAndOverlays]);

  useEffect(() => {
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
                camera.aspect = initialWidth > 0 && newHeight > 0 ? initialWidth / initialHeight : 1;
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

  useEffect(() => {
    if (currentScene?.rendererType === '2d') {
        if (previousScene2DRef.current &&
            previousScene2DRef.current.id !== currentScene.id &&
            settingsRef.current.sceneTransitionActive &&
            settingsRef.current.sceneTransitionDuration > 0) {
            setIsTransitioning2D(true);
            transition2DStartTimeRef.current = performance.now();
        } else {
            setIsTransitioning2D(false);
        }
        previousScene2DRef.current = currentScene;
    } else {
        setIsTransitioning2D(false);
        previousScene2DRef.current = null;
    }
  }, [currentScene]); 

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0 z-0" key={`main-canvas-${canvasKey}`} />
      <canvas ref={overlayCanvasRef} className="w-full h-full absolute top-0 left-0 z-10 pointer-events-none" key={`overlay-canvas-${canvasKey}`} />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}

      