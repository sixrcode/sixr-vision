/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebGLSceneAssets } from '@/types';

import { useSettings }   from '@/providers/SettingsProvider';
import { useAudioData }  from '@/providers/AudioDataProvider';
import { useScene }      from '@/providers/SceneProvider';

import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed }      from './WebcamFeed';

import * as THREE from 'three';

/**
 * VisualizerView
 * ------------------------------------------------------------------
 * • Single WebGL render-path (2-D canvas renderer removed).
 * • Handles scene init / cleanup, resize, FPS monitoring, webcam feed,
 *   optional AI-overlay (as WebGL texture) and branding overlay.
 */

export function VisualizerView() {
  /* ─────────────────────────── Refs & State ────────────────────────── */
  const canvasRef           = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef    = useRef<HTMLCanvasElement>(null);

  const { settings }        = useSettings();
  const { audioData }       = useAudioData();
  const { scenes }          = useScene();

  const animationFrameIdRef = useRef<number | null>(null);
  const lastSceneIdRef      = useRef<string | undefined>(settings.currentSceneId);

  /* Webcam feed ( HTMLVideoElement ) */
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);

  /* Error banner for fatal scene/renderer problems */
  const [lastError, setLastError] = useState<string | null>(null);

  /* AI overlay image → THREE.CanvasTexture */
  const aiOverlayImageRef   = useRef<HTMLImageElement | null>(null);
  const [aiOverlayTexture, setAiOverlayTexture] =
    useState<THREE.CanvasTexture | null>(null);
  const aiOverlayTextureRef = useRef<THREE.CanvasTexture | null>(null);

  /* WebGL renderer & per-scene assets */
  const webGLRendererRef              = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneAssetsRef         = useRef<WebGLSceneAssets | null>(null);
  const previousSceneAssetsCleanupRef = useRef<WebGLSceneAssets | null>(null);

  /* FPS monitor (lightweight) */
  const lastFrameTimeRef  = useRef(performance.now());
  const frameCountRef     = useRef(0);
  const [fps, setFps]     = useState(0);
  const lastLoggedFpsRef  = useRef<number>(0);
  const fpsDropThreshold  = 10;               // warn if FPS dips by >10

  /* ─────────────────────── Scene (Re)initialisation ─────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newSceneDef  = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevSceneDef = scenes.find(s => s.id === lastSceneIdRef.current)   || null;

    /* 1. Clean up assets from *previous* WebGL scene (if any) */
    if (
      prevSceneDef &&
      prevSceneDef.id !== newSceneDef?.id &&
      prevSceneDef.cleanupWebGL &&
      previousSceneAssetsCleanupRef.current
    ) {
      console.log(`VisualizerView: cleaning up previous scene "${prevSceneDef.id}"`);
      prevSceneDef.cleanupWebGL(previousSceneAssetsCleanupRef.current);
      previousSceneAssetsCleanupRef.current = null;
    }

    /* 2. Initialise the *new* scene (WebGL only) */
    if (newSceneDef && newSceneDef.initWebGL) {
      if (!webGLRendererRef.current) {
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
          });
          webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);
        } catch (err) {
          console.error('VisualizerView: WebGLRenderer creation failed', err);
          setLastError(
            err instanceof Error ? err.message : String(err)
          );
          return;
        }
      }

      /* renderer size → canvas size */
      webGLRendererRef.current.setSize(canvas.width, canvas.height);

      try {
        const assets = newSceneDef.initWebGL(canvas, settings, webcamElement);
        currentSceneAssetsRef.current         = assets;
        previousSceneAssetsCleanupRef.current = assets;
        setLastError(null);
      } catch (err) {
        console.error(
          `VisualizerView: initWebGL failed for scene "${newSceneDef.id}"`,
          err,
        );
        setLastError(err instanceof Error ? err.message : String(err));
        currentSceneAssetsRef.current         = null;
        previousSceneAssetsCleanupRef.current = null;
      }
    } else if (newSceneDef) {
      // Scene exists but has no WebGL implementation (should not occur)
      console.warn(`VisualizerView: scene "${newSceneDef.id}" has no initWebGL.`);
      currentSceneAssetsRef.current = null;
    }

    lastSceneIdRef.current = settings.currentSceneId;

    return () => {
      /* cleanup when effect re-runs OR component unmounts */
      const sceneToClean = scenes.find(s => s.id === lastSceneIdRef.current);
      if (
        sceneToClean &&
        sceneToClean.cleanupWebGL &&
        previousSceneAssetsCleanupRef.current
      ) {
        console.log(
          `VisualizerView: effect cleanup for scene "${sceneToClean.id}"`,
        );
        sceneToClean.cleanupWebGL(previousSceneAssetsCleanupRef.current);
        previousSceneAssetsCleanupRef.current = null;
      }
    };
  }, [settings.currentSceneId, scenes, settings, webcamElement]);

  /* ───────────────────────────── AI Overlay ─────────────────────────── */

  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        aiOverlayImageRef.current = img;
        const tex = new THREE.CanvasTexture(img);
        tex.needsUpdate = true;

        setAiOverlayTexture(prev => {
          if (prev && prev !== tex) prev.dispose();
          return tex;
        });
      };
      img.onerror = () => {
        console.error('VisualizerView: failed to load AI overlay image');
        aiOverlayImageRef.current = null;
        setAiOverlayTexture(prev => {
          if (prev) prev.dispose();
          return null;
        });
      };
      img.src = settings.aiGeneratedOverlayUri;
    } else {
      aiOverlayImageRef.current = null;
      setAiOverlayTexture(prev => {
        if (prev) prev.dispose();
        return null;
      });
    }
  }, [settings.enableAiOverlay, settings.aiGeneratedOverlayUri]);

  /* keep a ref pointer for component-unmount disposal */
  useEffect(() => {
    aiOverlayTextureRef.current = aiOverlayTexture;
  }, [aiOverlayTexture]);

  /* dispose AI overlay texture on unmount */
  useEffect(
    () => () => {
      aiOverlayTextureRef.current?.dispose();
      aiOverlayTextureRef.current = null;
    },
    [],
  );

  /* ───────────────────────────── FPS Monitor ────────────────────────── */

  const updateFps = useCallback(() => {
    const now   = performance.now();
    const delta = now - lastFrameTimeRef.current;

    frameCountRef.current += 1;
    if (delta >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current      = 0;
      lastFrameTimeRef.current    = now;
    }
  }, []);

  /* periodic FPS logger */
  useEffect(() => {
    const id = setInterval(() => {
      if (!settings.panicMode && fps > 0) {
        if (
          lastLoggedFpsRef.current > 0 &&
          lastLoggedFpsRef.current - fps > fpsDropThreshold
        ) {
          console.warn(
            `[Performance] FPS drop: ${lastLoggedFpsRef.current} → ${fps}`,
          );
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5_000);

    return () => clearInterval(id);
  }, [fps, settings.panicMode]);

  /* ───────────────────────────── Draw Loop ──────────────────────────── */

  const drawLoop = useCallback(() => {
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    updateFps();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const sceneDef = scenes.find(s => s.id === settings.currentSceneId);
    if (!sceneDef || !sceneDef.drawWebGL) return;

    /* Panic mode simply blanks the screen */
    if (settings.panicMode) {
      if (webGLRendererRef.current) {
        webGLRendererRef.current.setClearColor(0x000000, 1);
        webGLRendererRef.current.clear();
      }
      return;
    }

    try {
      if (
        webGLRendererRef.current &&
        currentSceneAssetsRef.current?.scene &&
        currentSceneAssetsRef.current?.camera
      ) {
        /* 1. let scene draw-function update objects/uniforms */
        sceneDef.drawWebGL({
          renderer:     webGLRendererRef.current,
          scene:        currentSceneAssetsRef.current.scene,
          camera:       currentSceneAssetsRef.current.camera,
          audioData,
          settings,
          webGLAssets:  currentSceneAssetsRef.current,
          canvasWidth:  canvas.width,
          canvasHeight: canvas.height,
          webcamElement,
        });

        /* 2. render base scene */
        webGLRendererRef.current.render(
          currentSceneAssetsRef.current.scene,
          currentSceneAssetsRef.current.camera,
        );

        /* 3. render AI overlay as full-screen quad */
        if (
          settings.enableAiOverlay &&
          aiOverlayTexture &&
          webGLRendererRef.current
        ) {
          const w = canvas.width;
          const h = canvas.height;

          const overlayCam   = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 1);
          const overlayScene = new THREE.Scene();
          const geom         = new THREE.PlaneGeometry(w, h);
          const mat          = new THREE.MeshBasicMaterial({
            map:            aiOverlayTexture,
            transparent:    true,
            opacity:        settings.aiOverlayOpacity,
            blending:       THREE.CustomBlending,
          });

          /* map CSS blend name → THREE blend factors */
          switch (settings.aiOverlayBlendMode) {
            case 'multiply':
              mat.blendSrc = THREE.DstColorFactor;
              mat.blendDst = THREE.ZeroFactor;
              break;
            case 'screen':
              mat.blendSrc = THREE.OneFactor;
              mat.blendDst = THREE.OneMinusSrcColorFactor;
              break;
            case 'add': // “lighter”
              mat.blendSrc = THREE.SrcAlphaFactor;
              mat.blendDst = THREE.OneFactor;
              break;
            /* default = “normal” */
            default:
              mat.blendSrc = THREE.SrcAlphaFactor;
              mat.blendDst = THREE.OneMinusSrcAlphaFactor;
          }

          overlayScene.add(new THREE.Mesh(geom, mat));

          const autoClear = webGLRendererRef.current.autoClear;
          webGLRendererRef.current.autoClear = false;
          webGLRendererRef.current.render(overlayScene, overlayCam);
          webGLRendererRef.current.autoClear = autoClear;
        }

        setLastError(null);
      }
    } catch (err) {
      console.error('VisualizerView: drawLoop error', err);
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, [
    audioData,
    scenes,
    settings,
    webcamElement,
    aiOverlayTexture,
    updateFps,
  ]);

  /* mount / unmount drawLoop */
  useEffect(() => {
    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop]);

  /* ─────────────────────────── Canvas Resize ────────────────────────── */

  useEffect(() => {
    const mainCanvas    = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!mainCanvas || !overlayCanvas) return;

    const parent = mainCanvas.parentElement;
    if (!parent) return;

    const handleResize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      if (mainCanvas.width !== w || mainCanvas.height !== h) {
        mainCanvas.width  = w;
        mainCanvas.height = h;
      }
      if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
        overlayCanvas.width  = w;
        overlayCanvas.height = h;
      }

      if (webGLRendererRef.current) {
        webGLRendererRef.current.setSize(w, h);

        const cam = currentSceneAssetsRef.current?.camera;
        if (cam instanceof THREE.PerspectiveCamera) {
          cam.aspect = w / h;
        } else if (cam instanceof THREE.OrthographicCamera) {
          cam.left   = -w / 2;
          cam.right  =  w / 2;
          cam.top    =  h / 2;
          cam.bottom = -h / 2;
        }
        cam?.updateProjectionMatrix();
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
    handleResize();          // initial size

    return () => ro.disconnect();
  }, []);

  /* ─────────────────────────────── JSX ──────────────────────────────── */

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef}        className="absolute w-full h-full top-0 left-0 z-0" />
      <canvas ref={overlayCanvasRef} className="absolute w-full h-full top-0 left-0 z-10 pointer-events-none" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
      {/* Optionally show lastError as HTML overlay for debugging */}
      {lastError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80 text-red-500 text-center p-4">
          <p className="max-w-lg text-sm whitespace-pre-wrap">{lastError}</p>
        </div>
      )}
    </div>
  );
}
